import { resolvePlayRouteFallbackLobbyPath } from '../gameRouteFallback';

export type AndroidBackNavigationAction =
    | { type: 'dismiss-text-entry' }
    | { type: 'close-modal' }
    | { type: 'blocked' }
    | { type: 'history-back' }
    | { type: 'fallback-route'; path: string }
    | { type: 'exit-app' };

interface ReadAndroidBackNavigationDepthOptions {
    historyState?: unknown;
    historyLength?: number;
}

interface ResolveAndroidBackNavigationActionOptions extends ReadAndroidBackNavigationDepthOptions {
    pathname: string;
    search?: string;
    modalStackDepth?: number;
    isTopModalClosable?: boolean;
    hasFocusedTextEntry?: boolean;
}

export const readAndroidBackNavigationDepth = ({
    historyState,
    historyLength,
}: ReadAndroidBackNavigationDepthOptions): number => {
    const state = historyState as { idx?: unknown } | null | undefined;
    if (typeof state?.idx === 'number' && Number.isFinite(state.idx)) {
        return Math.max(0, Math.trunc(state.idx));
    }

    if (typeof historyLength === 'number' && Number.isFinite(historyLength) && historyLength > 1) {
        return Math.max(0, Math.trunc(historyLength - 1));
    }

    return 0;
};

export const resolveAndroidBackNavigationAction = ({
    pathname,
    search = '',
    historyState,
    historyLength,
    modalStackDepth = 0,
    isTopModalClosable = true,
    hasFocusedTextEntry = false,
}: ResolveAndroidBackNavigationActionOptions): AndroidBackNavigationAction => {
    if (hasFocusedTextEntry) {
        return { type: 'dismiss-text-entry' };
    }

    if (modalStackDepth > 0) {
        return isTopModalClosable
            ? { type: 'close-modal' }
            : { type: 'blocked' };
    }

    const backDepth = readAndroidBackNavigationDepth({ historyState, historyLength });
    if (backDepth > 0) {
        return { type: 'history-back' };
    }

    if (pathname !== '/' || search) {
        const fallbackPath = pathname.startsWith('/play/')
            ? resolvePlayRouteFallbackLobbyPath(pathname)
            : '/';
        return {
            type: 'fallback-route',
            path: fallbackPath,
        };
    }

    return { type: 'exit-app' };
};
