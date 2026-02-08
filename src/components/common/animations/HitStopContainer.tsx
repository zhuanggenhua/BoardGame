/**
 * HitStopContainer - 钝帧/卡肉容器组件
 *
 * 命中瞬间短暂冻结画面 + 微弹，模拟格斗游戏的"卡肉"打击感。
 * 不使用闪白覆盖，而是通过帧冻结 + scale 微弹 + 轻微亮度脉冲实现。
 *
 * 原理：
 * 1. 触发时立即 scale 放大（模拟冲击膨胀）
 * 2. 冻结期间保持放大状态（帧停顿 = 卡肉）
 * 3. 冻结结束后弹性回弹到原始大小
 *
 * @example
 * ```tsx
 * <HitStopContainer isActive={isHit} duration={80}>
 *   <PlayerAvatar />
 * </HitStopContainer>
 * ```
 */

import React, { useEffect, useCallback, useRef } from 'react';

export interface HitStopConfig {
  /** 冻结时长 (ms)，默认 80 */
  duration?: number;
  /** 冲击放大倍数，默认 1.03 */
  scale?: number;
  /** 亮度脉冲强度 (1.0=无变化，1.3=轻微提亮)，默认 1.15 */
  brightness?: number;
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
  scale = 1.03,
  brightness = 1.15,
  className = '',
  style,
}) => {
  const elRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !isActive) return;

    // 阶段 1：立即冲击放大 + 亮度提升（卡肉开始）
    el.style.transition = 'transform 0.02s ease-out, filter 0.02s ease-out';
    el.style.transform = `scale(${scale})`;
    el.style.filter = `brightness(${brightness})`;

    // 阶段 2：冻结期间保持（这就是"卡肉"）
    timerRef.current = window.setTimeout(() => {
      // 阶段 3：弹性回弹到原始大小
      el.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.15s ease-out';
      el.style.transform = 'scale(1)';
      el.style.filter = 'brightness(1)';
    }, duration);

    return () => {
      window.clearTimeout(timerRef.current);
      // 清理：确保不残留变换
      el.style.transition = '';
      el.style.transform = '';
      el.style.filter = '';
    };
  }, [isActive, duration, scale, brightness]);

  return (
    <div
      ref={elRef}
      className={`relative ${className}`}
      style={style}
    >
      {children}
    </div>
  );
};

/** Hook：管理钝帧状态 */
export const useHitStop = (defaultDuration = 80) => {
  const [isActive, setIsActive] = React.useState(false);
  const timerRef = useRef<number>(0);

  const triggerHitStop = useCallback((overrideConfig?: HitStopConfig) => {
    setIsActive(true);
    window.clearTimeout(timerRef.current);

    const dur = (overrideConfig?.duration ?? defaultDuration) + 250;
    timerRef.current = window.setTimeout(() => {
      setIsActive(false);
    }, dur);
  }, [defaultDuration]);

  return { isActive, triggerHitStop };
};

/** 预设配置 — 卡肉感从轻到重 */
export const HIT_STOP_PRESETS = {
  /** 轻击 - 微弱卡顿 */
  light: {
    duration: 60,
    scale: 1.02,
    brightness: 1.1,
  } as HitStopConfig,

  /** 普通击中 */
  normal: {
    duration: 100,
    scale: 1.04,
    brightness: 1.15,
  } as HitStopConfig,

  /** 重击 - 明显冻结 */
  heavy: {
    duration: 160,
    scale: 1.06,
    brightness: 1.2,
  } as HitStopConfig,

  /** 暴击 - 最大卡肉 */
  critical: {
    duration: 220,
    scale: 1.08,
    brightness: 1.25,
  } as HitStopConfig,
} as const;

/** 根据伤害值获取预设 */
export const getHitStopPresetByDamage = (damage: number): HitStopConfig => {
  if (damage >= 10) return HIT_STOP_PRESETS.critical;
  if (damage >= 6) return HIT_STOP_PRESETS.heavy;
  if (damage >= 3) return HIT_STOP_PRESETS.normal;
  return HIT_STOP_PRESETS.light;
};
