/**
 * 手牌区骨架组件
 *
 * 封装拖拽和发牌动画逻辑，通过 renderCard 函数渲染卡牌样式。
 * 这是一个基础实现，提供核心的拖拽检测逻辑。
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import type { HandAreaSkeletonProps } from './types';
import type { DragOffset } from '../../../core/ui';

/**
 * 获取卡牌 ID
 */
function getCardId<TCard>(card: TCard, index: number): string {
    if (typeof card === 'object' && card !== null) {
        const obj = card as Record<string, unknown>;
        if ('id' in obj && typeof obj.id === 'string') return obj.id;
        if ('key' in obj && typeof obj.key === 'string') return obj.key;
    }
    return `card-${index}`;
}

/**
 * 手牌区骨架
 *
 * @example
 * ```tsx
 * <HandAreaSkeleton
 *   cards={hand}
 *   canDrag={true}
 *   onPlayCard={(cardId) => playCard(cardId)}
 *   onSellCard={(cardId) => sellCard(cardId)}
 *   renderCard={(card, index) => (
 *     <CardComponent card={card} />
 *   )}
 *   dragThreshold={150}
 *   sellZoneRef={discardPileRef}
 * />
 * ```
 */
export const HandAreaSkeleton = memo(function HandAreaSkeleton<TCard>({
    cards,
    maxCards,
    canDrag = true,
    onPlayCard,
    onSellCard,
    renderCard,
    className,
    dealAnimation = false,
    dragThreshold = 150,
    sellZoneRef,
    onDragStateChange,
    onPlayHintChange,
    onSellHintChange,
}: HandAreaSkeletonProps<TCard>) {
    // 拖拽状态
    const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
    const dragStartRef = useRef<DragOffset>({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);

    // 检测是否在售卖区域内
    const isInSellZone = useCallback(
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

    // 检测是否在打出区域内（向上拖拽超过阈值）
    const isInPlayZone = useCallback(
        (offsetY: number): boolean => {
            return offsetY < -dragThreshold;
        },
        [dragThreshold]
    );

    // 处理拖拽开始
    const handlePointerDown = useCallback(
        (cardId: string, e: React.PointerEvent) => {
            if (!canDrag) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);

            isDraggingRef.current = true;
            dragStartRef.current = { x: e.clientX, y: e.clientY };
            setDraggingCardId(cardId);
            setDragOffset({ x: 0, y: 0 });
            onDragStateChange?.(true, cardId);
        },
        [canDrag, onDragStateChange]
    );

    // 处理拖拽移动
    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!isDraggingRef.current || !draggingCardId) return;

            const offset: DragOffset = {
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y,
            };
            setDragOffset(offset);

            // 更新提示状态
            const inPlay = isInPlayZone(offset.y);
            const inSell = isInSellZone(e.clientX, e.clientY);
            onPlayHintChange?.(inPlay && !inSell);
            onSellHintChange?.(inSell);
        },
        [draggingCardId, isInPlayZone, isInSellZone, onPlayHintChange, onSellHintChange]
    );

    // 处理拖拽结束
    const handlePointerUp = useCallback(
        (e: React.PointerEvent) => {
            if (!isDraggingRef.current || !draggingCardId) return;

            const offset: DragOffset = {
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y,
            };

            // 判断拖拽目标
            const inSell = isInSellZone(e.clientX, e.clientY);
            const inPlay = isInPlayZone(offset.y);

            if (inSell && onSellCard) {
                onSellCard(draggingCardId);
            } else if (inPlay && onPlayCard) {
                onPlayCard(draggingCardId);
            }

            // 重置状态
            isDraggingRef.current = false;
            setDraggingCardId(null);
            setDragOffset({ x: 0, y: 0 });
            onDragStateChange?.(false, null);
            onPlayHintChange?.(false);
            onSellHintChange?.(false);
        },
        [
            draggingCardId,
            isInSellZone,
            isInPlayZone,
            onSellCard,
            onPlayCard,
            onDragStateChange,
            onPlayHintChange,
            onSellHintChange,
        ]
    );

    // 处理拖拽取消
    const handlePointerCancel = useCallback(() => {
        isDraggingRef.current = false;
        setDraggingCardId(null);
        setDragOffset({ x: 0, y: 0 });
        onDragStateChange?.(false, null);
        onPlayHintChange?.(false);
        onSellHintChange?.(false);
    }, [onDragStateChange, onPlayHintChange, onSellHintChange]);

    // 发牌动画状态追踪（简化版）
    const [visibleCardIds, setVisibleCardIds] = useState<Set<string>>(new Set());
    const prevCardIdsRef = useRef<string[]>([]);

    useEffect(() => {
        const currentIds = cards.map((card, i) => getCardId(card, i));
        const prevIds = prevCardIdsRef.current;

        if (!dealAnimation) {
            // 无动画时直接显示所有卡牌
            setVisibleCardIds(new Set(currentIds));
            prevCardIdsRef.current = currentIds;
            return;
        }

        // 检测新增的卡牌
        const newIds = currentIds.filter(id => !prevIds.includes(id));

        if (newIds.length > 0) {
            // 延迟显示新卡牌（用于发牌动画）
            const timers: number[] = [];
            newIds.forEach((id, i) => {
                const timer = window.setTimeout(() => {
                    setVisibleCardIds(prev => new Set([...prev, id]));
                }, i * 100); // 每张卡牌间隔 100ms
                timers.push(timer);
            });

            return () => timers.forEach(t => clearTimeout(t));
        }

        // 更新可见卡牌（移除已不存在的卡牌）
        setVisibleCardIds(new Set(currentIds));
        prevCardIdsRef.current = currentIds;
    }, [cards, dealAnimation]);

    return (
        <div
            className={className}
            data-hand-area="root"
            data-card-count={cards.length}
            data-max-cards={maxCards}
            data-is-dragging={!!draggingCardId}
            role="list"
            aria-label="Hand cards"
        >
            {cards.map((card, index) => {
                const cardId = getCardId(card, index);
                const isDragging = cardId === draggingCardId;
                const isVisible = !dealAnimation || visibleCardIds.has(cardId);

                return (
                    <div
                        key={cardId}
                        role="listitem"
                        data-card-id={cardId}
                        data-is-dragging={isDragging}
                        data-is-visible={isVisible}
                        style={{
                            transform: isDragging
                                ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
                                : undefined,
                            opacity: isVisible ? 1 : 0,
                            transition: isDragging ? 'none' : 'transform 0.2s, opacity 0.3s',
                            touchAction: 'none',
                            cursor: canDrag ? 'grab' : 'default',
                        }}
                        onPointerDown={(e) => handlePointerDown(cardId, e)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                    >
                        {renderCard(card, index)}
                    </div>
                );
            })}
        </div>
    );
}) as <TCard>(props: HandAreaSkeletonProps<TCard>) => JSX.Element;

export default HandAreaSkeleton;
