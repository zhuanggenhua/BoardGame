/**
 * 大杀四方 - 僵尸 & 巫师派系新增能力测试
 *
 * 覆盖：CARD_RECOVERED_FROM_DISCARD 事件、HAND_SHUFFLED_INTO_DECK 事件、
 * 僵尸弃牌堆操作、巫师复杂行动卡
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
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { applyEvents } from './helpers';
import { makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';
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
    d: () => 1,
    range: (min: number) => min,
};

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number) {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_MINION, playerId,
        payload: { cardUid, baseIndex },
    } as any, defaultRandom);
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number) {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, defaultRandom);
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

// ============================================================================
// CARD_RECOVERED_FROM_DISCARD 事件 reducer 测试
// ============================================================================

describe('CARD_RECOVERED_FROM_DISCARD reducer', () => {
    it('从弃牌堆取回卡牌到手牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('d1', 'test_minion', 'minion', '0'),
                        makeCard('d2', 'test_action', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: { playerId: '0', cardUids: ['d1'], reason: 'test' },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.players['0'].hand.length).toBe(1);
        expect(newState.players['0'].hand[0].uid).toBe('d1');
        expect(newState.players['0'].discard.length).toBe(1);
        expect(newState.players['0'].discard[0].uid).toBe('d2');
    });

    it('取回多张卡牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('d1', 'test', 'minion', '0'),
                        makeCard('d2', 'test', 'minion', '0'),
                        makeCard('d3', 'other', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: { playerId: '0', cardUids: ['d1', 'd2'], reason: 'test' },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.players['0'].hand.length).toBe(2);
        expect(newState.players['0'].discard.length).toBe(1);
    });
});

// ============================================================================
// HAND_SHUFFLED_INTO_DECK 事件 reducer 测试
// ============================================================================

describe('HAND_SHUFFLED_INTO_DECK reducer', () => {
    it('手牌洗入牌库', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h1', 'a', 'minion', '0'), makeCard('h2', 'b', 'action', '0')],
                    deck: [makeCard('d1', 'c', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.HAND_SHUFFLED_INTO_DECK,
            payload: { playerId: '0', newDeckUids: ['d1', 'h2', 'h1'], reason: 'test' },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.players['0'].hand.length).toBe(0);
        expect(newState.players['0'].deck.length).toBe(3);
        expect(newState.players['0'].deck.map(c => c.uid)).toEqual(['d1', 'h2', 'h1']);
    });

    it('部分手牌洗入牌库时保留未选中的手牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h1', 'a', 'minion', '0'), makeCard('h2', 'b', 'action', '0'), makeCard('h3', 'c', 'minion', '0')],
                    deck: [makeCard('d1', 'd', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        // 只把 h1 放到牌库底，h2 和 h3 应保留在手牌
        const event: SmashUpEvent = {
            type: SU_EVENTS.HAND_SHUFFLED_INTO_DECK,
            payload: { playerId: '0', newDeckUids: ['d1', 'h1'], reason: 'field_trip' },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        // 手牌保留 h2, h3
        expect(newState.players['0'].hand.length).toBe(2);
        expect(newState.players['0'].hand.map(c => c.uid)).toEqual(['h2', 'h3']);
        // 牌库为 d1, h1
        expect(newState.players['0'].deck.length).toBe(2);
        expect(newState.players['0'].deck.map(c => c.uid)).toEqual(['d1', 'h1']);
    });
});


// ============================================================================
// 僵尸派系能力
// ============================================================================

describe('僵尸派系能力', () => {
    it('zombie_grave_digger: 单张随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'zombie_grave_digger', 'minion', '0')],
                    discard: [
                        makeCard('d1', 'test_action', 'action', '0'),
                        makeCard('d2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
        });

        const { matchState } = execPlayMinion(state, '0', 'm1', 0);
        // 单张随从时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('zombie_grave_digger');
    });

    it('zombie_grave_digger: 弃牌堆无随从时不产生事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'zombie_grave_digger', 'minion', '0')],
                    discard: [makeCard('d1', 'test_action', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
        });

        const { events } = execPlayMinion(state, '0', 'm1', 0);
        const recoverEvents = events.filter(e => e.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD);
        expect(recoverEvents.length).toBe(0);
    });

    it('zombie_walker: 创建 Prompt 选择弃掉或保留', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'zombie_walker', 'minion', '0')],
                    deck: [makeCard('d1', 'top_card', 'minion', '0'), makeCard('d2', 'second', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
        });

        const { matchState } = execPlayMinion(state, '0', 'm1', 0);
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('zombie_walker');
    });

    it('zombie_grave_robbing: 多张弃牌时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_grave_robbing', 'action', '0')],
                    discard: [
                        makeCard('d1', 'test_action', 'action', '0'),
                        makeCard('d2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 多张弃牌 → 创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('zombie_grave_robbing');
    });

    it('zombie_grave_robbing: 单张弃牌时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_grave_robbing', 'action', '0')],
                    discard: [makeCard('d1', 'test_action', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单张弃牌时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('zombie_grave_robbing');
    });

    it('zombie_not_enough_bullets: 多组同名随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_not_enough_bullets', 'action', '0')],
                    discard: [
                        makeCard('d1', 'zombie_walker', 'minion', '0'),
                        makeCard('d2', 'zombie_walker', 'minion', '0'),
                        makeCard('d3', 'zombie_grave_digger', 'minion', '0'),
                        makeCard('d4', 'zombie_walker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 2组不同 defId → 创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('zombie_not_enough_bullets');
    });

    it('zombie_not_enough_bullets: 单组同名随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_not_enough_bullets', 'action', '0')],
                    discard: [
                        makeCard('d1', 'zombie_walker', 'minion', '0'),
                        makeCard('d2', 'zombie_walker', 'minion', '0'),
                        makeCard('d4', 'zombie_walker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单组同名随从时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('zombie_not_enough_bullets');
    });

    it('zombie_lend_a_hand: 弃牌堆有卡时创建多选 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_lend_a_hand', 'action', '0')],
                    deck: [makeCard('d1', 'card_a', 'minion', '0')],
                    discard: [
                        makeCard('d2', 'card_b', 'minion', '0'),
                        makeCard('d3', 'card_c', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 弃牌堆有卡 → 创建多选 Prompt
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('zombie_lend_a_hand');
    });

    it('zombie_outbreak: 有空基地且有可打随从时，先选基地再给予额外随从额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'zombie_outbreak', 'action', '0'),
                        makeCard('m2', 'zombie_walker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 3)], ongoingActions: [] },
                { defId: 'b2', minions: [makeMinion('m1', 'test', '1', 2)], ongoingActions: [] },
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        // onPlay 只创建第一段交互，不立即发放额外额度
        const immediateLimitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(immediateLimitEvents.length).toBe(0);
        const current = (matchState.sys as any).interaction?.current;
        expect(current?.data?.sourceId).toBe('zombie_outbreak_choose_base');

        const chooseBaseHandler = getInteractionHandler('zombie_outbreak_choose_base');
        expect(chooseBaseHandler).toBeDefined();
        const resolved = chooseBaseHandler!(matchState, '0', { baseIndex: 1 }, undefined, defaultRandom, 1);
        expect(resolved).toBeDefined();
        const granted = resolved!.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(granted.length).toBe(1);
        expect((granted[0] as any).payload.limitType).toBe('minion');
    });

    it('zombie_outbreak: 所有基地都有己方随从时不给额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_outbreak', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 3)], ongoingActions: [] },
            ],
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents.length).toBe(0);
    });

    it('zombie_mall_crawl: 多组不同卡名时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_mall_crawl', 'action', '0')],
                    deck: [
                        makeCard('d1', 'zombie_walker', 'minion', '0'),
                        makeCard('d2', 'zombie_grave_digger', 'minion', '0'),
                        makeCard('d3', 'zombie_walker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('zombie_mall_crawl');
    });

    it('zombie_mall_crawl: 选择卡名后同名卡进入弃牌堆，牌库重洗', () => {
        // 模拟 interaction 解决时的状态：a1 已打出（在弃牌堆中），牌库有 4 张卡
        const stateAtInteraction = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    deck: [
                        makeCard('d1', 'zombie_walker', 'minion', '0'),
                        makeCard('d2', 'zombie_grave_digger', 'minion', '0'),
                        makeCard('d3', 'zombie_walker', 'minion', '0'),
                        makeCard('d4', 'test_card', 'action', '0'),
                    ],
                    discard: [
                        makeCard('a1', 'zombie_mall_crawl', 'action', '0'),
                        makeCard('x1', 'old_discard', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(stateAtInteraction);

        // 解决交互：选择 zombie_walker
        const handler = getInteractionHandler('zombie_mall_crawl');
        expect(handler).toBeDefined();
        const result = handler!(matchState, '0', { defId: 'zombie_walker' }, undefined, defaultRandom, 1);
        expect(result).toBeDefined();

        // 应用事件
        const finalState = applyEvents(stateAtInteraction, result!.events);

        // 验证：d1, d3 (zombie_walker) 应在弃牌堆中
        const discardUids = finalState.players['0'].discard.map(c => c.uid);
        expect(discardUids).toContain('d1');
        expect(discardUids).toContain('d3');

        // 验证：a1, x1（原弃牌堆的卡）应在牌库中（被 DECK_RESHUFFLED 合并进牌库）
        const deckUids = finalState.players['0'].deck.map(c => c.uid);
        expect(deckUids).toContain('a1');
        expect(deckUids).toContain('x1');

        // 验证：d2, d4 应在牌库中（非同名卡留在牌库）
        expect(deckUids).toContain('d2');
        expect(deckUids).toContain('d4');

        // 验证：牌库中不应有 zombie_walker
        const walkersInDeck = finalState.players['0'].deck.filter(c => c.defId === 'zombie_walker');
        expect(walkersInDeck.length).toBe(0);

        // 验证：总卡牌数守恒（4 deck + 2 discard = 6）
        const totalCards = finalState.players['0'].deck.length + finalState.players['0'].discard.length + finalState.players['0'].hand.length;
        expect(totalCards).toBe(6);
    });
});


// ============================================================================
// 巫师派系能力
// ============================================================================

describe('巫师派系能力（新增）', () => {
    it('wizard_winds_of_change: 洗手牌回牌库抽5张，额外行动', () => {
        const handCards = Array.from({ length: 3 }, (_, i) =>
            makeCard(`h${i}`, 'test_card', 'minion', '0')
        );
        const deckCards = Array.from({ length: 4 }, (_, i) =>
            makeCard(`d${i}`, 'deck_card', 'minion', '0')
        );
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_winds_of_change', 'action', '0'), ...handCards],
                    deck: deckCards,
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');

        // 应有：ACTION_PLAYED + HAND_SHUFFLED_INTO_DECK + CARDS_DRAWN + LIMIT_MODIFIED
        const shuffleEvents = events.filter(e => e.type === SU_EVENTS.HAND_SHUFFLED_INTO_DECK);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);

        expect(shuffleEvents.length).toBe(1);
        expect(drawEvents.length).toBe(1);
        expect(limitEvents.length).toBe(1);
        expect((limitEvents[0] as any).payload.limitType).toBe('action');

        // 洗入后牌库应有 3(剩余手牌) + 4(原牌库) = 7 张
        const newDeckUids = (shuffleEvents[0] as any).payload.newDeckUids;
        expect(newDeckUids.length).toBe(7);

        // 抽5张
        expect((drawEvents[0] as any).payload.count).toBe(5);

        // 验证完整状态
        const newState = applyEvents(state, events);
        expect(newState.players['0'].hand.length).toBe(5);
        expect(newState.players['0'].deck.length).toBe(2); // 7 - 5 = 2
    });

    it('wizard_winds_of_change: 牌库+手牌不足5张时抽全部', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'wizard_winds_of_change', 'action', '0'),
                        makeCard('h1', 'test', 'minion', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        // 只有 h1 + d1 = 2 张可抽
        expect((drawEvents[0] as any).payload.count).toBe(2);

        const newState = applyEvents(state, events);
        expect(newState.players['0'].hand.length).toBe(2);
        expect(newState.players['0'].deck.length).toBe(0);
    });

    it('wizard_sacrifice: 多个己方随从时创建 Prompt 选择', () => {
        const deckCards = Array.from({ length: 10 }, (_, i) =>
            makeCard(`d${i}`, 'test_card', 'minion', '0')
        );
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_sacrifice', 'action', '0')],
                    deck: deckCards,
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1', minions: [
                    makeMinion('m0', 'test_weak', '0', 2),
                    makeMinion('m1', 'test_strong', '0', 5),
                ], ongoingActions: [],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_sacrifice');
    });

    it('wizard_sacrifice: 没有己方随从时不产生事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_sacrifice', 'action', '0')],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3)], ongoingActions: [],
            }],
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(destroyEvents.length).toBe(0);
        expect(drawEvents.length).toBe(0);
    });

    it('wizard_sacrifice: 单个己方随从时创建 Prompt', () => {
        const deckCards = Array.from({ length: 10 }, (_, i) =>
            makeCard(`d${i}`, 'test_card', 'minion', '0')
        );
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_sacrifice', 'action', '0')],
                    deck: deckCards,
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1', minions: [
                    { ...makeMinion('m0', 'test', '0', 3), powerModifier: 2 }, // 总力量 5
                ], ongoingActions: [],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单个己方随从时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_sacrifice');
    });
});
