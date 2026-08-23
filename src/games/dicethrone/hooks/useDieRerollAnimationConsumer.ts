import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { useEventStreamCursor } from '../../../engine/hooks';
import type { EventStreamEntry } from '../../../engine/types';

interface UseDieRerollAnimationConsumerConfig {
    eventStreamEntries: EventStreamEntry[];
    setRerollingDiceIds: Dispatch<SetStateAction<number[]>>;
    setRerollAnimationSeq?: (seq: number | ((seq: number) => number)) => void;
    /** 当前右侧骰盘承接的奖励骰；首次投出时整组一起翻滚。 */
    bonusDiceIds?: number[];
    clearDelayMs?: number;
}

export function useDieRerollAnimationConsumer(config: UseDieRerollAnimationConsumerConfig): void {
    const {
        eventStreamEntries,
        setRerollingDiceIds,
        setRerollAnimationSeq,
        bonusDiceIds = [],
        clearDelayMs = 1000,
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
        let hasInitialBonusRoll = false;
        for (const entry of newEntries) {
            const event = entry.event as { type: string; payload?: { dieId?: number } };
            if (event.type === 'DIE_REROLLED' && typeof event.payload?.dieId === 'number') {
                rerolledDiceIds.push(event.payload.dieId);
            }
            if (event.type === 'BONUS_DIE_ROLLED') {
                hasInitialBonusRoll = true;
            }
        }

        const rollingDiceIds = hasInitialBonusRoll
            ? Array.from(new Set([...rerolledDiceIds, ...bonusDiceIds]))
            : rerolledDiceIds;
        if (rollingDiceIds.length === 0) return;

        if (clearTimerRef.current) {
            clearTimeout(clearTimerRef.current);
        }
        setRerollingDiceIds((current) => Array.from(new Set([...current, ...rollingDiceIds])));
        setRerollAnimationSeq?.((seq) => seq + 1);
        clearTimerRef.current = setTimeout(() => {
            clearTimerRef.current = null;
            setRerollingDiceIds([]);
        }, clearDelayMs);
    }, [bonusDiceIds, clearDelayMs, clearRerollAnimation, consumeNew, eventStreamEntries, setRerollAnimationSeq, setRerollingDiceIds]);
}
