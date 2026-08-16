/**
 * 召唤师战争 - 棋盘辅助效果
 *
 * 特效渲染已迁移至引擎级 FX 系统（src/engine/fx/ + ui/fxSetup.ts）。
 * 本文件仅保留与 FX 系统无关的辅助功能。
 */

import { useCallback, useEffect, useRef } from 'react';
import { subscribeFxFrame } from '../../../engine/fx';

// ============================================================================
// 全屏震动 Hook（rAF 驱动，指数衰减）
// ============================================================================

export const useScreenShake = () => {
  const shakeTargetRef = useRef<HTMLDivElement | null>(null);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);

  const stopShake = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = undefined;
  }, []);

  const triggerShake = useCallback((
    intensity: 'normal' | 'strong',
    type: 'impact' | 'hit' = 'impact',
  ) => {
    stopShake();
    const target = shakeTargetRef.current;
    if (!target) return;

    target.style.willChange = 'transform';
    const isImpact = type === 'impact';
    const ampX = intensity === 'strong' ? (isImpact ? 4 : 5) : (isImpact ? 2 : 3);
    const ampY = intensity === 'strong' ? (isImpact ? 8 : 4) : (isImpact ? 4 : 2);
    const totalMs = intensity === 'strong' ? 400 : 250;
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= totalMs) {
        target.style.transform = 'translate3d(0,0,0)';
        target.style.willChange = '';
        stopShake();
        return;
      }
      const decay = Math.pow(1 - elapsed / totalMs, 2.5);
      const freq = isImpact ? 25 : 20;
      const phase = elapsed * freq / 1000 * Math.PI * 2;
      const x = Math.sin(phase * 1.3) * ampX * decay;
      const y = Math.cos(phase) * ampY * decay;
      target.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    unsubscribeRef.current = subscribeFxFrame(({ now }) => step(now));
  }, [stopShake]);

  useEffect(() => () => {
    stopShake();
    const target = shakeTargetRef.current;
    if (target) {
      target.style.transform = 'translate3d(0,0,0)';
      target.style.willChange = '';
    }
  }, [stopShake]);

  return { shakeTargetRef, triggerShake };
};

