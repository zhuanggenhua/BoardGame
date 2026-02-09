/**
 * 召唤师战争 - 棋盘特效层
 *
 * 所有视觉特效已抽离为通用组件（SummonEffect/ConeBlast/DamageFlash），
 * 本文件仅负责棋盘坐标适配和效果调度。
 */

import React, { useState, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SummonEffect } from '../../../components/common/animations/SummonEffect';
import { ConeBlast } from '../../../components/common/animations/ConeBlast';
import { DamageFlash } from '../../../components/common/animations/DamageFlash';
import { ImpactContainer } from '../../../components/common/animations/ImpactContainer';

// ============================================================================
// 效果类型
// ============================================================================

export interface BoardEffectData {
  id: string;
  type: 'summon' | 'shockwave' | 'damage';
  position: { row: number; col: number };
  intensity: 'normal' | 'strong';
  /** 伤害值（damage 效果时使用） */
  damageAmount?: number;
  /** 攻击类型（shockwave 使用） */
  attackType?: 'melee' | 'ranged';
  /** 攻击源位置（shockwave 使用） */
  sourcePosition?: { row: number; col: number };
}

// ============================================================================
// 召唤效果（委托通用 SummonEffect 组件）
// ============================================================================

const SummonEffectAdapter: React.FC<{
  effect: BoardEffectData;
  getCellPosition: (row: number, col: number) => { left: number; top: number; width: number; height: number };
  onComplete: (id: string) => void;
}> = ({ effect, getCellPosition, onComplete }) => {
  const pos = getCellPosition(effect.position.row, effect.position.col);
  const isStrong = effect.intensity === 'strong';

  return (
    <div
      className="absolute pointer-events-none z-30"
      style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: `${pos.width}%`, height: `${pos.height}%` }}
    >
      <SummonEffect
        active
        intensity={effect.intensity}
        color={isStrong ? 'gold' : 'blue'}
        onComplete={() => onComplete(effect.id)}
      />
    </div>
  );
};

// ============================================================================
// 攻击气浪（委托通用 ConeBlast 组件）
// ============================================================================

const ShockwaveEffect: React.FC<{
  effect: BoardEffectData;
  getCellPosition: (row: number, col: number) => { left: number; top: number; width: number; height: number };
  onComplete: (id: string) => void;
}> = ({ effect, getCellPosition, onComplete }) => {
  const src = effect.sourcePosition;
  if (!src) { onComplete(effect.id); return null; }

  const isRanged = effect.attackType === 'ranged';

  // 近战：不需要气浪投射，直接在目标位置播放受击反馈
  if (!isRanged) {
    const tgtPos = getCellPosition(effect.position.row, effect.position.col);
    const dmg = effect.damageAmount ?? (effect.intensity === 'strong' ? 3 : 1);
    return (
      <ImpactContainer
        isActive
        damage={dmg}
        effects={{ shake: true, hitStop: false }}
        className="absolute pointer-events-none z-30"
        style={{ left: `${tgtPos.left}%`, top: `${tgtPos.top}%`, width: `${tgtPos.width}%`, height: `${tgtPos.height}%`, overflow: 'visible' }}
        onComplete={() => onComplete(effect.id)}
      >
        <DamageFlash
          active
          damage={dmg}
          intensity={effect.intensity}
        />
      </ImpactContainer>
    );
  }

  // 远程：旋风锥形气浪从源飞向目标
  const srcPos = getCellPosition(src.row, src.col);
  const tgtPos = getCellPosition(effect.position.row, effect.position.col);

  const srcCx = srcPos.left + srcPos.width / 2;
  const srcCy = srcPos.top + srcPos.height / 2;
  const tgtCx = tgtPos.left + tgtPos.width / 2;
  const tgtCy = tgtPos.top + tgtPos.height / 2;

  return (
    <ConeBlast
      start={{ xPct: srcCx, yPct: srcCy }}
      end={{ xPct: tgtCx, yPct: tgtCy }}
      intensity={effect.intensity}
      onComplete={() => onComplete(effect.id)}
      className="z-30"
    />
  );
};

