import type { MatchPlayerInfo } from '../../../engine/transport/protocol';

export type PlayerDisplayNameMap = Record<string, string>;

interface ResolveOrderedPlayerIdsOptions {
    preferredOrder?: readonly (string | number)[] | null;
    fallbackOrder?: readonly (string | number)[] | null;
    players?: Record<string, unknown> | null;
}

function normalizePlayerId(rawPlayerId: string | number): string {
    return String(rawPlayerId);
}

export function buildPlayerDisplayNameMap(
    playerIds: readonly (string | number)[],
    matchData: MatchPlayerInfo[] | undefined,
    getFallbackName: (playerId: string) => string,
): PlayerDisplayNameMap {
    const matchedNames = new Map<string, string>();
    matchData?.forEach((player) => {
        const trimmedName = player.name?.trim();
        if (trimmedName) {
            matchedNames.set(normalizePlayerId(player.id), trimmedName);
        }
    });

    return playerIds.reduce<PlayerDisplayNameMap>((acc, rawPlayerId) => {
        const playerId = normalizePlayerId(rawPlayerId);
        acc[playerId] = matchedNames.get(playerId) ?? getFallbackName(playerId);
        return acc;
    }, {});
}

export function resolveOrderedPlayerIds({
    preferredOrder,
    fallbackOrder,
    players,
}: ResolveOrderedPlayerIdsOptions): string[] {
    const knownPlayerIds = players ? Object.keys(players) : [];
    const playerIdSet = new Set(knownPlayerIds);
    const orderedPlayerIds: string[] = [];
    const seenPlayerIds = new Set<string>();

    const appendPlayerIds = (source: readonly (string | number)[] | null | undefined) => {
        source?.forEach((rawPlayerId) => {
            const playerId = normalizePlayerId(rawPlayerId);
            if (seenPlayerIds.has(playerId)) return;
            if (playerIdSet.size > 0 && !playerIdSet.has(playerId)) return;
            seenPlayerIds.add(playerId);
            orderedPlayerIds.push(playerId);
        });
    };

    appendPlayerIds(preferredOrder);
    appendPlayerIds(fallbackOrder);
    appendPlayerIds(knownPlayerIds);

    return orderedPlayerIds;
}

export function getCompactPlayerBadgeLabel(name: string, maxChars = 2): string {
    const trimmedName = name.trim();
    if (!trimmedName) return '?';
    const glyphs = Array.from(trimmedName);
    return glyphs.slice(0, Math.max(1, maxChars)).join('');
}
