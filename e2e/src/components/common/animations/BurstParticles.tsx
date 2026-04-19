/**
 * BurstParticles - 通用爆发粒子特效组件（Canvas 2D）
 *
 * 用于一次性爆发 → 衰减消散的粒子效果（爆炸碎片、召唤光粒子、烟尘等）。
 * 基于自研 Canvas 粒子引擎，径向辉光+核心双层绘制，支持 additive 混合。
 *
 * Canvas 默认比容器大 2 倍（overflow），确保粒子不被裁切。
 *
 * @example
 * ```tsx
 * <BurstParticles
 *   active={isExploding}
 *   preset="explosion"
 *   color={['#f87171', '#fb923c', '#fbbf24']}
 *   onComplete={() => setIsExploding(false)}
 * />
 * ```
 */

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  type ParticlePreset,
  type Particle,
  parseColorToRgb,
  spawnParticles,
  updateParticles,
  drawParticles,
} from './canvasParticleEngine';

// ============================================================================
// 预设配置
// ============================================================================

export const BURST_PRESETS: Record<string, ParticlePreset> = {
  /** 爆炸碎片 - 用于单位/建筑摧毁（俯视角：径向扩散+减速停止） */
  explosion: {
    count: 28,
    speed: { min: 3, max: 7 },
    size: { min: 2, max: 5 },
    life: { min: 0.4, max: 0.9 },
    gravity: 0, // 俯视角无重力
    shapes: ['circle', 'square', 'streak'],
    rotate: true,
    opacityDecay: true,
    sizeDecay: true,
    direction: 'none', // 径向扩散
    glow: true,
    glowScale: 2.5,
    drag: 0.94, // 快速减速
    additive: true,
    trailLength: 4,
    colorEnd: '#4a1010',
    turbulence: 0.2, // 轻微扰动
  },
  /** 强力爆炸 - 用于建筑/冠军摧毁（更多粒子+更快扩散） */
  explosionStrong: {
    count: 42,
    speed: { min: 4, max: 10 },
    size: { min: 3, max: 7 },
    life: { min: 0.5, max: 1.1 },
    gravity: 0, // 俯视角无重力
    shapes: ['circle', 'square', 'star', 'streak'],
    rotate: true,
    opacityDecay: true,
    sizeDecay: true,
    direction: 'none', // 径向扩散
    glow: true,
    glowScale: 3,
    drag: 0.92, // 快速减速
    additive: true,
    trailLength: 5,
    colorEnd: '#3b0a0a',
    turbulence: 0.3,
    pulse: 0.15,
  },
  /** 召唤光粒子 - 从中心向外扩散的发光粒子（俯视角：径向+湍流飘动） */
  summonGlow: {
    count: 18,
    speed: { min: 1, max: 3 },
    size: { min: 3, max: 7 },
    life: { min: 0.8, max: 1.4 },
    gravity: 0, // 俯视角无重力
    shapes: ['circle'],
    rotate: false,
    opacityDecay: true,
    sizeDecay: true,
    direction: 'none', // 径向扩散
    glow: true,
    glowScale: 3.5,
    drag: 0.96, // 缓慢减速
    additive: true,
    spread: 360, // 全方向
    turbulence: 0.8,
    turbulenceFreq: 1.5,
    pulse: 0.2,
    pulseFreq: 5,
  },
  /** 强力召唤光粒子 - 用于冠军召唤（更多粒子+星形+更强湍流） */
  summonGlowStrong: {
    count: 32,
    speed: { min: 1.5, max: 4 },
    size: { min: 4, max: 9 },
    life: { min: 1.0, max: 1.8 },
    gravity: 0, // 俯视角无重力
    shapes: ['circle', 'star'],
    rotate: true,
    opacityDecay: true,
    sizeDecay: true,
    direction: 'none', // 径向扩散
    glow: true,
    glowScale: 4,
    drag: 0.95, // 缓慢减速
    additive: true,
    spread: 360, // 全方向
    trailLength: 3,
    turbulence: 1.2,
    turbulenceFreq: 1.8,
    pulse: 0.25,
    pulseFreq: 6,
  },
  /** 烟尘 - 用于摧毁后的烟雾扩散（俯视角：平面飘散） */
  smoke: {
    count: 12,
    speed: { min: 1.5, max: 4 },
    size: { min: 4, max: 10 },
    life: { min: 0.5, max: 1.0 },
    gravity: 0, // 俯视角无重力
    shapes: ['circle'],
    rotate: false,
    opacityDecay: true,
    sizeDecay: true,
    direction: 'none', // 径向扩散
    glow: true,
    glowScale: 2,
    drag: 0.96, // 缓慢飘散
    spread: 360, // 全方向
    turbulence: 1.2,
    turbulenceFreq: 2,
    colorEnd: '#1e293b',
  },
  /** 火花飞溅 - 金属碰撞/格挡（streak 为主+高速+短命，保留轻微重力模拟物理感） */
  sparks: {
    count: 20,
    speed: { min: 4, max: 10 },
    size: { min: 1.5, max: 3 },
    life: { min: 0.15, max: 0.4 },
    gravity: 0.5, // 保留轻微重力（火花有物理感）
    shapes: ['streak', 'circle'],
    rotate: false,
    opacityDecay: true,
    sizeDecay: true,
    direction: 'none',
    glow: true,
    glowScale: 2,
    drag: 0.94,
    additive: true,
    streakRatio: 4,
    colorEnd: '#92400e',
  },
  /** 魔法尘 - 轻柔飘散的星形粒子（buff/治疗，俯视角：径向+湍流） */
  magicDust: {
    count: 14,
    speed: { min: 0.5, max: 1.5 },
    size: { min: 2, max: 5 },
    life: { min: 1.0, max: 1.8 },
    gravity: 0, // 俯视角无重力
    shapes: ['star', 'circle'],
    rotate: true,
    opacityDecay: true,
    sizeDecay: true,
    direction: 'none', // 径向扩散
    glow: true,
    glowScale: 3,
    drag: 0.98, // 极缓慢减速
    additive: true,
    spread: 360, // 全方向
    turbulence: 1.0,
    turbulenceFreq: 1.2,
    pulse: 0.3,
    pulseFreq: 4,
  },
};

