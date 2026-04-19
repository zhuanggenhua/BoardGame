import { useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCoarsePointer } from './useCoarsePointer';
import { useTouchLongPress } from './useTouchLongPress';

const DEFAULT_DURATION_MS = 480;
const DEFAULT_MOVE_CANCEL_PX = 16;
const DEFAULT_CLICK_BLOCK_MS = 650;

export interface UseTouchInspectGestureConfig<TKey extends string | number, TPayload> {
    enabled: boolean;
    onInspect: (key: TKey, payload: TPayload) => void;
    durationMs?: number;
    moveCancelPx?: number;
    clickBlockMs?: number;
}

export interface UseTouchInspectGestureReturn<TKey extends string | number, TPayload> {
    isCoarsePointer: boolean;
    showDesktopInspectButton: boolean;
    getTouchInspectProps: (key: TKey, payload: TPayload) => {
        onPointerDown: (event: ReactPointerEvent) => void;
        onPointerMove: (event: ReactPointerEvent) => void;
        onPointerUp: () => void;
        onPointerCancel: () => void;
        onPointerLeave: () => void;
    };
    shouldBlockInspectClick: (key: TKey) => boolean;
}

export function useTouchInspectGesture<TKey extends string | number, TPayload>({
    enabled,
    onInspect,
    durationMs = DEFAULT_DURATION_MS,
    moveCancelPx = DEFAULT_MOVE_CANCEL_PX,
    clickBlockMs = DEFAULT_CLICK_BLOCK_MS,
}: UseTouchInspectGestureConfig<TKey, TPayload>): UseTouchInspectGestureReturn<TKey, TPayload> {
    const isCoarsePointer = useCoarsePointer();
    const {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        shouldBlockClick,
    } = useTouchLongPress<TKey, TPayload>({
        enabled: enabled && isCoarsePointer,
        durationMs,
        moveCancelPx,
        clickBlockMs,
        onLongPress: onInspect,
    });

    const getTouchInspectProps = useCallback((key: TKey, payload: TPayload) => ({
        onPointerDown: (event: ReactPointerEvent) => handlePointerDown(event, key, payload),
        onPointerMove: (event: ReactPointerEvent) => handlePointerMove(event, key),
        onPointerUp: () => handlePointerUp(key),
        onPointerCancel: () => handlePointerUp(key),
        onPointerLeave: () => handlePointerUp(key),
    }), [handlePointerDown, handlePointerMove, handlePointerUp]);

    const shouldBlockInspectClick = useCallback((key: TKey) => {
        return shouldBlockClick(key);
    }, [shouldBlockClick]);

    return {
        isCoarsePointer,
        showDesktopInspectButton: !isCoarsePointer,
        getTouchInspectProps,
        shouldBlockInspectClick,
    };
}
