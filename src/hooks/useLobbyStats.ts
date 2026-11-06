
import { useMemo } from 'react';
import { useLobbyMatchPresence } from './useLobbyMatchPresence';

export type LobbyGamePlayerCounts = { online: number; waiting: number };

export const useLobbyStats = (enabled = true) => {
    const { matches, hasSnapshot } = useLobbyMatchPresence({
        gameId: 'all',
        enabled,
        requireSeen: false,
    });

    const mostPopularGameId = useMemo(() => (
        matches.length > 0
            ? Object.entries(
                matches.reduce((acc, match) => {
                    const name = match.gameName?.toLowerCase() || '';
                    if (name) {
                        acc[name] = (acc[name] || 0) + (match.players?.length || 0);
                    }
                    return acc;
                }, {} as Record<string, number>)
            ).sort((a, b) => b[1] - a[1])[0]?.[0]
            : null
    ), [matches]);

    const playerCountsByGame = useMemo(() => {
        const counts: Record<string, LobbyGamePlayerCounts> = {};
        for (const match of matches) {
            const gameId = match.gameName.toLowerCase();
            const count = counts[gameId] ??= { online: 0, waiting: 0 };
            const humans = match.players.filter(player => player.isAi !== true);
            count.online += humans.filter(player => player.isConnected === true).length;
            if (!match.isLocked && match.status === 'waiting') {
                count.waiting += humans.filter(player => player.isConnected === true).length;
            }
        }
        return counts;
    }, [matches]);

    return { matches, mostPopularGameId, hasSnapshot, playerCountsByGame };
};
