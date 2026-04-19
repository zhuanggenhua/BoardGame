/**
 * 命令批处理器
 *
 * 在可配置的时间窗口内收集多个命令，合并为一次网络请求发送。
 * 支持立即发送命令（immediateCommands）和最大批次大小限制。
 * 当 windowMs 为 0 时退化为逐条发送模式。
 */

import type { BatchedCommand, BatcherState } from './types';

// ============================================================================
// 公共接口
// ============================================================================

/** 命令批处理器接口 */
export interface CommandBatcher {
    /**
     * 入队命令
     *
     * 将命令加入待发送队列，并启动/重置时间窗口定时器。
     * 若命令在 immediateCommands 列表中，则立即发送并 flush 队列。
     * 若队列达到 maxBatchSize，则自动 flush。
     */
    enqueue(type: string, payload: unknown): void;

    /**
     * 立即刷新队列
     *
     * 取消当前定时器，将队列中所有命令立即发送，清空队列。
     */
    flush(): void;

    /**
     * 销毁批处理器
     *
     * 清理定时器，不再发送任何命令。
     */
    destroy(): void;
}

// ============================================================================
// 工厂函数配置
// ============================================================================

/** createCommandBatcher 的配置参数 */
export interface CommandBatcherConfig {
    /** 批处理时间窗口（毫秒）。为 0 时退化为逐条发送模式 */
    windowMs: number;
    /** 最大批次命令数。队列达到此数量时自动 flush */
    maxBatchSize: number;
    /** 立即发送的命令类型列表。这些命令不等待时间窗口，立即发送并触发 flush */
    immediateCommands: string[];
    /**
     * flush 回调
     *
     * 当批次准备好发送时调用，负责将命令发送到网络。
     * 接收当前批次中的所有命令数组。
     */
    onFlush: (commands: BatchedCommand[]) => void;
}

// ============================================================================
// 工厂函数实现
// ============================================================================

/**
 * 创建命令批处理器
 *
 * @param config 批处理器配置
 * @returns CommandBatcher 实例
 */
export function createCommandBatcher(config: CommandBatcherConfig): CommandBatcher {
    // 初始化内部状态
    const state: BatcherState = {
        queue: [],
        timer: null,
        config: {
            windowMs: config.windowMs,
            maxBatchSize: config.maxBatchSize,
            immediateCommands: new Set(config.immediateCommands),
        },
    };

    /** 是否已销毁 */
    let destroyed = false;

    /**
     * 执行 flush：发送队列中所有命令并清空队列
     *
     * 内部实现，不检查 destroyed 状态（由调用方保证）。
     */
    function doFlush(): void {
        // 清理定时器
        if (state.timer !== null) {
            clearTimeout(state.timer);
            state.timer = null;
        }

        // 队列为空时不发送
        if (state.queue.length === 0) {
            return;
        }

        // 取出队列中的所有命令并清空
        const commands = state.queue.splice(0);

        // 调用 onFlush 回调发送命令
        config.onFlush(commands);
    }

    /**
     * 启动或重置时间窗口定时器
     *
     * 若 windowMs 为 0，不启动定时器（退化为逐条发送模式，由 enqueue 直接 flush）。
     */
    function scheduleFlush(): void {
        // windowMs 为 0 时不使用定时器
        if (state.config.windowMs === 0) {
            return;
        }

        // 重置已有定时器（滑动窗口）
        if (state.timer !== null) {
            clearTimeout(state.timer);
        }

        state.timer = setTimeout(() => {
            state.timer = null;
            if (!destroyed) {
                doFlush();
            }
        }, state.config.windowMs);
    }

    return {
        enqueue(type: string, payload: unknown): void {
            // 已销毁则忽略
            if (destroyed) {
                return;
            }

            // windowMs 为 0：退化为逐条发送，直接 flush 单条命令
            if (state.config.windowMs === 0) {
                config.onFlush([{ type, payload }]);
                return;
            }

            // 将命令加入队列
            state.queue.push({ type, payload });

            // immediateCommands：立即发送并 flush 整个队列
            if (state.config.immediateCommands.has(type)) {
                doFlush();
                return;
            }

            // 队列达到 maxBatchSize：自动 flush
            if (state.queue.length >= state.config.maxBatchSize) {
                doFlush();
                return;
            }

            // 启动/重置时间窗口定时器
            scheduleFlush();
        },

        flush(): void {
            if (destroyed) {
                return;
            }
            doFlush();
        },

        destroy(): void {
            destroyed = true;
            // 清理定时器，不发送剩余命令
            if (state.timer !== null) {
                clearTimeout(state.timer);
                state.timer = null;
            }
            // 清空队列
            state.queue.length = 0;
        },
    };
}
