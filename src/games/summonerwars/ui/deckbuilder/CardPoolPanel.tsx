
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card, UnitCard } from '../../domain/types';
import { getCardPoolByFaction, groupCardsByType } from '../../config/cardRegistry';
import { canAddCard, type DeckDraft } from '../../config/deckValidation';
import { CardSprite } from '../CardSprite';
import { MagnifyOverlay } from '../../../../components/common/overlays/MagnifyOverlay';
import { resolveCardAtlasId, initSpriteAtlases } from '../cardAtlas';

/** 解析卡牌的精灵图配置 */
function resolveSprite(card: Card): { atlasId: string; frameIndex: number } {
    const spriteAtlasType = card.spriteAtlas ?? (card.cardType === 'unit' && card.unitClass === 'summoner' ? 'hero' : 'cards');
    const atlasId = spriteAtlasType === 'portal'
        ? 'sw:portal'
        : resolveCardAtlasId(card as { id: string; faction?: string }, spriteAtlasType as 'hero' | 'cards');
    return { atlasId, frameIndex: card.spriteIndex ?? 0 };
}

interface CardPoolPanelProps {
    factionId: string | null;
    currentDeck: DeckDraft;
    onAddCard: (card: Card) => void;
    onSelectSummoner: (card: UnitCard) => void;
}

export const CardPoolPanel: React.FC<CardPoolPanelProps> = ({ factionId, currentDeck, onAddCard, onSelectSummoner }) => {
    const { t, i18n } = useTranslation('game-summonerwars');
    const [magnifiedCard, setMagnifiedCard] = useState<{ atlasId: string; frameIndex: number; name: string } | null>(null);

    // 确保精灵图注册表已初始化（使用当前语言）
    useEffect(() => {
        initSpriteAtlases(i18n.language);
    }, [i18n.language]);

    const cards = useMemo(() => {
        if (!factionId) return [];
        return getCardPoolByFaction(factionId);
    }, [factionId]);

    const groups = useMemo(() => groupCardsByType(cards), [cards]);

    /** 放大预览卡牌 */
    const handleMagnify = useCallback((card: Card) => {
        const sprite = resolveSprite(card);
        setMagnifiedCard({ ...sprite, name: card.name });
    }, []);

    if (!factionId) {
        return (
            <div className="flex-1 flex items-center justify-center text-white/30 text-lg uppercase tracking-widest">
                {t('deckBuilder.selectFactionFirst')}
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f]">
            {/* 召唤师 */}
            {groups.summoners.length > 0 && (
                <CardSection
                    title={t('deckBuilder.summoners')}
                    cards={groups.summoners}
                    currentDeck={currentDeck}
                    onAdd={(c) => onSelectSummoner(c as UnitCard)}
                    onMagnify={handleMagnify}
                    isSummonerSection
                />
            )}

            {/* 冠军 */}
            {groups.champions.length > 0 && (
                <CardSection
                    title={t('deckBuilder.champions')}
                    cards={groups.champions}
                    currentDeck={currentDeck}
                    onAdd={onAddCard}
                    onMagnify={handleMagnify}
                />
            )}

            {/* 普通单位 */}
            {groups.commons.length > 0 && (
                <CardSection
                    title={t('deckBuilder.commons')}
                    cards={groups.commons}
                    currentDeck={currentDeck}
                    onAdd={onAddCard}
                    onMagnify={handleMagnify}
                />
            )}

            {/* 事件 */}
            {groups.events.length > 0 && (
                <CardSection
                    title={t('deckBuilder.events')}
                    cards={groups.events}
                    currentDeck={currentDeck}
                    onAdd={onAddCard}
                    onMagnify={handleMagnify}
                />
            )}

            {/* 建筑（城门）已由 buildAutoCards 自动填充，不在卡牌池中显示 */}

            {/* 卡牌放大预览 */}
            <MagnifyOverlay
                isOpen={!!magnifiedCard}
                onClose={() => setMagnifiedCard(null)}
                containerClassName="max-h-[85vh] max-w-[90vw]"
                closeLabel={t('actions.closePreview')}
            >
                {magnifiedCard && (
                    <CardSprite
                        atlasId={magnifiedCard.atlasId}
                        frameIndex={magnifiedCard.frameIndex}
                        className="h-[75vh] w-auto rounded-xl shadow-2xl"
                    />
                )}
            </MagnifyOverlay>
        </div>
    );
};

interface CardSectionProps {
    title: string;
    cards: Card[];
    currentDeck: DeckDraft;
    onAdd: (card: Card) => void;
    onMagnify: (card: Card) => void;
    isSummonerSection?: boolean;
}

const CardSection: React.FC<CardSectionProps> = ({ title, cards, currentDeck, onAdd, onMagnify, isSummonerSection }) => {
    const { t } = useTranslation('game-summonerwars');
    
    return (
        <div className="mb-5">
            <h3 className="text-amber-500/80 font-bold uppercase text-xs mb-2 flex items-center gap-2">
                <span className="w-1 h-1 bg-amber-500 rounded-full" />
                {title}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {cards.map(card => {
                    const isSelectedSummoner = isSummonerSection && currentDeck.summoner?.id === card.id;
                    const check = canAddCard(currentDeck, card);
                    const isDisabled = !check.allowed && !isSummonerSection;
                    const sprite = resolveSprite(card);

                    return (
                        <div
                            key={card.id}
                            className={`
                                relative group rounded-lg overflow-hidden border transition-all duration-200
                                ${isSelectedSummoner ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105 z-10' : ''}
                                ${isDisabled ? 'opacity-50 grayscale border-white/5' : 'border-white/20 hover:border-amber-400/60 hover:shadow-xl'}
                            `}
                        >
                            {/* 卡牌精灵图（点击添加/选择） */}
                            <div
                                onClick={() => !isDisabled && onAdd(card)}
                                className={isDisabled ? 'cursor-default' : 'cursor-pointer'}
                            >
                                <CardSprite
                                    atlasId={sprite.atlasId}
                                    frameIndex={sprite.frameIndex}
                                    className="w-full"
                                />
                            </div>

                            {/* 卡牌名称（底部渐变遮罩） */}
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-1.5 pb-1 pt-4 pointer-events-none">
                                <div className="font-bold text-xs text-white leading-tight truncate">{card.name}</div>
                            </div>

                            {/* 放大预览按钮（所有卡牌都可预览，包括禁用状态） */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onMagnify(card); }}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white/70 hover:bg-black/80 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                title={t('deckBuilder.magnifyPreview')}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    <line x1="11" y1="8" x2="11" y2="14" />
                                    <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
