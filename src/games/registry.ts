import { GAME_CLIENT_MANIFEST } from './manifest.client';
import type { GameImplementation } from '../core/types';
import type { GameClientRuntimeModule } from './manifest.client.types';
import { logMobileRuntime, logMobileRuntimeCritical } from '../lib/mobile/mobileRuntimeDebug';
import { isStaleChunkError, reloadForStaleChunkOnce } from '../lib/staleChunkReloadGuard';
import { isNativeAndroidRuntime } from '../lib/mobile/androidRuntime';
import { safeMatchMedia } from '../lib/mediaQuery';
import { appendMatchLoadTrace, captureRecentMatchLoadResources } from '../lib/matchLoadTrace';
import { isMobileViewport } from '../shared/mobileSupport';
import { getCriticalImageResolver, registerCriticalImageResolver } from '../core';
import type { CriticalImageResolver } from '../core/types';
import type { GameTutorialSource, TutorialCollection, TutorialManifest } from '../engine/types';

// 重新导出类型供外部使用
export type { GameImplementation } from '../core/types';

/** 游戏运行时缓存：加载一次后缓存，避免重复 import */
const runtimeCache = new Map<string, GameClientRuntimeModule>();
/** 正在加载中的 runtime Promise，防止并发重复加载 */
const loadingPromises = new Map<string, Promise<GameClientRuntimeModule>>();
/** 教程模块加载中的 Promise，避免重复 import */
const tutorialLoadingPromises = new Map<string, Promise<void>>();
/** 关键图片解析器加载中的 Promise，避免并发重复 import */
const criticalImageResolverLoadingPromises = new Map<string, Promise<void>>();
/** late success 通知，避免超时报错后模块实际加载完成却还卡在错误页 */
const readyListeners = new Set<(gameId: string) => void>();

/** 游戏 ID → loadRuntime 函数的映射 */
const loaderMap = new Map<string, () => Promise<GameClientRuntimeModule>>();
/** 游戏 ID → loadTutorial 函数的映射 */
const tutorialLoaderMap = new Map<string, () => Promise<GameTutorialSource | undefined>>();
/** 游戏 ID → loadCriticalImageResolver 函数的映射 */
const criticalImageResolverLoaderMap = new Map<string, () => Promise<CriticalImageResolver>>();

export const GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS = 15000;
export const SLOW_DEVICE_GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS = 45000;

type LoadGameImplementationOptions = {
    includeTutorial?: boolean;
};

type NavigatorConnectionLike = {
    effectiveType?: string;
    saveData?: boolean;
};

type GameImplementationTimeoutRuntimeOptions = {
    windowObject?: Pick<Window, 'innerWidth'> | undefined;
    navigatorObject?: {
        connection?: NavigatorConnectionLike;
        deviceMemory?: number;
        hardwareConcurrency?: number;
    } | undefined;
    isNativeAndroid?: boolean;
    isCoarsePointer?: boolean;
    isTestMode?: boolean;
};

const SLOW_NETWORK_TYPES = new Set(['slow-2g', '2g', '3g']);

const isTutorialCollection = (source: GameTutorialSource | undefined): source is TutorialCollection => {
    if (!source || typeof source !== 'object') return false;
    return 'defaultTutorialId' in source && 'tutorials' in source;
};

const createSingleTutorialCatalog = (manifest: TutorialManifest): TutorialCollection => ({
    defaultTutorialId: manifest.id,
    tutorials: {
        [manifest.id]: {
            manifest,
        },
    },
});

const normalizeGameTutorialSource = (
    tutorialSource: GameTutorialSource,
): Pick<GameClientRuntimeModule, 'tutorial' | 'tutorialCatalog'> => {
    if (isTutorialCollection(tutorialSource)) {
        const defaultEntry = tutorialSource.tutorials[tutorialSource.defaultTutorialId];
        return {
            tutorial: defaultEntry?.manifest,
            tutorialCatalog: tutorialSource,
        };
    }

    return {
        tutorial: tutorialSource,
        tutorialCatalog: createSingleTutorialCatalog(tutorialSource),
    };
};

const emitGameImplementationReady = (gameId: string) => {
    for (const listener of readyListeners) {
        try {
            listener(gameId);
        } catch {
            // 单个订阅者异常不能影响其他恢复链路
        }
    }
};

export const subscribeGameImplementationReady = (
    listener: (gameId: string) => void,
): (() => void) => {
    readyListeners.add(listener);
    return () => {
        readyListeners.delete(listener);
    };
};

