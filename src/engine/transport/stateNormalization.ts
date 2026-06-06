import type { MatchState } from '../types';
import type { GameEngineConfig } from './server';
import type { AiSeatController } from '../ai/types';

export function buildLocalAiSeatStates(
    state: MatchState<unknown>,
    seatControllers: Record<string, AiSeatController>,
): Record<string, MatchState<unknown>> {
    const seatStates: Record<string, MatchState<unknown>> = {};
    for (const [playerId, controller] of Object.entries(seatControllers)) {
        if (controller.type === 'human') {
            continue;
        }
        seatStates[playerId] = state;
    }
    return seatStates;
}

export function normalizeStateForConfig(
    config: GameEngineConfig | undefined,
    state: MatchState<unknown>,
): MatchState<unknown> {
    return config?.domain?.normalizeRuntimeState
        ? config.domain.normalizeRuntimeState(state)
        : state;
}

export function normalizePersistedLocalStateForGame(
    config: GameEngineConfig,
    state: MatchState<unknown>,
): MatchState<unknown> {
    return normalizeStateForConfig(config, state);
}

export function normalizeReceivedStateForGame(
    config: GameEngineConfig | undefined,
    state: MatchState<unknown>,
): MatchState<unknown> {
    return normalizeStateForConfig(config, state);
}
