/**
 * VictoryParticles — 胜利彩带特效（Canvas 2D）
 *
 * 从底部中央向上喷射彩色粒子，模拟庆祝彩带效果。
 * 基于自研 Canvas 粒子引擎，零外部依赖。
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  type Particle,
  type ParticlePreset,
  parseColorToRgb,
  spawnParticles,
  updateParticles,
  drawParticles,
} from './canvasParticleEngine';

export interface VictoryParticlesProps {
  active: boolean;
  className?: string;
}

const VICTORY_COLORS = ['#F59E0B', '#10B981', '#38BDF8', '#F472B6', '#FDE047', '#fff'];

const VICTORY_PRESET: ParticlePreset = {
  count: 70,
  speed: { min: 3, max: 8 },
  size: { min: 2, max: 5 },
  life: { min: 1.0, max: 2.5 },
  gravity: 0.8,
  shapes: ['circle', 'square', 'star'],
  rotate: true,
  opacityDecay: true,
  sizeDecay: false,
  direction: 'top',
  glow: true,
  glowScale: 2,
  drag: 0.99,
  additive: true,
  turbulence: 0.6,
  turbulenceFreq: 1.5,
  pulse: 0.15,
  pulseFreq: 6,
};

export function VictoryParticles({ active, className = '' }: VictoryParticlesProps): React.ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);

  const rgbColors = useMemo(() => VICTORY_COLORS.map(parseColorToRgb), []);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

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

    // 从底部中央喷射
    particlesRef.current = spawnParticles(VICTORY_PRESET, rgbColors, cw / 2, ch * 0.65);

    let lastTime = 0;

    const loop = (now: number) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, cw, ch);

      updateParticles(particlesRef.current, dt, VICTORY_PRESET);
      drawParticles(ctx, particlesRef.current, VICTORY_PRESET, cw, ch);

      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      particlesRef.current = [];
    };
  }, [active, rgbColors]);

  if (!active || typeof window === 'undefined') return null;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      data-victory-particles
      aria-hidden
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
}
