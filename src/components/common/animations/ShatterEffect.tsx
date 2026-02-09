/**
 * ShatterEffect — 碎裂消散特效（Canvas 2D 粒子引擎）
 *
 * 模拟实体被摧毁时碎裂成碎片飞散的效果：
 * - 矩形碎片从中心向外飞散
 * - 带旋转 + 重力下坠 + 淡出
 * - 可选颜色（默认从目标元素取色或使用预设）
 *
 * 使用场景：单位死亡/卡牌销毁
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  type Particle,
  type ParticlePreset,
  createParticle,
  updateParticles,
  drawParticles,
} from './canvasParticleEngine';

export interface ShatterEffectProps {
  /** 是否激活 */
  active: boolean;
  /** 强度：normal=普通死亡，strong=击杀/处决 */
  intensity?: 'normal' | 'strong';
  /** 碎片主色调（RGB 数组），默认石灰色 */
  color?: [number, number, number][];
  /** 完成回调 */
  onComplete?: () => void;
  className?: string;
}

// ============================================================================
// 碎片预设
// ============================================================================

const SHATTER_PRESET_NORMAL: ParticlePreset = {
  count: 20,
  speed: { min: 2, max: 6 },
  size: { min: 3, max: 8 },
  life: { min: 0.5, max: 1.0 },
  gravity: 4,
  shapes: ['square'],
  rotate: true,
  opacityDecay: true,
  sizeDecay: false,
  direction: 'none',
  glow: false,
  drag: 0.97,
  additive: false,
  spread: 4,
  colorEnd: '#1e293b',
};

const SHATTER_PRESET_STRONG: ParticlePreset = {
  count: 35,
  speed: { min: 3, max: 9 },
  size: { min: 3, max: 10 },
  life: { min: 0.6, max: 1.2 },
  gravity: 5,
  shapes: ['square'],
  rotate: true,
  opacityDecay: true,
  sizeDecay: false,
  direction: 'none',
  glow: false,
  drag: 0.96,
  additive: false,
  spread: 6,
  colorEnd: '#0f172a',
};

// 默认碎片颜色（石灰/深灰/暗蓝，模拟实体碎裂）
const DEFAULT_COLORS: [number, number, number][] = [
  [148, 163, 184], // slate-400
  [100, 116, 139], // slate-500
  [71, 85, 105],   // slate-600
  [180, 180, 190], // 浅灰
  [120, 130, 150], // 中灰蓝
];

export const ShatterEffect: React.FC<ShatterEffectProps> = ({
  active,
  intensity = 'normal',
  color,
  onComplete,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const isStrong = intensity === 'strong';
  const colors = color ?? DEFAULT_COLORS;

  // 解构 intensity 为布尔值做稳定依赖
  const render = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const preset = isStrong ? SHATTER_PRESET_STRONG : SHATTER_PRESET_NORMAL;
    const cx = cw / 2;
    const cy = ch / 2;

    // 生成碎片粒子
    const particles: Particle[] = [];
    const count = preset.count;
    for (let i = 0; i < count; i++) {
      // 从中心区域随机偏移生成
      const spawnX = cx + (Math.random() - 0.5) * cw * 0.6;
      const spawnY = cy + (Math.random() - 0.5) * ch * 0.6;

      // 速度方向：从中心向外
      const dx = spawnX - cx;
      const dy = spawnY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = preset.speed.min + Math.random() * (preset.speed.max - preset.speed.min);
      // 向外飞散 + 随机扰动
      const vx = (dx / dist) * speed + (Math.random() - 0.5) * 2;
      // 向外 + 略微向上的初速度（重力会拉下来）
      const vy = (dy / dist) * speed - Math.random() * 2;

      const size = preset.size.min + Math.random() * (preset.size.max - preset.size.min);
      const life = preset.life.min + Math.random() * (preset.life.max - preset.life.min);
      const rgb = colors[Math.floor(Math.random() * colors.length)];

      particles.push(createParticle({
        x: spawnX,
        y: spawnY,
        vx, vy,
        maxLife: life,
        size,
        rgb,
        shape: 'square',
        colorEnd: preset.colorEnd,
        rotationSpeed: (Math.random() - 0.5) * 12, // 快速旋转
      }));
    }

    let lastTime = 0;

    const loop = (now: number) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, cw, ch);

      const alive = updateParticles(particles, dt, preset);
      drawParticles(ctx, particles, preset, cw, ch);

      if (alive === 0) {
        onCompleteRef.current?.();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [isStrong, colors]);

  useEffect(() => {
    if (!active) return;
    render();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, render]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ overflow: 'visible' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
};
