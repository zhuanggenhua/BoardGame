import type { FxQuality } from '../fx/types';

export type RenderQualityPreset = 'low' | 'medium' | 'high';

export interface RenderPipelineSettings {
  qualityPreset: RenderQualityPreset;
  fxQuality: FxQuality;
  maxDpr: number;
  reducedMaxDpr: number;
  reduceWhenHighCostActiveAt: number;
  dropWhenHighCostActiveAt: number;
  enableShaders: boolean;
  enableParticles: boolean;
}

export interface RenderBackendCapabilities {
  supportsShaders?: boolean;
  supportsParticles?: boolean;
  supportsLayerCompositing?: boolean;
  preferredMaxDpr?: number;
}
