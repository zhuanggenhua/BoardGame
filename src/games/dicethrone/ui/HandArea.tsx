import React from 'react';
import type { RefObject } from 'react';
import { AnimatePresence, animate, motion, motionValue, type MotionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { AbilityCard, TurnPhase } from '../types';
import { buildLocalizedImageSet, UI_Z_INDEX } from '../../../core';
import { ENGINE_NOTIFICATION_EVENT, type EngineNotificationDetail } from '../../../engine/notifications';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { ASSETS } from './assets';
import { getAbilitySlotId } from './AbilityOverlays';

/** 飞出卡牌信息（成功使用后的动画） */
type FlyingOutCard = {
    card: AbilityCard;
    cardKey: string;
    startOffset: { x: number; y: number };
    startIndex: number;
    targetType: 'discard' | 'abilitySlot';
    targetSlotId?: string;
};

type HandCardEntry = {
    card: AbilityCard;
    key: string;
    index: number;
};

const buildHandCardKey = (cardId: string, sequence: number) => `${cardId}-${sequence}`;
const parseHandCardSequence = (cardKey: string, cardId: string) => {
    const prefix = `${cardId}-`;
    if (!cardKey.startsWith(prefix)) return 0;
    const sequence = Number(cardKey.slice(prefix.length));
    return Number.isFinite(sequence) ? sequence : 0;
};

// 5. Hand Area - 拖拽交互（向上拖拽打出，拖到弃牌堆售卖）
const DRAG_PLAY_THRESHOLD = -150; // 向上拖拽超过此距离触发打出

export const HandArea = ({
    hand,
    locale,
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
    respondableCardIds,
}: {
    hand: AbilityCard[];
    locale?: string;
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
    /** 响应窗口中可响应的卡牌 ID 集合（用于高亮） */
    respondableCardIds?: Set<string>;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const [draggingCardKey, setDraggingCardKey] = React.useState<string | null>(null);
    const dragOffsetRef = React.useRef({ x: 0, y: 0 });
    const draggingCardRef = React.useRef<HandCardEntry | null>(null);
    const dragEndHandledRef = React.useRef(false);
    const [showSellHint, setShowSellHint] = React.useState(false);
    const [returningCardMap, setReturningCardMap] = React.useState<
        Record<string, { version: number; offset: { x: number; y: number }; originalIndex: number }>
    >({});
    const [returningVersionMap, setReturningVersionMap] = React.useState<Record<string, number>>({});
    // 事件驱动的 hover 状态（用 onHoverStart/onHoverEnd 更新，避免 whileHover 的"元素移到鼠标下"误触发）
    const [hoveredCardKey, setHoveredCardKey] = React.useState<string | null>(null);
    // 飞出动画卡牌（成功使用后飞向目标）
    const [flyingOutCard, setFlyingOutCard] = React.useState<FlyingOutCard | null>(null);
    // 弃牌模式下等待飞出的卡牌（点击弃牌时记录，卡牌从手牌移除后触发飞出动画）
    const pendingDiscardRef = React.useRef<{
        cardKey: string;
        card: AbilityCard;
        originalIndex: number;
    } | null>(null);
    // 正在弃牌的 cardKey（用于跳过 exit 动画，避免和飞出动画重叠）
    const [discardingCardKey, setDiscardingCardKey] = React.useState<string | null>(null);
    const handEntriesRef = React.useRef<HandCardEntry[]>([]);
    const cardKeySequenceRef = React.useRef<Map<string, number>>(new Map());
    const pendingPlayRef = React.useRef<{
        cardKey: string;
        card: AbilityCard;
        offset: { x: number; y: number };
        originalIndex: number;
    } | null>(null);
    const pendingPlayTimeoutRef = React.useRef<number | null>(null);
    const handKeysRef = React.useRef<string[]>([]);
    const cardBackImage = React.useMemo(() => buildLocalizedImageSet(ASSETS.CARD_BG, locale), [locale]);
    const handAreaRef = React.useRef<HTMLDivElement>(null);
    const dragValueMapRef = React.useRef(new Map<string, { x: MotionValue<number>; y: MotionValue<number> }>());
    // 防止拖拽后触发点击：记录最近拖拽的卡牌和时间
    const lastDragEndRef = React.useRef<{ cardKey: string; timestamp: number } | null>(null);
    const DRAG_CLICK_DEBOUNCE = 300; // 拖拽后 300ms 内忽略点击

    const handEntries = React.useMemo<HandCardEntry[]>(() => {
        const prevEntries = handEntriesRef.current;
        const prevQueues = new Map<string, HandCardEntry[]>();

        prevEntries.forEach((entry) => {
            const queue = prevQueues.get(entry.card.id) ?? [];
            queue.push(entry);
            prevQueues.set(entry.card.id, queue);

            const prevMax = cardKeySequenceRef.current.get(entry.card.id) ?? 0;
            const sequence = parseHandCardSequence(entry.key, entry.card.id);
            if (sequence > prevMax) {
                cardKeySequenceRef.current.set(entry.card.id, sequence);
            }
        });

        return hand.map((card, index) => {
            const queue = prevQueues.get(card.id);
            const reused = queue?.shift();
            if (reused) {
                return { ...reused, card, index };
            }
            const nextSequence = (cardKeySequenceRef.current.get(card.id) ?? 0) + 1;
            cardKeySequenceRef.current.set(card.id, nextSequence);
            return { card, index, key: buildHandCardKey(card.id, nextSequence) };
        });
    }, [hand]);

    React.useEffect(() => {
        handEntriesRef.current = handEntries;
    }, [handEntries]);

    const handKeys = React.useMemo(() => handEntries.map(entry => entry.key), [handEntries]);
    const handKeyToCardId = React.useMemo(
        () => new Map(handEntries.map(entry => [entry.key, entry.card.id] as const)),
        [handEntries]
    );

    const getDragValues = React.useCallback((cardKey: string) => {
        const existing = dragValueMapRef.current.get(cardKey);
        if (existing) return existing;
        const next = { x: motionValue(0), y: motionValue(0) };
        dragValueMapRef.current.set(cardKey, next);
        return next;
    }, []);

    const resetDragValues = React.useCallback((cardKey: string, _source: 'drag' | 'window') => {
        const values = dragValueMapRef.current.get(cardKey);
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

    const [visibleCardKeys, setVisibleCardKeys] = React.useState<Set<string>>(new Set());
    const [flippedCardKeys, setFlippedCardKeys] = React.useState<Set<string>>(new Set());
    const [dealingCardKey, setDealingCardKey] = React.useState<string | null>(null);
    const [cardSourceMap, setCardSourceMap] = React.useState<Map<string, 'deck' | 'discard'>>(new Map());
    const prevHandKeysRef = React.useRef<string[]>([]);
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

    const triggerReturn = React.useCallback((cardKey: string, offset: { x: number; y: number }, originalIndex: number) => {
        // 回弹时清除 hover 状态（事件驱动模型下，元素移动不会触发 onHoverStart）
        setHoveredCardKey(prev => prev === cardKey ? null : prev);
        setReturningCardMap(prev => {
            const prevEntry = prev[cardKey];
            const nextVersion = (prevEntry?.version ?? 0) + 1;
            setReturningVersionMap(prevVersions => ({
                ...prevVersions,
                [cardKey]: nextVersion,
            }));
            return {
                ...prev,
                [cardKey]: {
                    version: nextVersion,
                    offset,
                    originalIndex,
                },
            };
        });
        window.setTimeout(() => {
            setReturningCardMap(prev => {
                if (!prev[cardKey]) return prev;
                const next = { ...prev };
                delete next[cardKey];
                return next;
            });
        }, RETURN_RESET_DELAY);
    }, [RETURN_RESET_DELAY]);

    React.useEffect(() => {
        handKeysRef.current = handKeys;

        // 弃牌模式：卡牌从手牌移除后触发飞向弃牌堆动画
        const pendingDiscard = pendingDiscardRef.current;
        if (pendingDiscard && !handKeys.includes(pendingDiscard.cardKey)) {
            const { card, cardKey, originalIndex } = pendingDiscard;
            setFlyingOutCard({
                card,
                cardKey,
                startOffset: { x: 0, y: 0 },
                startIndex: originalIndex,
                targetType: 'discard',
            });
            pendingDiscardRef.current = null;
            setDiscardingCardKey(null);
        }

        // 拖拽打出：卡牌成功使用（从手牌移除），触发飞出动画
        const pending = pendingPlayRef.current;
        if (pending && !handKeys.includes(pending.cardKey)) {
            const { card, offset, originalIndex, cardKey } = pending;

            // 判断目标位置：升级卡飞向技能槽，普通卡飞向弃牌堆
            if (card.type === 'upgrade') {
                // 从卡牌效果中提取目标技能 ID
                const replaceAction = card.effects?.find(e => e.action?.type === 'replaceAbility')?.action;
                const targetAbilityId = replaceAction?.type === 'replaceAbility' ? replaceAction.targetAbilityId : undefined;
                const slotId = targetAbilityId ? getAbilitySlotId(targetAbilityId) : null;

                if (slotId) {
                    setFlyingOutCard({
                        card,
                        cardKey,
                        startOffset: offset,
                        startIndex: originalIndex,
                        targetType: 'abilitySlot',
                        targetSlotId: slotId,
                    });
                } else {
                    // 找不到技能槽，默认飞向弃牌堆
                    setFlyingOutCard({
                        card,
                        cardKey,
                        startOffset: offset,
                        startIndex: originalIndex,
                        targetType: 'discard',
                    });
                }
            } else {
                // 普通卡牌飞向弃牌堆
                setFlyingOutCard({
                    card,
                    cardKey,
                    startOffset: offset,
                    startIndex: originalIndex,
                    targetType: 'discard',
                });
            }
            clearPendingPlay();
        }
    }, [clearPendingPlay, handKeys]);

    React.useEffect(() => {
        const currentKeys = new Set(handKeys);
        dragValueMapRef.current.forEach((_value, cardKey) => {
            if (!currentKeys.has(cardKey)) {
                dragValueMapRef.current.delete(cardKey);
            }
        });
    }, [handKeys]);

    // 监听引擎通知：处理卡牌回弹（错误显示由全局 EngineNotificationListener 处理）
    React.useEffect(() => {
        const handler = (event: Event) => {
            const pending = pendingPlayRef.current;
            if (!pending) return;
            const detail = (event as CustomEvent<EngineNotificationDetail>).detail;
            if (!detail?.error) return;

            // 卡牌仍在手牌中则触发回弹动画
            if (!handKeysRef.current.includes(pending.cardKey)) {
                clearPendingPlay();
                return;
            }
            triggerReturn(pending.cardKey, pending.offset, pending.originalIndex);
            resetDragValues(pending.cardKey, 'drag');
            clearPendingPlay();
        };

        window.addEventListener(ENGINE_NOTIFICATION_EVENT, handler as EventListener);
        return () => window.removeEventListener(ENGINE_NOTIFICATION_EVENT, handler as EventListener);
    }, [clearPendingPlay, resetDragValues, triggerReturn]);

    React.useEffect(() => {
        const currentKeys = handKeys;
        const prevKeys = prevHandKeysRef.current;
        const newKeys = currentKeys.filter(key => !prevKeys.includes(key));
        const removedKeys = prevKeys.filter(key => !currentKeys.includes(key));
        const hasDiff = newKeys.length > 0 || removedKeys.length > 0;

        if (!hasDiff) {
            prevHandKeysRef.current = currentKeys;
            return;
        }

        clearAnimationTimers();
        setDealingCardKey(null);

        if (removedKeys.length > 0) {
            setVisibleCardKeys(prev => {
                const next = new Set(prev);
                removedKeys.forEach(key => next.delete(key));
                return next;
            });
            setFlippedCardKeys(prev => {
                const next = new Set(prev);
                removedKeys.forEach(key => next.delete(key));
                return next;
            });
        }

        if (newKeys.length > 0) {
            const isUndoCard = (key: string) => handKeyToCardId.get(key) === undoCardId;
            const undoKeys = newKeys.filter(isUndoCard);
            const normalKeys = newKeys.filter(key => !isUndoCard(key));

            setCardSourceMap(prev => {
                const next = new Map(prev);
                newKeys.forEach(key => {
                    next.set(key, isUndoCard(key) ? 'discard' : 'deck');
                });
                return next;
            });

            if (undoKeys.length > 0) {
                setVisibleCardKeys(prev => new Set([...prev, ...undoKeys]));
                setFlippedCardKeys(prev => new Set([...prev, ...undoKeys]));
                undoKeys.forEach(key => {
                    setDealingCardKey(key);
                    const clearTimerId = window.setTimeout(() => {
                        setDealingCardKey(prev => prev === key ? null : prev);
                    }, DEAL_INTERVAL - 50);
                    dealTimersRef.current.push(clearTimerId);
                });
            }

            normalKeys.forEach((key, i) => {
                const dealTimerId = window.setTimeout(() => {
                    setDealingCardKey(key);
                    setVisibleCardKeys(prev => new Set([...prev, key]));
                    const clearTimerId = window.setTimeout(() => {
                        setDealingCardKey(prev => prev === key ? null : prev);
                    }, DEAL_INTERVAL - 50);
                    dealTimersRef.current.push(clearTimerId);
                }, i * DEAL_INTERVAL);
                dealTimersRef.current.push(dealTimerId);
            });

            const dealEndTime = normalKeys.length * DEAL_INTERVAL;
            const sortedNewKeys = [...normalKeys].sort((a, b) => {
                const idxA = currentKeys.indexOf(a);
                const idxB = currentKeys.indexOf(b);
                return idxA - idxB;
            });
            sortedNewKeys.forEach((key, i) => {
                const flipTimerId = window.setTimeout(() => {
                    setFlippedCardKeys(prev => new Set([...prev, key]));
                }, dealEndTime + i * FLIP_INTERVAL);
                flipTimersRef.current.push(flipTimerId);
            });
        }

        prevHandKeysRef.current = currentKeys;
    }, [clearAnimationTimers, handKeyToCardId, handKeys, undoCardId]);

    const isOverDiscardPile = React.useCallback(() => {
        if (!discardPileRef?.current || !draggingCardKey) return false;
        const discardRect = discardPileRef.current.getBoundingClientRect();
        const draggedEl = document.querySelector(`[data-card-key="${draggingCardKey}"]`) as HTMLElement | null;
        if (!draggedEl) return false;
        const cardRect = draggedEl.getBoundingClientRect();
        const cardCenterX = cardRect.left + cardRect.width / 2;
        const cardCenterY = cardRect.top + cardRect.height / 2;
        const padding = 20;
        const result = cardCenterX >= discardRect.left - padding &&
            cardCenterX <= discardRect.right + padding &&
            cardCenterY >= discardRect.top - padding &&
            cardCenterY <= discardRect.bottom + padding;
        return result;
    }, [discardPileRef, draggingCardKey]);

    const handleDragEnd = React.useCallback((entry: HandCardEntry, source: 'drag' | 'window' = 'drag') => {
        if (!canInteract) return;
        if (dragEndHandledRef.current && source === 'drag') return;
        dragEndHandledRef.current = true;
        const { x, y } = dragOffsetRef.current;
        const overDiscard = isOverDiscardPile();
        const currentIndex = handEntries.findIndex(item => item.key === entry.key);
        const offset = { x, y };
        const card = entry.card;

        let actionTaken = false;
        // 向上拖拽打出：直接调用引擎，由引擎返回错误
        if (y < DRAG_PLAY_THRESHOLD) {
            if (onPlayCard) {
                // 记录拖拽操作，防止后续点击事件重复触发
                lastDragEndRef.current = { cardKey: entry.key, timestamp: Date.now() };
                
                pendingPlayRef.current = { cardKey: entry.key, card, offset, originalIndex: currentIndex };
                if (pendingPlayTimeoutRef.current) {
                    window.clearTimeout(pendingPlayTimeoutRef.current);
                }
                pendingPlayTimeoutRef.current = window.setTimeout(() => {
                    // 超时安全网：reset drag values 并回弹
                    resetDragValues(entry.key, 'drag');
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
                // 记录拖拽操作，防止后续点击事件重复触发
                lastDragEndRef.current = { cardKey: entry.key, timestamp: Date.now() };
                
                // 和拖拽打出一样，记录 pending 状态，卡牌移除后触发飞向弃牌堆动画
                pendingPlayRef.current = { cardKey: entry.key, card, offset, originalIndex: currentIndex };
                if (pendingPlayTimeoutRef.current) {
                    window.clearTimeout(pendingPlayTimeoutRef.current);
                }
                pendingPlayTimeoutRef.current = window.setTimeout(() => {
                    resetDragValues(entry.key, 'drag');
                    clearPendingPlay();
                }, PENDING_PLAY_TIMEOUT);
                onSellCard(card.id);
                actionTaken = true;
            }
        }

        if (!actionTaken) {
            triggerReturn(entry.key, offset, currentIndex);
            resetDragValues(entry.key, source);
        }
        setDraggingCardKey(null);
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

    const handleDrag = (_cardKey: string, info: { offset: { x: number; y: number } }) => {
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

    // 教程高亮目标：根据手牌数量动态计算卡牌区域宽度，避免全屏宽度的蓝框
    const cardSpreadWidth = totalCards > 0
        ? (totalCards - 1) * 7 + 12 + 4 // (n-1)*间距 + 卡宽 + 两侧余量（单位 vw）
        : 20;
    const cardAreaHeight = 18; // 卡牌可见高度（vw），卡牌高度约19.7vw减去底部溢出2vw

    return (
        <div
            ref={handAreaRef}
            className="absolute bottom-0 left-0 right-0 flex justify-center items-end pb-0 h-[22vw] pointer-events-none"
            style={{ zIndex: UI_Z_INDEX.hud }}
        >
            {/* 教程高亮目标：仅覆盖实际卡牌区域 */}
            <div
                data-tutorial-id="hand-area"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none"
                style={{ width: `${cardSpreadWidth}vw`, height: `${cardAreaHeight}vw` }}
            />
            <div className="relative w-[95vw] h-full flex justify-center items-end">
                <AnimatePresence>
                    {handEntries.map((entry) => {
                        const { card, key: cardKey, index: i } = entry;
                        const isVisible = visibleCardKeys.has(cardKey);
                        if (!isVisible) return null;

                        const offset = i - centerIndex;
                        const rotation = offset * 5;
                        const yOffset = Math.abs(offset) * 0.8;
                        const isDragging = draggingCardKey === cardKey;
                        const isDealing = dealingCardKey === cardKey;
                        const isFlipped = flippedCardKeys.has(cardKey);
                        const returningEntry = returningCardMap[cardKey];
                        const zIndex = isDragging ? UI_Z_INDEX.hud + 40 : UI_Z_INDEX.hud + 1 + i;
                        const isReturning = !!returningEntry;
                        const returnVersion = returningVersionMap[cardKey] ?? 0;
                        // 弃牌模式下禁用拖拽，改用点击
                        const canDrag = canInteract && isFlipped && !isReturning && !isDiscardMode;
                        const canClickDiscard = isDiscardMode && isFlipped && !isReturning;
                        // 动画期间（dealing/returning）统一禁用 hover
                        const isHovered = hoveredCardKey === cardKey && (canDrag || canClickDiscard) && !isDragging && !isReturning && !isDealing;
                        const dragValues = getDragValues(cardKey);
                        // 正在弃牌的卡牌立即消失（飞出动画由 flyingOutCard 接管）
                        const isBeingDiscarded = discardingCardKey === cardKey;

                        return (
                            <motion.div
                                key={`${cardKey}-${returnVersion}`}
                                data-card-key={cardKey}
                                data-can-drag={canDrag}
                                data-is-flipped={isFlipped}
                                data-is-discard-mode={isDiscardMode}
                                drag={canDrag}
                                dragElastic={0.1}
                                dragMomentum={false}
                                onDragStart={() => {
                                    if (!canDrag) return;
                                    dragEndHandledRef.current = false;
                                    draggingCardRef.current = entry;
                                    dragValues.x.set(0);
                                    dragValues.y.set(0);
                                    setDraggingCardKey(cardKey);
                                    onSellButtonChange?.(true);
                                    onPlayHintChange?.(true);
                                }}
                                onDrag={(_, info) => canDrag && handleDrag(cardKey, info)}
                                onDragEnd={() => canDrag && handleDragEnd(entry, 'drag')}
                                onClick={() => {
                                    // 防止拖拽后立即触发点击：检查是否刚完成拖拽
                                    const lastDrag = lastDragEndRef.current;
                                    if (lastDrag && lastDrag.cardKey === cardKey) {
                                        const timeSinceDrag = Date.now() - lastDrag.timestamp;
                                        if (timeSinceDrag < DRAG_CLICK_DEBOUNCE) {
                                            return;
                                        }
                                    }

                                    // 弃牌模式下点击卡牌直接弃置
                                    if (canClickDiscard && onDiscardCard) {
                                        // 记录弃牌信息，卡牌从手牌移除后触发飞向弃牌堆动画
                                        pendingDiscardRef.current = {
                                            cardKey,
                                            card,
                                            originalIndex: i,
                                        };
                                        setDiscardingCardKey(cardKey);
                                        onDiscardCard(card.id);
                                    }
                                    // 正常模式下点击打牌
                                    else if (canDrag && onPlayCard) {
                                        pendingPlayRef.current = {
                                            cardKey,
                                            card,
                                            offset: { x: 0, y: 0 },
                                            originalIndex: i,
                                        };
                                        if (pendingPlayTimeoutRef.current) {
                                            window.clearTimeout(pendingPlayTimeoutRef.current);
                                        }
                                        pendingPlayTimeoutRef.current = window.setTimeout(() => {
                                            resetDragValues(cardKey, 'drag');
                                            clearPendingPlay();
                                        }, PENDING_PLAY_TIMEOUT);
                                        onPlayCard(card.id);
                                    }
                                }}
                                onHoverStart={() => {
                                    if ((canDrag || canClickDiscard) && !isDragging && !isReturning) {
                                        setHoveredCardKey(cardKey);
                                    }
                                }}
                                onHoverEnd={() => {
                                    setHoveredCardKey(prev => prev === cardKey ? null : prev);
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
                                            const source = cardSourceMap.get(cardKey) ?? (card.id === undoCardId ? 'discard' : 'deck');
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
                                    exit={isBeingDiscarded
                                        ? { opacity: 0, scale: 1, transition: { duration: 0 } }
                                        : { opacity: 0, scale: 0.8 }
                                    }
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
                                                ${respondableCardIds?.has(card.id) && !isDragging && !canClickDiscard ? 'ring-4 ring-cyan-400 shadow-cyan-400/60' : ''}
                                            `}
                                            style={{ transformStyle: 'preserve-3d' }}
                                            initial={{ rotateY: isFlipped ? 0 : 180 }}
                                            animate={{ rotateY: isFlipped ? 0 : 180 }}
                                            transition={{ duration: 0.6 }}
                                        >
                                            <CardPreview
                                                previewRef={card.previewRef}
                                                locale={locale}
                                                className="absolute inset-0 w-full h-full rounded-[0.8vw] backface-hidden border border-slate-700"
                                                style={{ backgroundColor: '#1e293b' }}
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
                        const { card, cardKey, startOffset, startIndex, targetType, targetSlotId } = flyingOutCard;
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
                                key={`flying-${cardKey}`}
                                className="absolute bottom-0 w-[12vw] aspect-[0.61] rounded-[0.8vw] pointer-events-none"
                                style={{
                                    bottom: '-2vw',
                                    left: `calc(50% + ${startIndexOffset * 7}vw - 6vw)`,
                                    zIndex: UI_Z_INDEX.overlayRaised,
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
                                <CardPreview
                                    previewRef={card.previewRef}
                                    locale={locale}
                                    className="w-full h-full rounded-[0.8vw] border border-slate-700 shadow-2xl"
                                    style={{ backgroundColor: '#1e293b' }}
                                />
                            </motion.div>
                        );
                    })()}
                </AnimatePresence>
            </div>
        </div>
    );
};
