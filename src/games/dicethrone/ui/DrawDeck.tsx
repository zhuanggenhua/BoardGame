import React from 'react';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { ASSETS } from './assets';

const DECK_WIDTH = '10.2vw';
const CARD_ASPECT_RATIO = 0.7;

export const DrawDeck = React.forwardRef<HTMLDivElement, { count: number; locale?: string }>(({ count, locale }, ref) => {
    const { t } = useTranslation('game-dicethrone');
    return (
        <div
            ref={ref}
            className="relative perspective-500 select-none"
            style={{
                width: DECK_WIDTH,
                height: `calc(${DECK_WIDTH} / ${CARD_ASPECT_RATIO})`,
                aspectRatio: `${CARD_ASPECT_RATIO} / 1`,
            }}
        >
            <div className="absolute inset-0 bg-slate-800 rounded-[0.5vw] transform translate-x-[0.2vw] translate-y-[0.2vw]"></div>
            <div className="w-full h-full rounded-[0.5vw] overflow-hidden shadow-2xl border border-slate-600 relative z-10 bg-slate-900">
                <OptimizedImage
                    src={ASSETS.CARD_BG}
                    locale={locale}
                    className="w-full h-full object-cover"
                    alt={t('imageAlt.deck')}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center font-bold text-slate-100">
                    <span className="text-[0.6vw] tracking-widest mb-[0.2vw] text-slate-200 drop-shadow-sm">{t('hud.deck')}</span>
                    <span className="text-[1.8vw] text-white leading-none drop-shadow-md">{count}</span>
                </div>
            </div>
        </div>
    );
});
DrawDeck.displayName = 'DrawDeck';
