/**
 * 召唤师战争 - 动作提示横幅
 * 显示当前回合的提示信息
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { GamePhase } from '../domain/types';

const PHASE_HINT_KEYS: Record<GamePhase, string> = {
  factionSelect: 'hint.factionSelect',
  summon: 'hint.summon',
  move: 'hint.move',
  build: 'hint.build',
  attack: 'hint.attack',
  magic: 'hint.magic',
  draw: 'hint.draw',
};

export interface ActionBannerProps {
  phase: GamePhase;
  isMyTurn: boolean;
  customMessage?: string;
  className?: string;
}

export const ActionBanner: React.FC<ActionBannerProps> = ({
  phase,
  isMyTurn,
  customMessage,
  className = '',
}) => {
  const { t } = useTranslation('game-summonerwars');
  const message = customMessage ?? (isMyTurn ? t(PHASE_HINT_KEYS[phase]) : t('hint.waitingOpponent'));

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={message}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        data-testid="sw-action-banner"
        data-phase={phase}
        className={`
          px-6 py-2 rounded-lg
          bg-gradient-to-r from-red-900 via-red-800 to-red-900
          border border-red-600/40
          shadow-lg shadow-black/30
          ${className}
        `}
      >
        <span className="text-sm text-white font-medium tracking-wide text-opacity-100">
          {message}
        </span>
      </motion.div>
    </AnimatePresence>
  );
};

export default ActionBanner;
