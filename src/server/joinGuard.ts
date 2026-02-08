import type { Server, State } from 'boardgame.io';
import { claimSeatUtils } from './claimSeat';
import { hasOccupiedPlayers } from './matchOccupancy';

type JoinGuardInput = {
    metadata?: Server.MatchData | null;
    state?: State | null;
    authHeader?: string;
    guestId?: string | null;
    jwtSecret: string;
};

export type JoinGuardResult = {
    allowed: boolean;
    isEmptyRoom: boolean;
    status?: number;
    message?: string;
    ownerKey?: string;
    requesterKey?: string;
    reason?: 'not_owner' | 'invalid_token' | 'missing_owner';
};

const resolveOwnerKey = (metadata?: Server.MatchData | null, state?: State | null): string | undefined => {
    const setupDataFromMeta = (metadata?.setupData as { ownerKey?: string } | undefined) || undefined;
    const setupDataFromState = (state?.G?.__setupData as { ownerKey?: string } | undefined) || undefined;
    return setupDataFromMeta?.ownerKey ?? setupDataFromState?.ownerKey;
};

const resolveRequesterKey = (authHeader: string | undefined, guestId: string | null | undefined, jwtSecret: string): {
    requesterKey?: string;
    invalidToken?: boolean;
} => {
    const rawToken = claimSeatUtils.parseBearerToken(authHeader);
    if (rawToken) {
        const payload = claimSeatUtils.verifyGameToken(rawToken, jwtSecret);
        if (!payload?.userId) {
            return { invalidToken: true };
        }
        return { requesterKey: `user:${payload.userId}` };
    }
    if (guestId && guestId.trim()) {
        return { requesterKey: `guest:${guestId.trim()}` };
    }
    return {};
};

export const evaluateEmptyRoomJoinGuard = ({
    metadata,
    state,
    authHeader,
    guestId,
    jwtSecret,
}: JoinGuardInput): JoinGuardResult => {
    if (!metadata?.players) {
        return { allowed: true, isEmptyRoom: false };
    }

    const players = metadata.players as Record<string, { name?: string; credentials?: string; isConnected?: boolean }>;
    const hasOccupied = hasOccupiedPlayers(players);
    if (hasOccupied) {
        return { allowed: true, isEmptyRoom: false };
    }

    const ownerKey = resolveOwnerKey(metadata, state);
    if (!ownerKey) {
        return {
            allowed: false,
            isEmptyRoom: true,
            status: 403,
            message: 'Room owner is required',
            reason: 'missing_owner',
        };
    }

    const { requesterKey, invalidToken } = resolveRequesterKey(authHeader, guestId, jwtSecret);
    if (invalidToken) {
        return {
            allowed: false,
            isEmptyRoom: true,
            status: 401,
            message: 'Invalid token',
            reason: 'invalid_token',
            ownerKey,
        };
    }

    if (!requesterKey || requesterKey !== ownerKey) {
        return {
            allowed: false,
            isEmptyRoom: true,
            status: 403,
            message: 'Only match owner can rejoin',
            reason: 'not_owner',
            ownerKey,
            requesterKey,
        };
    }

    return {
        allowed: true,
        isEmptyRoom: true,
        ownerKey,
        requesterKey,
    };
};
