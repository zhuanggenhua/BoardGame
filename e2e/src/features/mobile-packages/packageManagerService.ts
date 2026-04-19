import {
    clearGameAssetBaseOverrides,
    setCommonAudioAssetBaseOverride,
    setGameAssetBaseOverride,
} from '../../core';
import { logMobileRuntime, logMobileRuntimeCritical } from '../../lib/mobile/mobileRuntimeDebug';
import { runMockGamePackageInstall } from './mockInstallRunner';
import {
    cancelNativeGamePackageInstall,
    createNativeGamePackageInstallHandle,
    ensureNativeDownloadNotificationPermission,
    listInstalledNativeGamePackages,
    readNativeGamePackageInstallState,
} from './nativeGamePackagePlugin';
import { normalizeGamePackageAssetBaseUrl } from './assetBaseUrl';
import { isSharedAudioPackGameId, SHARED_AUDIO_PACK_GAME_ID, SHARED_AUDIO_PACK_ID } from './sharedAudioPack';
import {
    clearStoredGamePackageState,
    readStoredGamePackageState,
    STALE_IN_PROGRESS_ERROR_MESSAGE,
    writeStoredGamePackageState,
} from './storage';
import type { GamePackageInstallHandle, ResolvedGamePackageManifest, StoredGamePackageState } from './types';
import { hasUsableInstalledGamePackageVersion, mergeGamePackageState } from './types';

type GamePackageStateListener = (state: StoredGamePackageState) => void;

const stateCache = new Map<string, StoredGamePackageState>();
const fallbackCache = new Map<string, StoredGamePackageState>();
const listenerRegistry = new Map<string, Set<GamePackageStateListener>>();
const activeInstallRegistry = new Map<string, GamePackageInstallHandle>();
const appliedAssetBaseOverrides = new Map<string, string>();
let appliedCommonAudioAssetBaseOverride: string | undefined;
let installedSharedAudioPackVersion: string | undefined;
const isDevRuntime = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

const hasInstalledVersion = (state: Pick<StoredGamePackageState, 'status' | 'installedVersion'>) =>
    state.status === 'installed' && hasUsableInstalledGamePackageVersion(state.installedVersion);

const isInProgressStatus = (status: StoredGamePackageState['status']) =>
    status === 'queued'
    || status === 'manifest'
    || status === 'downloading'
    || status === 'verifying';

const createInstalledPackageFallbackState = (
    installedPackage: {
        gameId: string;
        runtimeChannel: string;
        installedVersion?: string;
        assetBaseUrl?: string;
        installedAt?: number;
    },
): StoredGamePackageState => ({
    gameId: installedPackage.gameId,
    runtimeChannel: installedPackage.runtimeChannel || 'stable',
    status: 'not-installed',
    installedVersion: installedPackage.installedVersion,
    localAssetBaseUrl: installedPackage.assetBaseUrl,
    updatedAt: installedPackage.installedAt ?? Date.now(),
});

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
    }
};

const normalizeIncompleteInstalledState = (
    state: StoredGamePackageState,
    fallbackState: StoredGamePackageState,
    source: 'cache' | 'storage' | 'native-hydration',
): StoredGamePackageState => {
    if (state.status !== 'installed' || hasInstalledVersion(state)) {
        return state;
    }

    const normalizedState = mergeGamePackageState(fallbackState, {
        status: 'not-installed',
        progressPercent: undefined,
        progressMode: undefined,
        installedVersion: undefined,
        localAssetBaseUrl: undefined,
        errorMessage: undefined,
        updatedAt: state.updatedAt,
    });

    logMobileRuntime('PackageManagerService', 'normalize-incomplete-installed-state', {
        gameId: state.gameId,
        source,
        previousState: state,
        normalizedState,
    }, 'warn');

    return normalizedState;
};

const applyAssetBaseOverride = (gameId: string, assetBaseUrl?: string) => {
    const normalizedAssetBaseUrl = normalizeGamePackageAssetBaseUrl(assetBaseUrl);
    logMobileRuntimeCritical('PackageManagerService', 'apply-asset-base-override', {
        gameId,
        assetBaseUrl: assetBaseUrl ?? null,
        normalizedAssetBaseUrl: normalizedAssetBaseUrl ?? null,
    });
    if (!normalizedAssetBaseUrl) {
        appliedAssetBaseOverrides.delete(gameId);
        setGameAssetBaseOverride(gameId, undefined);
        return;
    }

    appliedAssetBaseOverrides.set(gameId, normalizedAssetBaseUrl);
    setGameAssetBaseOverride(gameId, normalizedAssetBaseUrl);
};

