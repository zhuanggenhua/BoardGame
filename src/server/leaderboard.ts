interface LeaderboardRecordPlayer {
    id: string;
    name?: string;
    ownerKey?: string;
    isAi?: boolean;
    result?: string;
    rank?: number;
    placement?: number;
}

interface LeaderboardRecord {
    players: LeaderboardRecordPlayer[];
    winnerID?: string;
    createdAt?: Date | string | number;
    endedAt?: Date | string | number;
}

export type LeaderboardTier = 'beginner' | 'apprentice' | 'average' | 'good' | 'strong' | 'expert' | 'master';

export interface LeaderboardEntry {
    name: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    matches: number;
    winRate: number;
    provisional: boolean;
    tier: LeaderboardTier;
}

type LeaderboardStats = {
    name: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    matches: number;
};

type MatchPlayerContext = {
    key: string;
    player: LeaderboardRecordPlayer;
    stats: LeaderboardStats;
};

const INITIAL_RATING = 0;
const ESTABLISHED_RATING_FLOOR = 100;
const PROVISIONAL_MATCHES = 30;
const EARLY_MATCH_K_FACTOR = 60;
const STANDARD_K_FACTOR = 40;
const FIRST_RATED_MATCH_AWARD = 1;
const MAX_LEADERBOARD_ENTRIES = 50;

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

