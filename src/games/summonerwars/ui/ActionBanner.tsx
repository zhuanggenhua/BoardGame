/**
 * 召唤师战争 - 动作提示横幅
 * 显示当前回合的提示信息
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GamePhase } from '../domain/types';

const PHASE_HINTS: Record<GamePhase, string> = {
  summon: '从手牌召唤单位到城门旁',
  move: '移动最多3个单位，每个最多2格',
  build: '在后方区域建造城门或建筑',
  attack: '用最多3个单位进行攻击',
  magic: '弃牌获取魔力',
  draw: '抽牌至5张',
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
  const message = customMessage ?? (isMyTurn ? PHASE_HINTS[phase] : '等待对手行动...');

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