const applyCommonAudioOverride = (assetBaseUrl?: string, installedVersion?: string) => {
    const normalizedAssetBaseUrl = normalizeGamePackageAssetBaseUrl(assetBaseUrl);
    logMobileRuntimeCritical('PackageManagerService', 'apply-common-audio-override', {
        assetBaseUrl: assetBaseUrl ?? null,
        normalizedAssetBaseUrl: normalizedAssetBaseUrl ?? null,
        installedVersion: installedVersion ?? null,
    });

    appliedCommonAudioAssetBaseOverride = normalizedAssetBaseUrl;
    installedSharedAudioPackVersion = installedVersion?.trim() || undefined;
    setCommonAudioAssetBaseOverride(normalizedAssetBaseUrl);
};

const buildSharedAudioDependencyState = (
    baseState: StoredGamePackageState,
    sharedState: StoredGamePackageState,
): StoredGamePackageState => {
    if (sharedState.status === 'installed') {
        return mergeGamePackageState(baseState, {
            status: 'queued',
            progressMode: 'indeterminate',
            progressPercent: undefined,
            errorMessage: undefined,
            updatedAt: Date.now(),
        });
    }

    return mergeGamePackageState(baseState, {
        status: sharedState.status,
        progressMode: sharedState.progressMode,
        progressPercent: sharedState.progressPercent,
        errorCode: sharedState.status === 'failed' ? sharedState.errorCode : undefined,
        errorMessage: sharedState.status === 'failed'
            ? `公共音频包安装失败：${sharedState.errorMessage ?? '未知错误'}`
            : undefined,
        updatedAt: Date.now(),
    });
};

const refreshInstalledSharedAudioPack = async () => {
    const installedPackages = await listInstalledNativeGamePackages();
    const sharedAudioPack = installedPackages.find((item) => isSharedAudioPackGameId(item.gameId));
    applyCommonAudioOverride(sharedAudioPack?.assetBaseUrl, sharedAudioPack?.installedVersion);
    return sharedAudioPack;
};

const ensureSharedAudioPackInstalled = async (
    manifest: ResolvedGamePackageManifest,
    baseState: StoredGamePackageState,
    onHandleReady?: (handle: GamePackageInstallHandle | null) => void,
) => {
    if (!manifest.sharedAudioPackUrl) {
        return;
    }

    const expectedVersion = manifest.sharedAudioPackVersion?.trim();
    if (
        expectedVersion
        && installedSharedAudioPackVersion === expectedVersion
        && appliedCommonAudioAssetBaseOverride
    ) {
        return;
    }

    const installedSharedAudioPack = await refreshInstalledSharedAudioPack();
    if (
        expectedVersion
        && installedSharedAudioPack?.installedVersion === expectedVersion
        && installedSharedAudioPack.assetBaseUrl
    ) {
        return;
    }

    const sharedManifest: ResolvedGamePackageManifest = {
        gameId: SHARED_AUDIO_PACK_GAME_ID,
        runtimeChannel: manifest.runtimeChannel,
        assetPackId: manifest.sharedAudioPackId ?? SHARED_AUDIO_PACK_ID,
        assetPackVersion: manifest.sharedAudioPackVersion,
        assetPackUrl: manifest.sharedAudioPackUrl,
        assetPackChecksum: manifest.sharedAudioPackChecksum,
        assetPackBytes: manifest.sharedAudioPackBytes,
        assetPackFileCount: manifest.sharedAudioPackFileCount,
        source: manifest.source,
    };

    const nativeHandle = await createNativeGamePackageInstallHandle(sharedManifest, {
        onStateChange: (sharedState) => {
            emitState(buildSharedAudioDependencyState(baseState, sharedState));
        },
        onInstalledAssetBaseUrl: (_gameId, assetBaseUrl) => {
            applyCommonAudioOverride(assetBaseUrl, manifest.sharedAudioPackVersion);
        },
    });
    onHandleReady?.(nativeHandle);

    if (!nativeHandle) {
        if (isDevRuntime) {
            return;
        }
        throw new Error('当前环境不支持公共音频包安装');
    }

    const sharedInstallState = await nativeHandle.finished;
    if (sharedInstallState.status !== 'installed') {
        throw new Error(sharedInstallState.errorMessage || '公共音频包安装失败');
    }

    applyCommonAudioOverride(sharedInstallState.localAssetBaseUrl, sharedInstallState.installedVersion);
};

