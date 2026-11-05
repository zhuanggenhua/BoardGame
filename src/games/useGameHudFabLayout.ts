import { useEffect, useState } from 'react';
import { getGameImplementation, subscribeGameImplementationReady } from './registry';
import type { GameHudFabLayout } from './gameRuntimeAdapter';

export function useGameHudFabLayout(gameId?: string | null): GameHudFabLayout | undefined {
    const normalizedGameId = gameId ?? '';
    const [, setVersion] = useState(0);

    useEffect(() => {
        if (!normalizedGameId) return undefined;
        return subscribeGameImplementationReady((resolvedGameId) => {
            if (resolvedGameId === normalizedGameId) setVersion((version) => version + 1);
        });
    }, [normalizedGameId]);

    return getGameImplementation(normalizedGameId)?.runtimeAdapter?.hudFabLayout;
}
