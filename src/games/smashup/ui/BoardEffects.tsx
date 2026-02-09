/**
 * 大杀四方 - 棋盘特效层
 *
 * 纸质桌游风格的动画效果：
 * - 力量变化浮字（手写风格 +N）
 * - 行动卡打出展示（居中放大 → 缩小消失）
 * - 基地记分 VP 飞行
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PowerChangeEffect, ActionShowEffect, BaseScoredEffect } from './useGameEvents';
import { useTranslation } from 'react-i18next';
import { getCardDef, resolveCardName, resolveCardText } from '../data/cards';
import { CardPreview } from '../../../components/common/media/CardPreview';

// ============================================================================
// 力量变化浮字
// ============================================================================

const PowerChangeFloat: React.FC<{
  effect: PowerChangeEffect;
  onComplete: () => void;
}> = ({ effect, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 900);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 0.8, rotate: -5 }}
      animate={{ opacity: 0, y: -40, scale: 1.2, rotate: 5 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="absolute pointer-events-none z-50 select-none"
      style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
    >
      <span className={`text-[1.8vw] font-black drop-shadow-md ${
        effect.delta > 0 ? 'text-green-400' : 'text-red-400'
      }`}>
        {effect.delta > 0 ? `+${effect.delta}` : effect.delta}
      </span>
    </motion.div>
  );
};

// ============================================================================
// 行动卡展示浮层
// ============================================================================

const ActionCardShowOverlay: React.FC<{
  effect: ActionShowEffect;
  onComplete: () => void;
}> = ({ effect, onComplete }) => {
  const { t, i18n } = useTranslation('game-smashup');
  const def = getCardDef(effect.defId);
  const resolvedName = resolveCardName(def, i18n.language) || effect.defId;
  const resolvedText = resolveCardText(def, i18n.language);

  useEffect(() => {
    const timer = setTimeout(onComplete, 800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* 半透明背景 */}
      <motion.div className="absolute inset-0 bg-black/30" />

      {/* 卡牌 */}
      <motion.div
        className="relative w-[18vw] aspect-[0.714] bg-white rounded-lg shadow-2xl border-2 border-slate-300 overflow-hidden"
        initial={{ scale: 0.3, y: 200, rotate: -10 }}
        animate={{ scale: 1, y: 0, rotate: 2 }}
        exit={{
          scale: 0.2,
          y: -100,
          x: 300,
          rotate: 15,
          opacity: 0,
          transition: { duration: 0.3, ease: 'easeIn' },
        }}
        transition={{
          type: 'spring', stiffness: 400, damping: 25,
        }}
      >
        <CardPreview
          previewRef={def?.previewRef}
          className="w-full h-full object-cover"
          title={resolvedName}
        />
        {!def?.previewRef && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[#f3f0e8]">
            <div className="text-[1.2vw] font-black uppercase text-slate-800 mb-2">
              {resolvedName}
            </div>
            <div className="text-[0.7vw] text-slate-600 text-center font-mono">
              {resolvedText}
            </div>
          </div>
        )}

        {/* "PLAYED!" 标签 */}
        <motion.div
          className="absolute top-2 right-2 bg-red-500 text-white text-[0.7vw] font-black px-2 py-0.5 rounded shadow-md"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 12 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 500 }}
          style={{ transformOrigin: 'center' }}
        >
          {t('ui.played')}
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// VP 飞行效果
// ============================================================================

const VpFlyEffect: React.FC<{
  vp: number;
  playerId: string;
  rank: number;
  onComplete: () => void;
}> = ({ vp, playerId, rank, onComplete }) => {
  const { t } = useTranslation('game-smashup');
  useEffect(() => {
    const timer = setTimeout(onComplete, 1200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (vp <= 0) return null;

  // 根据排名偏移起始位置
  const startY = 30 + rank * 20;

  return (
    <motion.div
      className="fixed z-[90] pointer-events-none select-none"
      style={{ left: '50%', top: `${startY}%` }}
      initial={{ opacity: 1, scale: 1.5, x: '-50%' }}
      animate={{ opacity: 0, scale: 0.8, y: -80, x: '-50%' }}
      transition={{ duration: 1, ease: 'easeOut' }}
    >
      <div className="flex items-center gap-2 bg-yellow-400/90 text-slate-900 px-3 py-1.5 rounded-full shadow-xl border-2 border-yellow-600">
        <span className="text-[1.5vw] font-black">{t('ui.vp_award', { vp })}</span>
        <span className="text-[0.8vw] font-bold opacity-70">{t('ui.player_short', { id: playerId })}</span>
      </div>
    </motion.div>
  );
};

// ============================================================================
// 基地记分效果
// ============================================================================

const BaseScoredOverlay: React.FC<{
  effect: BaseScoredEffect;
  onComplete: () => void;
}> = ({ effect, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <>
      {effect.rankings.map((r, i) => (
        <VpFlyEffect
          key={`${effect.id}-${r.playerId}`}
          vp={r.vp}
          playerId={r.playerId}
          rank={i}
          onComplete={i === 0 ? onComplete : () => {}}
        />
      ))}
    </>
  );
};

// ============================================================================
// 导出：特效层组件
// ============================================================================

export const SmashUpEffectsLayer: React.FC<{
  powerChanges: PowerChangeEffect[];
  onPowerChangeComplete: (id: string) => void;
  actionShows: ActionShowEffect[];
  onActionShowComplete: (id: string) => void;
  baseScored: BaseScoredEffect[];
  onBaseScoredComplete: (id: string) => void;
  /** 基地 DOM 引用，用于定位力量浮字 */
  baseRefs: React.RefObject<Map<number, HTMLElement>>;
}> = ({
  powerChanges, onPowerChangeComplete,
  actionShows, onActionShowComplete,
  baseScored, onBaseScoredComplete,
  baseRefs,
}) => {
  return (
    <>
      {/* 力量变化浮字 - 定位到基地 token 旁 */}
      <AnimatePresence>
        {powerChanges.map(pc => {
          const baseEl = baseRefs.current?.get(pc.baseIndex);
          if (!baseEl) return null;
          const rect = baseEl.getBoundingClientRect();
          return (
            <div
              key={pc.id}
              className="fixed pointer-events-none z-50"
              style={{ left: rect.right + 8, top: rect.top - 10 }}
            >
              <PowerChangeFloat
                effect={pc}
                onComplete={() => onPowerChangeComplete(pc.id)}
              />
            </div>
          );
        })}
      </AnimatePresence>

      {/* 行动卡展示 */}
      <AnimatePresence>
        {actionShows.length > 0 && (
          <ActionCardShowOverlay
            key={actionShows[0].id}
            effect={actionShows[0]}
            onComplete={() => onActionShowComplete(actionShows[0].id)}
          />
        )}
      </AnimatePresence>

      {/* 基地记分 VP 飞行 */}
      <AnimatePresence>
        {baseScored.map(bs => (
          <BaseScoredOverlay
            key={bs.id}
            effect={bs}
            onComplete={() => onBaseScoredComplete(bs.id)}
          />
        ))}
      </AnimatePresence>
    </>
  );
};
