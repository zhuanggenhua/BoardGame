import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type PointerType = 'touch' | 'pen' | 'mouse';

interface LongPressState<TKey extends string | number> {
    key: TKey;
    startX: number;
    startY: number;
    triggered: boolean;
}

interface LastLongPress<TKey extends string | number> {
    key: TKey;
    timestamp: number;
}

export interface UseTouchLongPressConfig<TKey extends string | number, TPayload> {
    enabled: boolean;
    durationMs: number;
    moveCancelPx: number;
    clickBlockMs: number;
    onLongPress: (key: TKey, payload: TPayload) => void;
    pointerType?: PointerType;
}

export interface UseTouchLongPressReturn<TKey extends string | number, TPayload> {
    clearLongPressState: (key?: TKey) => void;
    handlePointerDown: (event: ReactPointerEvent, key: TKey, payload: TPayload) => void;
    handlePointerMove: (event: ReactPointerEvent, key: TKey) => void;
    handlePointerUp: (key: TKey) => void;
    shouldBlockClick: (key: TKey) => boolean;
}

export function useTouchLongPress<TKey extends string | number, TPayload>({
    enabled,
    durationMs,
    moveCancelPx,
    clickBlockMs,
    onLongPress,
    pointerType = 'touch',
}: UseTouchLongPressConfig<TKey, TPayload>): UseTouchLongPressReturn<TKey, TPayload> {
    const timerRef = useRef<number | null>(null);
    const stateRef = useRef<LongPressState<TKey> | null>(null);
    const lastLongPressRef = useRef<LastLongPress<TKey> | null>(null);

    const clearLongPressState = useCallback((key?: TKey) => {
        const current = stateRef.current;
        if (!current) return;
        if (key !== undefined && current.key !== key) return;
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        stateRef.current = null;
    }, []);

    const handlePointerDown = useCallback((event: ReactPointerEvent, key: TKey, payload: TPayload) => {
        if (!enabled || event.pointerType !== pointerType) return;

        clearLongPressState();
        stateRef.current = {
            key,
            startX: event.clientX,
            startY: event.clientY,
            triggered: false,
        };

        timerRef.current = window.setTimeout(() => {
            const current = stateRef.current;
            if (!current || current.key !== key || current.triggered) return;
            current.triggered = true;
            lastLongPressRef.current = { key, timestamp: Date.now() };
            onLongPress(key, payload);
        }, durationMs);
    }, [clearLongPressState, durationMs, enabled, onLongPress, pointerType]);

    const handlePointerMove = useCallback((event: ReactPointerEvent, key: TKey) => {
        const current = stateRef.current;
        if (!current || current.key !== key || current.triggered || event.pointerType !== pointerType) return;

        const movedX = Math.abs(event.clientX - current.startX);
        const movedY = Math.abs(event.clientY - current.startY);
        if (movedX > moveCancelPx || movedY > moveCancelPx) {
            clearLongPressState(key);
        }
    }, [clearLongPressState, moveCancelPx, pointerType]);

    const handlePointerUp = useCallback((key: TKey) => {
        clearLongPressState(key);
    }, [clearLongPressState]);

    const shouldBlockClick = useCallback((key: TKey) => {
        const last = lastLongPressRef.current;
        if (!last || last.key !== key) return false;
        return Date.now() - last.timestamp < clickBlockMs;
    }, [clickBlockMs]);

    useEffect(() => {
        if (!enabled) {
            clearLongPressState();
        }
    }, [clearLongPressState, enabled]);

    useEffect(() => {
        return () => {
            clearLongPressState();
        };
    }, [clearLongPressState]);

    return {
        clearLongPressState,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        shouldBlockClick,
    };
}
