/**
 * BaseCaptureEffect — 基地占领特效（Canvas 2D）
 *
 * 三阶段动画序列：
 * 1. 旧基地碎裂消散（碎片向外飞散 + 淡出）
 * 2. 能量粒子汇聚到中心（过渡）
 * 3. 新基地从中心展开出现（缩放 + 淡入）
 *
 * 使用场景：SmashUp 基地被占领后替换
 * 物理模型：俯视角（gravity=0，平面扩散）
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  type Particle,
  type ParticlePreset,
  parseColorToRgb,
  spawnParticles,
  updateParticles,
  drawParticles,
} from './canvasParticleEngine';

export interface BaseCaptureEffectProps {
  /** 是否激活 */
  active: boolean;
  /** 碎裂阶段颜色（旧基地主色调） */
  shatterColors?: string[];
  /** 汇聚粒子颜色（能量色） */
  gatherColors?: string[];
  /** 是否显示碎裂/汇聚粒子（默认 true） */
  showParticles?: boolean;
  /** 是否显示中心光晕（默认 true） */
  showGlow?: boolean;
  /** 完成回调 */
  onComplete?: () => void;
  /** 碎裂完成、新基地开始出现时的回调（用于切换显示内容） */
  onTransition?: () => void;
  className?: string;
}

/** 碎裂阶段粒子预设 — 俯视角径向扩散 */
const SHATTER_PRESET: ParticlePreset = {
  count: 24,
  speed: { min: 3, max: 8 },
  size: { min: 3, max: 6 },
  life: { min: 0.4, max: 0.8 },
  gravity: 0,
  shapes: ['square', 'streak'],
  rotate: true,
  opacityDecay: true,
  sizeDecay: true,
  direction: 'none',
  glow: true,
  glowScale: 2,
  drag: 0.93,
  additive: false,
  trailLength: 3,
  colorEnd: '#1e293b',
  turbulence: 0.3,
};

/** 汇聚阶段粒子预设 — 向中心收缩 */
const GATHER_PRESET: ParticlePreset = {
  count: 16,
  speed: { min: 1, max: 3 },
  size: { min: 2, max: 5 },
  life: { min: 0.6, max: 1.0 },
  gravity: 0,
  shapes: ['circle', 'star'],
  rotate: true,
  opacityDecay: true,
  sizeDecay: false,
  direction: 'none',
  glow: true,
  glowScale: 3,
  drag: 0.96,
  additive: true,
  spread: 360,
  turbulence: 0.5,
  pulse: 0.2,
  pulseFreq: 6,
};

/** 安全超时（毫秒） */
const SAFETY_TIMEOUT_MS = 4000;

