import { useEffect, useState, type ReactNode } from 'react';
import { getGameImplementation, subscribeGameImplementationReady } from './registry';
import { defaultGameRuntimeAdapter } from './gameRuntimeAdapter';

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

    return <PageProvider key={`${normalizedGameId}:${providerVersion}`}>{children}</PageProvider>;
}

export function dismissGamePageTransientUi(gameId?: string | null): boolean {
    return getGameImplementation(gameId ?? '')?.runtimeAdapter?.dismissTransientUi?.()
        ?? defaultGameRuntimeAdapter.dismissTransientUi?.()
        ?? false;
}
