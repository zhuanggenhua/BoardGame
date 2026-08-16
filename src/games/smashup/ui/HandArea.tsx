import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { CardInstance } from '../domain/types';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { getCardDef as lookupCardDef, resolveCardName, resolveCardText } from '../data/cards';
import { UI_Z_INDEX } from '../../../core';
import { SMASHUP_CARD_BACK } from '../domain/ids';
import { useTouchInspectGesture } from '../../../hooks/ui/useTouchInspectGesture';

// ============================================================================
// Layout Constants
// ============================================================================
export type HandAreaDropTarget = {
    baseIndex: number;
    minionUid?: string;
};

export type HandAreaDragPreview = {
    cardUid: string;
    originX: number;
    originY: number;
    clientX: number;
    clientY: number;
    dropTarget: HandAreaDropTarget | null;
};

const CARD_ASPECT_RATIO = 0.714;
const DESKTOP_CARD_WIDTH_VW = 8.5;
const MOBILE_CARD_WIDTH_VW = 10.5;
const DESKTOP_SELECTED_Y_LIFT_VW = 5;
const MOBILE_SELECTED_Y_LIFT_VW = 3.8;
const DRAG_START_DISTANCE_PX = 12;
const DRAG_DROP_SHADOW = '0 0 30px rgba(251, 191, 36, 0.38)';
const HAND_AREA_LAYER_Z_INDEX = UI_Z_INDEX.hud + 2;

function handInlineSize(value: number, compactLayout: boolean): string {
    if (!compactLayout) {
        return `${value}vw`;
    }
    const multiplier = Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
    return `calc(var(--mobile-layout-inline-unit, 1vw) * ${multiplier})`;
}
type Props = {
    hand: CardInstance[];
    selectedCardUid: string | null;
    onCardSelect: (card: CardInstance) => void;
    onCardView?: (card: CardInstance) => void;
    compactLayout?: boolean;
    isDiscardMode?: boolean;
    discardSelection?: Set<string>;
    disableInteraction?: boolean;
    /** 仅高亮当前允许直接点击的手牌 uid 集合 */
    highlightCardUids?: Set<string>;
    /** 被禁用的卡牌 uid 集合（置灰 + 摇头） */
    disabledCardUids?: Set<string>;
    isOpponentView?: boolean;
    interactionMode?: 'click' | 'drag';
    onResolveDropTarget?: (card: CardInstance, clientX: number, clientY: number) => HandAreaDropTarget | null;
    onCardDragPlay?: (card: CardInstance, dropTarget: HandAreaDropTarget) => void;
    onDragStateChange?: (preview: HandAreaDragPreview | null) => void;
};

// New prop for viewing details
type HandCardProps = {
    card: CardInstance;
    index: number;
    total: number;
    isSelected: boolean;
    isDiscardSelected: boolean;
    isDiscardMode: boolean;
    isHighlighted: boolean;
    disableInteraction: boolean;
    /** 此卡被单独禁用（置灰 + 摇头） */
    isDisabled: boolean;
    /** 是否显示为对手视角（显示牌背） */
    isOpponentView: boolean;
    compactLayout: boolean;
    showTouchInspectButton: boolean;
    /** 跳过初始动画（用于视角切换） */
    skipAnimation?: boolean;
    onSelect: () => void;
    onViewDetail?: () => void;
    onPointerDown?: (event: React.PointerEvent, card: CardInstance) => void;
    onPointerMove?: (event: React.PointerEvent, card: CardInstance) => void;
    onPointerEnd?: (card: CardInstance) => void;
    shouldBlockClick?: (card: CardInstance) => boolean;
    interactionMode: 'click' | 'drag';
    onResolveDropTarget?: (card: CardInstance, clientX: number, clientY: number) => HandAreaDropTarget | null;
    onCardDragPlay?: (card: CardInstance, dropTarget: HandAreaDropTarget) => void;
    onDragStateChange?: (preview: HandAreaDragPreview | null) => void;
};


