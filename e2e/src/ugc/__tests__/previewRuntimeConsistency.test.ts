import { describe, expect, it } from 'vitest';
import { RuntimeDomainExecutor } from '../runtime/domainExecutor';
import { attachBuilderPreviewConfig, extractBuilderPreviewConfig, type BuilderPreviewConfig } from '../runtime/previewConfig';
import type { UGCGameState } from '../sdk/types';

const domainCode = `const domain = {
  gameId: 'preview-demo',
  setup(playerIds) {
    const players = Object.fromEntries(playerIds.map(id => [id, {
      resources: {},
      handCount: 0,
      deckCount: 0,
      discardCount: 0,
      statusEffects: {},
      public: { name: id },
    }]));
    return {
      phase: 'init',
      activePlayerId: playerIds[0] || 'player-1',
      turnNumber: 1,
      players,
      publicZones: { shared: 'ok' },
    };
  },
  validate() { return { valid: true }; },
  execute() { return []; },
  reduce(state) { return state; },
  playerView(state, playerId) {
    return {
      players: { [playerId]: state.players[playerId] },
      publicZones: { ...state.publicZones, viewer: playerId },
    };
  },
};`;

describe('UGC 预览/运行态一致性', () => {
    it('playerView 过滤后仍可附加 builderPreviewConfig', async () => {
        const executor = new RuntimeDomainExecutor({ timeoutMs: 200 });
        const loadResult = await executor.loadCode(domainCode);
        expect(loadResult.success).toBe(true);

        const setupResult = await executor.setup(['player-1', 'player-2'], 1);
        expect(setupResult.success).toBe(true);

        const baseState = setupResult.result as UGCGameState;
        const domain = executor.getDomainCore();
        expect(domain).toBeTruthy();

        const viewState = domain?.playerView
            ? { ...baseState, ...domain.playerView(baseState, 'player-1') }
            : baseState;

        const config: BuilderPreviewConfig = {
            layout: [],
            renderComponents: [],
            instances: {},
            layoutGroups: [],
        };

        const merged = attachBuilderPreviewConfig(viewState, config);

        expect(merged.publicZones?.viewer).toBe('player-1');
        expect(extractBuilderPreviewConfig(merged)).toEqual(config);
    });
});
