/**
 * 召唤师战争 - 手牌区组件
 *
 * 底部展示玩家手牌，支持：
 * - 点击选中卡牌
 * - 桌面端悬停抬升预览
 * - 触屏长按放大
 * - 桌面端保留 hover 放大入口
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Card, UnitCard, EventCard, StructureCard, GamePhase } from '../domain/types';
import { CardSprite } from './CardSprite';
import { useToast } from '../../../contexts/ToastContext';
import { playDeniedSound } from '../../../lib/audio/useGameAudio';
import { resolveCardAtlasId } from './cardAtlas';
import { requiresEventInteraction } from './useEventCardModes';
import { useCoarsePointer } from '../../../hooks/ui/useCoarsePointer';
import { useTouchLongPress } from '../../../hooks/ui/useTouchLongPress';
import { BOARD_SHELL_REFERENCE_WIDTH } from './layoutConstants';

const MagnifyIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <svg className={className} style={style} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
      clipRule="evenodd"
    />
  </svg>
);

interface HandAreaProps {
  cards: Card[];
  phase: GamePhase;
  isMyTurn: boolean;
  currentMagic: number;
  selectedCardId?: string | null;
  selectedCardIds?: string[];
  abilitySelectableCardIds?: string[];
  onCardClick?: (cardId: string) => void;
  onCardSelect?: (cardId: string | null) => void;
  onPlayEvent?: (cardId: string) => void;
  onMagnifyCard?: (card: Card) => void;
  /** 血契召唤步骤：只允许选择低费单位牌。 */
  bloodSummonSelectingCard?: boolean;
  /** 技能选卡模式：当前正在为技能选择手牌（弃牌/选择，不是打出）。 */
  abilitySelectingCards?: boolean;
  /** 有交互模式激活时，阻止再打出新的事件牌。 */
  interactionBusy?: boolean;
  /** 手机横屏等紧凑布局。 */
  compactLayout?: boolean;
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

  if (spriteAtlas === 'portal') {
    return { atlasId: 'sw:portal', frameIndex: spriteIndex };
  }

  const atlasType = (spriteAtlas ?? 'cards') as 'hero' | 'cards';
  const atlasId = resolveCardAtlasId(card as { id: string; faction?: string }, atlasType);
  return { atlasId, frameIndex: spriteIndex };
}

const CARD_WIDTH_RATIO = 'var(--sw-hand-card-width-ratio, 0.16)';
const HAND_REFERENCE_WIDTH = `var(--sw-hand-reference-width, ${BOARD_SHELL_REFERENCE_WIDTH})`;
const MAGNIFY_BUTTON_OFFSET_RATIO = 0.003;
const MAGNIFY_BUTTON_SIZE_RATIO = 0.018;
const MAGNIFY_ICON_SIZE_RATIO = 0.01;
const LONG_PRESS_DURATION_MS = 420;
const LONG_PRESS_MOVE_CANCEL_PX = 14;
const LONG_PRESS_CLICK_BLOCK_MS = 450;

