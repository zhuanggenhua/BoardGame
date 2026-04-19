
import { useMemo } from 'react';
import { useLobbyMatchPresence } from './useLobbyMatchPresence';

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

    return { matches, mostPopularGameId, hasSnapshot };
};
