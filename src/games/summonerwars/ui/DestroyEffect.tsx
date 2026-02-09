/**
 * 召唤师战争 - 单位/建筑摧毁动画
 * 
 * 当单位或建筑被摧毁时显示爆炸消散效果
 * 粒子散射使用 BurstParticles（Canvas 2D），形状动画保留 framer-motion
 */

import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { BurstParticles } from '../../../components/common/animations/BurstParticles';

export interface DestroyEffectData {
  id: string;
  position: { row: number; col: number };
  cardName: string;
  type: 'unit' | 'structure';
}

interface DestroyEffectProps {
  effect: DestroyEffectData;
  /** 格子位置计算函数 */
  getCellPosition: (row: number, col: number) => { left: number; top: number; width: number; height: number };
  onComplete: (id: string) => void;
}

/** 摧毁粒子颜色 */
const DESTROY_COLORS = {
  unit: ['#fb923c', '#f87171', '#fbbf24', '#fff'],
  structure: ['#a78bfa', '#c084fc', '#e9d5ff', '#fff'],
};

/** 单个摧毁效果 */
const DestroyEffectItem: React.FC<DestroyEffectProps> = ({
  effect,
  getCellPosition,
  onComplete,
}) => {
  const { t } = useTranslation('game-summonerwars');
  const pos = getCellPosition(effect.position.row, effect.position.col);
  const isStructure = effect.type === 'structure';
  
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: `${pos.width}%`,
        height: `${pos.height}%`,
      }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => onComplete(effect.id)}
    >
      {/* 中心闪光 */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.5, 2], opacity: [0, 1, 0] }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div 
          className={`w-full h-full rounded-full ${
            isStructure 
              ? 'bg-purple-400/60' 
              : 'bg-red-400/60'
          }`}
          style={{
            boxShadow: isStructure
              ? '0 0 2vw 1vw rgba(168, 85, 247, 0.5)'
              : '0 0 2vw 1vw rgba(248, 113, 113, 0.5)',
          }}
        />
      </motion.div>

      {/* 冲击波 */}
      <motion.div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: '32%',
          height: '32%',
          marginLeft: '-16%',
          marginTop: '-16%',
          border: isStructure ? '2px solid rgba(168, 85, 247, 0.7)' : '2px solid rgba(248, 113, 113, 0.7)',
          boxShadow: isStructure
            ? '0 0 1.6vw 0.4vw rgba(168, 85, 247, 0.35)'
            : '0 0 1.6vw 0.4vw rgba(248, 113, 113, 0.35)',
        }}
        initial={{ scale: 0.2, opacity: 0.8 }}
        animate={{ scale: [0.2, 2.4], opacity: [0.8, 0] }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />
      
      {/* 爆炸粒子 — Canvas 2D */}
      <BurstParticles
        active
        preset={isStructure ? 'explosionStrong' : 'explosion'}
        color={DESTROY_COLORS[effect.type]}
      />

      {/* 烟尘 — Canvas 2D */}
      <BurstParticles
        active
        preset="smoke"
        color={isStructure ? ['rgba(167,139,250,0.35)'] : ['rgba(248,113,113,0.35)']}
      />
      
      {/* 摧毁文字提示 */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
        style={{ top: '-1.5vw' }}
        initial={{ y: 0, opacity: 0, scale: 0.8 }}
        animate={{ y: '-1vw', opacity: [0, 1, 1, 0], scale: 1 }}
        transition={{ duration: 0.8, times: [0, 0.2, 0.7, 1] }}
      >
        <span 
          className={`text-[0.9vw] font-bold ${
            isStructure ? 'text-purple-300' : 'text-red-300'
          }`}
          style={{
            textShadow: '0 0 0.5vw rgba(0,0,0,0.8)',
          }}
        >
          {t('destroyEffect.destroyed', { name: effect.cardName })}
        </span>
      </motion.div>
    </motion.div>
  );
};

/** 摧毁效果层 */
export const DestroyEffectsLayer: React.FC<{
  effects: DestroyEffectData[];
  getCellPosition: (row: number, col: number) => { left: number; top: number; width: number; height: number };
  onEffectComplete: (id: string) => void;
}> = ({ effects, getCellPosition, onEffectComplete }) => {
  return (
    <AnimatePresence>
      {effects.map((effect) => (
        <DestroyEffectItem
          key={effect.id}
          effect={effect}
          getCellPosition={getCellPosition}
          onComplete={onEffectComplete}
        />
      ))}
    </AnimatePresence>
  );
};

/** Hook：管理摧毁效果状态 */
export const useDestroyEffects = () => {
  const [effects, setEffects] = useState<DestroyEffectData[]>([]);
  const backlogLogRef = useRef(0);
  const LOG_THRESHOLD = 12;
  const LOG_STEP = 6;

  const pushEffect = useCallback((effect: Omit<DestroyEffectData, 'id'>) => {
    const id = `destroy-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setEffects((prev) => {
      const next = [...prev, { ...effect, id }];
      if (next.length >= LOG_THRESHOLD && next.length >= backlogLogRef.current + LOG_STEP) {
        backlogLogRef.current = next.length;
        console.warn(`[SW-FX] event=destroy_effects_backlog size=${next.length}`);
      }
      return next;
    });
  }, []);

  const removeEffect = useCallback((id: string) => {
    setEffects((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (next.length < backlogLogRef.current) {
        backlogLogRef.current = next.length;
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setEffects([]);
    backlogLogRef.current = 0;
  }, []);

  return { effects, pushEffect, removeEffect, clearAll };
};

export default DestroyEffectsLayer;
