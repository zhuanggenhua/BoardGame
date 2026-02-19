/**
 * 乐观动画属性测试
 *
 * Feature: optimistic-animation
 * Property A: optimistic 命令保留 EventStream 事件
 * Property B: wait-confirm 命令剥离 EventStream 事件
 * Property C: 未声明命令默认 wait-confirm
 * Property D: 无回滚时 EventStream 原样传递
 * Property E: processCommand 返回正确的 animationMode
 * Property F: 水位线等于乐观事件最大 ID
 * Property G: 回滚时过滤水位线以下事件（filterPlayedEvents）
 * Property H: 链式命令水位线取最大值
 * Property I: 全部确认后水位线重置
 *
 * Validates: Requirements 1.2, 1.4, 1.5, 2.1, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 6.1, 6.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    createOptimisticEngine,
    applyAnimationMode,
    getMaxEventId,
    filterPlayedEvents,
} from '../optimisticEngine';
import type { MatchState, GameEvent, RandomFn } from '../../../types';
import type { LatencyPipelineConfig, CommandAnimationMap } from '../types';
import type { DomainCore } from '../../../types';
import { createEventStreamSystem } from '../../../systems/EventStreamSystem';

// ============================================================================
// 测试用领域：计数器游戏（产生 EventStream 事件）
// ============================================================================

interface CounterCore {
    value: number;
}

type CounterEvent = GameEvent<'VALUE_CHANGED', { delta: number }>;

/** 创建测试用 MatchState，可指定 EventStream 条目 */
function createTestState(
    value: number,
    eventEntries: Array<{ id: number; event: GameEvent }> = [],
    nextId = 1,
): MatchState<CounterCore> {
    return {
        core: { value },
        sys: {
            schemaVersion: 1,
            undo: { snapshots: [], maxSnapshots: 0 },
            interaction: { queue: [], current: undefined },
            log: { entries: [], maxEntries: 100 },
            eventStream: {
                entries: eventEntries,
                maxEntries: 100,
                nextId,
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

/** 测试用领域内核（INCREMENT 产生 EventStream 事件） */
const counterDomain: DomainCore<CounterCore, any, CounterEvent> = {
    gameId: 'counter-anim-test',
    setup: () => ({ value: 0 }),
    validate: () => ({ valid: true }),
    execute: (_state: any, command: any) => {
        const ts = Date.now();
        switch (command.type) {
            case 'INCREMENT':
                return [{ type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: ts }];
            case 'DECREMENT':
                return [{ type: 'VALUE_CHANGED', payload: { delta: -1 }, timestamp: ts }];
            default:
                return [];
        }
    },
    reduce: (state: CounterCore, event: CounterEvent) => {
        if (event.type === 'VALUE_CHANGED') {
            return { value: state.value + event.payload.delta };
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

function createTestPipelineConfig(): LatencyPipelineConfig {
    return {
        domain: counterDomain,
        systems: [createEventStreamSystem<CounterCore>({ maxEntries: 100 })],
    };
}

/** 创建带动画模式配置的引擎 */
function createAnimEngine(animationMode: CommandAnimationMap = {}) {
    return createOptimisticEngine({
        pipelineConfig: createTestPipelineConfig(),
        commandDeterminism: {
            INCREMENT: 'deterministic',
            DECREMENT: 'deterministic',
        },
        commandAnimationMode: animationMode,
        playerIds: ['0', '1'],
        localRandom: fixedRandom,
    });
}

// ============================================================================
// fast-check 生成器
// ============================================================================

/** 生成随机 EventStream 条目数组 */
const arbEventEntries = fc.array(
    fc.record({
        id: fc.integer({ min: 1, max: 1000 }),
        event: fc.record({
            type: fc.constantFrom('VALUE_CHANGED', 'OTHER_EVENT'),
            payload: fc.record({ delta: fc.integer({ min: -10, max: 10 }) }),
            timestamp: fc.integer({ min: 0, max: 9999999 }),
        }),
    }),
    { minLength: 0, maxLength: 10 },
);

// ============================================================================
// Property A：optimistic 命令保留 EventStream 事件
// ============================================================================

describe('Property A: optimistic 命令保留 EventStream 事件', () => {
    // Feature: optimistic-animation, Property A: optimistic 命令保留 EventStream 事件
    it('applyAnimationMode optimistic 模式返回原始乐观状态（含新事件）', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                arbEventEntries,
                (value, entries) => {
                    const prev = createTestState(value, []);
                    const optimistic = createTestState(value + 1, entries);

                    const result = applyAnimationMode(optimistic, prev, 'optimistic');

                    expect(result.sys.eventStream).toBe(optimistic.sys.eventStream);
                    expect(result.sys.eventStream.entries).toEqual(entries);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('processCommand optimistic 模式下 stateToRender 包含新 EventStream 事件', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                (initialValue) => {
                    const engine = createAnimEngine({ INCREMENT: 'optimistic' });
                    const initialState = createTestState(initialValue);
                    engine.reconcile(initialState);

                    const result = engine.processCommand('INCREMENT', {}, '0');

                    expect(result.stateToRender).not.toBeNull();
                    const entries = result.stateToRender!.sys.eventStream.entries;
                    expect(entries.length).toBeGreaterThan(0);
                    expect(entries[entries.length - 1].event.type).toBe('VALUE_CHANGED');
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property B：wait-confirm 命令剥离 EventStream 事件
// ============================================================================

describe('Property B: wait-confirm 命令剥离 EventStream 事件', () => {
    // Feature: optimistic-animation, Property B: wait-confirm 命令剥离 EventStream 事件
    it('applyAnimationMode wait-confirm 模式返回 previousState 的 EventStream', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                arbEventEntries,
                arbEventEntries,
                (value, prevEntries, newEntries) => {
                    const prev = createTestState(value, prevEntries);
                    const optimistic = createTestState(value + 1, newEntries);

                    const result = applyAnimationMode(optimistic, prev, 'wait-confirm');

                    expect(result.sys.eventStream).toBe(prev.sys.eventStream);
                    expect(result.sys.eventStream.entries).toEqual(prevEntries);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('processCommand wait-confirm 模式下 stateToRender EventStream 与执行前相同', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                (initialValue) => {
                    const engine = createAnimEngine({});
                    const initialState = createTestState(initialValue);
                    engine.reconcile(initialState);

                    const originalEventStream = initialState.sys.eventStream;
                    const result = engine.processCommand('INCREMENT', {}, '0');

                    expect(result.stateToRender).not.toBeNull();
                    expect(result.stateToRender!.sys.eventStream).toEqual(originalEventStream);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property C：未声明命令默认 wait-confirm
// ============================================================================

describe('Property C: 未声明命令默认 wait-confirm', () => {
    // Feature: optimistic-animation, Property C: 未声明命令默认 wait-confirm
    it('CommandAnimationMap 中未声明的命令 animationMode 为 wait-confirm', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                fc.constantFrom('INCREMENT', 'DECREMENT'),
                (initialValue, cmdType) => {
                    const engine = createAnimEngine({});
                    const initialState = createTestState(initialValue);
                    engine.reconcile(initialState);

                    const result = engine.processCommand(cmdType, {}, '0');

                    expect(result.animationMode).toBe('wait-confirm');
                    expect(result.stateToRender!.sys.eventStream).toEqual(
                        initialState.sys.eventStream,
                    );
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property D：无回滚时 EventStream 原样传递
// ============================================================================

describe('Property D: 无回滚时 EventStream 原样传递', () => {
    // Feature: optimistic-animation, Property D: 无回滚时 EventStream 原样传递
    it('reconcile 无回滚时 stateToRender EventStream 与 confirmedState 相同', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                arbEventEntries,
                (value, entries) => {
                    const engine = createAnimEngine({ INCREMENT: 'optimistic' });
                    const initialState = createTestState(value);
                    engine.reconcile(initialState);

                    engine.processCommand('INCREMENT', {}, '0');

                    const confirmedState = createTestState(value + 1, entries);
                    const result = engine.reconcile(confirmedState);

                    expect(result.didRollback).toBe(false);
                    expect(result.stateToRender.sys.eventStream).toEqual(
                        confirmedState.sys.eventStream,
                    );
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property E：processCommand 返回正确的 animationMode
// ============================================================================

describe('Property E: processCommand 返回正确的 animationMode', () => {
    // Feature: optimistic-animation, Property E: processCommand 返回正确的 animationMode
    it('声明为 optimistic 的命令返回 animationMode=optimistic', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                fc.constantFrom('INCREMENT', 'DECREMENT'),
                (initialValue, cmdType) => {
                    const engine = createAnimEngine({
                        INCREMENT: 'optimistic',
                        DECREMENT: 'optimistic',
                    });
                    engine.reconcile(createTestState(initialValue));

                    const result = engine.processCommand(cmdType, {}, '0');

                    expect(result.animationMode).toBe('optimistic');
                },
            ),
            { numRuns: 100 },
        );
    });

    it('声明为 wait-confirm 的命令返回 animationMode=wait-confirm', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 50 }),
                (initialValue) => {
                    const engine = createAnimEngine({ INCREMENT: 'wait-confirm' });
                    engine.reconcile(createTestState(initialValue));

                    const result = engine.processCommand('INCREMENT', {}, '0');

                    expect(result.animationMode).toBe('wait-confirm');
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ============================================================================
// Property F：水位线等于乐观事件最大 ID
// ============================================================================

describe('Property F: 水位线等于乐观事件最大 ID', () => {
    // Feature: optimistic-animation, Property F: 水位线等于乐观事件最大 ID
    it('getMaxEventId 返回 entries 中最大 id（entries 按 ID 递增排列）', () => {
        fc.assert(
            fc.property(
                // EventStreamSystem 保证 entries 按 nextId 递增 push，生成排序后的 ID 数组
                fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 20 })
                    .map(ids => [...new Set(ids)].sort((a, b) => a - b)),
                (sortedIds) => {
                    fc.pre(sortedIds.length > 0);
                    const entries = sortedIds.map((id: number) => ({
                        id,
                        event: { type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: 0 } as GameEvent,
                    }));
                    const eventStream = { entries, maxEntries: 100, nextId: sortedIds[sortedIds.length - 1] + 1 };

                    const result = getMaxEventId(eventStream);

                    // entries 按 ID 递增排列，最后一个元素即最大值
                    expect(result).toBe(sortedIds[sortedIds.length - 1]);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('getMaxEventId 空 EventStream 返回 null', () => {
        const eventStream = { entries: [], maxEntries: 100, nextId: 1 };
        expect(getMaxEventId(eventStream)).toBeNull();
    });

    it('回滚时 optimisticEventWatermark 等于乐观事件最大 ID', () => {
        const engine = createAnimEngine({ INCREMENT: 'optimistic' });
        const initialState = createTestState(0, [], 1);
        engine.reconcile(initialState);

        engine.processCommand('INCREMENT', {}, '0');

        // 发送与乐观预测不一致的服务端状态，触发回滚
        const divergedState = createTestState(99, [], 1);
        const result = engine.reconcile(divergedState);

        if (result.didRollback) {
            expect(result.optimisticEventWatermark).not.toBeNull();
            expect(typeof result.optimisticEventWatermark).toBe('number');
        } else {
            expect(result.optimisticEventWatermark).toBeNull();
        }
    });
});

// ============================================================================
// Property G：回滚时过滤水位线以下事件
// ============================================================================

describe('Property G: 回滚时过滤水位线以下事件', () => {
    // Feature: optimistic-animation, Property G: 回滚时过滤水位线以下事件
    it('filterPlayedEvents 过滤 id <= watermark 的事件', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }),
                fc.integer({ min: 1, max: 50 }),
                (maxId, watermark) => {
                    const entries = Array.from({ length: maxId }, (_, i) => ({
                        id: i + 1,
                        event: { type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: 0 } as GameEvent,
                    }));
                    const state = createTestState(0, entries);

                    const filtered = filterPlayedEvents(state, watermark);

                    const remaining = filtered.sys.eventStream.entries;
                    expect(remaining.every((e: { id: number }) => e.id > watermark)).toBe(true);
                    expect(remaining.length).toBe(Math.max(0, maxId - watermark));
                },
            ),
            { numRuns: 100 },
        );
    });

    it('filterPlayedEvents 空 EventStream 返回原状态（引用相等）', () => {
        const state = createTestState(0, []);
        const result = filterPlayedEvents(state, 5);
        expect(result).toBe(state);
    });

    it('filterPlayedEvents 水位线高于所有事件时清空 entries', () => {
        const entries = [
            { id: 1, event: { type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: 0 } as GameEvent },
            { id: 2, event: { type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: 0 } as GameEvent },
        ];
        const state = createTestState(0, entries);
        const result = filterPlayedEvents(state, 10);
        expect(result.sys.eventStream.entries).toHaveLength(0);
    });

    it('filterPlayedEvents 水位线为 0 时不过滤任何事件', () => {
        const entries = [
            { id: 1, event: { type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: 0 } as GameEvent },
        ];
        const state = createTestState(0, entries);
        const result = filterPlayedEvents(state, 0);
        expect(result.sys.eventStream.entries).toHaveLength(1);
    });

    it('filterPlayedEvents watermark=null 时返回原状态（引用相等）', () => {
        const entries = [
            { id: 1, event: { type: 'VALUE_CHANGED', payload: { delta: 1 }, timestamp: 0 } as GameEvent },
        ];
        const state = createTestState(0, entries);
        const result = filterPlayedEvents(state, null);
        expect(result).toBe(state);
    });
});

// ============================================================================
// Property H：链式命令水位线取最大值
// ============================================================================

describe('Property H: 链式命令水位线取最大值', () => {
    // Feature: optimistic-animation, Property H: 链式命令水位线取最大值
    it('N 个连续 optimistic 命令后，回滚时水位线大于 0', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }),
                (n) => {
                    const engine = createAnimEngine({ INCREMENT: 'optimistic' });
                    engine.reconcile(createTestState(0, [], 1));

                    for (let i = 0; i < n; i++) {
                        engine.processCommand('INCREMENT', {}, '0');
                    }

                    // 发送与乐观预测不一致的服务端状态，触发回滚
                    const divergedState = createTestState(999, [], 1);
                    const result = engine.reconcile(divergedState);

                    if (result.didRollback) {
                        expect(result.optimisticEventWatermark).not.toBeNull();
                        expect(result.optimisticEventWatermark!).toBeGreaterThan(0);
                    }
                },
            ),
            { numRuns: 50 },
        );
    });

    it('链式命令 EventStream 最大 ID 单调递增', () => {
        const engine = createAnimEngine({ INCREMENT: 'optimistic' });
        engine.reconcile(createTestState(0, [], 1));

        const maxIds: number[] = [];
        for (let i = 0; i < 3; i++) {
            const r = engine.processCommand('INCREMENT', {}, '0');
            if (r.stateToRender) {
                const maxId = getMaxEventId(r.stateToRender.sys.eventStream);
                if (maxId !== null) maxIds.push(maxId);
            }
        }

        for (let i = 1; i < maxIds.length; i++) {
            expect(maxIds[i]).toBeGreaterThan(maxIds[i - 1]);
        }
    });
});

// ============================================================================
// Property I：全部确认后水位线重置
// ============================================================================

describe('Property I: 全部确认后水位线重置', () => {
    // Feature: optimistic-animation, Property I: 全部确认后水位线重置
    it('所有命令被服务端确认后，reconcile 返回 optimisticEventWatermark=null', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 5 }),
                (n) => {
                    const engine = createAnimEngine({ INCREMENT: 'optimistic' });
                    engine.reconcile(createTestState(0, [], 1));

                    for (let i = 0; i < n; i++) {
                        engine.processCommand('INCREMENT', {}, '0');
                    }

                    let lastResult = null;
                    for (let i = 1; i <= n; i++) {
                        const confirmedState = createTestState(i, [], i + 1);
                        lastResult = engine.reconcile(confirmedState);
                    }

                    expect(lastResult!.optimisticEventWatermark).toBeNull();
                    expect(engine.hasPendingCommands()).toBe(false);
                },
            ),
            { numRuns: 50 },
        );
    });

    it('reset 后水位线重置，后续 reconcile 返回 null 水位线', () => {
        const engine = createAnimEngine({ INCREMENT: 'optimistic' });
        engine.reconcile(createTestState(0, [], 1));
        engine.processCommand('INCREMENT', {}, '0');

        engine.reset();

        const result = engine.reconcile(createTestState(42));
        expect(result.optimisticEventWatermark).toBeNull();
    });
});
