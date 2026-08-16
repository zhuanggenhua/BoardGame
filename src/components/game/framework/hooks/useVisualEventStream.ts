/**
 * 视觉事件消费策略 Hook。
 *
 * 同一条 EventStream 事件在不同 UI 消费者里有不同语义：
 * - requiredSequence：攻击/受伤/摧毁等必播动画，只能按事件流游标消费，不能用时间戳丢弃。
 * - transientNotification：卡牌特写/揭示浮层等临时提示，首次挂载跳过已有基线，只展示之后新事件。
 * - derivedCurrentState：从状态或历史事件重建当前 UI，不应走播放队列。
 * - instantFeedback：音效/闪烁等轻量反馈，可按消费者自己规则处理。
 */

import { useMemo } from 'react';
import { useEventStreamCursor } from '../../../../engine/hooks';
import type { EventStreamEntry } from '../../../../engine/types';

export type VisualEventConsumptionStrategy =
    | 'requiredSequence'
    | 'transientNotification'
    | 'derivedCurrentState'
    | 'instantFeedback';

export interface UseVisualEventStreamConfig {
    entries: EventStreamEntry[];
    strategy: VisualEventConsumptionStrategy;
    consumeInitialEntries?: boolean;
    consumeOnReconcile?: boolean;
    reconnectToken?: number;
}

export interface UseVisualEventStreamReturn {
    consumeNew: ReturnType<typeof useEventStreamCursor>['consumeNew'];
    getCursor: ReturnType<typeof useEventStreamCursor>['getCursor'];
    resetToLatest: ReturnType<typeof useEventStreamCursor>['resetToLatest'];
    strategy: VisualEventConsumptionStrategy;
    isReplayQueue: boolean;
    skipsMountBaseline: boolean;
}

export function useVisualEventStream(config: UseVisualEventStreamConfig): UseVisualEventStreamReturn {
    const {
        entries,
        strategy,
        consumeInitialEntries,
        consumeOnReconcile,
        reconnectToken,
    } = config;

    const cursor = useEventStreamCursor({
        entries,
        consumeInitialEntries,
        consumeOnReconcile,
        reconnectToken,
    });

    if (strategy === 'derivedCurrentState') {
        throw new Error('derivedCurrentState 视觉事件消费者不能使用播放队列游标，应从当前状态或历史事件重建 UI');
    }

    return useMemo(() => ({
        ...cursor,
        strategy,
        isReplayQueue: strategy === 'requiredSequence',
        skipsMountBaseline: !consumeInitialEntries,
    }), [consumeInitialEntries, cursor, strategy]);
}
