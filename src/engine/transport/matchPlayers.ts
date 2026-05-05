import type { MatchPlayerInfo } from './protocol';

export function findMatchPlayerInfo(
    matchPlayers: MatchPlayerInfo[] | undefined,
    playerId: string | number | null | undefined,
): MatchPlayerInfo | undefined {
    if (!matchPlayers || playerId === null || playerId === undefined) {
        return undefined;
    }

    const normalizedPlayerId = String(playerId);
    return matchPlayers.find((player) => String(player.id) === normalizedPlayerId);
}

export function resolveMatchPlayerConnected(
    matchPlayers: MatchPlayerInfo[] | undefined,
    playerId: string | number | null | undefined,
    defaultValue = true,
): boolean {
    const player = findMatchPlayerInfo(matchPlayers, playerId);
    if (!player) {
        return defaultValue;
    }
    return player.isConnected !== false;
}
