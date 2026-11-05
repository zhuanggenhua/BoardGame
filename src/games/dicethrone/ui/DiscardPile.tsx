import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AbilityCard } from '../types';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { useCoarsePointer } from '../../../hooks/ui/useCoarsePointer';
import {
    buildBoardShellInlineUnitValue,
    buildBoardShellScreenPixelValue,
} from '../../../shared/runtimeLayoutUnits';

const dtUnit = buildBoardShellInlineUnitValue;

export const DiscardPile = React.forwardRef<HTMLDivElement, {
    cards: AbilityCard[];
    locale?: string;
    onInspectRecent?: (cards: AbilityCard[]) => void;
    canUndo?: boolean;
    onUndo?: () => void;
    isHighlighted?: boolean;
    showSellButton?: boolean;
}>(({ cards, locale, onInspectRecent, canUndo, onUndo, isHighlighted, showSellButton }, ref) => {
    const { t } = useTranslation('game-dicethrone');
    const ratioPadding = `${100 / 0.7}%`;
    const showTouchInspectButton = useCoarsePointer();
    const topCard = cards[cards.length - 1];
    const overlayLabelClassName = 'bg-amber-600/90 text-white font-bold shadow-lg';
    const overlayLabelStyle: React.CSSProperties = {
        paddingInline: dtUnit(0.6),
        paddingBlock: dtUnit(0.3),
        borderRadius: dtUnit(0.4),
        fontSize: dtUnit(0.7),
    };
    const inspectButtonClassName = 'absolute z-20 flex items-center justify-center p-0 text-white transition-[filter,opacity] duration-300 hover:brightness-125';
    const inspectButtonVisualClassName = 'absolute top-0 right-0 flex items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl';
    const inspectButtonVisualStyle = {
        width: dtUnit(2),
        height: dtUnit(2),
    } as const;
    const inspectIconClassName = 'fill-current';
    const inspectButtonStyle = {
        top: dtUnit(0.24),
        right: dtUnit(0.48),
        width: buildBoardShellScreenPixelValue(44),
        height: buildBoardShellScreenPixelValue(44),
        minWidth: buildBoardShellScreenPixelValue(44),
        minHeight: buildBoardShellScreenPixelValue(44),
        maxWidth: buildBoardShellScreenPixelValue(44),
        maxHeight: buildBoardShellScreenPixelValue(44),
        appearance: 'none',
        WebkitAppearance: 'none',
        fontSize: '0',
        lineHeight: '0',
    } as const;

    const getPreviewCards = React.useCallback(() => {
        if (cards.length === 0) return [];
        return cards.slice().reverse();
    }, [cards]);

    const handleClick = () => {
        if (canUndo && onUndo) {
            onUndo();
        } else if (topCard && onInspectRecent) {
            onInspectRecent(getPreviewCards());
        }
    };

    return (
        <div
            ref={ref}
            className="relative group perspective-500 w-full"
            style={{
                height: 0,
                paddingTop: ratioPadding,
                aspectRatio: '0.7 / 1',
            }}
            data-testid="discard-pile"
            data-tutorial-id="discard-pile"
            onClick={handleClick}
        >
            <div
                className={`absolute inset-0 border-dashed flex items-center justify-center overflow-hidden shadow-lg transition-[transform,background-color,box-shadow] duration-200 ${
                    isHighlighted ? 'border-amber-400 bg-amber-500/20 scale-105 shadow-amber-500/30' :
                    canUndo ? 'border-amber-500 cursor-pointer hover:scale-[1.03] bg-slate-900/50' :
                    topCard ? 'border-slate-600 cursor-pointer hover:scale-[1.03] bg-slate-900/50' :
                    'border-slate-600 cursor-default opacity-70 bg-slate-900/50'
                }`}
                style={{ borderRadius: dtUnit(0.5), borderWidth: dtUnit(0.2) }}
            >
                {!topCard && (
                    <div
                        className="font-bold uppercase tracking-widest text-slate-600"
                        style={{ fontSize: dtUnit(0.8) }}
                    >
                        {t('hud.discardPile')}
                    </div>
                )}
                {topCard && (
                    <CardPreview
                        previewRef={topCard.previewRef}
                        locale={locale}
                        className="absolute inset-0 w-full h-full"
                        style={{ backgroundColor: '#0f172a' }}
                    />
                )}
                {topCard && (
                    <button
                        type="button"
                        className={`${inspectButtonClassName} ${showTouchInspectButton ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        style={inspectButtonStyle}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onInspectRecent) onInspectRecent(getPreviewCards());
                        }}
                        data-testid="discard-pile-inspect-button"
                        aria-label={t('actions.inspectDiscardPile')}
                    >
                        <span
                            className={inspectButtonVisualClassName}
                            style={inspectButtonVisualStyle}
                            data-fixed-control-visual="true"
                        >
                            <svg
                                className={`board-shell-fixed-icon ${inspectIconClassName}`}
                                viewBox="0 0 20 20"
                                style={{ width: dtUnit(0.84), height: dtUnit(0.84) }}
                            >
                                <path d="M5 8a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-5a5 5 0 1 0 3.164 8.871l4.482 4.483a1 1 0 0 0 1.415-1.415l-4.483-4.482A5 5 0 0 0 8 3z" />
                            </svg>
                        </span>
                    </button>
                )}
                {showSellButton && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className={overlayLabelClassName} style={overlayLabelStyle}>
                            {t('actions.sell')}
                        </div>
                    </div>
                )}
                {canUndo && !isHighlighted && (
                    <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className={overlayLabelClassName} style={overlayLabelStyle}>
                            {t('actions.undoSell')}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

DiscardPile.displayName = 'DiscardPile';
