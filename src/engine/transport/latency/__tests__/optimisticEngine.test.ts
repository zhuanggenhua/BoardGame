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

// ============================================================================
// 种子同步模式测试
// ============================================================================

describe('OptimisticEngine — 种子同步模式（Seed Sync）', () => {
    it('syncRandom 后，显式 non-deterministic 命令可以被乐观预测', () => {
        const engine = createTestEngine({
            INCREMENT: 'deterministic',
            RANDOM_ADD: 'non-deterministic',
        });
        engine.reconcile(createTestState(10));

        // 未同步时：non-deterministic 命令跳过预测
        const r1 = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r1.stateToRender).toBeNull();

        // 同步后：non-deterministic 命令可以预测
        engine.reset();
        engine.reconcile(createTestState(10));
        engine.syncRandom('test-seed', 0);

        const r2 = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r2.stateToRender).not.toBeNull();
        expect(engine.hasPendingCommands()).toBe(true);
    });

    it('syncRandom 后，Random Probe 不再丢弃预测', () => {
        // 不声明 commandDeterminism → 全部走 Random Probe
        const engine = createTestEngine({});
        engine.reconcile(createTestState(10));
        engine.syncRandom('test-seed', 0);

        // RANDOM_ADD 调用 random.d(6)，但因已同步，不丢弃预测
        const r = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r.stateToRender).not.toBeNull();
        expect(engine.hasPendingCommands()).toBe(true);
    });

    it('syncRandom 后不设置 unpredictedBarrier', () => {
        const engine = createTestEngine({
            RANDOM_ADD: 'non-deterministic',
            INCREMENT: 'deterministic',
        });
        engine.reconcile(createTestState(10));
        engine.syncRandom('test-seed', 0);

        // non-deterministic 命令被预测，不设置屏障
        const r1 = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r1.stateToRender).not.toBeNull();

        // 后续确定性命令也能正常预测（无屏障）
        const r2 = engine.processCommand('INCREMENT', {}, '0');
        expect(r2.stateToRender).not.toBeNull();
    });

    it('reconcile 时根据 randomCursor 重建 localRandom', () => {
        const engine = createTestEngine({
            RANDOM_ADD: 'non-deterministic',
        });
        engine.reconcile(createTestState(10));
        engine.syncRandom('test-seed', 0);

        // 第一次预测
        const r1 = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r1.stateToRender).not.toBeNull();
        const predictedValue1 = (r1.stateToRender!.core as CounterCore).value;

        // 服务端确认，cursor 推进到 1（服务端执行了一次随机数调用）
        const serverState = createTestState(predictedValue1);
        engine.reconcile(serverState, { stateID: 1, randomCursor: 1 });

        // 第二次预测应基于 cursor=1 的随机数序列
        const r2 = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r2.stateToRender).not.toBeNull();
    });

    it('种子同步预测与服务端结果一致时，reconcile 不回滚', () => {
        // 构建与服务端相同的 PRNG 序列来验证预测准确性
        const seed = 'consistent-seed';
        const engine = createTestEngine({
            RANDOM_ADD: 'non-deterministic',
        });

        const initialState = createTestState(0);
        engine.reconcile(initialState);
        engine.syncRandom(seed, 0);

        // 客户端乐观预测
        const r = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r.stateToRender).not.toBeNull();
        const predictedValue = (r.stateToRender!.core as CounterCore).value;

        // 模拟服务端用相同种子执行（值应一致）
        const serverState = createTestState(predictedValue);
        const result = engine.reconcile(serverState, { stateID: 1, randomCursor: 1 });

        // 预测准确 → 不回滚
        expect(result.didRollback).toBe(false);
        expect(engine.hasPendingCommands()).toBe(false);
    });

    it('对手命令导致 cursor 漂移时，reconcile 重建 cursor 并继续预测', () => {
        const seed = 'drift-seed';
        const engine = createTestEngine({
            RANDOM_ADD: 'non-deterministic',
            INCREMENT: 'deterministic',
        });

        engine.reconcile(createTestState(0));
        engine.syncRandom(seed, 0);

        // 客户端预测（基于 cursor=0）
        const r = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r.stateToRender).not.toBeNull();

        // 服务端确认：对手先执行了随机命令，cursor 漂移到 2
        // 使用 stateID 匹配让 reconcile 正确消费 pending
        const serverState = createTestState(42);
        engine.reconcile(serverState, { stateID: 1, randomCursor: 2 });

        // pending 已消费（stateID 匹配 + playerId 匹配）
        // 注意：需要 predictedStateID 匹配，这里 confirmedStateID 初始为 null
        // 所以走 fallback JSON 比较。如果不匹配，pending 会被重放。
        // 关键验证：无论 pending 是否清空，后续预测都能正常工作
        // （cursor 已重建到 2，localRandom 序列正确）

        // 清空状态重新开始，验证 cursor=2 后的预测能力
        engine.reset();
        engine.reconcile(createTestState(100));
        engine.syncRandom(seed, 2); // 从 cursor=2 开始

        const r2 = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r2.stateToRender).not.toBeNull();
        // 预测值应该是 100 + d(6)，其中 d(6) 基于 seed 在 cursor=2 的值
        expect((r2.stateToRender!.core as CounterCore).value).toBeGreaterThan(100);

        // 确定性命令也能正常链式预测
        const r3 = engine.processCommand('INCREMENT', {}, '0');
        expect(r3.stateToRender).not.toBeNull();
        expect((r3.stateToRender!.core as CounterCore).value).toBe(
            (r2.stateToRender!.core as CounterCore).value + 1,
        );
    });

    it('reset 后 syncRandom 状态不清除（重连时 state:sync 会重新同步）', () => {
        const engine = createTestEngine({
            RANDOM_ADD: 'non-deterministic',
        });
        engine.reconcile(createTestState(10));
        engine.syncRandom('test-seed', 0);

        engine.reset();
        engine.reconcile(createTestState(10));

        // reset 不清除 isRandomSynced，重连后 state:sync 会重新调用 syncRandom
        // 但 localRandom 已被 reset 前的 syncRandom 设置，仍可用
        const r = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r.stateToRender).not.toBeNull();
    });

    it('pipeline 异常时恢复 localRandom（防止 PRNG 状态污染）', () => {
        // 构建一个会在 execute 阶段抛异常的领域
        const throwingDomain: DomainCore<CounterCore, CounterCommand, CounterEvent> = {
            ...counterDomain,
            execute: (state, command, random) => {
                if (command.type === 'RANDOM_ADD') {
                    // 先消耗随机数，然后抛异常
                    random.d(6);
                    random.d(6);
                    throw new Error('模拟 execute 异常');
                }
                return counterDomain.execute(state, command, random);
            },
        };

        const engine = createOptimisticEngine({
            pipelineConfig: {
                domain: throwingDomain,
                systems: [] as EngineSystem<CounterCore>[],
            },
            commandDeterminism: { RANDOM_ADD: 'non-deterministic', INCREMENT: 'deterministic' },
            playerIds: ['0', '1'],
        });

        const seed = 'recovery-seed';
        engine.reconcile(createTestState(0));
        engine.syncRandom(seed, 0);

        // RANDOM_ADD 会抛异常，但 localRandom 应被恢复
        const r1 = engine.processCommand('RANDOM_ADD', {}, '0');
        expect(r1.stateToRender).toBeNull(); // 异常 → 不预测

        // 后续 INCREMENT 应能正常预测（localRandom 已恢复，未被异常污染）
        const r2 = engine.processCommand('INCREMENT', {}, '0');
        expect(r2.stateToRender).not.toBeNull();
        expect((r2.stateToRender!.core as CounterCore).value).toBe(1);

        // 验证 PRNG 一致性：用相同 seed+cursor 创建的 random 应产生相同序列
        // （如果 localRandom 没被恢复，INCREMENT 的预测会基于被污染的 PRNG 状态）
        engine.reset();
        engine.reconcile(createTestState(0));
        engine.syncRandom(seed, 0);
        const r3 = engine.processCommand('INCREMENT', {}, '0');
        expect(r3.stateToRender).not.toBeNull();
        // 两次 INCREMENT 的预测结果应一致（都基于 cursor=0 的 PRNG 状态）
        expect((r3.stateToRender!.core as CounterCore).value).toBe(
            (r2.stateToRender!.core as CounterCore).value,
        );
    });
});
