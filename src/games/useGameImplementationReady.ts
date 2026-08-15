import { useCallback, useEffect, useState } from 'react';
import {
    getGameImplementation,
    hasGameTutorialLoader,
    loadGameImplementation,
    resolveGameTutorialManifest,
    subscribeGameImplementationReady,
} from './registry';

interface GameImplementationState {
    requestKey: string | null;
    isReady: boolean;
    error: string | null;
}

interface UseGameImplementationReadyOptions {
    enabled?: boolean;
    includeTutorial?: boolean;
    tutorialId?: string;
}

const createMissingClientMessage = (gameId: string) => `未找到游戏客户端：${gameId}`;
const createMissingTutorialMessage = (gameId: string, tutorialId: string) => `未找到教程：${gameId}/${tutorialId}`;

const isImplementationReady = (
    gameId: string,
    enabled: boolean,
    includeTutorial: boolean,
    tutorialId?: string,
): boolean => {
    if (!enabled) {
        return true;
    }

    const implementation = getGameImplementation(gameId);
    if (!implementation) {
        return false;
    }

    if (!includeTutorial) {
        return true;
    }

    if (tutorialId) {
        return Boolean(resolveGameTutorialManifest(gameId, tutorialId));
    }

    return Boolean(implementation.tutorial || implementation.tutorialCatalog)
        || !hasGameTutorialLoader(gameId);
};

export function useGameImplementationReady(
    gameId: string | undefined,
    options: UseGameImplementationReadyOptions = {},
) {
    const [retryTick, setRetryTick] = useState(0);
    const enabled = options.enabled ?? true;
    const includeTutorial = options.includeTutorial ?? false;
    const tutorialId = options.tutorialId;
    const requestKey = enabled && gameId
        ? `${gameId}:${retryTick}:${includeTutorial ? `tutorial:${tutorialId ?? 'default'}` : 'runtime'}`
        : null;
    const hasLoadedImplementation = Boolean(
        gameId
        && isImplementationReady(gameId, enabled, includeTutorial, tutorialId),
    );
    const [state, setState] = useState<GameImplementationState>(() => {
        if (!gameId || !enabled) {
            return { requestKey: null, isReady: true, error: null };
        }
        return {
            requestKey: null,
            isReady: isImplementationReady(gameId, enabled, includeTutorial, tutorialId),
            error: null,
        };
    });

    const retry = useCallback(() => {
        setRetryTick((tick) => tick + 1);
    }, []);

    useEffect(() => {
        if (!requestKey || !gameId || hasLoadedImplementation) {
            return;
        }

        let isActive = true;
        const unsubscribe = subscribeGameImplementationReady((resolvedGameId) => {
            if (!isActive || resolvedGameId !== gameId) {
                return;
            }
            if (!isImplementationReady(gameId, enabled, includeTutorial, tutorialId)) {
                return;
            }
            setState({ requestKey, isReady: true, error: null });
        });

        loadGameImplementation(gameId, { includeTutorial })
            .then((implementation) => {
                if (!isActive) return;
                if (!implementation) {
                    setState({
                        requestKey,
                        isReady: false,
                        error: createMissingClientMessage(gameId),
                    });
                    return;
                }
                if (includeTutorial && tutorialId && !resolveGameTutorialManifest(gameId, tutorialId)) {
                    setState({
                        requestKey,
                        isReady: false,
                        error: createMissingTutorialMessage(gameId, tutorialId),
                    });
                    return;
                }
                setState({ requestKey, isReady: true, error: null });
            })
            .catch((error: unknown) => {
                if (!isActive) return;
                const message = error instanceof Error ? error.message : String(error);
                setState({ requestKey, isReady: false, error: message });
            });

        return () => {
            isActive = false;
            unsubscribe();
        };
    }, [enabled, gameId, hasLoadedImplementation, includeTutorial, requestKey, tutorialId]);

    const resolvedState = (() => {
        if (!requestKey || !gameId || !enabled) {
            return { isReady: true, error: null };
        }
        if (hasLoadedImplementation) {
            return { isReady: true, error: null };
        }
        if (state.requestKey !== requestKey) {
            return { isReady: false, error: null };
        }
        return { isReady: state.isReady, error: state.error };
    })();

    return {
        isGameImplementationReady: resolvedState.isReady,
        gameImplementationError: resolvedState.error,
        retryGameImplementationLoad: retry,
    };
}