const normalizeStateBeforeEmit = (
    state: StoredGamePackageState,
): StoredGamePackageState => {
    const fallbackState = fallbackCache.get(state.gameId) ?? mergeGamePackageState(state, {});
    const normalizedState = normalizeIncompleteInstalledState(state, fallbackState, 'cache');
    const normalizedAssetBaseUrl = normalizeGamePackageAssetBaseUrl(normalizedState.localAssetBaseUrl);
    if (normalizedAssetBaseUrl === normalizedState.localAssetBaseUrl) {
        return normalizedState;
    }
    return {
        ...normalizedState,
        localAssetBaseUrl: normalizedAssetBaseUrl,
    };
};

const emitState = (state: StoredGamePackageState) => {
    const normalizedState = normalizeStateBeforeEmit(state);
    logMobileRuntime('PackageManagerService', 'emit-state', {
        gameId: normalizedState.gameId,
        state: normalizedState,
    });
    applyAssetBaseOverride(normalizedState.gameId, normalizedState.localAssetBaseUrl);
    stateCache.set(normalizedState.gameId, normalizedState);
    writeStoredGamePackageState(normalizedState);
    const listeners = listenerRegistry.get(normalizedState.gameId);
    listeners?.forEach((listener) => listener(normalizedState));
};

const toStaleInProgressFailureState = (
    fallbackState: StoredGamePackageState,
    currentState: StoredGamePackageState,
): StoredGamePackageState => mergeGamePackageState(fallbackState, {
    status: 'failed',
    progressPercent: undefined,
    progressMode: undefined,
    errorCode: currentState.errorCode ?? 'unknown',
    errorMessage: currentState.errorMessage ?? STALE_IN_PROGRESS_ERROR_MESSAGE,
    updatedAt: currentState.updatedAt ?? Date.now(),
});

const getCurrentOrStoredState = (
    gameId: string,
    fallbackState: StoredGamePackageState,
): StoredGamePackageState => {
    const cached = stateCache.get(gameId);
    if (cached) {
        const normalizedCached = normalizeIncompleteInstalledState(
            mergeGamePackageState(fallbackState, cached),
            fallbackState,
            'cache',
        );
        return normalizedCached;
    }

    const stored = readStoredGamePackageState(gameId, fallbackState);
    const normalizedState = normalizeIncompleteInstalledState(stored, fallbackState, 'storage');
    stateCache.set(gameId, normalizedState);
    return normalizedState;
};

const stopActiveInstall = (gameId: string) => {
    const handle = activeInstallRegistry.get(gameId);
    if (!handle) {
        return;
    }

    handle.cancel();
    activeInstallRegistry.delete(gameId);
};

export const syncGamePackageState = (
    gameId: string,
    fallbackState: StoredGamePackageState,
): StoredGamePackageState => {
    logMobileRuntime('PackageManagerService', 'sync-game-package-state', {
        gameId,
        fallbackState,
    });
    fallbackCache.set(gameId, fallbackState);
    const nextState = getCurrentOrStoredState(gameId, fallbackState);
    emitState(nextState);
    return nextState;
};

