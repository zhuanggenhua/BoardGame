/**
 * 牌组构建抽屉组件
 *
 * 从屏幕底部向上滑出的抽屉面板，包含三栏布局：
 * - 左侧：阵营列表（FactionPanel）
 * - 中间：卡牌池（CardPoolPanel）
 * - 右侧：我的牌组（MyDeckPanel）
 *
 * 支持通过 onConfirm 回调将确认的牌组数据传递给父组件（用于对局选择）。
 */

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useDeckBuilder } from './deckbuilder/useDeckBuilder';
import { FactionPanel } from './deckbuilder/FactionPanel';
import { CardPoolPanel } from './deckbuilder/CardPoolPanel';
import { MyDeckPanel } from './deckbuilder/MyDeckPanel';
import { serializeDeck, type SerializedCustomDeck } from '../config/deckSerializer';
import { UI_Z_INDEX } from '../../../core';

interface DeckBuilderDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    /** 确认使用牌组的回调，传递序列化后的牌组数据 */
    onConfirm?: (deck: SerializedCustomDeck) => void;
    currentPlayerId: string;
    /** 编辑模式：传入牌组 ID 时自动加载该牌组 */
    initialDeckId?: string;
    /** 牌组保存后的回调（用于刷新父组件的牌组列表） */
    onDeckSaved?: () => void;
}

export const DeckBuilderDrawer: React.FC<DeckBuilderDrawerProps> = ({
    isOpen,
    onClose,
    onConfirm,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentPlayerId,
    initialDeckId,
    onDeckSaved,
}) => {
    const { t } = useTranslation('game-summonerwars');
    const deckBuilder = useDeckBuilder({ onDeckSaved });
    const {
        currentDeck,
        selectedFactionId,
        validationResult,
        savedDecks,
        freeMode,
        selectSummoner,
        addCard,
        removeCard,
        selectFaction,
        toggleFreeMode,
        saveDeck,
        loadDeck,
        deleteDeck,
        resetDeck,
    } = deckBuilder;
    
    // 编辑模式：打开抽屉时自动加载指定牌组
    React.useEffect(() => {
        if (isOpen && initialDeckId) {
            // 加载指定的牌组
            void loadDeck(initialDeckId);
        } else if (isOpen && !initialDeckId) {
            // 新建模式：重置牌组
            resetDeck();
        }
    }, [isOpen, initialDeckId, loadDeck, resetDeck]);

    /**
     * 确认使用当前编辑中的牌组
     * 将当前 DeckDraft 序列化后通过 onConfirm 回调传递给父组件，并关闭抽屉
     */
    const handleConfirmDeck = useCallback(() => {
        if (!onConfirm) return;
        if (!currentDeck.summoner || !validationResult.valid) return;

        try {
            const serialized = serializeDeck(currentDeck);
            onConfirm(serialized);
            onClose();
        } catch (err) {
            console.warn('[DeckBuilderDrawer] 序列化牌组失败:', err);
        }
    }, [onConfirm, onClose, currentDeck, validationResult]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* 背景遮罩 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        style={{ zIndex: UI_Z_INDEX.overlay }}
                    />

                    {/* 抽屉主体 */}
                    <motion.div
                        data-testid="deck-builder-drawer"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-x-0 bottom-0 h-[85vh] bg-[#0d1117] rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] border-t border-white/10 flex flex-col overflow-hidden"
                        style={{ zIndex: UI_Z_INDEX.overlayRaised }}
                    >
                        {/* 隐藏的测试 ID（用于 E2E 测试验证编辑模式） */}
                        {initialDeckId && (
                            <div data-testid="editing-deck-id" className="hidden">
                                {initialDeckId}
                            </div>
                        )}
                        
                        {/* 头部栏 */}
                        <div className="h-12 border-b border-white/10 flex items-center justify-between px-6 bg-gradient-to-r from-amber-900/20 to-transparent">
                            <div className="flex items-center gap-3">
                                <h1 className="text-amber-400 font-black tracking-[0.2em] uppercase text-lg">
                                    {t('deckBuilder.title')}
                                </h1>
                                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-500/30 uppercase tracking-widest font-bold">
                                    {t('deckBuilder.beta')}
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                    <path
                                        fillRule="evenodd"
                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* 主要内容（三栏布局） */}
                        <div className="flex-1 flex overflow-hidden">
                            <FactionPanel
                                selectedFactionId={selectedFactionId}
                                onSelect={selectFaction}
                            />

                            <CardPoolPanel
                                factionId={selectedFactionId}
                                currentDeck={currentDeck}
                                onAddCard={addCard}
                                onSelectSummoner={selectSummoner}
                            />

                            <MyDeckPanel
                                currentDeck={currentDeck}
                                validationResult={validationResult}
                                savedDecks={savedDecks}
                                freeMode={freeMode}
                                onToggleFreeMode={toggleFreeMode}
                                onRemoveCard={removeCard}
                                onSave={saveDeck}
                                onLoad={loadDeck}
                                onDelete={deleteDeck}
                                onConfirm={onConfirm ? handleConfirmDeck : undefined}
                            />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
