import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '../domain/types';
import { CardSprite } from './CardSprite';
import { GameButton } from './GameButton';
import { resolveCardAtlasId } from './cardAtlas';

interface CardSelectorOverlayProps {
    /** 可选卡牌列表（不需要包含 position，只需要 Card 数据） */
    cards: Card[];
    /** 选中回调 */
    onSelect: (card: Card) => void;
    /** 取消回调 */
    onCancel: () => void;
    /** 标题 */
    title: string;
    /** 是否只显示单位（默认 true） */
    unitOnly?: boolean;
}

/**
 * 卡牌选择遮罩层（通用）
 * 用于从弃牌堆或其他集合中选择卡牌
 * 
 * 特性：
 * - 居中显示
 * - 横向滚动/滑动
 * - 自动聚焦
 * - 选中高亮
 */
export const CardSelectorOverlay: React.FC<CardSelectorOverlayProps> = ({
    cards,
    onSelect,
    onCancel,
    title,
}) => {
    const { t } = useTranslation('game-summonerwars');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

    // 如果没有卡牌，直接显示提示并提供关闭按钮
    if (!cards || cards.length === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-800 p-8 rounded-xl border border-slate-600 shadow-2xl text-center max-w-sm mx-4">
                    <h3 className="text-xl text-white font-bold mb-4">{title}</h3>
                    <p className="text-slate-300 mb-6">{t('cardSelector.empty')}</p>
                    <GameButton onClick={onCancel} variant="secondary">
                        {t('actions.close')}
                    </GameButton>
                </div>
            </div>
        );
    }

    const handleSelect = (card: Card) => {
        setSelectedCardId(card.id);
        onSelect(card);
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
            data-testid="sw-card-selector-overlay"
        >
            {/* 标题区域 */}
            <h2 className="text-3xl text-amber-100 font-bold mb-8 drop-shadow-lg tracking-wider">
                {title}
            </h2>

            {/* 滚动容器 */}
            <div className="w-full max-w-6xl px-4 relative flex items-center justify-center">
                {/* 左渐变遮罩 */}
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black/80 to-transparent z-10 pointer-events-none" />

                {/* 卡牌列表 */}
                <div
                    ref={scrollContainerRef}
                    className="flex gap-6 overflow-x-auto py-12 px-8 snap-x snap-mandatory scrollbar-hide mask-gradient-x w-full"
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {cards.map((card) => {
                        const spriteIndex = card.spriteIndex ?? 0;
                        const spriteAtlas = card.spriteAtlas ?? 'cards';
                        const atlasId = spriteAtlas === 'portal'
                          ? 'sw:portal'
                          : resolveCardAtlasId(card as { id: string; faction?: string }, spriteAtlas as 'hero' | 'cards');
                        const isSelected = selectedCardId === card.id;

                        return (
                            <div
                                key={card.id}
                                data-card-id={card.id}
                                className={`
                  flex-shrink-0 snap-center cursor-pointer relative group transition-all duration-300
                  ${isSelected ? 'scale-110 z-20' : 'hover:scale-105 hover:z-10'}
                `}
                                onClick={() => handleSelect(card)}
                            >
                                <div className={`
                   rounded-lg shadow-2xl transition-all duration-300
                   ${isSelected ? 'ring-4 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)]' : 'group-hover:ring-2 group-hover:ring-white/50'}
                `}>
                                    {/* 卡牌显示 */}
                                    <CardSprite
                                        atlasId={atlasId}
                                        frameIndex={spriteIndex}
                                        className="w-[220px] rounded-lg bg-slate-900"
                                    />

                                    {/* 单位属性覆盖层 (可选) */}
                                    {card.cardType === 'unit' && (
                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                                            {/* 可以在这里显示费用、生命等，如果原图不包含的话 */}
                                        </div>
                                    )}
                                </div>

                                {/* 卡牌名称 (悬停或选中显示) */}
                                <div className={`
                  absolute -bottom-10 left-1/2 -translate-x-1/2 
                  whitespace-nowrap px-3 py-1 rounded-full bg-black/80 text-white text-sm font-medium
                  transition-opacity duration-200 pointer-events-none
                  ${isSelected || 'group-hover:opacity-100 opacity-0'}
                `}>
                                    {card.name}
                                </div>
                            </div>
                        );
                    })}

                    {/* 占位符，确保最后一张卡能滚到中间 */}
                    <div className="w-[calc(50%-110px)] flex-shrink-0" />
                </div>

                {/* 右渐变遮罩 */}
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/80 to-transparent z-10 pointer-events-none" />
            </div>

            {/* 底部操作区 */}
            <div className="mt-12 flex gap-4">
                <GameButton onClick={onCancel} variant="secondary" size="lg">
                    {t('actions.cancel')}
                </GameButton>
            </div>
        </div>
    );
};
