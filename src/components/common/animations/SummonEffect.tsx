/**
 * SummonEffect — 通用召唤/降临特效
 *
 * 游戏王风格：光柱坠落 + 落地白闪 + 冲击波环 + 升腾光粒子（Canvas 2D）
 * 基于 framer-motion + Canvas 2D 粒子引擎，零游戏耦合。
 * 组件自带溢出空间，冲击波环和粒子不会被裁切。
 *
 * @example
 * ```tsx
 * <div className="relative w-20 h-20">
 *   <SummonEffect active intensity="strong" color="gold" />
 * </div>
 * ```
 */

import React from 'react';
import { motion } from 'framer-motion';
import { BurstParticles } from './BurstParticles';

export type SummonIntensity = 'normal' | 'strong';
export type SummonColorTheme = 'blue' | 'gold' | 'custom';

export interface SummonEffectProps {
  /** 是否激活 */
  active: boolean;
  /** 强度 */
  intensity?: SummonIntensity;
  /** 颜色主题 */
  color?: SummonColorTheme;
  /** 自定义颜色（仅 color='custom' 时生效） */
  customColors?: SummonColorSet;
  /** 完成回调 */
  onComplete?: () => void;
  className?: string;
}

export interface SummonColorSet {
  /** 主色 */
  main: string;
  /** 辅色 */
  sub: string;
  /** 粒子颜色数组 */
  particles: string[];
  /** 光晕色（仅强力时） */
  halo?: string;
}

/** 预设颜色方案 */
const COLOR_PRESETS: Record<'blue' | 'gold', SummonColorSet> = {
  blue: {
    main: 'rgba(147,197,253,0.7)',
    sub: 'rgba(59,130,246,0.2)',
    particles: ['#93c5fd', '#60a5fa', '#3b82f6', '#bfdbfe', '#fff'],
  },
  gold: {
    main: 'rgba(251,191,36,0.8)',
    sub: 'rgba(245,158,11,0.3)',
    particles: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fff'],
    halo: 'rgba(251,191,36,0.3)',
  },
};

function resolveColors(color: SummonColorTheme, customColors?: SummonColorSet): SummonColorSet {
  if (color === 'custom' && customColors) return customColors;
  return COLOR_PRESETS[color === 'custom' ? 'blue' : color];
}

export const SummonEffect: React.FC<SummonEffectProps> = ({
  active,
  intensity = 'normal',
  color = 'blue',
  customColors,
  onComplete,
  className = '',
}) => {
  if (!active) return null;

  const isStrong = intensity === 'strong';
  const c = resolveColors(color, customColors);

  // 冲击波环配置
  const rings = [
    { scale: isStrong ? 3 : 2, dur: isStrong ? 0.45 : 0.35, delay: 0.18, opacity: 0.8 },
    { scale: isStrong ? 4.5 : 3, dur: isStrong ? 0.65 : 0.5, delay: 0.25, opacity: 0.5 },
  ];

  return (
    // 溢出容器：比父级大 3 倍，居中对齐，确保冲击波和粒子不被裁切
    <div
      className={`absolute pointer-events-none ${className}`}
      style={{
        left: '-100%', top: '-100%',
        width: '300%', height: '300%',
        overflow: 'visible',
      }}
    >
      {/* 光柱坠落 — 从顶部砸向中心 */}
      <motion.div
        className="absolute flex items-center justify-center"
        style={{ left: '33.3%', top: '0%', width: '33.3%', height: '100%' }}
        initial={{ y: '-60%', scaleX: 0.5, scaleY: 1.8, opacity: 0.9 }}
        animate={{ y: '0%', scaleX: 1, scaleY: 1, opacity: [0.9, 1, 0] }}
        transition={{ duration: 0.22, ease: [0.36, 0, 0.66, -0.56] }}
      >
        <div className="w-full h-1/3 rounded-lg" style={{
          background: `radial-gradient(ellipse 80% 120% at center, ${c.main} 0%, ${c.sub} 50%, transparent 80%)`,
        }} />
      </motion.div>

      {/* 落地白闪 */}
      <motion.div
        className="absolute rounded-full"
        style={{
          left: '25%', top: '25%', width: '50%', height: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.3) 40%, transparent 70%)',
        }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 1, 0], scale: [0.3, 1.2, 1.6] }}
        transition={{ duration: 0.18, delay: 0.18, ease: 'easeOut' }}
      />

      {/* 冲击波环 */}
      {rings.map((ring, i) => (
        <motion.div key={`ring-${i}`}
          className="absolute flex items-center justify-center"
          style={{ left: '33.3%', top: '33.3%', width: '33.3%', height: '33.3%' }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: ring.scale, opacity: [0, ring.opacity, 0] }}
          transition={{ duration: ring.dur, delay: ring.delay, ease: 'easeOut' }}
        >
          <div className="w-full h-full rounded-full" style={{
            border: `${2 - i}px solid ${c.main}`,
            boxShadow: `0 0 12px 4px ${c.sub}`,
          }} />
        </motion.div>
      ))}

      {/* 升腾光粒子 — Canvas 2D，overflow=3 确保粒子不被裁切 */}
      <motion.div
        className="absolute"
        style={{ left: '33.3%', top: '33.3%', width: '33.3%', height: '33.3%' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        onAnimationComplete={() => onComplete?.()}
      >
        <BurstParticles
          active
          preset={isStrong ? 'summonGlowStrong' : 'summonGlow'}
          color={c.particles}
          overflow={3}
        />
      </motion.div>

      {/* 强力光晕 */}
      {isStrong && (
        <motion.div
          className="absolute flex items-center justify-center"
          style={{ left: '33.3%', top: '33.3%', width: '33.3%', height: '33.3%' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 2.5, 3], opacity: [0, 0.4, 0] }}
          transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
        >
          <div className="w-full h-full rounded-full" style={{
            background: `radial-gradient(circle, ${c.halo ?? c.sub} 0%, transparent 70%)`,
          }} />
        </motion.div>
      )}
    </div>
  );
};
