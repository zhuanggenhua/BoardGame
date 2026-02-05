import type { UGCGameState } from '../sdk/types';

export const BUILDER_PREVIEW_CONFIG_KEY = 'builderPreviewConfig';

export interface BuilderPreviewConfig {
  layout: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    data: Record<string, unknown>;
    renderComponentId?: string;
  }>;
  renderComponents: Array<{
    id: string;
    name: string;
    targetSchema: string;
    renderCode: string;
    backRenderCode?: string;
  }>;
  instances: Record<string, Record<string, unknown>[]>;
  layoutGroups?: Array<{ id: string; name: string; hidden: boolean }>;
  schemaDefaults?: Record<string, string>;
}

export function attachBuilderPreviewConfig(
  state: UGCGameState,
  config: BuilderPreviewConfig
): UGCGameState {
  return {
    ...state,
    publicZones: {
      ...(state.publicZones || {}),
      [BUILDER_PREVIEW_CONFIG_KEY]: config,
    },
  };
}

export function extractBuilderPreviewConfig(
  state: UGCGameState | null
): BuilderPreviewConfig | null {
  if (!state) return null;
  const publicZones = state.publicZones || {};
  const config = publicZones[BUILDER_PREVIEW_CONFIG_KEY];
  if (!config || typeof config !== 'object') return null;
  return config as BuilderPreviewConfig;
}
