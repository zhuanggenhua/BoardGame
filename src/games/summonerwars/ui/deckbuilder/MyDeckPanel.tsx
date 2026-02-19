
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeckDraft, DeckValidationResult } from '../../config/deckValidation';
import type { SavedDeckSummary } from './useDeckBuilder';
import { CardSprite } from '../CardSprite';
import { MagnifyOverlay } from '../../../../components/common/overlays/MagnifyOverlay';
import { GameButton } from '../GameButton';
import { resolveCardAtlasId, initSpriteAtlases } from '../cardAtlas';
import type { Card } from '../../domain/types';
import { useToast } from '../../../../contexts/ToastContext';

/** 获取卡牌的精灵图配置 */
function getCardSpriteConfig(card: Card): { atlasId: string; frameIndex: number } {
    const spriteAtlasType = card.spriteAtlas ?? (card.cardType === 'unit' && card.unitClass === 'summoner' ? 'hero' : 'cards');
    const atlasId = spriteAtlasType === 'portal'
        ? 'sw:portal'
        : resolveCardAtlasId(card as { id: string; faction?: string }, spriteAtlasType as 'hero' | 'cards');
    return { atlasId, frameIndex: card.spriteIndex ?? 0 };
}

interface MyDeckPanelProps {
    currentDeck: DeckDraft;
    validationResult: DeckValidationResult;
    savedDecks: SavedDeckSummary[];
    freeMode: boolean;
    onToggleFreeMode: () => void;
    onRemoveCard: (cardId: string) => void;
    onSave: (name: string) => Promise<void>;
    onLoad: (id: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onConfirm?: () => void;
    /** 直接选择已保存的牌组（不加载到编辑器） */
    onSelectSavedDeck?: (deckId: string) => void;
}

export const MyDeckPanel: React.FC<MyDeckPanelProps> = ({
    currentDeck,
    validationResult,
    savedDecks,
    freeMode,
    onToggleFreeMode,
    onRemoveCard,
    onSave,
    onLoad,
    onDelete,
    onConfirm,
    onSelectSavedDeck
}) => {
    const { t, i18n } = useTranslation('game-summonerwars');
    const toast = useToast();
    const [deckName, setDeckName] = useState('');
    const [magnifiedCard, setMagnifiedCard] = useState<{ atlasId: string; frameIndex: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // 确保精灵图注册表已初始化（使用当前语言）
    useEffect(() => {
        initSpriteAtlases(i18n.language);
    }, [i18n.language]);

    const handleMagnify = useCallback((card: Card) => {
        setMagnifiedCard(getCardSpriteConfig(card));
    }, []);
    
    // 包装 onSave，添加错误处理和成功提示
    const handleSave = useCallback(async () => {
        if (!deckName || !validationResult.valid) {
            console.warn('[MyDeckPanel] 保存被阻止:', {
                deckName,
                valid: validationResult.valid,
                errors: validationResult.errors
            });
            return;
        }
        
        setIsSaving(true);
        try {
            await onSave(deckName);
            toast.success(
                { kind: 'i18n', ns: 'game-summonerwars', key: 'deckBuilder.saveSuccess' },
                undefined,
                { dedupeKey: 'deck-save-success' }
            );
            // 保存成功后清空输入框
            setDeckName('');
        } catch (err) {
            console.error('[MyDeckPanel] 保存牌组失败:', err);
            toast.error(
                { kind: 'i18n', ns: 'game-summonerwars', key: 'deckBuilder.saveFailed' },
                undefined,
                { dedupeKey: 'deck-save-failed' }
            );
        } finally {
            setIsSaving(false);
        }
    }, [deckName, validationResult, onSave, toast]);

    const totalCards = Array.from(currentDeck.manualCards.values()).reduce((sum, item) => sum + item.count, 0)
        + (currentDeck.summoner ? 1 : 0)
        + currentDeck.autoCards.length;

    const autoUnitCount = currentDeck.autoCards.filter(c => c.cardType === 'unit').length;
    const autoEventCount = currentDeck.autoCards.filter(c => c.cardType === 'event').length;
    const unitCount = Array.from(currentDeck.manualCards.values()).filter(i => i.card.cardType === 'unit').reduce((sum, i) => sum + i.count, 0) + (currentDeck.summoner ? 1 : 0) + autoUnitCount;
    const eventCount = Array.from(currentDeck.manualCards.values()).filter(i => i.card.cardType === 'event').reduce((sum, i) => sum + i.count, 0) + autoEventCount;

    return (
        <div className="w-80 h-full bg-[#121212] border-l border-white/10 flex flex-col flex-shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
            {/* 头部统计 */}
            <div className="px-4 py-3 border-b border-white/10 bg-black/20">
                <h2 className="text-amber-400 font-bold uppercase tracking-wider text-sm mb-1.5">{t('deckBuilder.myDeck')}</h2>
                <div className="flex gap-3 text-xs text-white/50">
                    <span>{t('deckBuilder.count')}: <strong className="text-white">{totalCards}</strong></span>
                    <span>{t('deckBuilder.units')}: <strong className="text-white">{unitCount}</strong></span>
                    <span>{t('deckBuilder.events')}: <strong className="text-white">{eventCount}</strong></span>
                </div>
                {/* 自由组卡开关 */}
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <div
                        role="switch"
                        aria-checked={freeMode}
                        tabIndex={0}
                        onClick={onToggleFreeMode}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleFreeMode(); } }}
                        className={`relative w-8 h-4 rounded-full transition-[background-color] ${freeMode ? 'bg-amber-500' : 'bg-white/20'}`}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${freeMode ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-xs text-white/60">{t('deckBuilder.freeMode', '自由组卡')}</span>
                    {freeMode && <span className="text-[10px] text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">{t('deckBuilder.freeModeOn', '已开启')}</span>}
                </label>
            </div>

            {/* 验证错误 */}
            {!validationResult.valid && (
                <div className="px-3 py-2 bg-red-900/20 border-b border-red-500/20">
                    <div className="text-red-400 text-xs font-bold mb-1">{t('deckBuilder.invalidDeck')}</div>
                    <ul className="space-y-0.5">
                        {validationResult.errors.map((err, idx) => (
                            <li key={idx} className="text-[10px] text-red-300 flex justify-between">
                                <span>{err.message}</span>
                                <span className="opacity-50">{err.current}/{err.expected}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 卡牌网格区域 */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                {/* 召唤师 */}
                {currentDeck.summoner && (
                    <DeckCardTile
                        card={currentDeck.summoner}
                        count={1}
                        isLocked
                        onMagnify={handleMagnify}
                    />
                )}

                {/* 自动填充卡牌标签 */}
                {currentDeck.autoCards.length > 0 && (
                    <div className="mt-2 mb-1 px-1 text-[10px] uppercase text-white/30 font-bold tracking-widest">{t('deckBuilder.startingCards')}</div>
                )}

                {/* 手动添加卡牌 */}
                {currentDeck.manualCards.size > 0 && (
                    <div className="mt-2 mb-1 px-1 text-[10px] uppercase text-white/30 font-bold tracking-widest">{t('deckBuilder.buildCards')}</div>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                    {Array.from(currentDeck.manualCards.values()).map(({ card, count }) => (
                        <DeckCardTile
                            key={card.id}
                            card={card}
                            count={count}
                            onRemove={() => onRemoveCard(card.id)}
                            onMagnify={handleMagnify}
                        />
                    ))}
                </div>

                {currentDeck.manualCards.size === 0 && !currentDeck.summoner && (
                    <div className="text-center py-10 text-white/20 text-sm italic">
                        {t('deckBuilder.emptyState')}
                    </div>
                )}
            </div>

            {/* 底部操作区 */}
            <div className="p-3 border-t border-white/10 bg-black/40 space-y-2">
                {/* 保存牌组 - 移到最上面 */}
                <input
                    type="text"
                    value={deckName}
                    onChange={e => setDeckName(e.target.value)}
                    placeholder={t('deckBuilder.placeholderName')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                />
                <GameButton
                    variant="primary"
                    fullWidth
                    onClick={handleSave}
                    disabled={!validationResult.valid || !deckName || isSaving}
                >
                    {isSaving ? t('deckBuilder.saving', '保存中...') : t('deckBuilder.save')}
                </GameButton>

                {/* 使用此牌组 */}
                {onConfirm && (
                    <GameButton
                        variant="secondary"
                        fullWidth
                        onClick={onConfirm}
                        disabled={!validationResult.valid || !currentDeck.summoner}
                    >
                        {t('deckBuilder.useDeck')}
                    </GameButton>
                )}

                {/* 已保存牌组（最多显示 5 个） */}
                {savedDecks.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                        <div className="text-[10px] text-white/30 uppercase mb-1">{t('deckBuilder.savedDecks')}</div>
                        <div className="space-y-1 max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {savedDecks.slice(0, 5).map(deck => (
                                <div key={deck.id} className="flex items-center justify-between group text-xs text-white/70 hover:bg-white/5 px-2 py-1 rounded">
                                    <span className="truncate flex items-center gap-1 flex-1 cursor-pointer" onClick={() => onLoad(deck.id)}>
                                        {deck.name}
                                        {deck.freeMode && <span className="text-[9px] text-amber-400/70 bg-amber-500/10 px-1 rounded">{t('deckBuilder.free', '自由')}</span>}
                                    </span>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {/* 使用按钮 */}
                                        {onSelectSavedDeck && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectSavedDeck(deck.id);
                                                }}
                                                className="text-[10px] text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                                                title={t('deckBuilder.useDeck')}
                                            >
                                                {t('deckBuilder.use', '使用')}
                                            </button>
                                        )}
                                        {/* 删除按钮 */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete(deck.id); }}
                                            className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title={t('deckBuilder.delete', '删除')}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {savedDecks.length > 5 && (
                                <div className="text-[10px] text-white/20 text-center py-1">
                                    {t('deckBuilder.showingFirst', '显示前 5 个牌组')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

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


/** 牌组中的卡牌瓦片（卡图 + 数量角标） */
interface DeckCardTileProps {
    card: Card;
    count: number;
    isLocked?: boolean;
    onRemove?: () => void;
    onMagnify?: (card: Card) => void;
}

const DeckCardTile: React.FC<DeckCardTileProps> = ({ card, count, isLocked, onRemove, onMagnify }) => {
    const sprite = getCardSpriteConfig(card);

    return (
        <div
            className="relative group rounded-md overflow-hidden border border-white/10 hover:border-amber-400/50 cursor-pointer transition-all duration-150"
            onClick={() => onMagnify?.(card)}
        >
            {/* 卡牌精灵图 */}
            <CardSprite
                atlasId={sprite.atlasId}
                frameIndex={sprite.frameIndex}
                className="w-full"
            />

            {/* 数量角标 */}
            {count > 1 && (
                <div className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center px-1 shadow">
                    x{count}
                </div>
            )}

            {/* 卡牌名称 */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-0.5 pt-3 pointer-events-none">
                <div className="text-[9px] text-white leading-tight truncate font-medium">{card.name}</div>
            </div>

            {/* 移除按钮（hover 时显示） */}
            {!isLocked && onRemove && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-red-600/80 hover:bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                    -
                </button>
            )}
        </div>
    );
};
