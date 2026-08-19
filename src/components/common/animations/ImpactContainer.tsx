/**
 * ImpactContainer — 打击感容器（包裹目标元素）
 *
 * 负责作用于目标本身的效果：
 * - 震动（ShakeContainer）— 目标元素抖动
 * - 钝帧（HitStopContainer）— 目标元素冻结
 *
 * 不负责视觉覆盖效果（斜切/红脉冲/数字）——这些由 DamageFlash 作为 overlay 叠加。
 *
 * 组合使用：
 * ```tsx
 * <ImpactContainer isActive={hit} damage={8} effects={{ shake: true, hitStop: true }}>
 *   <OpponentPanel />
 *   <DamageFlash active={hit} damage={8} />
 * </ImpactContainer>
 * ```
 */

import React, { useEffect, useState, useCallback } from 'react';
import { HitStopContainer, getHitStopPresetByDamage, type HitStopConfig } from './HitStopContainer';
import { ShakeContainer } from './ShakeContainer';

export interface ImpactEffects {
  /** 启用震动（目标元素抖动） */
  shake?: boolean;
  /** 启用钝帧（目标元素冻结） */
  hitStop?: boolean;
}

export interface ImpactConfig {
  /** 伤害值（用于自动推断各效果强度） */
  damage?: number;
  /** 自定义震动持续时间 (ms) */
  shakeDuration?: number;
  /** 自定义钝帧配置 */
  hitStopConfig?: HitStopConfig;
}

export interface ImpactContainerProps extends ImpactConfig {
  children: React.ReactNode;
  /** 是否激活打击效果 */
  isActive: boolean;
  /** 启用的效果类型 */
  effects?: ImpactEffects;
  /** 完成回调（震动结束时触发） */
  onComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const DEFAULT_EFFECTS: ImpactEffects = {
  shake: true,
  hitStop: false,
};

export const ImpactContainer: React.FC<ImpactContainerProps> = ({
  children,
  isActive,
  effects = DEFAULT_EFFECTS,
  damage = 0,
  shakeDuration = 500,
  hitStopConfig,
  onComplete,
  className = '',
  style,
  onClick,
}) => {
  const [isShaking, setIsShaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isHitStopping, setIsHitStopping] = useState(false);

  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isActive) return;

    const timers: number[] = [];
    const preset = hitStopConfig ?? getHitStopPresetByDamage(damage);
    const hitStopDur = preset.duration ?? 80;
    const doShake = !!effects.shake;
    const doHitStop = !!effects.hitStop;
    const hitStopDelay = doShake ? 80 : 0;

    if (doShake) {
      setIsShaking(true);
      setIsPaused(false);
    }

    if (doHitStop) {
      timers.push(window.setTimeout(() => {
        setIsPaused(true);
        setIsHitStopping(true);

        timers.push(window.setTimeout(() => {
          setIsPaused(false);
          setIsHitStopping(false);
        }, hitStopDur));
      }, hitStopDelay));
    }

    const totalDuration = doShake
      ? shakeDuration + (doHitStop ? hitStopDur : 0)
      : (doHitStop ? hitStopDelay + hitStopDur + 100 : 300);

    timers.push(window.setTimeout(() => {
      setIsShaking(false);
      setIsPaused(false);
      setIsHitStopping(false);
      onCompleteRef.current?.();
    }, totalDuration));

    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalHitStopConfig = hitStopConfig ?? getHitStopPresetByDamage(damage);

  return (
    <ShakeContainer
      isShaking={effects.shake ? isShaking : false}
      paused={isPaused}
      className={className}
      style={{ overflow: 'visible', ...style }}
      onClick={onClick}
    >
      <HitStopContainer
        isActive={effects.hitStop ? isHitStopping : false}
        {...finalHitStopConfig}
        className="relative w-full h-full"
      >
        {children}
      </HitStopContainer>
    </ShakeContainer>
  );
};

export const useImpact = () => {
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<ImpactConfig>({});
  const resetTimerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => {
    if (resetTimerRef.current !== undefined) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = undefined;
    }
  }, []);

  const triggerImpact = useCallback((overrideConfig?: ImpactConfig) => {
    const finalConfig = { ...config, ...overrideConfig };
    setConfig(finalConfig);
    setIsActive(true);
    if (resetTimerRef.current !== undefined) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setIsActive(false);
      resetTimerRef.current = undefined;
    }, 50);
  }, [config]);

  return { isActive, config, triggerImpact };
};

export const getImpactPresetByDamage = (damage: number): ImpactConfig => ({
  damage,
  hitStopConfig: getHitStopPresetByDamage(damage),
});
