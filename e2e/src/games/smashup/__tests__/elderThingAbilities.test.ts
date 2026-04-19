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
import { reduce } from '../domain/reducer';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import type {
    SmashUpCore,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry, resolveAbility } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { applyEvents, makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';
import type { MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
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
        const executor = resolveAbility('elder_thing_touch_of_madness', 'onPlay');
        expect(executor).toBeDefined();

        const result = executor!({
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
        const executor = resolveAbility('elder_thing_begin_the_summoning', 'onPlay');
        expect(executor).toBeDefined();

        const result = executor!({
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

let lastMatchState: MatchState<SmashUpCore>;

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number, random?: RandomFn): SmashUpEvent[] {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_MINION, playerId,
        payload: { cardUid, baseIndex },
    } as any, random ?? defaultRandom);
    lastMatchState = result.finalState;
    return result.events as SmashUpEvent[];
}

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn): SmashUpEvent[] {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
    lastMatchState = result.finalState;
    return result.events as SmashUpEvent[];
}

function getLastInteractions(): any[] {
    const interaction = (lastMatchState?.sys as any)?.interaction;
    if (!interaction) return [];
    const list: any[] = [];
    if (interaction.current) list.push(interaction.current);
    if (interaction.queue?.length) list.push(...interaction.queue);
    return list;
}

function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
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

            const events = execPlayMinion(state, '0', 'm1', 0);
            // 不再直接产生疯狂卡事件，而是创建交互
            const interactions = getLastInteractions();
            expect(interactions.length).toBeGreaterThanOrEqual(1);
            const miGoInteraction = interactions.find(i => i.data?.sourceId === 'elder_thing_mi_go');
            expect(miGoInteraction).toBeDefined();
            expect(miGoInteraction.playerId).toBe('1'); // 对手选择
            expect(miGoInteraction?.data?.targetType).toBe('button');
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
            const ms = makeMatchState(state);
            const handler = getInteractionHandler('elder_thing_mi_go');
            expect(handler).toBeDefined();
            const result = handler!(ms, '1', { choice: 'draw_madness' }, {
                continuationContext: { casterPlayerId: '0', opponents: ['1'], opponentIdx: 0 },
            }, defaultRandom, 0);
            expect(result).toBeDefined();
            const madnessEvents = result!.events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.playerId).toBe('1');
        });

        it('对手拒绝时施法者抽一张牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });
            const ms = makeMatchState(state);
            const handler = getInteractionHandler('elder_thing_mi_go');
            expect(handler).toBeDefined();
            const result = handler!(ms, '1', { choice: 'decline' }, {
                continuationContext: { casterPlayerId: '0', opponents: ['1'], opponentIdx: 0 },
            }, defaultRandom, 0);
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

            const events = execPlayAction(state, '0', 'a1');
            // 单个弃牌堆随从时创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
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

            const beginPrompt = (playBegin.finalState.sys as any)?.interaction?.current;
            expect(beginPrompt?.data?.sourceId).toBe('elder_thing_begin_the_summoning');

            const resolveBegin = runCommand(playBegin.finalState, {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: '0',
                payload: { optionId: beginPrompt.data.options[0].id },
            } as any, defaultRandom);
            expect(resolveBegin.success).toBe(true);
            expect(resolveBegin.finalState.core.players['0'].actionsPlayed).toBe(1);
            expect(resolveBegin.finalState.core.players['0'].actionLimit).toBe(2);

            const playMadness = runCommand(resolveBegin.finalState, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'mad-1' },
            } as any, defaultRandom);
            expect(playMadness.success).toBe(true);

            const madnessPrompt = (playMadness.finalState.sys as any)?.interaction?.current;
            expect(madnessPrompt?.data?.sourceId).toBe('special_madness');

            const consumeMadness = runCommand(playMadness.finalState, {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: '0',
                payload: {
                    optionId: madnessPrompt.data.options.find((option: any) => option.value?.action === 'return')?.id,
                },
            } as any, defaultRandom);
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

            const events = execPlayAction(state, '0', 'a1');
            // 展示对手手牌给所有人看
            const revealEvents = events.filter(e => e.type === SU_EVENTS.REVEAL_HAND);
            expect(revealEvents.length).toBe(1);
            expect((revealEvents[0] as any).payload.targetPlayerId).toBe('1');
            expect((revealEvents[0] as any).payload.viewerPlayerId).toBe('all');
            // 多个随从 → 创建 Prompt 让对手选择消灭哪个
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(interactions[0]?.data?.sourceId).toBe('elder_thing_unfathomable_goals');
        });

        it('有疯狂卡的对手只有一个随从时直接消灭，且先展示手牌', () => {
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

            const events = execPlayAction(state, '0', 'a1');
            // 展示对手手牌
            const revealEvents = events.filter(e => e.type === SU_EVENTS.REVEAL_HAND);
            expect(revealEvents.length).toBe(1);
            expect((revealEvents[0] as any).payload.viewerPlayerId).toBe('all');
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
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
