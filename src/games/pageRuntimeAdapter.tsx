import { useEffect, useState, type ReactNode } from 'react';
import { defaultGameRuntimeAdapter } from './gameRuntimeAdapter';
import { getGameImplementation, subscribeGameImplementationReady } from './registry';

type GamePageRuntimeProviderProps = {
    gameId?: string | null;
    children: ReactNode;
};

export function GamePageRuntimeProvider({ gameId, children }: GamePageRuntimeProviderProps) {
    const normalizedGameId = gameId ?? '';
    const [providerVersion, setProviderVersion] = useState(0);
    const implementation = getGameImplementation(normalizedGameId);

    useEffect(() => {
        if (!normalizedGameId) return undefined;
        const unsubscribe = subscribeGameImplementationReady((resolvedGameId) => {
            if (resolvedGameId !== normalizedGameId) return;
            setProviderVersion((version) => version + 1);
        });
        return unsubscribe;
    }, [normalizedGameId]);

    const PageProvider = implementation?.runtimeAdapter?.PageProvider
        ?? defaultGameRuntimeAdapter.PageProvider;

    if (!PageProvider) {
        return <>{children}</>;
    }

    return <PageProvider key={`${normalizedGameId}:${providerVersion}`}>{children}</PageProvider>;
}
