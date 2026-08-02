import { beforeAll, describe, expect, it } from 'vitest';

import {
    getMunchkinSpecialCardDescriptor,
    MUNCHKIN_MONSTER_DECK_DEF_IDS,
} from '../data/factions/munchkin';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getBaseDef, getCardDef } from '../data/cards';
import { validate } from '../domain/commands';
import { scoreOneBase } from '../domain';
import { execute, reduce } from '../domain/reducer';
import {
    getControlledMonsterPowerOnBase,
    getEffectivePower,
    getEffectiveBreakpoint,
    getMonsterPowerOnBase,
    getPlayerEffectivePowerOnBase,
    getTotalEffectivePowerOnBase,
} from '../domain/ongoingModifiers';
import { collectTriggers, fireTriggers, isCardSuppressed, isMinionProtected } from '../domain/ongoingEffects';
import { triggerBaseAbility } from '../domain/baseAbilities';
import { SU_COMMANDS, SU_EVENTS, type BaseReplacedEvent, type CardsDiscardedEvent, type CardsDrawnEvent, type LimitModifiedEvent, type MunchkinTreasureFoundFromDeckEvent, type MunchkinTreasureRecoveredFromDiscardEvent, type MunchkinTreasuresDrawnEvent, type MunchkinTreasuresMilledEvent, type PowerCounterAddedEvent, type SmashUpCore, type TempPowerAddedEvent, type VpAwardedEvent } from '../domain/types';
import {
    getOptionalSimpleChoicePrompt,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makeState,
    respondToPromptOption,
    respondToPromptOptions,
} from './helpers';
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

function attachBeforeScoringWindow(core: SmashUpCore, sourceBaseIndex = 0) {
    const matchState = makeMatchState(core);
    matchState.sys.phase = 'scoreBases';
    matchState.sys.responseWindow = {
        current: {
            windowType: 'meFirst',
            responderQueue: ['0', '1'],
            currentResponderIndex: 0,
            sourceBaseIndex,
            passedPlayers: [],
        },
    } as any;
    return matchState;
}

