/**
 * HitStopContainer - 钝帧容器组件
 *
 * 命中瞬间短暂冻结画面，模拟格斗游戏的"卡肉"打击感。
 * 通过 CSS 类暂停所有子元素的动画和过渡实现纯冻结效果。
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
  className = '',
  style,
}) => {
  const elRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !isActive) return;

    // 冻结：暂停所有子元素的动画（纯钝帧，不做 scale/brightness）
    el.style.animationPlayState = 'paused';
    // 通过 CSS 类让子元素也暂停
    el.classList.add('hitstop-frozen');

    timerRef.current = window.setTimeout(() => {
      // 解冻
      el.style.animationPlayState = '';
      el.classList.remove('hitstop-frozen');
    }, duration);

    return () => {
      window.clearTimeout(timerRef.current);
      el.style.animationPlayState = '';
      el.classList.remove('hitstop-frozen');
    };
  }, [isActive, duration]);

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
  const [config, setConfig] = React.useState<HitStopConfig | undefined>(undefined);
  const timerRef = useRef<number>(0);

  const triggerHitStop = useCallback((overrideConfig?: HitStopConfig) => {
    setIsActive(true);
    setConfig(overrideConfig);
    window.clearTimeout(timerRef.current);

    const dur = (overrideConfig?.duration ?? defaultDuration) + 250;
    timerRef.current = window.setTimeout(() => {
      setIsActive(false);
    }, dur);
  }, [defaultDuration]);

  return { isActive, triggerHitStop, config };
};

/** 预设配置 — 冻结时长从轻到重 */
export const HIT_STOP_PRESETS = {
  /** 轻击 - 微弱卡顿 */
  light: { duration: 60 } as HitStopConfig,
  /** 普通击中 */
  normal: { duration: 100 } as HitStopConfig,
  /** 重击 - 明显冻结 */
  heavy: { duration: 160 } as HitStopConfig,
  /** 暴击 - 最大卡肉 */
  critical: { duration: 220 } as HitStopConfig,
} as const;

/** 根据伤害值获取预设 */
export const getHitStopPresetByDamage = (damage: number): HitStopConfig => {
  if (damage >= 10) return HIT_STOP_PRESETS.critical;
  if (damage >= 6) return HIT_STOP_PRESETS.heavy;
  if (damage >= 3) return HIT_STOP_PRESETS.normal;
  return HIT_STOP_PRESETS.light;
};
