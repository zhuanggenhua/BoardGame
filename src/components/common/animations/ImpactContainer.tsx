/**
 * ImpactContainer - 打击感组合容器
 * 
 * 组合震动、斜切、钝帧等效果，提供统一的打击感体验。
 * 通用层组件，可被任何游戏复用。
 * 
 * @example
 * ```tsx
 * <ImpactContainer
 *   isActive={isBeingHit}
 *   damage={8}
 *   effects={{ shake: true, slash: true, hitStop: true }}
 * >
 *   <OpponentPanel />
 * </ImpactContainer>
 * ```
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SlashEffect, getSlashPresetByDamage, type SlashConfig } from './SlashEffect';
import { HitStopContainer, getHitStopPresetByDamage, type HitStopConfig } from './HitStopContainer';

export type ImpactIntensity = 'light' | 'normal' | 'heavy' | 'critical';

export interface ImpactEffects {
  /** 启用震动效果 */
  shake?: boolean;
  /** 启用斜切效果 */
  slash?: boolean;
  /** 启用钝帧效果 */
  hitStop?: boolean;
  /** 启用屏幕闪烁 */
  screenFlash?: boolean;
}

export interface ImpactConfig {
  /** 效果强度，可用伤害值自动推断 */
  intensity?: ImpactIntensity;
  /** 伤害值（用于自动推断强度） */
  damage?: number;
  /** 自定义震动配置 */
  shakeConfig?: {
    duration?: number;
    intensity?: number;
  };
  /** 自定义斜切配置 */
  slashConfig?: SlashConfig;
  /** 自定义钝帧配置 */
  hitStopConfig?: HitStopConfig;
}

export interface ImpactContainerProps extends ImpactConfig {
  children: React.ReactNode;
  /** 是否激活打击效果 */
  isActive: boolean;
  /** 启用的效果类型 */
  effects?: ImpactEffects;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

/** 根据伤害值推断强度等级 */
const getIntensityByDamage = (damage: number): ImpactIntensity => {
  if (damage >= 10) return 'critical';
  if (damage >= 6) return 'heavy';
  if (damage >= 3) return 'normal';
  return 'light';
};

/** 强度对应的震动参数 */
const SHAKE_INTENSITY_MAP: Record<ImpactIntensity, number[]> = {
  light: [-2, 2, -1, 1, 0],
  normal: [-4, 4, -3, 3, -1, 1, 0],
  heavy: [-6, 6, -5, 5, -3, 3, -1, 1, 0],
  critical: [-10, 10, -8, 8, -5, 5, -3, 3, -1, 0],
};

/** 打击感组合容器 */
export const ImpactContainer: React.FC<ImpactContainerProps> = ({
  children,
  isActive,
  effects = { shake: true, slash: true, hitStop: true },
  intensity: explicitIntensity,
  damage = 0,
  shakeConfig,
  slashConfig,
  hitStopConfig,
  className = '',
  style,
  onClick,
}) => {
  const [isShaking, setIsShaking] = useState(false);
  const [isHitStopping, setIsHitStopping] = useState(false);
  const [isSlashing, setIsSlashing] = useState(false);

  // 推断强度
  const intensity = explicitIntensity ?? getIntensityByDamage(damage);

  useEffect(() => {
    if (isActive) {
      // 同时触发所有启用的效果
      if (effects.hitStop) {
        setIsHitStopping(true);
        const hitStopPreset = hitStopConfig ?? getHitStopPresetByDamage(damage);
        setTimeout(() => setIsHitStopping(false), (hitStopPreset.duration ?? 80) + 50);
      }

      if (effects.slash) {
        setIsSlashing(true);
        setTimeout(() => setIsSlashing(false), 50);
      }

      if (effects.shake) {
        // 钝帧结束后开始震动（顺序感更好）
        const shakeDelay = effects.hitStop ? (hitStopConfig?.duration ?? getHitStopPresetByDamage(damage).duration ?? 80) : 0;
        setTimeout(() => {
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), shakeConfig?.duration ?? 400);
        }, shakeDelay);
      }
    }
  }, [isActive, effects, damage, hitStopConfig, shakeConfig]);

  // 获取震动变体（根据强度动态生成）
  const dynamicShakeVariants = {
    idle: { x: 0 },
    shake: {
      x: SHAKE_INTENSITY_MAP[intensity],
      transition: {
        duration: (shakeConfig?.duration ?? 400) / 1000,
        ease: 'easeInOut' as const,
      },
    },
  };

  // 获取斜切预设
  const finalSlashConfig = slashConfig ?? getSlashPresetByDamage(damage);
  const finalHitStopConfig = hitStopConfig ?? getHitStopPresetByDamage(damage);

  return (
    <HitStopContainer
      isActive={effects.hitStop ? isHitStopping : false}
      {...finalHitStopConfig}
      className={className}
      style={style}
    >
      <motion.div
        className="relative w-full h-full"
        variants={dynamicShakeVariants}
        animate={isShaking ? 'shake' : 'idle'}
        onClick={onClick}
      >
        {children}
        
        {/* 斜切效果层 */}
        {effects.slash && (
          <SlashEffect
            isActive={isSlashing}
            {...finalSlashConfig}
          />
        )}
      </motion.div>
    </HitStopContainer>
  );
};

/** Hook：统一管理打击感状态 */
export const useImpact = () => {
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<ImpactConfig>({});

  const triggerImpact = useCallback((overrideConfig?: ImpactConfig) => {
    const finalConfig = { ...config, ...overrideConfig };
    setConfig(finalConfig);
    setIsActive(true);

    // 短暂激活后自动关闭
    const timer = setTimeout(() => {
      setIsActive(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [config]);

  return { isActive, config, triggerImpact };
};

/** 预设：根据伤害值获取完整配置 */
export const getImpactPresetByDamage = (damage: number): ImpactConfig => ({
  damage,
  intensity: getIntensityByDamage(damage),
  slashConfig: getSlashPresetByDamage(damage),
  hitStopConfig: getHitStopPresetByDamage(damage),
});