export const resolveGameImplementationLoadTimeoutMs = (
    options: GameImplementationTimeoutRuntimeOptions = {},
): number => {
    const runtimeWindow = options.windowObject ?? (
        typeof window !== 'undefined'
            ? window
            : undefined
    );
    const runtimeNavigator = options.navigatorObject ?? (
        typeof navigator !== 'undefined'
            ? navigator
            : undefined
    );
    const isTestMode = options.isTestMode ?? (
        typeof window !== 'undefined'
            ? Boolean((window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__)
            : false
    );
    const isNativeAndroid = options.isNativeAndroid ?? isNativeAndroidRuntime();
    const isCoarsePointer = options.isCoarsePointer ?? safeMatchMedia('(pointer: coarse)').matches;
    const isMobileWidth = typeof runtimeWindow?.innerWidth === 'number'
        ? isMobileViewport(runtimeWindow.innerWidth)
        : false;
    const connection = runtimeNavigator?.connection;
    const isSlowNetwork = connection?.effectiveType
        ? SLOW_NETWORK_TYPES.has(connection.effectiveType)
        : false;
    const saveDataEnabled = connection?.saveData === true;
    const lowMemoryDevice = typeof runtimeNavigator?.deviceMemory === 'number'
        ? runtimeNavigator.deviceMemory <= 4
        : false;
    const lowCpuDevice = typeof runtimeNavigator?.hardwareConcurrency === 'number'
        ? runtimeNavigator.hardwareConcurrency <= 4
        : false;

    if (
        isTestMode
        || 
        isNativeAndroid
        || isCoarsePointer
        || isMobileWidth
        || isSlowNetwork
        || saveDataEnabled
        || lowMemoryDevice
        || lowCpuDevice
    ) {
        return SLOW_DEVICE_GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS;
    }

    return GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS;
};

const createGameImplementationTimeoutMessage = (gameId: string, timeoutMs: number) => (
    `游戏客户端模块加载超时：${gameId}（${timeoutMs}ms）`
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

// 构建 loader 映射（同步，不触发实际加载）
for (const entry of GAME_CLIENT_MANIFEST) {
    const { manifest, loadRuntime, loadTutorial, loadCriticalImageResolver } = entry;
    if (manifest.type !== 'game' || !manifest.enabled || !loadRuntime) continue;
    loaderMap.set(manifest.id, loadRuntime);
    if (loadTutorial) {
        tutorialLoaderMap.set(manifest.id, loadTutorial);
    }
    if (loadCriticalImageResolver) {
        criticalImageResolverLoaderMap.set(manifest.id, loadCriticalImageResolver);
    }
}

export const ensureGameCriticalImageResolverLoaded = async (gameId: string): Promise<void> => {
    if (getCriticalImageResolver(gameId)) {
        appendMatchLoadTrace({
            stage: 'critical-image-resolver-cache-hit',
            gameId,
        });
        logMobileRuntime('GameRuntime', 'critical-image-resolver-cache-hit', { gameId });
        return;
    }

    const loader = criticalImageResolverLoaderMap.get(gameId);
    if (!loader) {
        return;
    }

    const existing = criticalImageResolverLoadingPromises.get(gameId);
    if (existing) {
        appendMatchLoadTrace({
            stage: 'critical-image-resolver-reuse-inflight',
            gameId,
        });
        logMobileRuntime('GameRuntime', 'critical-image-resolver-reuse-inflight', { gameId });
        await existing;
        return;
    }

    const startedAt = Date.now();
    appendMatchLoadTrace({
        stage: 'critical-image-resolver-load-start',
        gameId,
    });
    logMobileRuntime('GameRuntime', 'critical-image-resolver-load-start', { gameId });

    const promise = loader()
        .then((resolver) => {
            if (!getCriticalImageResolver(gameId)) {
                registerCriticalImageResolver(gameId, resolver);
            }
            const durationMs = Date.now() - startedAt;
            appendMatchLoadTrace({
                stage: 'critical-image-resolver-load-success',
                gameId,
                payload: {
                    durationMs,
                },
            });
            logMobileRuntime('GameRuntime', 'critical-image-resolver-load-success', {
                gameId,
                durationMs,
            });
        })
        .catch((error: unknown) => {
            const durationMs = Date.now() - startedAt;
            appendMatchLoadTrace({
                stage: 'critical-image-resolver-load-failed',
                gameId,
                payload: {
                    durationMs,
                    error: error instanceof Error ? error.message : String(error),
                    ...captureRecentMatchLoadResources(),
                },
            });
            logMobileRuntime('GameRuntime', 'critical-image-resolver-load-failed', {
                gameId,
                durationMs,
                error: error instanceof Error ? error.message : String(error),
            }, 'error');
            throw error;
        })
        .finally(() => {
            if (criticalImageResolverLoadingPromises.get(gameId) === promise) {
                criticalImageResolverLoadingPromises.delete(gameId);
            }
        });

    criticalImageResolverLoadingPromises.set(gameId, promise);
    await promise;
};

const ensureGameImplementationLoadTask = (gameId: string): Promise<GameClientRuntimeModule> | null => {
    const cached = runtimeCache.get(gameId);
    if (cached) {
        return Promise.resolve(cached);
    }

    const existing = loadingPromises.get(gameId);
    if (existing) {
        return existing;
    }

    const loader = loaderMap.get(gameId);
    if (!loader) {
        logMobileRuntime('GameRuntime', 'load-missing-loader', { gameId }, 'warn');
        return null;
    }

    const promise = loader()
        .then((runtime) => {
            runtimeCache.set(gameId, runtime);
            emitGameImplementationReady(gameId);
            return runtime;
        })
        .finally(() => {
            if (loadingPromises.get(gameId) === promise) {
                loadingPromises.delete(gameId);
            }
        });

    loadingPromises.set(gameId, promise);
    return promise;
};

export const prefetchGameImplementation = async (
    gameId: string,
    options: LoadGameImplementationOptions = {},
): Promise<GameImplementation | null> => {
    const includeTutorial = options.includeTutorial === true;
    const cached = runtimeCache.get(gameId);
    if (cached) {
        logMobileRuntime('GameRuntime', 'prefetch-cache-hit', {
            gameId,
            includeTutorial,
            hasTutorial: Boolean(cached.tutorial),
        });
        if (includeTutorial) {
            await ensureGameTutorialLoaded(gameId);
        }
        return runtimeCache.get(gameId) ?? cached;
    }

    const existing = loadingPromises.get(gameId);
    const startedAt = Date.now();
    logMobileRuntime(
        'GameRuntime',
        existing ? 'prefetch-reuse-inflight' : 'prefetch-start',
        { gameId, includeTutorial },
    );

    const task = ensureGameImplementationLoadTask(gameId);
    if (!task) {
        return null;
    }

    try {
        const runtime = await task;
        if (includeTutorial) {
            await ensureGameTutorialLoaded(gameId);
        }
        logMobileRuntime('GameRuntime', 'prefetch-success', {
            gameId,
            includeTutorial,
            durationMs: Date.now() - startedAt,
        });
        return runtimeCache.get(gameId) ?? runtime;
    } catch (error: unknown) {
        logMobileRuntime('GameRuntime', 'prefetch-failed', {
            gameId,
            includeTutorial,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
        }, 'warn');
        throw error;
    }
};

const ensureGameTutorialLoaded = async (gameId: string): Promise<void> => {
    const cached = runtimeCache.get(gameId);
    if (cached?.tutorialCatalog || cached?.tutorial) {
        appendMatchLoadTrace({
            stage: 'game-tutorial-cache-hit',
            gameId,
        });
        return;
    }

    const loader = tutorialLoaderMap.get(gameId);
    if (!loader) {
        return;
    }

    const existing = tutorialLoadingPromises.get(gameId);
    if (existing) {
        appendMatchLoadTrace({
            stage: 'game-tutorial-reuse-inflight',
            gameId,
        });
        await existing;
        return;
    }

    appendMatchLoadTrace({
        stage: 'game-tutorial-load-start',
        gameId,
    });
    const promise = loader()
        .then((tutorialSource) => {
            if (!tutorialSource) {
                return;
            }
            const current = runtimeCache.get(gameId);
            if (!current) {
                return;
            }
            const normalizedTutorial = normalizeGameTutorialSource(tutorialSource);
            runtimeCache.set(gameId, {
                ...current,
                ...normalizedTutorial,
            });
            emitGameImplementationReady(gameId);
            appendMatchLoadTrace({
                stage: 'game-tutorial-load-success',
                gameId,
            });
        })
        .catch((error: unknown) => {
            appendMatchLoadTrace({
                stage: 'game-tutorial-load-failed',
                gameId,
                payload: {
                    error: error instanceof Error ? error.message : String(error),
                },
            });
            throw error;
        })
        .finally(() => {
            if (tutorialLoadingPromises.get(gameId) === promise) {
                tutorialLoadingPromises.delete(gameId);
            }
        });

    tutorialLoadingPromises.set(gameId, promise);
    await promise;
};

/**
 * 异步加载游戏实现（Board/engineConfig/tutorial/latencyConfig）
 * 首次调用触发动态 import，后续调用返回缓存
 */
export const loadGameImplementation = async (
    gameId: string,
    options: LoadGameImplementationOptions = {},
): Promise<GameImplementation | null> => {
    const includeTutorial = options.includeTutorial === true;

    // 1. 缓存命中
    const cached = runtimeCache.get(gameId);
    if (cached) {
        appendMatchLoadTrace({
            stage: 'game-runtime-cache-hit',
            gameId,
            payload: {
                includeTutorial,
                hasTutorial: Boolean(cached.tutorial),
            },
        });
        if (includeTutorial) {
            await ensureGameTutorialLoaded(gameId);
        }
        logMobileRuntime('GameRuntime', 'load-cache-hit', { gameId });
        return runtimeCache.get(gameId) ?? cached;
    }

    const existing = loadingPromises.get(gameId);
    const startedAt = Date.now();
    const timeoutMs = resolveGameImplementationLoadTimeoutMs();
    const timeoutMessage = createGameImplementationTimeoutMessage(gameId, timeoutMs);

    appendMatchLoadTrace({
        stage: existing ? 'game-runtime-reuse-inflight' : 'game-runtime-load-start',
        gameId,
        payload: {
            includeTutorial,
            ...(existing ? {} : { timeoutMs }),
        },
    });
    logMobileRuntime('GameRuntime', existing ? 'load-reuse-inflight' : 'load-start', {
        gameId,
        ...(existing ? {} : { timeoutMs }),
    });

    const task = ensureGameImplementationLoadTask(gameId);
    if (!task) {
        return null;
    }

    const promise = withTimeout(task, timeoutMs, timeoutMessage)
        .then((runtime) => {
            appendMatchLoadTrace({
                stage: 'game-runtime-load-success',
                gameId,
                payload: {
                    includeTutorial,
                    durationMs: Date.now() - startedAt,
                    hasTutorial: Boolean(runtime.tutorial),
                    hasLatencyConfig: Boolean(runtime.latencyConfig),
                },
            });
            logMobileRuntime('GameRuntime', 'load-success', {
                gameId,
                durationMs: Date.now() - startedAt,
            });
            return runtime;
        })
        .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            const isTimeout = message === timeoutMessage;
            const resourceSnapshot = captureRecentMatchLoadResources();
            const payload = {
                gameId,
                error: message,
                timeoutMs,
                durationMs: Date.now() - startedAt,
                ...resourceSnapshot,
            };
            appendMatchLoadTrace({
                stage: isTimeout ? 'game-runtime-load-timeout' : 'game-runtime-load-failed',
                gameId,
                payload: {
                    includeTutorial,
                    error: message,
                    timeoutMs,
                    durationMs: payload.durationMs,
                    ...resourceSnapshot,
                },
            });

            logMobileRuntime(
                'GameRuntime',
                isTimeout ? 'load-timeout' : 'load-failed',
                payload,
                isTimeout ? 'warn' : 'error',
            );
            logMobileRuntimeCritical('GameRuntime', isTimeout ? 'load-timeout' : 'load-failed', payload);
            if (typeof window !== 'undefined' && isStaleChunkError(error)) {
                reloadForStaleChunkOnce(`game-runtime-load-failed:${gameId}`, window);
            }
            throw error;
        });
    const runtime = await promise;
    if (includeTutorial) {
        await ensureGameTutorialLoaded(gameId);
    }
    return runtimeCache.get(gameId) ?? runtime;
};

