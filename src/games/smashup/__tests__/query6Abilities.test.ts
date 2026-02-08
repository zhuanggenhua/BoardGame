/**
 * 大杀四方 - 第6批能力测试（移动/搜索/伪装类）
 *
 * 覆盖：
 * - 海盗：pirate_dinghy（小艇）、pirate_shanghai（上海）、pirate_sea_dogs（海狗）、pirate_powderkeg（炸药桶）
 * - 忍者：ninja_way_of_deception（欺骗之道）、ninja_disguise（伪装）
 * - 巫师：wizard_mass_enchantment（群体附魔）、wizard_portal（传送门）、wizard_scry（占卜）
 *         wizard_sacrifice（献祭）、wizard_winds_of_change（变化之风）
 * - 外星人：alien_scout（侦察兵）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execute, reduce } from '../domain/reducer';
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

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number, random?: RandomFn): SmashUpEvent[] {
    return execute(makeMatchState(state), {
        type: SU_COMMANDS.PLAY_MINION, playerId,
        payload: { cardUid, baseIndex },
    } as any, random ?? defaultRandom);
}

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn): SmashUpEvent[] {
    return execute(makeMatchState(state), {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
}

function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
}

// ============================================================================
// 海盗派系 - 移动/炸药桶
// ============================================================================

describe('海盗派系能力（第6批）', () => {
    it('pirate_dinghy: 移动至多两个己方随从到其他基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_dinghy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2), makeMinion('m1', 'test', '0', 3)], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(2);
        // 力量最低的先移动
        expect((moveEvents[0] as any).payload.minionUid).toBe('m0');
        expect((moveEvents[0] as any).payload.toBaseIndex).toBe(1);
    });

    it('pirate_dinghy: 只有一个己方随从时只移动一个', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_dinghy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2)], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(1);
    });

    it('pirate_dinghy: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_dinghy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3)], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(0);
    });

    it('pirate_shanghai: 移动最强对手随从到己方随从最多的基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_shanghai', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 5), makeMinion('m2', 'test', '1', 3)], ongoingActions: [] },
                { defId: 'b2', minions: [makeMinion('m3', 'test', '0', 4), makeMinion('m4', 'test', '0', 2)], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(1);
        expect((moveEvents[0] as any).payload.minionUid).toBe('m1'); // 最强对手随从
        expect((moveEvents[0] as any).payload.toBaseIndex).toBe(1); // 己方随从最多的基地
    });

    it('pirate_sea_dogs: 移动最弱对手随从到随从最少的基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_sea_dogs', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 5), makeMinion('m2', 'test', '1', 2)], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(1);
        expect((moveEvents[0] as any).payload.minionUid).toBe('m2'); // 最弱
        expect((moveEvents[0] as any).payload.toBaseIndex).toBe(1); // 随从最少
    });

    it('pirate_powderkeg: 消灭己方随从并消灭同基地力量≤被消灭随从的随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_powderkeg', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1', minions: [
                    makeMinion('m0', 'test', '0', 2), // 己方力量最低，被牺牲
                    makeMinion('m1', 'test', '1', 2), // 对手力量=2，≤被消灭随从，也被消灭
                    makeMinion('m2', 'test', '1', 5), // 对手力量=5，>2，存活
                ], ongoingActions: [],
            }],
        });

        const events = execPlayAction(state, '0', 'a1');
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents.length).toBe(2);
        // 第一个是己方随从被牺牲
        expect((destroyEvents[0] as any).payload.minionUid).toBe('m0');
        // 第二个是同基地力量≤2的对手随从
        expect((destroyEvents[1] as any).payload.minionUid).toBe('m1');
    });

    it('pirate_powderkeg: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_powderkeg', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1', minions: [
                    makeMinion('m1', 'test', '1', 3),
                ], ongoingActions: [],
            }],
        });

        const events = execPlayAction(state, '0', 'a1');
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents.length).toBe(0);
    });

});

// ============================================================================
// 忍者派系 - 欺骗/伪装
// ============================================================================

describe('忍者派系能力（第6批）', () => {
    it('ninja_way_of_deception: 移动己方最强随从到随从最少的基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 5), makeMinion('m1', 'test', '0', 2)], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(1);
        expect((moveEvents[0] as any).payload.minionUid).toBe('m0'); // 最强
        expect((moveEvents[0] as any).payload.toBaseIndex).toBe(1); // 随从最少
    });

    it('ninja_way_of_deception: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3)], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(0);
    });

    it('ninja_way_of_deception: 只有一个基地时无法移动', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 5)], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(0);
    });

    it('ninja_disguise: 返回己方最弱随从并打出手牌中最强随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ninja_disguise', 'action', '0'),
                        makeCard('m_hand', 'ninja_master', 'minion', '0'), // 手牌中的随从
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2)], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const returnEvents = events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
        const playEvents = events.filter(e => e.type === SU_EVENTS.MINION_PLAYED);
        expect(returnEvents.length).toBe(1);
        expect((returnEvents[0] as any).payload.minionUid).toBe('m0');
        expect(playEvents.length).toBe(1);
        expect((playEvents[0] as any).payload.baseIndex).toBe(0); // 打到同一基地
    });

    it('ninja_disguise: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ninja_disguise', 'action', '0'),
                        makeCard('m_hand', 'ninja_master', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3)], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const returnEvents = events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
        expect(returnEvents.length).toBe(0);
    });

    it('ninja_disguise: 有己方随从但手牌无随从时只返回不打出', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_disguise', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2)], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const returnEvents = events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
        const playEvents = events.filter(e => e.type === SU_EVENTS.MINION_PLAYED);
        expect(returnEvents.length).toBe(1);
        expect(playEvents.length).toBe(0);
    });
});

// ============================================================================
// 巫师派系 - 群体附魔/传送门/占卜/献祭/变化之风
// ============================================================================

describe('巫师派系能力（第6批）', () => {
    it('wizard_mass_enchantment: 从对手牌库顶取一张卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'test_action', 'action', '1'), makeCard('d2', 'test_minion', 'minion', '1')],
                }),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(1);
        expect((drawEvents[0] as any).payload.cardUids).toContain('d1');
    });

    it('wizard_mass_enchantment: 对手牌库为空时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1', { deck: [] }),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('wizard_portal: 从牌库顶5张中取出随从放入手牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_a', 'action', '0'),
                        makeCard('d2', 'test_m', 'minion', '0'),
                        makeCard('d3', 'test_a2', 'action', '0'),
                        makeCard('d4', 'test_m2', 'minion', '0'),
                        makeCard('d5', 'test_a3', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(1);
        // 应该抽到2个随从
        expect((drawEvents[0] as any).payload.cardUids).toEqual(['d2', 'd4']);
        expect((drawEvents[0] as any).payload.count).toBe(2);
    });

    it('wizard_portal: 牌库为空时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('wizard_portal: 顶部5张全是行动卡时不抽牌但重排牌库', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_a', 'action', '0'),
                        makeCard('d2', 'test_a2', 'action', '0'),
                        makeCard('d3', 'test_a3', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        const reshuffleEvents = events.filter(e => e.type === SU_EVENTS.DECK_RESHUFFLED);
        expect(drawEvents.length).toBe(0);
        expect(reshuffleEvents.length).toBe(1);
    });

    it('wizard_scry: 从牌库搜索一张行动卡放入手牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_scry', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_m', 'minion', '0'),
                        makeCard('d2', 'test_a', 'action', '0'),
                        makeCard('d3', 'test_m2', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(1);
        expect((drawEvents[0] as any).payload.cardUids).toEqual(['d2']);
    });

    it('wizard_scry: 牌库无行动卡时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_scry', 'action', '0')],
                    deck: [makeCard('d1', 'test_m', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('wizard_sacrifice: 消灭己方最弱随从并抽等量力量的牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_sacrifice', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test1', 'minion', '0'),
                        makeCard('d2', 'test2', 'action', '0'),
                        makeCard('d3', 'test3', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 3), makeMinion('m1', 'test', '0', 5)], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(destroyEvents.length).toBe(1);
        expect((destroyEvents[0] as any).payload.minionUid).toBe('m0'); // 力量最低
        expect(drawEvents.length).toBe(1);
        expect((drawEvents[0] as any).payload.count).toBe(3); // 抽3张（等于被消灭随从力量）
    });

    it('wizard_sacrifice: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_sacrifice', 'action', '0')],
                    deck: [makeCard('d1', 'test1', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3)], ongoingActions: [] },
            ],
        });

        const events = execPlayAction(state, '0', 'a1');
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents.length).toBe(0);
    });

    it('wizard_winds_of_change: 洗手牌回牌库抽5张并额外打出一个行动', () => {
        const handCards = [
            makeCard('a1', 'wizard_winds_of_change', 'action', '0'),
            makeCard('h1', 'test1', 'minion', '0'),
            makeCard('h2', 'test2', 'action', '0'),
        ];
        const deckCards = [
            makeCard('d1', 'test3', 'minion', '0'),
            makeCard('d2', 'test4', 'action', '0'),
            makeCard('d3', 'test5', 'minion', '0'),
            makeCard('d4', 'test6', 'action', '0'),
            makeCard('d5', 'test7', 'minion', '0'),
            makeCard('d6', 'test8', 'action', '0'),
        ];
        const state = makeState({
            players: {
                '0': makePlayer('0', { hand: handCards, deck: deckCards }),
                '1': makePlayer('1'),
            },
        });

        const events = execPlayAction(state, '0', 'a1');
        const shuffleEvents = events.filter(e => e.type === SU_EVENTS.HAND_SHUFFLED_INTO_DECK);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);

        expect(shuffleEvents.length).toBe(1);
        expect(drawEvents.length).toBe(1);
        expect((drawEvents[0] as any).payload.count).toBe(5);
        expect(limitEvents.length).toBe(1);
        expect((limitEvents[0] as any).payload.limitType).toBe('action');
    });
});

// ============================================================================
// 外星人派系 - 侦察兵
// ============================================================================

describe('外星人派系能力（第6批）', () => {
    it('alien_scout: 从牌库搜索力量最高的随从放入手牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'alien_invader', 'minion', '0'),   // 力量3
                        makeCard('d2', 'test_action', 'action', '0'),
                        makeCard('d3', 'alien_supreme_overlord', 'minion', '0'), // 力量5
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [], ongoingActions: [] },
            ],
        });

        const events = execPlayMinion(state, '0', 'm_scout', 0);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        // 应该有抽牌事件（搜索到力量最高的随从）
        expect(drawEvents.length).toBeGreaterThanOrEqual(1);
        // 找到 onPlay 触发的抽牌（排除打出随从本身的事件）
        const scoutDraw = drawEvents.find(e => (e as any).payload.count === 1);
        if (scoutDraw) {
            expect((scoutDraw as any).payload.cardUids.length).toBe(1);
        }
    });

    it('alien_scout: 牌库无随从时无抽牌事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'test_action', 'action', '0'),
                        makeCard('d2', 'test_action2', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [], ongoingActions: [] },
            ],
        });

        const events = execPlayMinion(state, '0', 'm_scout', 0);
        // 只有 MINION_PLAYED 事件，没有额外抽牌
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('alien_scout: 牌库为空时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [], ongoingActions: [] },
            ],
        });

        const events = execPlayMinion(state, '0', 'm_scout', 0);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });
});