export const refreshGamePackageStateFromNativeTask = async (
    gameId: string,
    fallbackState?: StoredGamePackageState,
): Promise<StoredGamePackageState> => {
    const resolvedFallback = fallbackState ?? fallbackCache.get(gameId);
    if (!resolvedFallback) {
        throw new Error(`[MobilePackages] 缺少 ${gameId} 的 fallbackState`);
    }

    fallbackCache.set(gameId, resolvedFallback);
    logMobileRuntimeCritical('PackageManagerService', 'refresh-native-task-entered', {
        gameId,
        fallbackStatus: resolvedFallback.status,
        fallbackUpdatedAt: resolvedFallback.updatedAt,
        hasActiveInstallHandle: activeInstallRegistry.has(gameId),
    });
    const nativeSnapshot = await readNativeGamePackageInstallState(gameId);
    if (nativeSnapshot) {
        const mergedState = normalizeIncompleteInstalledState(
            mergeGamePackageState(resolvedFallback, nativeSnapshot.state),
            resolvedFallback,
            'cache',
        );
        logMobileRuntimeCritical('PackageManagerService', 'refresh-native-task-snapshot', {
            gameId,
            taskRunning: nativeSnapshot.taskRunning,
            snapshotState: nativeSnapshot.state,
            mergedStatus: mergedState.status,
            mergedProgressPercent: mergedState.progressPercent,
            mergedUpdatedAt: mergedState.updatedAt,
            hasActiveInstallHandle: activeInstallRegistry.has(gameId),
        });
        if (
            isInProgressStatus(mergedState.status)
            && nativeSnapshot.taskRunning !== true
            && !activeInstallRegistry.has(gameId)
        ) {
            const staleState = toStaleInProgressFailureState(resolvedFallback, mergedState);
            logMobileRuntimeCritical('PackageManagerService', 'refresh-native-task-stale-snapshot', {
                gameId,
                previousStatus: mergedState.status,
                previousProgressPercent: mergedState.progressPercent,
                staleState,
            });
            emitState(staleState);
            return staleState;
        }
        emitState(mergedState);
        return mergedState;
    }

    const currentState = getCurrentOrStoredState(gameId, resolvedFallback);
    logMobileRuntimeCritical('PackageManagerService', 'refresh-native-task-no-snapshot', {
        gameId,
        currentStatus: currentState.status,
        currentProgressPercent: currentState.progressPercent,
        currentUpdatedAt: currentState.updatedAt,
        hasActiveInstallHandle: activeInstallRegistry.has(gameId),
    });
    if (isInProgressStatus(currentState.status) && !activeInstallRegistry.has(gameId)) {
        const staleState = toStaleInProgressFailureState(resolvedFallback, currentState);
        logMobileRuntimeCritical('PackageManagerService', 'refresh-native-task-stale-cache', {
            gameId,
            previousStatus: currentState.status,
            previousProgressPercent: currentState.progressPercent,
            staleState,
        });
        emitState(staleState);
        return staleState;
    }

    emitState(currentState);
    return currentState;
};

export const subscribeGamePackageState = (
    gameId: string,
    listener: GamePackageStateListener,
) => {
    const listeners = listenerRegistry.get(gameId) ?? new Set<GamePackageStateListener>();
    listeners.add(listener);
    listenerRegistry.set(gameId, listeners);

    return () => {
        const current = listenerRegistry.get(gameId);
        if (!current) {
            return;
        }

        current.delete(listener);
        if (current.size === 0) {
            listenerRegistry.delete(gameId);
        }
    };
};

export const resetGamePackageState = (
    gameId: string,
    fallbackState?: StoredGamePackageState,
): StoredGamePackageState => {
    logMobileRuntime('PackageManagerService', 'reset-game-package-state', {
        gameId,
        hasExplicitFallbackState: Boolean(fallbackState),
    });
    stopActiveInstall(gameId);
    const resolvedFallback = fallbackState ?? fallbackCache.get(gameId);
    if (!resolvedFallback) {
        throw new Error(`[MobilePackages] 缺少 ${gameId} 的 fallbackState`);
    }

    fallbackCache.set(gameId, resolvedFallback);
    clearStoredGamePackageState(gameId);
    const nextState = mergeGamePackageState(resolvedFallback, {
        status: 'not-installed',
        progressPercent: undefined,
        progressMode: undefined,
        installedVersion: undefined,
        localAssetBaseUrl: undefined,
        errorCode: undefined,
        errorMessage: undefined,
        updatedAt: Date.now(),
    });
    emitState(nextState);
    return nextState;
};

export const cancelGamePackageInstall = async (
    gameId: string,
    fallbackState?: StoredGamePackageState,
): Promise<StoredGamePackageState> => {
    logMobileRuntimeCritical('PackageManagerService', 'cancel-install-entered', {
        gameId,
        hasExplicitFallbackState: Boolean(fallbackState),
        hasActiveInstallHandle: activeInstallRegistry.has(gameId),
    });
    const resolvedFallback = fallbackState ?? fallbackCache.get(gameId);
    if (!resolvedFallback) {
        throw new Error(`[MobilePackages] 缺少 ${gameId} 的 fallbackState`);
    }

    fallbackCache.set(gameId, resolvedFallback);
    stopActiveInstall(gameId);
    await cancelNativeGamePackageInstall(gameId);
    return refreshGamePackageStateFromNativeTask(gameId, resolvedFallback);
};

