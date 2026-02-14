/**
 * 弃牌堆出牌横排组件
 *
 * 统一的"从弃牌堆选随从打到基地"UI：
 * - 屏幕上方弹出一排可选随从卡（复用 PromptOverlay 卡牌展示样式）
 * - 可打出的卡高亮可选，选中后点场上基地出牌
 * - 支持两种模式：
 *   1. 正常弃牌堆出牌（discardPlayOptions 驱动）
 *   2. interaction 驱动（僵尸领主等，currentPrompt 驱动）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GameButton } from './GameButton';
import { CardMagnifyOverlay, type CardMagnifyTarget } from './CardMagnifyOverlay';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { getCardDef, resolveCardName } from '../data/cards';
import { UI_Z_INDEX } from '../../../core';

export interface DiscardPlayCard {
    uid: string;
    defId: string;
    label: string;
    /** interaction 模式下的 optionId */
    optionId?: string;
    /** interaction 模式下的 option value（用于 mergedValue） */
    optionValue?: unknown;
}

interface Props {
    /** 标题文本 */
    title: string;
    /** 可选的卡牌列表 */
    cards: DiscardPlayCard[];
    /** 当前选中的卡牌 uid */
    selectedUid: string | null;
    /** 选中卡牌回调 */
    onSelect: (uid: string | null) => void;
    /** 取消/完成按钮文本（不传则不显示） */
    cancelLabel?: string;
    /** 取消/完成回调 */
    onCancel?: () => void;
}

/** 鼠标滚轮转水平滚动 */
function useWheelToHScroll() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);
    return ref;
}

export const DiscardPlayStrip: React.FC<Props> = ({ title, cards, selectedUid, onSelect, cancelLabel, onCancel }) => {
    const { t } = useTranslation('game-smashup');
    const scrollRef = useWheelToHScroll();
    const [magnifyTarget, setMagnifyTarget] = useState<CardMagnifyTarget | null>(null);

    return (
        <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-0 inset-x-0 flex flex-col items-center pt-4 pb-3 pointer-events-auto"
            style={{ zIndex: UI_Z_INDEX.overlay, background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.5) 80%, transparent 100%)' }}
        >
            {/* 标题 */}
            <h2 className="text-base font-black text-amber-100 uppercase tracking-tight mb-3 drop-shadow-lg">
                {title}
            </h2>

            {/* 卡牌横排 */}
            <div ref={scrollRef} className="flex gap-3 overflow-x-auto max-w-[90vw] px-6 py-2 smashup-h-scrollbar">
                {cards.map((card, idx) => {
                    const def = getCardDef(card.defId);
                    const name = def ? resolveCardName(def, t) : card.label;
                    const isSelected = card.uid === selectedUid;

                    return (
                        <motion.div
                            key={card.uid}
                            initial={{ y: 30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
                            onClick={() => onSelect(isSelected ? null : card.uid)}
                            className={`
                                flex-shrink-0 cursor-pointer relative group
                                ${isSelected ? 'scale-110 z-10' : 'hover:scale-105 hover:z-10'}
                            `}
                            style={{ transition: 'transform 200ms, box-shadow 200ms' }}
                        >
                            <div className={`
                                rounded shadow-xl overflow-hidden
                                ${isSelected
                                    ? 'ring-3 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]'
                                    : 'ring-1 ring-white/20 group-hover:ring-white/50 group-hover:shadow-2xl'}
                            `}>
                                {def?.previewRef ? (
                                    <CardPreview
                                        previewRef={def.previewRef}
                                        className="w-[110px] aspect-[0.714] bg-slate-900 rounded"
                                    />
                                ) : (
                                    <div className="w-[110px] aspect-[0.714] bg-slate-800 rounded flex items-center justify-center p-2">
                                        <span className="text-white text-xs font-bold text-center">{name}</span>
                                    </div>
                                )}
                            </div>
                            <div className={`mt-1 text-center text-[10px] font-bold truncate max-w-[110px] ${isSelected ? 'text-amber-300' : 'text-white/70'}`}>
                                {name}
                            </div>
                            {/* 放大镜 */}
                            <button
                                className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white p-0.5 rounded-full border border-white shadow-md hover:bg-blue-600 hover:scale-110 cursor-zoom-in z-20"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMagnifyTarget({ defId: card.defId, type: def?.type ?? 'minion' });
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            </button>
                        </motion.div>
                    );
                })}
            </div>

            {/* 提示 + 取消按钮 */}
            <div className="flex items-center gap-3 mt-2">
                {selectedUid && (
                    <span className="text-xs text-amber-200/80 font-bold animate-pulse">
                        {t('ui.click_base_to_deploy', { defaultValue: '点击基地放置随从' })}
                    </span>
                )}
                {cancelLabel && onCancel && (
                    <GameButton variant="secondary" size="sm" onClick={onCancel}>
                        {cancelLabel}
                    </GameButton>
                )}
            </div>

            <CardMagnifyOverlay target={magnifyTarget} onClose={() => setMagnifyTarget(null)} />
        </motion.div>
    );
};
