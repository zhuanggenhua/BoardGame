import { useCallback, useEffect, useRef } from 'react';

import { useEventStreamCursor } from '../../../engine/hooks';
import type { EventStreamEntry } from '../../../engine/types';

interface UseDieRerollAnimationConsumerConfig {
    eventStreamEntries: EventStreamEntry[];
    setRerollingDiceIds: (ids: number[]) => void;
    clearDelayMs?: number;
}

export function useDieRerollAnimationConsumer(config: UseDieRerollAnimationConsumerConfig): void {
    const {
        eventStreamEntries,
        setRerollingDiceIds,
        clearDelayMs = 600,
    } = config;
    const { consumeNew } = useEventStreamCursor({ entries: eventStreamEntries });
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearRerollAnimation = useCallback(() => {
        if (clearTimerRef.current) {
            clearTimeout(clearTimerRef.current);
            clearTimerRef.current = null;
        }
        setRerollingDiceIds([]);
    }, [setRerollingDiceIds]);

    useEffect(() => () => {
        clearRerollAnimation();
    }, [clearRerollAnimation]);

    useEffect(() => {
        const { entries: newEntries, didReset, didOptimisticRollback } = consumeNew();
        if (didReset || didOptimisticRollback) {
            clearRerollAnimation();
            return;
        }

        if (newEntries.length === 0) return;

        const rerolledDiceIds: number[] = [];
        for (const entry of newEntries) {
            const event = entry.event as { type: string; payload?: { dieId?: number } };
            if (event.type === 'DIE_REROLLED' && typeof event.payload?.dieId === 'number') {
                rerolledDiceIds.push(event.payload.dieId);
            }
        }

        if (rerolledDiceIds.length === 0) return;

        if (clearTimerRef.current) {
            clearTimeout(clearTimerRef.current);
        }
        setRerollingDiceIds(rerolledDiceIds);
        clearTimerRef.current = setTimeout(() => {
            clearTimerRef.current = null;
            setRerollingDiceIds([]);
        }, clearDelayMs);
    }, [clearDelayMs, clearRerollAnimation, consumeNew, eventStreamEntries, setRerollingDiceIds]);
}