const HandCard: React.FC<{
  card: Card;
  index: number;
  totalCards: number;
  isSelected: boolean;
  canAfford: boolean;
  canPlay: boolean;
  onClick?: () => void;
  onMagnify?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  suppressMagnifyButton?: boolean;
  compactLayout?: boolean;
}> = ({
  card,
  index,
  totalCards,
  isSelected,
  canAfford,
  canPlay,
  onClick,
  onMagnify,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  suppressMagnifyButton = false,
  compactLayout = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const spriteConfig = getCardSpriteConfig(card);
  const showPlayableHighlight = canPlay && !isSelected;
  const shouldRenderMagnifyButton = Boolean(onMagnify) && !suppressMagnifyButton;
  const magnifyButtonSize = `calc(${HAND_REFERENCE_WIDTH} * ${MAGNIFY_BUTTON_SIZE_RATIO})`;
  const magnifyButtonOffset = `calc(${HAND_REFERENCE_WIDTH} * ${MAGNIFY_BUTTON_OFFSET_RATIO})`;
  const magnifyIconSize = `calc(${HAND_REFERENCE_WIDTH} * ${MAGNIFY_ICON_SIZE_RATIO})`;
  const hoverMagnifyButtonStyle: React.CSSProperties = {
    top: magnifyButtonOffset,
    right: magnifyButtonOffset,
    width: magnifyButtonSize,
    height: magnifyButtonSize,
  };
  const magnifyIconStyle: React.CSSProperties = {
    width: magnifyIconSize,
    height: magnifyIconSize,
  };

  const cardSpacingRatio = compactLayout
    ? (totalCards > 6 ? -0.058 : totalCards > 4 ? -0.052 : -0.046)
    : (totalCards > 6 ? -0.06 : totalCards > 4 ? -0.055 : -0.05);
  const selectedLift = compactLayout ? -20 : -30;
  const hoverLift = compactLayout ? -12 : -20;
  const hoverScale = compactLayout ? 1.04 : 1.08;

  const handleMagnifyClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMagnify?.();
  }, [onMagnify]);
  const handleMagnifyKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
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
      data-layout-mode={compactLayout ? 'compact' : 'default'}
      style={{
        width: `calc(${HAND_REFERENCE_WIDTH} * ${CARD_WIDTH_RATIO})`,
        marginLeft: index === 0 ? 0 : `calc(${HAND_REFERENCE_WIDTH} * ${cardSpacingRatio})`,
        zIndex: isSelected ? 100 : isHovered ? 50 : index,
      }}
      initial={false}
      animate={{
        y: isSelected ? selectedLift : isHovered ? hoverLift : 0,
        scale: isHovered ? hoverScale : 1,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
    >
      <div
        className={`
          relative w-full rounded-lg overflow-hidden pointer-events-none
          border-2 transition-all duration-150
          ${isSelected
            ? 'border-amber-400 shadow-lg shadow-amber-400/60 ring-2 ring-amber-400/30'
            : showPlayableHighlight
              ? 'border-emerald-300 ring-2 ring-emerald-300/80 ring-offset-1 ring-offset-black/45 shadow-[0_0_0_1px_rgba(167,243,208,0.95),0_0_18px_rgba(16,185,129,0.5)] hover:border-emerald-200'
              : canAfford
                ? 'border-slate-500/80 hover:border-slate-400'
                : 'border-slate-700/60'}
          cursor-pointer
          ${!canAfford ? 'grayscale' : ''}
        `}
      >
        {spriteConfig ? (
          <CardSprite
            atlasId={spriteConfig.atlasId}
            frameIndex={spriteConfig.frameIndex}
            className="w-full pointer-events-none"
          />
        ) : (
          <div className="w-full aspect-[1044/729] bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
            <span className="text-slate-400 text-sm">{card.name}</span>
          </div>
        )}

        {isSelected && <div className="absolute inset-0 bg-amber-400/15 pointer-events-none" />}
        {showPlayableHighlight && (
          <div className="absolute inset-0 bg-emerald-300/12 pointer-events-none" />
        )}
      </div>

      {shouldRenderMagnifyButton && (
        <div
          role="button"
          tabIndex={0}
          aria-label="放大卡牌"
          onClick={handleMagnifyClick}
          onKeyDown={handleMagnifyKeyDown}
          data-testid="sw-hand-card-magnify"
          style={hoverMagnifyButtonStyle}
          className="absolute z-20 flex items-center justify-center rounded-full border border-white/20 bg-black/60 text-white opacity-0 pointer-events-none shadow-lg transition-[opacity,background-color] duration-200 group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-amber-500/80"
        >
          <MagnifyIcon style={magnifyIconStyle} />
        </div>
      )}
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
  abilitySelectableCardIds = [],
  onCardClick,
  onCardSelect,
  onPlayEvent,
  onMagnifyCard,
  bloodSummonSelectingCard = false,
  abilitySelectingCards = false,
  interactionBusy = false,
  compactLayout = false,
  className = '',
}) => {
  const { t } = useTranslation('game-summonerwars');
  const showToast = useToast();
  const isCoarsePointer = useCoarsePointer();
  const {
    handlePointerDown: handleTouchLongPressStart,
    handlePointerMove: handleTouchLongPressMove,
    handlePointerUp: handleTouchLongPressEnd,
    shouldBlockClick,
  } = useTouchLongPress<string, Card>({
    enabled: Boolean(onMagnifyCard) && isCoarsePointer,
    durationMs: LONG_PRESS_DURATION_MS,
    moveCancelPx: LONG_PRESS_MOVE_CANCEL_PX,
    clickBlockMs: LONG_PRESS_CLICK_BLOCK_MS,
    onLongPress: (_cardId, card) => {
      onMagnifyCard?.(card);
    },
  });

  const prevCardIdsRef = useRef<string[]>([]);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = cards.map((card) => card.id);
    const prevIds = prevCardIdsRef.current;
    const added = currentIds.filter((id) => !prevIds.includes(id));

    if (added.length > 0) {
      setNewCardIds(new Set(added));
      const timer = setTimeout(() => setNewCardIds(new Set()), 400);
      prevCardIdsRef.current = currentIds;
      return () => clearTimeout(timer);
    }

    prevCardIdsRef.current = currentIds;
    return undefined;
  }, [cards]);

  const canPlayCard = useCallback((card: Card): boolean => {
    if (!isMyTurn) return false;
    if (abilitySelectingCards) {
      return abilitySelectableCardIds.length === 0 || abilitySelectableCardIds.includes(card.id);
    }
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
  }, [abilitySelectableCardIds, abilitySelectingCards, phase, isMyTurn, currentMagic]);

  const shouldUseClickForMagnify = useCallback((card: Card) => {
    if (!onMagnifyCard) return false;
    if (bloodSummonSelectingCard || abilitySelectingCards) return false;
    if (!isMyTurn) return true;
    if (phase === 'magic' || phase === 'summon' || phase === 'build') return false;
    if (card.cardType === 'event') return false;
    return true;
  }, [abilitySelectingCards, bloodSummonSelectingCard, isMyTurn, onMagnifyCard, phase]);

  const handleCardClick = useCallback((cardId: string) => {
    const card = cards.find((item) => item.id === cardId);
    if (!card) return;
    if (shouldBlockClick(cardId)) return;
    if (shouldUseClickForMagnify(card)) {
      onMagnifyCard?.(card);
      return;
    }

    const cost = getCardCost(card);
    const canAfford = cost <= currentMagic;

    if (bloodSummonSelectingCard) {
      if (card.cardType === 'unit' && cost <= 2) {
        onCardSelect?.(cardId);
      } else {
        playDeniedSound();
        showToast.warning(
          t('handArea.bloodSummonOnlyLowCost', { maxCost: 2 }),
          undefined,
          { dedupeKey: 'summonerwars.bloodSummon' },
        );
      }
      return;
    }

    if (phase === 'magic' && isMyTurn && card.cardType !== 'event') {
      onCardClick?.(cardId);
      return;
    }

    if (abilitySelectingCards) {
      if (abilitySelectableCardIds.length > 0 && !abilitySelectableCardIds.includes(cardId)) {
        return;
      }
      onCardClick?.(cardId);
      return;
    }

    if (!canAfford) {
      playDeniedSound();
      showToast.warning(
        t('handArea.insufficientMagic', { cost, current: currentMagic }),
        undefined,
        { dedupeKey: 'summonerwars.insufficientMagic' },
      );
      return;
    }

    if (card.cardType === 'event' && isMyTurn) {
      if (interactionBusy) {
        playDeniedSound();
        showToast.warning(
          t('handArea.interactionBusy', '请先完成当前操作'),
          undefined,
          { dedupeKey: 'summonerwars.interactionBusy' },
        );
        return;
      }

      const event = card as EventCard;
      if (event.playPhase === phase || event.playPhase === 'any') {
        if (requiresEventInteraction(cardId)) {
          onPlayEvent?.(cardId);
          return;
        }

        if (selectedCardId !== cardId) {
          onCardSelect?.(cardId);
          return;
        }

        if (phase === 'magic') {
          // 魔力阶段维持原有“打出/弃牌/取消”选择流程，
          // 但入口改为两段式确认后的第二次点击。
          onCardClick?.(cardId);
          return;
        }

        onPlayEvent?.(cardId);
        return;
      }

      const phaseLabel = t(`phase.${event.playPhase}`);
      playDeniedSound();
      showToast.warning(
        t('handArea.eventPhaseOnly', { phase: phaseLabel }),
        undefined,
        { dedupeKey: 'summonerwars.eventPhase' },
      );
      return;
    }

    if ((phase === 'summon' || phase === 'build') && isMyTurn) {
      if (selectedCardId === cardId) {
        onCardSelect?.(null);
        return;
      }

      const canPlay = canPlayCard(card);
      if (canPlay) {
        onCardSelect?.(cardId);
      } else if (phase === 'summon' && card.cardType !== 'unit') {
        playDeniedSound();
        showToast.warning(t('handArea.onlyUnitInSummon'), undefined, { dedupeKey: 'summonerwars.onlyUnit' });
      } else if (phase === 'build' && card.cardType !== 'structure') {
        playDeniedSound();
        showToast.warning(t('handArea.onlyStructureInBuild'), undefined, { dedupeKey: 'summonerwars.onlyStructure' });
      }
      return;
    }

    if (!isMyTurn) {
      playDeniedSound();
      showToast.warning(t('hint.waitingOpponent'), undefined, { dedupeKey: 'summonerwars.notYourTurn' });
      return;
    }

    onCardClick?.(cardId);
  }, [
    cards,
    phase,
    isMyTurn,
    currentMagic,
    selectedCardId,
    onCardClick,
    onCardSelect,
    onPlayEvent,
    canPlayCard,
    bloodSummonSelectingCard,
    abilitySelectingCards,
    abilitySelectableCardIds,
    interactionBusy,
    showToast,
    t,
    shouldBlockClick,
    shouldUseClickForMagnify,
    onMagnifyCard,
  ]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className={`relative flex items-end justify-center ${className}`} data-testid="sw-hand-area">
      <div className="flex items-end">
        <AnimatePresence>
          {cards.map((card, index) => {
            const canAfford = phase === 'magic' ? true : getCardCost(card) <= currentMagic;
            const canPlay = canPlayCard(card);
            const isSelected = selectedCardId === card.id || selectedCardIds.includes(card.id);
            const isNew = newCardIds.has(card.id);

            return (
              <motion.div
                key={card.id}
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
                  onPointerDown={(event) => handleTouchLongPressStart(event, card.id, card)}
                  onPointerMove={(event) => handleTouchLongPressMove(event, card.id)}
                  onPointerUp={() => handleTouchLongPressEnd(card.id)}
                  onPointerCancel={() => handleTouchLongPressEnd(card.id)}
                  // 触屏下统一走长按放大，不渲染显式按钮，避免遮挡再次点按手牌。
                  suppressMagnifyButton={isCoarsePointer}
                  compactLayout={compactLayout}
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
