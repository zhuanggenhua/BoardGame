/**
 * CommandBatcher 属性测试
 *
 * Feature: transport-latency-optimization, Property 10: 批处理时间窗口内的命令合并
 * Validates: Requirements 4.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createCommandBatcher } from '../commandBatcher';
import type { BatchedCommand } from '../types';

// ============================================================================
// 生成器
// ============================================================================

/**
 * 生成随机命令
 * 命令类型为非空字母数字字符串，payload 为任意 JSON 可序列化值
 */
const arbCommand = () =>
    fc.record({
        type: fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,19}$/),
        payload: fc.oneof(
            fc.integer(),
            fc.string(),
            fc.boolean(),
            fc.record({ value: fc.integer() }),
        ),
    });

/**
 * 生成随机批处理配置
 * - windowMs > 0（确保使用时间窗口模式，不退化为逐条发送）
 * - maxBatchSize >= N（确保不会因为 maxBatchSize 触发提前 flush）
 */
const arbBatchConfig = (minBatchSize: number) =>
    fc.record({
        windowMs: fc.integer({ min: 10, max: 500 }),
        // maxBatchSize 至少比命令数大 1，避免触发 maxBatchSize 自动 flush
        maxBatchSize: fc.integer({ min: minBatchSize + 1, max: minBatchSize + 20 }),
    });

// ============================================================================
// Property 10：批处理时间窗口内的命令合并
// ============================================================================

describe('CommandBatcher 属性测试', () => {
    beforeEach(() => {
        // 使用假定时器控制时间窗口
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it(
        // Feature: transport-latency-optimization, Property 10: 批处理时间窗口内的命令合并
        'Property 10: 在批处理时间窗口内入队的 N 个命令应合并为一个批次发送',
        () => {
            fc.assert(
                fc.property(
                    // 生成 1~10 个命令，以及对应的批处理配置
                    fc.integer({ min: 1, max: 10 }).chain((n) =>
                        fc.tuple(
                            fc.constant(n),
                            fc.array(arbCommand(), { minLength: n, maxLength: n }),
                            arbBatchConfig(n),
                        ),
                    ),
                    ([n, commands, batchConfig]) => {
                        // 记录 onFlush 被调用的次数和每次收到的命令
                        const flushCalls: BatchedCommand[][] = [];

                        const batcher = createCommandBatcher({
                            windowMs: batchConfig.windowMs,
                            maxBatchSize: batchConfig.maxBatchSize,
                            immediateCommands: [],
                            onFlush: (cmds) => {
                                flushCalls.push([...cmds]);
                            },
                        });

                        // 在时间窗口内（不推进时间）依次入队所有命令
                        for (const cmd of commands) {
                            batcher.enqueue(cmd.type, cmd.payload);
                        }

                        // 此时定时器尚未触发，onFlush 不应被调用
                        expect(flushCalls.length).toBe(0);

                        // 推进时间超过 windowMs，触发定时器
                        vi.advanceTimersByTime(batchConfig.windowMs + 1);

                        // onFlush 应恰好被调用一次（所有命令合并为一个批次）
                        expect(flushCalls.length).toBe(1);

                        // 该批次应包含所有 N 个命令
                        expect(flushCalls[0].length).toBe(n);

                        // 命令顺序应与入队顺序一致
                        for (let i = 0; i < n; i++) {
                            expect(flushCalls[0][i].type).toBe(commands[i].type);
                            expect(flushCalls[0][i].payload).toEqual(commands[i].payload);
                        }

                        // 清理
                        batcher.destroy();
                    },
                ),
                {
                    // 最少运行 100 次迭代
                    numRuns: 100,
                    verbose: false,
                },
            );
        },
    );
});
