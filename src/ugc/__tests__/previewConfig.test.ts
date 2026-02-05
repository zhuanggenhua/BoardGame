import { describe, it, expect } from 'vitest';
import { attachBuilderPreviewConfig, extractBuilderPreviewConfig, type BuilderPreviewConfig } from '../runtime/previewConfig';
import type { UGCGameState } from '../sdk/types';

describe('previewConfig', () => {
  it('应能写入并提取预览配置', () => {
    const state: UGCGameState = {
      phase: 'init',
      turnNumber: 1,
      activePlayerId: 'player-1',
      players: {},
      publicZones: { foo: 'bar' },
    };

    const config: BuilderPreviewConfig = {
      layout: [
        {
          id: 'comp-1',
          type: 'hand-zone',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          data: {},
        },
      ],
      renderComponents: [],
      instances: {},
      layoutGroups: [],
    };

    const nextState = attachBuilderPreviewConfig(state, config);
    expect(nextState).not.toBe(state);
    expect(state.publicZones?.builderPreviewConfig).toBeUndefined();
    expect(nextState.publicZones?.foo).toBe('bar');

    const extracted = extractBuilderPreviewConfig(nextState);
    expect(extracted).toEqual(config);
  });

  it('缺少配置时应返回 null', () => {
    const state: UGCGameState = {
      phase: 'init',
      turnNumber: 1,
      activePlayerId: 'player-1',
      players: {},
      publicZones: {},
    };

    expect(extractBuilderPreviewConfig(state)).toBeNull();
  });
});
