/**
 * 召唤师战争 - 手牌区组件
 * 
 * 底部展示玩家手牌，支持：
 * - 点击选中卡牌
 * - 悬停上移预览
 * - 精灵图渲染
 * - 放大镜按钮预览卡牌
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Card, UnitCard, EventCard, StructureCard, GamePhase } from '../domain/types';
import { CardSprite } from './CardSprite';
import { useToast } from '../../../contexts/ToastContext';
import { playDeniedSound } from '../../../lib/audio/useGameAudio';
import { resolveCardAtlasId } from './cardAtlas';

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
  onPlayEvent?: (cardId: string) => void;
  onMagnifyCard?: (card: Card) => void;
  /** 血契召唤步骤2：选择手牌模式（绕过魔力检查） */
  bloodSummonSelectingCard?: boolean;
  /** 技能选卡模式：当前正在为技能选择手牌（弃牌/选择，不是打出），绕过魔力检查 */
  abilitySelectingCards?: boolean;
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

  // 传送门使用全局共用图集
  if (spriteAtlas === 'portal') {
    return { atlasId: 'sw:portal', frameIndex: spriteIndex };
  }

  const atlasType = (spriteAtlas ?? 'cards') as 'hero' | 'cards';
  const atlasId = resolveCardAtlasId(card as { id: string; faction?: string }, atlasType);

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
        data-tutorial-id={index === 0 ? 'sw-first-hand-card' : undefined}
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
  onPlayEvent,
  onMagnifyCard,
  bloodSummonSelectingCard = false,
  abilitySelectingCards = false,
  className = '',
}) => {
  const { t } = useTranslation('game-summonerwars');
  const showToast = useToast();

  // 追踪新增卡牌（用于发牌动画）
  const prevCardIdsRef = useRef<string[]>([]);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = cards.map(c => c.id);
    const prevIds = prevCardIdsRef.current;
    const added = currentIds.filter(id => !prevIds.includes(id));

    if (added.length > 0) {
      setNewCardIds(new Set(added));
      // 动画完成后清除标记
      const timer = setTimeout(() => setNewCardIds(new Set()), 400);
      prevCardIdsRef.current = currentIds;
      return () => clearTimeout(timer);
    }
    prevCardIdsRef.current = currentIds;
  }, [cards]);

  const canPlayCard = useCallback((card: Card): boolean => {
    if (!isMyTurn) return false;
    // 魔力阶段弃牌不需要检查费用，任何手牌都可以弃
    if (phase === 'magic') return true;
    const cost = getCardCost(card);
    if (cost > currentMagic) return false;
    if (phase === 'summon' && card.cardType === 'unit') return true;
    if (phase === 'build' && card.cardType === 'structure') return true;
    if (card.cardType === 'event') {
      const event = card as EventCard;
      return event.playPhase === phase || event.playPhase === 'any';
    }
    return false;
  }, [phase, isMyTurn, currentMagic]);

  const handleCardClick = useCallback((cardId: string) => {
    console.log('[HandArea] Card clicked:', { cardId, phase, isMyTurn });
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const cost = getCardCost(card);
    const canAfford = cost <= currentMagic;

    // 血契召唤选卡模式：点击费用≤2的单位卡直接选中（免费放置，不检查魔力）
    if (bloodSummonSelectingCard) {
      if (card.cardType === 'unit' && cost <= 2) {
        onCardSelect?.(cardId);
      } else {
        playDeniedSound();
        showToast.warning(t('handArea.bloodSummonOnlyLowCost', { maxCost: 2 }));
      }
      return;
    }

    // 魔力阶段：所有卡牌点击都走 onCardClick（包括事件卡）
    // 事件卡会在 useCellInteraction 中进入选择模式（打出或弃牌）
    // 其他卡牌用于弃牌换魔力
    if (phase === 'magic' && isMyTurn) {
      console.log('[HandArea] Magic phase detected, calling onCardClick', { cardId, phase, isMyTurn });
      onCardClick?.(cardId);
      return;
    }

    // ✅ 技能选卡模式：正在为技能选择手牌（弃牌/选择，不是打出卡牌）
    // 弃牌动作不消耗魔力，所以不需要检查卡牌费用
    // 适用于所有 activationStep: 'selectCards' 的技能（圣光箭、治疗等）
    if (abilitySelectingCards) {
      onCardClick?.(cardId);
      return;
    }

    // 非魔力阶段：检查是否可以支付费用（用于正常召唤/建造/事件卡）
    if (!canAfford) {
      playDeniedSound();
      showToast.warning(t('handArea.insufficientMagic', { cost, current: currentMagic }));
      return;
    }

    // 事件卡：在对应阶段直接打出
    if (card.cardType === 'event' && isMyTurn) {
      const event = card as EventCard;
      if (event.playPhase === phase || event.playPhase === 'any') {
        onPlayEvent?.(cardId);
        return;
      } else {
        const phaseLabel = t(`phase.${event.playPhase}`);
        playDeniedSound();
        showToast.warning(t('handArea.eventPhaseOnly', { phase: phaseLabel }));
        return;
      }
    }

    if ((phase === 'summon' || phase === 'build') && isMyTurn) {
      // 如果点击的是已选中的卡牌，直接取消选中（无需检查是否能打出）
      if (selectedCardId === cardId) {
        onCardSelect?.(null);
        return;
      }
      
      // 选中新卡牌时才检查是否能打出
      const canPlay = canPlayCard(card);
      if (canPlay) {
        onCardSelect?.(cardId);
      } else {
        // 提示为什么不能打出
        if (phase === 'summon' && card.cardType !== 'unit') {
          playDeniedSound();
          showToast.warning(t('handArea.onlyUnitInSummon'));
        } else if (phase === 'build' && card.cardType !== 'structure') {
          playDeniedSound();
          showToast.warning(t('handArea.onlyStructureInBuild'));
        }
      }
      return;
    }

    if (!isMyTurn) {
      playDeniedSound();
      showToast.warning(t('hint.waitingOpponent'));
      return;
    }

    onCardClick?.(cardId);
  }, [cards, phase, isMyTurn, currentMagic, selectedCardId, onCardClick, onCardSelect, onPlayEvent, canPlayCard, bloodSummonSelectingCard, abilitySelectingCards, showToast]);

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
            // 魔力阶段弃牌时所有卡都"买得起"（不消耗魔力）
            const canAfford = phase === 'magic' ? true : getCardCost(card) <= currentMagic;
            const canPlay = canPlayCard(card);
            const isSelected = selectedCardId === card.id || selectedCardIds.includes(card.id);
            const isNew = newCardIds.has(card.id);

            return (
              <motion.div
                key={card.id}
                layout
                initial={isNew ? { x: -200, y: 50, opacity: 0, scale: 0.7 } : false}
                animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <HandCard
                  card={card}
                  index={index}
                  totalCards={cards.length}
                  isSelected={isSelected}
                  canAfford={canAfford}
                  canPlay={canPlay}
                  onClick={() => handleCardClick(card.id)}
                  onMagnify={() => onMagnifyCard?.(card)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HandArea;
