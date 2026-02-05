/**
 * 手牌区骨架组件
 *
 * 封装拖拽和发牌动画逻辑，通过 renderCard 函数渲染卡牌样式。
 * 这是一个基础实现，提供核心的拖拽检测逻辑。
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { HandAreaFilterContext } from '../../../core/ui';
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
    canSelect = false,
    selectedCardIds = [],
    onSelectChange,
    onPlayCard,
    onSellCard,
    renderCard,
    layoutCode,
    selectEffectCode,
    sortCode,
    filterCode,
    filterContext,
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

    // 处理卡牌点击（选中/取消选中）
    const handleCardClick = useCallback(
        (cardId: string) => {
            if (!canSelect || isDraggingRef.current) return;
            const isCurrentlySelected = selectedCardIds.includes(cardId);
            onSelectChange?.(cardId, !isCurrentlySelected);
        },
        [canSelect, selectedCardIds, onSelectChange]
    );

    // 解析并执行排序代码
    const getSortFn = useMemo(() => {
        if (!sortCode) return undefined;
        try {
            // eslint-disable-next-line no-new-func
            return new Function('a', 'b', `return (${sortCode})(a, b)`) as (a: TCard, b: TCard) => number;
        } catch {
            return undefined;
        }
    }, [sortCode]);

    // 解析并执行过滤代码
    const getFilterFn = useMemo(() => {
        if (!filterCode) return undefined;
        try {
            // eslint-disable-next-line no-new-func
            return new Function('card', 'ctx', `return (${filterCode})(card, ctx)`) as (card: TCard, ctx: HandAreaFilterContext) => boolean;
        } catch {
            return undefined;
        }
    }, [filterCode]);

    const resolvedFilterContext = useMemo<HandAreaFilterContext>(() => {
        if (filterContext) {
            return {
                playerIds: filterContext.playerIds ?? [],
                currentPlayerId: filterContext.currentPlayerId ?? null,
                currentPlayerIndex: filterContext.currentPlayerIndex ?? -1,
                resolvedPlayerId: filterContext.resolvedPlayerId ?? null,
                resolvedPlayerIndex: filterContext.resolvedPlayerIndex ?? -1,
                bindEntity: filterContext.bindEntity,
                zoneField: filterContext.zoneField,
                zoneValue: filterContext.zoneValue,
            };
        }
        return {
            playerIds: [],
            currentPlayerId: null,
            currentPlayerIndex: -1,
            resolvedPlayerId: null,
            resolvedPlayerIndex: -1,
        };
    }, [filterContext]);

    // 应用排序和过滤后的卡牌列表
    const processedCards = useMemo(() => {
        let result = [...cards];
        if (getFilterFn) {
            result = result.filter(card => getFilterFn(card, resolvedFilterContext));
        }
        if (getSortFn) {
            result = result.sort(getSortFn);
        }
        return result;
    }, [cards, getFilterFn, getSortFn, resolvedFilterContext]);

    // 解析并执行布局代码
    const getLayoutStyle = useMemo(() => {
        if (!layoutCode) return undefined;
        try {
            // layoutCode 应该是函数体字符串
            // eslint-disable-next-line no-new-func
            return new Function('index', 'total', `return (${layoutCode})(index, total)`) as (index: number, total: number) => React.CSSProperties;
        } catch {
            return undefined;
        }
    }, [layoutCode]);

    // 解析并执行选中效果代码
    const getSelectStyle = useMemo(() => {
        if (!selectEffectCode) return undefined;
        try {
            // eslint-disable-next-line no-new-func
            return new Function('isSelected', `return (${selectEffectCode})(isSelected)`) as (isSelected: boolean) => React.CSSProperties;
        } catch {
            return undefined;
        }
    }, [selectEffectCode]);

    // 计算卡牌位置样式
    const getCardPositionStyle = useCallback(
        (index: number, isSelected: boolean, isDragging: boolean) => {
            const baseStyle: React.CSSProperties = {
                touchAction: 'none',
                cursor: canDrag ? 'grab' : canSelect ? 'pointer' : 'default',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            };

            // 应用布局代码
            const layoutStyle = getLayoutStyle?.(index, cards.length);
            if (layoutStyle) {
                Object.assign(baseStyle, layoutStyle);
            }

            // 应用选中效果代码
            const selectStyle = getSelectStyle?.(isSelected);
            if (selectStyle && !isDragging) {
                Object.assign(baseStyle, selectStyle);
            }

            // 拖拽偏移
            if (isDragging) {
                baseStyle.transform = `translate(${dragOffset.x}px, ${dragOffset.y}px)`;
                baseStyle.zIndex = 100;
            }

            return baseStyle;
        },
        [getLayoutStyle, getSelectStyle, dragOffset, canDrag, canSelect, processedCards.length]
    );

    return (
        <div
            className={className}
            data-hand-area="root"
            data-card-count={processedCards.length}
            data-max-cards={maxCards}
            data-is-dragging={!!draggingCardId}
            role="list"
            aria-label="手牌列表"
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}
        >
            {processedCards.map((card, index) => {
                const cardId = getCardId(card, index);
                const isDragging = cardId === draggingCardId;
                const isVisible = !dealAnimation || visibleCardIds.has(cardId);
                const isSelected = selectedCardIds.includes(cardId);

                return (
                    <div
                        key={cardId}
                        role="listitem"
                        data-card-id={cardId}
                        data-is-dragging={isDragging}
                        data-is-visible={isVisible}
                        data-is-selected={isSelected}
                        style={{
                            ...getCardPositionStyle(index, isSelected, isDragging),
                            opacity: isVisible ? 1 : 0,
                        }}
                        onPointerDown={(e) => handlePointerDown(cardId, e)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        onClick={() => handleCardClick(cardId)}
                    >
                        {renderCard(card, index, isSelected)}
                    </div>
                );
            })}
        </div>
    );
}) as <TCard>(props: HandAreaSkeletonProps<TCard>) => React.ReactElement;

export default HandAreaSkeleton;
