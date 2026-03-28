import type { MatchMetadata } from '../engine/transport/storage';
import { hasOccupiedPlayers } from './matchOccupancy';

export const DUPLICATE_OWNER_DISCONNECT_GRACE_MS = 5 * 60 * 1000;

export type DuplicateOwnerRoomDecision =
    | { action: 'cleanup'; reason: 'missing_metadata' | 'empty_room' | 'gameover' | 'disconnect_timeout' }
    | { action: 'block'; reason: 'active_or_occupied' };

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
