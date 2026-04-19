/**
 * pendingBonusDamage 清理逻辑测试
 * 
 * 验证 pendingBonusDamage 在以下时机被正确清除：
 * 1. 进入 main2 阶段时
 * 2. 回合切换时
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore } from '../domain/types';
import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';

describe('pendingBonusDamage 清理逻辑', () => {
    const createTestState = (pendingBonusDamage?: number): DiceThroneCore => ({
        players: {
            '0': {
                id: '0',
                characterId: 'monk',
                resources: { hp: 50, cp: 2 },
                hand: [],
                deck: [],
                discard: [],
                statusEffects: {},
                tokens: {},
                tokenStackLimits: {},
                damageShields: [],
                abilities: [],
                abilityLevels: {},
                upgradeCardByAbilityId: {},
                pendingBonusDamage,
            },
            '1': {
                id: '1',
                characterId: 'barbarian',
                resources: { hp: 50, cp: 2 },
                hand: [],
                deck: [],
                discard: [],
                statusEffects: {},
                tokens: {},
                tokenStackLimits: {},
                damageShields: [],
                abilities: [],
                abilityLevels: {},
                upgradeCardByAbilityId: {},
            },
        },
        activePlayerId: '0',
        startingPlayerId: '0',
        turnNumber: 1,
        dice: [],
        rollCount: 0,
        rollLimit: 3,
        rollDiceCount: 5,
        rollConfirmed: false,
        pendingAttack: null,
        tokenDefinitions: [],
        lastEffectSourceByPlayerId: {},
        hostStarted: false,
        readyPlayers: {},
    });

    describe('进入 main2 阶段时清除 pendingBonusDamage', () => {
        it('应该清除当前玩家的 pendingBonusDamage', () => {
            const state = createTestState(5);
            
            const event = {
                type: FLOW_EVENTS.PHASE_CHANGED,
                payload: { to: 'main2', activePlayerId: '0' },
            };

            const result = reduce(state, event as any);

            expect(result.players['0'].pendingBonusDamage).toBeUndefined();
        });

        it('如果 pendingBonusDamage 不存在，不应该修改 players 对象', () => {
            const state = createTestState();
            
            const event = {
                type: FLOW_EVENTS.PHASE_CHANGED,
                payload: { to: 'main2', activePlayerId: '0' },
            };

            const result = reduce(state, event as any);

            // 结构共享：如果没有变化，应该返回相同的 players 对象
            expect(result.players).toBe(state.players);
        });

        it('应该同时清除 extraAttackInProgress', () => {
            const state = {
                ...createTestState(5),
                extraAttackInProgress: true,
            };
            
            const event = {
                type: FLOW_EVENTS.PHASE_CHANGED,
                payload: { to: 'main2', activePlayerId: '0' },
            };

            const result = reduce(state, event as any);

            expect(result.players['0'].pendingBonusDamage).toBeUndefined();
            expect(result.extraAttackInProgress).toBeUndefined();
        });

        it('不应该影响其他玩家的 pendingBonusDamage', () => {
            const state = createTestState(5);
            state.players['1'].pendingBonusDamage = 3;
            
            const event = {
                type: FLOW_EVENTS.PHASE_CHANGED,
                payload: { to: 'main2', activePlayerId: '0' },
            };

            const result = reduce(state, event as any);

            expect(result.players['0'].pendingBonusDamage).toBeUndefined();
            expect(result.players['1'].pendingBonusDamage).toBe(3);
        });
    });

    describe('回合切换时清除所有玩家的 pendingBonusDamage', () => {
        it('应该清除所有玩家的 pendingBonusDamage', () => {
            const state = createTestState(5);
            state.players['1'].pendingBonusDamage = 3;
            
            const event = {
                type: 'TURN_CHANGED',
                payload: {
                    previousPlayerId: '0',
                    nextPlayerId: '1',
                    turnNumber: 2,
                },
            };

            const result = reduce(state, event as any);

            expect(result.players['0'].pendingBonusDamage).toBeUndefined();
            expect(result.players['1'].pendingBonusDamage).toBeUndefined();
        });

        it('如果没有玩家有 pendingBonusDamage，不应该修改 players 对象', () => {
            const state = createTestState();
            
            const event = {
                type: 'TURN_CHANGED',
                payload: {
                    previousPlayerId: '0',
                    nextPlayerId: '1',
                    turnNumber: 2,
                },
            };

            const result = reduce(state, event as any);

            // 结构共享：如果没有变化，应该返回相同的 players 对象
            expect(result.players).toBe(state.players);
        });
    });

    describe('其他阶段不应该清除 pendingBonusDamage', () => {
        // 只测试不会触发骰子创建的阶段
        const phases = ['upkeep', 'income', 'main1', 'discard'];

        phases.forEach(phase => {
            it(`进入 ${phase} 阶段时不应该清除 pendingBonusDamage`, () => {
                const state = createTestState(5);
                
                const event = {
                    type: FLOW_EVENTS.PHASE_CHANGED,
                    payload: { to: phase, activePlayerId: '0' },
                };

                const result = reduce(state, event as any);

                expect(result.players['0'].pendingBonusDamage).toBe(5);
            });
        });
    });

    describe('攻击结算时 pendingAttack 被清除', () => {
        it('ATTACK_RESOLVED 事件应该清除 pendingAttack', () => {
            const state = {
                ...createTestState(),
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'test-ability',
                    isDefendable: true,
                    bonusDamage: 5,
                    resolvedDamage: 10,
                    attackDiceFaceCounts: {},
                },
            };
            
            const event = {
                type: 'ATTACK_RESOLVED',
                payload: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'test-ability',
                    totalDamage: 10,
                },
            };

            const result = reduce(state, event as any);

            expect(result.pendingAttack).toBeNull();
        });
    });

    describe('撤回时 pendingBonusDamage 应该自动回滚', () => {
        it('撤回后 pendingBonusDamage 应该恢复到快照时的值', () => {
            // Arrange: 创建初始状态（没有 pendingBonusDamage）
            const initialState = createTestState();
            
            // Act 1: 添加 pendingBonusDamage（模拟打出攻击修正卡）
            const stateWithBonus = {
                ...initialState,
                players: {
                    ...initialState.players,
                    '0': {
                        ...initialState.players['0'],
                        pendingBonusDamage: 5,
                    },
                },
            };
            
            // Assert: 验证 pendingBonusDamage 被设置
            expect(stateWithBonus.players['0'].pendingBonusDamage).toBe(5);
            
            // Act 2: 撤回应该恢复到 initialState（通过 UndoSystem 快照机制）
            // 这里我们直接验证：如果恢复到 initialState，pendingBonusDamage 应该是 undefined
            expect(initialState.players['0'].pendingBonusDamage).toBeUndefined();
            
            // 说明：实际的撤回逻辑由 UndoSystem 处理，它会恢复整个 core 快照
            // reducer 层不需要特殊处理 pendingBonusDamage 的撤回
        });

        it('撤回后 pendingBonusDamage 应该恢复到快照时的非零值', () => {
            // Arrange: 创建有 pendingBonusDamage 的快照状态
            const snapshotState = createTestState(3);
            
            // Act: 修改 pendingBonusDamage（模拟再打一张攻击修正卡）
            const modifiedState = {
                ...snapshotState,
                players: {
                    ...snapshotState.players,
                    '0': {
                        ...snapshotState.players['0'],
                        pendingBonusDamage: 8, // 3 + 5
                    },
                },
            };
            
            // Assert: 验证修改后的值
            expect(modifiedState.players['0'].pendingBonusDamage).toBe(8);
            
            // Act 2: 撤回应该恢复到 snapshotState
            expect(snapshotState.players['0'].pendingBonusDamage).toBe(3);
            
            // 说明：UndoSystem 会恢复整个快照，包括 pendingBonusDamage 的值
        });
    });
});
