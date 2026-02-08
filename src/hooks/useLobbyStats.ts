
import { useState, useEffect } from 'react';
import { lobbySocket, type LobbyMatch } from '../services/lobbySocket';

export const useLobbyStats = () => {
    const [matches, setMatches] = useState<LobbyMatch[]>([]);

    useEffect(() => {
        // Subscribe to a 'global' channel. If backend doesn't support 'all',
        // this might need to be changed to specific game IDs.
        const updateHandler = (newMatches: LobbyMatch[]) => {
            setMatches(newMatches);
        };

        // Try 'all' first, as per common convention for global firehose
        const unsubscribe = lobbySocket.subscribe('all', updateHandler);

        return () => {
            unsubscribe();
        };
    }, []);

    const mostPopularGameId = matches.length > 0
        ? Object.entries(
            matches.reduce((acc, match) => {
                const name = match.gameName?.toLowerCase() || '';
                if (name) {
                    acc[name] = (acc[name] || 0) + (match.players?.length || 0);
                }
                return acc;
            }, {} as Record<string, number>)
        ).sort((a, b) => b[1] - a[1])[0]?.[0]
        : null;

    return { matches, mostPopularGameId };
};
