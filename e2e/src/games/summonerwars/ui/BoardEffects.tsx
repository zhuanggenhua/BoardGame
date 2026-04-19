/**
 * 召唤师战争 - 棋盘辅助效果
 *
 * 特效渲染已迁移至引擎级 FX 系统（src/engine/fx/ + ui/fxSetup.ts）。
 * 本文件仅保留与 FX 系统无关的辅助功能。
 */

import { useState, useCallback, useRef } from 'react';
import type React from 'react';

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

