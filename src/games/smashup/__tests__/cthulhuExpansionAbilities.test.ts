/**
 * 大杀四方 - 克苏鲁扩展派系能力测试
 *
 * 覆盖：
 * - 印斯茅斯：innsmouth_the_deep_ones, innsmouth_new_acolytes
 * - 米斯卡塔尼克大学：miskatonic_those_meddling_kids
 * - 克苏鲁之仆：cthulhu_recruit_by_force, cthulhu_it_begins_again, cthulhu_fhtagn
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { reduce } from '../domain/reducer';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    CardInstance,
    OngoingActionOnBase,
    AttachedActionOnMinion,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { applyEvents, makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';
import type { MatchState, RandomFn } from '../../../engine/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
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
        factions: ['test_a', 'test_b'] as [string, string],
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

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn): { events: SmashUpEvent[]; matchState: MatchState<SmashUpCore> } {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
}


// ============================================================================
// 印斯茅斯派系
// ============================================================================

describe('印斯茅斯派系能力', () => {
    describe('innsmouth_the_deep_ones（深潜者：力量≤2随从+1力量）', () => {
        it('所有己方力量≤2随从获得+1力量', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_the_deep_ones', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    {
                        defId: 'b1', minions: [
                            makeMinion('m1', 'test', '0', 2), // 力量2 ≤ 2 → +1
                            makeMinion('m2', 'test', '0', 1), // 力量1 ≤ 2 → +1
                            makeMinion('m3', 'test', '0', 3), // 力量3 > 2 → 不受影响
                        ], ongoingActions: [],
                    },
                    {
                        defId: 'b2', minions: [
                            makeMinion('m4', 'test', '0', 2), // 力量2 ≤ 2 → +1
                            makeMinion('m5', 'test', '1', 1), // 对手的，不受影响
                        ], ongoingActions: [],
                    },
                ],
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const powerEvents = events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
            // m1, m2, m4 应获得 +1
            expect(powerEvents.length).toBe(3);
            const uids = powerEvents.map(e => (e as any).payload.minionUid);
            expect(uids).toContain('m1');
            expect(uids).toContain('m2');
            expect(uids).toContain('m4');
            // 每个都是 +1
            for (const e of powerEvents) {
                expect((e as any).payload.amount).toBe(1);
            }
        });

        it('无符合条件随从时不产生事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_the_deep_ones', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '0', 5), // 力量5 > 2
                    ], ongoingActions: [],
                }],
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const powerEvents = events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
            expect(powerEvents.length).toBe(0);
        });

        it('力量修正正确应用（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_the_deep_ones', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '0', 2),
                    ], ongoingActions: [],
                }],
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            const minion = newState.bases[0].minions.find(m => m.uid === 'm1');
            expect(minion!.powerModifier).toBe(1);
            // 有效力量 = 2 + 1 = 3
        });
    });

    describe('innsmouth_new_acolytes（新人：所有玩家弃牌堆随从洗回牌库）', () => {
        it('所有玩家弃牌堆随从洗回牌库', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_new_acolytes', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'action', '0')],
                        discard: [
                            makeCard('dis1', 'test_m', 'minion', '0'),
                            makeCard('dis2', 'test_a', 'action', '0'), // 行动卡不洗回
                        ],
                    }),
                    '1': makePlayer('1', {
                        deck: [makeCard('d2', 'test', 'minion', '1')],
                        discard: [
                            makeCard('dis3', 'test_m', 'minion', '1'),
                            makeCard('dis4', 'test_m2', 'minion', '1'),
                        ],
                    }),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const reorderEvents = events.filter(e => e.type === SU_EVENTS.DECK_REORDERED);
            // P0 有1个随从在弃牌堆，P1 有2个
            expect(reorderEvents.length).toBe(2);
        });

        it('弃牌堆无随从的玩家不受影响', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_new_acolytes', 'action', '0')],
                        discard: [makeCard('dis1', 'test_m', 'minion', '0')],
                    }),
                    '1': makePlayer('1', {
                        discard: [makeCard('dis2', 'test_a', 'action', '1')], // 只有行动卡
                    }),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const reorderEvents = events.filter(e => e.type === SU_EVENTS.DECK_REORDERED);
            // 只有 P0 有随从
            expect(reorderEvents.length).toBe(1);
            expect((reorderEvents[0] as any).payload.playerId).toBe('0');
        });

        it('洗回后状态正确（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_new_acolytes', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'action', '0')],
                        discard: [
                            makeCard('dis1', 'test_m', 'minion', '0'),
                            makeCard('dis2', 'test_a', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1', {
                        deck: [],
                        discard: [makeCard('dis3', 'test_m', 'minion', '1')],
                    }),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // P0: 牌库应包含 d1 + dis1（随从洗回），弃牌堆应保留 dis2（行动卡）+ a1（打出的行动卡）
            // DECK_REORDERED 只移动被引用的弃牌堆卡（dis1），不清空弃牌堆
            expect(newState.players['0'].deck.length).toBe(2);
            expect(newState.players['0'].deck.some(c => c.uid === 'dis1')).toBe(true);
            expect(newState.players['0'].deck.some(c => c.uid === 'd1')).toBe(true);
            // dis2 留在弃牌堆，a1 也在弃牌堆（ACTION_PLAYED 放入）
            expect(newState.players['0'].discard.length).toBe(2);
            expect(newState.players['0'].discard.some(c => c.uid === 'dis2')).toBe(true);
            expect(newState.players['0'].discard.some(c => c.uid === 'a1')).toBe(true);

            // P1: 牌库应包含 dis3（随从洗回），弃牌堆清空
            expect(newState.players['1'].discard.length).toBe(0);
            expect(newState.players['1'].deck.length).toBe(1);
            expect(newState.players['1'].deck[0].uid).toBe('dis3');
        });
    });
});


// ============================================================================
// 米斯卡塔尼克大学派系
// ============================================================================

describe('米斯卡塔尼克大学派系能力', () => {
    describe('miskatonic_those_meddling_kids（多管闲事的小鬼：消灭基地上行动卡）', () => {
        it('单基地有行动卡时也创建 Prompt 选择', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [],
                    ongoingActions: [
                        { uid: 'o1', defId: 'test_ongoing', ownerId: '1' },
                        { uid: 'o2', defId: 'test_ongoing2', ownerId: '0' },
                    ],
                }],
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            // 单基地也应创建 Prompt 让玩家主动选择
            const interaction = (matchState.sys as any)?.interaction;
            const current = interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('miskatonic_those_meddling_kids');
        });

        it('消灭基地上所有持续行动卡（通过 interaction handler 逐个点击）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [],
                    ongoingActions: [
                        { uid: 'o1', defId: 'test_ongoing', ownerId: '1' },
                        { uid: 'o2', defId: 'test_ongoing2', ownerId: '0' },
                    ],
                }],
            });

            // 先打出卡 → 创建 interaction
            const { matchState } = execPlayAction(state, '0', 'a1');
            // 第一步：选择基地 0 → 创建点击式行动卡选择
            const handler = getInteractionHandler('miskatonic_those_meddling_kids');
            expect(handler).toBeDefined();
            const step1 = handler!(matchState, '0', { baseIndex: 0 }, undefined, defaultRandom, 1000);
            expect(step1.events.length).toBe(0); // 不直接产生消灭事件
            // 第二步：点击第一张行动卡
            const selectHandler = getInteractionHandler('miskatonic_those_meddling_kids_select');
            expect(selectHandler).toBeDefined();
            const step2 = selectHandler!(step1.state ?? matchState, '0',
                { cardUid: 'o1', defId: 'test_ongoing', ownerId: '1' },
                { continuationContext: { baseIndex: 0 } } as any, defaultRandom, 1001);
            const detachEvents1 = step2.events.filter((e: any) => e.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvents1.length).toBe(1);
            expect(detachEvents1[0].payload.cardUid).toBe('o1');
            // 第三步：点击第二张行动卡
            const step3 = selectHandler!(step2.state ?? matchState, '0',
                { cardUid: 'o2', defId: 'test_ongoing2', ownerId: '0' },
                { continuationContext: { baseIndex: 0 } } as any, defaultRandom, 1002);
            const detachEvents2 = step3.events.filter((e: any) => e.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvents2.length).toBe(1);
            expect(detachEvents2[0].payload.cardUid).toBe('o2');
        });

        it('消灭随从上附着的行动卡（通过 interaction handler 逐个点击）', () => {
            const minionWithActions: MinionOnBase = {
                ...makeMinion('m1', 'test', '1', 3),
                attachedActions: [
                    { uid: 'att1', defId: 'test_attached', ownerId: '1' },
                ],
            };
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [minionWithActions],
                    ongoingActions: [{ uid: 'o1', defId: 'test_ongoing', ownerId: '1' }],
                }],
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            // 第一步：选择基地 0 → 创建点击式行动卡选择
            const handler = getInteractionHandler('miskatonic_those_meddling_kids');
            expect(handler).toBeDefined();
            const step1 = handler!(matchState, '0', { baseIndex: 0 }, undefined, defaultRandom, 1000);
            expect(step1.events.length).toBe(0);
            // 第二步：点击第一张行动卡
            const selectHandler = getInteractionHandler('miskatonic_those_meddling_kids_select');
            expect(selectHandler).toBeDefined();
            const step2 = selectHandler!(step1.state ?? matchState, '0',
                { cardUid: 'o1', defId: 'test_ongoing', ownerId: '1' },
                { continuationContext: { baseIndex: 0 } } as any, defaultRandom, 1001);
            const detachEvents1 = step2.events.filter((e: any) => e.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvents1.length).toBe(1);
            expect(detachEvents1[0].payload.cardUid).toBe('o1');
            // 第三步：点击附着的行动卡
            const step3 = selectHandler!(step2.state ?? matchState, '0',
                { cardUid: 'att1', defId: 'test_attached', ownerId: '1' },
                { continuationContext: { baseIndex: 0 } } as any, defaultRandom, 1002);
            const detachEvents2 = step3.events.filter((e: any) => e.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvents2.length).toBe(1);
            expect(detachEvents2[0].payload.cardUid).toBe('att1');
        });

        it('多个基地有行动卡时创建 Prompt 选择', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    {
                        defId: 'b1', minions: [],
                        ongoingActions: [{ uid: 'o1', defId: 'test', ownerId: '1' }],
                    },
                    {
                        defId: 'b2', minions: [],
                        ongoingActions: [
                            { uid: 'o2', defId: 'test', ownerId: '1' },
                            { uid: 'o3', defId: 'test', ownerId: '1' },
                        ],
                    },
                ],
            });

            const ms = makeMatchState(core);
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_ACTION, playerId: '0',
                payload: { cardUid: 'a1' },
            } as any, defaultRandom);
            // 多个基地有行动卡 → 创建 Prompt 让玩家选择
            const interaction = (result.finalState.sys as any)?.interaction;
            const current = interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('miskatonic_those_meddling_kids');
        });

        it('无行动卡时不产生事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3)],
                    ongoingActions: [],
                }],
            });

            const { events, matchState } = execPlayAction(state, '0', 'a1');
            const detachEvents = events.filter(e => e.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvents.length).toBe(0);
            // 无行动卡时也不应创建 interaction
            const interaction = (matchState.sys as any)?.interaction;
            expect(interaction?.current).toBeUndefined();
        });

        it('消灭后状态正确（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [],
                    ongoingActions: [
                        { uid: 'o1', defId: 'test_ongoing', ownerId: '1' },
                    ],
                }],
            });

            // 先打出卡 → 创建基地选择 interaction
            const { events: playEvents, matchState } = execPlayAction(state, '0', 'a1');
            // 第一步：选择基地 0 → 创建点击式行动卡选择
            const handler = getInteractionHandler('miskatonic_those_meddling_kids');
            expect(handler).toBeDefined();
            const step1 = handler!(matchState, '0', { baseIndex: 0 }, undefined, defaultRandom, 1000);
            expect(step1.events.length).toBe(0);
            const selectHandler = getInteractionHandler('miskatonic_those_meddling_kids_select');
            expect(selectHandler).toBeDefined();
            // 第二步：点击消灭 o1
            const step2 = selectHandler!(step1.state ?? matchState, '0',
                { cardUid: 'o1', defId: 'test_ongoing', ownerId: '1' },
                { continuationContext: { baseIndex: 0 } } as any, defaultRandom, 1001);
            const allEvents = [...playEvents, ...step2.events];
            const newState = applyEvents(state, allEvents);
            // 基地上不应有持续行动卡
            expect(newState.bases[0].ongoingActions.length).toBe(0);
            // o1 应在 P1 弃牌堆
            expect(newState.players['1'].discard.some(c => c.uid === 'o1')).toBe(true);
        });
    });
});


// ============================================================================
// 克苏鲁之仆派系
// ============================================================================

describe('克苏鲁之仆派系能力', () => {
    describe('cthulhu_recruit_by_force（强制招募：弃牌堆力量≤3随从放牌库顶）', () => {
        it('有符合条件随从时创建多选 Interaction', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'action', '0')],
                        discard: [
                            makeCard('dis1', 'innsmouth_the_locals', 'minion', '0'), // 力量2 ≤ 3
                            makeCard('dis2', 'cthulhu_star_spawn', 'minion', '0'),   // 力量5 > 3
                            makeCard('dis3', 'cthulhu_servitor', 'minion', '0'),     // 力量2 ≤ 3
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            // 应创建 interaction 让玩家选择
            const interaction = (matchState.sys as any)?.interaction;
            const current = interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('cthulhu_recruit_by_force');
        });

        it('通过 interaction handler 选择后放牌库顶', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'action', '0')],
                        discard: [
                            makeCard('dis1', 'innsmouth_the_locals', 'minion', '0'),
                            makeCard('dis3', 'cthulhu_servitor', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const handler = getInteractionHandler('cthulhu_recruit_by_force');
            expect(handler).toBeDefined();
            // 选择两张随从
            const result = handler!(matchState, '0', [{ cardUid: 'dis1' }, { cardUid: 'dis3' }], undefined, defaultRandom, 1000);
            const reorderEvents = result.events.filter((e: any) => e.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvents.length).toBe(1);
            const deckUids = (reorderEvents[0] as any).payload.deckUids;
            expect(deckUids).toContain('dis1');
            expect(deckUids).toContain('dis3');
            expect(deckUids).toContain('d1');
            // dis1, dis3 应在 d1 前面（放牌库顶）
            expect(deckUids.indexOf('dis1')).toBeLessThan(deckUids.indexOf('d1'));
        });

        it('弃牌堆无符合条件随从时不产生事件也不创建 Interaction', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        discard: [
                            makeCard('dis1', 'cthulhu_star_spawn', 'minion', '0'), // 力量5 > 3
                            makeCard('dis2', 'test_action', 'action', '0'),        // 行动卡
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events, matchState } = execPlayAction(state, '0', 'a1');
            const reorderEvents = events.filter(e => e.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvents.length).toBe(0);
            // 无符合条件随从时不应创建 interaction
            const interaction = (matchState.sys as any)?.interaction;
            expect(interaction?.current).toBeUndefined();
        });

        it('状态正确（通过 handler 解决后 reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'action', '0')],
                        discard: [
                            makeCard('dis1', 'cthulhu_servitor', 'minion', '0'), // 力量2 ≤ 3
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events: playEvents, matchState } = execPlayAction(state, '0', 'a1');
            const handler = getInteractionHandler('cthulhu_recruit_by_force');
            expect(handler).toBeDefined();
            const result = handler!(matchState, '0', [{ cardUid: 'dis1' }], undefined, defaultRandom, 1000);
            const allEvents = [...playEvents, ...result.events];
            const newState = applyEvents(state, allEvents);
            // DECK_REORDERED 不清空弃牌堆，只移走被引用的卡
            // dis1 从弃牌堆移入牌库顶；a1（打出的行动卡）留在弃牌堆
            expect(newState.players['0'].discard.length).toBe(1);
            expect(newState.players['0'].discard[0].uid).toBe('a1');
            // 牌库应包含 dis1（顶部）和 d1
            expect(newState.players['0'].deck.length).toBe(2);
            expect(newState.players['0'].deck[0].uid).toBe('dis1');
            expect(newState.players['0'].deck[1].uid).toBe('d1');
        });

        it('交互 min=0 且包含跳过选项', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        discard: [makeCard('dis1', 'cthulhu_servitor', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });
            const { matchState } = execPlayAction(state, '0', 'a1');
            const current = (matchState.sys as any)?.interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.multi?.min).toBe(0);
            expect(current?.data?.options?.some((o: any) => o.id === 'skip')).toBe(true);
        });

        it('选跳过 → 弃牌堆不变，牌库不变', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'action', '0')],
                        discard: [makeCard('dis1', 'cthulhu_servitor', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });
            const { matchState } = execPlayAction(state, '0', 'a1');
            const handler = getInteractionHandler('cthulhu_recruit_by_force');
            expect(handler).toBeDefined();
            // 传空数组模拟跳过（min=0）
            const result = handler!(matchState, '0', [], undefined, defaultRandom, 1000);
            expect(result.events.length).toBe(0);
            // 弃牌堆中的随从仍在弃牌堆
            expect(matchState.core.players['0'].discard.some((c: any) => c.uid === 'dis1')).toBe(true);
        });
    });

    describe('cthulhu_it_begins_again（再次降临：弃牌堆行动卡洗回牌库）', () => {
        it('将弃牌堆中行动卡洗回牌库', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                        discard: [
                            makeCard('dis1', 'test_action', 'action', '0'),
                            makeCard('dis2', 'test_action2', 'action', '0'),
                            makeCard('dis3', 'test_minion', 'minion', '0'), // 随从不在选项中
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            // 应创建多选交互
            const current = (matchState.sys as any)?.interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('cthulhu_it_begins_again');
            // 选项包含行动卡（不含随从）+ 跳过选项
            const options = current?.data?.options ?? [];
            expect(options.length).toBe(3); // 2张行动卡 + 1个跳过

            // 解析交互：选择全部行动卡
            const handler = getInteractionHandler('cthulhu_it_begins_again');
            expect(handler).toBeDefined();
            const ms2 = makeMatchState(state);
            const result = handler!(ms2, '0', [{ cardUid: 'dis1' }, { cardUid: 'dis2' }], undefined, defaultRandom, 0);
            const reorderEvents = result.events.filter(e => e.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvents.length).toBe(1);
            const deckUids = (reorderEvents[0] as any).payload.deckUids;
            expect(deckUids).toContain('d1');
            expect(deckUids).toContain('dis1');
            expect(deckUids).toContain('dis2');
            expect(deckUids).not.toContain('dis3');
        });

        it('弃牌堆无行动卡时不产生交互', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        discard: [makeCard('dis1', 'test_minion', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events, matchState } = execPlayAction(state, '0', 'a1');
            const reorderEvents = events.filter(e => e.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvents.length).toBe(0);
            const current = (matchState.sys as any)?.interaction?.current;
            expect(current).toBeUndefined();
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                        discard: [
                            makeCard('dis1', 'test_action', 'action', '0'),
                            makeCard('dis2', 'test_minion', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            // 通过 handler 直接验证 reduce
            const handler = getInteractionHandler('cthulhu_it_begins_again');
            expect(handler).toBeDefined();
            const ms = makeMatchState(state);
            const result = handler!(ms, '0', [{ cardUid: 'dis1' }], undefined, defaultRandom, 0);
            // 先 apply ACTION_PLAYED 事件（模拟打出行动卡）
            const playEvents: SmashUpEvent[] = [
                { type: SU_EVENTS.ACTION_PLAYED, payload: { playerId: '0', cardUid: 'a1', defId: 'cthulhu_it_begins_again' }, timestamp: 0 } as any,
                ...result.events,
            ];
            const newState = applyEvents(state, playEvents);
            // DECK_REORDERED 不清空弃牌堆，只移走被引用的卡
            // 牌库：d1 + dis1（从弃牌堆移入）
            expect(newState.players['0'].deck.length).toBe(2);
            expect(newState.players['0'].deck.some(c => c.uid === 'd1')).toBe(true);
            expect(newState.players['0'].deck.some(c => c.uid === 'dis1')).toBe(true);
            // 弃牌堆：a1（ACTION_PLAYED 放入）+ dis2（未被选中，保留）
            expect(newState.players['0'].discard.length).toBe(2);
            expect(newState.players['0'].discard.some(c => c.uid === 'a1')).toBe(true);
            expect(newState.players['0'].discard.some(c => c.uid === 'dis2')).toBe(true);
        });

        it('交互 min=0 且包含跳过选项', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        discard: [makeCard('dis1', 'test_action', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });
            const { matchState } = execPlayAction(state, '0', 'a1');
            const current = (matchState.sys as any)?.interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.multi?.min).toBe(0);
            expect(current?.data?.options?.some((o: any) => o.id === 'skip')).toBe(true);
        });

        it('选跳过 → 牌库不变', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                        discard: [makeCard('dis1', 'test_action', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });
            const { matchState } = execPlayAction(state, '0', 'a1');
            const handler = getInteractionHandler('cthulhu_it_begins_again');
            expect(handler).toBeDefined();
            // 传空数组模拟跳过（min=0）
            const result = handler!(matchState, '0', [], undefined, defaultRandom, 1000);
            expect(result.events.length).toBe(0);
            // 牌库不变
            expect(matchState.core.players['0'].deck.some((c: any) => c.uid === 'd1')).toBe(true);
        });
    });

    describe('cthulhu_fhtagn（克苏鲁的馈赠：从牌库找2张行动卡放入手牌）', () => {
        it('从牌库顶找到2张行动卡放入手牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),
                            makeCard('d2', 'test_a', 'action', '0'),
                            makeCard('d3', 'test_m2', 'minion', '0'),
                            makeCard('d4', 'test_a2', 'action', '0'),
                            makeCard('d5', 'test_m3', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvents.length).toBe(1);
            // 应找到 d2 和 d4（前2张行动卡）
            expect((drawEvents[0] as any).payload.cardUids).toEqual(['d2', 'd4']);
            expect((drawEvents[0] as any).payload.count).toBe(2);
        });

        it('翻到的非行动卡放牌库底', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),  // 翻到，非行动 → 放底
                            makeCard('d2', 'test_a', 'action', '0'),  // 第1张行动
                            makeCard('d3', 'test_m2', 'minion', '0'), // 翻到，非行动 → 放底
                            makeCard('d4', 'test_a2', 'action', '0'), // 第2张行动
                            makeCard('d5', 'test_m3', 'minion', '0'), // 未翻到
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const reorderEvents = events.filter(e => e.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvents.length).toBe(1);
            const deckUids = (reorderEvents[0] as any).payload.deckUids;
            // d5 未翻到保持在前，d1 和 d3 放底部
            expect(deckUids[0]).toBe('d5');
            expect(deckUids).toContain('d1');
            expect(deckUids).toContain('d3');
        });

        it('牌库只有1张行动卡时只抽1张', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),
                            makeCard('d2', 'test_a', 'action', '0'),
                            makeCard('d3', 'test_m2', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvents.length).toBe(1);
            expect((drawEvents[0] as any).payload.cardUids).toEqual(['d2']);
            expect((drawEvents[0] as any).payload.count).toBe(1);
        });

        it('牌库无行动卡时不产生事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),
                            makeCard('d2', 'test_m2', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvents.length).toBe(0);
        });

        it('牌库为空时不产生事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvents.length).toBe(0);
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),
                            makeCard('d2', 'test_a', 'action', '0'),
                            makeCard('d3', 'test_a2', 'action', '0'),
                            makeCard('d4', 'test_m2', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // d2 和 d3 应在手牌中（从牌库顶找到的2张行动卡）
            expect(newState.players['0'].hand.some(c => c.uid === 'd2')).toBe(true);
            expect(newState.players['0'].hand.some(c => c.uid === 'd3')).toBe(true);
            // d4 应在牌库中（未翻到），d1 放牌库底
            expect(newState.players['0'].deck.some(c => c.uid === 'd4')).toBe(true);
            expect(newState.players['0'].deck.some(c => c.uid === 'd1')).toBe(true);
            // a1 打出后应在弃牌堆中（DECK_REORDERED 不碰弃牌堆）
            expect(newState.players['0'].discard.some(c => c.uid === 'a1')).toBe(true);
        });

        it('行动卡打出后不会因牌库重排从弃牌堆消失（回归测试）', () => {
            // 场景：cthulhu_fhtagn 打出 → ACTION_PLAYED 将 a1 放入弃牌堆
            // → 翻牌找行动卡 → 有 missed cards → DECK_REORDERED（仅重排牌库）
            // 修复前用 DECK_RESHUFFLED 会清空弃牌堆导致 a1 消失
            // 修复后用 DECK_REORDERED 不碰弃牌堆，a1 安全保留
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),   // missed → 牌库底
                            makeCard('d2', 'test_a', 'action', '0'),   // picked → 手牌
                            makeCard('d3', 'test_m2', 'minion', '0'),  // missed → 牌库底
                            makeCard('d4', 'test_a2', 'action', '0'),  // picked → 手牌
                        ],
                        discard: [makeCard('dis1', 'old_action', 'action', '0')], // 已有弃牌
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);

            // a1 打出后应在弃牌堆中（DECK_REORDERED 不碰弃牌堆）
            expect(newState.players['0'].discard.some(c => c.uid === 'a1')).toBe(true);
            // dis1（原弃牌堆中的卡）也应保留在弃牌堆
            expect(newState.players['0'].discard.some(c => c.uid === 'dis1')).toBe(true);
            // d2, d4 应在手牌
            expect(newState.players['0'].hand.some(c => c.uid === 'd2')).toBe(true);
            expect(newState.players['0'].hand.some(c => c.uid === 'd4')).toBe(true);
            // d1, d3 应在牌库底
            expect(newState.players['0'].deck.some(c => c.uid === 'd1')).toBe(true);
            expect(newState.players['0'].deck.some(c => c.uid === 'd3')).toBe(true);
        });

        it('innsmouth_the_locals 翻牌后弃牌堆卡不消失（回归测试）', () => {
            // 同样的 bug 模式：本地人翻3张，有 missed → DECK_REORDERED
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('d1', 'innsmouth_the_locals', 'minion', '0'), // 同名 → picked
                            makeCard('d2', 'test_m', 'minion', '0'),               // 非同名 → missed
                            makeCard('d3', 'test_m2', 'minion', '0'),              // 非同名 → missed
                            makeCard('d4', 'test_m3', 'minion', '0'),              // 未翻到
                        ],
                        discard: [makeCard('dis1', 'old_card', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            // 本地人是随从 onPlay，需要通过 PLAY_MINION 触发
            const ms = makeMatchState(state);
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_MINION, playerId: '0',
                payload: { cardUid: 'a1', baseIndex: 0 },
            } as any, defaultRandom);
            const newState = result.finalState.core;

            const allCardUids = [
                ...newState.players['0'].hand.map(c => c.uid),
                ...newState.players['0'].deck.map(c => c.uid),
                ...newState.players['0'].discard.map(c => c.uid),
            ];
            // dis1（原弃牌堆中的卡）不应消失
            expect(allCardUids).toContain('dis1');
        });
    });
});
