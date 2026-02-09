/**
 * DamageFlash — 受伤视觉效果层（纯 overlay）
 *
 * 覆盖在目标元素上的视觉反馈：斜切 + 红脉冲 + 伤害数字。
 * 不包含震动和钝帧——这些作用于目标本身，应由外层 ImpactContainer 负责。
 *
 * 使用方式：
 * 1. 简单场景（只要视觉效果）：直接用 DamageFlash
 * 2. 完整打击感（震动+钝帧+视觉）：ImpactContainer 包裹目标 + DamageFlash
 *
 * @example
 * ```tsx
 * // 简单：只有视觉效果
 * <div className="relative">
 *   <Target />
 *   <DamageFlash active damage={5} />
 * </div>
 *
 * // 完整：震动+钝帧+视觉
 * <ImpactContainer isActive={hit} damage={5} effects={{ shake: true, hitStop: true }}>
 *   <Target />
 *   <DamageFlash active damage={5} />
 * </ImpactContainer>
 * ```
 */

import React, { useState, useEffect, useRef } from 'react';
import { RiftSlash, getRiftPresetByDamage } from './RiftSlash';
import { RedPulse } from './RedPulse';
import { DamageNumber } from './DamageNumber';

export interface DamageFlashProps {
  /** 是否激活 */
  active: boolean;
  /** 伤害值 */
  damage?: number;
  /** 强度 */
  intensity?: 'normal' | 'strong';
  /** 是否显示斜切 */
  showSlash?: boolean;
  /** 是否显示红脉冲 */
  showRedPulse?: boolean;
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
  showSlash = true,
  showRedPulse = true,
  showNumber = true,
  onComplete,
  className = '',
}) => {
  const [slashActive, setSlashActive] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);
  const [dmgKey, setDmgKey] = useState(0);
  const isStrong = intensity === 'strong';
  const preset = getRiftPresetByDamage(isStrong ? 6 : 2);

  // 用 ref 持有 onComplete，避免父组件传内联函数导致 useEffect 重跑
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) return;

    const timers: number[] = [];

    if (showSlash) {
      setSlashActive(true);
      timers.push(window.setTimeout(() => setSlashActive(false), 100));
    }

    if (showRedPulse) {
      setPulseActive(true);
      timers.push(window.setTimeout(() => setPulseActive(false), isStrong ? 500 : 350));
    }

    if (showNumber) {
      setDmgKey(k => k + 1);
    }

    // 完成回调：等最长的效果结束
    timers.push(window.setTimeout(() => onCompleteRef.current?.(), 800));

    return () => timers.forEach(t => window.clearTimeout(t));
  }, [active, showSlash, showRedPulse, showNumber, isStrong]);

  if (!active) return null;

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ overflow: 'visible' }}
    >
      {/* 斜切 */}
      {showSlash && <RiftSlash isActive={slashActive} {...preset} />}

      {/* 红色脉冲 */}
      {showRedPulse && <RedPulse active={pulseActive} strong={isStrong} />}

      {/* 伤害数字 */}
      {showNumber && <DamageNumber triggerKey={dmgKey} damage={damage} strong={isStrong} />}
    </div>
  );
};
