import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { triggerBaseAbility } from '../../domain/baseAbilities';
import { getEffectiveBreakpoint, getEffectivePower } from '../../domain/ongoingModifiers';
import { interceptEvent, isMinionProtected } from '../../domain/ongoingEffects';
import { reduce } from '../../domain/reduce';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    getPromptOption,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
} from '../helpers';
import { runCommand } from '../testRunner';

const FIXED_RANDOM = {
    shuffle: <T>(items: T[]) => [...items],
    random: () => 0,
};

describe('Magical Girls 代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('Coronet Attack 消灭力量不高于本基地己方随从数量的敌方随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('coronet', 'magical_girls_coronet_attack', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_akihabara_high', [
                makeMinion('ally-1', 'magical_girls_power_maid', '0', 3),
                makeMinion('ally-2', 'magical_girls_white_magicat', '0', 1),
                makeMinion('enemy-low', 'itty_critters_flooffairy', '1', 2),
                makeMinion('enemy-high', 'kaiju_kaijookey', '1', 4),
            ])],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'coronet', targetBaseIndex: 0, targetMinionUid: 'enemy-low' },
            timestamp: 10,
        }, FIXED_RANDOM);

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['ally-1', 'ally-2', 'enemy-high']);
    });

    it('Magical Staff 给附着随从 +1，随附着随从离场时改放牌库顶', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_akihabara_high', [
                makeMinion('maid', 'magical_girls_power_maid', '0', 3, {
                    attachedActions: [{ uid: 'staff', defId: 'magical_girls_magical_staff', ownerId: '0' }],
                }),
            ])],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(4);

        const detached = {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: { cardUid: 'staff', defId: 'magical_girls_magical_staff', ownerId: '0', reason: 'minion_destroy' },
            timestamp: 21,
        } as any;
        const intercepted = interceptEvent(core, detached);
        expect(intercepted).toMatchObject({ type: SU_EVENTS.CARD_TO_DECK_TOP });
        const top = reduce(core, intercepted as any);

        expect(top.players['0'].deck[0]?.uid).toBe('staff');
        expect(top.players['0'].discard.some(card => card.uid === 'staff')).toBe(false);
    });

    it('Fancy Suit Lad 保护本基地其他己方随从不受其他玩家影响，但不保护自身', () => {
        const core = makeState({
            bases: [makeBase('base_q_point', [
                makeMinion('fancy', 'magical_girls_fancy_suit_lad', '0', 3),
                makeMinion('ally', 'magical_girls_power_maid', '0', 3),
            ])],
        });

        expect(isMinionProtected(core, core.bases[0].minions[1], 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(core, core.bases[0].minions[0], 0, '1', 'affect')).toBe(false);
    });

    it('Fancy Suit Lad 会拦截其他玩家卡牌带来的减力量持续效果', () => {
        const core = makeState({
            bases: [makeBase('base_q_point', [
                makeMinion('fancy', 'magical_girls_fancy_suit_lad', '0', 3),
                makeMinion('ally', 'magical_girls_power_maid', '0', 3, {
                    attachedActions: [{ uid: 'enemy-grump', defId: 'kitty_cats_grumpiness', ownerId: '1' }],
                }),
            ])],
        });

        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(3);
    });

    it('Rainbow Girl 与 Akihabara High 给同基地其他己方随从临时 +1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('rainbow', 'magical_girls_rainbow_girl', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_akihabara_high', [makeMinion('ally', 'magical_girls_power_maid', '0', 3)])],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'rainbow', baseIndex: 0 },
            timestamp: 30,
        }, FIXED_RANDOM);

        const ally = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally')!;
        expect(ally.tempPowerModifier).toBe(2);
        expect(getEffectivePower(play.finalState.core, ally, 0)).toBe(5);
    });

    it('Kiss the Sky Spell 回收弃牌堆随从并给一个额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('kiss', 'magical_girls_kiss_the_sky_spell', 'action', '0')],
                    discard: [makeCard('maid', 'magical_girls_power_maid', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'kiss' },
            timestamp: 40,
        }, FIXED_RANDOM);

        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toContain('maid');
        expect(result.finalState.core.players['0'].actionLimit).toBe(2);
    });

    it('Silver Shard 将所有玩家弃牌堆随从洗回牌库并保留非随从弃牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('shard', 'magical_girls_silver_shard', 'action', '0')],
                    deck: [makeCard('deck-0', 'magical_girls_white_magicat', 'minion', '0')],
                    discard: [
                        makeCard('discard-minion-0', 'magical_girls_power_maid', 'minion', '0'),
                        makeCard('discard-action-0', 'magical_girls_coordination', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [],
                    discard: [makeCard('discard-minion-1', 'magical_girls_lunar_captain', 'minion', '1')],
                }),
            },
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'shard' },
            timestamp: 50,
        }, FIXED_RANDOM);

        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-0', 'discard-minion-0']);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-action-0', 'shard']);
        expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['discard-minion-1']);
        expect(result.finalState.core.players['1'].discard).toHaveLength(0);
    });

    it('White Magicat / Black Magicat 从牌库或弃牌堆找对应随从加入手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    minionLimit: 2,
                    hand: [
                        makeCard('white', 'magical_girls_white_magicat', 'minion', '0'),
                        makeCard('black', 'magical_girls_black_magicat', 'minion', '0'),
                    ],
                    deck: [makeCard('maid', 'magical_girls_power_maid', 'minion', '0')],
                    discard: [makeCard('captain', 'magical_girls_lunar_captain', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_akihabara_high')],
        });

        const white = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'white', baseIndex: 0 },
            timestamp: 60,
        }, FIXED_RANDOM);
        expect(white.finalState.core.players['0'].hand.map(card => card.uid)).toContain('maid');

        const black = runCommand(white.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'black', baseIndex: 0 },
            timestamp: 61,
        }, FIXED_RANDOM);
        expect(black.finalState.core.players['0'].hand.map(card => card.uid)).toContain('captain');
    });

    it('Lunar Captain、Technomagical Lass、Bewitching Gal、Sakura Warrior 的数量缩放天赋生效', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { discard: [makeCard('recover', 'magical_girls_power_maid', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_q_point', [
                makeMinion('captain', 'magical_girls_lunar_captain', '0', 5),
                makeMinion('lass', 'magical_girls_technomagical_lass', '0', 4),
                makeMinion('gal', 'magical_girls_bewitching_gal', '0', 3),
                makeMinion('sakura', 'magical_girls_sakura_warrior', '0', 4),
                makeMinion('enemy', 'itty_critters_flooffairy', '1', 2),
            ])],
        });

        const captain = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'captain', baseIndex: 0 },
            timestamp: 70,
        }, FIXED_RANDOM);
        getSimpleChoicePrompt(captain.finalState, 'magical_girls_lunar_captain');
        const recovered = respondToPromptOption(captain.finalState, option => option.value?.cardUid === 'recover', 'Power Maid', '0', FIXED_RANDOM);
        expect(recovered.finalState.core.players['0'].hand.map(card => card.uid)).toContain('recover');

        const lass = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'lass', baseIndex: 0 },
            timestamp: 71,
        }, FIXED_RANDOM);
        expect(lass.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy')).toBe(false);

        const gal = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'gal', baseIndex: 0 },
            timestamp: 72,
        }, FIXED_RANDOM);
        expect(getEffectiveBreakpoint(gal.finalState.core, 0)).toBe(21);

        const sakura = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'sakura', baseIndex: 0 },
            timestamp: 73,
        }, FIXED_RANDOM);
        const lowered = respondToPromptOption(sakura.finalState, option => option.value?.minionUid === 'enemy', 'enemy', '0', FIXED_RANDOM);
        const enemy = lowered.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy')!;
        expect(enemy.powerModifier).toBe(-4);
        expect(lowered.finalState.core.timedPowerModifiers?.[0]).toMatchObject({ minionUid: 'enemy', amount: -4 });
    });

    it('Purge the Demon 可摧毁行动牌或移除全部力量指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('purge', 'magical_girls_purge_the_demon', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_q_point',
                ongoingActions: [{ uid: 'enemy-action', defId: 'kaiju_stomp', ownerId: '1' }],
                minions: [makeMinion('countered', 'magical_girls_power_maid', '0', 3, { powerCounters: 2 })],
            })],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'purge' },
            timestamp: 80,
        }, FIXED_RANDOM);
        const prompt = getSimpleChoicePrompt(play.finalState, 'magical_girls_purge_the_demon');
        expect(prompt.targetType).toBe('board');
        expect(getPromptOption(prompt, option => option.value?.cardUid === 'enemy-action')).toBeDefined();

        const removeCounters = respondToPromptOption(play.finalState, option => option.value?.minionUid === 'countered', 'countered', '0', FIXED_RANDOM);
        expect(removeCounters.finalState.core.bases[0].minions[0].powerCounters).toBe(0);
    });

    it('Celestial Teleport、Coordination、Power Maid 提供移动和额外打出入口', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [
                    makeCard('teleport', 'magical_girls_celestial_teleport', 'action', '0'),
                    makeCard('coordination', 'magical_girls_coordination', 'action', '0'),
                ] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_akihabara_high', [
                    makeMinion('maid', 'magical_girls_power_maid', '0', 3),
                    makeMinion('ally', 'magical_girls_white_magicat', '0', 1),
                    makeMinion('target', 'itty_critters_flooffairy', '1', 2),
                ]),
                makeBase('base_q_point'),
            ],
        });

        const teleport = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'teleport', targetBaseIndex: 0, targetMinionUid: 'maid' },
            timestamp: 90,
        }, FIXED_RANDOM);
        expect(teleport.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('maid');

        const coordination = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'coordination' },
            timestamp: 91,
        }, FIXED_RANDOM);
        expect(coordination.finalState.core.players['0'].minionLimit).toBe(2);

        const maid = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'maid', baseIndex: 0 },
            timestamp: 92,
        }, FIXED_RANDOM);
        const moved = respondToPromptOption(maid.finalState, option => option.value?.minionUid === 'target', 'target', '0', FIXED_RANDOM);
        expect(moved.finalState.core.bases[0].minions.some(minion => minion.uid === 'target')).toBe(false);
        expect(moved.finalState.core.bases[1].minions.some(minion => minion.uid === 'target')).toBe(true);
    });

    it('Power Maid 从当前基地移走随从时有多个目的基地必须由玩家选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_akihabara_high', [
                    makeMinion('maid', 'magical_girls_power_maid', '0', 3),
                    makeMinion('ally', 'magical_girls_white_magicat', '0', 1),
                    makeMinion('enemy-low', 'itty_critters_flooffairy', '1', 2),
                ]),
                makeBase('base_q_point'),
                makeBase('base_mermaid_pool'),
            ],
        });

        const maid = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'maid', baseIndex: 0 },
            timestamp: 93,
        }, FIXED_RANDOM);
        const selectedMinion = respondToPromptOption(maid.finalState, option => option.value?.minionUid === 'ally', 'ally', '0', FIXED_RANDOM);
        const destinationPrompt = getSimpleChoicePrompt(selectedMinion.finalState, 'magical_girls_power_maid_destination');
        expect(destinationPrompt.targetType).toBe('base');
        expect(getPromptOption(destinationPrompt, option => option.value?.baseIndex === 1, 'second base destination')).toBeDefined();
        expect(getPromptOption(destinationPrompt, option => option.value?.baseIndex === 2, 'third base destination')).toBeDefined();

        const moved = respondToPromptOption(selectedMinion.finalState, option => option.value?.baseIndex === 2, 'third base', '0', FIXED_RANDOM);
        expect(moved.finalState.core.bases[0].minions.some(minion => minion.uid === 'ally')).toBe(false);
        expect(moved.finalState.core.bases[1].minions.some(minion => minion.uid === 'ally')).toBe(false);
        expect(moved.finalState.core.bases[2].minions.some(minion => minion.uid === 'ally')).toBe(true);
    });

    it('Coordination 在 borrowed setaside Walking Castle 上仍应给当前控制者提供泰坦进场分支，并保留真实 owner', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('coordination', 'magical_girls_coordination', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_akihabara_high', [
                makeMinion('ally-1', 'magical_girls_power_maid', '0', 3),
                makeMinion('ally-2', 'magical_girls_white_magicat', '0', 1),
            ])],
            titans: [{
                uid: 'borrowed-castle',
                defId: 'magical_girls_walking_castle',
                faction: 'magical_girls',
                ownerId: '1',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'coordination' },
            timestamp: 93,
        }, FIXED_RANDOM);

        const prompt = getSimpleChoicePrompt(play.finalState, 'magical_girls_coordination');
        const castleOption = getPromptOption(prompt, option => option.value?.choice === 'walking_castle', 'Coordination Walking Castle option');
        const resolved = respondToPromptOption(play.finalState, option => option.id === castleOption.id, 'walking castle', '0', FIXED_RANDOM);

        expect(resolved.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(true);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'borrowed-castle')).toMatchObject({
            ownerId: '1',
            controllerId: '0',
            location: {
                zone: 'base',
                baseIndex: 0,
            },
        });
    });

    it('Q Point 计分前让每位玩家保留一张牌并摧毁其余牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_q_point',
                minions: [
                    makeMinion('keep-0', 'magical_girls_power_maid', '0', 3),
                    makeMinion('lose-0', 'magical_girls_white_magicat', '0', 1),
                    makeMinion('keep-1', 'itty_critters_leafaroo', '1', 2),
                    makeMinion('lose-1', 'itty_critters_flooffairy', '1', 2),
                ],
                ongoingActions: [{ uid: 'lose-action-0', defId: 'kaiju_stomp', ownerId: '0' }],
            })],
        });

        const result = triggerBaseAbility('base_q_point', 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            baseIndex: 0,
            baseDefId: 'base_q_point',
            playerId: '0',
            now: 100,
        });

        const firstPrompt = getSimpleChoicePrompt(result.matchState!, 'base_q_point');
        expect(firstPrompt.targetType).toBe('board');
        expect(getPromptOption(firstPrompt, option => option.value?.minionUid === 'keep-0', 'keep-0 board option')).toBeDefined();
        expect(getPromptOption(firstPrompt, option => option.value?.cardUid === 'lose-action-0', 'lose-action-0 board option')).toBeDefined();

        const keepFirst = respondToPromptOption(result.matchState!, option => option.value?.minionUid === 'keep-0', 'keep-0', '0', FIXED_RANDOM);
        const secondPrompt = getSimpleChoicePrompt(keepFirst.finalState, 'base_q_point');
        expect(secondPrompt.targetType).toBe('board');
        const keepSecond = respondToPromptOption(keepFirst.finalState, option => option.value?.minionUid === 'keep-1', 'keep-1', '1', FIXED_RANDOM);

        expect(keepSecond.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['keep-0', 'keep-1']);
        expect(keepSecond.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(expect.arrayContaining(['lose-0', 'lose-action-0']));
        expect(keepSecond.finalState.core.players['1'].discard.map(card => card.uid)).toContain('lose-1');
    });
});