export const hydrateInstalledNativeGamePackages = async () => {
    const installedPackages = await listInstalledNativeGamePackages();
    logMobileRuntimeCritical('PackageManagerService', 'hydrate-installed-native-packages-critical', {
        installedPackages,
    });
    logMobileRuntime('PackageManagerService', 'hydrate-installed-native-packages', {
        installedPackages,
    });
    const seenGameIds = new Set<string>();

    clearGameAssetBaseOverrides();
    appliedAssetBaseOverrides.clear();
    applyCommonAudioOverride(undefined, undefined);

    for (const installedPackage of installedPackages) {
        if (isSharedAudioPackGameId(installedPackage.gameId)) {
            applyCommonAudioOverride(installedPackage.assetBaseUrl, installedPackage.installedVersion);
            continue;
        }

        const fallbackState = fallbackCache.get(installedPackage.gameId)
            ?? createInstalledPackageFallbackState(installedPackage);

        const hydratedState = normalizeIncompleteInstalledState(mergeGamePackageState(fallbackState, {
            status: 'installed',
            progressMode: undefined,
            progressPercent: undefined,
            installedVersion: installedPackage.installedVersion,
            localAssetBaseUrl: installedPackage.assetBaseUrl,
            updatedAt: installedPackage.installedAt ?? Date.now(),
        }), fallbackState, 'native-hydration');

        seenGameIds.add(installedPackage.gameId);
        applyAssetBaseOverride(
            installedPackage.gameId,
            hasInstalledVersion(hydratedState) ? installedPackage.assetBaseUrl : undefined,
        );
        emitState(hydratedState);
    }

    for (const gameId of fallbackCache.keys()) {
        if (seenGameIds.has(gameId)) {
            continue;
        }
        if (!appliedAssetBaseOverrides.has(gameId)) {
            setGameAssetBaseOverride(gameId, undefined);
        }
    }
};

