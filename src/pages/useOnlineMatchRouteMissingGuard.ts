import { useEffect, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { ToastContextType } from '../contexts/ToastContext';
import {
    clearMatchCredentials,
    clearOwnerActiveMatch,
    isMatchNotFoundError,
    suppressOwnerActiveMatch,
} from '../hooks/match/useMatchStatus';
import { navigateBackToLobbyWithModalCleanup } from '../lib/navigation/navigateBackToLobbyWithModalCleanup';
import * as matchApi from '../services/matchApi';

type UseOnlineMatchRouteMissingGuardArgs = {
    gameId?: string;
    matchId?: string;
    navigate: NavigateFunction;
    closeAll: (options?: { skipOnClose?: boolean }) => void;
    toastWarning: ToastContextType['warning'];
};

export function clearMissingOnlineMatchRouteState(matchId: string): void {
    clearMatchCredentials(matchId);
    clearOwnerActiveMatch(matchId);
    suppressOwnerActiveMatch(matchId);
}

export function useOnlineMatchRouteMissingGuard(args: UseOnlineMatchRouteMissingGuardArgs): void {
    const {
        gameId,
        matchId,
        navigate,
        closeAll,
        toastWarning,
    } = args;
    const confirmedMissingKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!gameId || !matchId) return undefined;

        const routeKey = `${gameId}:${matchId}`;
        if (confirmedMissingKeyRef.current === routeKey) return undefined;

        let cancelled = false;

        matchApi.getMatch(gameId, matchId, { expectedStatuses: [404] })
            .catch((error: unknown) => {
                if (cancelled || !isMatchNotFoundError(error)) {
                    return;
                }
                confirmedMissingKeyRef.current = routeKey;
                clearMissingOnlineMatchRouteState(matchId);
                toastWarning(
                    { kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' },
                    undefined,
                    { dedupeKey: `matchRoom.missing.${matchId}` },
                );
                navigateBackToLobbyWithModalCleanup({
                    navigate,
                    closeAll,
                    gameId,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [closeAll, gameId, matchId, navigate, toastWarning]);
}
