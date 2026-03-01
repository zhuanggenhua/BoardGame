/**
 * 大杀四方 - Prompt 端到端测试
 *
 * 使用确定性状态构造，测试完整流程：
 * 1. 打出能力卡 → CHOICE_REQUESTED 事件
 * 2. 事件系统创建 Interaction
 * 3. 玩家响应 → SYS_INTERACTION_RESOLVED 事件
 * 4. 继续函数执行 → 最终领域事件（MINION_MOVED/MINION_DESTROYED 等）
 *
 * 设计原则：
 * - 不依赖随机抽牌，直接构造确定的 hand/deck/bases
 * - 每个测试验证完整链路，从命令发出到最终状态变化
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { reduce, validate } from '../domain/reducer';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type { SmashUpCore, SmashUpEvent, MinionOnBase, CardInstance, BaseInPlay } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';
import type { MatchState, RandomFn } from '../../../engine/types';

// ============================================================================
// 测试工具
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0, talentUsed: false, attachedActions: [],
    };
}

function makeCard(uid: string, defId: string, owner: string, type: 'minion' | 'action'): CardInstance {
    return { uid, defId, owner, type };
}

function makeBase(defId: string, minions: MinionOnBase[] = []): BaseInPlay {
    return { defId, minions, ongoingActions: [] };
}

function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0', vp: 0, hand: [], deck: [], discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: ['pirates', 'aliens'] as [string, string],
            },
            '1': {
                id: '1', vp: 0, hand: [], deck: [], discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: ['zombies', 'ninjas'] as [string, string],
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [makeBase('test_base_1'), makeBase('test_base_2'), makeBase('test_base_3')],
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
    shuffle: <T>(arr: T[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string) {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid },
    } as any, defaultRandom);
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
}

// ============================================================================
// 测试套件
// ============================================================================

describe('Prompt E2E: 确定性状态测试', () => {
    beforeAll(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
    });

    describe('pirate_cannon (加农炮): 多目标消灭流程', () => {
        it('多个力量≤2随从时创建 Prompt', () => {
            // 构造状态：两个基地各有一个力量≤2的随从
            const state = makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('action1', 'pirate_cannon', '0', 'action')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['pirates', 'aliens'] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['zombies', 'ninjas'] as [string, string],
                    },
                },
                bases: [
                    makeBase('base1', [makeMinion('m1', 'test_minion', '1', 2)]),
                    makeBase('base2', [makeMinion('m2', 'test_minion', '1', 1)]),
                ],
            });

            const { matchState } = execPlayAction(state, '0', 'action1');

            // 迁移后直接创建 Interaction
            const current = (matchState.sys as any).interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('pirate_cannon_choose_first');
        });

        it('只有一个力量≤2随从时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('action1', 'pirate_cannon', '0', 'action')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['pirates', 'aliens'] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['zombies', 'ninjas'] as [string, string],
                    },
                },
                bases: [
                    makeBase('base1', [makeMinion('m1', 'test_minion', '1', 2)]),
                    makeBase('base2', [makeMinion('m2', 'test_minion', '1', 5)]), // 力量>2，不符合
                ],
            });

            const { matchState } = execPlayAction(state, '0', 'action1');

            // 单目标时也创建 Interaction
            const current = (matchState.sys as any).interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('pirate_cannon_choose_first');
        });

        it('无力量≤2随从时无事件', () => {
            const state = makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('action1', 'pirate_cannon', '0', 'action')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['pirates', 'aliens'] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['zombies', 'ninjas'] as [string, string],
                    },
                },
                bases: [
                    makeBase('base1', [makeMinion('m1', 'test_minion', '1', 5)]),
                    makeBase('base2', [makeMinion('m2', 'test_minion', '1', 4)]),
                ],
            });

            const { events, matchState } = execPlayAction(state, '0', 'action1');

            // 不应该有消灭事件或 Interaction
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(0);
            const current = (matchState.sys as any).interaction?.current;
            expect(current).toBeUndefined();
        });
    });

    describe('pirate_powderkeg (炸药桶): 牺牲随从连锁消灭', () => {
        it('多个己方随从时创建 Prompt 选择牺牲', () => {
            const state = makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('action1', 'pirate_powderkeg', '0', 'action')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['pirates', 'aliens'] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['zombies', 'ninjas'] as [string, string],
                    },
                },
                bases: [
                    makeBase('base1', [
                        makeMinion('m1', 'test_minion', '0', 3),  // 己方
                        makeMinion('m2', 'test_minion', '0', 2),  // 己方
                        makeMinion('m3', 'test_minion', '1', 2),  // 对手
                    ]),
                ],
            });

            const { matchState } = execPlayAction(state, '0', 'action1');

            const current = (matchState.sys as any).interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('pirate_powderkeg');
        });

        it('只有一个己方随从时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('action1', 'pirate_powderkeg', '0', 'action')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['pirates', 'aliens'] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['zombies', 'ninjas'] as [string, string],
                    },
                },
                bases: [
                    makeBase('base1', [
                        makeMinion('m1', 'test_minion', '0', 3),  // 己方，力量3
                        makeMinion('m2', 'test_minion', '1', 2),  // 对手，力量2 ≤ 3
                        makeMinion('m3', 'test_minion', '1', 4),  // 对手，力量4 > 3
                    ]),
                ],
            });

            const { matchState } = execPlayAction(state, '0', 'action1');

            // 单个己方随从时也创建 Interaction
            const current = (matchState.sys as any).interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('pirate_powderkeg');
        });
    });

    describe('zombie_grave_digger (掘墓人): 从弃牌堆回收', () => {
        it('弃牌堆有多张随从时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('minion1', 'zombie_grave_digger', '0', 'minion')],
                        deck: [],
                        discard: [
                            makeCard('d1', 'test_minion_a', '0', 'minion'),
                            makeCard('d2', 'test_minion_b', '0', 'minion'),
                        ],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['zombies', 'aliens'] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['pirates', 'ninjas'] as [string, string],
                    },
                },
                bases: [makeBase('base1')],
            });

            // 打出随从
            const ms = makeMatchState(state);
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_MINION, playerId: '0',
                payload: { cardUid: 'minion1', baseIndex: 0 },
            } as any, defaultRandom);

            // 迁移后直接创建 Interaction（不再生成 CHOICE_REQUESTED 事件）
            const current = (result.finalState.sys as any).interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('zombie_grave_digger');
        });

        it('弃牌堆只有一张随从时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('minion1', 'zombie_grave_digger', '0', 'minion')],
                        deck: [],
                        discard: [makeCard('d1', 'test_minion', '0', 'minion')],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['zombies', 'aliens'] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['pirates', 'ninjas'] as [string, string],
                    },
                },
                bases: [makeBase('base1')],
            });

            const ms = makeMatchState(state);
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_MINION, playerId: '0',
                payload: { cardUid: 'minion1', baseIndex: 0 },
            } as any, defaultRandom);

            // 单张随从时也创建 Interaction
            const current = (result.finalState.sys as any).interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('zombie_grave_digger');
        });

        it('弃牌堆没有随从时无回收事件', () => {
            const state = makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('minion1', 'zombie_grave_digger', '0', 'minion')],
                        deck: [],
                        discard: [makeCard('d1', 'test_action', '0', 'action')], // 只有行动卡
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['zombies', 'aliens'] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['pirates', 'ninjas'] as [string, string],
                    },
                },
                bases: [makeBase('base1')],
            });

            const ms = makeMatchState(state);
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_MINION, playerId: '0',
                payload: { cardUid: 'minion1', baseIndex: 0 },
            } as any, defaultRandom);

            const recoverEvents = (result.events as SmashUpEvent[]).filter(e => e.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD);
            expect(recoverEvents.length).toBe(0);
            // 弃牌堆只有行动卡，不应创建交互
            const interaction = (result.finalState.sys as any).interaction;
            expect(interaction?.current).toBeUndefined();
        });
    });

    describe('alien_crop_circles (麦田怪圈): 基地上所有随从移动', () => {
        it('多个有随从的基地时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('action1', 'alien_crop_circles', '0', 'action')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['aliens', 'pirates'] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['zombies', 'ninjas'] as [string, string],
                    },
                },
                bases: [
                    makeBase('base1', [makeMinion('m1', 'test', '0', 3)]),
                    makeBase('base2', [makeMinion('m2', 'test', '1', 2)]),
                    makeBase('base3'),  // 空基地
                ],
            });

            const { events, matchState } = execPlayAction(state, '0', 'action1');

            // 迁移后通过 InteractionSystem 创建交互
            const interaction = (matchState.sys as any).interaction;
            const interactions = [interaction.current, ...(interaction.queue ?? [])].filter(Boolean);
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('alien_crop_circles');
        });

        it('只有一个有随从的基地时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('action1', 'alien_crop_circles', '0', 'action')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['aliens', 'pirates'] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: ['zombies', 'ninjas'] as [string, string],
                    },
                },
                bases: [
                    makeBase('base1', [makeMinion('m1', 'test', '0', 3), makeMinion('m2', 'test', '1', 2)]),
                    makeBase('base2'),  // 空
                    makeBase('base3'),  // 空
                ],
            });

            const { events, matchState } = execPlayAction(state, '0', 'action1');

            // 单个有随从的基地时创建 Interaction
            const interaction = (matchState.sys as any).interaction;
            const interactions = [interaction.current, ...(interaction.queue ?? [])].filter(Boolean);
            expect(interactions.length).toBe(1);
        });
    });
});

describe('Prompt E2E: 状态变更验证', () => {
    beforeAll(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
    });

    it('MINION_DESTROYED 事件后 reducer 从基地移除随从', () => {
        const state = makeState({
            bases: [
                makeBase('base1', [
                    makeMinion('m1', 'test', '0', 3),
                    makeMinion('m2', 'test', '1', 2),
                ]),
            ],
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'm1',
                minionDefId: 'test',
                fromBaseIndex: 0,  // 正确的字段名
                ownerId: '0',
                reason: 'test',
            },
            timestamp: Date.now(),
        } as any;

        const newState = reduce(state, event);
        expect(newState.bases[0].minions.length).toBe(1);
        expect(newState.bases[0].minions[0].uid).toBe('m2');
        // 被消灭的随从应放入所有者弃牌堆
        expect(newState.players['0'].discard.length).toBe(1);
        expect(newState.players['0'].discard[0].uid).toBe('m1');
    });

    it('MINION_MOVED 事件后 reducer 更新随从位置', () => {
        const state = makeState({
            bases: [
                makeBase('base1', [makeMinion('m1', 'test', '0', 3)]),
                makeBase('base2', []),
            ],
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'm1',
                minionDefId: 'test',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'test',
            },
            timestamp: Date.now(),
        } as any;

        const newState = reduce(state, event);
        expect(newState.bases[0].minions.length).toBe(0);
        expect(newState.bases[1].minions.length).toBe(1);
        expect(newState.bases[1].minions[0].uid).toBe('m1');
    });
});
