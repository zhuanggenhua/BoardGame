/**
 * 召唤师战争 - 手牌区组件
 * 
 * 底部展示玩家手牌，支持：
 * - 点击选中卡牌
 * - 悬停上移预览
 * - 精灵图渲染
 * - 放大镜按钮预览卡牌
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Card, UnitCard, EventCard, StructureCard, GamePhase } from '../domain/types';
import { CardSprite } from './CardSprite';
import { useToast } from '../../../contexts/ToastContext';

/** 放大镜图标 */
const MagnifyIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);

interface HandAreaProps {
  cards: Card[];
  phase: GamePhase;
  isMyTurn: boolean;
  currentMagic: number;
  selectedCardId?: string | null;
  selectedCardIds?: string[];
  onCardClick?: (cardId: string) => void;
  onCardSelect?: (cardId: string | null) => void;
  onMagnifyCard?: (card: Card) => void;
  className?: string;
}

function getCardCost(card: Card): number {
  if (card.cardType === 'unit') return (card as UnitCard).cost;
  if (card.cardType === 'event') return (card as EventCard).cost;
  if (card.cardType === 'structure') return (card as StructureCard).cost;
  return 0;
}

function getCardSpriteConfig(card: Card): { atlasId: string; frameIndex: number } | null {
  const spriteIndex = 'spriteIndex' in card ? card.spriteIndex : undefined;
  const spriteAtlas = 'spriteAtlas' in card ? card.spriteAtlas : undefined;
  
  if (spriteIndex === undefined) return null;
  
  const atlasId = spriteAtlas === 'hero' 
    ? 'sw:necromancer:hero' 
    : 'sw:necromancer:cards';
  
  return { atlasId, frameIndex: spriteIndex };
}

// 卡牌宽度（使用vw单位）
const CARD_WIDTH_VW = 16; // 16vw

