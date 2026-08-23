/**
 * 大杀四方 - 远古之物派系能力测试
 *
 * 覆盖：
 * - elder_thing_byakhee（拜亚基）：每位在这里有随从的对手抽疯狂卡
 * - elder_thing_mi_go（米-格）：对手抽疯狂卡或你抽牌
 * - elder_thing_insanity（精神错乱）：对手各抽两张疯狂卡
 * - elder_thing_touch_of_madness（疯狂接触）：对手抽疯狂卡 + 你抽牌 + 额外行动
 * - elder_thing_power_of_madness（疯狂之力）：对手弃疯狂卡并洗弃牌堆回牌库
 * - elder_thing_spreading_horror（散播恐怖）：对手随机弃牌直到弃出非疯狂卡
 * - elder_thing_begin_the_summoning（开始召唤）：弃牌堆随从放牌库顶 + 额外行动
 * - elder_thing_unfathomable_goals（深不可测的目的）：有疯狂卡的对手消灭随从
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID } from '../../domain/types';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import type {
    SmashUpCore,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    CardInstance,
    CardToDeckBottomEvent,
} from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers, isMinionProtected } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry, getEffectivePower } from '../../domain/ongoingModifiers';
import { reduce } from '../../domain/reducer';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import { validate } from '../../domain/commands';
import {
    expectNoPrompt,
    getFirstPrompt,
    getPromptHandlerData,
    getPromptOption,
    getPromptOptions,
    getPromptPlayerId,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeMatchState as makeMatchStateFromHelpers,
    makeBase as helperMakeBase,
    makeMinion as helperMakeMinion,
    respondToPromptOption,
    respondCommand,
} from '../helpers';
import { runCommand } from '../testRunner';
import type { MatchState, RandomFn } from '../../../../engine/types';
import { executeTriggerProgramExecutor } from '../../domain/triggerExecutors';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('elder thing extra timing regression coverage', () => {
    it('elder_thing_touch_of_madness marks off-phase extra action as immediate', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        ms.sys.phase = 'startTurn';
        const result = invokeRegisteredAbilityContract('elder_thing_touch_of_madness', 'onPlay', {
            state,
            matchState: ms,
            playerId: '0',
            cardUid: 'a1',
            defId: 'elder_thing_touch_of_madness',
            baseIndex: 0,
            random: defaultRandom,
            now: 0,
        });

        const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
        expect((limitEvents[0] as any).payload.playTiming).toBe('immediate');
    });

    it('elder_thing_begin_the_summoning marks empty-discard off-phase extra action as immediate', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('disc1', 'test_action', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        ms.sys.phase = 'startTurn';
        const result = invokeRegisteredAbilityContract('elder_thing_begin_the_summoning', 'onPlay', {
            state,
            matchState: ms,
            playerId: '0',
            cardUid: 'a1',
            defId: 'elder_thing_begin_the_summoning',
            baseIndex: 0,
            random: defaultRandom,
            now: 0,
        });

        const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
        expect((limitEvents[0] as any).payload.playTiming).toBe('immediate');
    });
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number, owner?: string): MinionOnBase {
    return {
        uid, defId, controller, owner: owner ?? controller,
        basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.ELDER_THINGS, 'test_b'] as [string, string],
        ...overrides,
    };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        madnessDeck: Array.from({ length: 10 }, (_, i) => `madness_base_${i}`),
        ...overrides,
    };
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return makeMatchStateFromHelpers(core);
}

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number, random?: RandomFn): SmashUpEvent[] {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_MINION, playerId,
        payload: { cardUid, baseIndex },
    } as any, random ?? defaultRandom);
    return result.events as SmashUpEvent[];
}

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn): SmashUpEvent[] {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
    return result.events as SmashUpEvent[];
}

function runPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn) {
    const matchState = makeMatchState(state);
    const result = runCommand(matchState, {
        type: SU_COMMANDS.PLAY_ACTION,
        playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function attachBeforeScoringWindow(core: ReturnType<typeof makeState>, sourceBaseIndex = 0, activePlayerId = '0') {
    const matchState = startSmashUpReactionSession(makeMatchState(core), {
        frameId: `score-before:${sourceBaseIndex}:test`,
        frameKind: 'score-before',
        phase: 'optional',
        activePlayerId,
        currentPlayerId: activePlayerId,
        consecutivePasses: 0,
        sourceBaseIndex,
        responseWindowType: 'meFirst',
    });
    matchState.sys.phase = 'scoreBases';
    matchState.sys.responseWindow = { ...(matchState.sys.responseWindow ?? {}), current: undefined } as any;
    return matchState as any;
}

// ============================================================================
// 拜亚基
// ============================================================================

describe('远古之物派系能力', () => {
    describe('elder_thing_byakhee（拜亚基：每位在这里有随从的对手抽疯狂卡）', () => {
        it('基地有一位对手随从时，该对手抽一张疯狂卡', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'elder_thing_byakhee', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('opp1', 'test', '1', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.playerId).toBe('1');
            expect((madnessEvents[0] as any).payload.count).toBe(1);
        });

        it('三人局中只有 P2 在该基地有随从时，P2 抽一张疯狂卡', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'elder_thing_byakhee', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                    '2': makePlayer('2'),
                },
                turnOrder: ['0', '1', '2'],
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('opp2', 'test', '2', 3)],
                    ongoingActions: [],
                }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.playerId).toBe('2');
            expect((madnessEvents[0] as any).payload.count).toBe(1);
        });

        it('三人局中两位对手都在该基地有随从时，两位对手各抽一张疯狂卡', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'elder_thing_byakhee', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                    '2': makePlayer('2'),
                },
                turnOrder: ['0', '1', '2'],
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('opp1', 'test', '1', 3), makeMinion('opp2', 'test', '2', 2)],
                    ongoingActions: [],
                }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(2);
            expect(madnessEvents.map(e => (e as any).payload.playerId)).toEqual(['1', '2']);
            expect(madnessEvents.map(e => (e as any).payload.count)).toEqual([1, 1]);
        });

        it('基地无对手随从时不抽疯狂卡', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'elder_thing_byakhee', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(0);
        });

        it('疯狂牌库为空时不抽', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'elder_thing_byakhee', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('opp1', 'test', '1', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                }],
                madnessDeck: [],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(0);
        });
    });

    describe('elder_thing_mi_go（米-格：对手抽疯狂卡或你抽牌）', () => {
        it('创建交互让对手选择是否抽疯狂卡', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'elder_thing_mi_go', 'minion', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'm1', baseIndex: 0 },
            } as any, defaultRandom);

            expect(played.success, played.error).toBe(true);
            const prompt = getSimpleChoicePrompt(played.finalState, 'elder_thing_mi_go');
            expect(getPromptSourceId(prompt)).toBe('elder_thing_mi_go');
            expect(prompt.playerId).toBe('1'); // 对手选择
            expect(getPromptTargetType(prompt)).toBe('button');
        });

        it('对手选择抽疯狂卡时产生疯狂卡事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'elder_thing_mi_go', 'minion', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });
            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'm1', baseIndex: 0 },
            } as any, defaultRandom);

            expect(played.success, played.error).toBe(true);
            const prompt = getSimpleChoicePrompt(played.finalState, 'elder_thing_mi_go');
            expect(getPromptSourceId(prompt)).toBe('elder_thing_mi_go');
            const result = respondToPromptOption(
                played.finalState,
                option => option.value?.choice === 'draw_madness',
                'elder thing mi-go draw madness option',
                '1',
                defaultRandom,
            );
            expect(result).toBeDefined();
            const madnessEvents = result!.events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.playerId).toBe('1');
        });

        it('对手拒绝时施法者抽一张牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'elder_thing_mi_go', 'minion', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });
            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'm1', baseIndex: 0 },
            } as any, defaultRandom);

            expect(played.success, played.error).toBe(true);
            const prompt = getSimpleChoicePrompt(played.finalState, 'elder_thing_mi_go');
            expect(getPromptSourceId(prompt)).toBe('elder_thing_mi_go');
            const result = respondToPromptOption(
                played.finalState,
                option => option.value?.choice === 'decline',
                'elder thing mi-go decline option',
                '1',
                defaultRandom,
            );
            expect(result).toBeDefined();
            const drawEvents = result!.events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            const selfDraw = drawEvents.filter(e => (e as any).payload.playerId === '0');
            expect(selfDraw.length).toBe(1);
        });
    });

    describe('elder_thing_insanity（精神错乱：对手各抽两张疯狂卡）', () => {
        it('每个对手抽两张疯狂卡', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_insanity', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.playerId).toBe('1');
            expect((madnessEvents[0] as any).payload.count).toBe(2);
        });

        it('多个对手各抽两张', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_insanity', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                    '2': makePlayer('2'),
                },
                turnOrder: ['0', '1', '2'],
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(2);
            expect((madnessEvents[0] as any).payload.playerId).toBe('1');
            expect((madnessEvents[1] as any).payload.playerId).toBe('2');
        });
    });

    describe('elder_thing_touch_of_madness（疯狂接触）', () => {
        it('对手抽疯狂卡 + 你抽牌 + 额外行动', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_touch_of_madness', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);

            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.playerId).toBe('1');
            expect(drawEvents.length).toBe(1);
            expect((drawEvents[0] as any).payload.playerId).toBe('0');
            expect(limitEvents.length).toBe(1);
            expect((limitEvents[0] as any).payload.limitType).toBe('action');
        });
    });

    describe('elder_thing_power_of_madness（疯狂之力：弃疯狂卡+洗牌库）', () => {
        it('对手弃掉手牌中的疯狂卡并洗弃牌堆回牌库', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_power_of_madness', 'action', '0')],
                    }),
                    '1': makePlayer('1', {
                        hand: [
                            makeCard('h1', MADNESS_CARD_DEF_ID, 'action', '1'),
                            makeCard('h2', 'test_card', 'minion', '1'),
                            makeCard('h3', MADNESS_CARD_DEF_ID, 'action', '1'),
                        ],
                        discard: [makeCard('d1', 'old_card', 'action', '1')],
                    }),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            const reshuffleEvents = events.filter(e => e.type === SU_EVENTS.DECK_RESHUFFLED);

            // 应弃掉2张疯狂卡
            expect(discardEvents.length).toBe(1);
            expect((discardEvents[0] as any).payload.cardUids.length).toBe(2);
            // 应洗弃牌堆回牌库
            expect(reshuffleEvents.length).toBe(1);
            expect((reshuffleEvents[0] as any).payload.playerId).toBe('1');
        });

        it('对手无疯狂卡但有弃牌堆时仍洗回牌库', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_power_of_madness', 'action', '0')],
                    }),
                    '1': makePlayer('1', {
                        hand: [makeCard('h1', 'test_card', 'minion', '1')],
                        discard: [makeCard('d1', 'old_card', 'action', '1')],
                    }),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            const reshuffleEvents = events.filter(e => e.type === SU_EVENTS.DECK_RESHUFFLED);

            expect(discardEvents.length).toBe(0);
            expect(reshuffleEvents.length).toBe(1);
        });
    });

    describe('elder_thing_spreading_horror（散播恐怖）', () => {
        it('对手随机弃牌直到弃出非疯狂卡', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_spreading_horror', 'action', '0')],
                    }),
                    '1': makePlayer('1', {
                        hand: [
                            makeCard('h1', MADNESS_CARD_DEF_ID, 'action', '1'),
                            makeCard('h2', MADNESS_CARD_DEF_ID, 'action', '1'),
                            makeCard('h3', 'test_card', 'minion', '1'),
                        ],
                    }),
                },
            });

            // shuffle 不改变顺序（defaultRandom），所以弃 h1(madness) → h2(madness) → h3(非madness) 停止
            const events = execPlayAction(state, '0', 'a1');
            const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvents.length).toBe(1);
            expect((discardEvents[0] as any).payload.cardUids.length).toBe(3);
        });

        it('对手手牌为空时无事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_spreading_horror', 'action', '0')],
                    }),
                    '1': makePlayer('1', { hand: [] }),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvents.length).toBe(0);
        });

        it('对手只有非疯狂卡时只弃一张', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_spreading_horror', 'action', '0')],
                    }),
                    '1': makePlayer('1', {
                        hand: [makeCard('h1', 'test_card', 'minion', '1')],
                    }),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvents.length).toBe(1);
            expect((discardEvents[0] as any).payload.cardUids).toEqual(['h1']);
        });
    });

    describe('elder_thing_begin_the_summoning（开始召唤）', () => {
        it('单个弃牌堆随从时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_begin_the_summoning', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                        discard: [
                            makeCard('disc1', 'test_minion', 'minion', '0'),
                            makeCard('disc2', 'test_action', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const result = runPlayAction(state, '0', 'a1');
            const prompt = getSimpleChoicePrompt(result.matchState, 'elder_thing_begin_the_summoning');
            expect(getPromptSourceId(prompt)).toBe('elder_thing_begin_the_summoning');
        });

        it('弃牌堆无随从时只给额外行动', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_begin_the_summoning', 'action', '0')],
                        discard: [makeCard('disc1', 'test_action', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const reshuffleEvents = events.filter(e => e.type === SU_EVENTS.DECK_RESHUFFLED);
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);

            expect(reshuffleEvents.length).toBe(0);
            expect(limitEvents.length).toBe(1);
        });

        it('授予的额外战术额度会被后续打出的疯狂卡正常消耗', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('begin', 'elder_thing_begin_the_summoning', 'action', '0'),
                            makeCard('mad-1', MADNESS_CARD_DEF_ID, 'action', '0'),
                            makeCard('mad-2', MADNESS_CARD_DEF_ID, 'action', '0'),
                        ],
                        discard: [makeCard('disc-minion', 'test_minion', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const playBegin = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'begin' },
            } as any, defaultRandom);
            expect(playBegin.success).toBe(true);

            const beginPrompt = getSimpleChoicePrompt(playBegin.finalState, 'elder_thing_begin_the_summoning');
            expect(getPromptSourceId(beginPrompt)).toBe('elder_thing_begin_the_summoning');

            const beginOption = getPromptOption(beginPrompt, () => true, 'begin the summoning option');
            const resolveBegin = runCommand(playBegin.finalState, respondCommand(beginOption.id, '0'), defaultRandom);
            expect(resolveBegin.success).toBe(true);
            expect(resolveBegin.finalState.core.players['0'].actionsPlayed).toBe(1);
            expect(resolveBegin.finalState.core.players['0'].actionLimit).toBe(2);

            const playMadness = runCommand(resolveBegin.finalState, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'mad-1' },
            } as any, defaultRandom);
            expect(playMadness.success).toBe(true);

            const madnessPrompt = getSimpleChoicePrompt(playMadness.finalState, 'special_madness');
            expect(getPromptSourceId(madnessPrompt)).toBe('special_madness');

            const returnMadnessOption = getPromptOption(
                madnessPrompt,
                (option: any) => option.value?.action === 'return',
                'return madness option',
            );
            const consumeMadness = runCommand(playMadness.finalState, respondCommand(returnMadnessOption.id, '0'), defaultRandom);
            expect(consumeMadness.success).toBe(true);
            expect(consumeMadness.finalState.core.players['0'].actionsPlayed).toBe(2);
            expect(consumeMadness.finalState.core.players['0'].actionLimit).toBe(2);

            const playSecondMadness = runCommand(consumeMadness.finalState, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'mad-2' },
            } as any, defaultRandom);
            expect(playSecondMadness.success).toBe(false);
            expect(playSecondMadness.error).toContain('本回合行动额度已用完');
        });
    });

describe('elder_thing_unfathomable_goals（深不可测的目的）', () => {
        it('有疯狂卡的对手多个随从时创建 Prompt，且先展示手牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_unfathomable_goals', 'action', '0')],
                    }),
                    '1': makePlayer('1', {
                        hand: [makeCard('h1', MADNESS_CARD_DEF_ID, 'action', '1')],
                    }),
                },
                bases: [{
                    defId: 'b1',
                    minions: [
                        makeMinion('m1', 'test', '1', 2, { powerModifier: 0 }),
                        makeMinion('m2', 'test', '1', 5),
                    ],
                    ongoingActions: [],
                }],
            });

            const { events, matchState } = runPlayAction(state, '0', 'a1');
            // 展示对手手牌给所有人看
            const revealEvents = events.filter(e => e.type === SU_EVENTS.REVEAL_HAND);
            expect(revealEvents.length).toBe(1);
            expect((revealEvents[0] as any).payload.targetPlayerId).toBe('1');
            expect((revealEvents[0] as any).payload.viewerPlayerId).toBe('all');
            const prompt = getSimpleChoicePrompt(matchState, 'elder_thing_unfathomable_goals');
            expect(getPromptSourceId(prompt)).toBe('elder_thing_unfathomable_goals');
        });

        it('有疯狂卡的对手只有一个随从时也先确认目标，且先展示手牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_unfathomable_goals', 'action', '0')],
                    }),
                    '1': makePlayer('1', {
                        hand: [makeCard('h1', MADNESS_CARD_DEF_ID, 'action', '1')],
                    }),
                },
                bases: [{
                    defId: 'b1',
                    minions: [
                        makeMinion('m1', 'test', '1', 2),
                    ],
                    ongoingActions: [],
                }],
            });

            const { events, matchState } = runPlayAction(state, '0', 'a1');
            // 展示对手手牌
            const revealEvents = events.filter(e => e.type === SU_EVENTS.REVEAL_HAND);
            expect(revealEvents.length).toBe(1);
            expect((revealEvents[0] as any).payload.viewerPlayerId).toBe('all');
            expect(events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);

            const prompt = getSimpleChoicePrompt(matchState, 'elder_thing_unfathomable_goals');
            expect(prompt.autoResolveIfSingle).toBe(false);
            const resolved = runCommand(
                matchState,
                respondCommand(getPromptOption(prompt, option => option.value?.minionUid === 'm1', '深不可测的目的唯一随从候选').id, '1'),
                defaultRandom,
            );
            const destroyEvents = resolved.events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(1);
            expect((destroyEvents[0] as any).payload.minionUid).toBe('m1');
        });

        it('无疯狂卡的对手不受影响，但仍展示手牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_unfathomable_goals', 'action', '0')],
                    }),
                    '1': makePlayer('1', {
                        hand: [makeCard('h1', 'test_card', 'minion', '1')],
                    }),
                },
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '1', 2)],
                    ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            // 即使无疯狂卡也要展示手牌（规则要求）
            const revealEvents = events.filter(e => e.type === SU_EVENTS.REVEAL_HAND);
            expect(revealEvents.length).toBe(1);
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(0);
        });

        it('有疯狂卡但无随从的对手不产生消灭事件，但展示手牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'elder_thing_unfathomable_goals', 'action', '0')],
                    }),
                    '1': makePlayer('1', {
                        hand: [makeCard('h1', MADNESS_CARD_DEF_ID, 'action', '1')],
                    }),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayAction(state, '0', 'a1');
            // 展示手牌
            const revealEvents = events.filter(e => e.type === SU_EVENTS.REVEAL_HAND);
            expect(revealEvents.length).toBe(1);
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(0);
        });
    });
});

// ============================================================================
// 附着 / special / 保护 / onPlay
// ============================================================================

describe('elder_thing_dunwich_horror 附着行动', () => {
    it('附着此卡的随从获得 +5 力量', () => {
        const minion = helperMakeMinion('m1', 'test_minion', '0', 3, { attachedActions: [{ uid: 'dh-1', defId: 'elder_thing_dunwich_horror', ownerId: '0' }] } as any);
        const state = makeState({ bases: [helperMakeBase({ minions: [minion] })] });

        expect(getEffectivePower(state, minion, 0)).toBe(8);
    });

    it('回合结束时消灭附着此卡的随从', () => {
        const minion = helperMakeMinion('m1', 'test_minion', '0', 3, { attachedActions: [{ uid: 'dh-1', defId: 'elder_thing_dunwich_horror', ownerId: '0' }] } as any);
        const state = makeState({ bases: [helperMakeBase({ minions: [minion] })] });

        const { events } = fireTriggers(state, 'onTurnEnd', {
            state,
            playerId: '0',
            random: defaultRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: expect.objectContaining({ minionUid: 'm1', destroyerId: '0' }),
            }),
        );
    });

    it('同一宿主上第一张 Dunwich Horror 不属于当前回合玩家时，不应吞掉后面另一控制者的真实触发', () => {
        const minion = helperMakeMinion('m-mixed-1', 'test_minion', '1', 3, {
            attachedActions: [
                { uid: 'dh-owner-1', defId: 'elder_thing_dunwich_horror', ownerId: '1' },
                { uid: 'dh-owner-0', defId: 'elder_thing_dunwich_horror', ownerId: '0' },
            ],
        } as any);
        const state = makeState({ bases: [helperMakeBase({ minions: [minion] })] });

        const { events } = fireTriggers(state, 'onTurnEnd', {
            state,
            playerId: '0',
            random: defaultRandom,
            now: 1001,
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'm-mixed-1',
                reason: 'elder_thing_dunwich_horror',
                destroyerId: '0',
            }),
        }));
    });
});

describe('elder_thing_the_price_of_power special', () => {
    it('对手在计分基地有随从且手牌有疯狂卡时给己方随从加力量', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [0],
            bases: [
                helperMakeBase('base_the_jungle', [
                    helperMakeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 } as any),
                    helperMakeMinion('e1', 'test_minion', '1', 4, { powerModifier: 0 } as any),
                ]),
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'pop-1', defId: 'elder_thing_the_price_of_power', type: 'action', owner: '0' }],
                }),
                '1': makePlayer('1', {
                    hand: [
                        { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action' as const, owner: '1' },
                        { uid: 'mad2', defId: MADNESS_CARD_DEF_ID, type: 'action' as const, owner: '1' },
                        { uid: 'normal', defId: 'elder_thing_insanity', type: 'action' as const, owner: '1' },
                    ],
                }),
            },
        });
        const result = runCommand(attachBeforeScoringWindow(core, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pop-1', targetBaseIndex: 0 },
        } as any, defaultRandom);

        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);
        expect(result.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.REVEAL_HAND)).toBe(true);
        const powerEvents = result.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(powerEvents).toHaveLength(2);
        expect(powerEvents.every(event => (event as any).payload.amount === 2)).toBe(true);
    });

    it('对手在此基地无随从时打出后不产生额外效果', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [0],
            bases: [helperMakeBase('base_the_jungle', [helperMakeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 } as any)])],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'pop-1', defId: 'elder_thing_the_price_of_power', type: 'action', owner: '0' }],
                }),
                '1': makePlayer('1', {
                    hand: [{ uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action' as const, owner: '1' }],
                }),
            },
        });
        const result = runCommand(attachBeforeScoringWindow(core, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pop-1', targetBaseIndex: 0 },
        } as any, defaultRandom);

        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);
        expect(result.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
        expect(result.events.some(event => event.type === SU_EVENTS.REVEAL_HAND)).toBe(false);
    });

    it('对手手牌无疯狂卡时不触发', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [0],
            bases: [
                helperMakeBase('base_the_jungle', [
                    helperMakeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 } as any),
                    helperMakeMinion('e1', 'test_minion', '1', 4, { powerModifier: 0 } as any),
                ]),
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'pop-1', defId: 'elder_thing_the_price_of_power', type: 'action', owner: '0' }],
                }),
                '1': makePlayer('1', {
                    hand: [{ uid: 'normal', defId: 'elder_thing_insanity', type: 'action' as const, owner: '1' }],
                }),
            },
        });
        const result = runCommand(attachBeforeScoringWindow(core, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pop-1', targetBaseIndex: 0 },
        } as any, defaultRandom);

        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);
        expect(result.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
        const revealEvt = result.events.find(event => event.type === SU_EVENTS.REVEAL_HAND) as any;
        expect(revealEvt?.payload?.targetPlayerId).toBe('1');
    });
});

describe('elder_thing_elder_thing 保护', () => {
    it('对手不能消灭远古之物', () => {
        const elderThing = helperMakeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 } as any);
        const state = makeState({ bases: [helperMakeBase({ minions: [elderThing] })] });

        expect(isMinionProtected(state, elderThing, 0, '1', 'destroy')).toBe(true);
    });

    it('对手不能移动远古之物', () => {
        const elderThing = helperMakeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 } as any);
        const state = makeState({ bases: [helperMakeBase({ minions: [elderThing] })] });

        expect(isMinionProtected(state, elderThing, 0, '1', 'move')).toBe(true);
    });

    it('不阻止己方消灭远古之物', () => {
        const elderThing = helperMakeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 } as any);
        const state = makeState({ bases: [helperMakeBase({ minions: [elderThing] })] });

        expect(isMinionProtected(state, elderThing, 0, '0', 'destroy')).toBe(false);
    });

    it('不保护其他随从', () => {
        const elderThing = helperMakeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 } as any);
        const other = helperMakeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 } as any);
        const state = makeState({ bases: [helperMakeBase({ minions: [elderThing, other] })] });

        expect(isMinionProtected(state, other, 0, '1', 'destroy')).toBe(false);
    });
});

describe('elder_thing_elder_thing onPlay prompt', () => {
    it('不足两个其他随从时仍创建选择 prompt，但消灭选项禁用', () => {
        const state = makeState({
            bases: [helperMakeBase()],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'et-1', defId: 'elder_thing_elder_thing', type: 'minion', owner: '0' }],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'et-1', baseIndex: 0 },
        } as any, defaultRandom);

        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'elder_thing_elder_thing_choice');
        expect(getPromptSourceId(prompt)).toBe('elder_thing_elder_thing_choice');
        expect(getPromptTargetType(prompt)).toBe('button');
        expect(getPromptHandlerData(prompt)?.displayCard).toEqual({ defId: 'elder_thing_elder_thing', cardUid: 'et-1' });
        expect(getPromptOption(prompt, option => option.id === 'destroy')?.disabled).toBe(true);
    });

    it('有两个其他随从时创建可选择 prompt', () => {
        const state = makeState({
            bases: [
                helperMakeBase({
                    minions: [
                        helperMakeMinion('a1', 'test_minion', '0', 3, { powerModifier: 0 } as any),
                        helperMakeMinion('a2', 'test_minion', '0', 3, { powerModifier: 0 } as any),
                    ],
                }),
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'et-1', defId: 'elder_thing_elder_thing', type: 'minion', owner: '0' }],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'et-1', baseIndex: 0 },
        } as any, defaultRandom);

        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'elder_thing_elder_thing_choice');
        expect(getPromptSourceId(prompt)).toBe('elder_thing_elder_thing_choice');
        expect(getPromptTargetType(prompt)).toBe('button');
        expect(getPromptOption(prompt, option => option.id === 'destroy')?.disabled).toBe(false);
    });

    it('CARD_TO_DECK_BOTTOM reducer 会从基地移除随从到牌库底', () => {
        const state = makeState({
            bases: [helperMakeBase({ minions: [helperMakeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 } as any)] })],
        });
        const event: CardToDeckBottomEvent = {
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: {
                cardUid: 'et-1',
                defId: 'elder_thing_elder_thing',
                ownerId: '0',
                reason: 'elder_thing_elder_thing',
            },
            timestamp: 0,
        };

        const next = reduce(state, event);

        expect(next.bases[0].minions).toHaveLength(0);
        expect(next.players['0'].deck[0]).toEqual(expect.objectContaining({ uid: 'et-1' }));
    });
});

describe('elder_thing_shoggoth 打出限制与 onPlay', () => {
    it('己方力量小于 6 的基地不能打出修格斯', () => {
        const shoggothCard: CardInstance = { uid: 'sh-1', defId: 'elder_thing_shoggoth', type: 'minion', owner: '0' };
        const state = makeState({
            bases: [helperMakeBase({ minions: [helperMakeMinion('a1', 'test_minion', '0', 3, { powerModifier: 0 } as any)] })],
            players: {
                '0': makePlayer('0', { hand: [shoggothCard] }),
                '1': makePlayer('1'),
            },
        });

        const result = validate(
            { core: state, sys: { phase: 'playCards' } },
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sh-1', baseIndex: 0 } },
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain('6点力量');
    });

    it('己方力量足够的基地可以打出修格斯', () => {
        const shoggothCard: CardInstance = { uid: 'sh-1', defId: 'elder_thing_shoggoth', type: 'minion', owner: '0' };
        const state = makeState({
            bases: [helperMakeBase({ minions: [helperMakeMinion('big', 'test_minion', '0', 6, { powerModifier: 0 } as any)] })],
            players: {
                '0': makePlayer('0', { hand: [shoggothCard] }),
                '1': makePlayer('1'),
            },
        });

        const result = validate(
            { core: state, sys: { phase: 'playCards' } },
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sh-1', baseIndex: 0 } },
        );

        expect(result.valid).toBe(true);
    });

    it('打出时为第一个对手创建选择 prompt', () => {
        const state = makeState({
            bases: [helperMakeBase({ minions: [helperMakeMinion('big', 'test_minion', '0', 6, { powerModifier: 0 } as any)] })],
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'sh-1', defId: 'elder_thing_shoggoth', type: 'minion', owner: '0' }],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
        });
        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'sh-1', baseIndex: 0 },
        } as any, defaultRandom);

        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'elder_thing_shoggoth_opponent');
        expect(getPromptSourceId(prompt)).toBe('elder_thing_shoggoth_opponent');
        expect(getPromptTargetType(prompt)).toBe('button');
    });

    it('无对手时不产生事件', () => {
        const state = makeState({
            bases: [helperMakeBase({ minions: [helperMakeMinion('big', 'test_minion', '0', 6, { powerModifier: 0 } as any)] })],
            turnOrder: ['0'],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'sh-1', defId: 'elder_thing_shoggoth', type: 'minion', owner: '0' }],
                }),
            },
        });
        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'sh-1', baseIndex: 0 },
        } as any, defaultRandom);

        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toBe(false);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });
});

describe('elder_things_pod 专项行为', () => {
    it('Elder Thing POD：无法消灭两个其他随从时，destroy 选项应被禁用', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('c1', 'elder_thing_elder_thing_pod', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });
        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
            defaultRandom,
        );
        const prompt = getFirstPrompt(play.finalState);
        expect(getPromptSourceId(prompt)).toBe('elder_thing_elder_thing_pod_mode');
        expect(getPromptHandlerData(prompt)?.displayCard).toEqual({ defId: 'elder_thing_elder_thing_pod', cardUid: 'c1' });
        expect(getPromptOption(prompt, option => option.id === 'destroy')?.disabled).toBe(true);
    });

    it('Unfathomable Goals POD：根据展示的疯狂卡快照额外授予随从与行动额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'elder_thing_unfathomable_goals_pod', 'action', '0')] }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '1'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '1'),
                    ],
                }),
                '2': makePlayer('2', {
                    hand: [
                        makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '2'),
                        makeCard('m4', MADNESS_CARD_DEF_ID, 'action', '2'),
                    ],
                }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
            madnessDeck: [],
        });
        const result = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultRandom,
        );

        const limits = result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED) as any[];
        expect(limits.length).toBeGreaterThanOrEqual(2);
    });

    it('Insanity POD：结算后应移出游戏而不是进入弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'elder_thing_insanity_pod', 'action', '0')] }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
            madnessDeck: [
                makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '1'),
                makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '1'),
                makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '2'),
                makeCard('m4', MADNESS_CARD_DEF_ID, 'action', '2'),
            ],
        });
        const result = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultRandom,
        );
        const finalP0 = result.finalState.core.players['0'];
        expect(finalP0.discard.some(card => card.uid === 'a1')).toBe(false);
        expect((finalP0.removedFromGame ?? []).some(card => card.uid === 'a1')).toBe(true);
    });

    it('borrowed Insanity POD resolves into its true owner removed-from-game zone', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('borrowed-insanity-1', 'elder_thing_insanity_pod', 'action', '1')] }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
            madnessDeck: [
                makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '1'),
                makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '1'),
                makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '2'),
                makeCard('m4', MADNESS_CARD_DEF_ID, 'action', '2'),
            ],
        });

        const result = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'borrowed-insanity-1' } },
            defaultRandom,
        );

        const finalP0 = result.finalState.core.players['0'];
        const finalP1 = result.finalState.core.players['1'];
        expect(finalP0.discard.some(card => card.uid === 'borrowed-insanity-1')).toBe(false);
        expect((finalP0.removedFromGame ?? []).some(card => card.uid === 'borrowed-insanity-1')).toBe(false);
        expect(finalP1.discard.some(card => card.uid === 'borrowed-insanity-1')).toBe(false);
        expect((finalP1.removedFromGame ?? []).some(card => card.uid === 'borrowed-insanity-1')).toBe(true);
    });

    it('Mi-Go POD：对手选择前不应提前抽疯狂卡', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('migo', 'elder_thing_mi_go_pod', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
            madnessDeck: [makeCard('md1', MADNESS_CARD_DEF_ID, 'action', '1')],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'migo', baseIndex: 0 } },
            defaultRandom,
        );

        const prompt = getFirstPrompt(played.finalState);
        expect(getPromptSourceId(prompt)).toBe('elder_thing_mi_go_pod');
        expect(played.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        expect(played.finalState.core.players['1'].hand.some(card => card.defId === MADNESS_CARD_DEF_ID)).toBe(false);
    });

    it('Shoggoth POD：目标基地没有对手随从时仍提示对手选择是否抽疯狂卡', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('sho', 'elder_thing_shoggoth_pod', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sho', baseIndex: 0 } },
            defaultRandom,
        );

        const prompt = getFirstPrompt(played.finalState);
        expect(getPromptSourceId(prompt)).toBe('elder_thing_shoggoth_pod');
        expect(getPromptPlayerId(prompt)).toBe('1');
    });

    it('Shoggoth POD：对手拒绝抽疯狂后仍可消灭力量大于 6 的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('sho', 'elder_thing_shoggoth_pod', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('big1', 'zombie_king_rex', '1', 10)],
                    ongoingActions: [],
                },
            ],
            madnessDeck: [
                makeCard('md1', MADNESS_CARD_DEF_ID, 'action', '0'),
                makeCard('md2', MADNESS_CARD_DEF_ID, 'action', '0'),
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sho', baseIndex: 0 } },
            defaultRandom,
        );
        expect(getPromptSourceId(getFirstPrompt(played.finalState))).toBe('elder_thing_shoggoth_pod');

        const afterDecline = runCommand(
            played.finalState,
            respondCommand('no', '1'),
            defaultRandom,
        );
        const destroyPrompt = getFirstPrompt(afterDecline.finalState);
        expect(getPromptSourceId(destroyPrompt)).toBe('elder_thing_shoggoth_pod_destroy');
        expect(getPromptOptions(destroyPrompt).map(option => option.value?.minionUid ?? option.value?.uid)).toContain('big1');

        const targetOption = getPromptOption(
            destroyPrompt,
            option => (option.value?.minionUid ?? option.value?.uid) === 'big1',
            'Shoggoth POD destroy target option',
        );
        const destroyResult = runCommand(
            afterDecline.finalState,
            respondCommand(targetOption.id, '0'),
            defaultRandom,
        );
        expect((destroyResult.events.find(event => event.type === SU_EVENTS.MINION_DESTROYED) as any)?.payload?.minionUid).toBe('big1');
    });

    it('Dunwich Horror POD：打出时不加永久力量，只提供 +5 ongoing 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'elder_thing_dunwich_horror_pod', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'robot_microbot', '0', 3)],
                    ongoingActions: [],
                },
            ],
        });
        const result = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1', targetBaseIndex: 0, targetMinionUid: 'm1' },
            },
            defaultRandom,
        );

        expect(result.events.some(event => event.type === SU_EVENTS.PERMANENT_POWER_ADDED)).toBe(false);
        const minion = result.finalState.core.bases[0].minions.find(candidate => candidate.uid === 'm1');
        expect(minion).toBeTruthy();
        expect(getEffectivePower(result.finalState.core, minion!, 0)).toBe(8);
    });

    it('Dunwich Horror POD：不继承基础版回合结束自动销毁触发器', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [{ defId: 'base_a', minions: [makeMinion('m1', 'robot_microbot', '0', 3)], ongoingActions: [] }],
        });
        const events = executeTriggerProgramExecutor('onTurnEnd', 'elder_thing_dunwich_horror_pod', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            now: 1,
            timing: 'onTurnEnd',
            random: defaultRandom,
        } as any).events;
        expect(events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });

    it('多个 Dunwich Horror POD 走 direct fireTriggers 时，应按每个 source 继续给各自宿主控制者链式抉择 prompt', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [{
                defId: 'base_a',
                minions: [
                    {
                        ...makeMinion('host-p0', 'robot_microbot', '0', 3),
                        attachedActions: [{ uid: 'dh-p0', defId: 'elder_thing_dunwich_horror_pod', ownerId: '0' }],
                    } as any,
                    {
                        ...makeMinion('host-p1', 'robot_microbot_alpha', '1', 2),
                        attachedActions: [{ uid: 'dh-p1', defId: 'elder_thing_dunwich_horror_pod', ownerId: '1' }],
                    } as any,
                ],
                ongoingActions: [],
            }],
        });

        const direct = fireTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: defaultRandom,
            now: 41,
        });

        const firstPrompt = getSimpleChoicePrompt(direct.matchState!, 'elder_thing_dunwich_horror_pod_choice');
        expect(firstPrompt.playerId).toBe('0');

        const afterFirstDraw = respondToPromptOption(
            direct.matchState!,
            option => option.value?.choice === 'draw',
            'first Dunwich Horror POD draw option',
            '0',
            defaultRandom,
        );
        const secondPrompt = getSimpleChoicePrompt(afterFirstDraw.finalState, 'elder_thing_dunwich_horror_pod_choice');
        expect(secondPrompt.playerId).toBe('1');
    });

    it('The Price of Power POD：before scoring 只统计该基地相关玩家并按疯狂卡数加指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'elder_thing_the_price_of_power_pod', 'action', '0')] }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '1'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '1'),
                        makeCard('x1', 'robot_microbot', 'minion', '1'),
                    ],
                }),
                '2': makePlayer('2', { hand: [makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '2')] }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('p0m1', 'robot_microbot', '0', 15),
                        makeMinion('p1m1', 'robot_microbot', '1', 15),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_temple_of_goju',
                    minions: [makeMinion('p0m2', 'robot_microbot', '0', 3)],
                    ongoingActions: [],
                },
            ],
        });

        const ms = attachBeforeScoringWindow(core, 0, '0');

        const result = runCommand(
            ms,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1', targetBaseIndex: 0 } },
            defaultRandom,
        );

        const revealEvent: any = result.events.find(event => event.type === SU_EVENTS.REVEAL_HAND);
        expect(revealEvent?.payload?.targetPlayerId).toBe('1');

        const counters = result.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED) as any[];
        expect(counters).toHaveLength(2);
        expect(counters.every(event => event.payload.amount === 1)).toBe(true);
        expect(counters.every(event => event.payload.reason === 'elder_thing_the_price_of_power_pod')).toBe(true);
    });

    it('The Price of Power POD：非 Me First 窗口时先选基地，再走 runtime prompt 链结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'elder_thing_the_price_of_power_pod', 'action', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '1')] }),
            },
            turnOrder: ['0', '1'],
            bases: [
                { defId: 'base_the_jungle', minions: [], ongoingActions: [] },
                {
                    defId: 'base_temple_of_goju',
                    minions: [
                        makeMinion('p0m1', 'robot_microbot', '0', 3),
                        makeMinion('p1m1', 'robot_microbot', '1', 3),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultRandom,
        );

        const prompt = getFirstPrompt(played.finalState);
        expect(getPromptSourceId(prompt)).toBe('elder_thing_the_price_of_power_pod_choose_base');
        const options = getPromptOptions(prompt);
        expect(options.map(option => option.value?.baseIndex)).toEqual([0, 1]);

        const chooseBase = runCommand(
            played.finalState,
            respondCommand(options[1].id, '0'),
            defaultRandom,
        );

        const revealEvent: any = chooseBase.events.find(event => event.type === SU_EVENTS.REVEAL_HAND);
        expect(revealEvent?.payload?.targetPlayerId).toBe('1');
        const counters = chooseBase.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED) as any[];
        expect(counters).toHaveLength(1);
        expect(counters[0].payload.amount).toBe(1);
        expect(counters[0].payload.reason).toBe('elder_thing_the_price_of_power_pod');
    });

    it('The Price of Power POD：非 Me First 窗口只有一个基地时仍让玩家确认基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'elder_thing_the_price_of_power_pod', 'action', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '1')] }),
            },
            turnOrder: ['0', '1'],
            bases: [{
                defId: 'base_temple_of_goju',
                minions: [
                    makeMinion('p0m1', 'robot_microbot', '0', 3),
                    makeMinion('p1m1', 'robot_microbot', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultRandom,
        );

        const prompt = getFirstPrompt(played.finalState);
        expect(getPromptSourceId(prompt)).toBe('elder_thing_the_price_of_power_pod_choose_base');
        expect(getPromptHandlerData(prompt).autoResolveIfSingle).toBe(false);
        const options = getPromptOptions(prompt);
        expect(options.map(option => option.value?.baseIndex)).toEqual([0]);

        const chooseBase = runCommand(
            played.finalState,
            respondCommand(options[0].id, '0'),
            defaultRandom,
        );

        const counters = chooseBase.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED) as any[];
        expect(counters).toHaveLength(1);
        expect(counters[0].payload.reason).toBe('elder_thing_the_price_of_power_pod');
    });

    it('Spreading Horror POD：对手拒绝后不应强制施法者从弃牌堆打牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'elder_thing_spreading_horror_pod', 'action', '0')],
                    discard: [makeCard('d1', 'elder_thing_byakhee_pod', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('h1', 'robot_microbot', 'minion', '1'),
                        makeCard('h2', 'robot_microbot_alpha', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultRandom,
        );
        expect(getPromptSourceId(getFirstPrompt(play.finalState))).toBe('elder_thing_spreading_horror_pod_opponent');

        const afterDecline = runCommand(
            play.finalState,
            respondCommand('no', '1'),
            defaultRandom,
        );
        expect(getPromptSourceId(getFirstPrompt(afterDecline.finalState))).toBe('elder_thing_spreading_horror_pod_may_play');

        const afterSkip = runCommand(
            afterDecline.finalState,
            respondCommand('no', '0'),
            defaultRandom,
        );

        expectNoPrompt(afterSkip.finalState);
        expect(afterSkip.finalState.core.players['0'].discard.some(card => card.uid === 'd1')).toBe(true);
    });

    it('Touch of Madness POD：off-phase 额外行动应标记为 immediate', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('d1', 'test_card', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'startTurn';
        const result = invokeRegisteredAbilityContract('elder_thing_touch_of_madness_pod', 'onPlay', {
            state: core,
            matchState: ms,
            playerId: '0',
            cardUid: 'a1',
            defId: 'elder_thing_touch_of_madness_pod',
            baseIndex: 0,
            random: defaultRandom,
            now: 0,
        });

        const limitEvents = result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
        expect((limitEvents[0] as any).payload.playTiming).toBe('immediate');
    });
});
