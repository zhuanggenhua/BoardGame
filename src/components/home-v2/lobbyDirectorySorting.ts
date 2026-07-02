import type { GameConfig } from '../../config/games.config';
import type { LobbyCategory } from './LobbyDirectory';

export const FEATURED_GAME_ORDER = [
    'dicethrone',
    'cardia',
    'smashup',
    'splendor',
    'summonerwars',
    'tictactoe',
];

export type LobbyDirectoryRankingFactors = {
    gameId: string;
    implementationStatusRank: number;
    popularityScore: number;
    featuredPriority: number;
    originalIndex: number;
};

export type RankedLobbyDirectoryGame = {
    game: GameConfig;
    factors: LobbyDirectoryRankingFactors;
};

function matchesActiveCategory(
    game: Pick<GameConfig, 'category' | 'tags' | 'type'>,
    activeCategory: LobbyCategory,
) {
    if (activeCategory === 'all') {
        return game.type === 'game';
    }
    if (activeCategory === 'tools') {
        return game.type === 'tool';
    }
    return game.type === 'game' && (game.category === activeCategory || game.tags?.includes(activeCategory));
}

function resolveGamePopularity(gameId: string, popularityByGameId: Record<string, number>) {
    return popularityByGameId[gameId.toLowerCase()] ?? 0;
}

function resolveImplementationStatusRank(game: Pick<GameConfig, 'statusTag'>) {
    return game.statusTag === 'under_construction' ? 1 : 0;
}

function normalizePopularityByGameId(popularityByGameId: Record<string, number>) {
    return Object.fromEntries(
        Object.entries(popularityByGameId).map(([gameId, popularity]) => [gameId.toLowerCase(), popularity]),
    );
}

function compareRankedLobbyDirectoryGames(left: RankedLobbyDirectoryGame, right: RankedLobbyDirectoryGame) {
    if (left.factors.implementationStatusRank !== right.factors.implementationStatusRank) {
        return left.factors.implementationStatusRank - right.factors.implementationStatusRank;
    }

    if (left.factors.popularityScore !== right.factors.popularityScore) {
        return right.factors.popularityScore - left.factors.popularityScore;
    }

    if (left.factors.featuredPriority !== right.factors.featuredPriority) {
        return left.factors.featuredPriority - right.factors.featuredPriority;
    }

    return left.factors.originalIndex - right.factors.originalIndex;
}

export function rankGamesForLobbyDirectory(
    games: GameConfig[],
    activeCategory: LobbyCategory,
    popularityByGameId: Record<string, number> = {},
    featuredGameOrder: string[] = FEATURED_GAME_ORDER,
) {
    const priorityById = new Map(featuredGameOrder.map((gameId, index) => [gameId, index]));
    const originalIndexById = new Map(games.map((game, index) => [game.id, index]));
    const normalizedPopularityByGameId = normalizePopularityByGameId(popularityByGameId);

    return games
        .filter((game) => matchesActiveCategory(game, activeCategory))
        .map((game): RankedLobbyDirectoryGame => ({
            game,
            factors: {
                gameId: game.id,
                implementationStatusRank: resolveImplementationStatusRank(game),
                popularityScore: resolveGamePopularity(game.id, normalizedPopularityByGameId),
                featuredPriority: priorityById.get(game.id) ?? Number.MAX_SAFE_INTEGER,
                originalIndex: originalIndexById.get(game.id) ?? Number.MAX_SAFE_INTEGER,
            },
        }))
        .sort(compareRankedLobbyDirectoryGames);
}

export function sortGamesForLobbyDirectory(
    games: GameConfig[],
    activeCategory: LobbyCategory,
    popularityByGameId: Record<string, number> = {},
    featuredGameOrder: string[] = FEATURED_GAME_ORDER,
) {
    return rankGamesForLobbyDirectory(games, activeCategory, popularityByGameId, featuredGameOrder)
        .map(({ game }) => game);
}
