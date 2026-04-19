/**
 * 端到端一致性属性测试
 *
 * Feature: transport-latency-optimization
 * Property 13：最终一致性
 * Validates: Requirements 6.1
 *
 * 模拟完整的乐观更新 + 服务端确认流程，
 * 验证客户端最终状态与服务端状态一致。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createOptimisticEngine } from '../optimisticEngine';
import { createCommandBatcher } from '../commandBatcher';
import { executePipeline } from '../../../pipeline';
import type { MatchState, Command, GameEvent, RandomFn } from '../../../types';
import type { DomainCore } from '../../../types';
import type { EngineSystem } from '../../../systems/types';
import type { PipelineConfig } from '../../../pipeline';
import type { BatchedCommand } from '../types';

// ============================================================================
// 测试用领域：简单计数器
// ============================================================================

interface CounterCore {
    value: number;
}

const counterDomain: DomainCore<CounterCore, Command, GameEvent> = {
    gameId: 'counter-test',
    setup: () => ({ value: 0 }),
    validate: () => ({ valid: true }),
    execute: (state, command) => {
        if (command.type === 'INCREMENT') {
            return [{ type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: Date.now() }];
        }
        if (command.type === 'DECREMENT') {
            return [{ type: 'VALUE_CHANGED', payload: { delta: -1 }, timestamp: Date.now() }];
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

/** 模拟服务端执行单条命令 */
function serverExecute(
    state: MatchState<CounterCore>,
    type: string,
    payload: unknown,
): MatchState<CounterCore> {
    const command: Command = { type, playerId: '0', payload };
    const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
    return result.success ? result.state : state;
}

// ============================================================================
// Property 13：最终一致性
// ============================================================================

describe('端到端一致性 — Property 13: 最终一致性', () => {
    it('乐观更新 + 服务端确认后，客户端状态与服务端状态一致', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 20 }),
                fc.array(
                    fc.constantFrom('INCREMENT', 'DECREMENT'),
                    { minLength: 1, maxLength: 8 },
                ),
                (initialValue, cmdTypes) => {
                    // 客户端：创建乐观引擎
                    const engine = createOptimisticEngine({
                        pipelineConfig: {
                            domain: counterDomain,
                            systems: [] as EngineSystem<CounterCore>[],
                        },
                        commandDeterminism: {
                            INCREMENT: 'deterministic',
                            DECREMENT: 'deterministic',
                        },
                        playerIds,
                        localRandom: fixedRandom,
                    });

                    const initialState = createState(initialValue);

                    // 客户端设置初始确认状态
                    engine.reconcile(initialState);

                    // 客户端：乐观执行所有命令
                    for (const cmdType of cmdTypes) {
                        engine.processCommand(cmdType, {}, '0');
                    }

                    // 服务端：逐条执行并确认
                    let serverState = initialState;
                    for (const cmdType of cmdTypes) {
                        serverState = serverExecute(serverState, cmdType, {});
                        engine.reconcile(serverState);
                    }

                    // 最终一致性：客户端状态 core 应与服务端一致
                    const clientState = engine.getCurrentState();
                    expect((clientState!.core as CounterCore).value).toBe(
                        (serverState.core as CounterCore).value,
                    );
                    expect(engine.hasPendingCommands()).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('乐观更新 + 批处理 + 服务端确认的完整流程', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 20 }),
                fc.array(
                    fc.constantFrom('INCREMENT', 'DECREMENT'),
                    { minLength: 1, maxLength: 6 },
                ),
                (initialValue, cmdTypes) => {
                    // 收集批处理器发送的命令
                    const sentBatches: BatchedCommand[][] = [];

                    const engine = createOptimisticEngine({
                        pipelineConfig: {
                            domain: counterDomain,
                            systems: [] as EngineSystem<CounterCore>[],
                        },
                        commandDeterminism: {
                            INCREMENT: 'deterministic',
                            DECREMENT: 'deterministic',
                        },
                        playerIds,
                        localRandom: fixedRandom,
                    });

                    const batcher = createCommandBatcher({
                        windowMs: 0, // 逐条发送模式（测试中不使用定时器）
                        maxBatchSize: 10,
                        immediateCommands: [],
                        onFlush: (cmds) => sentBatches.push([...cmds]),
                    });

                    const initialState = createState(initialValue);
                    engine.reconcile(initialState);

                    // 模拟 dispatch 流程：乐观更新 → 批处理
                    for (const cmdType of cmdTypes) {
                        engine.processCommand(cmdType, {}, '0');
                        batcher.enqueue(cmdType, {});
                    }

                    // 验证批处理器发送了所有命令
                    const totalSent = sentBatches.reduce((sum, b) => sum + b.length, 0);
                    expect(totalSent).toBe(cmdTypes.length);

                    // 服务端执行并确认
                    let serverState = initialState;
                    for (const cmdType of cmdTypes) {
                        serverState = serverExecute(serverState, cmdType, {});
                        engine.reconcile(serverState);
                    }

                    // 最终一致性
                    const clientState = engine.getCurrentState();
                    expect((clientState!.core as CounterCore).value).toBe(
                        (serverState.core as CounterCore).value,
                    );

                    batcher.destroy();
                },
            ),
            { numRuns: 100 },
        );
    });
});
