export type {
  RenderBackendCapabilities,
  RenderPipelineSettings,
  RenderQualityPreset,
} from './types';

export {
  DEFAULT_RENDER_QUALITY_PRESET,
  RENDER_QUALITY_CHANGE_EVENT,
  RENDER_QUALITY_STORAGE_KEY,
  readRenderPipelineSettings,
  readRenderQualityPreference,
  resolveRenderPipelineSettings,
  resolveRenderQualityPreset,
  subscribeRenderQualityPreference,
  writeRenderQualityPreference,
} from './preferences';

export {
  useRenderPipelineSettings,
  useRenderQualityPreference,
} from './hooks';
