/**
 * SlashEffect - 斜切特效组件
 * 
 * 在受击时显示斜线切割效果，增强打击感。
 * 通用层组件，可被任何游戏复用。
 * 
 * @example
 * ```tsx
 * <SlashEffect 
 *   isActive={isHit} 
 *   angle={-30} 
 *   color="red"
 *   count={2}
 * />
 * ```
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SlashConfig {
  /** 斜切角度 (度)，默认 -30 */
  angle?: number;
  /** 斜切颜色，默认 'rgba(255, 100, 100, 0.8)' */
  color?: string;
  /** 持续时间 (ms)，默认 200 */
  duration?: number;
  /** 斜线数量，默认 1 */
  count?: number;
  /** 斜线宽度 (px)，默认 3 */
  width?: number;
  /** 发光效果，默认 true */
  glow?: boolean;
  /** 拖尾效果，默认 true */
  trail?: boolean;
}

export interface SlashEffectProps extends SlashConfig {
  /** 是否激活斜切效果 */
  isActive: boolean;
  className?: string;
}

interface SlashLine {
  id: number;
  angle: number;
  delay: number;
  offsetX: number;
}

/** 斜切特效组件 */
export const SlashEffect: React.FC<SlashEffectProps> = ({
  isActive,
  angle = -30,
  color = 'rgba(255, 100, 100, 0.9)',
  duration = 200,
  count = 1,
  width = 3,
  glow = true,
  trail = true,
  className = '',
}) => {
  const [slashes, setSlashes] = useState<SlashLine[]>([]);

  useEffect(() => {
    if (isActive) {
      // 生成多条斜线
      const newSlashes: SlashLine[] = Array.from({ length: count }, (_, i) => ({
        id: Date.now() + i,
        angle: angle + (Math.random() - 0.5) * 15, // 角度随机偏移
        delay: i * 30, // 每条线延迟
        offsetX: (i - (count - 1) / 2) * 20, // 水平分布
      }));
      setSlashes(newSlashes);

      // 清除
      const timer = setTimeout(() => {
        setSlashes([]);
      }, duration + count * 30 + 100);

      return () => clearTimeout(timer);
    }
  }, [isActive, angle, count, duration]);

  return (
    <div
      className={`absolute left-1/2 top-1/2 w-[240%] h-[240%] -translate-x-1/2 -translate-y-1/2 pointer-events-none overflow-visible ${className}`}
    >
      <AnimatePresence>
        {slashes.map((slash) => (
          <motion.div
            key={slash.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: slash.delay / 1000 }}
          >
            {/* 主斜线 */}
            <motion.div
              className="absolute"
              style={{
                top: '50%',
                left: '50%',
                width: '200%',
                height: width,
                background: `linear-gradient(90deg, transparent 0%, ${color} 30%, ${color} 70%, transparent 100%)`,
                transform: `translate(-50%, -50%) translateX(${slash.offsetX}px) rotate(${slash.angle}deg)`,
                boxShadow: glow ? `0 0 20px 5px ${color}, 0 0 40px 10px ${color}` : 'none',
                borderRadius: width / 2,
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ 
                scaleX: [0, 1.2, 1],
                opacity: [0, 1, 0.8, 0],
              }}
              transition={{ 
                duration: duration / 1000,
                ease: [0.25, 0.1, 0.25, 1],
                times: [0, 0.3, 0.6, 1],
              }}
            />
            
            {/* 拖尾效果 */}
            {trail && (
              <motion.div
                className="absolute"
                style={{
                  top: '50%',
                  left: '50%',
                  width: '200%',
                  height: width * 3,
                  background: `linear-gradient(90deg, transparent 0%, ${color.replace('0.9', '0.3')} 40%, ${color.replace('0.9', '0.3')} 60%, transparent 100%)`,
                  transform: `translate(-50%, -50%) translateX(${slash.offsetX}px) rotate(${slash.angle}deg)`,
                  filter: 'blur(8px)',
                  borderRadius: width,
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ 
                  scaleX: [0, 1.1, 0.8],
                  opacity: [0, 0.6, 0],
                }}
                transition={{ 
                  duration: duration / 1000 * 1.2,
                  ease: 'easeOut',
                }}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

/** Hook：管理斜切效果状态 */
export const useSlashEffect = () => {
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<SlashConfig>({});

  const triggerSlash = useCallback((overrideConfig?: SlashConfig) => {
    const finalConfig = { ...config, ...overrideConfig };
    setConfig(finalConfig);
    setIsActive(true);

    // 保持激活足够长时间让组件渲染动画
    const duration = finalConfig.duration ?? 200;
    const timer = setTimeout(() => {
      setIsActive(false);
    }, duration + 100);

    return () => clearTimeout(timer);
  }, [config]);

  return { isActive, config, triggerSlash };
};

/** 预设配置 */
export const SLASH_PRESETS = {
  /** 轻击 - 单条细线 */
  light: {
    count: 1,
    width: 2,
    duration: 3000,
    color: 'rgba(255, 200, 200, 0.7)',
    glow: false,
    trail: false,
  } as SlashConfig,
  
  /** 普通击中 */
  normal: {
    count: 1,
    width: 3,
    duration: 3000,
    color: 'rgba(255, 100, 100, 0.85)',
    glow: true,
    trail: true,
  } as SlashConfig,
  
  /** 重击 - 双斜线 */
  heavy: {
    count: 2,
    width: 4,
    duration: 3000,
    color: 'rgba(255, 50, 50, 0.9)',
    glow: true,
    trail: true,
  } as SlashConfig,
  
  /** 暴击 - 三条交叉 */
  critical: {
    count: 3,
    width: 5,
    duration: 3000,
    color: 'rgba(255, 220, 50, 0.95)',
    glow: true,
    trail: true,
  } as SlashConfig,
} as const;

/** 根据伤害值获取预设 */
export const getSlashPresetByDamage = (damage: number): SlashConfig => {
  if (damage >= 10) return SLASH_PRESETS.critical;
  if (damage >= 6) return SLASH_PRESETS.heavy;
  if (damage >= 3) return SLASH_PRESETS.normal;
  return SLASH_PRESETS.light;
};
