import type { MatchState } from '../types';
import type { EngineSystem } from '../systems/types';
import type { GameEngineConfig } from '../transport/server';

export function applyPlayerViewToState(
    engineConfig: GameEngineConfig,
    state: MatchState<unknown>,
    playerId: string | null,
): MatchState<unknown> {
    let viewCore = state.core;
    let viewSys: unknown = state.sys;

    if (playerId !== null && engineConfig.domain.playerView) {
        const partial = engineConfig.domain.playerView(state.core, playerId);
        viewCore = partial !== undefined
            ? { ...(state.core as Record<string, unknown>), ...partial }
            : state.core;
    }

    if (playerId !== null) {
        for (const system of engineConfig.systems as EngineSystem<unknown>[]) {
            if (!system.playerView) continue;
            const sysPartial = system.playerView(state, playerId);
            viewSys = { ...(viewSys as Record<string, unknown>), ...sysPartial };
        }
    }

    return { sys: viewSys, core: viewCore };
}
