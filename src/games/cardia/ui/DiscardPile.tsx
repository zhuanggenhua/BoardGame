import React from 'react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import type { CardInstance } from '../domain/core-types';
import { CardTransition, CardListTransition } from './CardTransition';
import { CARDIA_IMAGE_PATHS, resolveCardiaCardImagePath } from '../imagePaths';

interface DiscardPileProps {
    cards: CardInstance[];
    isOpponent?: boolean;
    onCardClick?: (card: CardInstance) => void;
    onCardHover?: (card: CardInstance, point?: { x: number; y: number }) => void;
    onCardHoverMove?: (card: CardInstance, point?: { x: number; y: number }) => void;
    onCardLeave?: (card?: CardInstance) => void;
    setCardRef?: (cardUid: string, element: HTMLElement | null) => void;
}

const DISCARD_CARD_WIDTH = 106;
const DISCARD_CARD_HEIGHT = 160;
const DISCARD_HISTORY_WIDTH = Math.floor(DISCARD_CARD_WIDTH / 3);
const DISCARD_OFFSET_STEP = 36;
const TIGHT_DISCARD_CARD_WIDTH = 88;
const TIGHT_DISCARD_CARD_HEIGHT = 133;
const TIGHT_DISCARD_OFFSET_STEP = 30;

interface DiscardCardImageProps {
    card: CardInstance;
    className: string;
}

const DiscardCardImage: React.FC<DiscardCardImageProps> = ({ card, className }) => {
    const [failed, setFailed] = React.useState(false);
    const cardSrc = resolveCardiaCardImagePath(card) || CARDIA_IMAGE_PATHS.DECK1_BACK;

    if (failed) {
        return (
            <div className={`relative ${className}`}>
                <OptimizedImage
                    src={CARDIA_IMAGE_PATHS.DECK1_BACK}
                    alt="Discard fallback"
                    className="h-full w-full rounded-lg object-cover shadow-lg"
                    sizes="106px"
                />
                <div className="absolute inset-x-2 bottom-2 rounded-md bg-black/70 px-2 py-1 text-center text-[10px] font-semibold text-white">
                    影响力 {card.baseInfluence}
                </div>
            </div>
        );
    }

    return (
        <OptimizedImage
            src={cardSrc}
            alt={`Card ${card.baseInfluence}`}
            className={className}
            sizes="106px"
            onError={() => setFailed(true)}
        />
    );
};

interface DiscardCardFaceProps {
    card: CardInstance;
    onMagnify?: (card: CardInstance) => void;
    className?: string;
    showBadge?: boolean;
}

const DiscardCardFace: React.FC<DiscardCardFaceProps> = ({ card, onMagnify, className = '', showBadge = true }) => {
    const [isTouchDevice, setIsTouchDevice] = React.useState(false);
    const longPressTimerRef = React.useRef<number | null>(null);
    const longPressTriggeredRef = React.useRef(false);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
        const syncTouchCapability = () => setIsTouchDevice(mediaQuery.matches || window.innerWidth < 1024);

        syncTouchCapability();
        mediaQuery.addEventListener?.('change', syncTouchCapability);
        window.addEventListener('resize', syncTouchCapability);

        return () => {
            mediaQuery.removeEventListener?.('change', syncTouchCapability);
            window.removeEventListener('resize', syncTouchCapability);
        };
    }, []);

    const clearLongPressTimer = React.useCallback(() => {
        if (longPressTimerRef.current === null) return;
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }, []);

    const handlePointerDown = React.useCallback(() => {
        if (!isTouchDevice || !onMagnify) return;
        clearLongPressTimer();
        longPressTriggeredRef.current = false;
        longPressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            longPressTimerRef.current = null;
            onMagnify(card);
        }, 320);
    }, [card, clearLongPressTimer, isTouchDevice, onMagnify]);

    const handlePointerUpOrCancel = React.useCallback(() => {
        if (!isTouchDevice) return;
        clearLongPressTimer();
    }, [clearLongPressTimer, isTouchDevice]);

    const handleClickCapture = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!isTouchDevice || !longPressTriggeredRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        longPressTriggeredRef.current = false;
    }, [isTouchDevice]);

    return (
        <div
            className={`group relative h-full w-full overflow-hidden rounded-lg border-2 border-white/20 shadow-lg ${className}`}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUpOrCancel}
            onPointerCancel={handlePointerUpOrCancel}
            onPointerLeave={handlePointerUpOrCancel}
            onClickCapture={handleClickCapture}
        >
            <DiscardCardImage card={card} className="absolute inset-0 h-full w-full rounded-lg object-cover" />

            {showBadge && (
                <div className="absolute left-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 backdrop-blur-sm sm:h-9 sm:w-9">
                    <span className="text-sm font-bold text-white sm:text-base">{card.baseInfluence}</span>
                </div>
            )}

            {card.tags && Object.keys(card.tags).length > 0 && (
                <div className="absolute left-1 top-10 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-md">
                    🔧
                </div>
            )}

            {card.ongoingMarkers && card.ongoingMarkers.length > 0 && (
                <div className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-white shadow-md">
                    🔄
                </div>
            )}
        </div>
    );
};

