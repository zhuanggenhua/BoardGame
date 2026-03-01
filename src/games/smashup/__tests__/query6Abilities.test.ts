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

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number, random?: RandomFn) {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_MINION, playerId,
        payload: { cardUid, baseIndex },
    } as any, random ?? defaultRandom);
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn) {
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
// 海盗派系 - 移动/炸药桶
// ============================================================================

describe('海盗派系能力（第6批）', () => {
    it('pirate_dinghy: 多个己方随从时创建 Prompt 选择', () => {
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

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_dinghy_choose_first');
    });

    it('pirate_dinghy: 只有一个己方随从时创建 Prompt', () => {
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

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_dinghy_choose_first');
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(0);
    });

    it('pirate_shanghai: 多目标时创建 Prompt 选择随从', () => {
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

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 多个对手随从时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_shanghai_choose_minion');
    });

    it('pirate_sea_dogs: 多目标时创建 Prompt 选择派系', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_sea_dogs', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'robot_zapbot', '1', 5), makeMinion('m2', 'robot_hoverbot', '1', 2)], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 现在先选派系
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_sea_dogs_choose_faction');
    });

    it('pirate_powderkeg: 单个己方随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_powderkeg', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1', minions: [
                    makeMinion('m0', 'test', '0', 2), // 己方力量最低
                    makeMinion('m1', 'test', '1', 2), // 对手力量=2
                    makeMinion('m2', 'test', '1', 5), // 对手力量=5
                ], ongoingActions: [],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单个己方随从时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_powderkeg');
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents.length).toBe(0);
    });

});

// ============================================================================
// 忍者派系 - 欺骗/伪装
// ============================================================================

describe('忍者派系能力（第6批）', () => {
    it('ninja_way_of_deception: 多个己方随从时创建 Prompt 选择', () => {
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

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('ninja_way_of_deception_choose_minion');
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(0);
    });

    it('ninja_disguise: 单个己方随从时创建 Prompt', () => {
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

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单个己方随从时直接跳到选随从
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('ninja_disguise_choose_minions');
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const returnEvents = events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
        expect(returnEvents.length).toBe(0);
    });

    it('ninja_disguise: 有己方随从但手牌无随从时不创建 Prompt', () => {
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        // 手牌无随从时 maxSelect=0，不创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeUndefined();
        expect(events.filter(e => e.type === SU_EVENTS.MINION_RETURNED).length).toBe(0);
    });
});

// ============================================================================
// 巫师派系 - 群体附魔/传送门/占卜/献祭/变化之风
// ============================================================================

describe('巫师派系能力（第6批）', () => {
    it('wizard_mass_enchantment: 单个对手时创建 Prompt', () => {
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

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单个对手时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_mass_enchantment');
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('wizard_portal: 有随从时创建选择 Prompt 让玩家选随从', () => {
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        // 不应该自动抽牌，而是创建选择随从的 Interaction
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_portal_pick');
        // 应该有2个随从选项
        expect(current?.data?.options?.length).toBe(2);
        // 多选配置：min=0, max=2
        expect(current?.data?.multi).toEqual({ min: 0, max: 2 });
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('wizard_portal: 顶部5张全是行动卡时不抽牌但创建排序 Prompt', () => {
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
        // 多张非随从卡时创建排序 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_portal_order');
    });

    it('wizard_scry: 单张行动卡时创建 Prompt', () => {
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

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单张行动卡时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_scry');
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('wizard_sacrifice: 多个己方随从时创建 Prompt 选择', () => {
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

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_sacrifice');
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
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
    it('alien_scout: 打出时无 onPlay 交互（能力为 afterScoring 触发）', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'alien_invader', 'minion', '0'),
                        makeCard('d2', 'test_action', 'action', '0'),
                        makeCard('d3', 'alien_supreme_overlord', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        const current = (matchState.sys as any).interaction?.current;
        // 侦察兵没有 onPlay 能力，不应创建交互
        expect(current).toBeUndefined();
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

        const { events, matchState } = execPlayMinion(state, '0', 'm_scout', 0);
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

        const { events, matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });
});