export const BaseCaptureEffect: React.FC<BaseCaptureEffectProps> = ({
  active,
  shatterColors = ['#94a3b8', '#64748b', '#475569', '#cbd5e1'],
  gatherColors = ['#fbbf24', '#f59e0b', '#fcd34d', '#fff'],
  showParticles = true,
  showGlow = true,
  onComplete,
  onTransition,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const safetyTimerRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const onTransitionRef = useRef(onTransition);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onTransitionRef.current = onTransition; }, [onTransition]);

  const render = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const overflow = 1.5;
    const baseW = container.offsetWidth;
    const baseH = container.offsetHeight;
    const cw = baseW * overflow;
    const ch = baseH * overflow;

    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    const offsetPct = ((overflow - 1) / 2) * 100;
    canvas.style.left = `-${offsetPct}%`;
    canvas.style.top = `-${offsetPct}%`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = cw / 2;
    const cy = ch / 2;

    // 阶段1：碎裂粒子（从中心向外飞散）
    const shatterRgb = shatterColors.map(parseColorToRgb);
    const shatterParticles = showParticles && shatterRgb.length > 0
      ? spawnParticles(SHATTER_PRESET, shatterRgb, cx, cy)
      : [];

    // 阶段2：汇聚粒子（从外围向中心收缩）— 延迟生成
    const gatherRgb = gatherColors.map(parseColorToRgb);
    let gatherParticles: Particle[] = [];
    let gatherSpawned = false;
    let transitionFired = false;

    // 阶段3：中心光晕（新基地出现的视觉提示）
    let glowAlpha = 0;
    let glowPhase: 'off' | 'in' | 'hold' | 'out' = 'off';

    let elapsed = 0;
    let lastTime = 0;

    const loop = (now: number) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += dt;

      ctx.clearRect(0, 0, cw, ch);

      // 阶段1：碎裂（0 ~ 0.8s）
      const shatterAlive = updateParticles(shatterParticles, dt, SHATTER_PRESET);
      if (shatterAlive > 0) {
        drawParticles(ctx, shatterParticles, SHATTER_PRESET, cw, ch);
      }

      // 阶段2：汇聚粒子（0.3s 后生成，从外围向中心飞）
      if (elapsed > 0.3 && !gatherSpawned) {
        gatherSpawned = true;
        if (showParticles && gatherRgb.length > 0) {
          // 在外围生成粒子，手动设置速度指向中心
          const spread = Math.min(baseW, baseH) * 0.6;
          gatherParticles = spawnParticles(GATHER_PRESET, gatherRgb, cx, cy);
          for (const p of gatherParticles) {
            // 将粒子移到外围随机位置
            const angle = Math.random() * Math.PI * 2;
            const dist = spread * (0.5 + Math.random() * 0.5);
            p.x = cx + Math.cos(angle) * dist;
            p.y = cy + Math.sin(angle) * dist;
            // 速度指向中心
            const dx = cx - p.x;
            const dy = cy - p.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const spd = 2 + Math.random() * 4;
            p.vx = (dx / d) * spd;
            p.vy = (dy / d) * spd;
          }
        }
      }

      let gatherAlive = 0;
      if (gatherParticles.length > 0) {
        gatherAlive = updateParticles(gatherParticles, dt, GATHER_PRESET);
        if (gatherAlive > 0) {
          drawParticles(ctx, gatherParticles, GATHER_PRESET, cw, ch);
        }
      }

      // 阶段3：中心光晕（0.5s 后开始）
      if (elapsed > 0.5 && glowPhase === 'off') {
        glowPhase = 'in';
        if (!transitionFired) {
          transitionFired = true;
          onTransitionRef.current?.();
        }
      }

      if (showGlow) {
        if (glowPhase === 'in') {
          glowAlpha = Math.min(glowAlpha + dt * 3, 0.6);
          if (glowAlpha >= 0.6) glowPhase = 'hold';
        } else if (glowPhase === 'hold' && elapsed > 1.2) {
          glowPhase = 'out';
        } else if (glowPhase === 'out') {
          glowAlpha = Math.max(glowAlpha - dt * 2, 0);
        }

        if (glowAlpha > 0.01) {
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(baseW, baseH) * 0.5);
          grad.addColorStop(0, `rgba(251, 191, 36, ${glowAlpha})`);
          grad.addColorStop(0.5, `rgba(245, 158, 11, ${glowAlpha * 0.4})`);
          grad.addColorStop(1, `rgba(245, 158, 11, 0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, cw, ch);
        }
      }

      // 结束判定：所有粒子消散 + 光晕消失
      const allDone = elapsed > 1.5 && shatterAlive === 0
        && gatherAlive === 0
        && glowAlpha < 0.01;

      if (allDone || elapsed > 3) {
        onCompleteRef.current?.();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [shatterColors, gatherColors, showParticles, showGlow]);

  useEffect(() => {
    if (!active) return;
    safetyTimerRef.current = window.setTimeout(() => {
      onCompleteRef.current?.();
    }, SAFETY_TIMEOUT_MS);
    render();
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(safetyTimerRef.current);
    };
  }, [active, render]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ overflow: 'visible', zIndex: 10 }}
    >
      <canvas
        ref={canvasRef}
        className="absolute pointer-events-none"
      />
    </div>
  );
};