const HandCard: React.FC<HandCardProps> = ({
    card,
    index,
    total,
    isSelected,
    isDiscardSelected,
    isDiscardMode,
    isHighlighted,
    disableInteraction,
    isDisabled,
    isOpponentView,
    compactLayout,
    showTouchInspectButton,
    interactionMode,
    onSelect,
    onViewDetail,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    shouldBlockClick,
    onResolveDropTarget,
    onCardDragPlay,
    onDragStateChange,
}) => {
    const { t } = useTranslation('game-smashup');
    const [isHovered, setIsHovered] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isDragPlayable, setIsDragPlayable] = useState(false);
    const dragOriginRef = useRef({ x: 0, y: 0 });
    const suppressClickRef = useRef(false);
    const dragStateRef = useRef<{
        pointerId: number | null;
        startX: number;
        startY: number;
        hasMoved: boolean;
    }>({
        pointerId: null,
        startX: 0,
        startY: 0,
        hasMoved: false,
    });

    const handleDragFinish = useCallback((event?: React.PointerEvent) => {
        const dragState = dragStateRef.current;
        if (interactionMode !== 'drag' || dragState.pointerId == null) return;
        const didDrag = dragState.hasMoved;

        if (event?.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(dragState.pointerId)) {
            event.currentTarget.releasePointerCapture(dragState.pointerId);
        }

        const dropTarget = didDrag && event ? onResolveDropTarget?.(card, event.clientX, event.clientY) ?? null : null;
        if (dropTarget) {
            onCardDragPlay?.(card, dropTarget);
        }
        onDragStateChange?.(null);
        suppressClickRef.current = didDrag;

        dragStateRef.current = {
            pointerId: null,
            startX: 0,
            startY: 0,
            hasMoved: false,
        };
        setIsDragging(false);
        setIsDragPlayable(false);
    }, [card, interactionMode, onCardDragPlay, onDragStateChange, onResolveDropTarget]);

    const handleDragCancel = useCallback((event?: React.PointerEvent) => {
        const dragState = dragStateRef.current;
        if (interactionMode !== 'drag' || dragState.pointerId == null) return;
        suppressClickRef.current = dragState.hasMoved;
        if (event?.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(dragState.pointerId)) {
            event.currentTarget.releasePointerCapture(dragState.pointerId);
        }
        dragStateRef.current = {
            pointerId: null,
            startX: 0,
            startY: 0,
            hasMoved: false,
        };
        setIsDragging(false);
        setIsDragPlayable(false);
        onDragStateChange?.(null);
    }, [interactionMode, onDragStateChange]);

    const handlePointerDownInternal = useCallback((event: React.PointerEvent) => {
        onPointerDown?.(event, card);
        if (interactionMode !== 'drag' || isOpponentView || disableInteraction || isDisabled) return;
        suppressClickRef.current = false;
        dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            hasMoved: false,
        };
        const rect = event.currentTarget.getBoundingClientRect();
        dragOriginRef.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height * 0.34,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    }, [card, disableInteraction, interactionMode, isDisabled, isOpponentView, onDragStateChange, onPointerDown]);

    const handlePointerMoveInternal = useCallback((event: React.PointerEvent) => {
        onPointerMove?.(event, card);
        const dragState = dragStateRef.current;
        if (interactionMode !== 'drag' || dragState.pointerId !== event.pointerId) return;

        const offsetX = event.clientX - dragState.startX;
        const offsetY = event.clientY - dragState.startY;
        const distance = Math.hypot(offsetX, offsetY);
        const hasMoved = dragState.hasMoved || distance >= DRAG_START_DISTANCE_PX;
        dragState.hasMoved = hasMoved;
        if (!hasMoved) return;

        setIsDragging(true);
        const dropTarget = onResolveDropTarget?.(card, event.clientX, event.clientY) ?? null;
        setIsDragPlayable(Boolean(dropTarget));
        onDragStateChange?.({
            cardUid: card.uid,
            originX: dragOriginRef.current.x,
            originY: dragOriginRef.current.y,
            clientX: event.clientX,
            clientY: event.clientY,
            dropTarget,
        });
    }, [card, interactionMode, onDragStateChange, onPointerMove, onResolveDropTarget]);

    const handlePointerUpInternal = useCallback((event: React.PointerEvent) => {
        onPointerEnd?.(card);
        handleDragFinish(event);
    }, [card, handleDragFinish, onPointerEnd]);

    const handlePointerCancelInternal = useCallback((event: React.PointerEvent) => {
        onPointerEnd?.(card);
        handleDragCancel(event);
    }, [card, handleDragCancel, onPointerEnd]);

    const def = lookupCardDef(card.defId);
    const resolvedName = resolveCardName(def, t) || t('ui.card_placeholder');
    const resolvedText = resolveCardText(def, t);
    const previewTitle = resolvedText ? `${resolvedName}\n${resolvedText}` : resolvedName;

    // "Paper Chaos" - Tiny random rotation
    const rotationSeed = useMemo(() => {
        const sum = card.uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return (sum % 4) - 2; // -2 to 2 degrees
    }, [card.uid]);
    const isSelectionContext = isDiscardMode || isHighlighted;

    // Dynamic Spacing: 
    // Standard gap: 0.8vw
    // If crowded (> 7 cards), start overlapping
    // Max overlap at 10 cards
    const overlapStart = compactLayout ? 6 : 7;
    const overlapStep = compactLayout ? 1.05 : 0.8;
    const maxOverlapVw = compactLayout ? 4.2 : 3.4;
    const spacingVw = total <= overlapStart ? 0.8 : -Math.min((total - overlapStart) * overlapStep, maxOverlapVw);
    const cardWidthVw = compactLayout ? MOBILE_CARD_WIDTH_VW : DESKTOP_CARD_WIDTH_VW;
    const selectedLiftVw = compactLayout ? MOBILE_SELECTED_Y_LIFT_VW : DESKTOP_SELECTED_Y_LIFT_VW;
    const inspectButtonSizeVw = compactLayout ? 3.2 : 2;
    const inspectIconSizeVw = compactLayout ? 1.55 : 1.1;
    const cardWidth = handInlineSize(cardWidthVw, compactLayout);
    const spacing = handInlineSize(spacingVw, compactLayout);
    const selectedLift = handInlineSize(-selectedLiftVw, compactLayout);
    const discardLift = handInlineSize(-2, compactLayout);
    const inspectButtonInset = handInlineSize(compactLayout ? 0.45 : 0.3, compactLayout);
    const inspectButtonSize = handInlineSize(inspectButtonSizeVw, compactLayout);
    const inspectIconSize = handInlineSize(inspectIconSizeVw, compactLayout);

    // zIndex 用 CSS hover 提升，避免 state 变化触发 layout 重算导致抽搐
    // 弃牌选中时不提升 z-index，避免遮挡其他卡牌选择
    const baseZIndex = isSelected && !isDiscardSelected ? 100 : index;

    return (
        <motion.div
            data-card-uid={card.uid}
            data-selected={isSelected ? 'true' : 'false'}
            data-highlighted={isHighlighted ? 'true' : 'false'}
            data-disabled={isDisabled ? 'true' : 'false'}
            className={`
                relative flex-shrink-0 origin-bottom pointer-events-auto
                hover:!z-50
                ${isOpponentView ? 'cursor-default' : interactionMode === 'drag' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
            `}
            style={{
                width: cardWidth,
                height: handInlineSize(cardWidthVw / CARD_ASPECT_RATIO, compactLayout),
                aspectRatio: `${CARD_ASPECT_RATIO}`,
                marginLeft: index === 0 ? 0 : spacing,
                zIndex: isDragging ? 200 : baseZIndex,
                boxShadow: isDragging && isDragPlayable ? DRAG_DROP_SHADOW : undefined,
                touchAction: interactionMode === 'drag' ? 'none' : undefined,
            }}
            // 对手视角时完全不使用动画
            initial={isOpponentView ? { opacity: 1, y: 0, scale: 1, rotate: rotationSeed } : { y: 200, opacity: 0, scale: 0.8 }}
            animate={{
                // 弃牌选中时小幅上移（2vw），普通选中时大幅上移（5vw）
                x: 0,
                y: isSelected && !isDiscardSelected ? selectedLift : isDiscardSelected ? discardLift : '0',
                scale: (isSelected && !isDiscardSelected) ? 1.15 : 1,
                rotate: isShaking ? [0, -6, 6, -4, 4, 0] : ((isSelected && !isDiscardSelected) ? 0 : rotationSeed),
                opacity: 1
            }}
            exit={isOpponentView ? undefined : { y: 200, opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            transition={isOpponentView ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 28 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            onPointerDown={handlePointerDownInternal}
            onPointerMove={handlePointerMoveInternal}
            onPointerUp={handlePointerUpInternal}
            onPointerCancel={handlePointerCancelInternal}
            onClick={() => {
                if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                }
                if (shouldBlockClick?.(card)) return;
                if (isOpponentView) return; // 对手视角不可点击
                if (disableInteraction || isDisabled) {
                    // 不可操作时摇头抖动
                    setIsShaking(true);
                    setTimeout(() => setIsShaking(false), 400);
                    return;
                }
                if (interactionMode === 'drag' && dragStateRef.current.hasMoved) return;
                onSelect();
            }}
        >
            {/* Card Container */}
            <div className={`
                w-full h-full relative rounded-md shadow-md transition-all duration-200
                ${isDisabled ? 'opacity-40 grayscale cursor-not-allowed' : ''}
                ${isSelected ? 'ring-4 ring-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'shadow-black/30'}
                ${isDiscardSelected ? 'ring-4 ring-green-500 shadow-[0_0_14px_rgba(34,197,94,0.4)]' : ''}
                ${!isSelected && !isDiscardSelected && !isOpponentView
                    ? isSelectionContext
                        ? 'ring-2 ring-green-500/35 shadow-[0_0_12px_rgba(34,197,94,0.22)]'
                        : (!isDisabled ? 'hover:ring-2 hover:ring-green-200/85 hover:shadow-xl' : '')
                    : ''}
            `}>
                {/* Card Asset Preview */}
                <div className="w-full h-full rounded-md overflow-hidden bg-[#f3f0e8] border border-slate-400/50 shadow-inner relative">
                    <CardPreview
                        previewRef={isOpponentView 
                            ? SMASHUP_CARD_BACK
                            : (def?.previewRef
                                ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: card.defId, cardUid: card.uid } }
                                : undefined)
                        }
                        className="w-full h-full object-cover"
                        title={isOpponentView ? t('ui.opponent_card') : previewTitle}
                    />
                </div>

            </div>
            {!isOpponentView && (
                <button
                    data-testid={`su-hand-card-inspect-${card.uid}`}
                    className={`absolute flex items-center justify-center bg-black/70 hover:bg-amber-500/90 text-white rounded-full shadow-xl border-2 border-white/30 z-50 cursor-zoom-in transition-[opacity,background-color] duration-200 ${(showTouchInspectButton || isHovered) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                    style={{
                        top: inspectButtonInset,
                        right: inspectButtonInset,
                        width: inspectButtonSize,
                        height: inspectButtonSize,
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewDetail?.();
                    }}
                >
                    <svg
                        className="fill-current"
                        style={{ width: inspectIconSize, height: inspectIconSize }}
                        viewBox="0 0 20 20"
                    >
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
        </motion.div>
    );
};

export const HandArea: React.FC<Props> = ({
    hand,
    selectedCardUid,
    onCardSelect,
    onCardView,
    compactLayout = false,
    isDiscardMode = false,
    discardSelection,
    disableInteraction = false,
    highlightCardUids,
    disabledCardUids,
    isOpponentView = false,
    interactionMode = 'click',
    onResolveDropTarget,
    onCardDragPlay,
    onDragStateChange,
}) => {
    // Basic mount animation
    const [isLoaded, setIsLoaded] = useState(false);
    const {
        isCoarsePointer,
        getTouchInspectProps,
        shouldBlockInspectClick,
    } = useTouchInspectGesture<string, CardInstance>({
        enabled: Boolean(onCardView) && !isOpponentView && !isDiscardMode && interactionMode !== 'drag',
        onInspect: (_cardUid, card) => {
            onCardView?.(card);
        },
    });
    useEffect(() => { setIsLoaded(true); }, []);
    if (!isLoaded) return null;

    return (
        <div
            className="absolute inset-x-0 bottom-0 flex flex-col justify-end items-center pointer-events-none"
            style={{
                zIndex: HAND_AREA_LAYER_Z_INDEX,
                ...(compactLayout
                    ? {
                        height: '100%',
                        paddingBottom: '8px',
                    }
                    : {
                        height: '20vh',
                        bottom: '16px',
                    }),
            }}
            data-testid="su-hand-area"
        >
            <div
                className="flex items-end justify-center px-4 perspective-[1000px]"
                style={{ maxWidth: compactLayout ? '95vw' : '90vw' }}
                data-tutorial-id="su-hand-area"
            >
                {/* 对手视角：不使用 AnimatePresence，直接渲染静态卡牌 */}
                {isOpponentView ? (
                    hand.map((card, i) => (
                        <HandCard
                            key={card.uid}
                            card={card}
                            index={i}
                            total={hand.length}
                            isSelected={false}
                            isDiscardSelected={false}
                            isDiscardMode={false}
                            disableInteraction={true}
                            isDisabled={false}
                            isOpponentView={true}
                            compactLayout={compactLayout}
                            showTouchInspectButton={false}
                            interactionMode={interactionMode}
                            onResolveDropTarget={onResolveDropTarget}
                            onCardDragPlay={onCardDragPlay}
                            onDragStateChange={onDragStateChange}
                            onSelect={() => {}}
                        />
                    ))
                ) : (
                    <AnimatePresence>
                        {hand.map((card, i) => (
                            <HandCard
                                key={card.uid}
                                card={card}
                                index={i}
                                total={hand.length}
                                isSelected={selectedCardUid === card.uid}
                                isDiscardSelected={!!discardSelection?.has(card.uid)}
                                isDiscardMode={isDiscardMode}
                                isHighlighted={!!highlightCardUids?.has(card.uid)}
                                disableInteraction={disableInteraction}
                                isDisabled={!!disabledCardUids?.has(card.uid)}
                                isOpponentView={false}
                                compactLayout={compactLayout}
                                showTouchInspectButton={isCoarsePointer && !isDiscardMode}
                                interactionMode={interactionMode}
                                onResolveDropTarget={onResolveDropTarget}
                                onCardDragPlay={onCardDragPlay}
                                onDragStateChange={onDragStateChange}
                                onSelect={() => onCardSelect(card)}
                                onViewDetail={() => onCardView?.(card)}
                                onPointerDown={(event, pressedCard) => getTouchInspectProps(pressedCard.uid, pressedCard).onPointerDown(event)}
                                onPointerMove={(event, pressedCard) => getTouchInspectProps(pressedCard.uid, pressedCard).onPointerMove(event)}
                                onPointerEnd={(pressedCard) => getTouchInspectProps(pressedCard.uid, pressedCard).onPointerUp()}
                                shouldBlockClick={(pressedCard) => shouldBlockInspectClick(pressedCard.uid)}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
