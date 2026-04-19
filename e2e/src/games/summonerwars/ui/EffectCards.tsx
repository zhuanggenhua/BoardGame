/**
 * 召唤师战争 - 持续效果卡牌组件
 * 半隐藏显示，鼠标悬停展开完整卡牌
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CardSprite } from './CardSprite';

export interface EffectCard {
  id: string;
  name: string;
  atlasId: string;
  frameIndex: number;
}

export interface EffectCardsProps {
  /** 效果卡牌列表 */
  cards: EffectCard[];
  /** 是否为对手 */
  isOpponent?: boolean;
  /** 位置 */
  position: 'left' | 'right';
  /** 额外类名 */
  className?: string;
}

/** 单个效果卡牌（半隐藏，悬停展开） */
const EffectCardItem: React.FC<{
  card: EffectCard;
  position: 'left' | 'right';
  index: number;
}> = ({ card, position, index }) => {
  const [isHovered, setIsHovered] = useState(false);

  // 半隐藏偏移
  const hiddenOffset = position === 'left' ? '-60%' : '60%';

  return (
    <motion.div
      className="relative"
      style={{ marginTop: index > 0 ? '-2rem' : 0 }}
      initial={{ x: hiddenOffset }}
      animate={{ x: isHovered ? 0 : hiddenOffset }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-16 cursor-pointer">
        <CardSprite
          atlasId={card.atlasId}
          frameIndex={card.frameIndex}
          className="rounded shadow-lg border border-white/20"
          style={{ width: '100%' }}
        />
        {/* 名称标签 */}
        {isHovered && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs text-center py-0.5 rounded-b">
            {card.name}
          </div>
        )}
      </div>
    </motion.div>
  );
};

/** 持续效果卡牌列表 */
export const EffectCards: React.FC<EffectCardsProps> = ({
  cards,
  isOpponent = false,
  position,
  className = '',
}) => {
  const { t } = useTranslation('game-summonerwars');
  if (cards.length === 0) return null;

  return (
    <div
      className={`
        absolute ${position === 'left' ? 'left-0' : 'right-0'}
        ${isOpponent ? 'top-16' : 'top-1/3'}
        flex flex-col
        ${className}
      `}
    >
      <span className="text-xs text-white/60 mb-1 px-1">
        {isOpponent ? t('ui.opponentActiveEvents') : t('ui.activeEvents')}
      </span>
      {cards.map((card, index) => (
        <EffectCardItem
          key={card.id}
          card={card}
          position={position}
          index={index}
        />
      ))}
    </div>
  );
};

export default EffectCards;