/**
 * 同步获取已缓存的游戏实现（未加载则返回 null）
 * 用于已确认加载完成的场景
 */
export const getGameImplementation = (gameId: string): GameImplementation | null => {
    return runtimeCache.get(gameId) ?? null;
};

export const resolveGameTutorialManifest = (
    gameId: string,
    tutorialId?: string,
): TutorialManifest | null => {
    const implementation = getGameImplementation(gameId);
    if (!implementation) {
        return null;
    }

    if (!tutorialId) {
        return implementation.tutorial ?? null;
    }

    if (implementation.tutorialCatalog) {
        return implementation.tutorialCatalog.tutorials[tutorialId]?.manifest ?? null;
    }

    return implementation.tutorial?.id === tutorialId
        ? implementation.tutorial
        : null;
};

/**
 * 检查游戏是否已注册（不触发加载）
 */
export const hasGameImplementation = (gameId: string): boolean => {
    return loaderMap.has(gameId);
};

export const hasGameTutorialLoader = (gameId: string): boolean => {
    return tutorialLoaderMap.has(gameId);
};

// ---- 向后兼容：保留 GAME_IMPLEMENTATIONS 供不方便改异步的地方使用 ----
// 注意：这个对象在首次访问时是空的，游戏实现需要通过 loadGameImplementation 加载后才会填充
export const GAME_IMPLEMENTATIONS: Record<string, GameImplementation> = new Proxy(
    {} as Record<string, GameImplementation>,
    {
        get(_, prop: string) {
            return runtimeCache.get(prop);
        },
        has(_, prop: string) {
            return runtimeCache.has(prop);
        },
    }
);
