/**
 * 召唤师战争 - 牌堆组件
 * 显示卡背的一半，数字和标签叠加在可见区域内
 * 
 * 设计：卡背原图是横向的，我们直接横向显示（不旋转）
 * 显示卡牌的一半边缘，给人"牌堆"的感觉
 */

import React from 'react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

export interface DeckPileProps {
  /** 牌堆类型 */
  type: 'draw' | 'discard';
  /** 牌数量 */
  count: number;
  /** 位置：left 显示右半边，right 显示左半边 */
  position: 'left' | 'right';
  /** 测试标识 */
  testId?: string;
  /** 额外类名 */
  className?: string;
}

/** 牌堆组件 */
export const DeckPile: React.FC<DeckPileProps> = ({
  type,
  count,
  position,
  testId,
  className = '',
}) => {
  const label = type === 'draw' ? '牌库' : '弃牌';
  
  // 横向卡牌尺寸（保持原图比例 3:2）- 放大以便看清
  const cardWidth = 180;  // px
  const cardHeight = 120;  // px
  const visibleWidth = cardWidth / 2; // 显示一半 = 90px

  // position="left": 显示右半边（卡牌向左偏移）
  // position="right": 显示左半边（卡牌不偏移）
  const cardLeft = position === 'left' ? -visibleWidth : 0;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      data-testid={testId}
      style={{
        width: `${visibleWidth}px`,
        height: `${cardHeight}px`,
      }}
    >
      {/* 卡背图片 - 使用 OptimizedImage */}
      <div
        className="absolute rounded-md shadow-xl border-2 border-slate-500/70 overflow-hidden"
        style={{
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
          left: `${cardLeft}px`,
          top: 0,
        }}
      >
        <OptimizedImage
          src="summonerwars/common/cardback.png"
          alt="card back"
          className="w-full h-full object-cover"
          draggable={false}
        />
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
    </div>
  );
};

export default DeckPile;
