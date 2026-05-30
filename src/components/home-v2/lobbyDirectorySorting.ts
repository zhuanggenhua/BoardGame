import type { GameConfig } from '../../config/games.config';
import type { LobbyCategory } from './LobbyDirectory';

const FEATURED_GAME_ORDER = [
    'cardia',
    'dicethrone',
    'smashup',
    'splendor',
    'summonerwars',
    'tictactoe',
];

function matchesActiveCategory(
    game: Pick<GameConfig, 'category' | 'tags' | 'type'>,
    activeCategory: LobbyCategory,
) {
    if (activeCategory === 'all') {
        return game.type === 'game';
    }
    if (activeCategory === 'tools') {
        return game.type === 'tool' || game.category === activeCategory || game.tags?.includes(activeCategory);
    }
    return game.type === 'game' && (game.category === activeCategory || game.tags?.includes(activeCategory));
}

function resolveGamePopularity(gameId: string, popularityByGameId: Record<string, number>) {
    return popularityByGameId[gameId.toLowerCase()] ?? 0;
}

export function sortGamesForLobbyDirectory(
    games: GameConfig[],
    activeCategory: LobbyCategory,
    popularityByGameId: Record<string, number> = {},
) {
    const priorityById = new Map(FEATURED_GAME_ORDER.map((gameId, index) => [gameId, index]));
    const originalIndexById = new Map(games.map((game, index) => [game.id, index]));
    const normalizedPopularityByGameId = Object.fromEntries(
        Object.entries(popularityByGameId).map(([gameId, duration]) => [gameId.toLowerCase(), duration]),
    );

    return games
        .filter((game) => matchesActiveCategory(game, activeCategory))
        .slice()
        .sort((left, right) => {
            const leftPopularity = resolveGamePopularity(left.id, normalizedPopularityByGameId);
            const rightPopularity = resolveGamePopularity(right.id, normalizedPopularityByGameId);
            if (leftPopularity !== rightPopularity) {
                return rightPopularity - leftPopularity;
            }

            const leftPriority = priorityById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
            const rightPriority = priorityById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
            if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority;
            }

            return (originalIndexById.get(left.id) ?? Number.MAX_SAFE_INTEGER)
                - (originalIndexById.get(right.id) ?? Number.MAX_SAFE_INTEGER);
        });
}