function resolveRecordTime(record: LeaderboardRecord): number {
    const raw = record.endedAt ?? record.createdAt;
    if (raw instanceof Date) {
        return raw.getTime();
    }
    if (typeof raw === 'number') {
        return raw;
    }
    if (typeof raw === 'string') {
        const parsed = Date.parse(raw);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

function findRecordWinnerContext(record: LeaderboardRecord, contexts: MatchPlayerContext[]): MatchPlayerContext | undefined {
    if (!record.winnerID) {
        return undefined;
    }

    return contexts.find(({ key, player }) => (
        player.id === record.winnerID
        || player.ownerKey === record.winnerID
        || player.name === record.winnerID
        || key === record.winnerID
    ));
}

function resolvePlayerRank(record: LeaderboardRecord, contexts: MatchPlayerContext[]): Map<string, number> {
    const explicitRanks = contexts
        .map(({ key, player }) => {
            const rank = player.rank ?? player.placement;
            return typeof rank === 'number' && Number.isFinite(rank) ? [key, rank] as const : null;
        });

    if (explicitRanks.every(Boolean)) {
        return new Map(explicitRanks.filter((value): value is readonly [string, number] => Boolean(value)));
    }

    const normalizedResults = contexts.map(({ key, player }) => ({
        key,
        result: typeof player.result === 'string' ? player.result.trim().toLowerCase() : undefined,
    }));
    const hasResult = normalizedResults.some(({ result }) => Boolean(result));
    if (hasResult) {
        const hasWinner = normalizedResults.some(({ result }) => result === 'win');
        if (hasWinner) {
            return new Map(normalizedResults.map(({ key, result }) => [key, result === 'win' ? 0 : 1]));
        }
        return new Map(normalizedResults.map(({ key }) => [key, 0]));
    }

    const winner = findRecordWinnerContext(record, contexts);
    if (winner) {
        return new Map(contexts.map(({ key }) => [key, key === winner.key ? 0 : 1]));
    }

    return new Map(contexts.map(({ key }) => [key, 0]));
}

function resolveActualScore(leftRank: number, rightRank: number): number {
    if (leftRank < rightRank) {
        return 1;
    }
    if (leftRank > rightRank) {
        return 0;
    }
    return 0.5;
}

function resolveExpectedScore(leftRating: number, rightRating: number): number {
    return 1 / (1 + 10 ** ((rightRating - leftRating) / 400));
}

function resolvePlayerKFactor(matchesBeforeRecord: number): number {
    return matchesBeforeRecord < PROVISIONAL_MATCHES ? EARLY_MATCH_K_FACTOR : STANDARD_K_FACTOR;
}

function applyRatingFloor(previousRating: number, nextRating: number, matchesBeforeRecord: number): number {
    let rating = nextRating;
    if (previousRating < ESTABLISHED_RATING_FLOOR && rating < previousRating) {
        rating = previousRating;
    }
    if (previousRating >= ESTABLISHED_RATING_FLOOR && rating < ESTABLISHED_RATING_FLOOR) {
        rating = ESTABLISHED_RATING_FLOOR;
    }
    if (matchesBeforeRecord === 0 && rating < FIRST_RATED_MATCH_AWARD) {
        rating = FIRST_RATED_MATCH_AWARD;
    }
    return rating;
}

export function resolveLeaderboardTier(rating: number): LeaderboardTier {
    if (rating >= 700) {
        return 'master';
    }
    if (rating >= 500) {
        return 'expert';
    }
    if (rating >= 300) {
        return 'strong';
    }
    if (rating >= 200) {
        return 'good';
    }
    if (rating >= 100) {
        return 'average';
    }
    if (rating >= 1) {
        return 'apprentice';
    }
    return 'beginner';
}

function createEmptyStats(player: LeaderboardRecordPlayer, key: string): LeaderboardStats {
    return {
        name: player.name || key,
        rating: INITIAL_RATING,
        wins: 0,
        losses: 0,
        draws: 0,
        matches: 0,
    };
}

export function buildLeaderboardEntries(records: LeaderboardRecord[]): LeaderboardEntry[] {
    const stats: Record<string, LeaderboardStats> = {};

    const chronologicalRecords = records
        .map((record, index) => ({ record, index }))
        .sort((left, right) => resolveRecordTime(left.record) - resolveRecordTime(right.record) || left.index - right.index)
        .map(({ record }) => record);

    chronologicalRecords.forEach((record) => {
        const humanPlayers = record.players.filter(isLeaderboardHumanPlayer);
        const seenKeys = new Set<string>();
        const keyedPlayers = humanPlayers
            .map((player) => {
                const key = resolveLeaderboardPlayerKey(player);
                return key ? { key, player } : null;
            })
            .filter((value): value is { key: string; player: LeaderboardRecordPlayer } => Boolean(value))
            .filter(({ key }) => {
                if (seenKeys.has(key)) {
                    return false;
                }
                seenKeys.add(key);
                return true;
            });

        if (keyedPlayers.length < 2) {
            return;
        }

        const contexts = keyedPlayers.map(({ key, player }) => {
            if (!stats[key]) {
                stats[key] = createEmptyStats(player, key);
            }
            if (player.name) {
                stats[key].name = player.name;
            }
            return { key, player, stats: stats[key] };
        });

        const ranks = resolvePlayerRank(record, contexts);
        const lowestRank = Math.min(...Array.from(ranks.values()));
        const highestRank = Math.max(...Array.from(ranks.values()));
        const previousRatings = new Map(contexts.map(({ key, stats: playerStats }) => [key, playerStats.rating]));
        const previousMatches = new Map(contexts.map(({ key, stats: playerStats }) => [key, playerStats.matches]));
        const deltas = new Map(contexts.map(({ key }) => [key, 0]));
        const opponentCount = contexts.length - 1;
        const playerCountFactor = contexts.length / 2;

        for (const left of contexts) {
            const leftRank = ranks.get(left.key) ?? 0;
            const leftRating = previousRatings.get(left.key) ?? INITIAL_RATING;
            const leftMatches = previousMatches.get(left.key) ?? 0;
            const kFactor = (resolvePlayerKFactor(leftMatches) * playerCountFactor) / opponentCount;

            for (const right of contexts) {
                if (left.key === right.key) {
                    continue;
                }
                const rightRank = ranks.get(right.key) ?? 0;
                const rightRating = previousRatings.get(right.key) ?? INITIAL_RATING;
                const actual = resolveActualScore(leftRank, rightRank);
                const expected = resolveExpectedScore(leftRating, rightRating);
                deltas.set(left.key, (deltas.get(left.key) ?? 0) + kFactor * (actual - expected));
            }
        }

        contexts.forEach(({ key, stats: playerStats }) => {
            const rank = ranks.get(key) ?? 0;
            if (lowestRank === highestRank) {
                playerStats.draws += 1;
            } else if (rank === lowestRank) {
                playerStats.wins += 1;
            } else {
                playerStats.losses += 1;
            }

            const previousRating = previousRatings.get(key) ?? INITIAL_RATING;
            const matchesBeforeRecord = previousMatches.get(key) ?? 0;
            playerStats.rating = applyRatingFloor(previousRating, previousRating + (deltas.get(key) ?? 0), matchesBeforeRecord);
            playerStats.matches += 1;
        });
    });

    return Object.values(stats)
        .map((entry) => {
            const rating = Math.round(entry.rating);
            return {
                name: entry.name,
                rating,
                wins: entry.wins,
                losses: entry.losses,
                draws: entry.draws,
                matches: entry.matches,
                winRate: entry.matches > 0 ? Number((entry.wins / entry.matches).toFixed(3)) : 0,
                provisional: entry.matches < PROVISIONAL_MATCHES,
                tier: resolveLeaderboardTier(rating),
            };
        })
        .sort((left, right) => {
            if (right.rating !== left.rating) {
                return right.rating - left.rating;
            }
            if (right.wins !== left.wins) {
                return right.wins - left.wins;
            }
            if (right.winRate !== left.winRate) {
                return right.winRate - left.winRate;
            }
            if (right.matches !== left.matches) {
                return right.matches - left.matches;
            }
            return left.name.localeCompare(right.name, 'zh-Hans-CN');
        })
        .slice(0, MAX_LEADERBOARD_ENTRIES);
}
