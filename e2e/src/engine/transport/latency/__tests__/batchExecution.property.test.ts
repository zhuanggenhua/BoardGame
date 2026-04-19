/**
 * 服务端批量执行属性测试
 *
 * Feature: transport-latency-optimization
 * Property 11：服务端批量执行等价性
 * Property 12：服务端批量部分失败
 * Validates: Requirements 4.3, 4.4
 *
 * 注意：这些测试验证的是批量执行的核心逻辑（串行 executePipeline），
 * 不依赖 socket.io 或存储层。服务端 handleBatch 的网络层行为
 * 由 E2E 测试覆盖。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { executePipeline } from '../../../pipeline';
import type { MatchState, Command, GameEvent, RandomFn } from '../../../types';
import type { DomainCore } from '../../../types';
import type { EngineSystem } from '../../../systems/types';
import type { PipelineConfig } from '../../../pipeline';

// ============================================================================
// 测试用领域：简单计数器
// ============================================================================

interface CounterCore {
    value: number;
}

const counterDomain: DomainCore<CounterCore, Command, GameEvent> = {
    gameId: 'counter-test',
    setup: () => ({ value: 0 }),
    validate: (state, command) => {
        // FAIL_AT_N 命令在 value >= N 时失败
        if (command.type === 'FAIL_AT_N') {
            const threshold = (command.payload as { n: number }).n;
            if ((state.core as CounterCore).value >= threshold) {
                return { valid: false, error: 'threshold_exceeded' };
            }
        }
        return { valid: true };
    },
    execute: (state, command) => {
        if (command.type === 'INCREMENT') {
            return [{ type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: Date.now() }];
        }
        if (command.type === 'FAIL_AT_N') {
            return [{ type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: Date.now() }];
        }
        return [];
    },
    reduce: (state, event) => {
        if (event.type === 'VALUE_CHANGED') {
            return { value: state.value + (event.payload as { delta: number }).delta };
        }
        return state;
    },
};

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: <T>(arr: T[]) => [...arr],
};

const pipelineConfig: PipelineConfig<CounterCore, Command, GameEvent> = {
    domain: counterDomain,
    systems: [] as EngineSystem<CounterCore>[],
};

const playerIds = ['0', '1'];

/** 创建初始状态 */
function createState(value: number): MatchState<CounterCore> {
    return {
        core: { value },
        sys: {
            schemaVersion: 1,
            undo: { snapshots: [], maxSnapshots: 0 },
            interaction: { queue: [], current: undefined },
            log: { entries: [], maxEntries: 100 },
            eventStream: { entries: [], maxEntries: 100, nextId: 1 },
            actionLog: { entries: [], maxEntries: 100 },
            rematch: { votes: {}, ready: false },
            responseWindow: {},
            tutorial: {
                active: false,
                manifestId: null,
                stepIndex: 0,
                steps: [],
                step: null,
            },
            turnNumber: 1,
            phase: 'main',
        },
    };
}

/**
 * 模拟服务端批量执行逻辑
 *
 * 串行执行命令，某命令失败时停止并返回失败前的状态。
 */
function executeBatch(
    initialState: MatchState<CounterCore>,
    commands: Array<{ type: string; payload: unknown }>,
): { finalState: MatchState<CounterCore>; executedCount: number; success: boolean } {
    let currentState = initialState;
    let executedCount = 0;

    for (const cmd of commands) {
        const command: Command = { type: cmd.type, playerId: '0', payload: cmd.payload };
        const result = executePipeline(pipelineConfig, currentState, command, fixedRandom, playerIds);

        if (!result.success) {
            // 命令失败，停止执行
            return { finalState: currentState, executedCount, success: false };
        }

        currentState = result.state;
        executedCount++;
    }

    return { finalState: currentState, executedCount, success: true };
}

// ============================================================================
// Property 11：服务端批量执行等价性
// ============================================================================

describe('批量执行 — Property 11: 批量执行等价性', () => {
    it('批量执行 N 个命令的最终状态 = 逐条执行的最终状态', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 20 }), // 初始值
                fc.array(
                    fc.constant({ type: 'INCREMENT', payload: {} }),
                    { minLength: 1, maxLength: 10 },
                ),
                (initialValue, commands) => {
                    const initialState = createState(initialValue);

                    // 方式 1：批量执行
                    const batchResult = executeBatch(initialState, commands);

                    // 方式 2：逐条执行
                    let seqState = initialState;
                    for (const cmd of commands) {
                        const command: Command = { type: cmd.type, playerId: '0', payload: cmd.payload };
                        const result = executePipeline(pipelineConfig, seqState, command, fixedRandom, playerIds);
                        if (!result.success) break;
                        seqState = result.state;
                    }

                    // 两种方式的最终 core 状态应相同
                    expect(batchResult.finalState.core).toEqual(seqState.core);
                    expect(batchResult.executedCount).toBe(commands.length);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 12：服务端批量部分失败
// ============================================================================

describe('批量执行 — Property 12: 批量部分失败', () => {
    it('第 K 个命令失败时，最终状态 = 前 K-1 个命令执行后的状态', () => {
        fc.assert(
            fc.property(
                // 生成 failAt（第几个命令失败，1-indexed）
                fc.integer({ min: 1, max: 5 }),
                (failAt) => {
                    const initialState = createState(0);

                    // 构造命令序列：前 failAt-1 个 INCREMENT，第 failAt 个 FAIL_AT_N
                    const commands: Array<{ type: string; payload: unknown }> = [];
                    for (let i = 0; i < failAt - 1; i++) {
                        commands.push({ type: 'INCREMENT', payload: {} });
                    }
                    // FAIL_AT_N 在 value >= failAt-1 时失败（即恰好在第 failAt 个命令时失败）
                    commands.push({ type: 'FAIL_AT_N', payload: { n: failAt - 1 } });
                    // 后续命令不应执行
                    commands.push({ type: 'INCREMENT', payload: {} });
                    commands.push({ type: 'INCREMENT', payload: {} });

                    const result = executeBatch(initialState, commands);

                    // 应该执行了 failAt-1 个命令后停止
                    expect(result.success).toBe(false);
                    expect(result.executedCount).toBe(failAt - 1);

                    // 最终状态 = 前 failAt-1 个 INCREMENT 的结果
                    expect(result.finalState.core.value).toBe(failAt - 1);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('第一个命令就失败时，状态不变', () => {
        const initialState = createState(5);
        const commands = [
            { type: 'FAIL_AT_N', payload: { n: 0 } }, // value=5 >= 0，立即失败
            { type: 'INCREMENT', payload: {} },
        ];

        const result = executeBatch(initialState, commands);

        expect(result.success).toBe(false);
        expect(result.executedCount).toBe(0);
        expect(result.finalState.core.value).toBe(5);
    });

    it('所有命令都成功时，全部执行', () => {
        const initialState = createState(0);
        const commands = [
            { type: 'INCREMENT', payload: {} },
            { type: 'INCREMENT', payload: {} },
            { type: 'INCREMENT', payload: {} },
        ];

        const result = executeBatch(initialState, commands);

        expect(result.success).toBe(true);
        expect(result.executedCount).toBe(3);
        expect(result.finalState.core.value).toBe(3);
    });
});
