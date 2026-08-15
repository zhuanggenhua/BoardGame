import { useMemo } from 'react';
import { getGameById } from '../config/games.config';
import { getGamePageDataAttributes } from '../shared/mobileSupport';
import { resolveGameDisplayName } from '../components/lobby/gameDetailsContent';
import { getOrCreateGuestId } from '../hooks/match/ownerIdentity';
import { isTutorialRoutePath } from './matchRoomRuntime';
import type { MatchRoomLobbyTranslator } from './matchRoomPageTypes';

export function useMatchRoomPageIdentity(args: {
    gameId?: string;
    matchId?: string;
    pathname: string;
    tLobby: MatchRoomLobbyTranslator;
}) {
    const { gameId, matchId, pathname, tLobby } = args;
    const gameConfig = gameId ? getGameById(gameId) : undefined;
    const guestId = useMemo(() => getOrCreateGuestId(), []);
    const gameDisplayName = resolveGameDisplayName(gameConfig, tLobby, gameId ?? '');
    const gamePageDataAttributes = getGamePageDataAttributes(gameId, gameConfig);
    const requiresGameNamespace = Boolean(gameConfig);
    const isTutorialRoute = isTutorialRoutePath(pathname);
    const matchRoomScopeKey = `${gameId ?? 'unknown'}:${matchId ?? 'unknown'}:${isTutorialRoute ? 'tutorial' : 'online'}`;

    return {
        gameConfig,
        guestId,
        gameDisplayName,
        gamePageDataAttributes,
        requiresGameNamespace,
        isTutorialRoute,
        matchRoomScopeKey,
    };
}

export type MatchRoomPageIdentityModel = ReturnType<typeof useMatchRoomPageIdentity>;
