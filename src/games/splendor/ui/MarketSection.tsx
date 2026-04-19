import React from 'react';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { SPLENDOR_DECK_IMAGE_BY_TIER } from '../assets';
import type { CardTier, SplendorCore } from '../domain';
import { CardTile } from './CardTile';

interface PaymentSummary {
    affordable: boolean;
    text: string;
}

interface MarketSectionProps {
    core: SplendorCore;
    tiers: readonly CardTier[];
    canAct: boolean;
    pending?: SplendorCore['pendingResolution'];
    reserveDisabled: boolean;
    canReserveDeckTop: boolean;
    canBuyOpen: boolean;
    canReserveOpen: boolean;
    highlightedCardIds?: readonly string[];
    formatPaymentText: (cardId: string) => PaymentSummary;
    onReserveDeckTop: (tier: CardTier) => void;
    onBuyOpen: (tier: CardTier, cardId: string) => void;
    onReserveOpen: (tier: CardTier, cardId: string) => void;
}

interface ResponsiveTierRowProps {
    deckSlot: React.ReactNode;
    cardsSlot: React.ReactNode;
}

function ResponsiveTierRow({ deckSlot, cardsSlot }: ResponsiveTierRowProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = React.useState(1);
    const [scaledHeight, setScaledHeight] = React.useState<number | null>(null);

    React.useEffect(() => {
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;

        const updateScale = () => {
            const containerWidth = container.clientWidth;
            const contentWidth = content.offsetWidth;
            const contentHeight = content.offsetHeight;

            if (!containerWidth || !contentWidth || !contentHeight) {
                return;
            }

            const nextScale = Math.min(1, containerWidth / contentWidth);
            setScale((current) => (Math.abs(current - nextScale) < 0.001 ? current : nextScale));
            setScaledHeight((current) => {
                const nextHeight = Math.ceil(contentHeight * nextScale);
                return current === nextHeight ? current : nextHeight;
            });
        };

        updateScale();

        const observer = new ResizeObserver(() => updateScale());
        observer.observe(container);
        observer.observe(content);

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="w-full overflow-hidden">
            <div className="w-full" style={scaledHeight ? { height: `${scaledHeight}px` } : undefined}>
                <div
                    ref={contentRef}
                    className="flex w-max items-start gap-3 origin-top-left"
                    style={{ transform: `scale(${scale})` }}
                >
                    {deckSlot}
                    {cardsSlot}
                </div>
            </div>
        </div>
    );
}

export function MarketSection({
    core,
    tiers,
    canAct,
    pending,
    reserveDisabled,
    canReserveDeckTop,
    canBuyOpen,
    canReserveOpen,
    highlightedCardIds = [],
    formatPaymentText,
    onReserveDeckTop,
    onBuyOpen,
    onReserveOpen,
}: MarketSectionProps) {
    const { t } = useTranslation('game-splendor');

    return (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg" data-tutorial-id="sp-market">
            <div className="grid gap-4">
                {tiers.map((tier) => (
                    <ResponsiveTierRow
                        key={tier}
                        deckSlot={(
                            <div className="group w-[8rem] rounded-xl border border-white/10 bg-white/5 p-1.5 shadow-lg transition-transform duration-200 hover:z-20 hover:scale-[1.08]" data-tutorial-id={`sp-market-tier-${tier}`}>
                                <div className="relative aspect-[0.7] w-full overflow-hidden rounded-lg border border-white/10 bg-black/20">
                                    <OptimizedImage
                                        src={SPLENDOR_DECK_IMAGE_BY_TIER[tier]}
                                        alt={`Level ${tier}`}
                                        className="absolute inset-0 h-full w-full object-cover"
                                    />
                                    <div className="absolute left-1.5 top-1.5 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 shadow-sm">
                                        {t('market.deckCount', { count: core.decks[tier].length })}
                                    </div>
                                    {canAct && !pending && canReserveDeckTop && core.decks[tier].length > 0 && !reserveDisabled ? (
                                        <button
                                            data-testid={`splendor-reserve-deck-top-${tier}`}
                                            className="absolute bottom-1.5 right-1.5 rounded bg-amber-600 px-2 py-0.5 text-[10px] text-white opacity-0 shadow-lg transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 pointer-events-none translate-y-1"
                                            onClick={() => onReserveDeckTop(tier)}
                                        >
                                            {t('actions.reserve')}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        )}
                        cardsSlot={(
                            <div className="flex flex-nowrap gap-2">
                                {core.market[tier].map((cardId) => {
                                    const { affordable, text } = formatPaymentText(cardId);
                                    return (
                                        <CardTile
                                            key={cardId}
                                            cardId={cardId}
                                            tier={tier}
                                            affordable={affordable}
                                            paymentText={text}
                                            size="compact"
                                            showCompactCostText={false}
                                            highlighted={highlightedCardIds.includes(cardId)}
                                            onBuy={canAct && !pending && canBuyOpen && affordable ? () => onBuyOpen(tier, cardId) : undefined}
                                            onReserve={canAct && !pending && canReserveOpen && !reserveDisabled ? () => onReserveOpen(tier, cardId) : undefined}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    />
                ))}
            </div>
        </section>
    );
}