export const startGamePackageInstall = (
    manifest: ResolvedGamePackageManifest,
    failureMessage: string,
): Promise<StoredGamePackageState> => {
    logMobileRuntime('PackageManagerService', 'start-install', {
        gameId: manifest.gameId,
        manifest,
    });
    if (!manifest.assetPackUrl) {
        const fallbackState = fallbackCache.get(manifest.gameId) ?? {
            gameId: manifest.gameId,
            runtimeChannel: manifest.runtimeChannel,
            status: 'not-installed' as const,
            modulePackId: manifest.modulePackId,
            assetPackId: manifest.assetPackId,
            modulePackBytes: manifest.modulePackBytes,
            assetPackBytes: manifest.assetPackBytes,
            updatedAt: Date.now(),
        };
        const failedState = mergeGamePackageState(fallbackState, {
            status: 'failed',
            progressMode: undefined,
            progressPercent: undefined,
            errorCode: 'manifest-missing',
            errorMessage: '当前还没有可下载的游戏包，请先发布一版。',
        });
        logMobileRuntimeCritical('PackageManagerService', 'start-install-missing-asset-pack-url', {
            gameId: manifest.gameId,
            manifestSource: manifest.source,
            assetPackId: manifest.assetPackId,
            assetPackVersion: manifest.assetPackVersion,
        });
        emitState(failedState);
        return Promise.resolve(failedState);
    }
    return (async () => {
        const fallbackState = fallbackCache.get(manifest.gameId) ?? {
            gameId: manifest.gameId,
            runtimeChannel: manifest.runtimeChannel,
            status: 'not-installed' as const,
            modulePackId: manifest.modulePackId,
            assetPackId: manifest.assetPackId,
            modulePackBytes: manifest.modulePackBytes,
            assetPackBytes: manifest.assetPackBytes,
            updatedAt: Date.now(),
        };
        const notificationPermission = await ensureNativeDownloadNotificationPermission();
        if (notificationPermission?.granted === false) {
            const failedState = mergeGamePackageState(fallbackState, {
                status: 'failed',
                progressMode: undefined,
                progressPercent: undefined,
                errorCode: 'notification-permission-required',
                errorMessage: notificationPermission.message ?? '请先允许通知权限，否则后台下载通知不会显示。',
            });
            logMobileRuntimeCritical('PackageManagerService', 'start-install-notification-permission-blocked', {
                gameId: manifest.gameId,
                state: notificationPermission.state,
                canPrompt: notificationPermission.canPrompt,
                requested: notificationPermission.requested ?? false,
            });
            emitState(failedState);
            return failedState;
        }

        stopActiveInstall(manifest.gameId);

        const queuedState: StoredGamePackageState = {
            gameId: manifest.gameId,
            runtimeChannel: manifest.runtimeChannel,
            status: 'queued',
            progressMode: 'indeterminate',
            modulePackId: manifest.modulePackId,
            assetPackId: manifest.assetPackId,
            modulePackBytes: manifest.modulePackBytes,
            assetPackBytes: manifest.assetPackBytes,
            updatedAt: Date.now(),
        };
        emitState(queuedState);

        let resolvedHandle: GamePackageInstallHandle | null = null;
        let dependencyHandle: GamePackageInstallHandle | null = null;
        let cancelledBeforeReady = false;

        const handle: GamePackageInstallHandle = {
            cancel: () => {
                cancelledBeforeReady = true;
                dependencyHandle?.cancel();
                resolvedHandle?.cancel();
            },
            finished: (async () => {
                try {
                    await ensureSharedAudioPackInstalled(manifest, queuedState, (sharedHandle) => {
                        dependencyHandle = sharedHandle;
                        if (cancelledBeforeReady) {
                            sharedHandle?.cancel();
                        }
                    });
                    dependencyHandle = null;
                    logMobileRuntimeCritical('PackageManagerService', 'install-handle-creating', {
                        gameId: manifest.gameId,
                        manifestSource: manifest.source,
                        assetPackVersion: manifest.assetPackVersion,
                    });
                    const nativeHandle = await withTimeout(
                        createNativeGamePackageInstallHandle(manifest, {
                            onStateChange: emitState,
                            onInstalledAssetBaseUrl: applyAssetBaseOverride,
                        }),
                        3000,
                        '创建原生安装器超时，请重新发起。',
                    );
                    logMobileRuntime('PackageManagerService', 'install-handle-resolved', {
                        gameId: manifest.gameId,
                        source: nativeHandle ? 'native' : 'mock',
                    });
                    logMobileRuntimeCritical('PackageManagerService', 'install-handle-resolved', {
                        gameId: manifest.gameId,
                        source: nativeHandle ? 'native' : 'mock',
                    });
                    if (nativeHandle) {
                        resolvedHandle = nativeHandle;
                    } else if (isDevRuntime) {
                        resolvedHandle = runMockGamePackageInstall(manifest, {
                            failureMessage,
                            onStateChange: emitState,
                        });
                    } else {
                        const failedState: StoredGamePackageState = {
                            ...queuedState,
                            status: 'failed',
                            progressMode: undefined,
                            progressPercent: undefined,
                            errorCode: 'unsupported-runtime',
                            errorMessage: failureMessage,
                            updatedAt: Date.now(),
                        };
                        logMobileRuntime('PackageManagerService', 'install-native-handle-missing', {
                            gameId: manifest.gameId,
                            runtime: 'production',
                        }, 'error');
                        emitState(failedState);
                        resolvedHandle = {
                            cancel: () => {},
                            finished: Promise.resolve(failedState),
                        };
                    }

                    if (cancelledBeforeReady) {
                        resolvedHandle.cancel();
                    }

                    return resolvedHandle.finished;
                } catch (error) {
                    const failedState: StoredGamePackageState = {
                        ...queuedState,
                        status: 'failed',
                        progressMode: undefined,
                        progressPercent: undefined,
                        errorCode: 'unknown',
                        errorMessage: error instanceof Error ? error.message : (failureMessage || '安装失败'),
                        updatedAt: Date.now(),
                    };
                    logMobileRuntime('PackageManagerService', 'install-early-failure', {
                        gameId: manifest.gameId,
                        error: error instanceof Error ? error.message : String(error),
                    }, 'error');
                    logMobileRuntimeCritical('PackageManagerService', 'install-early-failure', {
                        gameId: manifest.gameId,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    emitState(failedState);
                    return failedState;
                }
            })(),
        };

        activeInstallRegistry.set(manifest.gameId, handle);

        return handle.finished.finally(() => {
            if (activeInstallRegistry.get(manifest.gameId) === handle) {
                activeInstallRegistry.delete(manifest.gameId);
            }
        });
    })();
};

export const resetGamePackageManagerForTests = () => {
    logMobileRuntime('PackageManagerService', 'reset-for-tests');
    for (const [gameId, handle] of activeInstallRegistry.entries()) {
        handle.cancel();
        activeInstallRegistry.delete(gameId);
    }
    stateCache.clear();
    fallbackCache.clear();
    listenerRegistry.clear();
    appliedAssetBaseOverrides.clear();
    clearGameAssetBaseOverrides();
    applyCommonAudioOverride(undefined, undefined);
};
