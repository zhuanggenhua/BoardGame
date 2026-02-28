/**
 * 大杀四方 - 疯狂卡 + Prompt 能力测试（Priority 2）
 *
 * 覆盖：
 * - 克苏鲁之仆：cthulhu_madness_unleashed（弃疯狂卡换抽牌+额外行动）
 * - 米斯卡塔尼克大学：miskatonic_it_might_just_work（弃1张疯狂卡，己方全体随从+1力量）
 * - 米斯卡塔尼克大学：miskatonic_book_of_iter_the_unseen（金克丝!：返回至多2张疯狂卡到疯狂牌库）
 * - 米斯卡塔尼克大学：miskatonic_thing_on_the_doorstep（老詹金斯!?：special，消灭基地最高力量随从）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execute, reduce } from '../domain/reducer';
import { postProcessSystemEvents } from '../domain';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID, MADNESS_DECK_SIZE } from '../domain/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { resolveAbility } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { applyEvents as _applyEventsHelper } from './helpers';
import type { MatchState, RandomFn } from '../../../engine/types';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number, owner?: string): MinionOnBase {
    return {
        uid, defId, controller, owner: owner ?? controller,
        basePower: power, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
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

function makeStateWithMadness(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        madnessDeck: Array.from({ length: MADNESS_DECK_SIZE }, () => MADNESS_CARD_DEF_ID),
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

/** 保存最近一次 execute 调用的 matchState 引用 */
let lastMatchState: MatchState<SmashUpCore> | null = null;

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn): SmashUpEvent[] {
    const ms = makeMatchState(state);
    lastMatchState = ms;
    const events = execute(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
    
    // Call postProcessSystemEvents to trigger onPlay abilities
    return postProcessSystemEvents(state, events, random ?? defaultRandom).events;
}

/** 执行打出行动卡并返回完整的 matchState（用于测试交互） */
function execPlayActionWithMatch(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn): { state: SmashUpCore; events: SmashUpEvent[]; matchState: MatchState<SmashUpCore> } {
    const ms = makeMatchState(state);
    const events = execute(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
    
    // Call postProcessSystemEvents to trigger onPlay abilities，传入 matchState
    const processed = postProcessSystemEvents(state, events, random ?? defaultRandom, ms);
    
    return { state: processed.matchState!.core, events: processed.events, matchState: processed.matchState! };
}

/** 解决交互（调用 interaction handler） */
function resolveInteraction(state: SmashUpCore, interactionId: string, value: unknown, timestamp: number): { state: SmashUpCore; events: SmashUpEvent[] } {
    // interactionId 实际上是 sourceId（handler 注册的 key）
    const handler = getInteractionHandler(interactionId);
    if (!handler) {
        throw new Error(`No interaction handler found for ${interactionId}`);
    }
    
    // 调用 handler
    const result = handler({ core: state } as any, state.players[state.turnOrder[state.currentPlayerIndex]].id, value, undefined, defaultRandom, timestamp);
    if (!result) throw new Error(`Handler returned undefined for ${interactionId}`);
    return { state: result.state?.core ?? state, events: result.events };
}
/** 从最近一次 execute 的 matchState 中获取 interactions */
function getLastInteractions(): any[] {
    if (!lastMatchState) return [];
    const interaction = (lastMatchState.sys as any)?.interaction;
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
// 克苏鲁之仆 - cthulhu_madness_unleashed
// ============================================================================

describe('克苏鲁之仆 - cthulhu_madness_unleashed（疯狂释放）', () => {
    it('多张疑狂卡时创建多选 Prompt', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [
                        makeCard('d1', 'test', 'minion', '0'),
                        makeCard('d2', 'test', 'action', '0'),
                        makeCard('d3', 'test', 'minion', '0'),
                        makeCard('d4', 'test', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        // 多张疑狂卡时应创建 Interaction（不直接弃牌）
        const interactions = getLastInteractions();
        expect(interactions.length).toBe(1);
        expect(interactions[0].data.sourceId).toBe('cthulhu_madness_unleashed');
        // 应有3个疯狂卡选项 + 1个跳过选项
        expect(interactions[0].data.options.length).toBe(4);
    });

    it('手中无疯狂卡时无效果', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0')],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        const returnEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_RETURNED);
        expect(returnEvents.length).toBe(0);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
        const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents.length).toBe(0);
    });

    it('只有1张疯狂卡时创建 Prompt', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        // 单张疯狂卡时创建 Interaction
        const interactions = getLastInteractions();
        expect(interactions.length).toBe(1);
        expect(interactions[0].data.sourceId).toBe('cthulhu_madness_unleashed');
    });

    it('多张疑狂卡+牌库不足时也创建 Prompt', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')], // 只有1张
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        // 多张疑狂卡时应创建 Interaction
        const interactions = getLastInteractions();
        expect(interactions.length).toBe(1);
        expect(interactions[0].data.sourceId).toBe('cthulhu_madness_unleashed');
        // 3张疯狂卡选项 + 1个跳过选项
        expect(interactions[0].data.options.length).toBe(4);
    });

    it('状态正确（reduce 验证）- 多张疑狂卡产生 PROMPT_CONTINUATION', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [
                        makeCard('d1', 'test', 'minion', '0'),
                        makeCard('d2', 'test', 'action', '0'),
                        makeCard('d3', 'test', 'minion', '0'),
                    ],
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        const newState = applyEvents(state, events);
        // Interaction 已创建（Prompt 待决），疯狂卡仍在手牌
        const interactions = getLastInteractions();
        expect(interactions.length).toBe(1);
        expect(interactions[0].data.sourceId).toBe('cthulhu_madness_unleashed');
        // 手牌中疑狂卡仍在（等待玩家选择）
        expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(2);
    });

    it('交互 min=0 且包含跳过选项', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        execPlayAction(state, '0', 'a1');
        const interactions = getLastInteractions();
        expect(interactions.length).toBe(1);
        expect(interactions[0].data.multi?.min).toBe(0);
        expect(interactions[0].data.options.some((o: any) => o.id === 'skip')).toBe(true);
    });

    it('选跳过 → 疯狂卡仍在手牌，无抽牌无额外行动', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });
        execPlayAction(state, '0', 'a1');
        const interactions = getLastInteractions();
        expect(interactions.length).toBe(1);
        // 解决交互：选跳过（空数组）
        const handler = getInteractionHandler('cthulhu_madness_unleashed');
        expect(handler).toBeDefined();
        const ms = makeMatchState(state);
        const result = handler!(ms, '0', [], undefined, defaultRandom, 1000);
        expect(result.events.length).toBe(0);
        // 疯狂卡仍在手牌（未弃）
        expect(state.players['0'].hand.some(c => c.uid === 'm1')).toBe(true);
    });
});


