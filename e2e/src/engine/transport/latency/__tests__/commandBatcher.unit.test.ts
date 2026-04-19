/**
 * CommandBatcher 单元测试
 *
 * Feature: transport-latency-optimization, Task 2.3
 * 覆盖：windowMs=0 退化、immediateCommands、maxBatchSize 边界、destroy
 * Validates: Requirements 4.5, 4.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCommandBatcher } from '../commandBatcher';
import type { BatchedCommand } from '../types';

describe('CommandBatcher 单元测试', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ========================================================================
    // windowMs=0 退化为逐条发送
    // ========================================================================

    describe('windowMs=0 退化模式', () => {
        it('每次 enqueue 立即触发 onFlush，每次只发一条', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 0,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('CMD_A', { a: 1 });
            batcher.enqueue('CMD_B', { b: 2 });
            batcher.enqueue('CMD_C', { c: 3 });

            // 每次 enqueue 都立即发送，共 3 次
            expect(flushCalls.length).toBe(3);
            expect(flushCalls[0]).toEqual([{ type: 'CMD_A', payload: { a: 1 } }]);
            expect(flushCalls[1]).toEqual([{ type: 'CMD_B', payload: { b: 2 } }]);
            expect(flushCalls[2]).toEqual([{ type: 'CMD_C', payload: { c: 3 } }]);

            batcher.destroy();
        });

        it('windowMs=0 时不启动定时器', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 0,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('CMD_A', null);

            // 推进时间不应产生额外 flush
            vi.advanceTimersByTime(1000);
            expect(flushCalls.length).toBe(1);

            batcher.destroy();
        });
    });

    // ========================================================================
    // immediateCommands 立即发送并 flush 队列
    // ========================================================================

    describe('immediateCommands', () => {
        it('immediate 命令立即发送，并 flush 队列中已有的命令', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 10,
                immediateCommands: ['URGENT'],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            // 先入队普通命令
            batcher.enqueue('NORMAL_A', 1);
            batcher.enqueue('NORMAL_B', 2);
            expect(flushCalls.length).toBe(0);

            // 入队 immediate 命令 → 立即 flush 整个队列（含 immediate 命令本身）
            batcher.enqueue('URGENT', 'go');
            expect(flushCalls.length).toBe(1);
            expect(flushCalls[0]).toEqual([
                { type: 'NORMAL_A', payload: 1 },
                { type: 'NORMAL_B', payload: 2 },
                { type: 'URGENT', payload: 'go' },
            ]);

            batcher.destroy();
        });

        it('immediate 命令在空队列时也立即发送', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 10,
                immediateCommands: ['URGENT'],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('URGENT', 'solo');
            expect(flushCalls.length).toBe(1);
            expect(flushCalls[0]).toEqual([{ type: 'URGENT', payload: 'solo' }]);

            batcher.destroy();
        });
    });

    // ========================================================================
    // maxBatchSize 边界触发自动 flush
    // ========================================================================

    describe('maxBatchSize', () => {
        it('队列达到 maxBatchSize 时自动 flush', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 3,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('A', 1);
            batcher.enqueue('B', 2);
            expect(flushCalls.length).toBe(0);

            // 第 3 条命令触发 maxBatchSize flush
            batcher.enqueue('C', 3);
            expect(flushCalls.length).toBe(1);
            expect(flushCalls[0].length).toBe(3);

            batcher.destroy();
        });

        it('maxBatchSize=1 时每条命令立即 flush', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 1,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('A', 1);
            batcher.enqueue('B', 2);

            expect(flushCalls.length).toBe(2);
            expect(flushCalls[0]).toEqual([{ type: 'A', payload: 1 }]);
            expect(flushCalls[1]).toEqual([{ type: 'B', payload: 2 }]);

            batcher.destroy();
        });

        it('flush 后新命令进入下一批次', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 2,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('A', 1);
            batcher.enqueue('B', 2); // 触发 flush
            batcher.enqueue('C', 3);
            batcher.enqueue('D', 4); // 触发 flush

            expect(flushCalls.length).toBe(2);
            expect(flushCalls[0]).toEqual([
                { type: 'A', payload: 1 },
                { type: 'B', payload: 2 },
            ]);
            expect(flushCalls[1]).toEqual([
                { type: 'C', payload: 3 },
                { type: 'D', payload: 4 },
            ]);

            batcher.destroy();
        });
    });

    // ========================================================================
    // destroy 后不再发送
    // ========================================================================

    describe('destroy', () => {
        it('destroy 后 enqueue 不发送', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.destroy();
            batcher.enqueue('A', 1);

            vi.advanceTimersByTime(200);
            expect(flushCalls.length).toBe(0);
        });

        it('destroy 后 flush 不发送', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('A', 1);
            batcher.destroy();
            batcher.flush();

            expect(flushCalls.length).toBe(0);
        });

        it('destroy 取消待触发的定时器', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('A', 1);
            batcher.destroy();

            // 推进时间，定时器不应触发
            vi.advanceTimersByTime(200);
            expect(flushCalls.length).toBe(0);
        });
    });

    // ========================================================================
    // 手动 flush
    // ========================================================================

    describe('手动 flush', () => {
        it('flush 立即发送队列中所有命令', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('A', 1);
            batcher.enqueue('B', 2);
            batcher.flush();

            expect(flushCalls.length).toBe(1);
            expect(flushCalls[0].length).toBe(2);

            batcher.destroy();
        });

        it('空队列 flush 不触发 onFlush', () => {
            const flushCalls: BatchedCommand[][] = [];
            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.flush();
            expect(flushCalls.length).toBe(0);

            batcher.destroy();
        });
    });
});
