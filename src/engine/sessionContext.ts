import type { MatchState } from './types';

type SessionActorCoreLike = {
    activePlayerId?: unknown;
    currentPlayerId?: unknown;
    currentPlayer?: unknown;
    turnOrder?: unknown;
    currentPlayerIndex?: unknown;
};

export interface SessionActorContext {
    currentTurnPlayerId: string | null;
    currentDecisionPlayerId: string | null;
}

export type CurrentDecisionPlayerIdResolver = (args: {
    state: MatchState<unknown>;
    fallbackPlayerId: string | null;
}) => string | null | undefined;

function normalizeActorId(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }
    return null;
}

function readCurrentTurnPlayerId(core: SessionActorCoreLike | undefined): string | null {
    if (!core) return null;

    const activePlayerId = normalizeActorId(core.activePlayerId);
    if (activePlayerId) return activePlayerId;

    const currentPlayerId = normalizeActorId(core.currentPlayerId);
    if (currentPlayerId) return currentPlayerId;

    const currentPlayer = normalizeActorId(core.currentPlayer);
    if (currentPlayer) return currentPlayer;

    if (Array.isArray(core.turnOrder) && typeof core.currentPlayerIndex === 'number') {
        return normalizeActorId(core.turnOrder[core.currentPlayerIndex]);
    }

    return null;
}

export function resolveCurrentTurnPlayerId(core: unknown): string | null {
    if (!core || typeof core !== 'object') {
        return null;
    }
    return readCurrentTurnPlayerId(core as SessionActorCoreLike);
}

export function resolveCurrentTurnPlayerIdFromState(state: MatchState<unknown> | null | undefined): string | null {
    return resolveCurrentTurnPlayerId(state?.core);
}

export function resolveSessionActorContext(args: {
    state?: MatchState<unknown> | null | undefined;
    core?: unknown;
    resolveCurrentDecisionPlayerId?: CurrentDecisionPlayerIdResolver | null | undefined;
}): SessionActorContext {
    const core = (args.core ?? args.state?.core) as SessionActorCoreLike | undefined;
    const currentTurnPlayerId = readCurrentTurnPlayerId(core);
    const resolvedDecisionPlayerId = args.state && args.resolveCurrentDecisionPlayerId
        ? args.resolveCurrentDecisionPlayerId({
            state: args.state,
            fallbackPlayerId: currentTurnPlayerId,
        })
        : undefined;
    const currentDecisionPlayerId = resolvedDecisionPlayerId === undefined
        ? currentTurnPlayerId
        : normalizeActorId(resolvedDecisionPlayerId);

    return {
        currentTurnPlayerId,
        currentDecisionPlayerId,
    };
}

export function resolveCurrentDecisionPlayerId(args: {
    state?: MatchState<unknown> | null | undefined;
    core?: unknown;
    resolveCurrentDecisionPlayerId?: CurrentDecisionPlayerIdResolver | null | undefined;
}): string | null {
    return resolveSessionActorContext(args).currentDecisionPlayerId;
}
