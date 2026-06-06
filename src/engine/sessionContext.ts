import type { MatchState } from './types';

type SessionActorCoreLike = {
    activePlayerId?: unknown;
    currentPlayerId?: unknown;
    currentPlayer?: unknown;
    turnOrder?: unknown;
    currentPlayerIndex?: unknown;
    pendingAttack?: unknown;
};

export interface SessionActorContext {
    currentTurnPlayerId: string | null;
    currentDecisionPlayerId: string | null;
}

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
    preferPendingAttackDefenderAsDecisionOwner?: boolean;
}): SessionActorContext {
    const core = (args.core ?? args.state?.core) as SessionActorCoreLike | undefined;
    const currentTurnPlayerId = readCurrentTurnPlayerId(core);

    let currentDecisionPlayerId = currentTurnPlayerId;
    if (
        args.preferPendingAttackDefenderAsDecisionOwner
        && args.state?.sys?.phase === 'defensiveRoll'
    ) {
        const pendingAttack = core?.pendingAttack as { defenderId?: unknown } | undefined;
        const defenderId = normalizeActorId(pendingAttack?.defenderId);
        if (defenderId) {
            currentDecisionPlayerId = defenderId;
        }
    }

    return {
        currentTurnPlayerId,
        currentDecisionPlayerId,
    };
}

export function resolveCurrentDecisionPlayerId(args: {
    state?: MatchState<unknown> | null | undefined;
    core?: unknown;
    preferPendingAttackDefenderAsDecisionOwner?: boolean;
}): string | null {
    return resolveSessionActorContext(args).currentDecisionPlayerId;
}