// ============================================================================
// 受伤效果（委托通用 DamageFlash 组件）
// ============================================================================

const DamageEffectAdapter: React.FC<{
  effect: BoardEffectData;
  getCellPosition: (row: number, col: number) => { left: number; top: number; width: number; height: number };
  onComplete: (id: string) => void;
}> = ({ effect, getCellPosition, onComplete }) => {
  const pos = getCellPosition(effect.position.row, effect.position.col);
  const isStrong = effect.intensity === 'strong';
  const dmg = effect.damageAmount ?? (isStrong ? 3 : 1);

  return (
    <ImpactContainer
      isActive
      damage={dmg}
      effects={{ shake: true, hitStop: false }}
      className="absolute pointer-events-none z-30"
      style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: `${pos.width}%`, height: `${pos.height}%`, overflow: 'visible' }}
      onComplete={() => onComplete(effect.id)}
    >
      <DamageFlash
        active
        damage={dmg}
        intensity={effect.intensity}
      />
    </ImpactContainer>
  );
};

// ============================================================================
// 全屏震动 Hook（rAF 驱动，指数衰减）
// ============================================================================

export const useScreenShake = () => {
  const [shakeStyle, setShakeStyle] = useState<React.CSSProperties>({});
  const rafRef = useRef<number>(0);

  const triggerShake = useCallback((
    intensity: 'normal' | 'strong',
    type: 'impact' | 'hit' = 'impact',
  ) => {
    cancelAnimationFrame(rafRef.current);
    const isImpact = type === 'impact';
    const ampX = intensity === 'strong' ? (isImpact ? 4 : 5) : (isImpact ? 2 : 3);
    const ampY = intensity === 'strong' ? (isImpact ? 8 : 4) : (isImpact ? 4 : 2);
    const totalMs = intensity === 'strong' ? 400 : 250;
    const start = performance.now();

    const step = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= totalMs) {
        setShakeStyle({ transform: 'translate3d(0,0,0)' });
        return;
      }
      const decay = Math.pow(1 - elapsed / totalMs, 2.5);
      const freq = isImpact ? 25 : 20;
      const phase = elapsed * freq / 1000 * Math.PI * 2;
      const x = Math.sin(phase * 1.3) * ampX * decay;
      const y = Math.cos(phase) * ampY * decay;
      setShakeStyle({ transform: `translate3d(${x}px, ${y}px, 0)` });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  return { shakeStyle, triggerShake };
};

// ============================================================================
// 效果层
// ============================================================================

export const BoardEffectsLayer: React.FC<{
  effects: BoardEffectData[];
  getCellPosition: (row: number, col: number) => { left: number; top: number; width: number; height: number };
  onEffectComplete: (id: string) => void;
}> = ({ effects, getCellPosition, onEffectComplete }) => (
  <AnimatePresence>
    {effects.map((effect) => {
      switch (effect.type) {
        case 'summon':
          return <SummonEffectAdapter key={effect.id} effect={effect} getCellPosition={getCellPosition} onComplete={onEffectComplete} />;
        case 'shockwave':
          return <ShockwaveEffect key={effect.id} effect={effect} getCellPosition={getCellPosition} onComplete={onEffectComplete} />;
        case 'damage':
          return <DamageEffectAdapter key={effect.id} effect={effect} getCellPosition={getCellPosition} onComplete={onEffectComplete} />;
        default:
          return null;
      }
    })}
  </AnimatePresence>
);

// ============================================================================
// Hook：管理棋盘效果状态
// ============================================================================

export const useBoardEffects = () => {
  const [effects, setEffects] = useState<BoardEffectData[]>([]);

  const pushEffect = useCallback((effect: Omit<BoardEffectData, 'id'>) => {
    const id = `fx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setEffects((prev) => [...prev, { ...effect, id }]);
  }, []);

  const removeEffect = useCallback((id: string) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { effects, pushEffect, removeEffect };
};
