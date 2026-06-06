import type { ReactNode } from 'react';
import { getGameImplementation } from './registry';
import { defaultGameRuntimeAdapter } from './gameRuntimeAdapter';

type GamePageRuntimeProviderProps = {
    gameId?: string | null;
    children: ReactNode;
};

export function GamePageRuntimeProvider({ gameId, children }: GamePageRuntimeProviderProps) {
    const PageProvider = getGameImplementation(gameId ?? '')?.runtimeAdapter?.PageProvider
        ?? defaultGameRuntimeAdapter.PageProvider;
    return <PageProvider>{children}</PageProvider>;
}

export function dismissGamePageTransientUi(gameId?: string | null): boolean {
    return getGameImplementation(gameId ?? '')?.runtimeAdapter?.dismissTransientUi?.()
        ?? defaultGameRuntimeAdapter.dismissTransientUi?.()
        ?? false;
}