const HandCard: React.FC<{
  card: Card;
  index: number;
  totalCards: number;
  isSelected: boolean;
  canAfford: boolean;
  canPlay: boolean;
  onClick?: () => void;
  onMagnify?: () => void;
}> = ({
  card,
  index,
  totalCards,
  isSelected,
  canAfford,
  canPlay,
  onClick,
  onMagnify,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const spriteConfig = getCardSpriteConfig(card);
  
  // 卡牌间距（使用vw单位，进一步缩小间距）
  const cardSpacingVw = totalCards > 6 ? -6 : totalCards > 4 ? -5.5 : -5;
  
  const handleMagnifyClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMagnify?.();
  }, [onMagnify]);
  
  return (
    <motion.div
      className="relative cursor-pointer select-none group"
      data-card-id={card.id}
      data-card-type={card.cardType}
      data-card-name={card.name}
      data-card-cost={getCardCost(card)}
      data-selected={isSelected ? 'true' : 'false'}
      data-can-afford={canAfford ? 'true' : 'false'}
      data-can-play={canPlay ? 'true' : 'false'}
      style={{
        width: `${CARD_WIDTH_VW}vw`,
        marginLeft: index === 0 ? 0 : `${cardSpacingVw}vw`,
        zIndex: isSelected ? 100 : isHovered ? 50 : index,
      }}
      initial={false}
      animate={{
        y: isSelected ? -30 : isHovered ? -20 : 0,
        scale: isHovered ? 1.08 : 1,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div
        className={`
          relative w-full rounded-lg overflow-hidden
          border-2 transition-all duration-150
          ${isSelected 
            ? 'border-amber-400 shadow-lg shadow-amber-400/60 ring-2 ring-amber-400/30' 
            : canPlay
              ? 'border-green-400/80 hover:border-green-300 shadow-md shadow-green-400/30'
              : canAfford 
                ? 'border-slate-500/80 hover:border-slate-400' 
                : 'border-slate-700/60'
          }
          cursor-pointer
          ${!canAfford ? 'grayscale' : ''}
        `}
      >
        {spriteConfig ? (
          <CardSprite
            atlasId={spriteConfig.atlasId}
            frameIndex={spriteConfig.frameIndex}
            className="w-full"
          />
        ) : (
          <div className="w-full aspect-[1044/729] bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
            <span className="text-slate-400 text-sm">{card.name}</span>
          </div>
        )}
        
        {isSelected && (
          <div className="absolute inset-0 bg-amber-400/15 pointer-events-none" />
        )}
        
        {/* 放大镜按钮 */}
        <button
          onClick={handleMagnifyClick}
          className="absolute top-[0.3vw] right-[0.3vw] w-[1.8vw] h-[1.8vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-200 shadow-lg border border-white/20 z-20"
        >
          <MagnifyIcon className="w-[1vw] h-[1vw]" />
        </button>
      </div>
    </motion.div>
  );
};

export const HandArea: React.FC<HandAreaProps> = ({
  cards,
  phase,
  isMyTurn,
  currentMagic,
  selectedCardId,
  selectedCardIds = [],
  onCardClick,
  onCardSelect,
  onMagnifyCard,
  className = '',
}) => {
  const showToast = useToast();
  
  const canPlayCard = useCallback((card: Card): boolean => {
    if (!isMyTurn) return false;
    const cost = getCardCost(card);
    if (cost > currentMagic) return false;
    if (phase === 'summon' && card.cardType === 'unit') return true;
    if (phase === 'build' && card.cardType === 'structure') return true;
    if (card.cardType === 'event') {
      const event = card as EventCard;
      return event.playPhase === phase || event.playPhase === 'any';
    }
    if (phase === 'magic') return true;
    return false;
  }, [phase, isMyTurn, currentMagic]);
  
  const handleCardClick = useCallback((cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    
    const cost = getCardCost(card);
    const canAfford = cost <= currentMagic;
    
    // 检查是否可以支付费用
    if (!canAfford) {
      showToast.warning(`魔力不足！需要 ${cost} 魔力，当前只有 ${currentMagic} 魔力`);
      return;
    }
    
    if (phase === 'magic' && isMyTurn) {
      onCardClick?.(cardId);
      return;
    }
    
    if ((phase === 'summon' || phase === 'build') && isMyTurn) {
      const canPlay = canPlayCard(card);
      if (canPlay) {
        if (selectedCardId === cardId) {
          onCardSelect?.(null);
        } else {
          onCardSelect?.(cardId);
        }
      } else {
        // 提示为什么不能打出
        if (phase === 'summon' && card.cardType !== 'unit') {
          showToast.warning('召唤阶段只能打出单位卡');
        } else if (phase === 'build' && card.cardType !== 'structure') {
          showToast.warning('建造阶段只能打出建筑卡');
        }
      }
      return;
    }
    
    if (!isMyTurn) {
      showToast.warning('等待对手行动...');
      return;
    }
    
    onCardClick?.(cardId);
  }, [cards, phase, isMyTurn, currentMagic, selectedCardId, onCardClick, onCardSelect, canPlayCard, showToast]);
  
  if (cards.length === 0) {
    return null;
  }
  
  return (
    <div
      className={`relative flex items-end justify-center ${className}`}
      data-testid="sw-hand-area"
    >
      <div className="flex items-end">
        <AnimatePresence>
          {cards.map((card, index) => {
            const canAfford = getCardCost(card) <= currentMagic;
            const canPlay = canPlayCard(card);
            const isSelected = selectedCardId === card.id || selectedCardIds.includes(card.id);
            
            return (
              <HandCard
                key={card.id}
                card={card}
                index={index}
                totalCards={cards.length}
                isSelected={isSelected}
                canAfford={canAfford}
                canPlay={canPlay}
                onClick={() => handleCardClick(card.id)}
                onMagnify={() => onMagnifyCard?.(card)}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HandArea;
