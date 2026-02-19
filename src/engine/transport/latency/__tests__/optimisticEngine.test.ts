/**
 * OptimisticEngine 属性测试 + 单元测试
 *
 * Feature: transport-latency-optimization
 * Property 1：确定性命令的乐观预测
 * Property 2：非确定性命令跳过预测
 * Property 3：确认状态替换乐观状态
 * Property 4：链式乐观命令的正确调和
 * Property 5：本地验证失败不更新乐观状态
 * Property 6：EventStream 始终来自确认状态
 * Validates: Requirements 1.1–1.7, 2.2, 3.5, 6.2–6.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    createOptimisticEngine,
    stripOptimisticEventStream,
} from '../optimisticEngine';
import type { MatchState, Command, GameEvent, RandomFn } from '../../../types';
import type { LatencyPipelineConfig, CommandDeterminismMap } from '../types';
import type { DomainCore } from '../../../types';
import type { EngineSystem } from '../../../systems/types';

// ============================================================================
// 测试用简单领域：计数器游戏
// ============================================================================

interface CounterCore {
    value: number;
}

type CounterCommand = Command<'INCREMENT' | 'DECREMENT' | 'INVALID' | 'RANDOM_ADD', unknown>;
type CounterEvent = GameEvent<'VALUE_CHANGED', { delta: number }>;

/** 创建测试用 MatchState */
function createTestState(value: number, nextEventId = 1): MatchState<CounterCore> {
    return {
        core: { value },
        sys: {
            schemaVersion: 1,
            undo: { snapshots: [], maxSnapshots: 0 },
            interaction: { queue: [], current: undefined },
            log: { entries: [], maxEntries: 100 },
            eventStream: {
                entries: [],
                maxEntries: 100,
                nextId: nextEventId,
            },
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

/** 测试用领域内核 */
const counterDomain: DomainCore<CounterCore, CounterCommand, CounterEvent> = {
    gameId: 'counter-test',
    setup: () => ({ value: 0 }),
    validate: (state, command) => {
        if (command.type === 'INVALID') {
            return { valid: false, error: 'invalid_command' };
        }
        return { valid: true };
    },
    execute: (state, command, random) => {
        const ts = Date.now();
        switch (command.type) {
            case 'INCREMENT':
                return [{ type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: ts }];
            case 'DECREMENT':
                return [{ type: 'VALUE_CHANGED', payload: { delta: -1 }, timestamp: ts }];
            case 'RANDOM_ADD':
                return [{ type: 'VALUE_CHANGED', payload: { delta: random.d(6) }, timestamp: ts }];
            default:
                return [];
        }
    },
    reduce: (state, event) => {
        if (event.type === 'VALUE_CHANGED') {
            return { value: state.value + (event.payload as { delta: number }).delta };
        }
        return state;
    },
};

/** 测试用随机数生成器（固定值） */
const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: <T>(arr: T[]) => [...arr],
};

/** 创建测试用 Pipeline 配置 */
function createTestPipelineConfig(): LatencyPipelineConfig {
    return {
        domain: counterDomain,
        systems: [] as EngineSystem<CounterCore>[],
    };
}

/** 创建测试用引擎 */
function createTestEngine(
    determinism: CommandDeterminismMap = {
        INCREMENT: 'deterministic',
        DECREMENT: 'deterministic',
        RANDOM_ADD: 'non-deterministic',
    },
) {
    return createOptimisticEngine({
        pipelineConfig: createTestPipelineConfig(),
        commandDeterminism: determinism,
        playerIds: ['0', '1'],
        localRandom: fixedRandom,
    });
}

// ============================================================================
// Property 1：确定性命令的乐观预测
// ============================================================================

describe('OptimisticEngine — Property 1: 确定性命令的乐观预测', () => {
    it('确定性命令返回非空 stateToRender，pending 队列增加', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                fc.constantFrom('INCREMENT', 'DECREMENT'),
                (initialValue, cmdType) => {
                    const engine = createTestEngine();
                    const initialState = createTestState(initialValue);

                    // 设置确认状态
                    engine.reconcile(initialState);

                    const result = engine.processCommand(cmdType, {}, '0');

                    // 应返回非空 stateToRender
                    expect(result.stateToRender).not.toBeNull();
                    expect(result.shouldSend).toBe(true);

                    // pending 队列应有一条记录
                    expect(engine.hasPendingCommands()).toBe(true);

                    // 预测值应正确
                    const expectedDelta = cmdType === 'INCREMENT' ? 1 : -1;
                    expect((result.stateToRender!.core as CounterCore).value).toBe(
                        initialValue + expectedDelta,
                    );
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 2：非确定性命令跳过预测
// ============================================================================

describe('OptimisticEngine — Property 2: 非确定性命令跳过预测', () => {
    it('非确定性命令返回 null stateToRender，不修改乐观状态', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                (initialValue) => {
                    const engine = createTestEngine();
                    const initialState = createTestState(initialValue);
                    engine.reconcile(initialState);

                    const result = engine.processCommand('RANDOM_ADD', {}, '0');

                    expect(result.stateToRender).toBeNull();
                    expect(result.shouldSend).toBe(true);
                    expect(engine.hasPendingCommands()).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('未声明确定性的命令也跳过预测（若 pipeline 调用了随机数）', () => {
        // 未声明 commandDeterminism 时，引擎用 Random Probe 自动检测
        // INCREMENT 不调用随机数 → 自动检测为确定性 → 返回非 null
        // RANDOM_ADD 调用 random.d(6) → 自动检测为非确定性 → 返回 null
        const engine = createTestEngine({});
        engine.reconcile(createTestState(10));

        // INCREMENT 不调用随机数，probe 检测为确定性，应返回非 null
        const r1 = engine.processCommand('INCREMENT', {}, '0');
        expect(r1.stateToRender).not.toBeNull();

        // RANDOM_ADD 调用 random.d(6)，probe 检测为非确定性，应返回 null
        engine.reset();
        engine.reconcile(createTestState(10));
        const r2 = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r2.stateToRender).toBeNull();
    });
});

// ============================================================================
// Property 3：确认状态替换乐观状态
// ============================================================================

describe('OptimisticEngine — Property 3: 确认状态替换乐观状态', () => {
    it('无 pending 命令时，reconcile 返回确认状态', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 100 }),
                fc.integer({ min: 0, max: 100 }),
                (optimisticValue, confirmedValue) => {
                    const engine = createTestEngine();
                    engine.reconcile(createTestState(optimisticValue));

                    // 再次 reconcile 到新确认状态
                    const confirmed = createTestState(confirmedValue);
                    const result = engine.reconcile(confirmed);

                    expect((result.stateToRender.core as CounterCore).value).toBe(confirmedValue);
                    expect(result.didRollback).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 4：链式乐观命令的正确调和
// ============================================================================

describe('OptimisticEngine — Property 4: 链式乐观命令的正确调和', () => {
    it('N 个确定性命令逐个 reconcile 后，最终状态等于服务端状态', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 20 }),
                fc.array(
                    fc.constantFrom('INCREMENT', 'DECREMENT'),
                    { minLength: 1, maxLength: 5 },
                ),
                (initialValue, cmdTypes) => {
                    const engine = createTestEngine();
                    engine.reconcile(createTestState(initialValue));

                    // 全部乐观执行
                    for (const cmdType of cmdTypes) {
                        engine.processCommand(cmdType, {}, '0');
                    }

                    // 模拟服务端逐个确认
                    let serverValue = initialValue;
                    for (const cmdType of cmdTypes) {
                        serverValue += cmdType === 'INCREMENT' ? 1 : -1;
                        engine.reconcile(createTestState(serverValue));
                    }

                    // 最终状态应等于服务端状态
                    const finalState = engine.getCurrentState();
                    expect((finalState!.core as CounterCore).value).toBe(serverValue);
                    expect(engine.hasPendingCommands()).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 5：本地验证失败不更新乐观状态
// ============================================================================

describe('OptimisticEngine — Property 5: 本地验证失败不更新乐观状态', () => {
    it('验证失败的命令不改变乐观状态', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                (initialValue) => {
                    const engine = createTestEngine({
                        INVALID: 'deterministic',
                    });
                    engine.reconcile(createTestState(initialValue));

                    const result = engine.processCommand('INVALID', {}, '0');

                    expect(result.stateToRender).toBeNull();
                    expect(engine.hasPendingCommands()).toBe(false);

                    // 状态未变
                    const current = engine.getCurrentState();
                    expect((current!.core as CounterCore).value).toBe(initialValue);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property 6：EventStream 始终来自确认状态
// ============================================================================

describe('OptimisticEngine — Property 6: EventStream 始终来自确认状态', () => {
    it('乐观执行后 EventStream 不变', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                (initialValue) => {
                    const engine = createTestEngine();
                    const initialState = createTestState(initialValue, 5);
                    engine.reconcile(initialState);

                    const originalEventStream = initialState.sys.eventStream;

                    const result = engine.processCommand('INCREMENT', {}, '0');
                    expect(result.stateToRender).not.toBeNull();

                    // EventStream 应与乐观执行前相同
                    expect(result.stateToRender!.sys.eventStream).toEqual(originalEventStream);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// stripOptimisticEventStream 单元测试
// ============================================================================

describe('stripOptimisticEventStream', () => {
    it('保留 previousState 的 EventStream', () => {
        const prev = createTestState(0, 5);
        const optimistic = createTestState(1, 10);

        const stripped = stripOptimisticEventStream(optimistic, prev);

        expect(stripped.sys.eventStream).toBe(prev.sys.eventStream);
        expect((stripped.core as CounterCore).value).toBe(1);
    });
});

// ============================================================================
// 单元测试 — Task 5.9
// ============================================================================

describe('OptimisticEngine 单元测试', () => {
    it('空 pending 队列时 reconcile 直接返回确认状态', () => {
        const engine = createTestEngine();
        const confirmed = createTestState(42);
        const result = engine.reconcile(confirmed);

        expect((result.stateToRender.core as CounterCore).value).toBe(42);
        expect(result.didRollback).toBe(false);
    });

    it('连续多次 reconcile', () => {
        const engine = createTestEngine();

        engine.reconcile(createTestState(1));
        engine.reconcile(createTestState(2));
        engine.reconcile(createTestState(3));

        const state = engine.getCurrentState();
        expect((state!.core as CounterCore).value).toBe(3);
    });

    it('reset 后 pending 队列清空，getCurrentState 返回 null', () => {
        const engine = createTestEngine();
        engine.reconcile(createTestState(10));
        engine.processCommand('INCREMENT', {}, '0');

        expect(engine.hasPendingCommands()).toBe(true);

        engine.reset();

        expect(engine.hasPendingCommands()).toBe(false);
        expect(engine.getCurrentState()).toBeNull();
    });

    it('动态确定性判断函数', () => {
        const engine = createOptimisticEngine({
            pipelineConfig: createTestPipelineConfig(),
            commandDeterminism: {
                INCREMENT: (state, payload) => {
                    // 只有 value < 10 时才是确定性的
                    return (state.core as CounterCore).value < 10;
                },
            },
            playerIds: ['0', '1'],
            localRandom: fixedRandom,
        });

        // value=5 < 10 → 确定性
        engine.reconcile(createTestState(5));
        const r1 = engine.processCommand('INCREMENT', {}, '0');
        expect(r1.stateToRender).not.toBeNull();

        // value=6 后继续，但先 reset 测试 value=15
        engine.reset();
        engine.reconcile(createTestState(15));
        const r2 = engine.processCommand('INCREMENT', {}, '0');
        expect(r2.stateToRender).toBeNull();
    });

    it('没有确认状态时 processCommand 返回 null', () => {
        const engine = createTestEngine();
        // 不调用 reconcile，没有确认状态
        const result = engine.processCommand('INCREMENT', {}, '0');
        expect(result.stateToRender).toBeNull();
        expect(result.shouldSend).toBe(true);
    });

    it('非确定性命令后的确定性命令也跳过预测（unpredictedBarrier）', () => {
        // 模拟 USE_TOKEN（随机）→ SKIP_TOKEN_RESPONSE（确定性）场景
        // SKIP_TOKEN_RESPONSE 不应被预测，因为 USE_TOKEN 未被预测，
        // 预测基础状态不包含 USE_TOKEN 的效果
        const engine = createTestEngine({
            INCREMENT: 'deterministic',
            DECREMENT: 'deterministic',
            RANDOM_ADD: 'non-deterministic',
        });
        engine.reconcile(createTestState(10));

        // 非确定性命令：设置屏障
        const r1 = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r1.stateToRender).toBeNull();
        expect(engine.hasPendingCommands()).toBe(false);

        // 确定性命令：因屏障存在，也跳过预测
        const r2 = engine.processCommand('INCREMENT', {}, '0');
        expect(r2.stateToRender).toBeNull();
        expect(r2.shouldSend).toBe(true);
        expect(engine.hasPendingCommands()).toBe(false);

        // reconcile 清除屏障
        engine.reconcile(createTestState(14)); // 服务端处理了 RANDOM_ADD + INCREMENT
        
        // 屏障清除后，确定性命令恢复预测
        const r3 = engine.processCommand('INCREMENT', {}, '0');
        expect(r3.stateToRender).not.toBeNull();
        expect((r3.stateToRender!.core as CounterCore).value).toBe(15);
    });

    it('Random Probe 检测到随机数后也设置屏障', () => {
        // 不声明 commandDeterminism，全部走 Random Probe
        const engine = createTestEngine({});
        engine.reconcile(createTestState(10));

        // RANDOM_ADD 调用 random.d(6)，probe 检测为非确定性 → 设置屏障
        const r1 = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r1.stateToRender).toBeNull();

        // INCREMENT 本身是确定性的，但因屏障存在，跳过预测
        const r2 = engine.processCommand('INCREMENT', {}, '0');
        expect(r2.stateToRender).toBeNull();
        expect(engine.hasPendingCommands()).toBe(false);
    });

    it('屏障不影响 reconcile 后的回滚水位线', () => {
        // 确保屏障场景下不会产生错误的 optimisticEventWatermark
        const engine = createTestEngine({
            RANDOM_ADD: 'non-deterministic',
            INCREMENT: 'deterministic',
        });
        engine.reconcile(createTestState(10));

        // 非确定性命令 → 屏障激活
        engine.processCommand('RANDOM_ADD', {}, '0');
        // 确定性命令 → 因屏障跳过预测，不产生水位线
        engine.processCommand('INCREMENT', {}, '0');

        // 服务端确认（包含 RANDOM_ADD 产生的事件）
        const serverState = createTestState(14, 5);
        serverState.sys.eventStream.entries = [
            { id: 1, event: { type: 'VALUE_CHANGED', payload: { delta: 3 }, timestamp: 0 } },
            { id: 2, event: { type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: 0 } },
        ];
        const result = engine.reconcile(serverState);

        // 无乐观预测 → 无水位线 → 不过滤任何事件
        expect(result.optimisticEventWatermark).toBeNull();
        expect(result.didRollback).toBe(false);
        // 服务端事件完整保留
        expect(result.stateToRender.sys.eventStream.entries).toHaveLength(2);
    });
});