function attachAfterScoringWindow(core: SmashUpCore, sourceBaseIndex = 0) {
    const matchState = makeMatchState(core);
    matchState.sys.phase = 'scoreBases';
    matchState.sys.responseWindow = {
        current: {
            windowType: 'afterScoring',
            responderQueue: ['0', '1'],
            currentResponderIndex: 0,
            sourceBaseIndex,
            passedPlayers: [],
        },
    } as any;
    return matchState;
}

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
        expect(getCardDef('munchkin_treasure_dungeon_rulebook')).toMatchObject({
            id: 'munchkin_treasure_dungeon_rulebook',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay', 'special'],
            responseWindowTiming: 'beforeScoring',
        });
        expect(getCardDef('munchkin_treasure_potion_of_halitosis')).toMatchObject({
            id: 'munchkin_treasure_potion_of_halitosis',
            type: 'action',
            subtype: 'standard',
            playNeedsBase: true,
            abilityTags: ['onPlay', 'special'],
            responseWindowTiming: 'beforeScoring',
            responseWindowNeedsBase: true,
        });
        expect(getCardDef('munchkin_treasure_potion_of_straight_line_running_away')).toMatchObject({
            id: 'munchkin_treasure_potion_of_straight_line_running_away',
            type: 'action',
            subtype: 'special',
            specialTiming: 'afterScoring',
        });
    });

    it('基地计分后会展示待分发的怪物宝藏奖励，不直接进入玩家手牌', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('scorer-1', 'munchkin_warriors_big_hero', '0', 30)],
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
            nextUid: 1300,
        });

        const result = scoreOneBase(state, 0, [], '0', 10, fixedRandom);
        const revealEvent = result.events.find(event => event.type === SU_EVENTS.MUNCHKIN_TREASURE_REWARD_REVEALED);
        const afterReveal = result.events.reduce((core, event) => reduce(core, event as any), state);

        expect(revealEvent).toMatchObject({
            payload: expect.objectContaining({
                baseIndex: 0,
                baseDefId: 'base_the_mines',
                count: 4,
                eligiblePlayerIds: ['0'],
            }),
        });
        expect(afterReveal.pendingMunchkinTreasureReward?.treasureCards).toEqual([
            { uid: 'munchkin_treasure_1300', defId: 'munchkin_treasure_dwarf_hireling', type: 'minion' },
            { uid: 'munchkin_treasure_1301', defId: 'munchkin_treasure_halfling_hireling', type: 'minion' },
            { uid: 'munchkin_treasure_1302', defId: 'munchkin_treasure_tiger_steed', type: 'minion' },
            { uid: 'munchkin_treasure_1303', defId: 'munchkin_treasure_bag_of_caltrops', type: 'action' },
        ]);
        expect(afterReveal.treasureDeck).toEqual([]);
        expect(afterReveal.players['0'].hand).toEqual([]);
    });

    it('直线跑路药水没有已展示宝藏时不能在计分后响应窗口打出', () => {
        const state = makeState({ bases: [makeBase({ defId: 'base_the_mines' })] });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('straight-line-1', 'munchkin_treasure_potion_of_straight_line_running_away', 'action', '0')],
        };

        expect(validate(attachAfterScoringWindow(state, 0), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'straight-line-1' },
        } as const)).toMatchObject({ valid: false, error: '该行动卡当前没有可执行的响应目标' });
    });

    it('直线跑路药水在计分后从已展示未分发宝藏里选择一张加入手牌', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: ['munchkin_treasure_wishing_ring'],
            pendingMunchkinTreasureReward: {
                baseIndex: 0,
                baseDefId: 'base_the_mines',
                treasureCards: [
                    { uid: 'reward-1', defId: 'munchkin_treasure_dwarf_hireling', type: 'minion' },
                    { uid: 'reward-2', defId: 'munchkin_treasure_bag_of_caltrops', type: 'action' },
                ],
                eligiblePlayerIds: ['0', '1'],
                nextRecipientIndex: 0,
                reason: 'munchkin_test',
            },
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('straight-line-1', 'munchkin_treasure_potion_of_straight_line_running_away', 'action', '0')],
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'straight-line-1' },
        } as const;

        expect(validate(attachAfterScoringWindow(state, 0), command)).toEqual({ valid: true });
        const played = runCommand(attachAfterScoringWindow(state, 0), command, fixedRandom);
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_treasure_potion_of_straight_line_running_away_choose_treasure');
        expect(prompt.targetType).toBe('card');
        expect(prompt.options.map((option: any) => option.value)).toEqual([
            { treasureUid: 'reward-1', treasureDefId: 'munchkin_treasure_dwarf_hireling' },
            { treasureUid: 'reward-2', treasureDefId: 'munchkin_treasure_bag_of_caltrops' },
        ]);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.treasureUid === 'reward-2',
            '直线跑路药水选择宝藏',
            '0',
            fixedRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MUNCHKIN_TREASURE_REWARD_CLAIMED,
            payload: expect.objectContaining({
                playerId: '0',
                treasureUid: 'reward-2',
                reason: 'munchkin_treasure_potion_of_straight_line_running_away',
            }),
        }));
        expect(resolved.finalState.core.players['0'].hand).toContainEqual({
            uid: 'reward-2',
            defId: 'munchkin_treasure_bag_of_caltrops',
            type: 'action',
            owner: '0',
        });
        expect(resolved.finalState.core.pendingMunchkinTreasureReward?.treasureCards).toEqual([
            { uid: 'reward-1', defId: 'munchkin_treasure_dwarf_hireling', type: 'minion' },
        ]);
        expect(resolved.finalState.core.treasureDeck).toEqual(['munchkin_treasure_wishing_ring']);
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

    it('宝藏池在玩家每回合第一次于此打出仆从后抽一张宝藏牌', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_treasure_bath' })],
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            nextUid: 1210,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('invader-1', 'alien_invader', 'minion', '0')],
            minionsPlayed: 0,
            minionLimit: 1,
        };

        const command = {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'invader-1', baseIndex: 0 },
        } as const;

        expect(getBaseDef('base_treasure_bath')).toMatchObject({
            breakpoint: 12,
            vpAwards: [2, 0, 0],
            monsterCount: 1,
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const result = runCommand(makeMatchState(state), command, fixedRandom);
        const drawEvent = result.events.find((event): event is MunchkinTreasuresDrawnEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN
        );

        expect(result.success).toBe(true);
        expect(drawEvent?.payload).toMatchObject({
            playerId: '0',
            count: 1,
            reason: 'base_treasure_bath',
            sourcePlayerId: '0',
            sourceDefId: 'base_treasure_bath',
            sourceBaseIndex: 0,
        });
        expect(result.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1210',
            defId: 'munchkin_treasure_wishing_ring',
            owner: '0',
        }));
        expect(result.finalState.core.treasureDeck).toEqual(['munchkin_treasure_spiky_boots']);
        expect(result.finalState.core.nextUid).toBe(1211);
    });

    it('宝藏池不会在同一玩家本回合第二次于此打出仆从后重复抽宝藏', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_treasure_bath' })],
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            nextUid: 1220,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('invader-2', 'alien_invader', 'minion', '0')],
            minionsPlayed: 1,
            minionLimit: 2,
            minionsPlayedPerBase: { 0: 1 },
        };

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'invader-2', baseIndex: 0 },
        } as const, fixedRandom);

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN)).toBe(false);
        expect(result.finalState.core.players['0'].hand).toEqual([]);
        expect(result.finalState.core.treasureDeck).toEqual([
            'munchkin_treasure_wishing_ring',
            'munchkin_treasure_spiky_boots',
        ]);
        expect(result.finalState.core.nextUid).toBe(1220);
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

    it('许愿指环按普通行动获得 1VP，并把自身放回公共宝藏牌库底', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: ['munchkin_treasure_dwarf_hireling'],
        });
        state.players['0'] = {
            ...state.players['0'],
            vp: 2,
            hand: [makeCard('wishing-ring-1', 'munchkin_treasure_wishing_ring', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'wishing-ring-1' },
        } as const;

        expect(getCardDef('munchkin_treasure_wishing_ring')).toMatchObject({
            id: 'munchkin_treasure_wishing_ring',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const result = runCommand(makeMatchState(state), command, fixedRandom);
        const vpEvent = result.events.find((event): event is VpAwardedEvent => event.type === SU_EVENTS.VP_AWARDED);

        expect(result.success).toBe(true);
        expect(vpEvent?.payload).toMatchObject({
            playerId: '0',
            amount: 1,
            reason: 'munchkin_treasure_wishing_ring',
        });
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MUNCHKIN_TREASURE_TO_DECK_BOTTOM,
            payload: expect.objectContaining({
                cardUid: 'wishing-ring-1',
                defId: 'munchkin_treasure_wishing_ring',
                ownerId: '0',
                reason: 'munchkin_treasure_wishing_ring',
            }),
        }));
        expect(result.finalState.core.players['0'].vp).toBe(3);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('wishing-ring-1');
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('wishing-ring-1');
        expect(result.finalState.core.treasureDeck).toEqual([
            'munchkin_treasure_dwarf_hireling',
            'munchkin_treasure_wishing_ring',
        ]);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('探宝棒抽两张宝藏，并把自身和隐藏宝藏弃牌堆重洗回公共宝藏牌库', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_halfling_hireling',
                'munchkin_treasure_tiger_steed',
            ],
            treasureDiscard: [
                'munchkin_treasure_magic_missile',
                'munchkin_treasure_wishing_ring',
            ],
            nextUid: 1200,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('finder-1', 'munchkin_treasure_treasure_finder', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'finder-1' },
        } as const;

        expect(getCardDef('munchkin_treasure_treasure_finder')).toMatchObject({
            id: 'munchkin_treasure_treasure_finder',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const result = runCommand(makeMatchState(state), command, fixedRandom);

        expect(result.success).toBe(true);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MUNCHKIN_TREASURES_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 2,
                reason: 'munchkin_treasure_treasure_finder',
            }),
        }));
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MUNCHKIN_TREASURE_DECK_SHUFFLED,
            payload: expect.objectContaining({
                cardUid: 'finder-1',
                defId: 'munchkin_treasure_treasure_finder',
                ownerId: '0',
                reason: 'munchkin_treasure_treasure_finder',
            }),
        }));
        expect(result.finalState.core.players['0'].hand.map(card => card.defId)).toEqual([
            'munchkin_treasure_dwarf_hireling',
            'munchkin_treasure_halfling_hireling',
        ]);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'munchkin_treasure_1200',
            'munchkin_treasure_1201',
        ]);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('finder-1');
        expect(result.finalState.core.treasureDiscard).toEqual([]);
        expect(result.finalState.core.treasureDeck).toEqual([
            'munchkin_treasure_tiger_steed',
            'munchkin_treasure_treasure_finder',
            'munchkin_treasure_magic_missile',
            'munchkin_treasure_wishing_ring',
        ]);
        expect(result.finalState.core.nextUid).toBe(1202);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('隐藏资产将公共宝藏牌库顶三张放入宝藏弃牌，抽一张普通牌并授予额外行动', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_halfling_hireling',
                'munchkin_treasure_tiger_steed',
                'munchkin_treasure_bag_of_caltrops',
            ],
            treasureDiscard: ['munchkin_treasure_wishing_ring'],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('hidden-assets-1', 'munchkin_dwarves_hidden_assets', 'action', '0')],
            deck: [makeCard('drawn-1', 'alien_invader', 'minion', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hidden-assets-1' },
        } as const;

        expect(getCardDef('munchkin_dwarves_hidden_assets')).toMatchObject({
            id: 'munchkin_dwarves_hidden_assets',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const result = runCommand(makeMatchState(state), command, fixedRandom);
        const millEvent = result.events.find((event): event is MunchkinTreasuresMilledEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURES_MILLED
        );
        const drawEvent = result.events.find((event): event is CardsDrawnEvent =>
            event.type === SU_EVENTS.CARDS_DRAWN
        );
        const limitEvent = result.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.limitType === 'action'
            && event.payload.reason === 'munchkin_dwarves_hidden_assets'
        );

        expect(result.success).toBe(true);
        expect(millEvent?.payload).toMatchObject({
            count: 3,
            reason: 'munchkin_dwarves_hidden_assets',
            sourceCardUid: 'hidden-assets-1',
            sourceDefId: 'munchkin_dwarves_hidden_assets',
        });
        expect(drawEvent?.payload).toMatchObject({
            playerId: '0',
            count: 1,
            cardUids: ['drawn-1'],
        });
        expect(limitEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            delta: 1,
            reason: 'munchkin_dwarves_hidden_assets',
        });
        expect(result.finalState.core.treasureDeck).toEqual(['munchkin_treasure_bag_of_caltrops']);
        expect(result.finalState.core.treasureDiscard).toEqual([
            'munchkin_treasure_wishing_ring',
            'munchkin_treasure_dwarf_hireling',
            'munchkin_treasure_halfling_hireling',
            'munchkin_treasure_tiger_steed',
        ]);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toContain('drawn-1');
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('drawn-1');
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toContain('hidden-assets-1');
        expect(result.finalState.core.players['0'].actionLimit).toBe(2);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('黄金挖掘者天赋从公共宝藏弃牌堆选择一张宝藏放入手牌', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [makeMinion('gold-digger-1', 'munchkin_dwarves_gold_digger', '0', 3)],
                }),
            ],
            treasureDiscard: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            nextUid: 1500,
        });
        const command = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'gold-digger-1', baseIndex: 0 },
        } as const;

        expect(getCardDef('munchkin_dwarves_gold_digger')).toMatchObject({
            id: 'munchkin_dwarves_gold_digger',
            type: 'minion',
            abilityTags: ['talent'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const talent = runCommand(makeMatchState(state), command, fixedRandom);
        expect(talent.success).toBe(true);

        const prompt = getSimpleChoicePrompt(talent.finalState, 'munchkin_dwarves_gold_digger_choose_treasure');
        expect(prompt.targetType).toBe('card');
        expect(prompt.options.map((option: any) => option.value?.treasureDefId)).toEqual([
            'munchkin_treasure_wishing_ring',
            'munchkin_treasure_spiky_boots',
        ]);

        const resolved = respondToPromptOption(
            talent.finalState,
            option => option.value?.treasureDefId === 'munchkin_treasure_spiky_boots',
            '黄金挖掘者目标宝藏弃牌',
            '0',
            fixedRandom,
        );
        const recoveredEvent = resolved.events.find((event): event is MunchkinTreasureRecoveredFromDiscardEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURE_RECOVERED_FROM_DISCARD
        );

        expect(resolved.success).toBe(true);
        expect(recoveredEvent?.payload).toMatchObject({
            playerId: '0',
            defId: 'munchkin_treasure_spiky_boots',
            reason: 'munchkin_dwarves_gold_digger',
            sourceCardUid: 'gold-digger-1',
            sourceDefId: 'munchkin_dwarves_gold_digger',
        });
        expect(resolved.finalState.core.treasureDiscard).toEqual(['munchkin_treasure_wishing_ring']);
        expect(resolved.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1500',
            defId: 'munchkin_treasure_spiky_boots',
            type: 'action',
            owner: '0',
        }));
        expect(resolved.finalState.core.nextUid).toBe(1501);
        expect(resolved.finalState.core.bases[0].minions[0].talentUsed).toBe(true);
    });

    it('黄金挖掘者没有公共宝藏弃牌时不能发动天赋且不消耗次数', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [makeMinion('gold-digger-1', 'munchkin_dwarves_gold_digger', '0', 3)],
                }),
            ],
            treasureDiscard: [],
        });
        const command = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'gold-digger-1', baseIndex: 0 },
        } as const;

        expect(validate(makeMatchState(state), command)).toEqual({
            valid: false,
            error: '当前没有可选择的宝藏牌',
        });
        const result = runCommand(makeMatchState(state), command, fixedRandom);

        expect(result.success).toBe(false);
        expect(result.error).toContain('当前没有可选择的宝藏牌');
        expect(result.events.some(event => event.type === SU_EVENTS.TALENT_USED)).toBe(false);
        expect(result.finalState.core.bases[0].minions[0].talentUsed).toBe(false);
    });

    it('为了钱什么都可以可弃任意数量手牌并按数量抽宝藏', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            nextUid: 1630,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [
                makeCard('money-1', 'munchkin_dwarves_anything_for_money', 'action', '0'),
                makeCard('discard-a', 'munchkin_dwarves_cash_out', 'action', '0'),
                makeCard('discard-b', 'munchkin_dwarves_gem_grabber', 'minion', '0'),
            ],
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'money-1' },
        } as const;

        expect(getCardDef('munchkin_dwarves_anything_for_money')).toMatchObject({
            id: 'munchkin_dwarves_anything_for_money',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const played = runCommand(makeMatchState(state), command, fixedRandom);
        expect(played.success).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toBe(false);
        expect(played.events.some(event => event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN)).toBe(false);

        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_dwarves_anything_for_money_discard');
        expect(prompt.targetType).toBe('hand');
        expect(prompt.multi).toEqual({ min: 0, max: 2 });
        expect(prompt.options.map((option: any) => option.value)).toEqual([
            { cardUid: 'discard-a', defId: 'munchkin_dwarves_cash_out' },
            { cardUid: 'discard-b', defId: 'munchkin_dwarves_gem_grabber' },
        ]);

        const selectedOptionIds = prompt.options.map((option: any) => option.id);
        const resolved = respondToPromptOptions(
            played.finalState,
            selectedOptionIds,
            '0',
            fixedRandom,
        );
        const discardEvent = resolved.events.find((event): event is CardsDiscardedEvent =>
            event.type === SU_EVENTS.CARDS_DISCARDED
        );
        const drawEvent = resolved.events.find((event): event is MunchkinTreasuresDrawnEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN
        );

        expect(resolved.success).toBe(true);
        expect(discardEvent?.payload).toEqual({
            playerId: '0',
            cardUids: ['discard-a', 'discard-b'],
        });
        expect(drawEvent?.payload).toMatchObject({
            playerId: '0',
            count: 2,
            reason: 'munchkin_dwarves_anything_for_money',
            sourceCardUid: 'money-1',
            sourceDefId: 'munchkin_dwarves_anything_for_money',
        });
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([
            'money-1',
            'discard-a',
            'discard-b',
        ]);
        expect(resolved.finalState.core.players['0'].hand).toEqual([
            expect.objectContaining({
                uid: 'munchkin_treasure_1630',
                defId: 'munchkin_treasure_dwarf_hireling',
                owner: '0',
            }),
            expect.objectContaining({
                uid: 'munchkin_treasure_1631',
                defId: 'munchkin_treasure_wishing_ring',
                owner: '0',
            }),
        ]);
        expect(resolved.finalState.core.treasureDeck).toEqual(['munchkin_treasure_spiky_boots']);
        expect(resolved.finalState.core.nextUid).toBe(1632);
    });

    it('为了钱什么都可以允许空选且不会弃牌或抽宝藏', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: ['munchkin_treasure_dwarf_hireling'],
            nextUid: 1640,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [
                makeCard('money-1', 'munchkin_dwarves_anything_for_money', 'action', '0'),
                makeCard('keep-a', 'munchkin_dwarves_cash_out', 'action', '0'),
            ],
        };

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'money-1' },
        } as const, fixedRandom);
        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_dwarves_anything_for_money_discard');
        expect(prompt.multi).toEqual({ min: 0, max: 1 });

        const resolved = respondToPromptOptions(played.finalState, [], '0', fixedRandom);

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toBe(false);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN)).toBe(false);
        expect(resolved.finalState.core.players['0'].hand).toEqual([
            expect.objectContaining({ uid: 'keep-a', defId: 'munchkin_dwarves_cash_out' }),
        ]);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['money-1']);
        expect(resolved.finalState.core.treasureDeck).toEqual(['munchkin_treasure_dwarf_hireling']);
        expect(resolved.finalState.core.nextUid).toBe(1640);
    });

    it('套现可选择至多三张宝藏随从作为立即额外牌打出', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [
                makeCard('cash-out-1', 'munchkin_dwarves_cash_out', 'action', '0'),
                makeCard('treasure-minion-a', 'munchkin_treasure_dwarf_hireling', 'minion', '0'),
                makeCard('treasure-minion-b', 'munchkin_treasure_tiger_steed', 'minion', '0'),
                makeCard('non-treasure', 'munchkin_dwarves_gem_grabber', 'minion', '0'),
            ],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 1,
            minionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'cash-out-1' },
        } as const;

        expect(getCardDef('munchkin_dwarves_cash_out')).toMatchObject({
            id: 'munchkin_dwarves_cash_out',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const played = runCommand(makeMatchState(state), command, fixedRandom);
        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_dwarves_cash_out_choose_treasures');
        expect(prompt.targetType).toBe('hand');
        expect(prompt.multi).toEqual({ min: 0, max: 2 });
        expect(prompt.options.map((option: any) => option.value)).toEqual([
            { cardUid: 'treasure-minion-a', defId: 'munchkin_treasure_dwarf_hireling' },
            { cardUid: 'treasure-minion-b', defId: 'munchkin_treasure_tiger_steed' },
        ]);

        const choseTreasures = respondToPromptOptions(
            played.finalState,
            prompt.options.map((option: any) => option.id),
            '0',
            fixedRandom,
        );
        const limitEvents = choseTreasures.events.filter((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.reason === 'munchkin_dwarves_cash_out'
        );

        expect(choseTreasures.success).toBe(true);
        expect(limitEvents).toHaveLength(2);
        expect(limitEvents.map(event => event.payload)).toEqual([
            expect.objectContaining({
                playerId: '0',
                limitType: 'minion',
                playTiming: 'immediate',
                specificCardUid: 'treasure-minion-a',
            }),
            expect.objectContaining({
                playerId: '0',
                limitType: 'minion',
                playTiming: 'immediate',
                specificCardUid: 'treasure-minion-b',
            }),
        ]);

        const firstPrompt = getSimpleChoicePrompt(choseTreasures.finalState, 'smashup_immediate_extra_minion');
        const playedFirst = respondToPromptOption(
            choseTreasures.finalState,
            option => option.value?.cardUid === 'treasure-minion-a',
            '套现第一张宝藏随从',
            '0',
            fixedRandom,
        );
        const secondPrompt = getSimpleChoicePrompt(playedFirst.finalState, 'smashup_immediate_extra_minion');
        const playedSecond = respondToPromptOption(
            playedFirst.finalState,
            option => option.value?.cardUid === 'treasure-minion-b',
            '套现第二张宝藏随从',
            '0',
            fixedRandom,
        );

        expect(firstPrompt.options.map((option: any) => option.value?.cardUid)).toContain('treasure-minion-a');
        expect(secondPrompt.options.map((option: any) => option.value?.cardUid)).toContain('treasure-minion-b');
        expect(playedSecond.success).toBe(true);
        expect(playedSecond.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'treasure-minion-a',
            'treasure-minion-b',
        ]);
        expect(playedSecond.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['non-treasure']);
        expect(playedSecond.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['cash-out-1']);
        expect(getOptionalSimpleChoicePrompt(playedSecond.finalState, 'smashup_immediate_extra_minion')).toBeUndefined();
    });

    it('套现可选择宝藏行动作为立即额外牌打出', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: ['munchkin_treasure_dwarf_hireling'],
        });
        state.players['0'] = {
            ...state.players['0'],
            vp: 2,
            hand: [
                makeCard('cash-out-1', 'munchkin_dwarves_cash_out', 'action', '0'),
                makeCard('wishing-ring-1', 'munchkin_treasure_wishing_ring', 'action', '0'),
            ],
            actionsPlayed: 0,
            actionLimit: 1,
        };

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'cash-out-1' },
        } as const, fixedRandom);
        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_dwarves_cash_out_choose_treasures');
        const choseTreasure = respondToPromptOptions(
            played.finalState,
            prompt.options
                .filter((option: any) => option.value?.cardUid === 'wishing-ring-1')
                .map((option: any) => option.id),
            '0',
            fixedRandom,
        );
        const limitEvent = choseTreasure.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.reason === 'munchkin_dwarves_cash_out'
        );
        const extraPrompt = getSimpleChoicePrompt(choseTreasure.finalState, 'smashup_immediate_extra_action');
        const playedRing = respondToPromptOption(
            choseTreasure.finalState,
            option => option.value?.cardUid === 'wishing-ring-1',
            '套现打出许愿指环',
            '0',
            fixedRandom,
        );

        expect(limitEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            playTiming: 'immediate',
            restrictToCardUid: 'wishing-ring-1',
        });
        expect(extraPrompt.options.map((option: any) => option.value?.cardUid)).toContain('wishing-ring-1');
        expect(playedRing.success).toBe(true);
        expect(playedRing.finalState.core.players['0'].vp).toBe(3);
        expect(playedRing.finalState.core.players['0'].hand).toEqual([]);
        expect(playedRing.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['cash-out-1']);
        expect(playedRing.finalState.core.treasureDeck).toEqual([
            'munchkin_treasure_dwarf_hireling',
            'munchkin_treasure_wishing_ring',
        ]);
        expect(getOptionalSimpleChoicePrompt(playedRing.finalState, 'smashup_immediate_extra_action')).toBeUndefined();
    });

    it('套现允许空选且不会生成立即额外打牌窗口', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [
                makeCard('cash-out-1', 'munchkin_dwarves_cash_out', 'action', '0'),
                makeCard('treasure-minion-a', 'munchkin_treasure_dwarf_hireling', 'minion', '0'),
            ],
            actionsPlayed: 0,
            actionLimit: 1,
        };

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'cash-out-1' },
        } as const, fixedRandom);
        const skipped = respondToPromptOptions(played.finalState, [], '0', fixedRandom);

        expect(skipped.success).toBe(true);
        expect(skipped.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.reason === 'munchkin_dwarves_cash_out'
        )).toBe(false);
        expect(getOptionalSimpleChoicePrompt(skipped.finalState, 'smashup_immediate_extra_minion')).toBeUndefined();
        expect(getOptionalSimpleChoicePrompt(skipped.finalState, 'smashup_immediate_extra_action')).toBeUndefined();
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['treasure-minion-a']);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['cash-out-1']);
    });

    it('狡猾计划可在计分前打出，抽到宝藏行动后可立即打出它', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('scorer-1', 'munchkin_dwarves_loot_lover', '0', 20)],
            })],
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_dwarf_hireling',
            ],
            nextUid: 1650,
        });
        state.players['0'] = {
            ...state.players['0'],
            vp: 2,
            hand: [makeCard('cunning-1', 'munchkin_dwarves_cunning_plan', 'action', '0')],
            actionsPlayed: 1,
            actionLimit: 1,
        };
        const matchState = attachBeforeScoringWindow(state, 0);
        const command = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { handCardUid: 'cunning-1', baseIndex: 0 },
        } as const;

        expect(getCardDef('munchkin_dwarves_cunning_plan')).toMatchObject({
            id: 'munchkin_dwarves_cunning_plan',
            type: 'action',
            subtype: 'special',
            abilityTags: ['special'],
            specialTiming: 'beforeScoring',
        });
        expect(validate(matchState, command)).toEqual({ valid: true });

        const activated = runCommand(matchState, command, fixedRandom);
        const drawEvent = activated.events.find((event): event is MunchkinTreasuresDrawnEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN
        );
        const extraEvent = activated.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.reason === 'munchkin_dwarves_cunning_plan'
        );

        expect(activated.success).toBe(true);
        expect(activated.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: expect.objectContaining({
                playerId: '0',
                cardUid: 'cunning-1',
                defId: 'munchkin_dwarves_cunning_plan',
            }),
        }));
        expect(drawEvent?.payload).toMatchObject({
            playerId: '0',
            count: 1,
            treasureUids: ['munchkin_treasure_1650'],
            reason: 'munchkin_dwarves_cunning_plan',
            sourceCardUid: 'cunning-1',
        });
        expect(extraEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            playTiming: 'immediate',
            restrictToCardUid: 'munchkin_treasure_1650',
        });
        expect(activated.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['cunning-1']);
        expect(activated.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1650',
            defId: 'munchkin_treasure_wishing_ring',
        }));

        const prompt = getSimpleChoicePrompt(activated.finalState, 'smashup_immediate_extra_action');
        expect(prompt.options.map((option: any) => option.value?.cardUid)).toContain('munchkin_treasure_1650');

        const playedTreasure = respondToPromptOption(
            activated.finalState,
            option => option.value?.cardUid === 'munchkin_treasure_1650',
            '狡猾计划打出刚抽到的许愿指环',
            '0',
            fixedRandom,
        );

        expect(playedTreasure.success).toBe(true);
        expect(playedTreasure.finalState.core.players['0'].vp).toBe(3);
        expect(playedTreasure.finalState.core.players['0'].hand).toEqual([]);
        expect(playedTreasure.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['cunning-1']);
        expect(playedTreasure.finalState.core.treasureDeck).toEqual([
            'munchkin_treasure_dwarf_hireling',
            'munchkin_treasure_wishing_ring',
        ]);
        expect(getOptionalSimpleChoicePrompt(playedTreasure.finalState, 'smashup_immediate_extra_action')).toBeUndefined();
    });

    it('狡猾计划抽到宝藏随从后可立即打到基地', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('scorer-1', 'munchkin_dwarves_loot_lover', '0', 20)],
            })],
            treasureDeck: ['munchkin_treasure_dwarf_hireling'],
            nextUid: 1660,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('cunning-1', 'munchkin_dwarves_cunning_plan', 'action', '0')],
            minionsPlayed: 1,
            minionLimit: 1,
        };

        const activated = runCommand(attachBeforeScoringWindow(state, 0), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { handCardUid: 'cunning-1', baseIndex: 0 },
        } as const, fixedRandom);
        const extraEvent = activated.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.reason === 'munchkin_dwarves_cunning_plan'
        );

        expect(activated.success).toBe(true);
        expect(extraEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'minion',
            playTiming: 'immediate',
            specificCardUid: 'munchkin_treasure_1660',
        });

        const prompt = getSimpleChoicePrompt(activated.finalState, 'smashup_immediate_extra_minion');
        expect(prompt.options.map((option: any) => option.value?.cardUid)).toContain('munchkin_treasure_1660');

        const playedTreasure = respondToPromptOption(
            activated.finalState,
            option => option.value?.cardUid === 'munchkin_treasure_1660',
            '狡猾计划打出刚抽到的矮人雇佣兵',
            '0',
            fixedRandom,
        );

        expect(playedTreasure.success).toBe(true);
        expect(playedTreasure.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('munchkin_treasure_1660');
        expect(playedTreasure.finalState.core.players['0'].hand).toEqual([]);
        expect(playedTreasure.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['cunning-1']);
        expect(getOptionalSimpleChoicePrompt(playedTreasure.finalState, 'smashup_immediate_extra_minion')).toBeUndefined();
    });

    it('狡猾计划允许抽到宝藏后跳过不打出', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('scorer-1', 'munchkin_dwarves_loot_lover', '0', 20)],
            })],
            treasureDeck: ['munchkin_treasure_dwarf_hireling'],
            nextUid: 1670,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('cunning-1', 'munchkin_dwarves_cunning_plan', 'action', '0')],
            minionsPlayed: 1,
            minionLimit: 1,
        };

        const activated = runCommand(attachBeforeScoringWindow(state, 0), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { handCardUid: 'cunning-1', baseIndex: 0 },
        } as const, fixedRandom);
        const skipped = respondToPromptOption(
            activated.finalState,
            option => option.value?.skip === true,
            '狡猾计划放弃刚抽到的宝藏随从',
            '0',
            fixedRandom,
        );

        expect(skipped.success).toBe(true);
        expect(skipped.finalState.core.players['0'].hand).toEqual([
            expect.objectContaining({
                uid: 'munchkin_treasure_1670',
                defId: 'munchkin_treasure_dwarf_hireling',
            }),
        ]);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['cunning-1']);
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['scorer-1']);
        expect(getOptionalSimpleChoicePrompt(skipped.finalState, 'smashup_immediate_extra_minion')).toBeUndefined();
    });

    it('我的！搜索可附着宝藏并作为立即额外行动打到己方仆从身上', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('host-1', 'munchkin_dwarves_loot_lover', '0', 4),
                        makeMinion('opponent-1', 'pirate_buccaneer', '1', 4),
                    ],
                }),
                makeBase({
                    defId: 'base_treasure_bath',
                    minions: [makeMinion('host-2', 'alien_invader', '0', 3)],
                }),
            ],
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
                'munchkin_treasure_potion_of_idiotic_bravery',
                'munchkin_treasure_magic_missile',
            ],
            nextUid: 1680,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('mine-1', 'munchkin_dwarves_mine', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mine-1' },
        } as const;

        expect(getCardDef('munchkin_dwarves_mine')).toMatchObject({
            id: 'munchkin_dwarves_mine',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const played = runCommand(makeMatchState(state), command, fixedRandom);
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_dwarves_mine_choose_treasure');
        const optionValues = prompt.options.map((option: any) => option.value);
        expect(prompt.targetType).toBe('generic');
        expect(optionValues).toContainEqual({
            treasureDefId: 'munchkin_treasure_spiky_boots',
            deckIndex: 1,
            targetBaseIndex: 0,
            targetMinionUid: 'host-1',
            targetMinionDefId: 'munchkin_dwarves_loot_lover',
        });
        expect(optionValues).toContainEqual({
            treasureDefId: 'munchkin_treasure_magic_missile',
            deckIndex: 3,
            targetBaseIndex: 1,
            targetMinionUid: 'host-2',
            targetMinionDefId: 'alien_invader',
        });
        expect(optionValues).not.toContainEqual(expect.objectContaining({ treasureDefId: 'munchkin_treasure_wishing_ring' }));
        expect(optionValues).not.toContainEqual(expect.objectContaining({ treasureDefId: 'munchkin_treasure_potion_of_idiotic_bravery' }));
        expect(optionValues).not.toContainEqual(expect.objectContaining({ targetMinionUid: 'opponent-1' }));

        const choseTreasure = respondToPromptOption(
            played.finalState,
            option => option.value?.treasureDefId === 'munchkin_treasure_spiky_boots'
                && option.value?.targetMinionUid === 'host-1',
            '我的！选择尖刺靴给己方宿主',
            '0',
            fixedRandom,
        );
        const foundEvent = choseTreasure.events.find((event): event is MunchkinTreasureFoundFromDeckEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURE_FOUND_FROM_DECK
        );
        const limitEvent = choseTreasure.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.reason === 'munchkin_dwarves_mine'
        );

        expect(choseTreasure.success).toBe(true);
        expect(foundEvent?.payload).toMatchObject({
            playerId: '0',
            defId: 'munchkin_treasure_spiky_boots',
            deckIndex: 1,
            treasureUid: 'munchkin_treasure_1680',
            shuffledDeckDefIds: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_potion_of_idiotic_bravery',
                'munchkin_treasure_magic_missile',
            ],
            reason: 'munchkin_dwarves_mine',
            sourceCardUid: 'mine-1',
        });
        expect(limitEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            playTiming: 'immediate',
            restrictToCardUid: 'munchkin_treasure_1680',
            restrictToMinionUid: 'host-1',
        });
        expect(choseTreasure.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1680',
            defId: 'munchkin_treasure_spiky_boots',
            owner: '0',
        }));
        expect(choseTreasure.finalState.core.treasureDeck).toEqual([
            'munchkin_treasure_wishing_ring',
            'munchkin_treasure_potion_of_idiotic_bravery',
            'munchkin_treasure_magic_missile',
        ]);

        const extraPrompt = getSimpleChoicePrompt(choseTreasure.finalState, 'smashup_immediate_extra_action');
        expect(extraPrompt.options.map((option: any) => option.value?.cardUid)).toContain('munchkin_treasure_1680');

        const attached = respondToPromptOption(
            choseTreasure.finalState,
            option => option.value?.cardUid === 'munchkin_treasure_1680',
            '我的！打出尖刺靴到己方宿主',
            '0',
            fixedRandom,
        );

        expect(attached.success).toBe(true);
        expect(attached.finalState.core.bases[0].minions[0].attachedActions).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1680',
            defId: 'munchkin_treasure_spiky_boots',
            ownerId: '0',
        }));
        expect(attached.finalState.core.bases[0].minions[1].attachedActions).toEqual([]);
        expect(attached.finalState.core.bases[1].minions[0].attachedActions).toEqual([]);
        expect(attached.finalState.core.players['0'].hand).toEqual([]);
        expect(attached.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['mine-1']);
        expect(attached.finalState.core.treasureDeck).toEqual([
            'munchkin_treasure_wishing_ring',
            'munchkin_treasure_potion_of_idiotic_bravery',
            'munchkin_treasure_magic_missile',
        ]);
        expect(getOptionalSimpleChoicePrompt(attached.finalState, 'smashup_immediate_extra_action')).toBeUndefined();
    });

    it('我的！没有可附着宝藏或己方仆从时不会检索宝藏牌库', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('opponent-1', 'pirate_buccaneer', '1', 4)],
            })],
            treasureDeck: [
                'munchkin_treasure_spiky_boots',
                'munchkin_treasure_magic_missile',
            ],
            nextUid: 1690,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('mine-1', 'munchkin_dwarves_mine', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mine-1' },
        } as const, fixedRandom);

        expect(played.success).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.MUNCHKIN_TREASURE_FOUND_FROM_DECK)).toBe(false);
        expect(getOptionalSimpleChoicePrompt(played.finalState, 'munchkin_dwarves_mine_choose_treasure')).toBeUndefined();
        expect(played.finalState.core.players['0'].hand).toEqual([]);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['mine-1']);
        expect(played.finalState.core.treasureDeck).toEqual([
            'munchkin_treasure_spiky_boots',
            'munchkin_treasure_magic_missile',
        ]);
        expect(played.finalState.core.nextUid).toBe(1690);
    });

    it('打捞计分前从公共宝藏弃牌打出可附着宝藏到当前基地己方仆从', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('host-1', 'munchkin_dwarves_loot_lover', '0', 4),
                        makeMinion('opponent-1', 'pirate_buccaneer', '1', 4),
                    ],
                }),
                makeBase({
                    defId: 'base_treasure_bath',
                    minions: [makeMinion('away-host', 'alien_invader', '0', 3)],
                }),
            ],
            treasureDiscard: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
                'munchkin_treasure_magic_missile',
            ],
            nextUid: 1700,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('salvage-1', 'munchkin_dwarves_salvage', 'action', '0')],
            actionsPlayed: 1,
            actionLimit: 1,
        };
        const matchState = attachBeforeScoringWindow(state, 0);
        const command = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { handCardUid: 'salvage-1', baseIndex: 0 },
        } as const;

        expect(getCardDef('munchkin_dwarves_salvage')).toMatchObject({
            id: 'munchkin_dwarves_salvage',
            type: 'action',
            subtype: 'special',
            abilityTags: ['special'],
            specialTiming: 'beforeScoring',
        });
        expect(validate(matchState, command)).toEqual({ valid: true });

        const activated = runCommand(matchState, command, fixedRandom);
        expect(activated.success).toBe(true);
        expect(activated.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: expect.objectContaining({
                playerId: '0',
                cardUid: 'salvage-1',
                defId: 'munchkin_dwarves_salvage',
                targetBaseIndex: 0,
            }),
        }));

        const prompt = getSimpleChoicePrompt(activated.finalState, 'munchkin_dwarves_salvage_choose_treasure');
        const optionValues = prompt.options.map((option: any) => option.value);
        expect(prompt.targetType).toBe('generic');
        expect(activated.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(activated.finalState.core.players['0'].actionLimit).toBe(1);
        expect(optionValues).toContainEqual({
            treasureDefId: 'munchkin_treasure_spiky_boots',
            discardIndex: 1,
            targetBaseIndex: 0,
            targetMinionUid: 'host-1',
            targetMinionDefId: 'munchkin_dwarves_loot_lover',
        });
        expect(optionValues).toContainEqual({
            treasureDefId: 'munchkin_treasure_magic_missile',
            discardIndex: 2,
            targetBaseIndex: 0,
            targetMinionUid: 'host-1',
            targetMinionDefId: 'munchkin_dwarves_loot_lover',
        });
        expect(optionValues).not.toContainEqual(expect.objectContaining({ treasureDefId: 'munchkin_treasure_wishing_ring' }));
        expect(optionValues).not.toContainEqual(expect.objectContaining({ targetMinionUid: 'opponent-1' }));
        expect(optionValues).not.toContainEqual(expect.objectContaining({ targetMinionUid: 'away-host' }));

        const choseTreasure = respondToPromptOption(
            activated.finalState,
            option => option.value?.treasureDefId === 'munchkin_treasure_spiky_boots'
                && option.value?.targetMinionUid === 'host-1',
            '打捞选择尖刺靴给当前基地己方宿主',
            '0',
            fixedRandom,
        );
        const recoveredEvent = choseTreasure.events.find((event): event is MunchkinTreasureRecoveredFromDiscardEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURE_RECOVERED_FROM_DISCARD
        );
        const limitEvent = choseTreasure.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.reason === 'munchkin_dwarves_salvage'
        );

        expect(choseTreasure.success).toBe(true);
        expect(recoveredEvent?.payload).toMatchObject({
            playerId: '0',
            defId: 'munchkin_treasure_spiky_boots',
            treasureUid: 'munchkin_treasure_1700',
            reason: 'munchkin_dwarves_salvage',
            sourceCardUid: 'salvage-1',
            sourceBaseIndex: 0,
        });
        expect(limitEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            playTiming: 'immediate',
            restrictToBase: 0,
            restrictToCardUid: 'munchkin_treasure_1700',
            restrictToMinionUid: 'host-1',
        });
        expect(choseTreasure.finalState.core.treasureDiscard).toEqual([
            'munchkin_treasure_wishing_ring',
            'munchkin_treasure_magic_missile',
        ]);
        expect(choseTreasure.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1700',
            defId: 'munchkin_treasure_spiky_boots',
            owner: '0',
        }));
        expect(choseTreasure.finalState.core.players['0'].discard.map(card => card.uid)).toContain('salvage-1');
        expect(choseTreasure.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(choseTreasure.finalState.core.players['0'].actionLimit).toBe(1);

        const extraPrompt = getSimpleChoicePrompt(choseTreasure.finalState, 'smashup_immediate_extra_action');
        expect(extraPrompt.options.map((option: any) => option.value?.cardUid)).toContain('munchkin_treasure_1700');

        const attached = respondToPromptOption(
            choseTreasure.finalState,
            option => option.value?.cardUid === 'munchkin_treasure_1700',
            '打捞打出尖刺靴到当前基地己方宿主',
            '0',
            fixedRandom,
        );

        expect(attached.success).toBe(true);
        expect(attached.finalState.core.bases[0].minions[0].attachedActions).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1700',
            defId: 'munchkin_treasure_spiky_boots',
            ownerId: '0',
        }));
        expect(attached.finalState.core.bases[0].minions[1].attachedActions).toEqual([]);
        expect(attached.finalState.core.bases[1].minions[0].attachedActions).toEqual([]);
        expect(attached.finalState.core.players['0'].hand).toEqual([]);
        expect(getOptionalSimpleChoicePrompt(attached.finalState, 'smashup_immediate_extra_action')).toBeUndefined();
    });

    it('打捞没有可附着宝藏或当前基地己方仆从时不能发动', () => {
        const noHostState = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('opponent-1', 'pirate_buccaneer', '1', 4)],
            })],
            treasureDiscard: ['munchkin_treasure_spiky_boots'],
        });
        noHostState.players['0'] = {
            ...noHostState.players['0'],
            hand: [makeCard('salvage-1', 'munchkin_dwarves_salvage', 'action', '0')],
        };

        expect(validate(attachBeforeScoringWindow(noHostState, 0), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { handCardUid: 'salvage-1', baseIndex: 0 },
        } as const)).toEqual({ valid: false, error: '当前没有可打捞的宝藏或宿主' });

        const noTreasureState = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('host-1', 'munchkin_dwarves_loot_lover', '0', 4)],
            })],
            treasureDiscard: ['munchkin_treasure_wishing_ring'],
        });
        noTreasureState.players['0'] = {
            ...noTreasureState.players['0'],
            hand: [makeCard('salvage-1', 'munchkin_dwarves_salvage', 'action', '0')],
        };

        expect(validate(attachBeforeScoringWindow(noTreasureState, 0), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { handCardUid: 'salvage-1', baseIndex: 0 },
        } as const)).toEqual({ valid: false, error: '当前没有可打捞的宝藏或宿主' });
    });

    it('贪婪是好的可选择公共宝藏弃牌回手并授予额外行动', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: ['munchkin_treasure_dwarf_hireling'],
            treasureDiscard: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            nextUid: 1600,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('greed-1', 'munchkin_dwarves_greed_is_good', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'greed-1' },
        } as const;

        expect(getCardDef('munchkin_dwarves_greed_is_good')).toMatchObject({
            id: 'munchkin_dwarves_greed_is_good',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const played = runCommand(makeMatchState(state), command, fixedRandom);
        expect(played.success).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.MUNCHKIN_TREASURE_RECOVERED_FROM_DISCARD)).toBe(false);
        expect(played.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);

        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_dwarves_greed_is_good_choose_treasure');
        expect(prompt.targetType).toBe('card');
        expect(prompt.options.map((option: any) => option.value)).toEqual([
            { mode: 'draw' },
            { mode: 'recover', treasureDefId: 'munchkin_treasure_wishing_ring', discardIndex: 0 },
            { mode: 'recover', treasureDefId: 'munchkin_treasure_spiky_boots', discardIndex: 1 },
        ]);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.mode === 'recover'
                && option.value?.treasureDefId === 'munchkin_treasure_spiky_boots',
            '贪婪是好的回收宝藏分支',
            '0',
            fixedRandom,
        );
        const recoveredEvent = resolved.events.find((event): event is MunchkinTreasureRecoveredFromDiscardEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURE_RECOVERED_FROM_DISCARD
        );
        const limitEvent = resolved.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.limitType === 'action'
        );

        expect(resolved.success).toBe(true);
        expect(recoveredEvent?.payload).toMatchObject({
            playerId: '0',
            defId: 'munchkin_treasure_spiky_boots',
            reason: 'munchkin_dwarves_greed_is_good',
            sourceCardUid: 'greed-1',
            sourceDefId: 'munchkin_dwarves_greed_is_good',
        });
        expect(limitEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            delta: 1,
            reason: 'munchkin_dwarves_greed_is_good',
        });
        expect(resolved.finalState.core.treasureDiscard).toEqual(['munchkin_treasure_wishing_ring']);
        expect(resolved.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1600',
            defId: 'munchkin_treasure_spiky_boots',
            owner: '0',
        }));
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('greed-1');
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(resolved.finalState.core.nextUid).toBe(1601);
    });

    it('贪婪是好的可选择抽一张宝藏并授予额外行动', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_tiger_steed',
            ],
            treasureDiscard: ['munchkin_treasure_wishing_ring'],
            nextUid: 1610,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('greed-1', 'munchkin_dwarves_greed_is_good', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'greed-1' },
        } as const, fixedRandom);
        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.mode === 'draw',
            '贪婪是好的抽宝藏分支',
            '0',
            fixedRandom,
        );
        const drawEvent = resolved.events.find((event): event is MunchkinTreasuresDrawnEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN
        );
        const limitEvent = resolved.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.limitType === 'action'
        );

        expect(resolved.success).toBe(true);
        expect(drawEvent?.payload).toMatchObject({
            playerId: '0',
            count: 1,
            reason: 'munchkin_dwarves_greed_is_good',
            sourceCardUid: 'greed-1',
        });
        expect(limitEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            delta: 1,
            reason: 'munchkin_dwarves_greed_is_good',
        });
        expect(resolved.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1610',
            defId: 'munchkin_treasure_dwarf_hireling',
            owner: '0',
        }));
        expect(resolved.finalState.core.treasureDeck).toEqual(['munchkin_treasure_tiger_steed']);
        expect(resolved.finalState.core.treasureDiscard).toEqual(['munchkin_treasure_wishing_ring']);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('贪婪是好的没有公共宝藏弃牌时直接抽宝藏并授予额外行动', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: ['munchkin_treasure_tiger_steed'],
            treasureDiscard: [],
            nextUid: 1620,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('greed-1', 'munchkin_dwarves_greed_is_good', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'greed-1' },
        } as const, fixedRandom);
        const drawEvent = result.events.find((event): event is MunchkinTreasuresDrawnEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN
        );
        const limitEvent = result.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.limitType === 'action'
        );

        expect(result.success).toBe(true);
        expect(getOptionalSimpleChoicePrompt(result.finalState, 'munchkin_dwarves_greed_is_good_choose_treasure')).toBeUndefined();
        expect(drawEvent?.payload).toMatchObject({
            playerId: '0',
            count: 1,
            reason: 'munchkin_dwarves_greed_is_good',
            sourceCardUid: 'greed-1',
        });
        expect(limitEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            delta: 1,
            reason: 'munchkin_dwarves_greed_is_good',
        });
        expect(result.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1620',
            defId: 'munchkin_treasure_tiger_steed',
            owner: '0',
        }));
        expect(result.finalState.core.treasureDeck).toEqual([]);
        expect(result.finalState.core.treasureDiscard).toEqual([]);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toContain('greed-1');
        expect(result.finalState.core.players['0'].actionLimit).toBe(2);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('十字弓选择基地和派系，使那里该派系所有仆从本回合 +2', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('pirate-a', 'pirate_buccaneer', '0', 4),
                        makeMinion('pirate-b', 'pirate_first_mate', '1', 4),
                        makeMinion('alien-a', 'alien_invader', '1', 3),
                    ],
                }),
                makeBase({
                    defId: 'base_treasure_bath',
                    minions: [makeMinion('pirate-away', 'pirate_buccaneer', '0', 4)],
                }),
            ],
        });
        state.players['0'] = {
            ...state.players['0'],
            factions: ['pirates', 'aliens'],
            hand: [makeCard('crossbow-1', 'munchkin_treasure_crossbow', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'crossbow-1', targetBaseIndex: 0 },
        } as const;

        expect(getCardDef('munchkin_treasure_crossbow')).toMatchObject({
            id: 'munchkin_treasure_crossbow',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const played = runCommand(makeMatchState(state), command, fixedRandom);
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_treasure_crossbow_choose_faction');
        expect(prompt.targetType).toBe('button');
        expect(prompt.options.map((option: any) => option.value?.factionId)).toEqual(['pirates', 'aliens']);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.factionId === 'pirates',
            '十字弓目标派系',
            '0',
            fixedRandom,
        );
        const powerEvents = resolved.events.filter((event): event is TempPowerAddedEvent => event.type === SU_EVENTS.TEMP_POWER_ADDED);

        expect(resolved.success).toBe(true);
        expect(powerEvents.map(event => event.payload.minionUid).sort()).toEqual(['pirate-a', 'pirate-b']);
        expect(powerEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                payload: expect.objectContaining({
                    minionUid: 'pirate-a',
                    baseIndex: 0,
                    amount: 2,
                    reason: 'munchkin_treasure_crossbow',
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    minionUid: 'pirate-b',
                    baseIndex: 0,
                    amount: 2,
                    reason: 'munchkin_treasure_crossbow',
                }),
            }),
        ]));
        expect(getEffectivePower(resolved.finalState.core, resolved.finalState.core.bases[0].minions[0], 0)).toBe(6);
        expect(getEffectivePower(resolved.finalState.core, resolved.finalState.core.bases[0].minions[1], 0)).toBe(6);
        expect(getEffectivePower(resolved.finalState.core, resolved.finalState.core.bases[0].minions[2], 0)).toBe(3);
        expect(getEffectivePower(resolved.finalState.core, resolved.finalState.core.bases[1].minions[0], 1)).toBe(4);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('地牢规则书普通打出后可摧毁基地上的行动', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    ongoingActions: [{ uid: 'base-action-1', defId: 'zombie_overrun', ownerId: '1' }],
                }),
            ],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('rulebook-1', 'munchkin_treasure_dungeon_rulebook', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'rulebook-1' },
        } as const;

        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });
        const played = runCommand(makeMatchState(state), command, fixedRandom);
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_treasure_dungeon_rulebook_destroy');
        expect(prompt.targetType).toBe('ongoing');
        expect(prompt.options.map((option: any) => option.value?.cardUid)).toEqual(['base-action-1']);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'base-action-1',
            '地牢规则书目标行动',
            '0',
            fixedRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'base-action-1',
                defId: 'zombie_overrun',
                ownerId: '1',
                destination: 'discard',
                reason: 'munchkin_treasure_dungeon_rulebook',
            }),
        }));
        expect(resolved.finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(resolved.finalState.core.players['1'].discard).toContainEqual(expect.objectContaining({
            uid: 'base-action-1',
            defId: 'zombie_overrun',
        }));
    });

    it('地牢规则书普通打出后可摧毁仆从身上的行动', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('host-1', 'munchkin_warriors_big_hero', '1', 5, {
                            attachedActions: [{ uid: 'attached-action-1', defId: 'munchkin_treasure_spiky_boots', ownerId: '1' }],
                        }),
                    ],
                }),
            ],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('rulebook-1', 'munchkin_treasure_dungeon_rulebook', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'rulebook-1' },
        } as const, fixedRandom);
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_treasure_dungeon_rulebook_destroy');
        expect(prompt.targetType).toBe('ongoing');
        expect(prompt.options.map((option: any) => option.value?.cardUid)).toEqual(['attached-action-1']);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'attached-action-1',
            '地牢规则书目标附着行动',
            '0',
            fixedRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'attached-action-1',
                defId: 'munchkin_treasure_spiky_boots',
                ownerId: '1',
                destination: 'discard',
                reason: 'munchkin_treasure_dungeon_rulebook',
            }),
        }));
        expect(resolved.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(resolved.finalState.core.players['1'].discard).toContainEqual(expect.objectContaining({
            uid: 'attached-action-1',
            defId: 'munchkin_treasure_spiky_boots',
        }));
    });

    it('不！我的宝贝！只选择仆从身上的行动，摧毁宝藏附着行动后授予额外行动', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    ongoingActions: [{ uid: 'base-action-1', defId: 'zombie_overrun', ownerId: '1' }],
                    minions: [
                        makeMinion('host-1', 'munchkin_warriors_big_hero', '1', 5, {
                            attachedActions: [
                                { uid: 'treasure-attached-1', defId: 'munchkin_treasure_spiky_boots', ownerId: '1' },
                                { uid: 'normal-attached-1', defId: 'alien_jammed_signal', ownerId: '1' },
                            ],
                        }),
                    ],
                }),
            ],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('precious-1', 'munchkin_dwarves_no_my_precious', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'precious-1' },
        } as const;

        expect(getCardDef('munchkin_dwarves_no_my_precious')).toMatchObject({
            id: 'munchkin_dwarves_no_my_precious',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const played = runCommand(makeMatchState(state), command, fixedRandom);
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_dwarves_no_my_precious_destroy');
        expect(prompt.targetType).toBe('ongoing');
        expect(prompt.options.map((option: any) => option.value?.cardUid)).toEqual([
            'treasure-attached-1',
            'normal-attached-1',
        ]);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'treasure-attached-1',
            '不！我的宝贝！目标宝藏附着行动',
            '0',
            fixedRandom,
        );
        const limitEvent = resolved.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.limitType === 'action'
            && event.payload.reason === 'munchkin_dwarves_no_my_precious'
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'treasure-attached-1',
                defId: 'munchkin_treasure_spiky_boots',
                ownerId: '1',
                destination: 'discard',
                reason: 'munchkin_dwarves_no_my_precious',
            }),
        }));
        expect(limitEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            delta: 1,
            reason: 'munchkin_dwarves_no_my_precious',
        });
        expect(resolved.finalState.core.bases[0].ongoingActions).toEqual([
            { uid: 'base-action-1', defId: 'zombie_overrun', ownerId: '1' },
        ]);
        expect(resolved.finalState.core.bases[0].minions[0].attachedActions).toEqual([
            { uid: 'normal-attached-1', defId: 'alien_jammed_signal', ownerId: '1' },
        ]);
        expect(resolved.finalState.core.players['1'].discard).toContainEqual(expect.objectContaining({
            uid: 'treasure-attached-1',
            defId: 'munchkin_treasure_spiky_boots',
        }));
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('precious-1');
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('不！我的宝贝！摧毁非宝藏附着行动时不授予额外行动', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('host-1', 'munchkin_warriors_big_hero', '1', 5, {
                            attachedActions: [
                                { uid: 'normal-attached-1', defId: 'alien_jammed_signal', ownerId: '1' },
                            ],
                        }),
                    ],
                }),
            ],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('precious-1', 'munchkin_dwarves_no_my_precious', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'precious-1' },
        } as const, fixedRandom);
        expect(played.success).toBe(true);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'normal-attached-1',
            '不！我的宝贝！目标非宝藏附着行动',
            '0',
            fixedRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as LimitModifiedEvent).payload.limitType === 'action'
            && (event as LimitModifiedEvent).payload.reason === 'munchkin_dwarves_no_my_precious'
        )).toBe(false);
        expect(resolved.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(resolved.finalState.core.players['1'].discard).toContainEqual(expect.objectContaining({
            uid: 'normal-attached-1',
            defId: 'alien_jammed_signal',
        }));
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(1);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('矮人王会把你的仆从身上被拆下的宝藏收入你的手牌', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('king-1', 'munchkin_dwarves_dwarf_king', '0', 5),
                        makeMinion('host-1', 'munchkin_warriors_big_hero', '0', 5, {
                            attachedActions: [
                                { uid: 'spiky-1', defId: 'munchkin_treasure_spiky_boots', ownerId: '1' },
                            ],
                        }),
                    ],
                }),
            ],
        });

        const result = reduce(state, {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'spiky-1',
                defId: 'munchkin_treasure_spiky_boots',
                ownerId: '1',
                destination: 'discard',
                reason: 'test_dwarf_king',
            },
        } as any);

        expect(result.bases[0].minions[1].attachedActions).toEqual([]);
        expect(result.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'spiky-1',
            defId: 'munchkin_treasure_spiky_boots',
            owner: '1',
        }));
        expect(result.players['1'].discard.map(card => card.uid)).not.toContain('spiky-1');
    });

    it('矮人王会在宿主随从被摧毁时回收其身上的宝藏但不回收非宝藏行动', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('king-1', 'munchkin_dwarves_dwarf_king', '0', 5),
                        makeMinion('host-1', 'munchkin_warriors_big_hero', '0', 5, {
                            attachedActions: [
                                { uid: 'spiky-1', defId: 'munchkin_treasure_spiky_boots', ownerId: '1' },
                                { uid: 'jammed-1', defId: 'alien_jammed_signal', ownerId: '1' },
                            ],
                        }),
                    ],
                }),
            ],
        });

        const result = reduce(state, {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'host-1',
                minionDefId: 'munchkin_warriors_big_hero',
                fromBaseIndex: 0,
                ownerId: '0',
                controllerId: '0',
                reason: 'test_dwarf_king',
            },
        } as any);

        expect(result.bases[0].minions.map(minion => minion.uid)).toEqual(['king-1']);
        expect(result.players['0'].hand.map(card => card.uid)).toContain('spiky-1');
        expect(result.players['0'].discard.map(card => card.uid)).toContain('host-1');
        expect(result.players['1'].discard.map(card => card.uid)).toContain('jammed-1');
        expect(result.players['1'].discard.map(card => card.uid)).not.toContain('spiky-1');
    });

    it('矮人王被压制时不会替代回收宝藏', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('king-1', 'munchkin_dwarves_dwarf_king', '0', 5),
                        makeMinion('host-1', 'munchkin_warriors_big_hero', '0', 5, {
                            attachedActions: [
                                { uid: 'spiky-1', defId: 'munchkin_treasure_spiky_boots', ownerId: '1' },
                            ],
                        }),
                    ],
                }),
            ],
            suppressedCardUidsUntilTurnEnd: ['king-1'],
        });

        const result = reduce(state, {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'spiky-1',
                defId: 'munchkin_treasure_spiky_boots',
                ownerId: '1',
                destination: 'discard',
                reason: 'test_dwarf_king',
            },
        } as any);

        expect(result.players['0'].hand.map(card => card.uid)).not.toContain('spiky-1');
        expect(result.players['1'].discard.map(card => card.uid)).toContain('spiky-1');
    });

    it('地牢规则书可在计分前打出，并可摧毁非计分基地上的行动', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [makeMinion('scorer-1', 'munchkin_warriors_big_hero', '0', 20)],
                }),
                makeBase({
                    defId: 'base_treasure_bath',
                    ongoingActions: [{ uid: 'away-action-1', defId: 'zombie_overrun', ownerId: '1' }],
                }),
            ],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('rulebook-1', 'munchkin_treasure_dungeon_rulebook', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'rulebook-1' },
        } as const;

        expect(validate(attachBeforeScoringWindow(state, 0), command)).toEqual({ valid: true });
        const played = runCommand(attachBeforeScoringWindow(state, 0), command, fixedRandom);
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_treasure_dungeon_rulebook_destroy');
        expect(prompt.targetType).toBe('ongoing');
        expect(prompt.options.map((option: any) => option.value?.cardUid)).toEqual(['away-action-1']);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'away-action-1',
            '地牢规则书计分前目标行动',
            '0',
            fixedRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[1].ongoingActions).toEqual([]);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'away-action-1',
                reason: 'munchkin_treasure_dungeon_rulebook',
            }),
        }));
    });

    it('口臭药水普通打出后先选基地和玩家，再让该玩家移动自己的一个仆从', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('own-1', 'munchkin_warriors_big_hero', '0', 5),
                        makeMinion('enemy-1', 'alien_invader', '1', 3),
                    ],
                }),
                makeBase({ defId: 'base_treasure_bath' }),
            ],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('halitosis-1', 'munchkin_treasure_potion_of_halitosis', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'halitosis-1', targetBaseIndex: 0 },
        } as const, fixedRandom);
        expect(played.success).toBe(true);

        const playerPrompt = getSimpleChoicePrompt(played.finalState, 'munchkin_treasure_potion_of_halitosis_choose_player');
        expect(playerPrompt.targetType).toBe('player');
        expect(playerPrompt.options.map((option: any) => option.value?.playerId)).toEqual(['0', '1']);

        const chosePlayer = respondToPromptOption(
            played.finalState,
            option => option.value?.playerId === '1',
            '口臭药水目标玩家',
            '0',
            fixedRandom,
        );
        expect(chosePlayer.success).toBe(true);

        const movePrompt = getSimpleChoicePrompt(chosePlayer.finalState, 'munchkin_treasure_potion_of_halitosis_move');
        expect(movePrompt.playerId).toBe('1');
        expect(movePrompt.targetType).toBe('minion');
        expect(movePrompt.options.map((option: any) => option.value)).toEqual([
            expect.objectContaining({
                minionUid: 'enemy-1',
                fromBaseIndex: 0,
                toBaseIndex: 1,
            }),
        ]);

        const moved = respondToPromptOption(
            chosePlayer.finalState,
            option => option.value?.minionUid === 'enemy-1' && option.value?.toBaseIndex === 1,
            '口臭药水移动目标',
            '1',
            fixedRandom,
        );

        expect(moved.success).toBe(true);
        expect(moved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({
                minionUid: 'enemy-1',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'munchkin_treasure_potion_of_halitosis',
                sourcePlayerId: '0',
                sourceControllerId: '1',
            }),
        }));
        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['own-1']);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['enemy-1']);
        expect(moved.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('口臭药水计分前打出时必须选择正在计分的基地', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('scorer-1', 'munchkin_warriors_big_hero', '0', 20),
                        makeMinion('enemy-1', 'alien_invader', '1', 3),
                    ],
                }),
                makeBase({
                    defId: 'base_treasure_bath',
                    minions: [makeMinion('away-1', 'alien_invader', '1', 3)],
                }),
            ],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('halitosis-1', 'munchkin_treasure_potion_of_halitosis', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };

        expect(validate(attachBeforeScoringWindow(state, 0), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'halitosis-1', targetBaseIndex: 1 },
        } as const)).toMatchObject({ valid: false, error: '只能选择达到临界点的基地' });

        const played = runCommand(attachBeforeScoringWindow(state, 0), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'halitosis-1', targetBaseIndex: 0 },
        } as const, fixedRandom);
        expect(played.success).toBe(true);

        const playerPrompt = getSimpleChoicePrompt(played.finalState, 'munchkin_treasure_potion_of_halitosis_choose_player');
        expect(playerPrompt.options.map((option: any) => option.value?.playerId)).toEqual(['0', '1']);
        const chosePlayer = respondToPromptOption(
            played.finalState,
            option => option.value?.playerId === '1',
            '口臭药水计分前目标玩家',
            '0',
            fixedRandom,
        );

        const movePrompt = getSimpleChoicePrompt(chosePlayer.finalState, 'munchkin_treasure_potion_of_halitosis_move');
        expect(movePrompt.playerId).toBe('1');
        expect(movePrompt.options.map((option: any) => option.value)).toEqual([
            expect.objectContaining({ minionUid: 'enemy-1', fromBaseIndex: 0, toBaseIndex: 1 }),
        ]);

        const moved = respondToPromptOption(
            chosePlayer.finalState,
            option => option.value?.minionUid === 'enemy-1',
            '口臭药水计分前移动目标',
            '1',
            fixedRandom,
        );

        expect(moved.success).toBe(true);
        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['scorer-1']);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['away-1', 'enemy-1']);
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
                defId: 'base_treasure_bath',
                minions: [hero, ally, enemy],
            })],
        });

        expect(getEffectivePower(state, hero, 0)).toBe(11);
        expect(getEffectivePower(state, ally, 0)).toBe(3);
        expect(getEffectivePower(state, enemy, 0)).toBe(4);
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '0')).toBe(14);
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '1')).toBe(4);
    });

    it('矮人宝藏爱好者、宝石抓取者和矿洞按身上宝藏提供持续力量', () => {
        const lootLover = makeMinion('loot-lover-1', 'munchkin_dwarves_loot_lover', '0', 4, {
            attachedActions: [
                { uid: 'buckler-1', defId: 'munchkin_treasure_buckler_of_swashing', ownerId: '0' },
                { uid: 'rocket-1', defId: 'munchkin_treasure_rocket_boots', ownerId: '0' },
                { uid: 'missile-suppressed', defId: 'munchkin_treasure_magic_missile', ownerId: '0' },
                { uid: 'not-treasure-1', defId: 'alien_jammed_signal', ownerId: '0' },
            ],
        });
        const gemGrabber = makeMinion('gem-grabber-1', 'munchkin_dwarves_gem_grabber', '0', 2, {
            attachedActions: [
                { uid: 'buckler-2', defId: 'munchkin_treasure_buckler_of_swashing', ownerId: '0' },
            ],
        });
        const emptyGemGrabber = makeMinion('gem-grabber-empty', 'munchkin_dwarves_gem_grabber', '0', 2, {
            attachedActions: [
                { uid: 'not-treasure-2', defId: 'alien_jammed_signal', ownerId: '0' },
            ],
        });
        const enemyWithTreasure = makeMinion('enemy-1', 'alien_invader', '1', 3, {
            attachedActions: [
                { uid: 'buckler-3', defId: 'munchkin_treasure_buckler_of_swashing', ownerId: '1' },
            ],
        });
        const awayLootLover = makeMinion('away-loot-lover', 'munchkin_dwarves_loot_lover', '0', 4, {
            attachedActions: [
                { uid: 'buckler-away', defId: 'munchkin_treasure_buckler_of_swashing', ownerId: '0' },
            ],
        });
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [lootLover, gemGrabber, emptyGemGrabber, enemyWithTreasure],
                }),
                makeBase({
                    defId: 'base_treasure_bath',
                    minions: [awayLootLover],
                }),
            ],
            suppressedCardUidsUntilTurnEnd: ['missile-suppressed'],
        });

        expect(getCardDef('munchkin_dwarves_loot_lover')).toMatchObject({ abilityTags: ['ongoing'] });
        expect(getCardDef('munchkin_dwarves_gem_grabber')).toMatchObject({ abilityTags: ['ongoing'] });
        expect(getEffectivePower(state, state.bases[0].minions[0], 0)).toBe(10);
        expect(getEffectivePower(state, state.bases[0].minions[1], 0)).toBe(5);
        expect(getEffectivePower(state, state.bases[0].minions[2], 0)).toBe(2);
        expect(getEffectivePower(state, state.bases[0].minions[3], 0)).toBe(4);
        expect(getEffectivePower(state, state.bases[1].minions[0], 1)).toBe(6);
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '0')).toBe(17);
        expect(getPlayerEffectivePowerOnBase(state, state.bases[0], 0, '1')).toBe(4);
    });

    it('火箭靴天赋会移动被附着随从到另一个基地并保留附着牌', () => {
        const host = makeMinion('host-1', 'munchkin_warriors_big_hero', '0', 5, {
            attachedActions: [
                { uid: 'rocket-1', defId: 'munchkin_treasure_rocket_boots', ownerId: '0' },
            ],
        });
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_the_mines', minions: [host] }),
                makeBase({ defId: 'base_treasure_bath' }),
            ],
        });
        const command = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'rocket-1', baseIndex: 0 },
        } as const;

        expect(getCardDef('munchkin_treasure_rocket_boots')).toMatchObject({
            id: 'munchkin_treasure_rocket_boots',
            type: 'action',
            subtype: 'ongoing',
            ongoingTarget: 'minion',
            abilityTags: ['talent'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const activated = runCommand(makeMatchState(state), command, fixedRandom);
        expect(activated.success).toBe(true);
        expect(activated.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TALENT_USED,
            payload: expect.objectContaining({
                playerId: '0',
                ongoingCardUid: 'rocket-1',
                defId: 'munchkin_treasure_rocket_boots',
                baseIndex: 0,
            }),
        }));
        const prompt = getSimpleChoicePrompt(activated.finalState, 'munchkin_treasure_rocket_boots_move');
        expect(prompt.targetType).toBe('base');
        expect(prompt.options.map((option: any) => option.value?.baseIndex)).toEqual([1]);

        const moved = respondToPromptOption(
            activated.finalState,
            option => option.value?.baseIndex === 1,
            '火箭靴目标基地',
            '0',
            fixedRandom,
        );

        expect(moved.success).toBe(true);
        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(moved.finalState.core.bases[1].minions).toContainEqual(expect.objectContaining({
            uid: 'host-1',
            defId: 'munchkin_warriors_big_hero',
            attachedActions: [expect.objectContaining({
                uid: 'rocket-1',
                defId: 'munchkin_treasure_rocket_boots',
                ownerId: '0',
                talentUsed: true,
            })],
        }));
        expect(validate(moved.finalState, {
            ...command,
            payload: { ongoingCardUid: 'rocket-1', baseIndex: 1 },
        })).toMatchObject({ valid: false, error: '本回合天赋已使用' });
    });

    it('复制药水让宿主使用另一个仆从的天赋能力', () => {
        const host = makeMinion('host-1', 'munchkin_warriors_big_hero', '0', 5, {
            attachedActions: [
                { uid: 'duplication-1', defId: 'munchkin_treasure_potion_of_duplication', ownerId: '0' },
            ],
        });
        const copiedSource = makeMinion('rajah-1', 'aladdin_rajah', '1', 2);
        const noTalentMinion = makeMinion('no-talent-1', 'alien_invader', '1', 3);
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_treasure_bath', minions: [host, copiedSource, noTalentMinion] }),
            ],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('action-cost-1', 'alien_probe', 'action', '0')],
        };
        const command = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'duplication-1', baseIndex: 0 },
        } as const;

        expect(getCardDef('munchkin_treasure_potion_of_duplication')).toMatchObject({
            id: 'munchkin_treasure_potion_of_duplication',
            type: 'action',
            subtype: 'ongoing',
            ongoingTarget: 'minion',
            abilityTags: ['talent'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const activated = runCommand(makeMatchState(state), command, fixedRandom);
        expect(activated.success).toBe(true);
        const prompt = getSimpleChoicePrompt(activated.finalState, 'munchkin_treasure_potion_of_duplication_choose_talent');
        expect(prompt.targetType).toBe('minion');
        expect(prompt.options.map((option: any) => option.value?.minionUid)).toEqual(['rajah-1']);

        const copied = respondToPromptOption(
            activated.finalState,
            option => option.value?.minionUid === 'rajah-1',
            '复制药水目标天赋',
            '0',
            fixedRandom,
        );

        expect(copied.success).toBe(true);
        expect(copied.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'host-1',
                amount: 2,
                reason: 'aladdin_rajah',
                sourceCardUid: 'host-1',
                sourceDefId: 'aladdin_rajah',
            }),
        }));
        expect(copied.finalState.core.players['0'].hand).toEqual([]);
        expect(copied.finalState.core.players['0'].discard).toContainEqual(expect.objectContaining({
            uid: 'action-cost-1',
            defId: 'alien_probe',
        }));
        expect(getEffectivePower(copied.finalState.core, copied.finalState.core.bases[0].minions[0], 0)).toBe(7);
        expect(copied.finalState.core.bases[0].minions[0].attachedActions).toContainEqual(expect.objectContaining({
            uid: 'duplication-1',
            defId: 'munchkin_treasure_potion_of_duplication',
            talentUsed: true,
        }));
    });

    it('魔法导弹天赋会把自身放回公共宝藏牌库底，并摧毁这里力量 3 或更少的仆从', () => {
        const host = makeMinion('host-1', 'munchkin_warriors_big_hero', '0', 5, {
            attachedActions: [
                { uid: 'missile-1', defId: 'munchkin_treasure_magic_missile', ownerId: '0' },
            ],
        });
        const lowPowerMinion = makeMinion('low-1', 'alien_invader', '1', 3);
        const highPowerMinion = makeMinion('high-1', 'munchkin_warriors_big_hero', '1', 4);
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_the_mines', minions: [host, lowPowerMinion, highPowerMinion] }),
            ],
            treasureDeck: ['munchkin_treasure_wishing_ring'],
        });
        const command = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'missile-1', baseIndex: 0 },
        } as const;

        expect(getCardDef('munchkin_treasure_magic_missile')).toMatchObject({
            id: 'munchkin_treasure_magic_missile',
            type: 'action',
            subtype: 'ongoing',
            ongoingTarget: 'minion',
            abilityTags: ['talent'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const activated = runCommand(makeMatchState(state), command, fixedRandom);
        expect(activated.success).toBe(true);
        const prompt = getSimpleChoicePrompt(activated.finalState, 'munchkin_treasure_magic_missile_destroy');
        expect(prompt.targetType).toBe('minion');
        expect(prompt.options.map((option: any) => option.value?.minionUid)).toEqual(['low-1']);

        const resolved = respondToPromptOption(
            activated.finalState,
            option => option.value?.minionUid === 'low-1',
            '魔法导弹目标仆从',
            '0',
            fixedRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MUNCHKIN_TREASURE_TO_DECK_BOTTOM,
            payload: expect.objectContaining({
                cardUid: 'missile-1',
                defId: 'munchkin_treasure_magic_missile',
                ownerId: '0',
                reason: 'munchkin_treasure_magic_missile',
            }),
        }));
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'low-1',
                minionDefId: 'alien_invader',
                fromBaseIndex: 0,
                reason: 'munchkin_treasure_magic_missile',
            }),
        }));
        expect(resolved.finalState.core.treasureDeck).toEqual([
            'munchkin_treasure_wishing_ring',
            'munchkin_treasure_magic_missile',
        ]);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['host-1', 'high-1']);
        expect(resolved.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('missile-1');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('missile-1');
        expect(validate(resolved.finalState, command)).toMatchObject({ valid: false });
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

    it('麻痹药水在计分前取消正在计分基地上所有牌和仆从的能力直到回合结束', () => {
        const hero = makeMinion('hero-1', 'munchkin_warriors_big_hero', '0', 5, {
            attachedActions: [
                { uid: 'rocket-boots-1', defId: 'munchkin_treasure_rocket_boots', ownerId: '0' },
            ],
        });
        const ally = makeMinion('ally-1', 'munchkin_treasure_dwarf_hireling', '1', 2);
        const away = makeMinion('away-1', 'munchkin_treasure_halfling_hireling', '0', 2);
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [hero, ally],
                    ongoingActions: [{ uid: 'base-action-1', defId: 'zombie_overrun', ownerId: '1' }],
                }),
                makeBase({
                    defId: 'base_treasure_bath',
                    minions: [away],
                    ongoingActions: [{ uid: 'away-action-1', defId: 'alien_jammed_signal', ownerId: '1' }],
                }),
            ],
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('paralysis-1', 'munchkin_treasure_potion_of_paralysis', 'action', '0')],
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'paralysis-1', targetBaseIndex: 0 },
        } as const;

        expect(validate(attachBeforeScoringWindow(state, 0), command)).toEqual({ valid: true });
        const played = runCommand(attachBeforeScoringWindow(state, 0), command, fixedRandom);

        expect(played.success).toBe(true);
        expect(played.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_SUPPRESSED_UNTIL_TURN_END,
            payload: expect.objectContaining({
                baseIndex: 0,
                reason: 'munchkin_treasure_potion_of_paralysis',
                cardUids: ['base-action-1', 'hero-1', 'rocket-boots-1', 'ally-1'],
            }),
        }));
        expect(played.finalState.core.suppressedCardUidsUntilTurnEnd).toEqual([
            'base-action-1',
            'hero-1',
            'rocket-boots-1',
            'ally-1',
        ]);
        expect(isCardSuppressed(played.finalState.core, 'base-action-1')).toBe(true);
        expect(isCardSuppressed(played.finalState.core, 'hero-1')).toBe(true);
        expect(isCardSuppressed(played.finalState.core, 'rocket-boots-1')).toBe(true);
        expect(isCardSuppressed(played.finalState.core, 'ally-1')).toBe(true);
        expect(isCardSuppressed(played.finalState.core, 'away-action-1')).toBe(false);
        expect(isCardSuppressed(played.finalState.core, 'away-1')).toBe(false);

        const nextTurn = reduce(played.finalState.core, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 2 },
            timestamp: 200,
        });
        expect(nextTurn.suppressedCardUidsUntilTurnEnd).toBeUndefined();
        expect(isCardSuppressed(nextTurn, 'hero-1')).toBe(false);
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

    it('一袋铁蒺藜不会摧毁同一玩家打到本基地的低力量随从', () => {
        const friendlyLowPowerMinion = makeMinion('friendly-low-1', 'alien_invader', '0', 3);
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [friendlyLowPowerMinion],
                ongoingActions: [
                    { uid: 'caltrops-1', defId: 'munchkin_treasure_bag_of_caltrops', ownerId: '0' },
                ],
            })],
        });

        const triggered = fireTriggers(state, 'onMinionPlayed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'friendly-low-1',
            triggerMinionDefId: 'alien_invader',
            triggerMinion: friendlyLowPowerMinion,
            sourceCardUid: 'caltrops-1',
            random: fixedRandom,
            now: 112,
        });

        expect(triggered.events).toEqual([]);
    });

    it('半身人作为这里唯一己方仆从打出时，只授予这里的额外随从额度', () => {
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_the_mines', minions: [] }),
                makeBase({ defId: 'base_treasure_bath', minions: [] }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [
                        makeCard('quarterling-1', 'munchkin_halflings_quarterling', 'minion', '0'),
                        makeCard('ally-1', 'alien_invader', 'minion', '0'),
                    ],
                },
                '1': makeState().players['1'],
            },
        });

        const first = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'quarterling-1', baseIndex: 0 },
        }, fixedRandom);

        expect(first.success).toBe(true);
        expect(first.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(validate(first.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 0 },
        })).toEqual({ valid: true });
        expect(validate(first.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 1 },
        })).toMatchObject({ valid: false });
    });

    it('半身人若不是这里唯一己方仆从，不授予额外随从额度', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('existing-1', 'alien_invader', '0', 3)],
            })],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [
                        makeCard('quarterling-1', 'munchkin_halflings_quarterling', 'minion', '0'),
                        makeCard('ally-1', 'alien_invader', 'minion', '0'),
                    ],
                },
                '1': makeState().players['1'],
            },
        });

        const first = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'quarterling-1', baseIndex: 0 },
        }, fixedRandom);

        expect(first.success).toBe(true);
        expect(first.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBeUndefined();
        expect(validate(first.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 0 },
        })).toMatchObject({ valid: false });
    });

    it('生日派对在玩家没有仆从时，禁止该玩家把随从打到其他基地', () => {
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_birthday_party', minions: [] }),
                makeBase({ defId: 'base_the_mines', minions: [] }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [makeCard('minion-1', 'alien_invader', 'minion', '0')],
                },
                '1': makeState().players['1'],
            },
        });

        expect(validate(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'minion-1', baseIndex: 1 },
        })).toMatchObject({ valid: false });
        expect(validate(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'minion-1', baseIndex: 0 },
        })).toEqual({ valid: true });

        const occupiedBirthdayParty = makeState({
            bases: [
                makeBase({ defId: 'base_birthday_party', minions: [makeMinion('party-guest-1', 'pirate_first_mate', '0', 2)] }),
                makeBase({ defId: 'base_the_mines', minions: [] }),
            ],
            players: state.players,
        });
        expect(validate(makeMatchState(occupiedBirthdayParty), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'minion-1', baseIndex: 1 },
        })).toEqual({ valid: true });
    });

    it('地下矮屋在玩家回合开始且这里没有其仆从时，授予这里的额外随从额度', () => {
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_subterranean_lair', minions: [] }),
                makeBase({ defId: 'base_the_mines', minions: [] }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [makeCard('minion-1', 'alien_invader', 'minion', '0')],
                    minionsPlayed: 1,
                },
                '1': makeState().players['1'],
            },
        });

        const triggered = triggerBaseAbility('base_subterranean_lair', 'onTurnStart', {
            state,
            baseIndex: 0,
            baseDefId: 'base_subterranean_lair',
            playerId: '0',
            now: 120,
        });
        expect(triggered.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'minion',
                restrictToBase: 0,
                reason: 'base_subterranean_lair',
            }),
        }));

        const withQuota = reduce(state, triggered.events[0] as LimitModifiedEvent);
        expect(validate(makeMatchState(withQuota), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'minion-1', baseIndex: 0 },
        })).toEqual({ valid: true });
        expect(validate(makeMatchState(withQuota), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'minion-1', baseIndex: 1 },
        })).toMatchObject({ valid: false });

        const occupied = makeState({
            bases: [makeBase({
                defId: 'base_subterranean_lair',
                minions: [makeMinion('resident-1', 'pirate_first_mate', '0', 2)],
            })],
        });
        expect(triggerBaseAbility('base_subterranean_lair', 'onTurnStart', {
            state: occupied,
            baseIndex: 0,
            baseDefId: 'base_subterranean_lair',
            playerId: '0',
            now: 121,
        }).events).toEqual([]);
    });

    it('调皮鬼打出后，只授予其所在基地的额外随从额度', () => {
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_the_mines', minions: [] }),
                makeBase({ defId: 'base_treasure_bath', minions: [] }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [
                        makeCard('pestling-1', 'munchkin_halflings_pestling', 'minion', '0'),
                        makeCard('ally-1', 'alien_invader', 'minion', '0'),
                    ],
                },
                '1': makeState().players['1'],
            },
        });

        const first = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'pestling-1', baseIndex: 0 },
        }, fixedRandom);

        expect(first.success).toBe(true);
        expect(first.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(validate(first.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 0 },
        })).toEqual({ valid: true });
        expect(validate(first.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 1 },
        })).toMatchObject({ valid: false });
    });

    it('调皮鬼在场时，每个控制者回合开始续给本基地额外随从额度', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [makeMinion('pestling-live-1', 'munchkin_halflings_pestling', '0', 3)],
                }),
                makeBase({ defId: 'base_treasure_bath', minions: [] }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [makeCard('ally-1', 'alien_invader', 'minion', '0')],
                    minionsPlayed: 1,
                },
                '1': makeState().players['1'],
            },
        });

        const triggered = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: fixedRandom,
            now: 130,
        });

        expect(triggered.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'minion',
                restrictToBase: 0,
                reason: 'munchkin_halflings_pestling',
            }),
        }));

        const withQuota = reduce(state, triggered.events[0] as LimitModifiedEvent);
        expect(validate(makeMatchState(withQuota), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 0 },
        })).toEqual({ valid: true });
        expect(validate(makeMatchState(withQuota), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 1 },
        })).toMatchObject({ valid: false });

        expect(fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '1',
            random: fixedRandom,
            now: 131,
        }).events).toEqual([]);
    });

    it('吟游诗人在另一玩家力量更大时，给所在基地额外随从额度', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [makeMinion('opponent-1', 'munchkin_warriors_big_hero', '1', 4)],
                }),
                makeBase({ defId: 'base_treasure_bath', minions: [] }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [
                        makeCard('bardling-1', 'munchkin_halflings_bardling', 'minion', '0'),
                        makeCard('ally-1', 'alien_invader', 'minion', '0'),
                    ],
                },
                '1': makeState().players['1'],
            },
        });

        const first = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'bardling-1', baseIndex: 0 },
        }, fixedRandom);

        expect(first.success).toBe(true);
        expect(first.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(validate(first.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 0 },
        })).toEqual({ valid: true });
        expect(validate(first.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 1 },
        })).toMatchObject({ valid: false });
    });

    it('吟游诗人在力量条件不满足时，不给额外随从额度', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [makeMinion('opponent-1', 'alien_invader', '1', 2)],
                }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [
                        makeCard('bardling-1', 'munchkin_halflings_bardling', 'minion', '0'),
                        makeCard('ally-1', 'alien_invader', 'minion', '0'),
                    ],
                },
                '1': makeState().players['1'],
            },
        });

        const first = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'bardling-1', baseIndex: 0 },
        }, fixedRandom);

        expect(first.success).toBe(true);
        expect(first.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBeUndefined();
        expect(validate(first.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 0 },
        })).toMatchObject({ valid: false });
    });

    it('吟游诗人在场且另一玩家力量更大时，控制者回合开始续给本基地额度', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('bardling-live-1', 'munchkin_halflings_bardling', '0', 2),
                        makeMinion('opponent-1', 'munchkin_warriors_big_hero', '1', 4),
                    ],
                }),
                makeBase({ defId: 'base_treasure_bath', minions: [] }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [makeCard('ally-1', 'alien_invader', 'minion', '0')],
                    minionsPlayed: 1,
                },
                '1': makeState().players['1'],
            },
        });

        const triggered = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: fixedRandom,
            now: 140,
        });

        expect(triggered.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'minion',
                restrictToBase: 0,
                reason: 'munchkin_halflings_bardling',
            }),
        }));

        const withQuota = reduce(state, triggered.events[0] as LimitModifiedEvent);
        expect(validate(makeMatchState(withQuota), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 0 },
        })).toEqual({ valid: true });
        expect(validate(makeMatchState(withQuota), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 1 },
        })).toMatchObject({ valid: false });
    });

    it('夏尔首领没有另一玩家力量更大的基地时，不能发动天赋', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [
                    makeMinion('marshal-1', 'munchkin_halflings_shire_marshal', '0', 4),
                    makeMinion('opponent-1', 'alien_invader', '1', 2),
                ],
            })],
        });

        expect(validate(makeMatchState(state), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'marshal-1', baseIndex: 0 },
        })).toMatchObject({
            valid: false,
            error: '当前没有另一玩家力量大于你的基地',
        });
    });

    it('夏尔首领只有一个合法基地时，直接授予该基地额外随从额度', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('marshal-1', 'munchkin_halflings_shire_marshal', '0', 4),
                        makeMinion('opponent-1', 'munchkin_warriors_big_hero', '1', 5),
                    ],
                }),
                makeBase({ defId: 'base_treasure_bath', minions: [] }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [makeCard('ally-1', 'alien_invader', 'minion', '0')],
                    minionsPlayed: 1,
                },
                '1': makeState().players['1'],
            },
        });

        const activated = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'marshal-1', baseIndex: 0 },
        }, fixedRandom);

        expect(activated.success).toBe(true);
        expect(activated.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(validate(activated.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 0 },
        })).toEqual({ valid: true });
        expect(validate(activated.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 1 },
        })).toMatchObject({ valid: false });
        expect(activated.finalState.core.bases[0].minions[0].talentUsed).toBe(true);
    });

    it('夏尔首领有多个合法基地时，选择其中一个基地后只授予该基地额度', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('marshal-1', 'munchkin_halflings_shire_marshal', '0', 4),
                        makeMinion('opponent-1', 'munchkin_warriors_big_hero', '1', 5),
                    ],
                }),
                makeBase({
                    defId: 'base_treasure_bath',
                    minions: [makeMinion('opponent-2', 'munchkin_warriors_big_hero', '1', 4)],
                }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [makeCard('ally-1', 'alien_invader', 'minion', '0')],
                    minionsPlayed: 1,
                },
                '1': makeState().players['1'],
            },
        });

        const activated = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'marshal-1', baseIndex: 0 },
        }, fixedRandom);

        expect(activated.success).toBe(true);
        const prompt = getSimpleChoicePrompt(activated.finalState, 'munchkin_halflings_shire_marshal_choose_base');
        expect(prompt.targetType).toBe('base');
        expect(prompt.options.map((option: any) => option.value?.baseIndex)).toEqual([0, 1]);

        const resolved = respondToPromptOption(
            activated.finalState,
            option => option.value?.baseIndex === 1,
            '夏尔首领目标基地',
            '0',
            fixedRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBeUndefined();
        expect(resolved.finalState.core.players['0'].baseLimitedMinionQuota?.[1]).toBe(1);
        expect(validate(resolved.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 1 },
        })).toEqual({ valid: true });
        expect(validate(resolved.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'ally-1', baseIndex: 0 },
        })).toMatchObject({ valid: false });
    });

    it('午餐散步在你于所在基地打出仆从后抽一张牌，其他玩家或其他基地不触发', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    ongoingActions: [{ uid: 'lunch-run-1', defId: 'munchkin_halflings_lunch_run', ownerId: '0' }],
                    minions: [makeMinion('new-minion-1', 'alien_invader', '0', 2)],
                }),
                makeBase({ defId: 'base_treasure_bath', minions: [] }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    deck: [makeCard('draw-1', 'pirate_first_mate', 'minion', '0')],
                },
                '1': {
                    ...makeState().players['1'],
                    deck: [makeCard('opponent-draw-1', 'alien_invader', 'minion', '1')],
                },
            },
        });

        expect(getCardDef('munchkin_halflings_lunch_run')).toMatchObject({
            id: 'munchkin_halflings_lunch_run',
            type: 'action',
            subtype: 'ongoing',
            ongoingTarget: 'base',
            playNeedsBase: true,
            abilityTags: ['ongoing'],
        });

        const triggered = fireTriggers(state, 'onMinionPlayed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'new-minion-1',
            triggerMinionDefId: 'alien_invader',
            random: fixedRandom,
            now: 150,
        });
        const draw = triggered.events.find((event): event is CardsDrawnEvent => event.type === SU_EVENTS.CARDS_DRAWN);

        expect(draw?.payload).toMatchObject({
            playerId: '0',
            count: 1,
            cardUids: ['draw-1'],
        });
        const afterDraw = reduce(state, draw!);
        expect(afterDraw.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);

        expect(fireTriggers(state, 'onMinionPlayed', {
            state,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'opponent-minion-1',
            triggerMinionDefId: 'alien_invader',
            random: fixedRandom,
            now: 151,
        }).events).toEqual([]);
        expect(fireTriggers(state, 'onMinionPlayed', {
            state,
            playerId: '0',
            baseIndex: 1,
            triggerMinionUid: 'other-base-minion-1',
            triggerMinionDefId: 'alien_invader',
            random: fixedRandom,
            now: 152,
        }).events).toEqual([]);
    });

    it('偷偷摸摸保护你在该基地的仆从不受其他玩家行动影响', () => {
        const protectedMinion = makeMinion('protected-1', 'alien_invader', '0', 2);
        const otherBaseMinion = makeMinion('other-base-1', 'pirate_first_mate', '0', 2);
        const opponentMinion = makeMinion('opponent-1', 'pirate_first_mate', '1', 2);
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    ongoingActions: [{ uid: 'sneaksy-1', defId: 'munchkin_halflings_sneaksy', ownerId: '0' }],
                    minions: [protectedMinion, opponentMinion],
                }),
                makeBase({ defId: 'base_treasure_bath', minions: [otherBaseMinion] }),
            ],
        });

        expect(getCardDef('munchkin_halflings_sneaksy')).toMatchObject({
            id: 'munchkin_halflings_sneaksy',
            type: 'action',
            subtype: 'ongoing',
            ongoingTarget: 'base',
            playNeedsBase: true,
            abilityTags: ['ongoing'],
        });
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'action', { sourceKind: 'action' })).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'destroy', { sourceKind: 'action' })).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '0', 'action', { sourceKind: 'action' })).toBe(false);
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'action', { sourceKind: 'nonAction' })).toBe(false);
        expect(isMinionProtected(state, opponentMinion, 0, '0', 'action', { sourceKind: 'action' })).toBe(false);
        expect(isMinionProtected(state, otherBaseMinion, 1, '1', 'action', { sourceKind: 'action' })).toBe(false);
    });

    it('偷袭展示牌库直到两个仆从，将仆从加入手牌并重洗其余展示牌', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [makeCard('out-of-nowhere-1', 'munchkin_halflings_out_of_nowhere', 'action', '0')],
                    deck: [
                        makeCard('revealed-action-1', 'pirate_broadside', 'action', '0'),
                        makeCard('revealed-minion-1', 'alien_invader', 'minion', '0'),
                        makeCard('revealed-action-2', 'munchkin_halflings_lunch_run', 'action', '0'),
                        makeCard('revealed-minion-2', 'pirate_first_mate', 'minion', '0'),
                        makeCard('unrevealed-action-1', 'munchkin_halflings_sneaksy', 'action', '0'),
                    ],
                    discard: [],
                },
                '1': makeState().players['1'],
            },
        });
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'out-of-nowhere-1' },
        } as const;

        expect(getCardDef('munchkin_halflings_out_of_nowhere')).toMatchObject({
            id: 'munchkin_halflings_out_of_nowhere',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const played = runCommand(makeMatchState(state), command, fixedRandom);
        const reveal = played.events.find(event => event.type === SU_EVENTS.REVEAL_DECK_TOP);
        const draw = played.events.find((event): event is CardsDrawnEvent => event.type === SU_EVENTS.CARDS_DRAWN);

        expect(played.success).toBe(true);
        expect(reveal?.payload).toMatchObject({
            targetPlayerId: '0',
            viewerPlayerId: 'all',
            count: 4,
            reason: 'munchkin_halflings_out_of_nowhere',
        });
        expect(reveal?.payload.cards.map((card: any) => card.uid)).toEqual([
            'revealed-action-1',
            'revealed-minion-1',
            'revealed-action-2',
            'revealed-minion-2',
        ]);
        expect(draw?.payload).toMatchObject({
            playerId: '0',
            count: 2,
            cardUids: ['revealed-minion-1', 'revealed-minion-2'],
        });
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'revealed-minion-1',
            'revealed-minion-2',
        ]);
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'unrevealed-action-1',
            'revealed-action-1',
            'revealed-action-2',
        ]);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toContain('out-of-nowhere-1');
    });
    it('最后通牒在计分前打出一个手牌随从到当前基地，并取消该随从能力', () => {
        const state = makeState({
            bases: [makeBase({
                defId: 'base_the_mines',
                minions: [makeMinion('scorer-1', 'munchkin_warriors_big_hero', '0', 20)],
            })],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [
                        makeCard('last-call-1', 'munchkin_halflings_last_call', 'action', '0'),
                        makeCard('hireling-1', 'pirate_first_mate', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 1,
                },
                '1': makeState().players['1'],
            },
        });
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'last-call-1', targetBaseIndex: 0 },
        } as const;

        expect(getCardDef('munchkin_halflings_last_call')).toMatchObject({
            id: 'munchkin_halflings_last_call',
            type: 'action',
            subtype: 'special',
            abilityTags: ['special'],
            specialTiming: 'beforeScoring',
            specialNeedsBase: true,
        });
        expect(validate(attachBeforeScoringWindow(state, 0), command)).toEqual({ valid: true });

        const played = runCommand(attachBeforeScoringWindow(state, 0), command, fixedRandom);
        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_halflings_last_call_choose_minion');
        expect(prompt.targetType).toBe('hand');
        expect(prompt.options.map((option: any) => option.value?.cardUid)).toEqual(['hireling-1']);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'hireling-1',
            '最后通牒目标随从',
            '0',
            fixedRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_PLAYED,
            payload: expect.objectContaining({
                cardUid: 'hireling-1',
                baseIndex: 0,
                consumesNormalLimit: false,
                skipOnPlayAbility: true,
            }),
        }));
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_SUPPRESSED_UNTIL_TURN_END,
            payload: expect.objectContaining({
                cardUids: ['hireling-1'],
                baseIndex: 0,
                reason: 'munchkin_halflings_last_call',
            }),
        }));
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('hireling-1');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('last-call-1');
        expect(resolved.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBeUndefined();
        expect(isCardSuppressed(resolved.finalState.core, 'hireling-1')).toBe(true);

        const afterScoringQueue = collectTriggers(resolved.finalState.core, 'afterScoring', {
            state: resolved.finalState.core,
            matchState: resolved.finalState,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 22, vp: 5 }],
            frameId: 'test-last-call-after-scoring',
            sourceEventId: 'test-last-call-after-scoring',
            random: fixedRandom,
            now: 2,
        });
        const afterScoringSources = afterScoringQueue?.payload.triggers.map(trigger => trigger.sourceDefId) ?? [];
        expect(afterScoringSources).not.toContain('pirate_first_mate');
    });

    it('惊醒展示手牌，并把所有手牌随从作为额外随从打到所选基地且取消能力', () => {
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_the_mines' }),
                makeBase({ defId: 'base_treasure_bath' }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [
                        makeCard('awakening-1', 'munchkin_halflings_rude_awakening', 'action', '0'),
                        makeCard('hireling-1', 'munchkin_treasure_halfling_hireling', 'minion', '0'),
                        makeCard('ally-1', 'alien_invader', 'minion', '0'),
                        makeCard('left-action-1', 'munchkin_halflings_lunch_run', 'action', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 1,
                },
                '1': makeState().players['1'],
            },
        });
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'awakening-1', targetBaseIndex: 1 },
        } as const;

        expect(getCardDef('munchkin_halflings_rude_awakening')).toMatchObject({
            id: 'munchkin_halflings_rude_awakening',
            type: 'action',
            subtype: 'standard',
            playNeedsBase: true,
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const played = runCommand(makeMatchState(state), command, fixedRandom);
        const reveal = played.events.find(event => event.type === SU_EVENTS.REVEAL_HAND);

        expect(played.success).toBe(true);
        expect(reveal?.payload).toMatchObject({
            targetPlayerId: '0',
            viewerPlayerId: 'all',
            reason: 'munchkin_halflings_rude_awakening',
        });
        expect(reveal?.payload.cards.map((card: any) => card.uid)).toEqual(['hireling-1', 'ally-1', 'left-action-1']);
        expect(played.events.filter(event => event.type === SU_EVENTS.MINION_PLAYED).map((event: any) => event.payload.cardUid)).toEqual(['hireling-1', 'ally-1']);
        expect(played.events.filter(event => event.type === SU_EVENTS.MINION_PLAYED).every((event: any) => event.payload.skipOnPlayAbility === true)).toBe(true);
        expect(played.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['hireling-1', 'ally-1']);
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['left-action-1']);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toContain('awakening-1');
        expect(isCardSuppressed(played.finalState.core, 'hireling-1')).toBe(true);
        expect(isCardSuppressed(played.finalState.core, 'ally-1')).toBe(true);
        expect(played.finalState.core.players['0'].baseLimitedMinionQuota?.[1]).toBeUndefined();
    });

    it('小而坚韧让宿主进弃牌堆时改放到牌库顶，附着行动自身按既有合同离场', () => {
        const host = makeMinion('host-1', 'alien_invader', '0', 2, {
            attachedActions: [
                { uid: 'small-1', defId: 'munchkin_halflings_small_but_tough', ownerId: '0' },
                { uid: 'jammed-1', defId: 'alien_jammed_signal', ownerId: '0' },
            ],
        });
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines', minions: [host] })],
            players: {
                '0': { ...makeState().players['0'], deck: [makeCard('deck-1', 'pirate_first_mate', 'minion', '0')] },
                '1': makeState().players['1'],
            },
        });

        expect(getCardDef('munchkin_halflings_small_but_tough')).toMatchObject({
            id: 'munchkin_halflings_small_but_tough',
            type: 'action',
            subtype: 'ongoing',
            ongoingTarget: 'minion',
            playNeedsMinion: true,
            abilityTags: ['ongoing'],
        });
        const triggered = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'host-1',
            triggerMinionDefId: 'alien_invader',
            triggerMinion: host,
            sourceCardUid: 'small-1',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            random: fixedRandom,
            now: 170,
        });

        expect(triggered.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: expect.objectContaining({
                cardUid: 'host-1',
                reason: 'munchkin_halflings_small_but_tough',
            }),
        }));

        const destroyed = reduce(state, {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'host-1',
                minionDefId: 'alien_invader',
                fromBaseIndex: 0,
                ownerId: '0',
                controllerId: '0',
                reason: 'test_small_but_tough',
            },
            timestamp: 170,
        } as any);
        const final = triggered.events.reduce((core, event) => reduce(core, event as any), destroyed);

        expect(final.bases[0].minions).toEqual([]);
        expect(final.players['0'].deck.map(card => card.uid)).toEqual(['host-1', 'deck-1']);
        expect(final.players['0'].discard.map(card => card.uid)).toEqual(['small-1', 'jammed-1']);
    });

    it('被宠坏的小家伙可从弃牌堆任意选择随从洗混后放到牌库顶，也允许空选', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [makeCard('spoiled-1', 'munchkin_halflings_spoiled_brats', 'action', '0')],
                    deck: [makeCard('deck-1', 'pirate_first_mate', 'minion', '0')],
                    discard: [
                        makeCard('discard-minion-1', 'alien_invader', 'minion', '0'),
                        makeCard('discard-action-1', 'pirate_broadside', 'action', '0'),
                        makeCard('discard-minion-2', 'munchkin_halflings_quarterling', 'minion', '0'),
                    ],
                },
                '1': makeState().players['1'],
            },
        });

        expect(getCardDef('munchkin_halflings_spoiled_brats')).toMatchObject({
            id: 'munchkin_halflings_spoiled_brats',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'spoiled-1' },
        } as const, fixedRandom);
        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_halflings_spoiled_brats_choose_minions');
        expect(prompt.multi).toMatchObject({ min: 0, max: 2 });
        expect(prompt.options.map((option: any) => option.value?.cardUid)).toEqual(['discard-minion-1', 'discard-minion-2']);

        const selected = respondToPromptOptions(
            played.finalState,
            prompt.options.map((option: any) => option.id),
            '0',
            fixedRandom,
        );
        expect(selected.success).toBe(true);
        expect(selected.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '0',
                deckUids: ['discard-minion-1', 'discard-minion-2', 'deck-1'],
            }),
        }));
        expect(selected.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['discard-minion-1', 'discard-minion-2', 'deck-1']);
        expect(selected.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-action-1', 'spoiled-1']);

        const skippedStart = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'spoiled-1' },
        } as const, fixedRandom);
        const skipped = respondToPromptOptions(skippedStart.finalState, [], '0', fixedRandom);
        expect(skipped.success).toBe(true);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-1']);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([
            'discard-minion-1',
            'discard-action-1',
            'discard-minion-2',
            'spoiled-1',
        ]);
    });

    it('意外的派对只允许选择没有己方随从的基地，也可以跳过不获得额外随从', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [makeMinion('own-1', 'munchkin_halflings_quarterling', '0', 2)],
                }),
                makeBase({
                    defId: 'base_treasure_bath',
                    minions: [makeMinion('enemy-1', 'alien_invader', '1', 2)],
                }),
            ],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [
                        makeCard('party-1', 'munchkin_halflings_unexpected_party', 'action', '0'),
                        makeCard('party-minion-1', 'pirate_first_mate', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 1,
                },
                '1': makeState().players['1'],
            },
        });

        expect(getCardDef('munchkin_halflings_unexpected_party')).toMatchObject({
            id: 'munchkin_halflings_unexpected_party',
            type: 'action',
            subtype: 'standard',
            abilityTags: ['onPlay'],
        });
        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'party-1' },
        } as const, fixedRandom);
        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_halflings_unexpected_party_choose_base');
        expect(prompt.targetType).toBe('base');
        expect(prompt.options.map((option: any) => option.value)).toEqual([
            { skip: true },
            expect.objectContaining({ baseIndex: 1, baseDefId: 'base_treasure_bath' }),
        ]);

        const choseBase = respondToPromptOption(
            played.finalState,
            option => option.value?.baseIndex === 1,
            '意外的派对目标基地',
            '0',
            fixedRandom,
        );
        expect(choseBase.success).toBe(true);
        expect(choseBase.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'minion',
                restrictToBase: 1,
                playTiming: 'immediate',
                reason: 'munchkin_halflings_unexpected_party',
            }),
        }));
        const extraPrompt = getSimpleChoicePrompt(choseBase.finalState, 'smashup_immediate_extra_minion');
        expect(extraPrompt.options.map((option: any) => option.value?.cardUid)).toContain('party-minion-1');

        const playedMinion = respondToPromptOption(
            choseBase.finalState,
            option => option.value?.cardUid === 'party-minion-1',
            '意外的派对额外随从',
            '0',
            fixedRandom,
        );
        expect(playedMinion.success).toBe(true);
        expect(playedMinion.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['enemy-1', 'party-minion-1']);

        const skippedStart = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'party-1' },
        } as const, fixedRandom);
        const skipped = respondToPromptOption(
            skippedStart.finalState,
            option => option.value?.skip === true,
            '意外的派对跳过',
            '0',
            fixedRandom,
        );
        expect(skipped.success).toBe(true);
        expect(getOptionalSimpleChoicePrompt(skipped.finalState, 'smashup_immediate_extra_minion')).toBeUndefined();
        expect(skipped.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['enemy-1']);
    });

    it('盗贼大师天赋抽一张宝藏牌并消耗天赋次数', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [makeMinion('master-1', 'munchkin_thieves_master_thief', '0', 5)],
                }),
            ],
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            nextUid: 1900,
        });
        const command = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'master-1', baseIndex: 0 },
        } as const;

        expect(getCardDef('munchkin_thieves_master_thief')).toMatchObject({
            id: 'munchkin_thieves_master_thief',
            type: 'minion',
            abilityTags: ['talent'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const result = runCommand(makeMatchState(state), command, fixedRandom);
        const drawEvent = result.events.find((event): event is MunchkinTreasuresDrawnEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN
        );

        expect(result.success).toBe(true);
        expect(drawEvent?.payload).toMatchObject({
            playerId: '0',
            count: 1,
            reason: 'munchkin_thieves_master_thief',
            sourceCardUid: 'master-1',
            sourceDefId: 'munchkin_thieves_master_thief',
        });
        expect(result.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1900',
            defId: 'munchkin_treasure_wishing_ring',
            owner: '0',
        }));
        expect(result.finalState.core.treasureDeck).toEqual(['munchkin_treasure_spiky_boots']);
        expect(result.finalState.core.bases[0].minions[0].talentUsed).toBe(true);
    });

    it('顺手拿走作为普通行动抽一张宝藏牌', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            nextUid: 1910,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('swipe-1', 'munchkin_thieves_swipe', 'action', '0')],
            actionsPlayed: 0,
            actionLimit: 1,
        };
        const command = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'swipe-1' },
        } as const;

        expect(getCardDef('munchkin_thieves_swipe')).toMatchObject({
            id: 'munchkin_thieves_swipe',
            type: 'action',
            abilityTags: ['onPlay'],
        });
        expect(validate(makeMatchState(state), command)).toEqual({ valid: true });

        const result = runCommand(makeMatchState(state), command, fixedRandom);
        const drawEvent = result.events.find((event): event is MunchkinTreasuresDrawnEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN
        );

        expect(result.success).toBe(true);
        expect(drawEvent?.payload).toMatchObject({
            playerId: '0',
            count: 1,
            reason: 'munchkin_thieves_swipe',
            sourceCardUid: 'swipe-1',
            sourceDefId: 'munchkin_thieves_swipe',
        });
        expect(result.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1910',
            defId: 'munchkin_treasure_wishing_ring',
        }));
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toContain('swipe-1');
        expect(result.finalState.core.treasureDeck).toEqual(['munchkin_treasure_spiky_boots']);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('扒手打出时只有同基地已有另一个扒手才抽宝藏，自己不算另一个', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [makeMinion('other-pickpocket', 'munchkin_thieves_pickpocket', '1', 2)],
                }),
            ],
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            nextUid: 1920,
        });
        state.players['0'] = {
            ...state.players['0'],
            hand: [makeCard('pickpocket-1', 'munchkin_thieves_pickpocket', 'minion', '0')],
            minionsPlayed: 0,
            minionLimit: 1,
        };

        expect(getCardDef('munchkin_thieves_pickpocket')).toMatchObject({
            id: 'munchkin_thieves_pickpocket',
            type: 'minion',
            abilityTags: ['onPlay'],
        });
        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'pickpocket-1', baseIndex: 0 },
        } as const, fixedRandom);
        const drawEvent = result.events.find((event): event is MunchkinTreasuresDrawnEvent =>
            event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN
        );

        expect(result.success).toBe(true);
        expect(drawEvent?.payload).toMatchObject({
            playerId: '0',
            count: 1,
            reason: 'munchkin_thieves_pickpocket',
            sourceCardUid: 'pickpocket-1',
            sourceDefId: 'munchkin_thieves_pickpocket',
        });
        expect(result.finalState.core.players['0'].hand).toContainEqual(expect.objectContaining({
            uid: 'munchkin_treasure_1920',
            defId: 'munchkin_treasure_wishing_ring',
        }));
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'other-pickpocket',
            'pickpocket-1',
        ]);

        const soloState = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            treasureDeck: ['munchkin_treasure_wishing_ring'],
            nextUid: 1930,
        });
        soloState.players['0'] = {
            ...soloState.players['0'],
            hand: [makeCard('solo-pickpocket', 'munchkin_thieves_pickpocket', 'minion', '0')],
            minionsPlayed: 0,
            minionLimit: 1,
        };
        const solo = runCommand(makeMatchState(soloState), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'solo-pickpocket', baseIndex: 0 },
        } as const, fixedRandom);

        expect(solo.success).toBe(true);
        expect(solo.events.some(event => event.type === SU_EVENTS.MUNCHKIN_TREASURES_DRAWN)).toBe(false);
        expect(solo.finalState.core.players['0'].hand).toEqual([]);
        expect(solo.finalState.core.treasureDeck).toEqual(['munchkin_treasure_wishing_ring']);
    });

    it('猫咪窃贼展示任意数量手牌宝藏并按数量给自己 +1 指示物，也允许空选', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_mines' })],
            players: {
                '0': {
                    ...makeState().players['0'],
                    hand: [
                        makeCard('cat-1', 'munchkin_thieves_cat_burglar', 'minion', '0'),
                        makeCard('treasure-1', 'munchkin_treasure_wishing_ring', 'action', '0'),
                        makeCard('treasure-2', 'munchkin_treasure_dwarf_hireling', 'minion', '0'),
                        makeCard('normal-1', 'alien_invader', 'minion', '0'),
                    ],
                    minionsPlayed: 0,
                    minionLimit: 1,
                },
                '1': makeState().players['1'],
            },
        });

        expect(getCardDef('munchkin_thieves_cat_burglar')).toMatchObject({
            id: 'munchkin_thieves_cat_burglar',
            type: 'minion',
            abilityTags: ['onPlay'],
        });
        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'cat-1', baseIndex: 0 },
        } as const, fixedRandom);
        const prompt = getSimpleChoicePrompt(played.finalState, 'munchkin_thieves_cat_burglar_choose_treasures');

        expect(played.success).toBe(true);
        expect(prompt.targetType).toBe('hand');
        expect(prompt.multi).toMatchObject({ min: 0, max: 2 });
        expect(prompt.options.map((option: any) => option.value)).toEqual([
            { cardUid: 'treasure-1', defId: 'munchkin_treasure_wishing_ring' },
            { cardUid: 'treasure-2', defId: 'munchkin_treasure_dwarf_hireling' },
        ]);

        const selected = respondToPromptOptions(
            played.finalState,
            prompt.options.map((option: any) => option.id),
            '0',
            fixedRandom,
        );
        const counterEvents = selected.events.filter((event): event is PowerCounterAddedEvent =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
        );
        const revealEvent = selected.events.find(event => event.type === SU_EVENTS.REVEAL_HAND);

        expect(selected.success).toBe(true);
        expect(revealEvent?.payload).toMatchObject({
            targetPlayerId: '0',
            viewerPlayerId: 'all',
            reason: 'munchkin_thieves_cat_burglar',
        });
        expect(revealEvent?.payload.cards.map((card: any) => card.uid)).toEqual(['treasure-1', 'treasure-2']);
        expect(counterEvents.map(event => event.payload)).toEqual([
            expect.objectContaining({
                minionUid: 'cat-1',
                baseIndex: 0,
                amount: 1,
                reason: 'munchkin_thieves_cat_burglar',
                sourceCardUid: 'cat-1',
            }),
            expect.objectContaining({
                minionUid: 'cat-1',
                baseIndex: 0,
                amount: 1,
                reason: 'munchkin_thieves_cat_burglar',
                sourceCardUid: 'cat-1',
            }),
        ]);
        expect(selected.finalState.core.bases[0].minions[0].powerCounters).toBe(2);
        expect(selected.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'treasure-1',
            'treasure-2',
            'normal-1',
        ]);

        const skippedStart = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'cat-1', baseIndex: 0 },
        } as const, fixedRandom);
        const skipped = respondToPromptOptions(skippedStart.finalState, [], '0', fixedRandom);

        expect(skipped.success).toBe(true);
        expect(skipped.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
        expect(skipped.events.some(event => event.type === SU_EVENTS.REVEAL_HAND)).toBe(false);
        expect(skipped.finalState.core.bases[0].minions[0].powerCounters ?? 0).toBe(0);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'treasure-1',
            'treasure-2',
            'normal-1',
        ]);
    });
});
