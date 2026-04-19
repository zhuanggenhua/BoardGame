import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { CARD_DEFS_BY_ID, GEM_COLORS, calculateDiscounts, getTokenCount } from '../domain/rules';
import type { SplendorCore, TokenColor } from '../domain';
import { COLOR_I18N_KEY } from './shared';
import { CardTile } from './CardTile';
import { SpritePreview } from './SpritePreview';

const PLAYER_TOKEN_COLORS: TokenColor[] = [...GEM_COLORS, 'gold'];

interface PaymentSummary {
    affordable: boolean;
    text: string;
}

interface PlayerStatusPanelProps {
    core: SplendorCore;
    selfId: string;
    self: SplendorCore['players'][string];
    canAct: boolean;
    pending?: SplendorCore['pendingResolution'];
    canBuyReserved: boolean;
    renderPlayerName: (id: string) => string;
    formatPaymentText: (cardId: string) => PaymentSummary;
    onBuyReserved: (cardId: string) => void;
}

export function PlayerStatusPanel({
    core,
    selfId,
    self,
    canAct,
    pending,
    canBuyReserved,
    renderPlayerName,
    formatPaymentText,
    onBuyReserved,
}: PlayerStatusPanelProps) {
    const { t } = useTranslation('game-splendor');
    const [isReservedExpanded, setIsReservedExpanded] = useState(false);
    const [isPurchasedExpanded, setIsPurchasedExpanded] = useState(false);
    const hasReservedCards = self.reservedCardIds.length > 0;
    const hasPurchasedCards = self.purchasedCardIds.length > 0;
    const reservedExpanded = hasReservedCards && isReservedExpanded;
    const purchasedExpanded = hasPurchasedCards && isPurchasedExpanded;

    return (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg" data-tutorial-id="sp-player-status">
            <h2 className="mb-3 text-lg font-semibold">{t('sections.playerStatus')}</h2>
            <div className="grid gap-3">
                {core.playerOrder.map((id) => {
                    const player = core.players[id];
                    const discounts = calculateDiscounts(player);
                    const tokenCount = getTokenCount(player);
                    const isOverTokenLimit = tokenCount > 10;

                    return (
                        <div
                            key={id}
                            className={`rounded-xl p-3 ${
                                core.currentPlayer === id
                                    ? 'border border-amber-400/40 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]'
                                    : 'border border-white/10 bg-white/5'
                            }`}
                        >
                            <div className={id === selfId ? 'grid gap-4' : ''}>
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium">
                                            {renderPlayerName(id)}
                                            {id === selfId ? t('playerStatus.selfSuffix') : ''}
                                        </div>
                                        <div className="text-amber-300">{player.points} {t('playerStatus.pointsSuffix')}</div>
                                    </div>
                                    <div className="mt-2 text-xs text-white/70">
                                        {t('playerStatus.tokenTotal')}{' '}
                                                        <span className={isOverTokenLimit ? 'rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-200' : ''}>
                                                            {tokenCount}
                                                        </span>
                                                        {' '}· {t('playerStatus.reserved')} {player.reservedCardIds.length} · {t('playerStatus.purchased')} {player.purchasedCardIds.length} · {t('playerStatus.nobles')} {player.nobleIds.length}
                                                    </div>
                                    <div className={`mt-2 flex flex-wrap gap-1 text-xs ${isOverTokenLimit ? 'rounded border border-rose-400/70 bg-rose-500/10 px-2 py-1 text-rose-100' : 'text-white/80'}`}>
                                        {PLAYER_TOKEN_COLORS.map((color) => (
                                            <div key={color} className={isOverTokenLimit ? 'rounded bg-rose-500/15 px-2 py-1' : 'rounded bg-white/8 px-2 py-1'}>
                                                {t(COLOR_I18N_KEY[color])} {player.tokens[color]}
                                            </div>
                                        ))}
                                    </div>
                                                    {isOverTokenLimit ? (
                                                        <div className="mt-2 text-xs text-rose-200">
                                                            {t('playerStatus.overLimit')}
                                                        </div>
                                                    ) : null}
                                    <div className="mt-2 flex flex-wrap gap-1 text-xs">
                                        {GEM_COLORS.map((color) => (
                                            discounts[color] > 0 ? (
                                                <div key={color} className="rounded bg-emerald-700/30 px-2 py-1 text-emerald-200">
                                                    {t('playerStatus.discount')} {t(COLOR_I18N_KEY[color])} {discounts[color]}
                                                </div>
                                            ) : null
                                        ))}
                                    </div>
                                    {player.nobleIds.length > 0 ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {player.nobleIds.map((nobleId) => {
                                                return (
                                                    <div
                                                        key={nobleId}
                                                        className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/10 bg-black/20 transition-transform duration-200 hover:z-20 hover:scale-[1.12]"
                                                    >
                                                        <SpritePreview preview={{ kind: 'noble', nobleId }} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </div>

                                {id === selfId ? (
                                                    <div className="border-t border-white/10 pt-4">
                                                        <div className="grid gap-4">
                                                            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                                                    <button
                                                                        type="button"
                                                                        className="flex w-full items-center justify-between text-left text-sm font-semibold text-white/85"
                                                                        onClick={() => {
                                                                            if (!hasReservedCards) return;
                                                                            setIsReservedExpanded((value) => !value);
                                                                        }}
                                                                    >
                                                                        <span>{t('playerStatus.myReserved')}</span>
                                                                        <span className="text-xs text-white/55">{reservedExpanded ? t('common.collapse') : t('common.expand')}</span>
                                                                    </button>
                                                                    <div className={`mt-2 overflow-hidden transition-all duration-200 ${reservedExpanded ? 'max-h-[28rem]' : 'max-h-0'}`}>
                                                                        {!hasReservedCards ? (
                                                                            <div className="text-sm text-white/60">{t('playerStatus.noReserved')}</div>
                                                                        ) : (
                                                                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                                                            <AnimatePresence initial={false}>
                                                            {self.reservedCardIds.map((cardId) => {
                                                                const card = CARD_DEFS_BY_ID[cardId];
                                                                const { affordable, text } = formatPaymentText(cardId);

                                                                return (
                                                                    <CardTile
                                                                        key={cardId}
                                                                        cardId={cardId}
                                                                        tier={card?.tier ?? 1}
                                                                        affordable={affordable}
                                                                        paymentText={text}
                                                                        size="compact"
                                                                        onBuy={card && canAct && !pending && canBuyReserved && affordable ? () => onBuyReserved(cardId) : undefined}
                                                                    />
                                                                );
                                                            })}
                                                            </AnimatePresence>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                </div>

                                                            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                                                    <button
                                                                        type="button"
                                                                        className="flex w-full items-center justify-between text-left text-sm font-semibold text-white/85"
                                                                        onClick={() => {
                                                                            if (!hasPurchasedCards) return;
                                                                            setIsPurchasedExpanded((value) => !value);
                                                                        }}
                                                                    >
                                                                        <span>{t('playerStatus.myPurchased')}</span>
                                                                        <span className="text-xs text-white/55">{purchasedExpanded ? t('common.collapse') : t('common.expand')}</span>
                                                                    </button>
                                                                    <div className={`mt-2 overflow-hidden transition-all duration-200 ${purchasedExpanded ? 'max-h-[28rem]' : 'max-h-0'}`}>
                                                                        {!hasPurchasedCards ? (
                                                                            <div className="text-sm text-white/60">{t('playerStatus.noPurchased')}</div>
                                                                        ) : (
                                                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                                                            <AnimatePresence initial={false}>
                                                            {self.purchasedCardIds.map((cardId) => {
                                                                const card = CARD_DEFS_BY_ID[cardId];
                                                                if (!card) return null;

                                                                return (
                                                                    <div
                                                                        key={cardId}
                                                                        className="relative w-[8rem] rounded-xl border border-white/10 bg-white/5 p-1.5 text-left text-xs shadow-lg"
                                                                    >
                                                                        <div className="mb-1.5 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                                                                            <SpritePreview preview={{ kind: 'card', cardId, tier: card.tier }} />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            </AnimatePresence>
                                                        </div>
                                                                        )}
                                                                    </div>
                                                </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
