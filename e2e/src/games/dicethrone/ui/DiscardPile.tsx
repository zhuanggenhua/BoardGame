import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AbilityCard } from '../types';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { useCoarsePointer } from '../../../hooks/ui/useCoarsePointer';

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
    const showTouchInspectButton = useCoarsePointer();
    const topCard = cards[cards.length - 1];
    const overlayLabelClassName = 'px-[0.6vw] py-[0.3vw] bg-amber-600/90 rounded-[0.4vw] text-white text-[0.7vw] font-bold shadow-lg';
    const inspectButtonClassName = 'absolute z-20 flex items-center justify-center rounded-full border border-white/20 bg-black/60 p-0 text-white shadow-xl transition-[background-color,opacity] duration-300 hover:bg-amber-500/80';
    const inspectButtonVisualClassName = 'flex h-full w-full items-center justify-center';
    const inspectIconClassName = 'w-[0.52vw] h-[0.52vw] fill-current';
    const inspectButtonStyle = {
        top: '0.24vw',
        right: '0.48vw',
        width: '2vw',
        height: '2vw',
        minWidth: '0',
        minHeight: '0',
        maxWidth: '2vw',
        maxHeight: '2vw',
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
            className={`relative group perspective-500 w-full aspect-[0.7] rounded-[0.5vw] border-[0.2vw] border-dashed flex items-center justify-center overflow-hidden shadow-lg transition-[transform,background-color,box-shadow] duration-200 ${
                isHighlighted ? 'border-amber-400 bg-amber-500/20 scale-105 shadow-amber-500/30' :
                canUndo ? 'border-amber-500 cursor-pointer hover:scale-[1.03] bg-slate-900/50' :
                topCard ? 'border-slate-600 cursor-pointer hover:scale-[1.03] bg-slate-900/50' :
                'border-slate-600 cursor-default opacity-70 bg-slate-900/50'
            }`}
            data-testid="discard-pile"
            data-tutorial-id="discard-pile"
            onClick={handleClick}
        >
            {!topCard && <div className="text-[0.8vw] font-bold uppercase tracking-widest text-slate-600">{t('hud.discardPile')}</div>}
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
                    aria-label="查看弃牌堆"
                >
                    <span className={inspectButtonVisualClassName}>
                        <svg className={inspectIconClassName} viewBox="0 0 20 20">
                            <path d="M5 8a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-5a5 5 0 1 0 3.164 8.871l4.482 4.483a1 1 0 0 0 1.415-1.415l-4.483-4.482A5 5 0 0 0 8 3z" />
                        </svg>
                    </span>
                </button>
            )}
            {showSellButton && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className={overlayLabelClassName}>
                        {t('actions.sell')}
                    </div>
                </div>
            )}
            {canUndo && !isHighlighted && (
                <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={overlayLabelClassName}>
                        {t('actions.undoSell')}
                    </div>
                </div>
            )}
        </div>
    );
});

DiscardPile.displayName = 'DiscardPile';
