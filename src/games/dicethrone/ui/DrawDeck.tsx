import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { ASSETS } from './assets';

const DECK_WIDTH = '10.2vw';
const CARD_ASPECT_RATIO = 0.7;

export const DrawDeck = React.forwardRef<HTMLDivElement, {
    count: number;
    locale?: string;
    isHandHidden?: boolean;
    onToggleHandHidden?: () => void;
}>(({ count, locale, isHandHidden = false, onToggleHandHidden }, ref) => {
    const { t } = useTranslation('game-dicethrone');
    const handToggleLabel = isHandHidden ? t('hud.showHand') : t('hud.hideHand');
    const handToggleClassName = [
        'absolute left-[calc(100%+0.55vw)] bottom-[0.15vw] z-20',
        'flex h-[2.65vw] min-h-[44px] w-[2.65vw] min-w-[44px] items-center justify-center rounded-full',
        'border-2 ring-2 ring-slate-950/80',
        'shadow-[0_0_1.15vw_rgba(34,211,238,0.78),0_0.16vw_0.45vw_rgba(0,0,0,0.82)]',
        'transition-[background-color,transform,border-color,box-shadow] duration-150',
        'hover:scale-105 active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/90',
        isHandHidden
            ? 'border-amber-50 bg-amber-200 text-slate-950 hover:bg-amber-100'
            : 'border-cyan-50 bg-cyan-200 text-slate-950 hover:bg-cyan-100',
    ].join(' ');

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
            {onToggleHandHidden && (
                <button
                    type="button"
                    data-testid="dicethrone-hand-visibility-toggle"
                    aria-label={handToggleLabel}
                    title={handToggleLabel}
                    aria-pressed={isHandHidden}
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleHandHidden();
                    }}
                    className={handToggleClassName}
                >
                    {isHandHidden
                        ? <ChevronUp className="h-[1.3vw] min-h-[20px] w-[1.3vw] min-w-[20px] drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]" strokeWidth={3} />
                        : <ChevronDown className="h-[1.3vw] min-h-[20px] w-[1.3vw] min-w-[20px] drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]" strokeWidth={3} />}
                </button>
            )}
        </div>
    );
});
DrawDeck.displayName = 'DrawDeck';
