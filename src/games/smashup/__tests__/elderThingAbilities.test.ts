/**
 * 大杀四方 - 远古之物派系能力测试
 *
 * 覆盖：
 * - elder_thing_byakhee（拜亚基）：有对手随从时抽疯狂卡
 * - elder_thing_mi_go（米-格）：对手抽疯狂卡或你抽牌
 * - elder_thing_insanity（精神错乱）：对手各抽两张疯狂卡
 * - elder_thing_touch_of_madness（疯狂接触）：对手抽疯狂卡 + 你抽牌 + 额外行动
 * - elder_thing_power_of_madness（疯狂之力）：对手弃疯狂卡并洗弃牌堆回牌库
 * - elder_thing_spreading_horror（散播恐怖）：对手随机弃牌直到弃出非疯狂卡
 * - elder_thing_begin_the_summoning（开始召唤）：弃牌堆随从放牌库顶 + 额外行动
 * - elder_thing_unfathomable_goals（深不可测的目的）：有疯狂卡的对手消灭随从
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execute, reduce } from '../domain/reducer';
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
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { applyEvents } from './helpers';
import type { MatchState, RandomFn } from '../../../engine/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number, owner?: string): MinionOnBase {
    return {
        uid, defId, controller, owner: owner ?? controller,
        basePower: power, powerModifier: 0, talentUsed: false, attachedActions: [],
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
    return { core, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } as any } as any;
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
    lastMatchState = ms;
    return execute(ms, {
        type: SU_COMMANDS.PLAY_MINION, playerId,
        payload: { cardUid, baseIndex },
    } as any, random ?? defaultRandom);
}

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn): SmashUpEvent[] {
    const ms = makeMatchState(state);
    lastMatchState = ms;
    return execute(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
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
    describe('elder_thing_byakhee（拜亚基：有对手随从时抽疯狂卡）', () => {
        it('基地有对手随从时抽一张疯狂卡', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'elder_thing_byakhee', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [makeMinion('opp1', 'test', '1', 3)],
                    ongoingActions: [],
                }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.playerId).toBe('0');
            expect((madnessEvents[0] as any).payload.count).toBe(1);
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
                    minions: [makeMinion('opp1', 'test', '1', 3)],
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
        it('对手抽疯狂卡（MVP：默认全部抽）', () => {
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
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.playerId).toBe('1');
        });

        it('疯狂牌库空时你抽一张牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'elder_thing_mi_go', 'minion', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
                madnessDeck: [],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(madnessEvents.length).toBe(0);
            // 你应该抽一张牌
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
                        makeMinion('m1', 'test', '1', 2),
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
