import { beforeAll, describe, expect, it } from 'vitest';

import {
    getMunchkinSpecialCardDescriptor,
    MUNCHKIN_MONSTER_DECK_DEF_IDS,
} from '../data/factions/munchkin';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getBaseDef, getCardDef } from '../data/cards';
import { validate } from '../domain/commands';
import { execute, reduce } from '../domain/reducer';
import {
    getControlledMonsterPowerOnBase,
    getEffectivePower,
    getEffectiveBreakpoint,
    getMonsterPowerOnBase,
    getPlayerEffectivePowerOnBase,
    getTotalEffectivePowerOnBase,
} from '../domain/ongoingModifiers';
import { fireTriggers, isCardSuppressed, isMinionProtected } from '../domain/ongoingEffects';
import { SU_COMMANDS, SU_EVENTS, type BaseReplacedEvent, type LimitModifiedEvent, type SmashUpCore, type TempPowerAddedEvent } from '../domain/types';
import { makeBase, makeCard, makeMatchState, makeMinion, makeState } from './helpers';
import { runCommand } from './testRunner';

const fixedRandom = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('Smash Up Munchkin 怪物基础机制', () => {
    it('怪物和 Munchkin 基地带有规则数值合同', () => {
        expect(getMunchkinSpecialCardDescriptor('munchkin_monster_treasure_dragon')).toMatchObject({
            kind: 'monster',
            power: 5,
            treasureReward: 3,
        });
        expect(getMunchkinSpecialCardDescriptor('munchkin_monster_bigfoot')).toMatchObject({
            kind: 'monster',
            power: 4,
            treasureReward: 2,
        });
        expect(getMunchkinSpecialCardDescriptor('munchkin_monster_gross_troll')).toMatchObject({
            kind: 'monster',
            power: 1,
            treasureReward: 0,
        });
        expect(getBaseDef('base_the_mines')).toMatchObject({ monsterCount: 2 });
        expect(getBaseDef('base_whack_a_ghoul')).toMatchObject({ monsterCount: 3 });
    });

    it('基地上的怪物提高破坏门槛，但不计入任何玩家总力', () => {
        const base = makeBase({
            defId: 'base_the_mines',
            minions: [makeMinion('m1', 'alien_invader', '0', 18)],
            monsters: [
                { uid: 'monster-1', defId: 'munchkin_monster_treasure_dragon' },
                { uid: 'monster-2', defId: 'munchkin_monster_bigfoot' },
            ],
        });
        const state = makeState({ bases: [base] });

        expect(getMonsterPowerOnBase(state, 0)).toBe(9);
        expect(getEffectiveBreakpoint(state, 0)).toBe(27);
        expect(getTotalEffectivePowerOnBase(state, state.bases[0], 0)).toBe(18);
    });

    it('受控怪物不再抬高基地门槛，而是计入控制者力量', () => {
        const base = makeBase({
            defId: 'base_the_mines',
            minions: [makeMinion('m1', 'alien_invader', '0', 18)],
            monsters: [
                { uid: 'monster-1', defId: 'munchkin_monster_treasure_dragon', controllerId: '1' },
                { uid: 'monster-2', defId: 'munchkin_monster_bigfoot' },
            ],
        });
        const state = makeState({ bases: [base] });

        expect(getMonsterPowerOnBase(state, 0)).toBe(4);
        expect(getEffectiveBreakpoint(state, 0)).toBe(22);
        expect(getControlledMonsterPowerOnBase(state, 0, '1')).toBe(5);
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '0')).toBe(18);
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '1')).toBe(5);
        expect(getTotalEffectivePowerOnBase(state, state.bases[0], 0)).toBe(23);
    });

    it('换出需要怪物的基地时，从怪物牌库发怪物到基地下方并消耗公共牌堆', () => {
        const state = makeState({
            bases: [],
            baseDeck: ['base_the_mines', 'base_jungle'],
            monsterDeck: [
                'munchkin_monster_treasure_dragon',
                'munchkin_monster_bigfoot',
                'munchkin_monster_ghoul',
            ],
            nextUid: 500,
        });
        const event: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'old_base', newBaseDefId: 'base_the_mines' },
            timestamp: 1,
        };

        const next = reduce(state, event);

        expect(next.bases[0]).toMatchObject({ defId: 'base_the_mines' });
        expect(next.bases[0].monsters).toEqual([
            { uid: 'munchkin_monster_500', defId: 'munchkin_monster_treasure_dragon' },
            { uid: 'munchkin_monster_501', defId: 'munchkin_monster_bigfoot' },
        ]);
        expect(next.monsterDeck).toEqual(['munchkin_monster_ghoul']);
        expect(next.nextUid).toBe(502);
    });

    it('初始翻出的 Munchkin 基地也会从公共怪物牌堆补足怪物', () => {
        const state: SmashUpCore = makeState({
            bases: [makeBase({ defId: 'base_the_mines' }), makeBase({ defId: 'base_treasure_bath' })],
            factionSelection: {
                takenFactions: ['munchkin_dwarves', 'aliens', 'pirates', 'ninjas'],
                playerSelections: {
                    '0': ['munchkin_dwarves', 'aliens'],
                    '1': ['pirates', 'ninjas'],
                },
                completedPlayers: ['0', '1'],
            },
        });

        const next = reduce(state, {
            type: SU_EVENTS.ALL_FACTIONS_SELECTED,
            payload: {
                readiedPlayers: {
                    '0': { deck: [], hand: [] },
                    '1': { deck: [], hand: [] },
                },
                nextUid: 300,
            },
            timestamp: 1,
        } as any);

        expect(next.bases[0].monsters?.map(monster => monster.defId)).toEqual(MUNCHKIN_MONSTER_DECK_DEF_IDS.slice(0, 2));
        expect(next.bases[1].monsters?.map(monster => monster.defId)).toEqual(MUNCHKIN_MONSTER_DECK_DEF_IDS.slice(2, 3));
        expect(next.monsterDeck).toEqual(MUNCHKIN_MONSTER_DECK_DEF_IDS.slice(3));
        expect(next.nextUid).toBe(303);
    });

    it('基地清场时公共怪物离开基地并进入怪物弃牌堆，普通弃牌堆不显示特殊小牌', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                monsters: [
                    { uid: 'monster-1', defId: 'munchkin_monster_treasure_dragon' },
                    { uid: 'monster-2', defId: 'munchkin_monster_bigfoot' },
                ],
            })],
            monsterDiscard: ['munchkin_monster_ghoul'],
        });

        const next = reduce(state, {
            type: SU_EVENTS.BASE_CLEARED,
            payload: { baseIndex: 0, baseDefId: 'base_the_mines' },
            timestamp: 1,
        });

        expect(next.bases).toHaveLength(0);
        expect(next.monsterDiscard).toEqual([
            'munchkin_monster_ghoul',
            'munchkin_monster_treasure_dragon',
            'munchkin_monster_bigfoot',
        ]);
        expect(next.players['0'].discard).toHaveLength(0);
        expect(next.players['1'].discard).toHaveLength(0);
    });

    it('击败怪物会移出基地、进入怪物弃牌堆，并把奖励宝藏按牌面牌种加入玩家手牌', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                monsters: [
                    { uid: 'monster-1', defId: 'munchkin_monster_treasure_dragon' },
                    { uid: 'monster-2', defId: 'munchkin_monster_bigfoot' },
                ],
            })],
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_halfling_hireling',
                'munchkin_treasure_tiger_steed',
                'munchkin_treasure_bag_of_caltrops',
            ],
            monsterDiscard: ['munchkin_monster_ghoul'],
            nextUid: 700,
        });

        const next = reduce(state, {
            type: SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED,
            payload: {
                playerId: '0',
                baseIndex: 0,
                monsterUid: 'monster-1',
                reason: 'munchkin_test',
            },
            timestamp: 1,
        });

        expect(next.bases[0].monsters?.map(monster => monster.uid)).toEqual(['monster-2']);
        expect(next.monsterDiscard).toEqual(['munchkin_monster_ghoul', 'munchkin_monster_treasure_dragon']);
        expect(next.treasureDeck).toEqual(['munchkin_treasure_bag_of_caltrops']);
        expect(next.players['0'].hand).toEqual([
            { uid: 'munchkin_treasure_700', defId: 'munchkin_treasure_dwarf_hireling', type: 'minion', owner: '0' },
            { uid: 'munchkin_treasure_701', defId: 'munchkin_treasure_halfling_hireling', type: 'minion', owner: '0' },
            { uid: 'munchkin_treasure_702', defId: 'munchkin_treasure_tiger_steed', type: 'minion', owner: '0' },
        ]);
        expect(getCardDef('munchkin_treasure_dwarf_hireling')).toMatchObject({
            id: 'munchkin_treasure_dwarf_hireling',
            type: 'minion',
            power: 2,
            previewRef: expect.any(Object),
        });
        expect(next.nextUid).toBe(703);
    });

    it('击败无奖励怪物只移动怪物，不抽宝藏', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                monsters: [{ uid: 'monster-1', defId: 'munchkin_monster_gross_troll' }],
            })],
            treasureDeck: ['munchkin_treasure_dwarf_hireling'],
            nextUid: 800,
        });

        const next = reduce(state, {
            type: SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED,
            payload: {
                playerId: '0',
                baseIndex: 0,
                monsterUid: 'monster-1',
                reason: 'munchkin_test',
            },
            timestamp: 1,
        });

        expect(next.bases[0].monsters).toEqual([]);
        expect(next.monsterDiscard).toEqual(['munchkin_monster_gross_troll']);
        expect(next.treasureDeck).toEqual(['munchkin_treasure_dwarf_hireling']);
        expect(next.players['0'].hand).toHaveLength(0);
        expect(next.nextUid).toBe(800);
    });

    it('命令层允许玩家点击力量足够的公共怪物并获得宝藏', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('hero-1', 'munchkin_warriors_big_hero', '0', 5)],
                monsters: [{ uid: 'monster-1', defId: 'munchkin_monster_treasure_dragon' }],
            })],
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_halfling_hireling',
                'munchkin_treasure_tiger_steed',
                'munchkin_treasure_bag_of_caltrops',
            ],
            nextUid: 900,
        });
        const matchState = makeMatchState(state);
        const command = {
            type: SU_COMMANDS.DEFEAT_MUNCHKIN_MONSTER,
            playerId: '0',
            payload: { baseIndex: 0, monsterUid: 'monster-1' },
        } as const;

        expect(validate(matchState, command)).toEqual({ valid: true });
        const events = execute(matchState, command, fixedRandom);

        expect(events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED,
            payload: expect.objectContaining({
                playerId: '0',
                baseIndex: 0,
                monsterUid: 'monster-1',
            }),
        }));

        const next = events.reduce((core, event) => reduce(core, event), state);
        expect(next.bases[0].monsters).toEqual([]);
        expect(next.monsterDiscard).toEqual(['munchkin_monster_treasure_dragon']);
        expect(next.treasureDeck).toEqual(['munchkin_treasure_bag_of_caltrops']);
        expect(next.players['0'].hand.map(card => card.defId)).toEqual([
            'munchkin_treasure_dwarf_hireling',
            'munchkin_treasure_halfling_hireling',
            'munchkin_treasure_tiger_steed',
        ]);
        expect(next.players['0'].hand.map(card => card.type)).toEqual(['minion', 'minion', 'minion']);
    });

    it('命令层拒绝力量不足、已受控怪物、以及非当前玩家击败怪物', () => {
        const lowPowerState = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('hero-1', 'munchkin_warriors_big_hero', '0', 4)],
                monsters: [{ uid: 'monster-1', defId: 'munchkin_monster_treasure_dragon' }],
            })],
        });
        expect(validate(makeMatchState(lowPowerState), {
            type: SU_COMMANDS.DEFEAT_MUNCHKIN_MONSTER,
            playerId: '0',
            payload: { baseIndex: 0, monsterUid: 'monster-1' },
        })).toMatchObject({ valid: false });

        const controlledMonsterState = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('hero-1', 'munchkin_warriors_big_hero', '0', 8)],
                monsters: [{ uid: 'monster-1', defId: 'munchkin_monster_treasure_dragon', controllerId: '1' }],
            })],
        });
        expect(validate(makeMatchState(controlledMonsterState), {
            type: SU_COMMANDS.DEFEAT_MUNCHKIN_MONSTER,
            playerId: '0',
            payload: { baseIndex: 0, monsterUid: 'monster-1' },
        })).toMatchObject({ valid: false, error: '已受控怪物不能被击败' });

        expect(validate(makeMatchState(controlledMonsterState), {
            type: SU_COMMANDS.DEFEAT_MUNCHKIN_MONSTER,
            playerId: '1',
            payload: { baseIndex: 0, monsterUid: 'monster-1' },
        })).toMatchObject({ valid: false, error: 'player_mismatch' });
    });

    it('宝藏牌按图面分为仆从、附着行动和特殊行动，不再整体视为行动卡', () => {
        expect(getCardDef('munchkin_treasure_dwarf_hireling')).toMatchObject({
            id: 'munchkin_treasure_dwarf_hireling',
            type: 'minion',
            power: 2,
        });
        expect(getCardDef('munchkin_treasure_tiger_steed')).toMatchObject({
            id: 'munchkin_treasure_tiger_steed',
            type: 'minion',
            power: 3,
        });
        expect(getCardDef('munchkin_treasure_bag_of_caltrops')).toMatchObject({
            id: 'munchkin_treasure_bag_of_caltrops',
            type: 'action',
            subtype: 'ongoing',
            ongoingTarget: 'base',
            playNeedsBase: true,
        });
        expect(getCardDef('munchkin_treasure_spiky_boots')).toMatchObject({
            id: 'munchkin_treasure_spiky_boots',
            type: 'action',
            subtype: 'ongoing',
            ongoingTarget: 'minion',
            playNeedsMinion: true,
        });
        expect(getCardDef('munchkin_treasure_potion_of_straight_line_running_away')).toMatchObject({
            id: 'munchkin_treasure_potion_of_straight_line_running_away',
            type: 'action',
            subtype: 'special',
            specialTiming: 'afterScoring',
        });
    });

    it('宝藏仆从按普通随从打出到基地，并消耗普通随从额度', () => {
        const state = makeState({ bases: [makeBase({ defId: 'base_the_mines' })] });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('treasure-minion-1', 'munchkin_treasure_dwarf_hireling', 'minion', '0')],
            minionsPlayed: 0,
            minionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'treasure-minion-1', baseIndex: 0 },
        } as const;

        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });
        const result = runCommand(makeMatchState(state), command, fixedRandom);

        expect(result.success).toBe(true);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_PLAYED,
            payload: expect.objectContaining({
                playerId: '0',
                cardUid: 'treasure-minion-1',
                defId: 'munchkin_treasure_dwarf_hireling',
            }),
        }));
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('treasure-minion-1');
        expect(result.finalState.core.bases[0].minions).toContainEqual(
            expect.objectContaining({ uid: 'treasure-minion-1', defId: 'munchkin_treasure_dwarf_hireling', basePower: 2 }),
        );
        expect(result.finalState.core.players['0'].minionsPlayed).toBe(1);
        expect((result.finalState.core.players['0'] as { treasures?: unknown }).treasures).toBeUndefined();
    });

    it('半身人雇佣兵打出时给本回合额外随从额度', () => {
        const state = makeState({ bases: [makeBase({ defId: 'base_the_mines' })] });
        state.players['0'] = {
            ...state.players['0'],
            hand: [
                makeCard('hireling-1', 'munchkin_treasure_halfling_hireling', 'minion', '0'),
                makeCard('invader-1', 'alien_invader', 'minion', '0'),
            ],
            minionsPlayed: 0,
            minionLimit: 1,
        };
        const firstCommand = {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'hireling-1', baseIndex: 0 },
        } as const;

        expect(validate(makeMatchState(state), firstCommand)).toEqual({ valid: true });
        const first = runCommand(makeMatchState(state), firstCommand, fixedRandom);
        const limitEvent = first.events.find((event): event is LimitModifiedEvent => event.type === SU_EVENTS.LIMIT_MODIFIED);

        expect(first.success).toBe(true);
        expect(limitEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'minion',
            delta: 1,
            reason: 'munchkin_treasure_halfling_hireling',
        });
        expect(first.finalState.core.players['0'].minionsPlayed).toBe(1);
        expect(first.finalState.core.players['0'].minionLimit).toBe(2);

        const secondCommand = {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'invader-1', baseIndex: 0 },
        } as const;
        expect(validate(first.finalState, secondCommand)).toEqual({ valid: true });
        const second = runCommand(first.finalState, secondCommand, fixedRandom);

        expect(second.success).toBe(true);
        expect(second.finalState.core.players['0'].minionsPlayed).toBe(2);
        expect(second.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'hireling-1',
            'invader-1',
        ]);
    });

    it('宝藏附着行动按普通行动打到目标随从身上，并消耗普通行动额度', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('host-1', 'munchkin_warriors_big_hero', '0', 5)],
            })],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('treasure-action-1', 'munchkin_treasure_spiky_boots', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'treasure-action-1', targetBaseIndex: 0, targetMinionUid: 'host-1' },
        } as const;

        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });
        const result = runCommand(makeMatchState(state), command, fixedRandom);

        expect(result.success).toBe(true);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('treasure-action-1');
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('treasure-action-1');
        expect(result.finalState.core.bases[0].minions[0].attachedActions).toContainEqual(
            expect.objectContaining({ uid: 'treasure-action-1', defId: 'munchkin_treasure_spiky_boots', ownerId: '0' }),
        );
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect((result.finalState.core.players['0'] as { treasures?: unknown }).treasures).toBeUndefined();
    });

    it('宝藏行动不免费：普通行动额度用完后不能继续打出', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('target-1', 'munchkin_warriors_big_hero', '0', 5)],
            })],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('treasure-action-1', 'munchkin_treasure_potion_of_idiotic_bravery', 'action', '0')],
            actionsPlayed: 1,
            actionLimit: 1,
        };

        expect(validate(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'treasure-action-1', targetBaseIndex: 0, targetMinionUid: 'target-1' },
        })).toMatchObject({ valid: false, error: '本回合行动额度已用完' });
    });

    it('愚蠢勇气药水按普通行动给目标随从本回合 +3 力量', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('target-1', 'munchkin_warriors_big_hero', '0', 5)],
            })],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('potion-1', 'munchkin_treasure_potion_of_idiotic_bravery', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'potion-1', targetBaseIndex: 0, targetMinionUid: 'target-1' },
        } as const;

        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });
        const result = runCommand(makeMatchState(state), command, fixedRandom);
        const powerEvent = result.events.find((event): event is TempPowerAddedEvent => event.type === SU_EVENTS.TEMP_POWER_ADDED);
        const target = result.finalState.core.bases[0].minions.find(minion => minion.uid === 'target-1')!;

        expect(result.success).toBe(true);
        expect(powerEvent?.payload).toMatchObject({
            minionUid: 'target-1',
            baseIndex: 0,
            amount: 3,
            reason: 'munchkin_treasure_potion_of_idiotic_bravery',
        });
        expect(getEffectivePower(result.finalState.core, target, 0)).toBe(8);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toContain('potion-1');
    });

    it('宝藏持续力量牌按牌面修正随从与同基地总力', () => {
        const hero = makeMinion('hero-1', 'munchkin_warriors_big_hero', '0', 5, {
            attachedActions: [
                { uid: 'spiky-boots-1', defId: 'munchkin_treasure_spiky_boots', ownerId: '0' },
                { uid: 'chainsaw-1', defId: 'munchkin_treasure_bloody_dismemberment_chainsaw', ownerId: '0' },
                { uid: 'loads-1', defId: 'munchkin_treasure_loads_of_treasure', ownerId: '0' },
                { uid: 'cowardice-1', defId: 'munchkin_treasure_potion_of_cowardice', ownerId: '1' },
            ],
        });
        const ally = makeMinion('ally-1', 'munchkin_treasure_dwarf_hireling', '0', 2);
        const enemy = makeMinion('enemy-1', 'alien_invader', '1', 3, {
            attachedActions: [
                { uid: 'kneepads-1', defId: 'munchkin_treasure_kneepads_of_allure', ownerId: '1' },
            ],
        });
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [hero, ally, enemy],
            })],
        });

        expect(getEffectivePower(state, hero, 0)).toBe(11);
        expect(getEffectivePower(state, ally, 0)).toBe(3);
        expect(getEffectivePower(state, enemy, 0)).toBe(4);
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '0')).toBe(14);
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '1')).toBe(4);
    });

    it('怯懦药水持续让被附着随从失去能力，但不压制药水自身', () => {
        const hero = makeMinion('hero-1', 'munchkin_warriors_big_hero', '0', 5, {
            attachedActions: [
                { uid: 'cowardice-1', defId: 'munchkin_treasure_potion_of_cowardice', ownerId: '1' },
            ],
        });
        const ally = makeMinion('ally-1', 'munchkin_treasure_dwarf_hireling', '0', 2);
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [hero, ally],
            })],
        });

        expect(isCardSuppressed(state, 'hero-1')).toBe(true);
        expect(isCardSuppressed(state, 'cowardice-1')).toBe(false);
        expect(isCardSuppressed(state, 'ally-1')).toBe(false);
    });

    it('摆动的盾牌持续保护被附着随从不能被摧毁', () => {
        const hero = makeMinion('hero-1', 'munchkin_warriors_big_hero', '0', 5, {
            attachedActions: [
                { uid: 'buckler-1', defId: 'munchkin_treasure_buckler_of_swashing', ownerId: '0' },
            ],
        });
        const ally = makeMinion('ally-1', 'munchkin_treasure_dwarf_hireling', '0', 2);
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [hero, ally],
            })],
        });
        const protectedHero = state.bases[0].minions[0];
        const unprotectedAlly = state.bases[0].minions[1];

        expect(isMinionProtected(state, protectedHero, 0, '0', 'destroy')).toBe(true);
        expect(isMinionProtected(state, protectedHero, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(state, protectedHero, 0, '1', 'move')).toBe(false);
        expect(isMinionProtected(state, unprotectedAlly, 0, '1', 'destroy')).toBe(false);
    });

    it('时间错乱的喷气背包只在宿主随从将进弃牌堆时让它回手牌', () => {
        const host = makeMinion('host-1', 'munchkin_warriors_big_hero', '0', 5, {
            attachedActions: [
                { uid: 'jetpack-1', defId: 'munchkin_treasure_temporal_displacement_jetpack', ownerId: '0' },
            ],
        });
        const other = makeMinion('other-1', 'alien_invader', '1', 3);
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [host, other],
            })],
        });

        const returned = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'host-1',
            triggerMinionDefId: 'munchkin_warriors_big_hero',
            triggerMinion: host,
            sourceCardUid: 'jetpack-1',
            random: fixedRandom,
            now: 100,
        });

        expect(returned.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_RETURNED,
            payload: expect.objectContaining({
                minionUid: 'host-1',
                minionDefId: 'munchkin_warriors_big_hero',
                fromBaseIndex: 0,
                toPlayerId: '0',
                reason: 'munchkin_treasure_temporal_displacement_jetpack',
            }),
        }));

        const unrelated = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'other-1',
            triggerMinionDefId: 'alien_invader',
            triggerMinion: other,
            sourceCardUid: 'jetpack-1',
            random: fixedRandom,
            now: 101,
        });

        expect(unrelated.events).toEqual([]);
    });

    it('一袋铁蒺藜会摧毁打到本基地的力量 3 或更少随从并摧毁自身', () => {
        const lowPowerMinion = makeMinion('low-1', 'alien_invader', '1', 3);
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [lowPowerMinion],
                ongoingActions: [
                    { uid: 'caltrops-1', defId: 'munchkin_treasure_bag_of_caltrops', ownerId: '0' },
                ],
            })],
        });

        const triggered = fireTriggers(state, 'onMinionPlayed', {
            state,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'low-1',
            triggerMinionDefId: 'alien_invader',
            triggerMinion: lowPowerMinion,
            sourceCardUid: 'caltrops-1',
            random: fixedRandom,
            now: 110,
        });

        expect(triggered.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'caltrops-1',
                defId: 'munchkin_treasure_bag_of_caltrops',
                reason: 'munchkin_treasure_bag_of_caltrops',
            }),
        }));
        expect(triggered.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'low-1',
                minionDefId: 'alien_invader',
                fromBaseIndex: 0,
                reason: 'munchkin_treasure_bag_of_caltrops',
            }),
        }));

        const highPowerMinion = makeMinion('high-1', 'munchkin_warriors_big_hero', '1', 4);
        const highPowerState = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [highPowerMinion],
                ongoingActions: [
                    { uid: 'caltrops-2', defId: 'munchkin_treasure_bag_of_caltrops', ownerId: '0' },
                ],
            })],
        });
        const notTriggered = fireTriggers(highPowerState, 'onMinionPlayed', {
            state: highPowerState,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'high-1',
            triggerMinionDefId: 'munchkin_warriors_big_hero',
            triggerMinion: highPowerMinion,
            sourceCardUid: 'caltrops-2',
            random: fixedRandom,
            now: 111,
        });

        expect(notTriggered.events).toEqual([]);
    });
});
