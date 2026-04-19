/**
 * EventStreamRollbackContext
 *
 * 轻量级 Context，用于 GameProvider 向 useEventStreamCursor 传递乐观回滚信号。
 *
 * 乐观引擎回滚时，EventStream 的事件 ID 空间可能与乐观预测重叠，
 * 导致游标误判"已消费"而跳过对手的新事件。
 * GameProvider 通过此 Context 传递回滚水位线，
 * useEventStreamCursor 据此重置游标到正确位置。
 */

import { createContext, useContext } from 'react';
import type { EventStreamWatermark } from '../transport/latency/types';

export interface EventStreamRollbackValue {
    /**
     * 乐观回滚水位线
     *
     * 非 null 时表示刚发生乐观回滚，游标应重置到此值。
     * GameProvider 在回滚时设置，下次非回滚更新时清除。
     */
    watermark: EventStreamWatermark;
    /**
     * 回滚序号（单调递增）
     *
     * 每次回滚递增，useEventStreamCursor 通过比较序号检测新回滚。
     */
    seq: number;
    /**
     * reconcile 确认序号（单调递增）
     *
     * 乐观引擎 reconcile 成功确认（didRollback=false）且 stateToRender 切换为
     * 服务端状态时递增。此时 EventStream 的 maxId 可能与乐观预测不同
     * （PRNG 微小漂移或事件数量差异），但这不是 Undo 回退。
     * cursor 应静默调整到新的 maxId，不触发 didReset。
     */
    reconcileSeq: number;
}

const DEFAULT_VALUE: EventStreamRollbackValue = { watermark: null, seq: 0, reconcileSeq: 0 };

export const EventStreamRollbackContext = createContext<EventStreamRollbackValue>(DEFAULT_VALUE);

/**
 * 读取当前乐观回滚信号（供 useEventStreamCursor 内部使用）
 */
export function useEventStreamRollback(): EventStreamRollbackValue {
    return useContext(EventStreamRollbackContext);
}
