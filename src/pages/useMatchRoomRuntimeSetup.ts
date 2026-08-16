import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { i18n as I18nInstance } from 'i18next';
import type { GameImplementation } from '../core/types';
import { getGameImplementation } from '../games/registry';
import { preloadWarmImages } from '../core';
import { resolveCriticalImages } from '../core/CriticalImageResolverRegistry';
import { appendMatchLoadTrace } from '../lib/matchLoadTrace';
import { useGameNamespaceReady } from '../hooks/useGameNamespaceReady';
import { useGameImplementationReady } from '../games/useGameImplementationReady';
import { useMatchRoomBoardRuntime } from './matchRoomBoardRuntime';
import type { MatchRoomLobbyTranslator } from './matchRoomPageTypes';
import type { TutorialCollection, TutorialManifest } from '../engine/types';

const createSingleTutorialCatalog = (manifest: TutorialManifest): TutorialCollection => ({
    defaultTutorialId: manifest.id,
    tutorials: {
        [manifest.id]: {
            manifest,
        },
    },
});

export const resolveTutorialCatalogForStage = (
    gameImplementation: GameImplementation | null,
): TutorialCollection | null => {
    if (!gameImplementation) {
        return null;
    }

    if (gameImplementation.tutorialCatalog) {
        return gameImplementation.tutorialCatalog;
    }

    if (gameImplementation.tutorial) {
        return createSingleTutorialCatalog(gameImplementation.tutorial);
    }

    return null;
};

export const getVisibleTutorialCatalogEntries = (
    tutorialCatalog: TutorialCollection | null | undefined,
): Array<[string, NonNullable<TutorialCollection['tutorials'][string]>]> => {
    if (!tutorialCatalog) {
        return [];
    }

    return Object.entries(tutorialCatalog.tutorials)
        .filter(([, entry]) => entry.hiddenFromCatalog !== true);
};

export const getTutorialCatalogEntry = (
    tutorialCatalog: TutorialCollection | null | undefined,
    tutorialId?: string,
): NonNullable<TutorialCollection['tutorials'][string]> | null => {
    if (!tutorialCatalog || !tutorialId) {
        return null;
    }
    return tutorialCatalog.tutorials[tutorialId] ?? null;
};

export const resolveTutorialManifestForStage = (args: {
    gameId?: string;
    isTutorialRoute: boolean;
    tutorialId?: string;
    gameImplementation: GameImplementation | null;
}): TutorialManifest | null => {
    const {
        gameId,
        isTutorialRoute,
        tutorialId,
        gameImplementation,
    } = args;

    if (!gameId || !isTutorialRoute || !gameImplementation) {
        return null;
    }

    const tutorialCatalog = resolveTutorialCatalogForStage(gameImplementation);
    const visibleEntries = getVisibleTutorialCatalogEntries(tutorialCatalog);
    if (!tutorialId && tutorialCatalog && visibleEntries.length > 1) {
        return null;
    }

    if (tutorialId) {
        return tutorialCatalog?.tutorials[tutorialId]?.manifest ?? null;
    }

    if (tutorialCatalog) {
        const defaultEntry = tutorialCatalog.tutorials[tutorialCatalog.defaultTutorialId];
        if (defaultEntry && defaultEntry.hiddenFromCatalog !== true) {
            return defaultEntry.manifest;
        }
        return visibleEntries[0]?.[1].manifest ?? null;
    }

    return gameImplementation.tutorial ?? null;
};

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
    const gameImplementation = useMemo(() => {
        if (!gameId || !gameImplReady) return null;
        return getGameImplementation(gameId) ?? null;
    }, [gameId, gameImplReady]);
    const tutorialCatalog = useMemo(() => {
        if (!isTutorialRoute) return null;
        return resolveTutorialCatalogForStage(gameImplementation);
    }, [gameImplementation, isTutorialRoute]);
    const resolvedTutorialManifest = useMemo(() => {
        return resolveTutorialManifestForStage({
            gameId,
            isTutorialRoute,
            tutorialId,
            gameImplementation,
        });
    }, [gameId, gameImplementation, isTutorialRoute, tutorialId]);
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
    const [onlineBoardPreloadBlockingState, setOnlineBoardPreloadBlockingState] = useState(() => ({
        scopeKey: matchRoomScopeKey,
        blocking: false,
    }));
    const inferredOnlineBoardPreloadBlocking = !isTutorialRoute && shouldBlockBoardOnImagePreload;
    const onlineBoardPreloadBlocking = inferredOnlineBoardPreloadBlocking
        || (
            !isTutorialRoute
            && onlineBoardPreloadBlockingState.scopeKey === matchRoomScopeKey
            && onlineBoardPreloadBlockingState.blocking
        );
    const handleInitialOnlinePreloadReady = useCallback(() => {
        if (!isTutorialRoute) {
            setOnlinePreloadState({ scopeKey: matchRoomScopeKey, ready: true });
        }
    }, [isTutorialRoute, matchRoomScopeKey]);
    const handleOnlineBoardPreloadBlockingChange = useCallback((blocking: boolean) => {
        setOnlineBoardPreloadBlockingState((previous) => {
            const nextBlocking = !isTutorialRoute && blocking;
            if (previous.scopeKey === matchRoomScopeKey && previous.blocking === nextBlocking) {
                return previous;
            }
            return {
                scopeKey: matchRoomScopeKey,
                blocking: nextBlocking,
            };
        });
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
        onBoardPreloadBlockingChange: handleOnlineBoardPreloadBlockingChange,
    });
    const engineConfig = gameImplementation?.engineConfig ?? null;
    const latencyConfig = gameImplementation?.latencyConfig;
    const runtimeAdapter = gameImplementation?.runtimeAdapter ?? null;

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
        tutorialCatalog,
        resolvedTutorialManifest,
        tutorialLoadingProgressText,
        boardShell,
        engineConfig,
        runtimeAdapter,
        latencyConfig,
        onlineBoard,
        tutorialBoard,
        onlineBoardPreloadBlocking,
    };
}
