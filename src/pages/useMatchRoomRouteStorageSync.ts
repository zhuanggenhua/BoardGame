import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import {
    persistMatchCredentials,
    readStoredMatchCredentials,
    type StoredMatchCredentials,
} from '../hooks/match/useMatchStatus';
import { resolveMatchRoomRouteIdentity } from './matchRouteIdentity';

export function useMatchRoomRouteStorageSync(args: {
    gameId?: string;
    matchId?: string;
    isTutorialRoute: boolean;
    debugPlayerID?: string | null;
    searchParams: URLSearchParams;
    navigate: NavigateFunction;
}) {
    const {
        gameId,
        matchId,
        isTutorialRoute,
        debugPlayerID,
        searchParams,
        navigate,
    } = args;
    const [localStorageTick, setLocalStorageTick] = useState(0);
    const bumpLocalStorageTick = useCallback(() => {
        setLocalStorageTick((t) => t + 1);
    }, []);

    const urlPlayerID = searchParams.get('playerID');
    const shouldAutoJoin = searchParams.get('join') === 'true';
    const spectateParam = searchParams.get('spectate');

    const storedMatchCreds = useMemo<StoredMatchCredentials | null>(() => {
        void localStorageTick;
        if (isTutorialRoute || !matchId) {
            return null;
        }
        return readStoredMatchCredentials(matchId);
    }, [isTutorialRoute, localStorageTick, matchId]);
    const storedPlayerID = storedMatchCreds?.playerID;

    const routeIdentity = resolveMatchRoomRouteIdentity({
        isTutorialRoute,
        debugPlayerID,
        urlPlayerID,
        storedPlayerID,
        shouldAutoJoin,
        spectateParam,
    });

    const credentials = useMemo(() => {
        const resolvedPlayerID = routeIdentity.effectivePlayerID ?? undefined;
        if (!resolvedPlayerID) {
            return undefined;
        }
        if (storedMatchCreds?.playerID === resolvedPlayerID) {
            return storedMatchCreds.credentials;
        }
        return undefined;
    }, [routeIdentity.effectivePlayerID, storedMatchCreds]);

    useEffect(() => {
        if (!matchId || !gameId) return;
        const stored = readStoredMatchCredentials(matchId);
        if (!stored || stored.gameName === gameId) return;
        persistMatchCredentials(matchId, {
            ...stored,
            matchID: stored.matchID || matchId,
            gameName: gameId,
        });
    }, [gameId, matchId]);

    useEffect(() => {
        const handleStorage = () => setLocalStorageTick((t) => t + 1);
        const handleCredentialsChange = () => setLocalStorageTick((t) => t + 1);
        const handleOwnerActive = () => setLocalStorageTick((t) => t + 1);
        window.addEventListener('storage', handleStorage);
        window.addEventListener('match-credentials-changed', handleCredentialsChange);
        window.addEventListener('owner-active-match-changed', handleOwnerActive);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('match-credentials-changed', handleCredentialsChange);
            window.removeEventListener('owner-active-match-changed', handleOwnerActive);
        };
    }, []);

    useEffect(() => {
        if (isTutorialRoute) return;
        if (spectateParam === '1' || spectateParam === 'true') return;
        if (!gameId || !matchId) return;
        if (!storedPlayerID) return;
        if (urlPlayerID === storedPlayerID) return;
        navigate(`/play/${gameId}/match/${matchId}?playerID=${storedPlayerID}`, { replace: true });
    }, [gameId, isTutorialRoute, matchId, navigate, spectateParam, storedPlayerID, urlPlayerID]);

    return {
        urlPlayerID,
        shouldAutoJoin,
        spectateParam,
        storedMatchCreds,
        storedPlayerID,
        localStorageTick,
        bumpLocalStorageTick,
        credentials,
        ...routeIdentity,
    };
}
