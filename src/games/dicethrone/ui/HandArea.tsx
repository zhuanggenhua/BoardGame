import React from 'react';
import type { RefObject } from 'react';
import { AnimatePresence, animate, motion, motionValue, type MotionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { AbilityCard, TurnPhase } from '../types';
import { buildLocalizedImageSet } from '../../../core';
import { ENGINE_NOTIFICATION_EVENT, type EngineNotificationDetail } from '../../../engine/notifications';
import { ASSETS } from './assets';
import type { CardAtlasConfig } from './cardAtlas';
import { getCardAtlasStyle } from './cardAtlas';
import { getAbilitySlotId } from './AbilityOverlays';

/** 飞出卡牌信息（成功使用后的动画） */
type FlyingOutCard = {
    card: AbilityCard;
    startOffset: { x: number; y: number };
    startIndex: number;
    targetType: 'discard' | 'abilitySlot';
    targetSlotId?: string;
};

// 5. Hand Area - 拖拽交互（向上拖拽打出，拖到弃牌堆售卖）
const DRAG_PLAY_THRESHOLD = -150; // 向上拖拽超过此距离触发打出

export const HandArea = ({
    hand,
    locale,
    atlas,
    currentPhase,
    playerCp: _playerCp = 0,
    onPlayCard,
    onSellCard,
    onError,
    canInteract = true,
    canPlayCards = true,
    drawDeckRef,
    discardPileRef,
    undoCardId,
    onSellHintChange,
    onPlayHintChange,
    onSellButtonChange,
    isDiscardMode = false,
    onDiscardCard,
}: {
    hand: AbilityCard[];
    locale?: string;
    atlas: CardAtlasConfig;
    currentPhase?: TurnPhase;
    playerCp?: number;
    onPlayCard?: (cardId: string) => void;
    onSellCard?: (cardId: string) => void;
    onError?: (message: string) => void;
    canInteract?: boolean;
    canPlayCards?: boolean;
    drawDeckRef?: RefObject<HTMLDivElement | null>;
    discardPileRef?: RefObject<HTMLDivElement | null>;
    undoCardId?: string;
    onSellHintChange?: (show: boolean) => void;
    onPlayHintChange?: (show: boolean) => void;
    onSellButtonChange?: (show: boolean) => void;
    /** 弃牌模式：手牌超限时点击卡牌直接弃置 */
    isDiscardMode?: boolean;
    /** 弃牌模式下点击卡牌的回调 */
    onDiscardCard?: (cardId: string) => void;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const [draggingCardId, setDraggingCardId] = React.useState<string | null>(null);
    const dragOffsetRef = React.useRef({ x: 0, y: 0 });
    const draggingCardRef = React.useRef<AbilityCard | null>(null);
    const dragEndHandledRef = React.useRef(false);
    const [showSellHint, setShowSellHint] = React.useState(false);
    const [returningCardMap, setReturningCardMap] = React.useState<
        Record<string, { version: number; offset: { x: number; y: number }; originalIndex: number }>
    >({});
    const [returningVersionMap, setReturningVersionMap] = React.useState<Record<string, number>>({});
    // 事件驱动的 hover 状态（用 onHoverStart/onHoverEnd 更新，避免 whileHover 的"元素移到鼠标下"误触发）
    const [hoveredCardId, setHoveredCardId] = React.useState<string | null>(null);
    // 飞出动画卡牌（成功使用后飞向目标）
    const [flyingOutCard, setFlyingOutCard] = React.useState<FlyingOutCard | null>(null);
    const pendingPlayRef = React.useRef<{
        cardId: string;
        card: AbilityCard;
        offset: { x: number; y: number };
        originalIndex: number;
    } | null>(null);
    const pendingPlayTimeoutRef = React.useRef<number | null>(null);
    const handRef = React.useRef(hand);
    const cardBackImage = React.useMemo(() => buildLocalizedImageSet(ASSETS.CARD_BG, locale), [locale]);
    const cardFrontImage = React.useMemo(() => buildLocalizedImageSet(ASSETS.CARDS_ATLAS, locale), [locale]);
    const handAreaRef = React.useRef<HTMLDivElement>(null);
    const dragValueMapRef = React.useRef(new Map<string, { x: MotionValue<number>; y: MotionValue<number> }>());

    const getDragValues = React.useCallback((cardId: string) => {
        const existing = dragValueMapRef.current.get(cardId);
        if (existing) return existing;
        const next = { x: motionValue(0), y: motionValue(0) };
        dragValueMapRef.current.set(cardId, next);
        return next;
    }, []);

    const resetDragValues = React.useCallback((cardId: string, _source: 'drag' | 'window') => {
        const values = dragValueMapRef.current.get(cardId);
        if (!values) return;
        animate(values.x, 0, { duration: 0.25, ease: 'easeOut' });
        animate(values.y, 0, { duration: 0.25, ease: 'easeOut' });
    }, []);

    const getDeckOffset = React.useCallback(() => {
        if (!drawDeckRef?.current || !handAreaRef.current) {
            return { x: -window.innerWidth * 0.4, y: -window.innerHeight * 0.1 };
        }
        const deckRect = drawDeckRef.current.getBoundingClientRect();
        const handRect = handAreaRef.current.getBoundingClientRect();
        const deckCenterX = deckRect.left + deckRect.width / 2;
        const deckCenterY = deckRect.top + deckRect.height / 2;
        const handCenterX = handRect.left + handRect.width / 2;
        const handCenterY = handRect.bottom - window.innerWidth * 0.06;
        return {
            x: deckCenterX - handCenterX,
            y: deckCenterY - handCenterY,
        };
    }, [drawDeckRef]);

    const getDiscardPileOffset = React.useCallback(() => {
        if (!discardPileRef?.current || !handAreaRef.current) {
            return { x: window.innerWidth * 0.4, y: -window.innerHeight * 0.1 };
        }
        const discardRect = discardPileRef.current.getBoundingClientRect();
        const handRect = handAreaRef.current.getBoundingClientRect();
        const discardCenterX = discardRect.left + discardRect.width / 2;
        const discardCenterY = discardRect.top + discardRect.height / 2;
        const handCenterX = handRect.left + handRect.width / 2;
        const handCenterY = handRect.bottom - window.innerWidth * 0.06;
        return {
            x: discardCenterX - handCenterX,
            y: discardCenterY - handCenterY,
        };
    }, [discardPileRef]);

    // 获取技能槽位置偏移（用于升级卡动画）
    const getAbilitySlotOffset = React.useCallback((slotId: string) => {
        if (!handAreaRef.current) {
            return { x: 0, y: -window.innerHeight * 0.4 };
        }
        const slotEl = document.querySelector(`[data-ability-slot="${slotId}"]`) as HTMLElement | null;
        if (!slotEl) {
            return { x: 0, y: -window.innerHeight * 0.4 };
        }
        const slotRect = slotEl.getBoundingClientRect();
        const handRect = handAreaRef.current.getBoundingClientRect();
        const slotCenterX = slotRect.left + slotRect.width / 2;
        const slotCenterY = slotRect.top + slotRect.height / 2;
        const handCenterX = handRect.left + handRect.width / 2;
        const handCenterY = handRect.bottom - window.innerWidth * 0.06;
        return {
            x: slotCenterX - handCenterX,
            y: slotCenterY - handCenterY,
        };
    }, []);

    const [visibleCardIds, setVisibleCardIds] = React.useState<Set<string>>(new Set());
    const [flippedCardIds, setFlippedCardIds] = React.useState<Set<string>>(new Set());
    const [dealingCardId, setDealingCardId] = React.useState<string | null>(null);
    const [cardSourceMap, setCardSourceMap] = React.useState<Map<string, 'deck' | 'discard'>>(new Map());
    const prevHandIdsRef = React.useRef<string[]>([]);
    const dealTimersRef = React.useRef<number[]>([]);
    const flipTimersRef = React.useRef<number[]>([]);

    const DEAL_INTERVAL = 150;  // 从 300ms 加快一倍
    const FLIP_INTERVAL = 125;  // 从 250ms 加快一倍
    const RETURN_RESET_DELAY = 320;
    const PENDING_PLAY_TIMEOUT = 2000;

    const totalCards = hand.length;
    const centerIndex = (totalCards - 1) / 2;

    const clearAnimationTimers = React.useCallback(() => {
        dealTimersRef.current.forEach(timerId => window.clearTimeout(timerId));
        flipTimersRef.current.forEach(timerId => window.clearTimeout(timerId));
        dealTimersRef.current = [];
        flipTimersRef.current = [];
    }, []);

    const clearPendingPlay = React.useCallback(() => {
        pendingPlayRef.current = null;
        if (pendingPlayTimeoutRef.current) {
            window.clearTimeout(pendingPlayTimeoutRef.current);
            pendingPlayTimeoutRef.current = null;
        }
    }, []);

    const triggerReturn = React.useCallback((cardId: string, offset: { x: number; y: number }, originalIndex: number) => {
        // 回弹时清除 hover 状态（事件驱动模型下，元素移动不会触发 onHoverStart）
        setHoveredCardId(prev => prev === cardId ? null : prev);
        setReturningCardMap(prev => {
            const prevEntry = prev[cardId];
            const nextVersion = (prevEntry?.version ?? 0) + 1;
            setReturningVersionMap(prevVersions => ({
                ...prevVersions,
                [cardId]: nextVersion,
            }));
            return {
                ...prev,
                [cardId]: {
                    version: nextVersion,
                    offset,
                    originalIndex,
                },
            };
        });
        window.setTimeout(() => {
            setReturningCardMap(prev => {
                if (!prev[cardId]) return prev;
                const next = { ...prev };
                delete next[cardId];
                return next;
            });
        }, RETURN_RESET_DELAY);
    }, [RETURN_RESET_DELAY]);

    React.useEffect(() => {
        handRef.current = hand;
        const pending = pendingPlayRef.current;
        if (pending && !hand.some(card => card.id === pending.cardId)) {
            // 卡牌成功使用（从手牌移除），触发飞出动画
            const { card, offset, originalIndex } = pending;
            
            // 判断目标位置：升级卡飞向技能槽，普通卡飞向弃牌堆
            if (card.type === 'upgrade') {
                // 从卡牌效果中提取目标技能 ID
                const replaceAction = card.effects?.find(e => e.action?.type === 'replaceAbility')?.action;
                const targetAbilityId = replaceAction?.type === 'replaceAbility' ? replaceAction.targetAbilityId : undefined;
                const slotId = targetAbilityId ? getAbilitySlotId(targetAbilityId) : null;
                
                if (slotId) {
                    setFlyingOutCard({
                        card,
                        startOffset: offset,
                        startIndex: originalIndex,
                        targetType: 'abilitySlot',
                        targetSlotId: slotId,
                    });
                } else {
                    // 找不到技能槽，默认飞向弃牌堆
                    setFlyingOutCard({
                        card,
                        startOffset: offset,
                        startIndex: originalIndex,
                        targetType: 'discard',
                    });
                }
            } else {
                // 普通卡牌飞向弃牌堆
                setFlyingOutCard({
                    card,
                    startOffset: offset,
                    startIndex: originalIndex,
                    targetType: 'discard',
                });
            }
            clearPendingPlay();
        }
    }, [clearPendingPlay, hand]);

    React.useEffect(() => {
        const currentIds = new Set(hand.map(card => card.id));
        dragValueMapRef.current.forEach((_value, cardId) => {
            if (!currentIds.has(cardId)) {
                dragValueMapRef.current.delete(cardId);
            }
        });
    }, [hand]);

    // 监听引擎通知：处理卡牌回弹（错误显示由全局 EngineNotificationListener 处理）
    React.useEffect(() => {
        const handler = (event: Event) => {
            const pending = pendingPlayRef.current;
            if (!pending) return;
            const detail = (event as CustomEvent<EngineNotificationDetail>).detail;
            if (!detail?.error) return;
            
            // 卡牌仍在手牌中则触发回弹动画
            if (!handRef.current.some(card => card.id === pending.cardId)) {
                clearPendingPlay();
                return;
            }
            triggerReturn(pending.cardId, pending.offset, pending.originalIndex);
            clearPendingPlay();
        };

        window.addEventListener(ENGINE_NOTIFICATION_EVENT, handler as EventListener);
        return () => window.removeEventListener(ENGINE_NOTIFICATION_EVENT, handler as EventListener);
    }, [clearPendingPlay, triggerReturn]);

    React.useEffect(() => {
        const currentIds = hand.map(c => c.id);
        const prevIds = prevHandIdsRef.current;
        const newIds = currentIds.filter(id => !prevIds.includes(id));
        const removedIds = prevIds.filter(id => !currentIds.includes(id));
        const hasDiff = newIds.length > 0 || removedIds.length > 0;

        if (!hasDiff) {
            prevHandIdsRef.current = currentIds;
            return;
        }

        clearAnimationTimers();
        setDealingCardId(null);

        if (removedIds.length > 0) {
            setVisibleCardIds(prev => {
                const next = new Set(prev);
                removedIds.forEach(id => next.delete(id));
                return next;
            });
            setFlippedCardIds(prev => {
                const next = new Set(prev);
                removedIds.forEach(id => next.delete(id));
                return next;
            });
        }

        if (newIds.length > 0) {
            const isUndoCard = (id: string) => id === undoCardId;
            const undoIds = newIds.filter(isUndoCard);
            const normalIds = newIds.filter(id => !isUndoCard(id));

            setCardSourceMap(prev => {
                const next = new Map(prev);
                newIds.forEach(id => {
                    next.set(id, isUndoCard(id) ? 'discard' : 'deck');
                });
                return next;
            });

            if (undoIds.length > 0) {
                setVisibleCardIds(prev => new Set([...prev, ...undoIds]));
                setFlippedCardIds(prev => new Set([...prev, ...undoIds]));
                undoIds.forEach(id => {
                    setDealingCardId(id);
                    const clearTimerId = window.setTimeout(() => {
                        setDealingCardId(prev => prev === id ? null : prev);
                    }, DEAL_INTERVAL - 50);
                    dealTimersRef.current.push(clearTimerId);
                });
            }

            normalIds.forEach((id, i) => {
                const dealTimerId = window.setTimeout(() => {
                    setDealingCardId(id);
                    setVisibleCardIds(prev => new Set([...prev, id]));
                    const clearTimerId = window.setTimeout(() => {
                        setDealingCardId(prev => prev === id ? null : prev);
                    }, DEAL_INTERVAL - 50);
                    dealTimersRef.current.push(clearTimerId);
                }, i * DEAL_INTERVAL);
                dealTimersRef.current.push(dealTimerId);
            });

            const dealEndTime = normalIds.length * DEAL_INTERVAL;
            const sortedNewIds = [...normalIds].sort((a, b) => {
                const idxA = currentIds.indexOf(a);
                const idxB = currentIds.indexOf(b);
                return idxA - idxB;
            });
            sortedNewIds.forEach((id, i) => {
                const flipTimerId = window.setTimeout(() => {
                    setFlippedCardIds(prev => new Set([...prev, id]));
                }, dealEndTime + i * FLIP_INTERVAL);
                flipTimersRef.current.push(flipTimerId);
            });
        }

        prevHandIdsRef.current = currentIds;
    }, [hand, clearAnimationTimers, undoCardId]);

    const isOverDiscardPile = React.useCallback(() => {
        if (!discardPileRef?.current || !draggingCardId) return false;
        const discardRect = discardPileRef.current.getBoundingClientRect();
        const draggedEl = document.querySelector(`[data-card-id="${draggingCardId}"]`) as HTMLElement | null;
        if (!draggedEl) return false;
        const cardRect = draggedEl.getBoundingClientRect();
        const cardCenterX = cardRect.left + cardRect.width / 2;
        const cardCenterY = cardRect.top + cardRect.height / 2;
        const padding = 20;
        return cardCenterX >= discardRect.left - padding &&
               cardCenterX <= discardRect.right + padding &&
               cardCenterY >= discardRect.top - padding &&
               cardCenterY <= discardRect.bottom + padding;
    }, [discardPileRef, draggingCardId]);

    const handleDragEnd = React.useCallback((card: AbilityCard, source: 'drag' | 'window' = 'drag') => {
        if (!canInteract) return;
        if (dragEndHandledRef.current && source === 'drag') return;
        dragEndHandledRef.current = true;
        const { x, y } = dragOffsetRef.current;
        const overDiscard = isOverDiscardPile();
        const currentIndex = hand.findIndex(c => c.id === card.id);
        const offset = { x, y };

        let actionTaken = false;
        // 向上拖拽打出：直接调用引擎，由引擎返回错误
        if (y < DRAG_PLAY_THRESHOLD) {
            if (onPlayCard) {
                pendingPlayRef.current = { cardId: card.id, card, offset, originalIndex: currentIndex };
                if (pendingPlayTimeoutRef.current) {
                    window.clearTimeout(pendingPlayTimeoutRef.current);
                }
                pendingPlayTimeoutRef.current = window.setTimeout(() => {
                    clearPendingPlay();
                }, PENDING_PLAY_TIMEOUT);
                onPlayCard(card.id);
                actionTaken = true;
            }
        }

        if (overDiscard) {
            if (!canPlayCards && onError) {
                onError(t('error.notYourTurn'));
            } else if (onSellCard) {
                onSellCard(card.id);
                actionTaken = true;
            }
        }

        if (!actionTaken) {
            triggerReturn(card.id, offset, currentIndex);
        }
        resetDragValues(card.id, source);
        setDraggingCardId(null);
        draggingCardRef.current = null;
        dragOffsetRef.current = { x: 0, y: 0 };
        onPlayHintChange?.(false);
        setShowSellHint(false);
        onSellHintChange?.(false);
        onSellButtonChange?.(false);
    }, [
        canInteract,
        canPlayCards,
        currentPhase,
        hand,
        isOverDiscardPile,
        onError,
        onPlayCard,
        onPlayHintChange,
        onSellCard,
        onSellButtonChange,
        onSellHintChange,
        resetDragValues,
        t,
        triggerReturn,
    ]);

    const handleDrag = (_cardId: string, info: { offset: { x: number; y: number } }) => {
        dragOffsetRef.current = info.offset;
        const canSellInPhase = currentPhase === 'main1' || currentPhase === 'main2' || currentPhase === 'discard';
        const nextSellHint = canSellInPhase && isOverDiscardPile();
        if (showSellHint !== nextSellHint) {
            setShowSellHint(nextSellHint);
            onSellHintChange?.(nextSellHint);
        }
    };

    React.useEffect(() => {
        const handlePointerEnd = (_event: PointerEvent) => {
            if (!draggingCardRef.current || dragEndHandledRef.current) return;
            handleDragEnd(draggingCardRef.current, 'window');
        };

        const handleWindowBlur = () => {
            if (!draggingCardRef.current || dragEndHandledRef.current) return;
            handleDragEnd(draggingCardRef.current, 'window');
        };

        window.addEventListener('pointerup', handlePointerEnd);
        window.addEventListener('pointercancel', handlePointerEnd);
        window.addEventListener('blur', handleWindowBlur);
        return () => {
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerEnd);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [handleDragEnd]);

    return (
        <div ref={handAreaRef} className="absolute bottom-0 left-0 right-0 z-[100] flex justify-center items-end pb-0 h-[22vw] pointer-events-none">
            <div className="relative w-[95vw] h-full flex justify-center items-end">
                <AnimatePresence>
                    {hand.map((card, i) => {
                        const isVisible = visibleCardIds.has(card.id);
                        if (!isVisible) return null;

                        const offset = i - centerIndex;
                        const rotation = offset * 5;
                        const yOffset = Math.abs(offset) * 0.8;
                        const spriteIndex = (card.atlasIndex ?? i) % (atlas.cols * atlas.rows);
                        const atlasStyle = getCardAtlasStyle(spriteIndex, atlas);
                        const isDragging = draggingCardId === card.id;
                        const isDealing = dealingCardId === card.id;
                        const isFlipped = flippedCardIds.has(card.id);
                        const returningEntry = returningCardMap[card.id];
                        const zIndex = isDragging ? 500 : 100 + i;
                        const isReturning = !!returningEntry;
                        const returnVersion = returningVersionMap[card.id] ?? 0;
                        // 弃牌模式下禁用拖拽，改用点击
                        const canDrag = canInteract && isFlipped && !isReturning && !isDiscardMode;
                        const canClickDiscard = isDiscardMode && isFlipped && !isReturning;
                        // 动画期间（dealing/returning）统一禁用 hover
                        const isHovered = hoveredCardId === card.id && (canDrag || canClickDiscard) && !isDragging && !isReturning && !isDealing;
                        const dragValues = getDragValues(card.id);

                                        return (
                                            <motion.div
                                key={`${card.id}-${returnVersion}`}
                                data-card-id={card.id}
                                drag={canDrag}
                                dragElastic={0.1}
                                dragMomentum={false}
                                onDragStart={() => {
                                    if (!canDrag) return;
                                    dragEndHandledRef.current = false;
                                    draggingCardRef.current = card;
                                    dragValues.x.set(0);
                                    dragValues.y.set(0);
                                    setDraggingCardId(card.id);
                                    onSellButtonChange?.(true);
                                    onPlayHintChange?.(true);
                                }}
                            onDrag={(_, info) => canDrag && handleDrag(card.id, info)}
                            onDragEnd={() => canDrag && handleDragEnd(card, 'drag')}
                            onClick={() => {
                                // 弃牌模式下点击卡牌直接弃置
                                if (canClickDiscard && onDiscardCard) {
                                    onDiscardCard(card.id);
                                }
                            }}
                            onHoverStart={() => {
                                if ((canDrag || canClickDiscard) && !isDragging && !isReturning) {
                                    setHoveredCardId(card.id);
                                }
                            }}
                            onHoverEnd={() => {
                                setHoveredCardId(prev => prev === card.id ? null : prev);
                            }}
                                className={`
                                    absolute bottom-0 w-[12vw] aspect-[0.61] rounded-[0.8vw]
                                    ${canClickDiscard ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
                                    pointer-events-auto origin-bottom-center bg-transparent overflow-visible
                                `}
                                style={{
                                    bottom: '-2vw',
                                    left: `calc(50% + ${offset * 7}vw - 6vw)`,
                                    x: dragValues.x,
                                    y: dragValues.y,
                                    zIndex,
                                }}
                            >
                                <motion.div
                                    className="relative w-full h-full"
                                    initial={isDealing
                                        ? (() => {
                                            const source = cardSourceMap.get(card.id) ?? (card.id === undoCardId ? 'discard' : 'deck');
                                            const pos = source === 'discard' ? getDiscardPileOffset() : getDeckOffset();
                                            const baseOffsetX = offset * window.innerWidth * 0.07;
                                            const baseOffsetY = yOffset * window.innerWidth * 0.01;
                                            return {
                                                opacity: 1,
                                                x: pos.x - baseOffsetX,
                                                y: pos.y - baseOffsetY,
                                                scale: 0.5,
                                                rotate: 0,
                                            };
                                        })()
                                        : (returningEntry ? (() => {
                                            const origOffset = returningEntry.originalIndex - centerIndex;
                                            const origYOffset = Math.abs(origOffset) * 0.8;
                                            return {
                                                opacity: 1,
                                                x: (origOffset - offset) * window.innerWidth * 0.07 + returningEntry.offset.x,
                                                y: (origYOffset - yOffset) * window.innerWidth * 0.01 + returningEntry.offset.y,
                                                scale: 1,
                                                rotate: 0,
                                            };
                                        })() : false)
                                    }
                                    animate={{
                                        opacity: 1,
                                        x: 0,
                                        y: isHovered ? -60 : yOffset * window.innerWidth * 0.01,
                                        scale: isDragging ? 1.15 : (isHovered ? 1.2 : 1),
                                        rotate: isDragging || isHovered ? 0 : rotation,
                                    }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={isDragging
                                        ? { duration: 0 }
                                        : {
                                            duration: 0.25,
                                            ease: 'easeOut',
                                        }
                                    }
                                >
                                    <div className="relative w-full h-full" style={{ perspective: '1000px' }}>
                                        <motion.div
                                            className={`
                                                relative w-full h-full rounded-[0.8vw] shadow-2xl
                                                ${isDragging ? 'ring-4 ring-amber-400 shadow-amber-500/50' : ''}
                                                ${canClickDiscard && isHovered ? 'ring-4 ring-red-500 shadow-red-500/50' : ''}
                                                ${canClickDiscard && !isHovered ? 'ring-2 ring-red-500/50' : ''}
                                            `}
                                            style={{ transformStyle: 'preserve-3d' }}
                                            initial={{ rotateY: isFlipped ? 0 : 180 }}
                                            animate={{ rotateY: isFlipped ? 0 : 180 }}
                                            transition={{ duration: 0.6 }}
                                        >
                                            <div
                                                className="absolute inset-0 w-full h-full rounded-[0.8vw] backface-hidden border border-slate-700"
                                                style={{
                                                    backgroundImage: cardFrontImage,
                                                    backgroundRepeat: 'no-repeat',
                                                    ...atlasStyle,
                                                }}
                                            />
                                            <div
                                                className="absolute inset-0 w-full h-full rounded-[0.8vw] backface-hidden border border-slate-700"
                                                style={{
                                                    transform: 'rotateY(180deg)',
                                                    backgroundImage: cardBackImage,
                                                    backgroundSize: 'cover',
                                                }}
                                            />
                                        </motion.div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                
                {/* 飞出动画卡牌（成功使用后飞向目标） */}
                <AnimatePresence>
                    {flyingOutCard && (() => {
                        const { card, startOffset, startIndex, targetType, targetSlotId } = flyingOutCard;
                        const spriteIndex = (card.atlasIndex ?? 0) % (atlas.cols * atlas.rows);
                        const atlasStyle = getCardAtlasStyle(spriteIndex, atlas);
                        const flyingCenterIndex = (hand.length) / 2; // 使用移除后的手牌数量计算
                        const startIndexOffset = startIndex - flyingCenterIndex;
                        const startYOffset = Math.abs(startIndexOffset) * 0.8;
                        
                        // 计算目标位置
                        const targetPos = targetType === 'abilitySlot' && targetSlotId
                            ? getAbilitySlotOffset(targetSlotId)
                            : getDiscardPileOffset();
                        
                        // 目标缩放比例：升级卡缩小到技能槽大小，普通卡缩小到弃牌堆大小
                        const targetScale = targetType === 'abilitySlot' ? 0.4 : 0.5;
                        
                        return (
                            <motion.div
                                key={`flying-${card.id}`}
                                className="absolute bottom-0 w-[12vw] aspect-[0.61] rounded-[0.8vw] pointer-events-none"
                                style={{
                                    bottom: '-2vw',
                                    left: `calc(50% + ${startIndexOffset * 7}vw - 6vw)`,
                                    zIndex: 600,
                                }}
                                initial={{
                                    x: startOffset.x,
                                    y: startOffset.y + startYOffset * window.innerWidth * 0.01,
                                    scale: 1,
                                    opacity: 1,
                                }}
                                animate={{
                                    x: targetPos.x - startIndexOffset * window.innerWidth * 0.07,
                                    y: targetPos.y - startYOffset * window.innerWidth * 0.01,
                                    scale: targetScale,
                                    opacity: targetType === 'abilitySlot' ? 0 : 1,
                                }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.35, ease: 'easeInOut' }}
                                onAnimationComplete={() => setFlyingOutCard(null)}
                            >
                                <div
                                    className="w-full h-full rounded-[0.8vw] border border-slate-700 shadow-2xl"
                                    style={{
                                        backgroundImage: cardFrontImage,
                                        backgroundRepeat: 'no-repeat',
                                        ...atlasStyle,
                                    }}
                                />
                            </motion.div>
                        );
                    })()}
                </AnimatePresence>
            </div>
        </div>
    );
};
