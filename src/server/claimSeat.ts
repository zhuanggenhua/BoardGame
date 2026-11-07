import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { MatchState } from '../engine/types';
import { normalizeOnlineAiWatchdogSeatControllerType, resolveRawOnlineAiWatchdogSeatControllers } from '../engine/transport/onlineAiSeatControllers';
import { GAME_MANIFEST_BY_ID } from '../games/manifest';
import type { MatchMetadata, StoredMatchState } from '../engine/transport/storage';
import logger from '../../server/logger';

export type GameJwtPayload = {
    userId?: string;
    username?: string;
};

type ClaimSeatFetchResult = {
    metadata?: MatchMetadata;
    state?: StoredMatchState;
};

type ClaimSeatDb = {
    fetch: (matchID: string, opts: { metadata?: boolean; state?: boolean }) => Promise<ClaimSeatFetchResult>;
    setMetadata: (matchID: string, metadata: MatchMetadata) => Promise<void>;
    claimSeatMetadata: (matchID: string, input: {
        playerID: string;
        playerCredentials: string;
        playerName?: string;
        updatedAt?: number;
    }) => Promise<{
        metadata?: MatchMetadata;
        playerExists: boolean;
        playerCredentials?: string;
    }>;
};

type ClaimSeatContext = {
    get: (name: string) => string;
    throw: (status: number, message: string) => void;
    request: { body?: { playerID?: string | number; guestId?: string; ownerCredentials?: string; playerName?: string } };
    body?: unknown;
};

type ClaimSeatAuth = {
    generateCredentials: (ctx: ClaimSeatContext) => Promise<string> | string;
};

const parseBearerToken = (value?: string): string | null => {
    if (!value) return null;
    const match = value.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
};

const verifyGameToken = (token: string, jwtSecret: string): GameJwtPayload | null => {
    try {
        const payload = jwt.verify(token, jwtSecret) as GameJwtPayload;
        if (!payload?.userId) return null;
        return payload;
    } catch {
        return null;
    }
};

// Recheck the metadata returned by the serialized claim mutation before any
// credential is disclosed: a concurrent join may have changed the seat owner.
function resolveSeatRecoveryError(
    metadata: MatchMetadata,
    state: StoredMatchState | undefined,
    playerID: string,
    requesterKey: string | null,
    ownerCredentials: string,
): string | null {
    const setupDataFromMeta = metadata.setupData as { ownerKey?: string } | undefined;
    const stateG = state?.G as Record<string, unknown> | undefined;
    const setupDataFromState = stateG?.__setupData as { ownerKey?: string } | undefined;
    const ownerKey = setupDataFromMeta?.ownerKey ?? setupDataFromState?.ownerKey;
    if (!requesterKey) {
        const ownerSeat = metadata.players['0'];
        const storedOwnerCredentials = ownerSeat?.credentials;
        const suppliedBuffer = Buffer.from(ownerCredentials);
        const storedBuffer = Buffer.from(typeof storedOwnerCredentials === 'string' ? storedOwnerCredentials : '');
        const validOwnerProof = typeof ownerKey === 'string'
            && ownerKey.startsWith('guest:')
            && (!ownerSeat?.ownerKey || ownerSeat.ownerKey === ownerKey)
            && storedBuffer.length > 0
            && suppliedBuffer.length === storedBuffer.length
            && timingSafeEqual(suppliedBuffer, storedBuffer);
        if (!validOwnerProof) return 'Invalid owner seat credentials';
    }

    const player = metadata.players[playerID];
    if (!player) return 'Seat no longer exists';
    const seatControllers = resolveRawOnlineAiWatchdogSeatControllers(
        state?.G as MatchState<unknown> | undefined,
        metadata.setupData,
    );
    const targetControllerType = GAME_MANIFEST_BY_ID[metadata.gameName]
        ? normalizeOnlineAiWatchdogSeatControllerType(metadata.gameName, seatControllers?.[playerID], GAME_MANIFEST_BY_ID)
        : 'human';
    const isAiSeat = targetControllerType === 'local-ai' || targetControllerType === 'remote-ai';
    // An old AI configuration must not expose a seat now bound to someone else.
    const isOwnerManagedAiSeat = isAiSeat && (!player.ownerKey || player.ownerKey === ownerKey);
    const canRecoverSeat = requesterKey
        ? player.ownerKey === requesterKey || (ownerKey === requesterKey && isOwnerManagedAiSeat)
        : playerID === '0' || isOwnerManagedAiSeat;
    return canRecoverSeat
        ? null
        : 'Verified seat ownership is required; only AI seats may be claimed by the room owner';
}

