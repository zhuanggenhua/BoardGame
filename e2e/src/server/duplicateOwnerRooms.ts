import type { MatchMetadata } from '../engine/transport/storage';
import { hasOccupiedPlayers } from './matchOccupancy';

export const DUPLICATE_OWNER_DISCONNECT_GRACE_MS = 5 * 60 * 1000;

export type DuplicateOwnerRoomDecision =
    | { action: 'cleanup'; reason: 'missing_metadata' | 'empty_room' | 'gameover' | 'disconnect_timeout' }
    | { action: 'block'; reason: 'active_or_occupied' };

export type DuplicateOwnerExistingMatch = {
    matchID: string;
    gameName: string;
    metadata?: MatchMetadata | null;
    decision: DuplicateOwnerRoomDecision;
};

export type DuplicateOwnerRoomCreatePlan =
    | { action: 'block'; activeMatch: DuplicateOwnerExistingMatch; cleanupMatches: DuplicateOwnerExistingMatch[] }
    | { action: 'allow'; cleanupMatches: DuplicateOwnerExistingMatch[] };

export type ActiveMatchExistsConflict = {
    gameName: string;
    matchID: string;
};

export type CreateMatchWithOwnerConflictRetryResult =
    | { action: 'created' }
    | { action: 'conflict'; conflict: ActiveMatchExistsConflict };

const hasConnectedPlayers = (metadata?: MatchMetadata | null): boolean => {
    if (!metadata?.players) return false;
    return Object.values(metadata.players).some((player) => Boolean(player?.isConnected));
};

export const decideDuplicateOwnerRoomAction = (
    metadata?: MatchMetadata | null,
    options?: {
        now?: number;
        disconnectGraceMs?: number;
    },
): DuplicateOwnerRoomDecision => {
    if (!metadata) {
        return { action: 'cleanup', reason: 'missing_metadata' };
    }

    if (metadata.gameover) {
        return { action: 'cleanup', reason: 'gameover' };
    }

    const players = metadata.players as Record<string, { name?: string; credentials?: string; isConnected?: boolean | null }> | undefined;
    if (!hasOccupiedPlayers(players)) {
        return { action: 'cleanup', reason: 'empty_room' };
    }

    const now = options?.now ?? Date.now();
    const disconnectGraceMs = options?.disconnectGraceMs ?? DUPLICATE_OWNER_DISCONNECT_GRACE_MS;
    const disconnectedSince = typeof metadata.disconnectedSince === 'number' ? metadata.disconnectedSince : undefined;
    if (!hasConnectedPlayers(metadata) && disconnectedSince && now - disconnectedSince >= disconnectGraceMs) {
        return { action: 'cleanup', reason: 'disconnect_timeout' };
    }

    return { action: 'block', reason: 'active_or_occupied' };
};

export const planDuplicateOwnerRoomCreate = (
    matches: DuplicateOwnerExistingMatch[],
    options?: {
        forceReplaceActive?: boolean;
    },
): DuplicateOwnerRoomCreatePlan => {
    const cleanableMatches = matches.filter((match) => match.decision.action === 'cleanup');
    const blockingMatches = matches
        .filter((match) => match.decision.action === 'block')
        .sort((a, b) => (b.metadata?.updatedAt ?? 0) - (a.metadata?.updatedAt ?? 0));

    if (blockingMatches.length === 0) {
        return { action: 'allow', cleanupMatches: cleanableMatches };
    }

    if (options?.forceReplaceActive) {
        return { action: 'allow', cleanupMatches: [...cleanableMatches, ...blockingMatches] };
    }

    return {
        action: 'block',
        activeMatch: blockingMatches[0],
        cleanupMatches: cleanableMatches,
    };
};

export const parseActiveMatchExistsConflict = (
    error: unknown,
): ActiveMatchExistsConflict | null => {
    const message = error instanceof Error ? error.message : String(error);
    const activeMatch = message.match(/ACTIVE_MATCH_EXISTS:([^:]+):([^:]+)/);
    if (!activeMatch) {
        return null;
    }

    return {
        gameName: activeMatch[1],
        matchID: activeMatch[2],
    };
};

export const createMatchWithOwnerConflictRetry = async (options: {
    createMatch: () => Promise<void>;
    fetchConflictMetadata: (matchID: string) => Promise<MatchMetadata | null | undefined>;
    cleanupConflictMatch: (matchID: string, metadata?: MatchMetadata | null) => Promise<void>;
    forceReplaceActive?: boolean;
    maxForceCleanupRetries?: number;
    onForceCleanup?: (params: {
        attempt: number;
        conflict: ActiveMatchExistsConflict;
        metadata?: MatchMetadata | null;
    }) => Promise<void> | void;
}): Promise<CreateMatchWithOwnerConflictRetryResult> => {
    const maxForceCleanupRetries = options.maxForceCleanupRetries ?? 2;
    let forceCleanupAttempts = 0;

    while (true) {
        try {
            await options.createMatch();
            return { action: 'created' };
        } catch (error) {
            const conflict = parseActiveMatchExistsConflict(error);
            if (!conflict) {
                throw error;
            }

            if (!options.forceReplaceActive || forceCleanupAttempts >= maxForceCleanupRetries) {
                return {
                    action: 'conflict',
                    conflict,
                };
            }

            forceCleanupAttempts += 1;
            const metadata = await options.fetchConflictMetadata(conflict.matchID);
            await options.onForceCleanup?.({
                attempt: forceCleanupAttempts,
                conflict,
                metadata,
            });
            await options.cleanupConflictMatch(conflict.matchID, metadata);
        }
    }
};