// ============================================================================
// 米斯卡塔尼克大学 - miskatonic_it_might_just_work
// 中文版效果：弃掉一张疯狂卡来使你的每个随从获得+1力量直到回合结束
// ============================================================================

describe('米斯卡塔尼克大学 - miskatonic_it_might_just_work（它可能有用）', () => {
    it('有疯狂卡+己方随从时：弃1张疯狂卡，全体己方随从+1力量', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'miskatonic_it_might_just_work', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_test', ongoingActions: [],
                minions: [
                    makeMinion('mine1', 'test_a', '0', 2),
                    makeMinion('mine2', 'test_b', '0', 3),
                    makeMinion('enemy1', 'test_c', '1', 5),
                ],
            }],
        });

        const events = execPlayAction(state, '0', 'a1');
        // 应弃掉1张疯狂卡
        const discardEvts = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
        expect(discardEvts.length).toBe(1);
        expect((discardEvts[0] as any).payload.cardUids).toEqual(['m1']);
        // 己方2个随从各获得+1临时力量
        const tempPowerEvts = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
        expect(tempPowerEvts.length).toBe(2);
        expect(tempPowerEvts.every((e: any) => e.payload.amount === 1)).toBe(true);
        const buffedUids = tempPowerEvts.map((e: any) => e.payload.minionUid).sort();
        expect(buffedUids).toEqual(['mine1', 'mine2']);
        // 对手随从不受影响
        expect(tempPowerEvts.some((e: any) => e.payload.minionUid === 'enemy1')).toBe(false);
    });

    it('手中无疯狂卡时无效果', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'miskatonic_it_might_just_work', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_test', ongoingActions: [],
                minions: [makeMinion('mine1', 'test', '0', 3)],
            }],
        });

        const events = execPlayAction(state, '0', 'a1');
        const discardEvts = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
        expect(discardEvts.length).toBe(0);
        const tempPowerEvts = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
        expect(tempPowerEvts.length).toBe(0);
    });

    it('有疯狂卡但无己方随从时：弃疯狂卡但无+1效果', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'miskatonic_it_might_just_work', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_test', ongoingActions: [],
                minions: [makeMinion('enemy1', 'test', '1', 5)],
            }],
        });

        const events = execPlayAction(state, '0', 'a1');
        // 仍弃掉1张疯狂卡（效果是"弃掉一张疯狂卡来..."，弃牌是代价）
        const discardEvts = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
        expect(discardEvts.length).toBe(1);
        // 无己方随从，无+1效果
        const tempPowerEvts = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
        expect(tempPowerEvts.length).toBe(0);
    });

    it('多基地上的己方随从都获得+1力量', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'miskatonic_it_might_just_work', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', ongoingActions: [], minions: [makeMinion('mine1', 'test', '0', 2)] },
                { defId: 'base_b', ongoingActions: [], minions: [makeMinion('mine2', 'test', '0', 4), makeMinion('enemy1', 'test', '1', 3)] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const tempPowerEvts = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
        // 两个基地上共2个己方随从
        expect(tempPowerEvts.length).toBe(2);
        const buffedUids = tempPowerEvts.map((e: any) => e.payload.minionUid).sort();
        expect(buffedUids).toEqual(['mine1', 'mine2']);
    });

    it('状态正确（reduce 验证）', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'miskatonic_it_might_just_work', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_test', ongoingActions: [],
                minions: [makeMinion('mine1', 'test', '0', 3)],
            }],
        });

        const events = execPlayAction(state, '0', 'a1');
        const newState = applyEvents(state, events);
        // 疯狂卡被弃掉（从手牌移除）
        expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(0);
        // 随从获得+1临时力量
        expect(newState.bases[0].minions[0].tempPowerModifier).toBe(1);
    });
});