export const createClaimSeatHandler = ({
    db,
    auth,
    jwtSecret,
}: {
    db: ClaimSeatDb;
    auth: ClaimSeatAuth;
    jwtSecret: string;
}) => {
    return async (ctx: ClaimSeatContext, matchID: string): Promise<void> => {
        const origin = ctx.get('origin');
        const authHeader = ctx.get('authorization');
        const rawToken = parseBearerToken(authHeader);
        const body = ctx.request.body;
        const playerIDInput = body?.playerID;
        if (playerIDInput === undefined || playerIDInput === null || (typeof playerIDInput === 'string' && !playerIDInput.trim())) {
            logger.warn(`[claim-seat] rejected reason=missing_player_id matchID=${matchID} origin=${origin || ''}`);
            ctx.throw(400, 'playerID is required');
            return;
        }
        const resolvedPlayerID = String(playerIDInput);
        const requestedName = typeof body?.playerName === 'string' ? body.playerName.trim() : '';

        let expectedOwnerKey: string | null = null;
        let payload: GameJwtPayload | null = null;
        let actorLabel = '';
        const ownerCredentials = typeof body?.ownerCredentials === 'string' ? body.ownerCredentials : '';
        if (rawToken) {
            payload = verifyGameToken(rawToken, jwtSecret);
            if (!payload?.userId) {
                logger.warn(`[claim-seat] rejected reason=invalid_token matchID=${matchID} origin=${origin || ''} hasAuth=${!!authHeader}`);
                ctx.throw(401, 'Invalid token');
                return;
            }
            expectedOwnerKey = `user:${payload.userId}`;
            actorLabel = expectedOwnerKey;
        } else {
            // Guest display IDs are public, short identifiers, not authority.
            if (!ownerCredentials.trim()) {
                logger.warn(`[claim-seat] rejected reason=missing_owner_credentials matchID=${matchID} origin=${origin || ''}`);
                ctx.throw(401, 'Existing owner seat credentials are required');
                return;
            }
            actorLabel = 'guest-owner';
        }

        logger.info(`[claim-seat] start matchID=${matchID} playerID=${resolvedPlayerID} actor=${actorLabel} origin=${origin || ''}`);

        const { metadata, state } = await db.fetch(matchID, { metadata: true, state: true });
        if (!metadata) {
            ctx.throw(404, 'Match ' + matchID + ' not found');
            return;
        }

        const player = metadata.players[resolvedPlayerID];
        if (!player) {
            logger.warn(`[claim-seat] rejected reason=player_not_found matchID=${matchID} playerID=${resolvedPlayerID}`);
            ctx.throw(404, 'Player ' + resolvedPlayerID + ' not found');
            return;
        }
        const recoveryError = resolveSeatRecoveryError(metadata, state, resolvedPlayerID, expectedOwnerKey, ownerCredentials);
        if (recoveryError) {
            logger.warn(`[claim-seat] rejected reason=seat_authority_required matchID=${matchID} playerID=${resolvedPlayerID}`);
            ctx.throw(403, recoveryError);
            return;
        }

        const existingCredentials = typeof player.credentials === 'string' && player.credentials.trim()
            ? player.credentials
            : undefined;
        const playerCredentials = existingCredentials ?? await auth.generateCredentials(ctx);
        const resolvedName = !player.name
            ? requestedName || payload?.username
            : undefined;
        const claimResult = await db.claimSeatMetadata(matchID, {
            playerID: resolvedPlayerID,
            playerCredentials,
            playerName: resolvedName,
            updatedAt: Date.now(),
        });
        if (!claimResult.metadata) {
            ctx.throw(404, 'Match ' + matchID + ' not found');
            return;
        }
        if (!claimResult.playerExists) {
            logger.warn(`[claim-seat] rejected reason=player_not_found_after_mutation matchID=${matchID} playerID=${resolvedPlayerID}`);
            ctx.throw(404, 'Player ' + resolvedPlayerID + ' not found');
            return;
        }

        const latestRecoveryError = resolveSeatRecoveryError(
            claimResult.metadata, state, resolvedPlayerID, expectedOwnerKey, ownerCredentials,
        );
        if (latestRecoveryError) {
            logger.warn(`[claim-seat] rejected reason=seat_authority_changed matchID=${matchID} playerID=${resolvedPlayerID}`);
            ctx.throw(403, latestRecoveryError);
            return;
        }

        logger.info(`[claim-seat] success matchID=${matchID} playerID=${resolvedPlayerID} actor=${actorLabel}`);
        ctx.body = { playerID: resolvedPlayerID, playerCredentials: claimResult.playerCredentials ?? playerCredentials };
    };
};

export const claimSeatUtils = {
    parseBearerToken,
    verifyGameToken,
};
