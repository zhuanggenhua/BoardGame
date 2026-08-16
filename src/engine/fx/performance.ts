/**
 * FX 性能工具
 *
 * 这里集中处理质量档、DPR 上限和 canvas 尺寸初始化，避免各个特效组件
 * 自己直接使用完整 devicePixelRatio 导致移动端像素填充成本失控。
 */

import type { FxQuality } from './types';
import { readRenderPipelineSettings } from '../renderPipeline/preferences';

export interface FxDprOptions {
  quality?: FxQuality;
  maxDpr?: number;
  reducedMaxDpr?: number;
}

export interface FxCanvasSize {
  width: number;
  height: number;
  dpr: number;
}

export function resolveFxQuality(value: unknown, fallback: FxQuality = 'full'): FxQuality {
  return value === 'reduced' ? 'reduced' : fallback;
}

export function resolveFxDpr({
  quality = 'full',
  maxDpr = 1.5,
  reducedMaxDpr = 1,
}: FxDprOptions = {}): number {
  if (typeof window === 'undefined') return 1;

  const deviceDpr = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
  const pipelineSettings = readRenderPipelineSettings();
  const cap = quality === 'reduced'
    ? Math.min(reducedMaxDpr, pipelineSettings.reducedMaxDpr)
    : Math.min(maxDpr, pipelineSettings.maxDpr);
  return Math.max(1, Math.min(deviceDpr || 1, cap));
}

export function setupCanvas2d(
  canvas: HTMLCanvasElement,
  source: HTMLElement,
  options: FxDprOptions = {},
): FxCanvasSize {
  const width = source.offsetWidth || canvas.offsetWidth;
  const height = source.offsetHeight || canvas.offsetHeight;
  const dpr = resolveFxDpr(options);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { width, height, dpr };
}
