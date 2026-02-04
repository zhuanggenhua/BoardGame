/**
 * HitStopContainer - 钝帧/帧冻结容器组件
 * 
 * 在受击瞬间短暂暂停画面，增强打击感。
 * 通用层组件，可被任何游戏复用。
 * 
 * @example
 * ```tsx
 * <HitStopContainer isActive={isHit} duration={80}>
 *   <PlayerAvatar />
 * </HitStopContainer>
 * ```
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';

export interface HitStopConfig {
  /** 冻结时长 (ms)，默认 80 */
  duration?: number;
  /** 轻微放大倍数，默认 1.02 */
  scale?: number;
  /** 是否增加对比度/饱和度效果 */
  enhanceContrast?: boolean;
  /** 闪白效果强度 (0-1)，默认 0.3 */
  flashIntensity?: number;
}

export interface HitStopContainerProps extends HitStopConfig {
  children: React.ReactNode;
  /** 是否激活钝帧效果 */
  isActive: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** 钝帧容器组件 */
export const HitStopContainer: React.FC<HitStopContainerProps> = ({
  children,
  isActive,
  duration = 80,
  scale = 1.02,
  enhanceContrast = true,
  flashIntensity = 0.3,
  className = '',
  style,
}) => {
  const controls = useAnimation();
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (isActive) {
      // 触发闪白
      setIsFlashing(true);
      
      // 触发缩放 + 滤镜
      controls.start({
        scale,
        filter: enhanceContrast ? 'contrast(1.4) saturate(1.6)' : 'none',
        transition: { duration: 0.02 },
      });

      // 钝帧期间暂停
      const freezeTimer = setTimeout(() => {
        // 恢复正常
        controls.start({
          scale: 1,
          filter: 'none',
          transition: { duration: 0.1, ease: 'easeOut' },
        });
        setIsFlashing(false);
      }, duration);

      return () => clearTimeout(freezeTimer);
    }
  }, [isActive, controls, duration, scale, enhanceContrast]);

  return (
    <motion.div
      className={`relative ${className}`}
      style={style}
      animate={controls}
    >
      {children}
      {/* 闪白叠加层 */}
      {isFlashing && (
        <div
          className="absolute inset-0 pointer-events-none rounded-inherit"
          style={{
            backgroundColor: `rgba(255, 255, 255, ${flashIntensity})`,
            mixBlendMode: 'overlay',
          }}
        />
      )}
    </motion.div>
  );
};

/** Hook：管理钝帧状态 */
export const useHitStop = (defaultDuration = 80) => {
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<HitStopConfig>({ duration: defaultDuration });

  const triggerHitStop = useCallback((overrideConfig?: HitStopConfig) => {
    const finalConfig = { ...config, ...overrideConfig };
    setConfig(finalConfig);
    setIsActive(true);

    const timer = setTimeout(() => {
      setIsActive(false);
    }, (finalConfig.duration ?? defaultDuration) + 100); // 额外100ms确保动画完成

    return () => clearTimeout(timer);
  }, [config, defaultDuration]);

  return { isActive, config, triggerHitStop };
};

/** 预设配置 */
export const HIT_STOP_PRESETS = {
  /** 轻击 - 快速微妙 */
  light: {
    duration: 120,
    scale: 1.04,
    flashIntensity: 0.4,
    enhanceContrast: true,
  } as HitStopConfig,
  
  /** 普通击中 */
  normal: {
    duration: 140,
    scale: 1.05,
    flashIntensity: 0.55,
    enhanceContrast: true,
  } as HitStopConfig,
  
  /** 重击 - 明显冻结 */
  heavy: {
    duration: 180,
    scale: 1.07,
    flashIntensity: 0.7,
    enhanceContrast: true,
  } as HitStopConfig,
  
  /** 暴击 - 最大冲击 */
  critical: {
    duration: 220,
    scale: 1.1,
    flashIntensity: 0.85,
    enhanceContrast: true,
  } as HitStopConfig,
} as const;

/** 根据伤害值获取预设 */
export const getHitStopPresetByDamage = (damage: number): HitStopConfig => {
  if (damage >= 10) return HIT_STOP_PRESETS.critical;
  if (damage >= 6) return HIT_STOP_PRESETS.heavy;
  if (damage >= 3) return HIT_STOP_PRESETS.normal;
  return HIT_STOP_PRESETS.light;
};
