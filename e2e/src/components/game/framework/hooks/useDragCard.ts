/**
 * useDragCard - 卡牌拖拽逻辑 Hook
 *
 * 封装单张卡牌的拖拽交互逻辑。
 */

import { useState, useCallback, useRef } from 'react';
import type { DragOffset } from '../../../../core/ui';
import type { UseDragCardConfig, UseDragCardReturn } from '../../../../core/ui/hooks';
import { useInteractionGuard } from '../InteractionGuard';

/**
 * 卡牌拖拽逻辑
 *
 * @example
 * ```tsx
 * const { isDragging, offset, dragHandlers, isInPlayZone } = useDragCard({
 *   playThreshold: 150,
 *   sellZoneRef: discardPileRef,
 *   onPlay: (cardId) => playCard(cardId),
 *   onSell: (cardId) => sellCard(cardId),
 * });
 *
 * return (
 *   <div {...dragHandlers} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
 *     <Card />
 *   </div>
 * );
 * ```
 */
export function useDragCard(
    cardId: string,
    config: UseDragCardConfig = {}
): UseDragCardReturn {
    const {
        playThreshold = 150,
        sellZoneRef,
        canInteract = true,
        onPlay,
        onSell,
        onCancel,
    } = config;

    const [isDragging, setIsDragging] = useState(false);
    const [offset, setOffset] = useState<DragOffset>({ x: 0, y: 0 });
    const [isInPlayZone, setIsInPlayZone] = useState(false);
    const [isInSellZone, setIsInSellZone] = useState(false);

    const startPosRef = useRef<DragOffset>({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const guard = useInteractionGuard();

    // 检测是否在售卖区域内
    const checkSellZone = useCallback(
        (clientX: number, clientY: number): boolean => {
            if (!sellZoneRef?.current) return false;
            const rect = sellZoneRef.current.getBoundingClientRect();
            return (
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom
            );
        },
        [sellZoneRef]
    );

    // 检测是否在打出区域内
    const checkPlayZone = useCallback(
        (offsetY: number): boolean => {
            return offsetY < -playThreshold;
        },
        [playThreshold]
    );

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        if (!canInteract) {
            guard.notifyDenied('drag-card-disabled', { key: 'drag-card-disabled' });
            return;
        }
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);

        isDraggingRef.current = true;
        startPosRef.current = { x: e.clientX, y: e.clientY };
        setIsDragging(true);
        setOffset({ x: 0, y: 0 });
    }, [canInteract, guard]);

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!isDraggingRef.current) return;

            const newOffset: DragOffset = {
                x: e.clientX - startPosRef.current.x,
                y: e.clientY - startPosRef.current.y,
            };
            setOffset(newOffset);

            const inPlay = checkPlayZone(newOffset.y);
            const inSell = checkSellZone(e.clientX, e.clientY);
            setIsInPlayZone(inPlay && !inSell);
            setIsInSellZone(inSell);
        },
        [checkPlayZone, checkSellZone]
    );

    const onPointerUp = useCallback(
        (e: React.PointerEvent) => {
            if (!isDraggingRef.current) return;

            const finalOffset: DragOffset = {
                x: e.clientX - startPosRef.current.x,
                y: e.clientY - startPosRef.current.y,
            };

            const inSell = checkSellZone(e.clientX, e.clientY);
            const inPlay = checkPlayZone(finalOffset.y);

            if (inSell && onSell) {
                onSell(cardId);
            } else if (inPlay && onPlay) {
                onPlay(cardId);
            } else {
                onCancel?.(cardId);
            }

            // 重置状态
            isDraggingRef.current = false;
            setIsDragging(false);
            setOffset({ x: 0, y: 0 });
            setIsInPlayZone(false);
            setIsInSellZone(false);
        },
        [cardId, checkSellZone, checkPlayZone, onSell, onPlay, onCancel]
    );

    const onPointerCancel = useCallback(() => {
        isDraggingRef.current = false;
        setIsDragging(false);
        setOffset({ x: 0, y: 0 });
        setIsInPlayZone(false);
        setIsInSellZone(false);
        onCancel?.(cardId);
    }, [cardId, onCancel]);

    return {
        isDragging,
        offset,
        dragHandlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
        },
        isInPlayZone,
        isInSellZone,
    };
}

export default useDragCard;
