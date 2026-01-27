import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AbilityCard } from '../types';
import { buildLocalizedImageSet } from '../../../core';
import type { CardAtlasConfig } from './cardAtlas';
import { getCardAtlasStyle } from './cardAtlas';
import { ASSETS } from './assets';


export const DiscardPile = React.forwardRef<HTMLDivElement, {
    cards: AbilityCard[];
    locale?: string;
    atlas?: CardAtlasConfig;
    /** 点击放大按钮时触发，传入弃牌堆卡片（按时间从新到旧排列） */
    onInspectRecent?: (cards: AbilityCard[]) => void;
    canUndo?: boolean;
    onUndo?: () => void;
    isHighlighted?: boolean;
    showSellButton?: boolean;
}>(({ cards, locale, atlas, onInspectRecent, canUndo, onUndo, isHighlighted, showSellButton }, ref) => {
    const { t } = useTranslation('game-dicethrone');
    const topCard = cards[cards.length - 1];

    const topCardStyle = React.useMemo(() => {
        if (!topCard || !atlas) return {};
        return getCardAtlasStyle(topCard.atlasIndex ?? 0, atlas);
    }, [topCard, atlas]);

    /** 获取弃牌堆所有卡片用于预览（从新到旧排列，即最左边是最新弃置的） */
    const getPreviewCards = React.useCallback(() => {
        if (cards.length === 0) return [];
        // 反转为从新到旧的顺序
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
            onClick={handleClick}
        >
            {!topCard && <div className="text-[0.8vw] font-bold uppercase tracking-widest text-slate-600">{t('hud.discardPile')}</div>}
            {topCard && (
                <div
                    className="absolute inset-0 w-full h-full"
                    style={{
                        backgroundImage: buildLocalizedImageSet(ASSETS.CARDS_ATLAS, locale),
                        backgroundRepeat: 'no-repeat',
                        ...topCardStyle,
                    }}
                />
            )}
            {topCard && (
                <button
                    className="absolute top-[0.3vw] right-[0.3vw] w-[1.4vw] h-[1.4vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-300 shadow-xl border border-white/20 z-20"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onInspectRecent) onInspectRecent(getPreviewCards());
                    }}
                >
                    <svg className="w-[0.8vw] h-[0.8vw] fill-current" viewBox="0 0 20 20">
                        <path d="M5 8a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-5a5 5 0 1 0 3.164 8.871l4.482 4.483a1 1 0 0 0 1.415-1.415l-4.483-4.482A5 5 0 0 0 8 3z" />
                    </svg>
                </button>
            )}
            {showSellButton && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="px-[0.6vw] py-[0.3vw] bg-amber-600/90 rounded-[0.4vw] text-white text-[0.7vw] font-bold shadow-lg">
                        {t('actions.sell')}
                    </div>
                </div>
            )}
            {canUndo && !isHighlighted && (
                <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="px-[0.6vw] py-[0.3vw] bg-amber-600/90 rounded-[0.4vw] text-white text-[0.7vw] font-bold shadow-lg">
                        {t('actions.undoSell')}
                    </div>
                </div>
            )}
        </div>
    );
});
DiscardPile.displayName = 'DiscardPile';
