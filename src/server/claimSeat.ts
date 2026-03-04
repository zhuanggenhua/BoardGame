import jwt from 'jsonwebtoken';
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
};

type ClaimSeatContext = {
    get: (name: string) => string;
    throw: (status: number, message: string) => void;
    request: { body?: { playerID?: string | number; guestId?: string; playerName?: string } };
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
            const guestId = typeof body?.guestId === 'string' ? body.guestId.trim() : '';
            if (!guestId) {
                logger.warn(`[claim-seat] rejected reason=missing_guest matchID=${matchID} origin=${origin || ''}`);
                ctx.throw(401, 'Guest id is required');
                return;
            }
            expectedOwnerKey = `guest:${guestId}`;
            actorLabel = expectedOwnerKey;
        }

        logger.info(`[claim-seat] start matchID=${matchID} playerID=${resolvedPlayerID} actor=${actorLabel} origin=${origin || ''}`);

        const { metadata, state } = await db.fetch(matchID, { metadata: true, state: true });
        if (!metadata) {
            ctx.throw(404, 'Match ' + matchID + ' not found');
            return;
        }

        const setupDataFromMeta = (metadata.setupData as { ownerKey?: string } | undefined) || undefined;
        const stateG = state?.G as Record<string, unknown> | undefined;
        const setupDataFromState = (stateG?.__setupData as { ownerKey?: string } | undefined) || undefined;
        const ownerKey = setupDataFromMeta?.ownerKey ?? setupDataFromState?.ownerKey;
        if (!ownerKey || ownerKey !== expectedOwnerKey) {
            logger.warn(
                `[claim-seat] rejected reason=owner_mismatch matchID=${matchID} ownerKey=${ownerKey || ''} expected=${expectedOwnerKey}`
            );
            ctx.throw(403, 'Not match owner');
            return;
        }

        const players = metadata.players as Record<string, { name?: string; credentials?: string }> | undefined;
        const player = players?.[resolvedPlayerID];
        if (!player) {
            logger.warn(`[claim-seat] rejected reason=player_not_found matchID=${matchID} playerID=${resolvedPlayerID}`);
            ctx.throw(404, 'Player ' + resolvedPlayerID + ' not found');
            return;
        }

        const playerCredentials = await auth.generateCredentials(ctx);
        player.credentials = playerCredentials;
        if (!player.name) {
            const resolvedName = payload?.username || requestedName;
            if (resolvedName) {
                player.name = resolvedName;
            }
        }

        await db.setMetadata(matchID, metadata);
        logger.info(`[claim-seat] success matchID=${matchID} playerID=${resolvedPlayerID} actor=${actorLabel}`);
        ctx.body = { playerID: resolvedPlayerID, playerCredentials };
    };
};

export const claimSeatUtils = {
    parseBearerToken,
    verifyGameToken,
};
