/**
 * 召唤师战争 - 牌堆组件
 * 
 * 抽牌堆（draw）：显示卡背的一半，保持原有样式
 * 弃牌堆（discard）：显示最近弃置的卡牌正面（半露），点击可查看全部弃牌
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { CardSprite } from './CardSprite';
import type { Card } from '../domain/types';
import { resolveCardAtlasId } from './cardAtlas';

export interface DeckPileProps {
  /** 牌堆类型 */
  type: 'draw' | 'discard';
  /** 牌数量 */
  count: number;
  /** 位置：left 显示右半边，right 显示左半边 */
  position: 'left' | 'right';
  /** 弃牌堆最顶部的卡牌（仅 discard 类型使用） */
  topCard?: Card | null;
  /** 点击回调（弃牌堆点击查看全部） */
  onClick?: () => void;
  /** 测试标识 */
  testId?: string;
  /** 额外类名 */
  className?: string;
}

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

/** 牌堆组件 */
export const DeckPile: React.FC<DeckPileProps> = ({
  type,
  count,
  position,
  topCard,
  onClick,
  testId,
  className = '',
}) => {
  const { t } = useTranslation('game-summonerwars');
  const label = type === 'draw' ? t('deckPile.draw') : t('deckPile.discard');
  const isDiscard = type === 'discard';
  const hasTopCard = isDiscard && topCard;
  const isClickable = isDiscard && count > 0;

  // 横向卡牌尺寸（保持原图比例 3:2）
  const cardWidth = 180;
  const cardHeight = 120;
  const visibleWidth = cardWidth / 2; // 显示一半 = 90px

  // position="left": 显示右半边（卡牌向左偏移）
  // position="right": 显示左半边（卡牌不偏移）
  const cardLeft = position === 'left' ? -visibleWidth : 0;

  return (
    <div
      className={`relative overflow-hidden group ${isClickable ? 'cursor-pointer' : ''} ${className}`}
      data-testid={testId}
      onClick={isClickable ? onClick : undefined}
      style={{
        width: `${visibleWidth}px`,
        height: `${cardHeight}px`,
      }}
    >
      {/* 卡牌内容 */}
      <div
        className="absolute rounded-md shadow-xl border-2 border-slate-500/70 overflow-hidden"
        style={{
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
          left: `${cardLeft}px`,
          top: 0,
        }}
      >
        {hasTopCard ? (
          /* 弃牌堆：显示最顶部卡牌正面 */
          <CardSprite
            atlasId={getCardAtlasConfig(topCard).atlasId}
            frameIndex={getCardAtlasConfig(topCard).frameIndex}
            className="w-full h-full"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          /* 抽牌堆 / 空弃牌堆：显示卡背 */
          <OptimizedImage
            src="summonerwars/common/cardback.png"
            alt={t('deckPile.cardBackAlt')}
            className="w-full h-full object-cover"
            draggable={false}
          />
        )}
      </div>

      {/* 叠加层：数量 + 标签 */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center z-10"
        style={{ pointerEvents: 'none' }}
      >
        {/* 数量圆圈 */}
        <div className="w-10 h-10 rounded-full bg-black/85 border-2 border-amber-500/80 flex items-center justify-center mb-1.5 shadow-lg">
          <span className="text-lg font-bold text-white">
            {count}
          </span>
        </div>
        {/* 标签 */}
        <span className="text-xs text-white font-medium bg-black/75 px-2 py-1 rounded shadow">
          {label}
        </span>
      </div>

      {/* 弃牌堆 hover 提示：点击查看 */}
      {isClickable && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-[background-color] duration-200 z-20 flex items-center justify-center pointer-events-none">
          <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/60 px-2 py-1 rounded">
            {t('deckPile.view')}
          </span>
        </div>
      )}
    </div>
  );
};

export default DeckPile;
