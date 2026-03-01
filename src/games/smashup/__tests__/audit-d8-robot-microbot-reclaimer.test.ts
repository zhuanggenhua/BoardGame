/**
 * D8 时序正确性审计：robot_microbot_reclaimer（微型机回收者）
 * 
 * 审计维度：
 * - D8：验证"第一个随从时"使用 post-reduce 计数器（minionsPlayed === 1）
 * - D8 子项：验证额度授予时机在 playCards 阶段可消费
 * 
 * 参考文档：docs/ai-rules/testing-audit.md D8 维度
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { makeState, makePlayer, makeCard, makeMatchState } from './helpers';
import { runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain/types';
import type { RandomFn } from '../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';

const defaultRandom: RandomFn = () => 0.5;

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('D8 审计：robot_microbot_reclaimer 时序正确性', () => {
    describe('D8：post-reduce 计数器验证', () => {
        it('✅ 第一个随从时触发（minionsPlayed === 1）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0'),
                        ],
                        minionsPlayed: 0, // 初始状态：未打出随从
                        minionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });
            const ms = makeMatchState(state);
            
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r1', baseIndex: 0 },
            } as any, defaultRandom);
            
            expect(result.success).toBe(true);
            // 验证：第一个随从打出后，minionsPlayed 从 0 变为 1（post-reduce）
            expect(result.finalState.core.players['0'].minionsPlayed).toBe(1);
            // 验证：额外随从额度被授予（minionLimit 从 1 增加到 2）
            expect(result.finalState.core.players['0'].minionLimit).toBe(2);
        });

        it('✅ 第二个随从时不触发（minionsPlayed === 2）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0'),
                        ],
                        minionsPlayed: 1, // 已打出一个随从
                        minionLimit: 2,
                    }),
                    '1': makePlayer('1'),
                },
            });
            const ms = makeMatchState(state);
            
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r1', baseIndex: 0 },
            } as any, defaultRandom);
            
            expect(result.success).toBe(true);
            // 验证：第二个随从打出后，minionsPlayed 从 1 变为 2（post-reduce）
            expect(result.finalState.core.players['0'].minionsPlayed).toBe(2);
            // 验证：不授予额外额度（minionLimit 保持 2）
            expect(result.finalState.core.players['0'].minionLimit).toBe(2);
        });

        it('✅ 第三个随从时不触发（minionsPlayed === 3）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0'),
                        ],
                        minionsPlayed: 2, // 已打出两个随从
                        minionLimit: 3,
                    }),
                    '1': makePlayer('1'),
                },
            });
            const ms = makeMatchState(state);
            
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r1', baseIndex: 0 },
            } as any, defaultRandom);
            
            expect(result.success).toBe(true);
            // 验证：第三个随从打出后，minionsPlayed 从 2 变为 3（post-reduce）
            expect(result.finalState.core.players['0'].minionsPlayed).toBe(3);
            // 验证：不授予额外额度（minionLimit 保持 3）
            expect(result.finalState.core.players['0'].minionLimit).toBe(3);
        });
    });

    describe('D8 子项：写入-消费窗口对齐', () => {
        it('✅ 额度授予后可在同一回合内消费', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0'),
                            makeCard('r2', 'robot_microbot_guard', 'minion', '0'), // 第二个随从（无额外能力）
                        ],
                        minionsPlayed: 0,
                        minionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });
            const ms = makeMatchState(state);
            
            // 步骤 1：打出第一个随从（robot_microbot_reclaimer）
            const result1 = runCommand(ms, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r1', baseIndex: 0 },
            } as any, defaultRandom);
            
            expect(result1.success).toBe(true);
            expect(result1.finalState.core.players['0'].minionsPlayed).toBe(1);
            expect(result1.finalState.core.players['0'].minionLimit).toBe(2); // 额度已授予
            
            // 步骤 2：使用额外额度打出第二个随从
            const result2 = runCommand(result1.finalState, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r2', baseIndex: 0 },
            } as any, defaultRandom);
            
            expect(result2.success).toBe(true);
            // 验证：额度被正确消费（minionsPlayed 从 1 增加到 2）
            expect(result2.finalState.core.players['0'].minionsPlayed).toBe(2);
            // 验证：额度消费后不再增加（minionLimit 保持 2）
            expect(result2.finalState.core.players['0'].minionLimit).toBe(2);
        });

        it('✅ 额度不会在授予前被清理', () => {
            // 这个测试验证额度授予时机在 playCards 阶段，不会被回合清理逻辑提前抹掉
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0'),
                        ],
                        minionsPlayed: 0,
                        minionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });
            const ms = makeMatchState(state);
            
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r1', baseIndex: 0 },
            } as any, defaultRandom);
            
            expect(result.success).toBe(true);
            // 验证：额度在打出随从后立即生效，不会被清理
            expect(result.finalState.core.players['0'].minionLimit).toBe(2);
        });
    });

    describe('D8 反模式检测：pre-reduce 计数器错误', () => {
        it('❌ 如果使用 minionsPlayed === 0（pre-reduce），第一个随从不会触发', () => {
            // 这个测试展示错误实现的行为（用于对比）
            // 正确实现：onPlay 在 reduce 之后执行，minionsPlayed 已从 0 变为 1
            // 错误实现：如果检查 minionsPlayed === 0，永远不会触发（因为 reduce 后已经是 1）
            
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('r1', 'robot_microbot_reclaimer', 'minion', '0'),
                        ],
                        minionsPlayed: 0,
                        minionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });
            const ms = makeMatchState(state);
            
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'r1', baseIndex: 0 },
            } as any, defaultRandom);
            
            expect(result.success).toBe(true);
            // 验证：当前实现使用 minionsPlayed === 1（正确）
            // 如果错误使用 minionsPlayed === 0，这里会失败
            expect(result.finalState.core.players['0'].minionLimit).toBe(2);
            
            // 注释：如果实现改为 `if (player.minionsPlayed === 0)`，
            // 这个测试会失败，因为 onPlay 执行时 minionsPlayed 已经是 1
        });
    });
});
