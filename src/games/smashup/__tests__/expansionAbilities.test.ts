/**
 * 大杀四方 - 扩展派系能力测试
 *
 * 覆盖：
 * - 幽灵派系：ghost_ghost, ghost_seance, ghost_shady_deal, ghost_ghostly_arrival
 * - 黑熊骑兵：bear_cavalry_bear_hug, bear_cavalry_commission
 * - 蒸汽朋克：steampunk_scrap_diving
 * - 食人花：killer_plant_insta_grow, killer_plant_weed_eater
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
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { applyEvents, makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';
import type { MatchState, RandomFn } from '../../../engine/types';

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

/** 保存最近一次 execute 调用的 matchState 引用，用于检查 interaction */
let lastMatchState: MatchState<SmashUpCore> | null = null;

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
// 幽灵派系
// ============================================================================

describe('幽灵派系能力', () => {
    describe('ghost_ghost（幽灵：弃一张手牌）', () => {
        it('多张手牌时创建 Prompt 选择弃牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('m1', 'ghost_ghost', 'minion', '0'),
                            makeCard('h1', 'test_card', 'action', '0'),
                            makeCard('h2', 'test_card2', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            // 多张可弃手牌时应创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('ghost_ghost');
        });

        it('单张手牌时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('m1', 'ghost_ghost', 'minion', '0'),
                            makeCard('h1', 'test_card', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            // 单张手牌时创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
        });

        it('无其他手牌时不弃牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'ghost_ghost', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvents.length).toBe(0);
        });

        it('单张手牌时 Prompt 待决（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('m1', 'ghost_ghost', 'minion', '0'),
                            makeCard('h1', 'test_card', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const newState = applyEvents(state, events);
            // Interaction 已创建（Prompt 待决），h1 仍在手牌
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(newState.players['0'].hand.some(c => c.uid === 'h1')).toBe(true);
            // m1 应在基地上
            expect(newState.bases[0].minions.some(m => m.uid === 'm1')).toBe(true);
        });
    });

    describe('ghost_seance（招魂：手牌≤2时抽到5张）', () => {
        it('手牌少时抽到5张', () => {
            const deckCards = Array.from({ length: 10 }, (_, i) =>
                makeCard(`d${i}`, 'test_card', 'minion', '0')
            );
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('a1', 'ghost_seance', 'action', '0'),
                            makeCard('h1', 'test', 'minion', '0'),
                        ],
                        deck: deckCards,
                    }),
                    '1': makePlayer('1'),
                },
            });

            // 打出 a1 后手牌剩 h1（1张），≤2 → 抽到5张 = 抽4张
            const events = execPlayAction(state, '0', 'a1');
            const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvents.length).toBe(1);
            expect((drawEvents[0] as any).payload.count).toBe(4);
        });

        it('手牌多时不抽牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('a1', 'ghost_seance', 'action', '0'),
                            makeCard('h1', 'test', 'minion', '0'),
                            makeCard('h2', 'test', 'minion', '0'),
                            makeCard('h3', 'test', 'minion', '0'),
                        ],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            // 打出后手牌剩3张 > 2 → 不抽
            const events = execPlayAction(state, '0', 'a1');
            const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvents.length).toBe(0);
        });
    });

    describe('ghost_shady_deal（阴暗交易：手牌≤2时获得1VP）', () => {
        it('手牌少时获得1VP', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'ghost_shady_deal', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            // 打出后手牌0张 ≤ 2 → 获得1VP
            const events = execPlayAction(state, '0', 'a1');
            const vpEvents = events.filter(e => e.type === SU_EVENTS.VP_AWARDED);
            expect(vpEvents.length).toBe(1);
            expect((vpEvents[0] as any).payload.amount).toBe(1);
            expect((vpEvents[0] as any).payload.playerId).toBe('0');
        });

        it('手牌多时不获得VP', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('a1', 'ghost_shady_deal', 'action', '0'),
                            makeCard('h1', 'test', 'minion', '0'),
                            makeCard('h2', 'test', 'minion', '0'),
                            makeCard('h3', 'test', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            // 打出后手牌3张 > 2 → 不获得VP
            const events = execPlayAction(state, '0', 'a1');
            const vpEvents = events.filter(e => e.type === SU_EVENTS.VP_AWARDED);
            expect(vpEvents.length).toBe(0);
        });

        it('VP 正确累加（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        vp: 3,
                        hand: [makeCard('a1', 'ghost_shady_deal', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            expect(newState.players['0'].vp).toBe(4);
        });
    });

    describe('ghost_ghostly_arrival（悄然而至：额外随从+行动）', () => {
        it('给予额外随从和行动额度', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'ghost_ghostly_arrival', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(2);
            const types = limitEvents.map(e => (e as any).payload.limitType);
            expect(types).toContain('minion');
            expect(types).toContain('action');
        });

        it('额度正确累加（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'ghost_ghostly_arrival', 'action', '0')],
                        minionLimit: 1,
                        actionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            expect(newState.players['0'].minionLimit).toBe(2);
            // actionLimit: 原1 + 1(额外) = 2
            expect(newState.players['0'].actionLimit).toBe(2);
        });
    });
});


// ============================================================================
// 黑熊骑兵派系
// ============================================================================

