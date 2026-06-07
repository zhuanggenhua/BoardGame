interface LeaderboardRecordPlayer {
    id: string;
    name?: string;
    ownerKey?: string;
    isAi?: boolean;
}

interface LeaderboardRecord {
    players: LeaderboardRecordPlayer[];
    winnerID?: string;
}

export interface LeaderboardEntry {
    name: string;
    wins: number;
    matches: number;
}

function resolveLeaderboardPlayerKey(player: LeaderboardRecordPlayer): string | null {
    return player.ownerKey || (player.id !== '0' && player.id !== '1' ? player.id : null) || player.name || null;
}

function isLegacyAiLeaderboardPlayer(player: LeaderboardRecordPlayer): boolean {
    if (player.ownerKey) {
        return false;
    }

    const candidates = [player.name, player.id]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);

    return candidates.some((value) => /^AI(?:[\s-]?\d+.*)?$/i.test(value));
}

export function isLeaderboardHumanPlayer(player: LeaderboardRecordPlayer): boolean {
    if (player.isAi === true) {
        return false;
    }

    return !isLegacyAiLeaderboardPlayer(player);
}

export function buildLeaderboardEntries(records: LeaderboardRecord[]): LeaderboardEntry[] {
    const stats: Record<string, LeaderboardEntry> = {};

    records.forEach((record) => {
        const humanPlayers = record.players.filter(isLeaderboardHumanPlayer);

        humanPlayers.forEach((player) => {
            const key = resolveLeaderboardPlayerKey(player);
            if (!key) return;
            if (!stats[key]) {
                stats[key] = { name: player.name || key, wins: 0, matches: 0 };
            }
            if (player.name) {
                stats[key].name = player.name;
            }
            stats[key].matches += 1;
        });

        if (!record.winnerID) {
            return;
        }

        const winner = humanPlayers.find((player) => player.id === record.winnerID);
        if (!winner) {
            return;
        }

        const winnerKey = resolveLeaderboardPlayerKey(winner);
        if (winnerKey && stats[winnerKey]) {
            stats[winnerKey].wins += 1;
        }
    });

    return Object.values(stats)
        .sort((left, right) => right.wins - left.wins)
        .slice(0, 50);
}
