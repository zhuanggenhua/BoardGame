import type { MatchState } from '../types';
import type { EngineSystem } from '../systems/types';
import type { GameEngineConfig } from '../transport/engineConfig';
import { SPECTATOR_PLAYER_ID } from '../playerView';

export function applyPlayerViewToState(
    engineConfig: GameEngineConfig,
    state: MatchState<unknown>,
    playerId: string | null,
): MatchState<unknown> {
    // 旁观者保留完整权威 core；系统投影仍负责物化可传输的交互选项并清除函数字段。
    const isSpectator = playerId === null;
    const effectivePlayerId = isSpectator ? SPECTATOR_PLAYER_ID : playerId;
    let viewCore = state.core;
    let viewSys: unknown = state.sys;

    if (!isSpectator && engineConfig.domain.playerView) {
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
