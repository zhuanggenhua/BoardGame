import type { MatchState } from '../types';
import type { EngineSystem } from '../systems/types';
import type { GameEngineConfig } from '../transport/server';

const SPECTATOR_PLAYER_ID = '__spectator__';

export function applyPlayerViewToState(
    engineConfig: GameEngineConfig,
    state: MatchState<unknown>,
    playerId: string | null,
): MatchState<unknown> {
    const effectivePlayerId = playerId ?? SPECTATOR_PLAYER_ID;
    let viewCore = state.core;
    let viewSys: unknown = state.sys;

    if (engineConfig.domain.playerView) {
        const partial = engineConfig.domain.playerView(state.core, effectivePlayerId);
        viewCore = partial !== undefined
            ? { ...(state.core as Record<string, unknown>), ...partial }
            : state.core;
    }

    for (const system of engineConfig.systems as EngineSystem<unknown>[]) {
        if (!system.playerView) continue;
        const sysPartial = system.playerView(state, effectivePlayerId);
        viewSys = { ...(viewSys as Record<string, unknown>), ...sysPartial };
    }

    const viewState = { sys: viewSys, core: viewCore } as MatchState<unknown>;
    return engineConfig.domain.normalizeRuntimeState
        ? engineConfig.domain.normalizeRuntimeState(viewState)
        : viewState;
}
