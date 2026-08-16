import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RENDER_QUALITY_PRESET,
  RENDER_QUALITY_STORAGE_KEY,
  readRenderPipelineSettings,
  readRenderQualityPreference,
  resolveRenderPipelineSettings,
  resolveRenderQualityPreset,
  subscribeRenderQualityPreference,
  writeRenderQualityPreference,
} from '../preferences';

describe('renderPipeline preferences', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('读取默认画质并忽略非法存储值', () => {
    expect(readRenderQualityPreference()).toBe(DEFAULT_RENDER_QUALITY_PRESET);

    window.localStorage.setItem(RENDER_QUALITY_STORAGE_KEY, 'ultra');

    expect(readRenderQualityPreference()).toBe(DEFAULT_RENDER_QUALITY_PRESET);
    expect(resolveRenderQualityPreset('medium')).toBe('medium');
    expect(resolveRenderQualityPreset('bad', 'low')).toBe('low');
  });

  it('写入画质偏好并通知当前页面订阅者', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRenderQualityPreference(listener);

    expect(writeRenderQualityPreference('low')).toBe('low');

    expect(readRenderQualityPreference()).toBe('low');
    expect(window.localStorage.getItem(RENDER_QUALITY_STORAGE_KEY)).toBe('low');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    writeRenderQualityPreference('medium');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('把玩家预设映射到 FX 质量和预算参数', () => {
    expect(resolveRenderPipelineSettings('low')).toMatchObject({
      qualityPreset: 'low',
      fxQuality: 'reduced',
      maxDpr: 1,
      reduceWhenHighCostActiveAt: 0,
      dropWhenHighCostActiveAt: 1,
      enableShaders: false,
    });

    expect(resolveRenderPipelineSettings('medium')).toMatchObject({
      qualityPreset: 'medium',
      fxQuality: 'full',
      maxDpr: 1.25,
      reduceWhenHighCostActiveAt: 2,
      dropWhenHighCostActiveAt: 4,
      enableShaders: true,
    });

    expect(resolveRenderPipelineSettings('high')).toMatchObject({
      qualityPreset: 'high',
      fxQuality: 'full',
      maxDpr: 1.5,
      dropWhenHighCostActiveAt: 0,
      enableShaders: true,
    });
  });

  it('读取当前管线设置时使用已保存偏好', () => {
    writeRenderQualityPreference('medium');

    expect(readRenderPipelineSettings().qualityPreset).toBe('medium');
  });
});
