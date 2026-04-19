/**
 * 通用卡牌列表浮层
 * 
 * 统一处理所有游戏的卡牌横向滚动展示/选择场景：
 * - 弃牌堆查看
 * - 卡牌选择交互
 * - 手牌展示
 * 
 * 特性：
 * - 横向滚动（滚轮转换，禁用拖拽避免点击冲突）
 * - 单选/多选模式
 * - 纯查看模式
 * - 点击放大预览
 */

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UI_Z_INDEX } from '../../../core';
import { useHorizontalDragScroll } from '../../../hooks/ui/useHorizontalDragScroll';

export interface CardListItem {
  /** 唯一标识 */
  id: string;
  /** 渲染内容（卡牌预览组件） */
  content: React.ReactNode;
  /** 卡牌名称（用于 hover 提示） */
  name?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

export interface CardListOverlayProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 标题 */
  title: string;
  /** 卡牌列表 */
  cards: CardListItem[];
  
  /** 选择模式 */
  mode?: 'view' | 'single' | 'multi';
  /** 当前选中的卡牌 ID（单选） */
  selectedId?: string | null;
  /** 当前选中的卡牌 ID 列表（多选） */
  selectedIds?: string[];
  /** 选择回调 */
  onSelect?: (id: string | null) => void;
  /** 多选回调 */
  onSelectMulti?: (ids: string[]) => void;
  
  /** 点击卡牌放大回调 */
  onMagnify?: (id: string) => void;
  /** 选中提示文本 */
  selectHint?: string;
  
  /** 布局模式 */
  layout?: 'fullscreen' | 'bottom-panel';
  /** 卡牌尺寸 */
  cardSize?: 'sm' | 'md' | 'lg';
  
  /** 自定义样式类名 */
  className?: string;
  /** 自定义容器样式类名 */
  containerClassName?: string;
}

const CARD_SIZES = {
  sm: 'w-[100px]',
  md: 'w-[130px]',
  lg: 'w-[180px]',
};

export const CardListOverlay: React.FC<CardListOverlayProps> = ({
  isOpen,
  onClose,
  title,
  cards,
  mode = 'view',
  selectedId,
  selectedIds = [],
  onSelect,
  onSelectMulti,
  onMagnify,
  selectHint,
  layout = 'fullscreen',
  cardSize = 'md',
  className = '',
  containerClassName = '',
}) => {
  const { ref: scrollRef } = useHorizontalDragScroll();
  
  const handleCardClick = useCallback((id: string, disabled?: boolean) => {
    if (disabled) return;
    
    if (mode === 'single' && onSelect) {
      onSelect(selectedId === id ? null : id);
    } else if (mode === 'multi' && onSelectMulti) {
      const newIds = selectedIds.includes(id)
        ? selectedIds.filter(sid => sid !== id)
        : [...selectedIds, id];
      onSelectMulti(newIds);
    } else if (mode === 'view' && onMagnify) {
      onMagnify(id);
    }
  }, [mode, selectedId, selectedIds, onSelect, onSelectMulti, onMagnify]);
  
  const isSelected = useCallback((id: string) => {
    if (mode === 'single') return selectedId === id;
    if (mode === 'multi') return selectedIds.includes(id);
    return false;
  }, [mode, selectedId, selectedIds]);
  
  if (!isOpen) return null;
  
  // 全屏模式
  if (layout === 'fullscreen') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm ${className}`}
          style={{ zIndex: UI_Z_INDEX.overlayRaised }}
          onClick={onClose}
        >
          <h2 className="text-3xl text-white font-bold mb-6 drop-shadow-lg" onClick={(e) => e.stopPropagation()}>
            {title}
          </h2>
          
          <div className={`w-full max-w-[90vw] px-4 ${containerClassName}`} onClick={(e) => e.stopPropagation()}>
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto py-8 px-8 scrollbar-hide w-full"
              style={{ scrollBehavior: 'smooth' }}
            >
              {cards.map((card, idx) => {
                const selected = isSelected(card.id);
                return (
                  <motion.div
                    key={card.id}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
                    onClick={() => handleCardClick(card.id, card.disabled)}
                    className={`
                      flex-shrink-0 cursor-pointer relative group
                      ${CARD_SIZES[cardSize]}
                      ${card.disabled ? 'opacity-40 cursor-not-allowed' : ''}
                      ${selected ? 'scale-110 z-10' : 'hover:scale-105'}
                    `}
                    style={{ transition: 'transform 200ms' }}
                  >
                    <div className={`
                      rounded shadow-xl overflow-hidden
                      ${selected ? 'ring-4 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]' : 'ring-1 ring-white/20 group-hover:ring-white/50'}
                    `}>
                      {card.content}
                    </div>
                    {card.name && (
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full bg-black/80 text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {card.name}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
          
          {selectHint && (selectedId || selectedIds.length > 0) && (
            <div className="mt-4 text-amber-200 text-sm font-bold animate-pulse" onClick={(e) => e.stopPropagation()}>
              {selectHint}
            </div>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="mt-8 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            关闭
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }
  
  // 底部面板模式
  return (
    <AnimatePresence>
      <motion.div
        key="card-list-bottom"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`fixed bottom-0 inset-x-0 pointer-events-none ${className}`}
        style={{ zIndex: UI_Z_INDEX.overlay }}
      >
        <div className={`pointer-events-auto bg-gradient-to-t from-black/90 via-black/75 to-transparent pt-8 pb-4 px-4 ${containerClassName}`}>
          <h2 className="text-center text-lg font-bold text-white uppercase tracking-tight mb-3">
            {title}
          </h2>
          
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto max-w-[90vw] mx-auto px-4 py-2 scrollbar-hide justify-center"
            style={{ scrollBehavior: 'smooth' }}
          >
            {cards.map((card, idx) => {
              const selected = isSelected(card.id);
              return (
                <motion.div
                  key={card.id}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
                  onClick={() => handleCardClick(card.id, card.disabled)}
                  className={`
                    flex-shrink-0 cursor-pointer relative group
                    ${CARD_SIZES[cardSize]}
                    ${card.disabled ? 'opacity-40 cursor-not-allowed' : ''}
                    ${selected ? 'scale-110 z-10' : 'hover:scale-105'}
                  `}
                  style={{ transition: 'transform 200ms' }}
                >
                  <div className={`
                    rounded shadow-xl overflow-hidden
                    ${selected ? 'ring-3 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]' : 'ring-1 ring-white/20 group-hover:ring-white/50'}
                  `}>
                    {card.content}
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {selectHint && (selectedId || selectedIds.length > 0) && (
            <div className="text-center mt-3 text-amber-200 text-sm font-bold animate-pulse">
              {selectHint}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