// ============================================================================
// 组件
// ============================================================================

export interface BurstParticlesProps {
  /** 是否激活 */
  active: boolean;
  /** 预设名称 */
  preset?: keyof typeof BURST_PRESETS;
  /** 自定义配置（覆盖预设） */
  config?: Partial<ParticlePreset>;
  /** 粒子颜色 */
  color?: string[];
  /** 效果完成回调（所有粒子消散后） */
  onComplete?: () => void;
  /** Canvas 溢出倍数（默认 2，即 canvas 比容器大 2 倍以容纳飞出的粒子） */
  overflow?: number;
  /** 额外类名 */
  className?: string;
}

export const BurstParticles: React.FC<BurstParticlesProps> = ({
  active,
  preset = 'explosion',
  config,
  color = ['#f87171', '#fb923c', '#fbbf24', '#fff'],
  onComplete,
  overflow = 2,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  // 用 ref 持有回调，避免 onComplete 引用变化导致 useEffect 重跑（粒子重生）
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const mergedPreset = useMemo<ParticlePreset>(() => {
    const base = BURST_PRESETS[preset] ?? BURST_PRESETS.explosion;
    return config ? { ...base, ...config } : base;
  }, [preset, config]);

  // 用 JSON 序列化做值比较，避免数组字面量引用变化导致 useEffect 重跑
  const colorKey = JSON.stringify(color);
  const rgbColors = useMemo(() => color.map(parseColorToRgb), [colorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // 使用 offsetWidth/offsetHeight 获取 CSS 布局尺寸（不受父级 transform scale 影响）
    const cw = container.offsetWidth * overflow;
    const ch = container.offsetHeight * overflow;

    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 粒子在 canvas 中心生成（对应容器中心）
    particlesRef.current = spawnParticles(mergedPreset, rgbColors, cw / 2, ch / 2);

    let lastTime = 0;

    const loop = (now: number) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, cw, ch);

      const alive = updateParticles(particlesRef.current, dt, mergedPreset);
      drawParticles(ctx, particlesRef.current, mergedPreset, cw, ch);

      if (alive > 0) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        onCompleteRef.current?.();
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      particlesRef.current = [];
    };
  }, [active, mergedPreset, rgbColors, overflow]);

  if (!active || typeof window === 'undefined') return null;

  // canvas 居中于容器，溢出不裁切
  const offset = ((overflow - 1) / 2) * 100;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ overflow: 'visible' }}
      data-burst-particles
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        className="absolute pointer-events-none"
        style={{
          left: `-${offset}%`,
          top: `-${offset}%`,
        }}
      />
    </div>
  );
};

export default BurstParticles;
