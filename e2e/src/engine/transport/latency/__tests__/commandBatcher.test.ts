/**
 * CommandBatcher 单元测试
 *
 * 覆盖以下场景：
 * - windowMs=0 退化为逐条发送
 * - immediateCommands 立即发送并 flush 队列
 * - maxBatchSize 边界触发自动 flush
 * - destroy 后不再发送
 *
 * _Requirements: 4.5, 4.6_
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

    describe('windowMs=0 退化为逐条发送', () => {
        it('每次 enqueue 立即调用 onFlush，每次只包含一条命令', () => {
            const flushCalls: BatchedCommand[][] = [];

            const batcher = createCommandBatcher({
                windowMs: 0,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('CMD_A', { value: 1 });
            batcher.enqueue('CMD_B', { value: 2 });
            batcher.enqueue('CMD_C', { value: 3 });

            // 每次 enqueue 都应立即触发一次 onFlush
            expect(flushCalls.length).toBe(3);

            // 每次 flush 只包含一条命令
            expect(flushCalls[0]).toEqual([{ type: 'CMD_A', payload: { value: 1 } }]);
            expect(flushCalls[1]).toEqual([{ type: 'CMD_B', payload: { value: 2 } }]);
            expect(flushCalls[2]).toEqual([{ type: 'CMD_C', payload: { value: 3 } }]);

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

            // 推进时间不应产生额外的 flush
            vi.advanceTimersByTime(1000);
            expect(flushCalls.length).toBe(1);

            batcher.destroy();
        });
    });

    // ========================================================================
    // immediateCommands 立即发送并 flush 队列
    // ========================================================================

    describe('immediateCommands 立即发送并 flush 队列', () => {
        it('immediate 命令触发整个队列的 flush（包含之前排队的命令）', () => {
            const flushCalls: BatchedCommand[][] = [];

            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 20,
                immediateCommands: ['URGENT'],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            // 先入队两个普通命令
            batcher.enqueue('NORMAL_A', { a: 1 });
            batcher.enqueue('NORMAL_B', { b: 2 });

            // 此时不应触发 flush（时间窗口未到期）
            expect(flushCalls.length).toBe(0);

            // 入队一个 immediate 命令
            batcher.enqueue('URGENT', { urgent: true });

            // 应立即 flush，包含所有 3 条命令
            expect(flushCalls.length).toBe(1);
            expect(flushCalls[0]).toEqual([
                { type: 'NORMAL_A', payload: { a: 1 } },
                { type: 'NORMAL_B', payload: { b: 2 } },
                { type: 'URGENT', payload: { urgent: true } },
            ]);

            batcher.destroy();
        });

        it('immediate 命令在空队列时也能正常发送', () => {
            const flushCalls: BatchedCommand[][] = [];

            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 20,
                immediateCommands: ['URGENT'],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('URGENT', { solo: true });

            expect(flushCalls.length).toBe(1);
            expect(flushCalls[0]).toEqual([{ type: 'URGENT', payload: { solo: true } }]);

            batcher.destroy();
        });

        it('immediate 命令 flush 后，后续命令进入新的批次', () => {
            const flushCalls: BatchedCommand[][] = [];

            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 20,
                immediateCommands: ['URGENT'],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('NORMAL_A', 1);
            batcher.enqueue('URGENT', 2);

            // 第一次 flush
            expect(flushCalls.length).toBe(1);

            // 后续命令进入新批次
            batcher.enqueue('NORMAL_B', 3);
            vi.advanceTimersByTime(101);

            expect(flushCalls.length).toBe(2);
            expect(flushCalls[1]).toEqual([{ type: 'NORMAL_B', payload: 3 }]);

            batcher.destroy();
        });
    });

    // ========================================================================
    // maxBatchSize 边界触发自动 flush
    // ========================================================================

    describe('maxBatchSize 边界触发自动 flush', () => {
        it('队列达到 maxBatchSize 时自动 flush', () => {
            const flushCalls: BatchedCommand[][] = [];

            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 3,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('CMD_1', 1);
            batcher.enqueue('CMD_2', 2);

            // 还没到 maxBatchSize，不应 flush
            expect(flushCalls.length).toBe(0);

            batcher.enqueue('CMD_3', 3);

            // 达到 maxBatchSize=3，自动 flush
            expect(flushCalls.length).toBe(1);
            expect(flushCalls[0].length).toBe(3);
            expect(flushCalls[0].map((c) => c.type)).toEqual(['CMD_1', 'CMD_2', 'CMD_3']);

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

        it('自动 flush 后后续命令进入新批次', () => {
            const flushCalls: BatchedCommand[][] = [];

            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 2,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            // 第一批
            batcher.enqueue('A', 1);
            batcher.enqueue('B', 2);
            expect(flushCalls.length).toBe(1);

            // 第二批
            batcher.enqueue('C', 3);
            batcher.enqueue('D', 4);
            expect(flushCalls.length).toBe(2);

            expect(flushCalls[0].map((c) => c.type)).toEqual(['A', 'B']);
            expect(flushCalls[1].map((c) => c.type)).toEqual(['C', 'D']);

            batcher.destroy();
        });
    });

    // ========================================================================
    // destroy 后不再发送
    // ========================================================================

    describe('destroy 后不再发送', () => {
        it('destroy 后 enqueue 不触发 onFlush', () => {
            const flushCalls: BatchedCommand[][] = [];

            const batcher = createCommandBatcher({
                windowMs: 0,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.destroy();
            batcher.enqueue('CMD', { value: 1 });

            expect(flushCalls.length).toBe(0);
        });

        it('destroy 后 flush 不触发 onFlush', () => {
            const flushCalls: BatchedCommand[][] = [];

            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            // 入队一条命令
            batcher.enqueue('CMD', 1);
            expect(flushCalls.length).toBe(0);

            // 销毁
            batcher.destroy();

            // 手动 flush 不应发送
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

            batcher.enqueue('CMD', 1);
            batcher.destroy();

            // 推进时间，定时器不应触发
            vi.advanceTimersByTime(200);
            expect(flushCalls.length).toBe(0);
        });

        it('destroy 清空队列中的待发送命令', () => {
            const flushCalls: BatchedCommand[][] = [];

            const batcher = createCommandBatcher({
                windowMs: 100,
                maxBatchSize: 10,
                immediateCommands: [],
                onFlush: (cmds) => flushCalls.push([...cmds]),
            });

            batcher.enqueue('A', 1);
            batcher.enqueue('B', 2);
            batcher.destroy();

            // 即使推进时间，也不应发送
            vi.advanceTimersByTime(200);
            expect(flushCalls.length).toBe(0);
        });
    });
});
