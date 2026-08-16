import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  DEFAULT_RENDER_QUALITY_PRESET,
  readRenderQualityPreference,
  resolveRenderPipelineSettings,
  subscribeRenderQualityPreference,
  writeRenderQualityPreference,
} from './preferences';
import type { RenderPipelineSettings, RenderQualityPreset } from './types';

export function useRenderQualityPreference(): [
  RenderQualityPreset,
  (preset: RenderQualityPreset) => void,
] {
  const preset = useSyncExternalStore(
    subscribeRenderQualityPreference,
    readRenderQualityPreference,
    () => DEFAULT_RENDER_QUALITY_PRESET,
  );

  const setPreset = useCallback((nextPreset: RenderQualityPreset) => {
    writeRenderQualityPreference(nextPreset);
  }, []);

  return [preset, setPreset];
}

export function useRenderPipelineSettings(): RenderPipelineSettings {
  const [preset] = useRenderQualityPreference();
  return useMemo(() => resolveRenderPipelineSettings(preset), [preset]);
}
