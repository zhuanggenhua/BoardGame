export const MATCH_EMOTE_COOLDOWN_MS = 2000;

export type MatchEmoteRejectReason =
    | 'missing_payload'
    | 'match_not_found'
    | 'not_player'
    | 'invalid_emote'
    | 'rate_limited'
    | 'not_joined';

interface MatchEmoteSeat {
    name?: unknown;
    credentials?: unknown;
}

export interface MatchEmoteMetadata {
    gameName?: string | null;
    players?: Record<string, MatchEmoteSeat | undefined> | null;
}

export type MatchEmoteJoinDecision =
    | { ok: true; gameId: string }
    | { ok: false; reason: Exclude<MatchEmoteRejectReason, 'missing_payload' | 'invalid_emote' | 'rate_limited' | 'not_joined'> };

export type MatchEmoteSendDecision =
    | { ok: true; gameId: string; rateLimitKey: string }
    | { ok: false; reason: MatchEmoteRejectReason };

export type MatchEmoteAllowance = (emoteId: string, gameId?: string | null) => boolean;

export const resolveMatchEmoteJoinDecision = (
    metadata: MatchEmoteMetadata | null | undefined,
    playerId: string,
): MatchEmoteJoinDecision => {
    if (!metadata) {
        return { ok: false, reason: 'match_not_found' };
    }

    const seat = metadata.players?.[playerId];
    if (!seat || (!seat.name && !seat.credentials)) {
        return { ok: false, reason: 'not_player' };
    }

    return {
        ok: true,
        gameId: metadata.gameName || '',
    };
};

export interface ResolveMatchEmoteSendDecisionArgs {
    matchId?: string;
    playerId?: string;
    emoteId?: string;
    metadata?: MatchEmoteMetadata | null;
    now: number;
    lastSentAt?: number;
    cooldownMs?: number;
    isEmoteAllowed: MatchEmoteAllowance;
}

export const resolveMatchEmoteSendDecision = ({
    matchId,
    playerId,
    emoteId,
    metadata,
    now,
    lastSentAt = 0,
    cooldownMs = MATCH_EMOTE_COOLDOWN_MS,
    isEmoteAllowed,
}: ResolveMatchEmoteSendDecisionArgs): MatchEmoteSendDecision => {
    if (!matchId || !playerId) {
        return { ok: false, reason: 'not_joined' };
    }
    if (!emoteId) {
        return { ok: false, reason: 'missing_payload' };
    }

    if (now - lastSentAt < cooldownMs) {
        return { ok: false, reason: 'rate_limited' };
    }

    const joinDecision = resolveMatchEmoteJoinDecision(metadata, playerId);
    if (!joinDecision.ok) {
        return joinDecision;
    }

    if (!isEmoteAllowed(emoteId, joinDecision.gameId)) {
        return { ok: false, reason: 'invalid_emote' };
    }

    return {
        ok: true,
        gameId: joinDecision.gameId,
        rateLimitKey: getMatchEmoteRateLimitKey(matchId, playerId),
    };
};

export const getMatchEmoteRateLimitKey = (matchId: string, playerId: string): string => (
    `${matchId}:${playerId}`
);

export const createMatchEmoteRateLimiter = (cooldownMs = MATCH_EMOTE_COOLDOWN_MS) => {
    const lastSentAtByKey = new Map<string, number>();

    return {
        cooldownMs,
        getLastSentAt(matchId: string, playerId: string): number {
            return lastSentAtByKey.get(getMatchEmoteRateLimitKey(matchId, playerId)) ?? 0;
        },
        markSent(matchId: string, playerId: string, sentAt: number): void {
            lastSentAtByKey.set(getMatchEmoteRateLimitKey(matchId, playerId), sentAt);
        },
        clear(): void {
            lastSentAtByKey.clear();
        },
    };
};
