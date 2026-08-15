import { extractGameIdFromPlayPath } from '../shared/mobileSupport';

export const PLAY_ROUTE_LOADING_TIMEOUT_MS = 8000;

export const isPlayRoutePath = (pathname: string) => pathname.startsWith('/play/');

export const shouldShowPlayRouteLoadingPrompt = (
    pathname: string,
    elapsedMs: number,
    timeoutMs = PLAY_ROUTE_LOADING_TIMEOUT_MS,
) => isPlayRoutePath(pathname) && elapsedMs >= timeoutMs;

export const resolvePlayRouteFallbackLobbyPath = (pathname: string) => {
    const gameId = extractGameIdFromPlayPath(pathname);
    return gameId ? `/?game=${gameId}` : '/';
};
