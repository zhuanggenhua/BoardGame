/**
 * 大杀四方 - 新增派系能力测试
 *
 * 覆盖：
 * - 黑熊骑兵：bear_cavalry_bear_cavalry, bear_cavalry_youre_screwed,
 *   bear_cavalry_bear_rides_you, bear_cavalry_youre_pretty_much_borscht,
 *   bear_cavalry_bear_necessities
 * - 米斯卡塔尼克大学：miskatonic_the_librarian, miskatonic_professor
 * - 印斯茅斯：innsmouth_the_locals
 * - 幽灵：ghost_spirit
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execute } from '../domain/reducer';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore,
    PlayerState,
    MinionOnBase,
    CardInstance,
    OngoingActionOnBase,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
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
    return { core, sys: { phase: 'playCards' } as any } as any;
}

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

// ============================================================================
// 黑熊骑兵派系
// ============================================================================

describe('黑熊骑兵派系能力', () => {
    describe('bear_cavalry_bear_cavalry（黑熊骑兵 onPlay）', () => {
        it('移动本基地对手随从到另一个基地', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'bear_cavalry_bear_cavalry', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m1', 'test', '1', 4)], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            const moveEvt = events.find(e => e.type === SU_EVENTS.MINION_MOVED);
            expect(moveEvt).toBeDefined();
            expect(moveEvt!.payload.minionUid).toBe('m1');
            expect(moveEvt!.payload.fromBaseIndex).toBe(0);
            expect(moveEvt!.payload.toBaseIndex).toBe(1);
        });

        it('本基地无对手随从时不产生移动事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'bear_cavalry_bear_cavalry', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            expect(events.find(e => e.type === SU_EVENTS.MINION_MOVED)).toBeUndefined();
        });
    });

    describe('bear_cavalry_youre_screwed（你们已经完蛋）', () => {
        it('从有己方随从的基地移动对手随从', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_youre_screwed', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m0', 'test', '0', 3), makeMinion('m1', 'test', '1', 5)], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultRandom
            );
            const moveEvt = events.find(e => e.type === SU_EVENTS.MINION_MOVED);
            expect(moveEvt).toBeDefined();
            expect(moveEvt!.payload.minionUid).toBe('m1');
            expect(moveEvt!.payload.toBaseIndex).toBe(1);
        });

        it('无己方随从时不产生移动事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_youre_screwed', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m1', 'test', '1', 5)], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultRandom
            );
            expect(events.find(e => e.type === SU_EVENTS.MINION_MOVED)).toBeUndefined();
        });
    });

    describe('bear_cavalry_bear_rides_you（与熊同行）', () => {
        it('移动己方随从到另一个基地', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_rides_you', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m0', 'test', '0', 5)], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultRandom
            );
            const moveEvt = events.find(e => e.type === SU_EVENTS.MINION_MOVED);
            expect(moveEvt).toBeDefined();
            expect(moveEvt!.payload.minionUid).toBe('m0');
            expect(moveEvt!.payload.toBaseIndex).toBe(1);
        });

        it('无己方随从时不产生移动事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_rides_you', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultRandom
            );
            expect(events.find(e => e.type === SU_EVENTS.MINION_MOVED)).toBeUndefined();
        });
    });

    describe('bear_cavalry_youre_pretty_much_borscht（你们都是美食）', () => {
        it('移动基地上所有对手随从', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_youre_pretty_much_borscht', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m0', 'test', '0', 3),
                        makeMinion('m1', 'test', '1', 4),
                        makeMinion('m2', 'test', '1', 2),
                    ], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultRandom
            );
            const moveEvts = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
            expect(moveEvts).toHaveLength(2);
            expect(moveEvts.map(e => e.payload.minionUid).sort()).toEqual(['m1', 'm2']);
        });
    });

    describe('bear_cavalry_bear_necessities（黑熊口粮）', () => {
        it('消灭对手最强随从', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'test', '1', 3),
                        makeMinion('m2', 'test', '1', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultRandom
            );
            const destroyEvt = events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvt).toBeDefined();
            expect(destroyEvt!.payload.minionUid).toBe('m2');
        });

        it('无对手随从时消灭对手持续行动卡', () => {
            const ongoing: OngoingActionOnBase = { uid: 'oa1', defId: 'test_ongoing', ownerId: '1' };
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [ongoing] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultRandom
            );
            const detachEvt = events.find(e => e.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvt).toBeDefined();
            expect(detachEvt!.payload.cardUid).toBe('oa1');
        });

        it('无目标时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultRandom
            );
            expect(events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBeUndefined();
            expect(events.find(e => e.type === SU_EVENTS.ONGOING_DETACHED)).toBeUndefined();
        });
    });
});

// ============================================================================
// 米斯卡塔尼克大学派系
// ============================================================================

describe('米斯卡塔尼克大学派系能力', () => {
    describe('miskatonic_the_librarian（图书管理员 onPlay）', () => {
        it('弃牌堆有≥2张行动卡时取回2张', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'miskatonic_the_librarian', 'minion', '0')],
                        discard: [
                            makeCard('d1', 'some_action_a', 'action', '0'),
                            makeCard('d2', 'some_action_b', 'action', '0'),
                            makeCard('d3', 'some_minion', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            const recoverEvt = events.find(e => e.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD);
            expect(recoverEvt).toBeDefined();
            expect(recoverEvt!.payload.cardUids).toHaveLength(2);
            expect(recoverEvt!.payload.cardUids).toEqual(['d1', 'd2']);
        });

        it('弃牌堆行动卡不足2张时抽2张牌', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'miskatonic_the_librarian', 'minion', '0')],
                        deck: [
                            makeCard('dk1', 'card_a', 'minion', '0'),
                            makeCard('dk2', 'card_b', 'action', '0'),
                            makeCard('dk3', 'card_c', 'minion', '0'),
                        ],
                        discard: [
                            makeCard('d1', 'some_action', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            // 不应有取回事件
            expect(events.find(e => e.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBeUndefined();
            // 应有抽牌事件
            const drawEvt = events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvt).toBeDefined();
            expect(drawEvt!.payload.count).toBe(2);
            expect(drawEvt!.payload.cardUids).toEqual(['dk1', 'dk2']);
        });

        it('牌库和弃牌堆都为空时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'miskatonic_the_librarian', 'minion', '0')],
                        deck: [],
                        discard: [],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            expect(events.find(e => e.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBeUndefined();
            expect(events.find(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBeUndefined();
        });
    });

    describe('miskatonic_professor（教授 onPlay）', () => {
        it('将对手力量≤3的随从收回手牌', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'miskatonic_professor', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'weak_minion', '1', 2),
                        makeMinion('m2', 'strong_minion', '1', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            const returnEvt = events.find(e => e.type === SU_EVENTS.MINION_RETURNED);
            expect(returnEvt).toBeDefined();
            expect(returnEvt!.payload.minionUid).toBe('m1');
            expect(returnEvt!.payload.toPlayerId).toBe('1');
        });

        it('优先选力量最高的≤3随从', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'miskatonic_professor', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'weak_a', '1', 1),
                        makeMinion('m2', 'weak_b', '1', 3),
                        makeMinion('m3', 'weak_c', '1', 2),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            const returnEvt = events.find(e => e.type === SU_EVENTS.MINION_RETURNED);
            expect(returnEvt).toBeDefined();
            expect(returnEvt!.payload.minionUid).toBe('m2');
        });

        it('无力量≤3的对手随从时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'miskatonic_professor', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'strong', '1', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            expect(events.find(e => e.type === SU_EVENTS.MINION_RETURNED)).toBeUndefined();
        });
    });
});

// ============================================================================
// 印斯茅斯派系
// ============================================================================

describe('印斯茅斯派系能力', () => {
    describe('innsmouth_the_locals（本地人 onPlay）', () => {
        it('牌库顶有同名卡时放入手牌，其余放牌库底', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('dk1', 'innsmouth_the_locals', 'minion', '0'),
                            makeCard('dk2', 'other_card', 'action', '0'),
                            makeCard('dk3', 'innsmouth_the_locals', 'minion', '0'),
                            makeCard('dk4', 'deep_card', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            // 同名卡（dk1, dk3）应被抽到手牌
            const drawEvt = events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvt).toBeDefined();
            expect(drawEvt!.payload.cardUids).toEqual(['dk1', 'dk3']);
            expect(drawEvt!.payload.count).toBe(2);

            // 非同名卡（dk2）应放到牌库底
            const reshuffleEvt = events.find(e => e.type === SU_EVENTS.DECK_RESHUFFLED);
            expect(reshuffleEvt).toBeDefined();
            // 新牌库 = 剩余牌库（dk4）+ 放底的（dk2）
            expect(reshuffleEvt!.payload.deckUids).toEqual(['dk4', 'dk2']);
        });

        it('牌库顶3张无同名卡时全部放牌库底', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('dk1', 'card_a', 'minion', '0'),
                            makeCard('dk2', 'card_b', 'action', '0'),
                            makeCard('dk3', 'card_c', 'minion', '0'),
                            makeCard('dk4', 'card_d', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            // 无同名卡，不应有抽牌事件
            expect(events.find(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBeUndefined();
            // 3张全部放牌库底
            const reshuffleEvt = events.find(e => e.type === SU_EVENTS.DECK_RESHUFFLED);
            expect(reshuffleEvt).toBeDefined();
            // 新牌库 = 剩余（dk4）+ 放底的（dk1, dk2, dk3）
            expect(reshuffleEvt!.payload.deckUids).toEqual(['dk4', 'dk1', 'dk2', 'dk3']);
        });

        it('牌库为空时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            expect(events.find(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBeUndefined();
            expect(events.find(e => e.type === SU_EVENTS.DECK_RESHUFFLED)).toBeUndefined();
        });

        it('牌库不足3张时只检查可用的牌', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('dk1', 'innsmouth_the_locals', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            const drawEvt = events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvt).toBeDefined();
            expect(drawEvt!.payload.cardUids).toEqual(['dk1']);
        });
    });
});

// ============================================================================
// 幽灵派系
// ============================================================================

describe('幽灵派系能力', () => {
    describe('ghost_spirit（灵魂 onPlay）', () => {
        it('弃等量力量的手牌消灭对手随从', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'filler_a', 'minion', '0'),
                            makeCard('h2', 'filler_b', 'action', '0'),
                            makeCard('h3', 'filler_c', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'enemy_weak', '1', 2),
                        makeMinion('m2', 'enemy_strong', '1', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            // 手牌3张（排除自身），最强对手5力量 > 3张手牌，所以选2力量的
            // 弃2张手牌消灭力量2的随从
            const discardEvt = events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvt).toBeDefined();
            expect(discardEvt!.payload.cardUids).toHaveLength(2);

            const destroyEvt = events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvt).toBeDefined();
            // 优先选最强的能消灭的目标：力量5需要5张手牌（不够），力量2需要2张（够）
            // 但排序是降序，先检查5（不够），再检查2（够），所以消灭m1
            expect(destroyEvt!.payload.minionUid).toBe('m1');
        });

        it('手牌足够时优先消灭最强对手随从', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'f1', 'minion', '0'),
                            makeCard('h2', 'f2', 'action', '0'),
                            makeCard('h3', 'f3', 'minion', '0'),
                            makeCard('h4', 'f4', 'action', '0'),
                            makeCard('h5', 'f5', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'enemy_a', '1', 2),
                        makeMinion('m2', 'enemy_b', '1', 4),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            // 5张手牌（排除自身），力量4需要4张（够），优先选最强
            const destroyEvt = events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvt).toBeDefined();
            expect(destroyEvt!.payload.minionUid).toBe('m2');

            const discardEvt = events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvt).toBeDefined();
            expect(discardEvt!.payload.cardUids).toHaveLength(4);
        });

        it('手牌不足以消灭任何对手随从时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'filler', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'enemy', '1', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            // 只有1张可弃手牌，对手力量5，不够
            expect(events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBeUndefined();
            expect(events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED)).toBeUndefined();
        });

        it('无对手随从时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'filler', 'minion', '0'),
                            makeCard('h2', 'filler2', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m0', 'own', '0', 3),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const events = execute(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultRandom
            );
            expect(events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBeUndefined();
        });
    });
});
