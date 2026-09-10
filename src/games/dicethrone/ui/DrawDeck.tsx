import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { ASSETS } from './assets';
import { buildBoardShellInlineUnitValue, buildBoardShellScreenPixelValue } from '../../../shared/runtimeLayoutUnits';

const DECK_WIDTH = buildBoardShellInlineUnitValue(10.2);
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
        'absolute z-20',
        'flex items-center justify-center rounded-full',
        'border border-cyan-200/70 bg-slate-950/88 text-cyan-100',
        'backdrop-blur-sm',
        'transition-[background-color,transform,border-color,box-shadow] duration-150',
        'hover:scale-105 hover:border-cyan-100 hover:bg-cyan-900/90 active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/90',
        isHandHidden
            ? 'border-amber-200/80 text-amber-100 hover:border-amber-100 hover:bg-amber-900/90'
            : '',
    ].join(' ');

    return (
        <div
            ref={ref}
            data-testid="dt-draw-deck-card"
            className="relative perspective-500 select-none"
            style={{
                width: DECK_WIDTH,
                height: `calc(${DECK_WIDTH} / ${CARD_ASPECT_RATIO})`,
                aspectRatio: `${CARD_ASPECT_RATIO} / 1`,
            }}
        >
            <div
                className="absolute inset-0 bg-slate-800"
                style={{
                    borderRadius: buildBoardShellInlineUnitValue(0.5),
                    transform: `translate(${buildBoardShellInlineUnitValue(0.2)}, ${buildBoardShellInlineUnitValue(0.2)})`,
                }}
            ></div>
            <div
                className="w-full h-full overflow-hidden shadow-2xl border border-slate-600 relative z-10 bg-slate-900"
                style={{ borderRadius: buildBoardShellInlineUnitValue(0.5) }}
            >
                <OptimizedImage
                    src={ASSETS.CARD_BG}
                    locale={locale}
                    className="w-full h-full object-cover"
                    alt={t('imageAlt.deck')}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center font-bold text-slate-100">
                    <span
                        className="tracking-widest text-slate-200 drop-shadow-sm"
                        style={{ fontSize: buildBoardShellInlineUnitValue(0.6), marginBottom: buildBoardShellInlineUnitValue(0.2) }}
                    >
                        {t('hud.deck')}
                    </span>
                    <span className="text-white leading-none drop-shadow-md" style={{ fontSize: buildBoardShellInlineUnitValue(1.8) }}>
                        {count}
                    </span>
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
                    style={{
                        left: `calc(100% + ${buildBoardShellInlineUnitValue(0.35)})`,
                        bottom: `max(0px, calc((44px / var(--mobile-board-shell-scale, 1) - ${buildBoardShellInlineUnitValue(2.2)}) / 2))`,
                        width: buildBoardShellInlineUnitValue(2.2),
                        height: buildBoardShellInlineUnitValue(2.2),
                        boxShadow: isHandHidden
                            ? `0 0 ${buildBoardShellInlineUnitValue(0.9)} rgba(245,158,11,0.32)`
                            : `0 0 ${buildBoardShellInlineUnitValue(0.9)} rgba(34,211,238,0.32)`,
                    }}
                >
                    <span
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
                        style={{
                            minHeight: buildBoardShellScreenPixelValue(44),
                            minWidth: buildBoardShellScreenPixelValue(44),
                        }}
                        data-testid="dicethrone-hand-visibility-hit-area"
                        aria-hidden="true"
                    />
                    {isHandHidden
                        ? <ChevronUp className="relative z-10" style={{ width: buildBoardShellInlineUnitValue(1.08), height: buildBoardShellInlineUnitValue(1.08) }} strokeWidth={2.4} />
                        : <ChevronDown className="relative z-10" style={{ width: buildBoardShellInlineUnitValue(1.08), height: buildBoardShellInlineUnitValue(1.08) }} strokeWidth={2.4} />}
                </button>
            )}
        </div>
    );
});
DrawDeck.displayName = 'DrawDeck';
