import type { MatchState } from '../types';
import type { GameEngineConfig } from './engineConfig';
import type { AiSeatController } from '../ai/types';

function extractStateSeatControllers(
    state: MatchState<unknown> | undefined,
): Record<string, AiSeatController> | undefined {
    const core = state?.core;
    if (!core || typeof core !== 'object' || Array.isArray(core)) {
        return undefined;
    }

    const rawSeatControllers = (core as { seatControllers?: unknown }).seatControllers;
    if (!rawSeatControllers || typeof rawSeatControllers !== 'object' || Array.isArray(rawSeatControllers)) {
        return undefined;
    }

    return rawSeatControllers as Record<string, AiSeatController>;
}

export function resolveRuntimeSeatControllers(args: {
    state: MatchState<unknown> | undefined;
    seatControllers: Record<string, AiSeatController>;
}): Record<string, AiSeatController> {
    return {
        ...args.seatControllers,
        ...(extractStateSeatControllers(args.state) ?? {}),
    };
}

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

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function isPersistedLocalStateCompatible(args: {
    state: MatchState<unknown>;
    expectedPlayerIds: string[];
}): boolean {
    const { state, expectedPlayerIds } = args;
    if (!state || typeof state !== 'object') {
        return false;
    }

    const core = state.core as Record<string, unknown> | undefined;
    const sys = state.sys as unknown as Record<string, unknown> | undefined;
    if (!core || !sys) {
        return false;
    }

    const corePlayerIds = core.playerIds;
    if (corePlayerIds !== undefined) {
        if (!isStringArray(corePlayerIds)) {
            return false;
        }
        if (corePlayerIds.length !== expectedPlayerIds.length) {
            return false;
        }
        if (corePlayerIds.some((playerId, index) => playerId !== expectedPlayerIds[index])) {
            return false;
        }
    }

    const playersRecord = core.players;
    if (!playersRecord || typeof playersRecord !== 'object' || Array.isArray(playersRecord)) {
        return false;
    }
    const persistedPlayerIds = Object.keys(playersRecord);
    if (persistedPlayerIds.length !== expectedPlayerIds.length) {
        return false;
    }
    if (expectedPlayerIds.some((playerId) => !persistedPlayerIds.includes(playerId))) {
        return false;
    }

    if (typeof core.currentPlayer === 'string' && !expectedPlayerIds.includes(core.currentPlayer)) {
        return false;
    }

    const turnOrder = sys.turnOrder;
    if (!isStringArray(turnOrder)) {
        return false;
    }
    if (turnOrder.length !== expectedPlayerIds.length) {
        return false;
    }
    if (turnOrder.some((playerId, index) => playerId !== expectedPlayerIds[index])) {
        return false;
    }

    const currentPlayerIndex = sys.currentPlayerIndex;
    return typeof currentPlayerIndex === 'number'
        && Number.isInteger(currentPlayerIndex)
        && currentPlayerIndex >= 0
        && currentPlayerIndex < expectedPlayerIds.length;
}

export function normalizeReceivedStateForGame(
    config: GameEngineConfig | undefined,
    state: MatchState<unknown>,
): MatchState<unknown> {
    return normalizeStateForConfig(config, state);
}
