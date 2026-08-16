import type { RenderPipelineSettings, RenderQualityPreset } from './types';

export const RENDER_QUALITY_STORAGE_KEY = 'boardgame.renderQuality.v1';
export const RENDER_QUALITY_CHANGE_EVENT = 'boardgame:render-quality-change';
export const DEFAULT_RENDER_QUALITY_PRESET: RenderQualityPreset = 'high';

const QUALITY_PRESETS: Record<RenderQualityPreset, RenderPipelineSettings> = {
  low: {
    qualityPreset: 'low',
    fxQuality: 'reduced',
    maxDpr: 1,
    reducedMaxDpr: 1,
    reduceWhenHighCostActiveAt: 0,
    dropWhenHighCostActiveAt: 1,
    enableShaders: false,
    enableParticles: true,
  },
  medium: {
    qualityPreset: 'medium',
    fxQuality: 'full',
    maxDpr: 1.25,
    reducedMaxDpr: 1,
    reduceWhenHighCostActiveAt: 2,
    dropWhenHighCostActiveAt: 4,
    enableShaders: true,
    enableParticles: true,
  },
  high: {
    qualityPreset: 'high',
    fxQuality: 'full',
    maxDpr: 1.5,
    reducedMaxDpr: 1,
    reduceWhenHighCostActiveAt: Number.POSITIVE_INFINITY,
    dropWhenHighCostActiveAt: 0,
    enableShaders: true,
    enableParticles: true,
  },
};

export function resolveRenderQualityPreset(
  value: unknown,
  fallback: RenderQualityPreset = DEFAULT_RENDER_QUALITY_PRESET,
): RenderQualityPreset {
  return value === 'low' || value === 'medium' || value === 'high' ? value : fallback;
}

export function resolveRenderPipelineSettings(value: unknown): RenderPipelineSettings {
  const preset = resolveRenderQualityPreset(value);
  return QUALITY_PRESETS[preset];
}

export function readRenderQualityPreference(): RenderQualityPreset {
  if (typeof window === 'undefined') {
    return DEFAULT_RENDER_QUALITY_PRESET;
  }

  try {
    return resolveRenderQualityPreset(window.localStorage.getItem(RENDER_QUALITY_STORAGE_KEY));
  } catch {
    return DEFAULT_RENDER_QUALITY_PRESET;
  }
}

export function readRenderPipelineSettings(): RenderPipelineSettings {
  return resolveRenderPipelineSettings(readRenderQualityPreference());
}

export function writeRenderQualityPreference(value: RenderQualityPreset): RenderQualityPreset {
  const nextPreset = resolveRenderQualityPreset(value);
  if (typeof window === 'undefined') {
    return nextPreset;
  }

  try {
    window.localStorage.setItem(RENDER_QUALITY_STORAGE_KEY, nextPreset);
  } catch {
    return nextPreset;
  }

  window.dispatchEvent(new CustomEvent(RENDER_QUALITY_CHANGE_EVENT, {
    detail: { qualityPreset: nextPreset },
  }));
  return nextPreset;
}

export function subscribeRenderQualityPreference(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === RENDER_QUALITY_STORAGE_KEY) {
      listener();
    }
  };
  const handleLocalChange = () => listener();

  window.addEventListener('storage', handleStorage);
  window.addEventListener(RENDER_QUALITY_CHANGE_EVENT, handleLocalChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(RENDER_QUALITY_CHANGE_EVENT, handleLocalChange);
  };
}