// ============================================================================
// 米斯卡塔尼克大学 - miskatonic_book_of_iter_the_unseen（金克丝!）
// 中文版效果：从你的手牌和弃牌堆返回至多两张疯狂卡到疯狂卡牌堆
// ============================================================================

describe('米斯卡塔尼克大学 - miskatonic_book_of_iter_the_unseen（金克丝!）', () => {
    it('手牌和弃牌堆有疯狂卡时创建交互', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'miskatonic_book_of_iter_the_unseen', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    discard: [makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = execPlayActionWithMatch(state, '0', 'a1');
        const hasInteraction = !!result.matchState?.sys.interaction?.current || (result.matchState?.sys.interaction?.queue.length ?? 0) > 0;
        expect(hasInteraction).toBe(true);
        const interaction = result.matchState!.sys.interaction!.current ?? result.matchState!.sys.interaction!.queue[0];
        expect((interaction.data as any).sourceId).toBe('miskatonic_book_of_iter_the_unseen');
        // 应有多个选项（手牌1/手牌2/弃牌堆1/混合/不返回）
        expect((interaction.data as any).options.length).toBeGreaterThanOrEqual(4);
    });

    it('无疯狂卡时不创建交互', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'miskatonic_book_of_iter_the_unseen', 'action', '0')],
                    discard: [],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = execPlayActionWithMatch(state, '0', 'a1');
        const hasInteraction = !!result.matchState?.sys.interaction?.current || (result.matchState?.sys.interaction?.queue.length ?? 0) > 0;
        expect(hasInteraction).toBe(false);
    });

    it('选择从手牌返回1张疯狂卡后正确更新状态', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'miskatonic_book_of_iter_the_unseen', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = execPlayActionWithMatch(state, '0', 'a1');
        const newState = applyEvents(state, result.events);
        // 解决交互：从手牌返回1张
        const resolveResult = resolveInteraction(newState, 'miskatonic_book_of_iter_the_unseen', { source: 'hand', count: 1 }, Date.now());
        const finalState = applyEvents(resolveResult.state, resolveResult.events);
        // 手牌中的疯狂卡应被移除
        expect(finalState.players['0'].hand.some(c => c.uid === 'm1')).toBe(false);
        // 疯狂牌库应增加1张
        expect(finalState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE + 1);
    });

    it('选择跳过时不产生事件', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'miskatonic_book_of_iter_the_unseen', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = execPlayActionWithMatch(state, '0', 'a1');
        const newState = applyEvents(state, result.events);
        const resolveResult = resolveInteraction(newState, 'miskatonic_book_of_iter_the_unseen', { skip: true }, Date.now());
        expect(resolveResult.events.length).toBe(0);
    });
});

