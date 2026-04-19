import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { CardTier } from '../domain';
import { CARD_DEFS_BY_ID } from '../domain/rules';
import { COLOR_I18N_KEY } from './shared';
import { SpritePreview } from './SpritePreview';

export function CardTile({
    cardId,
    tier,
    affordable,
    paymentText,
    size = 'normal',
    showCompactCostText = true,
    onBuy,
    onReserve,
    highlighted = false,
}: {
    cardId: string;
    tier: CardTier;
    affordable: boolean;
    paymentText: string;
    size?: 'normal' | 'compact';
    showCompactCostText?: boolean;
    onBuy?: () => void;
    onReserve?: () => void;
    highlighted?: boolean;
}) {
    const { t } = useTranslation('game-splendor');
    const card = CARD_DEFS_BY_ID[cardId];
    if (!card) {
        return <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">{t('card.hiddenReserved')}</div>;
    }

    const isCompact = size === 'compact';
    const compactCostText = Object.entries(card.cost)
        .filter(([, count]) => count > 0)
        .map(([color, count]) => `${count}${t(COLOR_I18N_KEY[color as keyof typeof COLOR_I18N_KEY])}`)
        .join(' ');

    return (
        <motion.div
            data-testid={`splendor-card-${cardId}`}
            animate={highlighted
                ? {
                    x: [0, -4, 4, -3, 3, 0],
                    rotate: [0, -0.35, 0.35, -0.2, 0.2, 0],
                    scale: [1, 1.02, 1],
                }
                : {
                    x: 0,
                    rotate: 0,
                    scale: 1,
                }}
            transition={highlighted
                ? { duration: 0.44, ease: 'easeOut' }
                : { duration: 0.18, ease: 'easeOut' }}
            className={`group relative rounded-xl border text-white shadow-lg transition-transform duration-200 hover:z-20 hover:scale-[1.04] ${
                isCompact ? 'w-[8rem] p-1.5 text-xs' : 'p-2.5 text-sm'
            } ${
                affordable ? 'border-emerald-400/50 bg-slate-900/90' : 'border-amber-300/30 bg-slate-900/80'
            }`}
        >
            {highlighted ? (
                <motion.div
                    className="pointer-events-none absolute inset-0 rounded-xl border border-amber-300/70"
                    animate={{
                        opacity: [0, 0.95, 0.45, 0],
                        scale: [0.98, 1.03, 1.06],
                    }}
                    transition={{ duration: 0.62, ease: 'easeOut' }}
                />
            ) : null}
            <div
                className={`relative block w-full overflow-hidden rounded-lg border border-white/10 bg-black/20 ${
                    isCompact ? 'mb-1.5' : 'mb-2'
                }`}
            >
                <SpritePreview preview={{ kind: 'card', cardId, tier }} />
                {isCompact && showCompactCostText ? (
                    <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded bg-slate-950/72 px-1.5 py-1 text-center text-[9px] leading-tight text-white/90 backdrop-blur-[1px]">
                        {compactCostText}
                    </div>
                ) : null}

                {onBuy || onReserve ? (
                    <div className="absolute inset-x-1 bottom-1 flex items-center justify-end gap-1.5">
                        {onBuy ? (
                            <button
                                data-testid={`splendor-buy-${cardId}`}
                                className={`shrink-0 rounded bg-emerald-600 text-white shadow-lg ${
                                    isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
                                }`}
                                onClick={onBuy}
                            >
                                {t('card.buy')}
                            </button>
                        ) : null}

                        {onReserve ? (
                            <button
                                data-testid={`splendor-reserve-${cardId}`}
                                className={`shrink-0 rounded bg-amber-600 text-white shadow-lg ${
                                    isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
                                }`}
                                onClick={onReserve}
                            >
                                {t('actions.reserve')}
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>
            {!isCompact ? (
                <div className={`mt-2 text-xs ${affordable ? 'text-emerald-300' : 'text-amber-200'}`}>{paymentText}</div>
            ) : null}
        </motion.div>
    );
}
