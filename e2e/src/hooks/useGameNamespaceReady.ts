import { useCallback, useEffect, useState } from 'react';
import type { i18n as I18nInstance } from 'i18next';
import { logger } from '../lib/logger';
import { logMobileRuntime, logMobileRuntimeCritical } from '../lib/mobile/mobileRuntimeDebug';

interface GameNamespaceState {
    isReady: boolean;
    error: string | null;
}

interface UseGameNamespaceReadyOptions {
    required?: boolean;
}

export const GAME_NAMESPACE_LOAD_TIMEOUT_MS = 8000;
export const GAME_NAMESPACE_AUTO_RETRY_LIMIT = 1;
export const GAME_NAMESPACE_AUTO_RETRY_DELAY_MS = 1200;

const createGameNamespaceTimeoutMessage = (gameId: string, namespace: string) => (
    `游戏文案加载超时：${gameId}/${namespace}（${GAME_NAMESPACE_LOAD_TIMEOUT_MS}ms）`
);

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(timeoutMessage));
                }, timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
    }
};

/**
 * 管理游戏级 i18n namespace 的加载状态。
 * 加载失败时保留错误，避免页面继续渲染 raw key。
 */
export function useGameNamespaceReady(
    gameId: string | undefined,
    i18n: I18nInstance,
    options: UseGameNamespaceReadyOptions = {},
) {
    const [retryTick, setRetryTick] = useState(0);
    const [autoRetryCount, setAutoRetryCount] = useState(0);
    const languageKey = i18n.resolvedLanguage ?? i18n.language;
    const required = options.required ?? true;
    const [state, setState] = useState<GameNamespaceState>(() => {
        if (!gameId || !required) {
            return { isReady: true, error: null };
        }
        return {
            isReady: i18n.hasLoadedNamespace(`game-${gameId}`),
            error: null,
        };
    });

    const retry = useCallback(() => {
        setRetryTick((tick) => tick + 1);
    }, []);

    useEffect(() => {
        if (!gameId || !required) {
            queueMicrotask(() => {
                setState({ isReady: true, error: null });
            });
            queueMicrotask(() => {
                setAutoRetryCount(0);
            });
            return;
        }

        const namespace = `game-${gameId}`;
        if (i18n.hasLoadedNamespace(namespace)) {
            logMobileRuntime('GameNamespace', 'load-cache-hit', {
                gameId,
                namespace,
                language: languageKey,
                resolvedLanguage: i18n.resolvedLanguage,
            });
            queueMicrotask(() => {
                setState({ isReady: true, error: null });
            });
            queueMicrotask(() => {
                setAutoRetryCount(0);
            });
            return;
        }

        let isActive = true;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        const startedAt = Date.now();
        const timeoutMessage = createGameNamespaceTimeoutMessage(gameId, namespace);
        queueMicrotask(() => {
            if (!isActive) return;
            setState({ isReady: false, error: null });
        });
        logMobileRuntime('GameNamespace', 'load-start', {
            gameId,
            namespace,
            language: languageKey,
            resolvedLanguage: i18n.resolvedLanguage,
        });

        withTimeout(i18n.loadNamespaces(namespace), GAME_NAMESPACE_LOAD_TIMEOUT_MS, timeoutMessage)
            .then(() => {
                if (!isActive) return;
                logMobileRuntime('GameNamespace', 'load-success', {
                    gameId,
                    namespace,
                    language: languageKey,
                    resolvedLanguage: i18n.resolvedLanguage,
                    durationMs: Date.now() - startedAt,
                });
                setState({ isReady: true, error: null });
            })
            .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : String(error);
                const isTimeout = message === timeoutMessage;
                const payload = {
                    gameId,
                    namespace,
                    language: languageKey,
                    resolvedLanguage: i18n.resolvedLanguage,
                    error: message,
                    durationMs: Date.now() - startedAt,
                };
                logger.error('[i18n] 游戏 namespace 加载失败', {
                    ...payload,
                    timeoutMs: GAME_NAMESPACE_LOAD_TIMEOUT_MS,
                });
                logMobileRuntime(
                    'GameNamespace',
                    isTimeout ? 'load-timeout' : 'load-failed',
                    payload,
                    isTimeout ? 'warn' : 'error',
                );
                if (isTimeout) {
                    logMobileRuntimeCritical('GameNamespace', 'load-timeout', payload);
                }
                if (!isActive) return;
                if (isTimeout && autoRetryCount < GAME_NAMESPACE_AUTO_RETRY_LIMIT) {
                    setAutoRetryCount((count) => count + 1);
                    setState({ isReady: false, error: null });
                    retryTimer = setTimeout(() => {
                        if (!isActive) return;
                        setRetryTick((tick) => tick + 1);
                    }, GAME_NAMESPACE_AUTO_RETRY_DELAY_MS);
                    return;
                }
                setState({ isReady: false, error: message });
            });

        return () => {
            isActive = false;
            if (retryTimer) {
                clearTimeout(retryTimer);
            }
        };
    }, [autoRetryCount, gameId, i18n, languageKey, required, retryTick]);

    return {
        isGameNamespaceReady: state.isReady,
        gameNamespaceError: state.error,
        retryGameNamespaceLoad: retry,
    };
}
