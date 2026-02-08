/**
 * DamageFlash — 通用受伤反馈特效
 *
 * 组合：震动 + 斜切 + 白闪（钝帧感）+ 红色脉冲 + 伤害数字飞出。
 * 纯视觉层，不依赖任何游戏逻辑。
 *
 * @example
 * ```tsx
 * <DamageFlash active damage={5} intensity="strong" onComplete={() => {}} />
 * ```
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { SlashEffect, getSlashPresetByDamage } from './SlashEffect';

export interface DamageFlashProps {
  /** 是否激活 */
  active: boolean;
  /** 伤害值（影响数字显示和斜切强度） */
  damage?: number;
  /** 强度 */
  intensity?: 'normal' | 'strong';
  /** 是否显示伤害数字 */
  showNumber?: boolean;
  /** 完成回调 */
  onComplete?: () => void;
  className?: string;
}

export const DamageFlash: React.FC<DamageFlashProps> = ({
  active,
  damage = 1,
  intensity = 'normal',
  showNumber = true,
  onComplete,
  className = '',
}) => {
  const [slashActive, setSlashActive] = useState(false);
  const timerRef = useRef<number>(0);
  const isStrong = intensity === 'strong';
  const preset = getSlashPresetByDamage(isStrong ? 6 : 2);
  const shakeX = isStrong ? [-8, 8, -6, 6, -3, 3, 0] : [-4, 4, -3, 3, -1, 0];
  const shakeY = isStrong ? [0, -4, 2, -2, 1, 0] : [0, -2, 1, 0];

  useEffect(() => {
    if (!active) return;
    setSlashActive(true);
    timerRef.current = window.setTimeout(() => setSlashActive(false), 100);
    return () => window.clearTimeout(timerRef.current);
  }, [active]);

  if (!active) return null;

  return (
    <motion.div
      className={`absolute inset-0 pointer-events-none ${className}`}
      initial={{ x: 0, y: 0 }}
      animate={{ x: shakeX, y: shakeY }}
      transition={{ duration: isStrong ? 0.4 : 0.3 }}
      onAnimationComplete={() => onComplete?.()}
    >
      {/* 斜切 */}
      <SlashEffect isActive={slashActive} {...preset} />

      {/* 白闪（钝帧感） */}
      <motion.div className="absolute inset-0 rounded bg-white/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.08 }}
      />

      {/* 红色脉冲 */}
      <motion.div className="absolute inset-0 rounded"
        style={{ backgroundColor: 'rgba(220, 38, 38, 0.6)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isStrong ? [0, 0.7, 0.1, 0.5, 0] : [0, 0.6, 0, 0.3, 0] }}
        transition={{ duration: isStrong ? 0.45 : 0.3, delay: 0.05 }}
      />

      {/* 伤害数字飞出 */}
      {showNumber && (
        <motion.div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          initial={{ y: 0, opacity: 0, scale: 0.5 }}
          animate={{ y: '-120%', opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1.1, 0.8] }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <span className="font-black text-red-400 whitespace-nowrap" style={{
            fontSize: isStrong ? '2vw' : '1.4vw',
            textShadow: '0 0 0.5vw rgba(220,38,38,0.8), 0 2px 4px rgba(0,0,0,0.6)',
          }}>
            -{damage}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
};
