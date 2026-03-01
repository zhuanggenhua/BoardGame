/**
 * 卡牌选择弹窗组件
 * 
 * 用于能力执行时选择卡牌（单选或多选）
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlayedCard } from '../domain/core-types';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

interface CardSelectionModalProps {
    title: string;
    cards: PlayedCard[];
    minSelect: number;
    maxSelect: number;
    onConfirm: (selectedCardUids: string[]) => void;
    onCancel: () => void;
}

export const CardSelectionModal: React.FC<CardSelectionModalProps> = ({
    title,
    cards,
    minSelect,
    maxSelect,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation('game-cardia');
    const [selectedUids, setSelectedUids] = useState<string[]>([]);
    
    const isSingleSelect = maxSelect === 1;
    const canConfirm = selectedUids.length >= minSelect && selectedUids.length <= maxSelect;
    
    const handleCardClick = (cardUid: string) => {
        if (isSingleSelect) {
            // 单选模式：直接替换选择
            setSelectedUids([cardUid]);
        } else {
            // 多选模式：切换选择状态
            if (selectedUids.includes(cardUid)) {
                setSelectedUids(selectedUids.filter(uid => uid !== cardUid));
            } else {
                if (selectedUids.length < maxSelect) {
                    setSelectedUids([...selectedUids, cardUid]);
                }
            }
        }
    };
    
    const handleConfirm = () => {
        if (canConfirm) {
            onConfirm(selectedUids);
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border-2 border-purple-500 shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
                {/* 标题栏 */}
                <div className="px-6 py-4 border-b border-purple-500/30">
                    <h2 className="text-2xl font-bold text-yellow-400">{title}</h2>
                    <p className="text-sm text-gray-400 mt-1">
                        {isSingleSelect 
                            ? t('selectOneCard')
                            : t('selectCards', { min: minSelect, max: maxSelect })
                        }
                    </p>
                </div>
                
                {/* 卡牌列表 */}
                <div className="flex-1 overflow-y-auto p-6">
                    {cards.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                            {t('noCardsAvailable')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {cards.map(card => {
                                const isSelected = selectedUids.includes(card.uid);
                                return (
                                    <button
                                        key={card.uid}
                                        onClick={() => handleCardClick(card.uid)}
                                        className={`relative transition-all ${
                                            isSelected 
                                                ? 'ring-4 ring-yellow-400 scale-105' 
                                                : 'hover:scale-105 hover:ring-2 hover:ring-purple-400'
                                        }`}
                                    >
                                        <CardDisplay card={card} />
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center font-bold">
                                                ✓
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                {/* 操作按钮 */}
                <div className="px-6 py-4 border-t border-purple-500/30 flex gap-3">
                    <button
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        {t('confirm')} {selectedUids.length > 0 && `(${selectedUids.length})`}
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        {t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * 卡牌展示组件（简化版）
 */
interface CardDisplayProps {
    card: PlayedCard;
}

const CardDisplay: React.FC<CardDisplayProps> = ({ card }) => {
    const { t } = useTranslation('game-cardia');
    const [imageError, setImageError] = React.useState(false);
    
    const factionColors = {
        swamp: 'from-green-700 to-green-900',
        academy: 'from-yellow-700 to-yellow-900',
        guild: 'from-red-700 to-red-900',
        dynasty: 'from-blue-700 to-blue-900',
    };
    
    const bgColor = factionColors[card.faction as keyof typeof factionColors] || 'from-gray-700 to-gray-900';
    const imagePath = card.imagePath || (card.imageIndex ? `cardia/cards/${card.imageIndex}.jpg` : undefined);
    
    return (
        <div className="relative w-full aspect-[2/3] rounded-lg border-2 border-white/20 shadow-lg overflow-hidden">
            {imagePath && !imageError ? (
                <OptimizedImage
                    src={imagePath}
                    alt={t(card.defId)}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={() => setImageError(true)}
                />
            ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${bgColor}`} />
            )}
            
            {/* 影响力显示 */}
            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center">
                <span className="text-white font-bold">{card.currentInfluence}</span>
            </div>
            
            {/* 印戒标记 */}
            {card.signets > 0 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                    {Array.from({ length: card.signets }).map((_, i) => (
                        <div key={i} className="w-4 h-4 bg-yellow-400 rounded-full border border-yellow-600 shadow" />
                    ))}
                </div>
            )}
            
            {/* 持续能力标记 */}
            {card.ongoingMarkers && card.ongoingMarkers.length > 0 && (
                <div className="absolute top-2 right-2 text-lg">🔄</div>
            )}
        </div>
    );
};
