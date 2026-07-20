/**
 * 通用卡牌特写队列 Hook
 *
 * 消费 EventStream 事件，维护一个有上限的特写队列。
 * 默认只显示其他玩家产生的事件；未提供 currentPlayerId 时不过滤。
 *
 * 面向百游戏设计：
 * - 游戏层通过 triggerEventTypes + extractCard 配置触发条件和数据提取
 * - 框架层管理队列逻辑（上限、去重、Undo 重置）
 * - 游戏层只需提供渲染函数
 */

import { useReducer, useEffect, useRef, useCallback } from 'react';
import type { EventStreamEntry, GameEvent, PlayerId } from '../../../../engine/types';
import { useVisualEventStream, type VisualEventConsumptionStrategy } from './useVisualEventStream';

// ============================================================================
// 类型
// ============================================================================

/** 特写队列项 */
export interface SpotlightItem<TData = unknown> {
    /** 唯一标识 */
    id: string;
    /** 产生事件的玩家 */
    playerId: PlayerId;
    /** 游戏层自定义数据（传给 renderCard） */
    cardData: TData;
    /** 入队时间戳 */
    timestamp: number;
}

/** Hook 配置 */
export interface UseCardSpotlightQueueConfig<TData = unknown> {
    /** EventStream entries */
    entries: EventStreamEntry[];
    /** 当前玩家 ID（用于过滤自己的事件）；为 null/undefined 时不过滤 */
    currentPlayerId?: PlayerId | null;
    /** 是否在 reconcile 后继续消费服务端确认事件 */
    consumeOnReconcile?: boolean;
    /** 触发特写的事件类型集合 */
    triggerEventTypes: string[];
    /** 从事件中提取卡牌数据；返回 null 表示跳过 */
    extractCard: (event: GameEvent) => { playerId: PlayerId; cardData: TData } | null;
    /** 队列上限（默认 5） */
    maxQueue?: number;
    /**
     * 视觉事件消费策略。
     *
     * 卡牌特写属于临时提示，默认跳过首次挂载时已有的事件基线，
     * 只展示页面打开后新进入 EventStream 的事件。
     */
    eventStrategy?: Extract<VisualEventConsumptionStrategy, 'transientNotification'>;
}

/** Hook 返回值 */
export interface UseCardSpotlightQueueReturn<TData = unknown> {
    /** 当前队列 */
    queue: SpotlightItem<TData>[];
    /** 关闭指定项（从队列头部移除） */
    dismiss: (id: string) => void;
    /** 关闭全部 */
    dismissAll: () => void;
}

type SpotlightQueueAction<TData> =
    | {
        type: 'consume';
        resetQueue: boolean;
        items: SpotlightItem<TData>[];
        maxQueue: number;
    }
    | {
        type: 'dismiss';
        id: string;
    }
    | {
        type: 'dismiss-all';
    };

function spotlightQueueReducer<TData>(
    state: SpotlightItem<TData>[],
    action: SpotlightQueueAction<TData>,
): SpotlightItem<TData>[] {
    switch (action.type) {
        case 'consume': {
            const baseQueue = action.resetQueue ? [] : state;
            if (action.items.length === 0) {
                return baseQueue;
            }
            const merged = [...baseQueue, ...action.items];
            return merged.length > action.maxQueue
                ? merged.slice(merged.length - action.maxQueue)
                : merged;
        }
        case 'dismiss':
            return state.filter((item) => item.id !== action.id);
        case 'dismiss-all':
            return [];
        default:
            return state;
    }
}

// ============================================================================
// Hook
// ============================================================================

export function useCardSpotlightQueue<TData = unknown>(
    config: UseCardSpotlightQueueConfig<TData>,
): UseCardSpotlightQueueReturn<TData> {
    const {
        entries,
        currentPlayerId,
        consumeOnReconcile = false,
        triggerEventTypes,
        extractCard,
        maxQueue = 5,
        eventStrategy = 'transientNotification',
    } = config;

    const [queue, dispatch] = useReducer(spotlightQueueReducer<TData>, []);
    const triggerSetRef = useRef(new Set(triggerEventTypes));

    // 保持 triggerSet 同步
    useEffect(() => {
        triggerSetRef.current = new Set(triggerEventTypes);
    }, [triggerEventTypes]);

    const { consumeNew } = useVisualEventStream({
        entries,
        strategy: eventStrategy,
        consumeOnReconcile,
    });

    // 消费新事件
    useEffect(() => {
        const { entries: newEntries, didReset } = consumeNew();

        // Card spotlight is a player-readable exhibit, not a visual gate.
        // Generic optimistic/resync signals may strip EventStream entries briefly;
        // those must not close a visible opponent card. Only a real EventStream
        // reset/ID rollback (Undo snapshot restore) clears the queue.
        const resetQueue = didReset;
        const newItems: SpotlightItem<TData>[] = [];

        for (const entry of newEntries) {
            if (!triggerSetRef.current.has(entry.event.type)) continue;

            const extracted = extractCard(entry.event);
            if (!extracted) continue;

            // 仅在存在 viewer/playerId 时过滤“自己”的事件。
            if (currentPlayerId && extracted.playerId === currentPlayerId) continue;

            newItems.push({
                id: `spotlight-${entry.id}-${Date.now()}`,
                playerId: extracted.playerId,
                cardData: extracted.cardData,
                timestamp: Date.now(),
            });
        }

        if (resetQueue || newItems.length > 0) {
            dispatch({
                type: 'consume',
                resetQueue,
                items: newItems,
                maxQueue,
            });
        }
    }, [entries, consumeNew, currentPlayerId, extractCard, maxQueue]);

    const dismiss = useCallback((id: string) => {
        dispatch({ type: 'dismiss', id });
    }, []);

    const dismissAll = useCallback(() => {
        dispatch({ type: 'dismiss-all' });
    }, []);

    return { queue, dismiss, dismissAll };
}