export const DiscardPile: React.FC<DiscardPileProps> = ({ cards, isOpponent: _isOpponent = false, onCardClick, onCardHover, onCardHoverMove, onCardLeave, setCardRef }) => {
    const [isTightLandscape, setIsTightLandscape] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        const syncLayoutMode = () => {
            setIsTightLandscape(window.innerWidth > window.innerHeight && window.innerHeight <= 430);
        };

        syncLayoutMode();
        window.addEventListener('resize', syncLayoutMode);
        window.addEventListener('orientationchange', syncLayoutMode);

        return () => {
            window.removeEventListener('resize', syncLayoutMode);
            window.removeEventListener('orientationchange', syncLayoutMode);
        };
    }, []);

    const cardWidth = isTightLandscape ? TIGHT_DISCARD_CARD_WIDTH : DISCARD_CARD_WIDTH;
    const cardHeight = isTightLandscape ? TIGHT_DISCARD_CARD_HEIGHT : DISCARD_CARD_HEIGHT;
    const offsetStep = isTightLandscape ? TIGHT_DISCARD_OFFSET_STEP : DISCARD_OFFSET_STEP;
    const historyWidth = Math.floor(cardWidth / 3);

    const historyCardCount = Math.max(cards.length - 1, 0);
    const widthPx = historyCardCount * offsetStep + cardWidth;
    const shellStyle: React.CSSProperties = {
        width: `${widthPx}px`,
        minWidth: `${widthPx}px`,
        height: `${cardHeight}px`,
        minHeight: `${cardHeight}px`,
        flex: '0 0 auto',
    };

    if (cards.length === 0) {
        return (
            <div
                data-testid="cardia-discard-pile-root"
                className="relative box-border flex items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-600"
                style={shellStyle}
            >
                <div className="text-center text-xs text-gray-500">空</div>
            </div>
        );
    }

    const displayCards = [...cards].reverse();
    const latestCard = displayCards[0];
    const historyCards = displayCards.slice(1);

    return (
        <div data-testid="cardia-discard-pile-root" className="relative box-border block overflow-visible" style={shellStyle}>
            <div data-testid="cardia-discard-pile" className="absolute inset-0">
                <CardListTransition>
                    {historyCards.map((card, index) => (
                        <CardTransition
                            key={`${card.uid}-${index}`}
                            cardUid={`discard-${card.uid}-${index}`}
                            type="discard"
                            layoutAnimation={false}
                            className="absolute bottom-0"
                                style={{
                                    left: `${index * offsetStep}px`,
                                    width: `${historyWidth}px`,
                                    height: `${cardHeight}px`,
                                    zIndex: index,
                                }}
                        >
                            <div
                                ref={(el) => setCardRef?.(card.uid, el)}
                                className="h-full w-full cursor-pointer overflow-hidden rounded-l-lg rounded-r-none"
                                onMouseEnter={(event) => onCardHover?.(card, { x: event.clientX, y: event.clientY })}
                                onMouseMove={(event) => onCardHoverMove?.(card, { x: event.clientX, y: event.clientY })}
                                onMouseLeave={() => onCardLeave?.(card)}
                                title={`影响力 ${card.baseInfluence}`}
                            >
                                <div
                                    className="relative"
                                    style={{
                                        width: `${cardWidth}px`,
                                        height: `${cardHeight}px`,
                                    }}
                                >
                                    <DiscardCardFace
                                        card={card}
                                        onMagnify={onCardClick}
                                        className="h-full w-full"
                                        showBadge={false}
                                    />
                                </div>
                            </div>
                        </CardTransition>
                    ))}

                    <CardTransition
                        key={latestCard.uid}
                        cardUid={`discard-latest-${latestCard.uid}`}
                        type="discard"
                        layoutAnimation={false}
                        className="absolute bottom-0"
                        style={{
                            left: `${historyCards.length * offsetStep}px`,
                            width: `${cardWidth}px`,
                            height: `${cardHeight}px`,
                            zIndex: historyCards.length,
                        }}
                    >
                        <div
                            ref={(el) => setCardRef?.(latestCard.uid, el)}
                            className="h-full w-full cursor-pointer"
                            onMouseEnter={(event) => onCardHover?.(latestCard, { x: event.clientX, y: event.clientY })}
                            onMouseMove={(event) => onCardHoverMove?.(latestCard, { x: event.clientX, y: event.clientY })}
                            onMouseLeave={() => onCardLeave?.(latestCard)}
                        >
                            <DiscardCardFace card={latestCard} onMagnify={onCardClick} className="h-full w-full" showBadge={false} />
                        </div>
                    </CardTransition>
                </CardListTransition>

            </div>
        </div>
    );
};