describe('黑熊骑兵派系能力', () => {
    describe('bear_cavalry_bear_hug（黑熊擒抱：每位对手消灭最弱随从）', () => {
        it('每位对手消灭自己最弱随从', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    {
                        defId: 'b1', minions: [
                            makeMinion('m0', 'test', '0', 5),
                            makeMinion('m1', 'test', '1', 3),
                            makeMinion('m2', 'test', '1', 6),
                        ], ongoingActions: [],
                    },
                    {
                        defId: 'b2', minions: [
                            makeMinion('m3', 'test', '1', 1), // 最弱
                        ], ongoingActions: [],
                    },
                ],
            });

            const events = execPlayAction(state, '0', 'a1');
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            // P1 最弱随从是 m3（力量1）
            expect(destroyEvents.length).toBe(1);
            expect((destroyEvents[0] as any).payload.minionUid).toBe('m3');
        });

        it('多个对手各消灭一个', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                    '2': makePlayer('2'),
                },
                turnOrder: ['0', '1', '2'],
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '1', 2),
                        makeMinion('m2', 'test', '2', 4),
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(2);
            const destroyedUids = destroyEvents.map(e => (e as any).payload.minionUid);
            expect(destroyedUids).toContain('m1');
            expect(destroyedUids).toContain('m2');
        });

        it('对手无随从时不产生事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m0', 'test', '0', 5),
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(0);
        });

        it('消灭后状态正确（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '1', 2),
                        makeMinion('m2', 'test', '1', 5),
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // m1（力量2）被消灭，m2 存活
            expect(newState.bases[0].minions.length).toBe(1);
            expect(newState.bases[0].minions[0].uid).toBe('m2');
            expect(newState.players['1'].discard.some(c => c.uid === 'm1')).toBe(true);
        });

        it('不消灭己方随从', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m0', 'test', '0', 1), // 己方力量1，不应被消灭
                        makeMinion('m1', 'test', '1', 3),
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(1);
            expect((destroyEvents[0] as any).payload.minionUid).toBe('m1');
        });
    });

    describe('bear_cavalry_commission（委任：额外随从）', () => {
        it('给予额外随从额度', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_commission', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);
            expect((limitEvents[0] as any).payload.limitType).toBe('minion');
            expect((limitEvents[0] as any).payload.delta).toBe(1);
        });
    });
});

// ============================================================================
// 蒸汽朋克派系
// ============================================================================

describe('蒸汽朋克派系能力', () => {
    describe('steampunk_scrap_diving（废物利用：从弃牌堆取回行动卡）', () => {
        it('多张行动卡时创建 Prompt 选择取回', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                        discard: [
                            makeCard('d1', 'test_minion', 'minion', '0'),
                            makeCard('d2', 'test_action', 'action', '0'),
                            makeCard('d3', 'test_action2', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            // 多张行动卡时应创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('steampunk_scrap_diving');
        });

        it('单张行动卡时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                        discard: [
                            makeCard('d1', 'test_minion', 'minion', '0'),
                            makeCard('d2', 'test_action', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            // 单张行动卡时创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
        });

        it('弃牌堆无行动卡时不产生事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                        discard: [makeCard('d1', 'test_minion', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const recoverEvents = events.filter(e => e.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD);
            expect(recoverEvents.length).toBe(0);
        });

        it('单张行动卡时 Prompt 待决（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                        discard: [
                            makeCard('d1', 'test_action', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // Interaction 已创建（Prompt 待决），d1 仍在弃牌堆
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(newState.players['0'].discard.some(c => c.uid === 'a1')).toBe(true);
            expect(newState.players['0'].discard.some(c => c.uid === 'd1')).toBe(true);
        });
    });
});

// ============================================================================
// 食人花派系
// ============================================================================

describe('食人花派系能力', () => {
    describe('killer_plant_insta_grow（急速生长：额外随从）', () => {
        it('给予额外随从额度', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'killer_plant_insta_grow', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);
            expect((limitEvents[0] as any).payload.limitType).toBe('minion');
            expect((limitEvents[0] as any).payload.delta).toBe(1);
        });

        it('额度正确累加（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'killer_plant_insta_grow', 'action', '0')],
                        minionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            expect(newState.players['0'].minionLimit).toBe(2);
        });
    });

    describe('killer_plant_weed_eater（野生食人花：打出回合-2力量）', () => {
        it('打出时获得-2力量修正', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'killer_plant_weed_eater', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const powerEvents = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
            expect(powerEvents.length).toBe(1);
            expect((powerEvents[0] as any).payload.minionUid).toBe('m1');
            expect((powerEvents[0] as any).payload.amount).toBe(-2);
        });

        it('力量修正正确应用（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'killer_plant_weed_eater', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const newState = applyEvents(state, events);
            const minion = newState.bases[0].minions.find(m => m.uid === 'm1');
            expect(minion).toBeDefined();
            // TEMP_POWER_ADDED amount=-2 → tempPowerModifier = -2
            expect(minion!.tempPowerModifier).toBe(-2);
        });
    });
});

// ============================================================================
// 完成仪式 (Complete the Ritual) - playConstraint: requireOwnMinion
// ============================================================================

describe('cthulhu_complete_the_ritual 打出约束', () => {
    it('目标基地有自己随从时可以打出', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_complete_the_ritual', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [makeMinion('m1', 'test_minion', '0', 3)],
                ongoingActions: [],
            }],
            baseDeck: ['b2'],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1', targetBaseIndex: 0 },
        } as any);
        expect(result.success).toBe(true);
    });

    it('目标基地没有自己随从时被拒绝', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_complete_the_ritual', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [makeMinion('m1', 'test_minion', '1', 3)], // 对手的随从
                ongoingActions: [],
            }],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1', targetBaseIndex: 0 },
        } as any);
        expect(result.success).toBe(false);
        expect(result.error).toContain('随从');
    });

    it('目标基地无随从时被拒绝', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_complete_the_ritual', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [],
                ongoingActions: [],
            }],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1', targetBaseIndex: 0 },
        } as any);
        expect(result.success).toBe(false);
        expect(result.error).toContain('随从');
    });
});
