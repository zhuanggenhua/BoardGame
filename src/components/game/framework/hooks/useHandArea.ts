/**
 * useHandArea - 手牌区交互逻辑 Hook
 *
 * 封装手牌区的拖拽状态管理和可见卡牌追踪。
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DragOffset } from '../../../../core/ui';
import type { UseHandAreaReturn } from '../../../../core/ui/hooks';

export interface UseHandAreaConfig<TCard> {
    /** 手牌列表 */
    cards: TCard[];
    /** 获取卡牌 ID 的函数 */
    getCardId: (card: TCard, index: number) => string;
    /** 是否启用发牌动画 */
    dealAnimation?: boolean;
    /** 发牌动画间隔 (ms) */
    dealInterval?: number;
    /** 打出卡牌的拖拽阈值 */
    playThreshold?: number;
    /** 售卖区域 ref */
    sellZoneRef?: React.RefObject<HTMLElement | null>;
}

/**
 * 手牌区交互逻辑
 *
 * @example
 * ```tsx
 * const {
 *   visibleCards,
 *   draggingCardId,
 *   dragOffset,
 *   handleDragStart,
 *   handleDrag,
 *   handleDragEnd,
 *   showPlayHint,
 *   showSellHint,
 * } = useHandArea({
 *   cards: hand,
 *   getCardId: (card) => card.id,
 *   dealAnimation: true,
 * });
 * ```
 */
export function useHandArea<TCard>({
    cards,
    getCardId,
    dealAnimation = false,
    dealInterval = 100,
    playThreshold = 150,
    sellZoneRef,
}: UseHandAreaConfig<TCard>): UseHandAreaReturn<TCard> {
    // 拖拽状态
    const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
    const [showPlayHint, setShowPlayHint] = useState(false);
    const [showSellHint, setShowSellHint] = useState(false);

    const dragStartRef = useRef<DragOffset>({ x: 0, y: 0 });

    // 发牌动画状态
    const [visibleCardIds, setVisibleCardIds] = useState<Set<string>>(new Set());
    const prevCardIdsRef = useRef<string[]>([]);

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

    // 发牌动画效果
    useEffect(() => {
        const currentIds = cards.map((card, i) => getCardId(card, i));
        const prevIds = prevCardIdsRef.current;

        if (!dealAnimation) {
            setVisibleCardIds(new Set(currentIds));
            prevCardIdsRef.current = currentIds;
            return;
        }

        const newIds = currentIds.filter(id => !prevIds.includes(id));

        if (newIds.length > 0) {
            const timers: number[] = [];
            newIds.forEach((id, i) => {
                const timer = window.setTimeout(() => {
                    setVisibleCardIds(prev => new Set([...prev, id]));
                }, i * dealInterval);
                timers.push(timer);
            });

            prevCardIdsRef.current = currentIds;
            return () => timers.forEach(t => clearTimeout(t));
        }

        // 移除不存在的卡牌
        setVisibleCardIds(new Set(currentIds));
        prevCardIdsRef.current = currentIds;
    }, [cards, getCardId, dealAnimation, dealInterval]);

    // 计算可见卡牌
    const visibleCards = dealAnimation
        ? cards.filter((card, i) => visibleCardIds.has(getCardId(card, i)))
        : cards;

    const handleDragStart = useCallback((cardId: string, startPos: DragOffset) => {
        setDraggingCardId(cardId);
        dragStartRef.current = startPos;
        setDragOffset({ x: 0, y: 0 });
    }, []);

    const handleDrag = useCallback(
        (cardId: string, currentPos: DragOffset) => {
            if (draggingCardId !== cardId) return;

            const offset: DragOffset = {
                x: currentPos.x - dragStartRef.current.x,
                y: currentPos.y - dragStartRef.current.y,
            };
            setDragOffset(offset);

            // 更新提示状态
            const inPlay = offset.y < -playThreshold;
            const inSell = isInSellZone(currentPos.x, currentPos.y);
            setShowPlayHint(inPlay && !inSell);
            setShowSellHint(inSell);
        },
        [draggingCardId, playThreshold, isInSellZone]
    );

    const handleDragEnd = useCallback(() => {
        setDraggingCardId(null);
        setDragOffset({ x: 0, y: 0 });
        setShowPlayHint(false);
        setShowSellHint(false);
    }, []);

    return {
        visibleCards,
        draggingCardId,
        dragOffset,
        handleDragStart,
        handleDrag,
        handleDragEnd,
        showPlayHint,
        showSellHint,
    };
}

export default useHandArea;
