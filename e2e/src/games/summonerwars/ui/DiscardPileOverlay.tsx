/**
 * 召唤师战争 - 弃牌堆查看浮层
 * 
 * 点击弃牌堆后展示所有弃置的卡牌（只读浏览，不可选择）
 * 卡牌按从新到旧排列（最近弃置的在最左边）
 * 卡牌尺寸比 CardSelectorOverlay 放大一倍
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '../domain/types';
import { CardSprite } from './CardSprite';
import { GameButton } from './GameButton';
import { resolveCardAtlasId } from './cardAtlas';
import { UI_Z_INDEX } from '../../../core';
import { useHorizontalDragScroll } from '../../../hooks/ui/useHorizontalDragScroll';

/** 获取卡牌精灵图配置 */
function getCardAtlasConfig(card: Card): { atlasId: string; frameIndex: number } {
  const spriteIndex = card.spriteIndex ?? 0;
  const spriteAtlas = card.spriteAtlas ?? 'cards';
  if (spriteAtlas === 'portal') {
    return { atlasId: 'sw:portal', frameIndex: spriteIndex };
  }
  const atlasId = resolveCardAtlasId(card as { id: string; faction?: string }, spriteAtlas as 'hero' | 'cards');
  return { atlasId, frameIndex: spriteIndex };
}

interface DiscardPileOverlayProps {
  /** 弃牌堆卡牌列表（从旧到新） */
  cards: Card[];
  /** 关闭回调 */
  onClose: () => void;
  /** 点击卡牌放大预览 */
  onMagnify?: (card: Card) => void;
}

export const DiscardPileOverlay: React.FC<DiscardPileOverlayProps> = ({
  cards,
  onClose,
  onMagnify,
}) => {
  const { t } = useTranslation('game-summonerwars');
  const { ref: scrollRef, dragProps } = useHorizontalDragScroll();

  // 反转为从新到旧
  const reversed = [...cards].reverse();

  if (reversed.length === 0) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        style={{ zIndex: UI_Z_INDEX.overlayRaised }}
        onClick={onClose}
      >
        <div className="bg-slate-800 p-8 rounded-xl border border-slate-600 shadow-2xl text-center max-w-sm mx-4">
          <h3 className="text-xl text-white font-bold mb-4">{t('discardPile.title')}</h3>
          <p className="text-slate-300 mb-6">{t('discardPile.empty')}</p>
          <GameButton onClick={onClose} variant="secondary">
            {t('actions.close')}
          </GameButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
      style={{ zIndex: UI_Z_INDEX.overlayRaised }}
      onClick={onClose}
      data-testid="sw-discard-pile-overlay"
    >
      <div onClick={(e) => e.stopPropagation()}>
        {/* 标题 + 数量 */}
        <h2 className="text-3xl text-amber-100 font-bold mb-6 drop-shadow-lg tracking-wider text-center">
          {t('discardPile.titleWithCount', { count: cards.length })}
        </h2>

        {/* 卡牌展示区域 */}
        <div className="w-full max-w-[90vw] px-4 relative flex items-center justify-center">
          {/* 左渐变遮罩（多张卡时显示） */}
          {reversed.length > 1 && (
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black/80 to-transparent pointer-events-none z-20" />
          )}

          {/* 卡牌列表 */}
          <div
            ref={scrollRef}
            className="flex gap-8 overflow-x-auto py-8 px-8 snap-x snap-mandatory scrollbar-hide w-full relative"
            style={{ scrollBehavior: 'smooth', overflowY: 'hidden' }}
          >
            {reversed.map((card, idx) => {
              const { atlasId, frameIndex } = getCardAtlasConfig(card);
              return (
                <div
                  key={`${card.id}-${idx}`}
                  className="flex-shrink-0 snap-center cursor-pointer relative group transition-transform duration-200 hover:scale-105"
                  onClick={() => onMagnify?.(card)}
                >
                  <div className="rounded-lg shadow-2xl group-hover:ring-2 group-hover:ring-white/50 transition-all duration-200">
                    <CardSprite
                      atlasId={atlasId}
                      frameIndex={frameIndex}
                      className="w-[440px] rounded-lg bg-slate-900"
                    />
                  </div>
                  {/* 卡牌名称 */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full bg-black/80 text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    {card.name}
                  </div>
                  {/* 序号标记（最近弃置） */}
                  {idx === 0 && reversed.length > 1 && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-500/90 text-white text-xs font-bold shadow pointer-events-none">
                      {t('discardPile.latest')}
                    </div>
                  )}
                </div>
              );
            })}
            {/* 尾部占位（多张卡时显示） */}
            {reversed.length > 1 && <div className="w-[calc(50%-220px)] flex-shrink-0" />}
          </div>

          {/* 右渐变遮罩（多张卡时显示） */}
          {reversed.length > 1 && (
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/80 to-transparent pointer-events-none z-20" />
          )}
        </div>

        {/* 关闭按钮 */}
        <div className="mt-8 text-center">
          <GameButton onClick={onClose} variant="secondary" size="lg">
            {t('actions.close')}
          </GameButton>
        </div>
      </div>
    </div>
  );
};
