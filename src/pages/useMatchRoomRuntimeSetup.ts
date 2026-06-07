import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { i18n as I18nInstance } from 'i18next';
import { getGameImplementation, resolveGameTutorialManifest } from '../games/registry';
import { preloadWarmImages } from '../core';
import { resolveCriticalImages } from '../core/CriticalImageResolverRegistry';
import { appendMatchLoadTrace } from '../lib/matchLoadTrace';
import { useGameNamespaceReady } from '../hooks/useGameNamespaceReady';
import { useGameImplementationReady } from '../hooks/useGameImplementationReady';
import { useMatchRoomBoardRuntime } from './matchRoomBoardRuntime';
import type { MatchRoomLobbyTranslator } from './matchRoomPageTypes';

export function useMatchRoomRuntimeSetup(args: {
    gameId?: string;
    matchId?: string;
    tutorialId?: string;
    isTutorialRoute: boolean;
    requiresGameNamespace: boolean;
    matchRoomScopeKey: string;
    i18n: I18nInstance;
    tLobby: MatchRoomLobbyTranslator;
}) {
    const {
        gameId,
        matchId,
        tutorialId,
        isTutorialRoute,
        requiresGameNamespace,
        matchRoomScopeKey,
        i18n,
        tLobby,
    } = args;
    const [onlinePreloadState, setOnlinePreloadState] = useState(() => ({
        scopeKey: matchRoomScopeKey,
        ready: false,
    }));
    const hasCompletedInitialOnlinePreload = onlinePreloadState.scopeKey === matchRoomScopeKey
        ? onlinePreloadState.ready
        : false;

    const {
        isGameNamespaceReady,
        gameNamespaceError,
        retryGameNamespaceLoad,
    } = useGameNamespaceReady(gameId, i18n, { required: requiresGameNamespace });
    const {
        isGameImplementationReady,
        gameImplementationError,
        retryGameImplementationLoad,
    } = useGameImplementationReady(gameId, {
        enabled: Boolean(gameId),
        includeTutorial: isTutorialRoute,
        tutorialId,
    });
    const gameImplReady = isGameImplementationReady;
    const resolvedTutorialManifest = useMemo(() => {
        if (!gameId || !isTutorialRoute || !gameImplReady) {
            return null;
        }
        return resolveGameTutorialManifest(gameId, tutorialId);
    }, [gameId, gameImplReady, isTutorialRoute, tutorialId]);
    const tutorialLoadingProgressText = useMemo(() => {
        if (!isTutorialRoute) return undefined;
        if (!gameId || !isGameNamespaceReady) {
            return tLobby('matchRoom.loadingProgress.loadingGameModule');
        }
        return tLobby('tutorial.steps.setup', {
            ns: `game-${gameId}`,
            defaultValue: tLobby('matchRoom.loadingProgress.preparingRoom'),
        });
    }, [gameId, isGameNamespaceReady, isTutorialRoute, tLobby]);

    useEffect(() => {
        if (gameImplementationError) {
            appendMatchLoadTrace({
                stage: 'match-room-client-error',
                gameId,
                matchId,
                payload: {
                    error: gameImplementationError,
                    isTutorialRoute,
                },
            });
        }
    }, [gameId, gameImplementationError, isTutorialRoute, matchId]);

    useEffect(() => {
        if (gameImplReady) {
            appendMatchLoadTrace({
                stage: 'match-room-client-ready',
                gameId,
                matchId,
                payload: {
                    isTutorialRoute,
                },
            });
        }
    }, [gameId, gameImplReady, isTutorialRoute, matchId]);

    const shouldBlockBoardOnImagePreload = isTutorialRoute || !hasCompletedInitialOnlinePreload;
    const handleInitialOnlinePreloadReady = useCallback(() => {
        if (!isTutorialRoute) {
            setOnlinePreloadState({ scopeKey: matchRoomScopeKey, ready: true });
        }
    }, [isTutorialRoute, matchRoomScopeKey]);
    const {
        board,
        boardShell,
    } = useMatchRoomBoardRuntime({
        gameId,
        gameImplReady,
        locale: i18n.language,
        loadingDescription: tLobby('matchRoom.loadingResources'),
        shouldBlockBoardOnImagePreload,
        onInitialOnlinePreloadReady: handleInitialOnlinePreloadReady,
    });

    const gameImplementation = useMemo(() => {
        if (!gameId || !gameImplReady) return null;
        return getGameImplementation(gameId) ?? null;
    }, [gameId, gameImplReady]);
    const engineConfig = gameImplementation?.engineConfig ?? null;
    const latencyConfig = gameImplementation?.latencyConfig;

    const onlineBoard = board && gameId ? board : null;
    const tutorialBoard = board && engineConfig && gameId ? board : null;

    const lobbyPreloadStartedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!gameId || !isGameNamespaceReady || isTutorialRoute) return;
        if (lobbyPreloadStartedRef.current === gameId) return;
        lobbyPreloadStartedRef.current = gameId;
        const resolved = resolveCriticalImages(gameId, undefined, i18n.language);
        const criticalPaths = [...new Set(resolved.critical)];
        if (criticalPaths.length > 0) {
            preloadWarmImages(criticalPaths, i18n.language, gameId);
        }
    }, [gameId, i18n.language, isGameNamespaceReady, isTutorialRoute]);

    return {
        isGameNamespaceReady,
        gameNamespaceError,
        retryGameNamespaceLoad,
        gameImplementationError,
        retryGameImplementationLoad,
        gameImplReady,
        resolvedTutorialManifest,
        tutorialLoadingProgressText,
        boardShell,
        engineConfig,
        latencyConfig,
        onlineBoard,
        tutorialBoard,
    };
}
