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

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import type { FxQuality } from '../../../engine/fx';
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
  /** 整体延迟启动（毫秒），用于让受击层和投射物命中帧对齐 */
  startDelayMs?: number;
  /** 伤害数字延迟（毫秒），用于和命中帧对齐 */
  numberDelayMs?: number;
  /** 伤害数字稳定测试选择器 */
  numberTestId?: string;
  /** 伤害数字字号倍率 */
  numberFontScale?: number;
  /** 伤害数字颜色 class */
  numberColorClass?: string;
  /** 伤害数字动画时长（秒），用于远景棋盘截图保留更长可读窗口 */
  numberDurationSeconds?: number;
  /** 自定义斜切颜色 */
  slashColor?: string;
  /** 自定义红脉冲颜色 */
  pulseColor?: string;
  /** 斜切 Canvas 时长（ms），默认使用伤害预设 */
  slashDurationMs?: number;
  /** 斜切触发保持时间（ms），默认 100 */
  slashActiveMs?: number;
  /** 红脉冲动画时长（ms），默认按强度决定 */
  pulseDurationMs?: number;
  /** 红脉冲触发保持时间（ms），默认按强度决定 */
  pulseActiveMs?: number;
  /** 完成回调延迟（ms），默认 800 */
  completeMs?: number;
  /** 特效质量档 */
  quality?: FxQuality;
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
  startDelayMs = 0,
  numberDelayMs = 0,
  numberTestId,
  numberFontScale,
  numberColorClass,
  numberDurationSeconds,
  slashColor,
  pulseColor,
  slashDurationMs,
  slashActiveMs = 100,
  pulseDurationMs,
  pulseActiveMs,
  completeMs = 800,
  quality = 'full',
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
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) return;

    const timers: number[] = [];

    const triggerEffects = () => {
      if (showSlash) {
        setSlashActive(true);
        timers.push(window.setTimeout(() => setSlashActive(false), slashActiveMs));
      }

      if (showRedPulse) {
        setPulseActive(true);
        timers.push(window.setTimeout(() => setPulseActive(false), pulseActiveMs ?? (isStrong ? 500 : 350)));
      }

      if (showNumber) {
        setDmgKey(k => k + 1);
      }
    };

    if (startDelayMs > 0) {
      timers.push(window.setTimeout(triggerEffects, startDelayMs));
    } else {
      triggerEffects();
    }

    // 完成回调：等最长的效果结束
    timers.push(window.setTimeout(() => onCompleteRef.current?.(), startDelayMs + completeMs));

    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [active, showSlash, showRedPulse, showNumber, isStrong, slashActiveMs, pulseActiveMs, startDelayMs, completeMs]);

  if (!active) return null;

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ overflow: 'visible' }}
    >
      {showSlash && (
        <RiftSlash
          isActive={slashActive}
          {...preset}
          color={slashColor ?? preset.color}
          duration={slashDurationMs ?? preset.duration}
          quality={quality}
        />
      )}

      {showRedPulse && (
        <RedPulse
          active={pulseActive}
          strong={isStrong}
          color={pulseColor}
          duration={pulseDurationMs !== undefined ? pulseDurationMs / 1000 : undefined}
        />
      )}

      {showNumber && (
        <DamageNumber
          triggerKey={dmgKey}
          damage={damage}
          strong={isStrong}
          delay={numberDelayMs / 1000}
          testId={numberTestId}
          fontScale={numberFontScale}
          colorClass={numberColorClass}
          durationSeconds={numberDurationSeconds}
        />
      )}
    </div>
  );
};