// ============================================================================
// 米斯卡塔尼克大学 - miskatonic_thing_on_the_doorstep（老詹金斯!?）
// 中文版效果：特殊：在一个基地计分前，消灭一个在那里拥有最高力量的随从
// ============================================================================

describe('米斯卡塔尼克大学 - miskatonic_thing_on_the_doorstep（老詹金斯!?）', () => {
    /** 直接调用 special 执行器（special 不走 execPlayAction） */
    function execSpecial(state: SmashUpCore, playerId: string, baseIndex: number) {
        const executor = resolveAbility('miskatonic_thing_on_the_doorstep', 'special');
        expect(executor).toBeDefined();
        const ms = makeMatchState(state);
        return executor!({
            state, matchState: ms, playerId,
            cardUid: 'special-card', defId: 'miskatonic_thing_on_the_doorstep',
            baseIndex, random: defaultRandom, now: Date.now(),
        });
    }

    it('唯一最高力量随从时直接消灭', () => {
        const state = makeStateWithMadness({
            bases: [{
                defId: 'base_test', ongoingActions: [],
                minions: [
                    makeMinion('weak', 'test_weak', '1', 2),
                    makeMinion('strong', 'test_strong', '0', 5),
                    makeMinion('mid', 'test_mid', '1', 3),
                ],
            }],
        });

        const result = execSpecial(state, '0', 0);
        // 最高力量是 strong(5)，直接消灭
        const destroyEvts = result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvts.length).toBe(1);
        expect((destroyEvts[0] as any).payload.minionUid).toBe('strong');
    });

    it('多个并列最高力量时创建选择交互', () => {
        const state = makeStateWithMadness({
            bases: [{
                defId: 'base_test', ongoingActions: [],
                minions: [
                    makeMinion('tie1', 'test_a', '0', 5),
                    makeMinion('tie2', 'test_b', '1', 5),
                    makeMinion('weak', 'test_c', '1', 2),
                ],
            }],
        });

        const result = execSpecial(state, '0', 0);
        // 并列最高力量，应创建交互让玩家选择
        expect(result.matchState).toBeDefined();
        const interaction = result.matchState!.sys.interaction;
        const hasInteraction = !!interaction?.current || (interaction?.queue?.length ?? 0) > 0;
        expect(hasInteraction).toBe(true);
        const i = interaction!.current ?? interaction!.queue[0];
        expect((i.data as any).sourceId).toBe('miskatonic_thing_on_the_doorstep');
        // 选项应只包含2个并列最高力量随从
        expect((i.data as any).options.length).toBe(2);
    });

    it('基地无随从时无效果', () => {
        const state = makeStateWithMadness({
            bases: [{ defId: 'base_test', ongoingActions: [], minions: [] }],
        });

        const result = execSpecial(state, '0', 0);
        const destroyEvts = result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvts.length).toBe(0);
    });

    it('状态正确（reduce 验证）- 唯一最高力量随从被消灭', () => {
        const state = makeStateWithMadness({
            bases: [{
                defId: 'base_test', ongoingActions: [],
                minions: [
                    makeMinion('target', 'test_strong', '1', 7),
                    makeMinion('survivor', 'test_weak', '0', 2),
                ],
            }],
        });

        const result = execSpecial(state, '0', 0);
        const newState = applyEvents(state, result.events);
        // target(7) 被消灭，survivor(2) 存活
        expect(newState.bases[0].minions.length).toBe(1);
        expect(newState.bases[0].minions[0].uid).toBe('survivor');
    });
});
