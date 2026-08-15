import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
    GamePackageInstallErrorCode,
    GamePackageInstallHandle,
    ResolvedGamePackageManifest,
    StoredGamePackageState,
} from './types';
import { logMobileRuntime, logMobileRuntimeCritical } from '../../lib/mobile/mobileRuntimeDebug';
import { mergeGamePackageState } from './types';
import { normalizeGamePackageAssetBaseUrl, normalizeNativeAssetRootPath } from './assetBaseUrl';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { resolveAssetsBaseUrlFromEnv } from '../../core/AssetLoader';
import { SHARED_AUDIO_PACK_GAME_ID } from './sharedAudioPack';
import { resolveMissingAssetPackErrorCode } from './errorMessages';

type PluginListenerHandle = {
    remove(): Promise<void>;
};

type NativeInstallLifecycleStatus =
    | StoredGamePackageState['status']
    | 'running'
    | 'completed'
    | 'cancelled';

export type NativeNotificationPermissionState =
    | 'granted'
    | 'prompt'
    | 'prompt-with-rationale'
    | 'denied';

export interface NativeDownloadNotificationPermissionResult {
    required: boolean;
    granted: boolean;
    canPrompt: boolean;
    state: NativeNotificationPermissionState;
    requested?: boolean;
    message?: string;
}

type NativeGamePackagePlugin = {
    listInstalledPackages(): Promise<{
        packages: Array<{
            gameId: string;
            runtimeChannel?: string;
            installedAt?: number;
            assetPackVersion?: string;
            assetRootPath?: string;
        }>;
    }>;
    getInstallState(options: {
        gameId: string;
    }): Promise<{
        exists?: boolean;
        taskRunning?: boolean;
        gameId?: string;
        status?: NativeInstallLifecycleStatus;
        progressPercent?: number;
        progressMode?: StoredGamePackageState['progressMode'];
        errorCode?: GamePackageInstallErrorCode;
        errorMessage?: string;
        installedAt?: number;
        assetPackVersion?: string;
        assetRootPath?: string;
        updatedAt?: number;
    }>;
    installGamePackage(options: {
        gameId: string;
        runtimeChannel: string;
        assetPackId?: string;
        assetPackVersion?: string;
        assetPackUrl: string;
        assetPackChecksum?: string;
    }): Promise<{
        accepted?: boolean;
        taskId?: string;
        status?: NativeInstallLifecycleStatus;
        gameId: string;
        runtimeChannel?: string;
        installedAt?: number;
        assetPackVersion?: string;
        assetRootPath?: string;
    }>;
    installGamePackageIncremental(options: {
        gameId: string;
        runtimeChannel: string;
        assetPackId?: string;
        assetPackVersion?: string;
        assetPackUrl?: string;
        assetPackChecksum?: string;
        assetBaseUrl: string;
        fileIndexUrl: string;
        fileIndexChecksum?: string;
        allowFullFallback?: boolean;
    }): Promise<{
        accepted?: boolean;
        taskId?: string;
        status?: NativeInstallLifecycleStatus;
        gameId: string;
        runtimeChannel?: string;
        installedAt?: number;
        assetPackVersion?: string;
        assetRootPath?: string;
    }>;
    getNotificationPermissionStatus(): Promise<{
        required?: boolean;
        granted?: boolean;
        canPrompt?: boolean;
        requested?: boolean;
        state?: NativeNotificationPermissionState;
        message?: string;
    }>;
    ensureNotificationPermission(): Promise<{
        required?: boolean;
        granted?: boolean;
        canPrompt?: boolean;
        requested?: boolean;
        state?: NativeNotificationPermissionState;
        message?: string;
    }>;
    openNotificationSettings(): Promise<void>;
    fetchRemoteJson(options: {
        url: string;
    }): Promise<{
        status?: number;
        body?: string;
        contentType?: string;
    }>;
    readInstalledAsset(options: {
        gameId: string;
        relativePath: string;
    }): Promise<{
        gameId?: string;
        relativePath?: string;
        mimeType?: string;
        base64?: string;
        size?: number;
    }>;
    cancelInstall(options: { gameId: string }): Promise<void>;
    uninstallGamePackage(options: { gameId: string }): Promise<{
        gameId?: string;
        status?: NativeInstallLifecycleStatus;
        updatedAt?: number;
    }>;
    addListener(
        eventName: 'installStateChanged',
        listenerFunc: (event: {
            gameId?: string;
            status?: NativeInstallLifecycleStatus;
            progressPercent?: number;
            progressMode?: StoredGamePackageState['progressMode'];
            errorCode?: GamePackageInstallErrorCode;
            errorMessage?: string;
            installedAt?: number;
            assetPackVersion?: string;
            assetRootPath?: string;
        }) => void,
    ): Promise<PluginListenerHandle>;
};

interface NativeInstallRunnerOptions {
    onStateChange: (state: StoredGamePackageState) => void;
    onInstalledAssetBaseUrl?: (gameId: string, assetBaseUrl?: string) => void;
}

type NativeGamePackageWindowLike = {
    __BG_E2E_DISABLE_NATIVE_GAME_PACKAGE_PLUGIN__?: boolean;
};

export interface NativeInstalledGamePackage {
    gameId: string;
    runtimeChannel: string;
    installedAt?: number;
    installedVersion?: string;
    assetBaseUrl?: string;
}

export interface NativeRemoteJsonResponse {
    status?: number;
    body?: string;
    contentType?: string;
}

export interface NativeInstalledAssetBlobUrlResult {
    blobUrl: string;
    mimeType?: string;
    size?: number;
}

export interface NativeGamePackageInstallStateSnapshot {
    exists: boolean;
    state: Partial<StoredGamePackageState>;
    taskRunning: boolean;
}

let nativePluginLoader: NativeGamePackagePlugin | null | undefined;
const nativeGamePackagePlugin = registerPlugin<NativeGamePackagePlugin>('GamePackage');
const resolvedAssetsBaseUrl = resolveAssetsBaseUrlFromEnv(
    (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {},
);

const buildBaseState = (manifest: ResolvedGamePackageManifest): StoredGamePackageState => ({
    gameId: manifest.gameId,
    runtimeChannel: manifest.runtimeChannel,
    status: 'not-installed',
    modulePackId: manifest.modulePackId,
    assetPackId: manifest.assetPackId,
    modulePackBytes: manifest.modulePackBytes,
    assetPackBytes: manifest.assetPackBytes,
    updatedAt: Date.now(),
});

const clampPercent = (value: number | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
};

const isGamePackageInstallErrorCode = (value: string): value is GamePackageInstallErrorCode => (
    value === 'network-timeout'
    || value === 'http-error'
    || value === 'resume-not-supported'
    || value === 'checksum-mismatch'
    || value === 'insufficient-storage'
    || value === 'archive-invalid'
    || value === 'file-io'
    || value === 'cancelled'
    || value === 'task-conflict'
    || value === 'manifest-fetch-failed'
    || value === 'manifest-missing'
    || value === 'notification-permission-required'
    || value === 'unsupported-runtime'
    || value === 'unknown'
);

const normalizeNativeInstallStatus = (
    status: NativeInstallLifecycleStatus | undefined,
    fallbackStatus: StoredGamePackageState['status'] = 'queued',
): StoredGamePackageState['status'] | undefined => {
    switch (status) {
        case 'not-installed':
        case 'queued':
        case 'manifest':
        case 'downloading':
        case 'verifying':
        case 'installed':
        case 'failed':
            return status;
        case 'running':
            return fallbackStatus === 'not-installed' ? 'manifest' : fallbackStatus;
        case 'completed':
            return 'installed';
        case 'cancelled':
            return 'failed';
        default:
            return undefined;
    }
};

const INCREMENTAL_INSTALL_UNAVAILABLE_PATTERNS = [
    /installgamepackageincremental/i,
    /not implemented/i,
    /unimplemented/i,
    /not available/i,
    /not a function/i,
    /does not exist/i,
    /does not have/i,
    /unable to find/i,
    /method .* not found/i,
];

const shouldFallbackToFullInstallFromBridgeError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (!message) {
        return false;
    }

    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
        return false;
    }

    return INCREMENTAL_INSTALL_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
};

const buildDiffOnlyFallbackBlockedMessage = () => (
    '当前 App 版本不支持素材包差异安装，且该素材包版本没有对应完整 ZIP 兜底。请更新 App 后再安装。'
);

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

export { normalizeNativeAssetRootPath } from './assetBaseUrl';

const toAssetBaseUrl = (assetRootPath?: string) => normalizeGamePackageAssetBaseUrl(assetRootPath);

const normalizeNotificationPermissionResult = (
    result: Partial<NativeDownloadNotificationPermissionResult> | null | undefined,
): NativeDownloadNotificationPermissionResult => {
    const rawState = result?.state;
    const state: NativeNotificationPermissionState = rawState === 'granted'
        || rawState === 'prompt'
        || rawState === 'prompt-with-rationale'
        || rawState === 'denied'
        ? rawState
        : 'prompt';
    const required = result?.required === true;
    const granted = required ? result?.granted === true : true;
    const canPrompt = required
        ? (result?.canPrompt === true || state === 'prompt' || state === 'prompt-with-rationale')
        : false;

    return {
        required,
        granted,
        canPrompt,
        state: granted ? 'granted' : state,
        requested: result?.requested === true,
        message: typeof result?.message === 'string' && result.message.trim()
            ? result.message.trim()
            : (granted
                ? undefined
                : (canPrompt
                    ? '请先允许通知权限，否则后台下载通知不会显示。'
                    : '通知权限已被拒绝，请到系统设置中开启后再重试下载。')),
    };
};

const getNativePlugin = (): NativeGamePackagePlugin | null => {
    if (nativePluginLoader !== undefined) {
        return nativePluginLoader;
    }

    const runtimeWindow = typeof window !== 'undefined'
        ? window as typeof window & NativeGamePackageWindowLike
        : undefined;
    if (
        import.meta.env.DEV
        && runtimeWindow?.__BG_E2E_DISABLE_NATIVE_GAME_PACKAGE_PLUGIN__ === true
    ) {
        logMobileRuntime('NativeGamePackagePlugin', 'skip-e2e-native-plugin', {
            mode: import.meta.env.MODE,
        });
        nativePluginLoader = null;
        return nativePluginLoader;
    }

    if (!isNativeAndroidRuntime()) {
        logMobileRuntime('NativeGamePackagePlugin', 'skip-non-native-android-runtime', {
            mode: import.meta.env.MODE,
        });
        nativePluginLoader = null;
        return nativePluginLoader;
    }

    logMobileRuntimeCritical('NativeGamePackagePlugin', 'get-plugin-platform-check', {
        isNative: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform(),
    });
    // registerPlugin 返回的是 Proxy。不要把它包装进 async/await 返回链，
    // 否则可能被 Promise 当成 thenable 吸收并卡住解析。
    nativePluginLoader = nativeGamePackagePlugin;
    logMobileRuntimeCritical('NativeGamePackagePlugin', 'get-plugin-registered', {
        hasPlugin: true,
        methods: Object.keys(nativeGamePackagePlugin).slice(0, 10),
    });
    return nativePluginLoader;
};

export const listInstalledNativeGamePackages = async (): Promise<NativeInstalledGamePackage[]> => {
    const plugin = getNativePlugin();
    if (!plugin) {
        logMobileRuntime('NativeGamePackagePlugin', 'list-installed-no-plugin', {}, 'warn');
        return [];
    }

    const response = await plugin.listInstalledPackages();
    logMobileRuntimeCritical('NativeGamePackagePlugin', 'list-installed-raw-response', {
        packages: response.packages ?? [],
    });
    const installedPackages = await Promise.all(
        (response.packages ?? []).map(async (item) => {
            const normalizedAssetRootPath = normalizeNativeAssetRootPath(item.assetRootPath);
            const assetBaseUrl = toAssetBaseUrl(item.assetRootPath);
            logMobileRuntimeCritical('NativeGamePackagePlugin', 'list-installed-item-normalized', {
                gameId: item.gameId,
                rawAssetRootPath: item.assetRootPath,
                normalizedAssetRootPath,
                assetBaseUrl,
                assetPackVersion: item.assetPackVersion,
            });
            return {
                gameId: item.gameId,
                runtimeChannel: item.runtimeChannel?.trim() || 'stable',
                installedAt: typeof item.installedAt === 'number' && Number.isFinite(item.installedAt)
                    ? item.installedAt
                    : undefined,
                installedVersion: typeof item.assetPackVersion === 'string' && item.assetPackVersion.trim()
                    ? item.assetPackVersion.trim()
                    : undefined,
                assetBaseUrl,
            };
        }),
    );

    const filteredPackages = installedPackages.filter((item) => Boolean(item.gameId));
    logMobileRuntime('NativeGamePackagePlugin', 'list-installed-success', {
        packages: filteredPackages,
    });
    return filteredPackages;
};

export const fetchRemoteJsonThroughNativePlugin = async (
    url: string,
): Promise<NativeRemoteJsonResponse | null> => {
    const plugin = getNativePlugin();
    if (!plugin) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'fetch-remote-json-no-plugin', { url });
        return null;
    }

    try {
        return await plugin.fetchRemoteJson({ url });
    } catch (error) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'fetch-remote-json-failed', {
            url,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
};

const decodeBase64ToBlob = (base64: string, mimeType?: string) => {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], {
        type: mimeType?.trim() || 'application/octet-stream',
    });
};

const SHARED_AUDIO_RELATIVE_PREFIX = 'common/audio/';

const buildInstalledAssetReadCandidates = (gameId: string, relativePath: string) => {
    const candidates = [relativePath];
    if (
        gameId === SHARED_AUDIO_PACK_GAME_ID
        && relativePath.startsWith(SHARED_AUDIO_RELATIVE_PREFIX)
    ) {
        const strippedRelativePath = relativePath.slice(SHARED_AUDIO_RELATIVE_PREFIX.length).trim();
        if (strippedRelativePath) {
            candidates.push(strippedRelativePath);
        }
    }
    return candidates;
};

export const readInstalledGamePackageAssetBlobUrl = async (
    gameId: string,
    relativePath: string,
): Promise<NativeInstalledAssetBlobUrlResult | null> => {
    const plugin = getNativePlugin();
    const normalizedGameId = gameId.trim();
    const normalizedRelativePath = relativePath.trim();
    if (!plugin || !normalizedGameId || !normalizedRelativePath) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'read-installed-asset-invalid-input', {
            gameId,
            relativePath,
            hasPlugin: Boolean(plugin),
        });
        return null;
    }

    const candidateRelativePaths = buildInstalledAssetReadCandidates(normalizedGameId, normalizedRelativePath);
    let lastError: unknown = null;

    for (const candidateRelativePath of candidateRelativePaths) {
        try {
            const result = await withTimeout(
                plugin.readInstalledAsset({
                    gameId: normalizedGameId,
                    relativePath: candidateRelativePath,
                }),
                8000,
                `读取已安装游戏素材超时: ${normalizedGameId}/${candidateRelativePath}`,
            );
            const base64 = typeof result.base64 === 'string' ? result.base64.trim() : '';
            if (!base64) {
                logMobileRuntimeCritical('NativeGamePackagePlugin', 'read-installed-asset-empty', {
                    gameId: normalizedGameId,
                    relativePath: normalizedRelativePath,
                    resolvedRelativePath: candidateRelativePath,
                    result,
                });
                continue;
            }

            const blob = decodeBase64ToBlob(base64, result.mimeType);
            const blobUrl = URL.createObjectURL(blob);
            logMobileRuntimeCritical('NativeGamePackagePlugin', 'read-installed-asset-success', {
                gameId: normalizedGameId,
                relativePath: normalizedRelativePath,
                resolvedRelativePath: candidateRelativePath,
                mimeType: result.mimeType ?? blob.type ?? null,
                size: typeof result.size === 'number' && Number.isFinite(result.size)
                    ? result.size
                    : blob.size,
            });
            return {
                blobUrl,
                mimeType: result.mimeType?.trim() || blob.type || undefined,
                size: typeof result.size === 'number' && Number.isFinite(result.size)
                    ? result.size
                    : blob.size,
            };
        } catch (error) {
            lastError = error;
            if (candidateRelativePath !== normalizedRelativePath) {
                logMobileRuntimeCritical('NativeGamePackagePlugin', 'read-installed-asset-compat-retry-failed', {
                    gameId: normalizedGameId,
                    relativePath: normalizedRelativePath,
                    resolvedRelativePath: candidateRelativePath,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }

    logMobileRuntimeCritical('NativeGamePackagePlugin', 'read-installed-asset-failed', {
        gameId: normalizedGameId,
        relativePath: normalizedRelativePath,
        attemptedRelativePaths: candidateRelativePaths,
        error: lastError instanceof Error ? lastError.message : String(lastError),
    });
    return null;
};

export const readNativeGamePackageInstallState = async (
    gameId: string,
): Promise<NativeGamePackageInstallStateSnapshot | null> => {
    const plugin = getNativePlugin();
    if (!plugin) {
        logMobileRuntime('NativeGamePackagePlugin', 'read-install-state-no-plugin', {
            gameId,
        }, 'warn');
        return null;
    }

    try {
        const result = await plugin.getInstallState({ gameId });
        if (result.exists !== true || !result.status) {
            logMobileRuntime('NativeGamePackagePlugin', 'read-install-state-empty', {
                gameId,
                result,
            });
            return {
                exists: false,
                state: {
                    gameId,
                    status: result.taskRunning === true ? 'manifest' : 'not-installed',
                    updatedAt: Date.now(),
                },
                taskRunning: result.taskRunning === true,
            };
        }

        const assetBaseUrl = toAssetBaseUrl(result.assetRootPath);
        const normalizedStatus = normalizeNativeInstallStatus(
            result.status,
            result.taskRunning === true ? 'manifest' : 'failed',
        );
        const normalizedState: Partial<StoredGamePackageState> = {
            gameId,
            status: normalizedStatus,
            progressPercent: clampPercent(result.progressPercent),
            progressMode: result.progressMode,
            errorCode: typeof result.errorCode === 'string' && isGamePackageInstallErrorCode(result.errorCode)
                ? result.errorCode
                : undefined,
            errorMessage: result.errorMessage?.trim() || undefined,
            installedVersion: result.assetPackVersion?.trim() || undefined,
            localAssetBaseUrl: assetBaseUrl,
            updatedAt: typeof result.updatedAt === 'number' && Number.isFinite(result.updatedAt)
                ? result.updatedAt
                : (typeof result.installedAt === 'number' && Number.isFinite(result.installedAt)
                    ? result.installedAt
                    : Date.now()),
        };

        const snapshot: NativeGamePackageInstallStateSnapshot = {
            exists: true,
            state: normalizedState,
            taskRunning: result.taskRunning === true,
        };

        logMobileRuntimeCritical('NativeGamePackagePlugin', 'read-install-state-success', {
            gameId,
            normalizedState: snapshot.state,
            taskRunning: snapshot.taskRunning,
        });
        return snapshot;
    } catch (error) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'read-install-state-failed', {
            gameId,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
};

export const ensureNativeDownloadNotificationPermission = async (): Promise<NativeDownloadNotificationPermissionResult | null> => {
    const plugin = getNativePlugin();
    if (!plugin) {
        return null;
    }

    try {
        const result = await plugin.ensureNotificationPermission();
        const normalized = normalizeNotificationPermissionResult(result);
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'notification-permission-result', { ...normalized });
        return normalized;
    } catch (error) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'notification-permission-failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
};

export const getNativeDownloadNotificationPermissionStatus = async (): Promise<NativeDownloadNotificationPermissionResult | null> => {
    const plugin = getNativePlugin();
    if (!plugin) {
        return null;
    }

    try {
        const result = await plugin.getNotificationPermissionStatus();
        const normalized = normalizeNotificationPermissionResult(result);
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'notification-permission-status-result', { ...normalized });
        return normalized;
    } catch (error) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'notification-permission-status-failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
};

export const openNativeDownloadNotificationSettings = async (): Promise<boolean> => {
    const plugin = getNativePlugin();
    if (!plugin) {
        return false;
    }

    try {
        await plugin.openNotificationSettings();
        return true;
    } catch (error) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'open-notification-settings-failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
};

export const cancelNativeGamePackageInstall = async (gameId: string): Promise<boolean> => {
    const plugin = getNativePlugin();
    if (!plugin) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'cancel-install-no-native-plugin', {
            gameId,
        });
        return false;
    }

    try {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'cancel-install-dispatching', {
            gameId,
            sourceStack: new Error('NativeGamePackagePlugin.cancelNativeGamePackageInstall source').stack,
        });
        await plugin.cancelInstall({ gameId });
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'cancel-install-dispatched', { gameId });
        return true;
    } catch (error) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'cancel-install-failed', {
            gameId,
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
};

export const uninstallNativeGamePackage = async (
    gameId: string,
): Promise<Partial<StoredGamePackageState> | null> => {
    const plugin = getNativePlugin();
    if (!plugin) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'uninstall-no-native-plugin', {
            gameId,
        });
        return null;
    }

    try {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'uninstall-dispatching', {
            gameId,
        });
        const result = await plugin.uninstallGamePackage({ gameId });
        const nextState: Partial<StoredGamePackageState> = {
            gameId,
            status: normalizeNativeInstallStatus(result.status, 'not-installed') ?? 'not-installed',
            progressPercent: undefined,
            progressMode: undefined,
            installedVersion: undefined,
            localAssetBaseUrl: undefined,
            errorCode: undefined,
            errorMessage: undefined,
            updatedAt: typeof result.updatedAt === 'number' && Number.isFinite(result.updatedAt)
                ? result.updatedAt
                : Date.now(),
        };
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'uninstall-dispatched', {
            gameId,
            nextState,
        });
        return nextState;
    } catch (error) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'uninstall-failed', {
            gameId,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
};

const createNativeFailureHandle = (
    manifest: ResolvedGamePackageManifest,
    errorMessage: string | undefined,
    errorCode: GamePackageInstallErrorCode | undefined,
    options: NativeInstallRunnerOptions,
): GamePackageInstallHandle => {
    const baseState = buildBaseState(manifest);
    const failedState = mergeGamePackageState(baseState, {
        status: 'failed',
        errorCode,
        errorMessage,
        progressMode: undefined,
        progressPercent: undefined,
    });
    options.onStateChange(failedState);

    return {
        cancel: () => {},
        finished: Promise.resolve(failedState),
    };
};

export const createNativeGamePackageInstallHandle = async (
    manifest: ResolvedGamePackageManifest,
    options: NativeInstallRunnerOptions,
): Promise<GamePackageInstallHandle | null> => {
    logMobileRuntimeCritical('NativeGamePackagePlugin', 'create-install-handle-entered', {
        gameId: manifest.gameId,
        manifestSource: manifest.source,
        assetPackVersion: manifest.assetPackVersion,
        hasAssetPackUrl: Boolean(manifest.assetPackUrl),
    });
    const plugin = getNativePlugin();
    logMobileRuntimeCritical('NativeGamePackagePlugin', 'create-install-handle-plugin-resolved', {
        gameId: manifest.gameId,
        hasPlugin: Boolean(plugin),
    });
    if (!plugin) {
        logMobileRuntime('NativeGamePackagePlugin', 'create-install-handle-no-plugin', {
            gameId: manifest.gameId,
        }, 'warn');
        return null;
    }

    if (!manifest.assetPackUrl && !manifest.assetPackDiffOnly) {
        logMobileRuntimeCritical('NativeGamePackagePlugin', 'missing-asset-pack-url', {
            gameId: manifest.gameId,
            source: manifest.source,
            assetPackId: manifest.assetPackId,
            assetPackVersion: manifest.assetPackVersion,
            hasModulePackUrl: Boolean(manifest.modulePackUrl),
        });
        return createNativeFailureHandle(
            manifest,
            undefined,
            resolveMissingAssetPackErrorCode(manifest),
            options,
        );
    }

    const notificationPermission = await ensureNativeDownloadNotificationPermission();
    if (notificationPermission?.granted === false) {
        return createNativeFailureHandle(
            manifest,
            notificationPermission.message ?? '请先允许通知权限，否则后台下载通知不会显示。',
            'notification-permission-required',
            options,
        );
    }

    let cancelled = false;
    let currentState = buildBaseState(manifest);
    let listenerHandle: PluginListenerHandle | null = null;
    let terminalResolved = false;
    let resolveTerminalState!: (state: StoredGamePackageState) => void;
    const terminalStatePromise = new Promise<StoredGamePackageState>((resolve) => {
        resolveTerminalState = resolve;
    });

    const dispatchFullInstall = () => plugin.installGamePackage({
        gameId: manifest.gameId,
        runtimeChannel: manifest.runtimeChannel,
        assetPackId: manifest.assetPackId,
        assetPackVersion: manifest.assetPackVersion,
        assetPackUrl: manifest.assetPackUrl!,
        assetPackChecksum: manifest.assetPackChecksum,
    });

    const finished = (async () => {
        try {
            logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-start', {
                gameId: manifest.gameId,
                manifestSource: manifest.source,
                assetPackId: manifest.assetPackId,
                assetPackVersion: manifest.assetPackVersion,
                assetPackUrl: manifest.assetPackUrl,
            });
            logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-listener-registering', {
                gameId: manifest.gameId,
            });
            try {
                listenerHandle = await withTimeout(
                    plugin.addListener('installStateChanged', async (event) => {
                        if (event.gameId !== manifest.gameId) {
                            return;
                        }

                        const assetBaseUrl = toAssetBaseUrl(event.assetRootPath);
                        if (assetBaseUrl) {
                            options.onInstalledAssetBaseUrl?.(manifest.gameId, assetBaseUrl);
                        }

                        const normalizedStatus = normalizeNativeInstallStatus(event.status, currentState.status);
                        currentState = mergeGamePackageState(currentState, {
                            status: normalizedStatus,
                            progressPercent: clampPercent(event.progressPercent),
                            progressMode: event.progressMode,
                            errorCode: typeof event.errorCode === 'string' && isGamePackageInstallErrorCode(event.errorCode)
                                ? event.errorCode
                                : undefined,
                            errorMessage: event.errorMessage,
                            installedVersion: event.assetPackVersion?.trim() || undefined,
                            localAssetBaseUrl: assetBaseUrl,
                        });
                        logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-state-changed', {
                            gameId: manifest.gameId,
                            status: event.status,
                            progressMode: event.progressMode,
                            progressPercent: event.progressPercent,
                            errorCode: event.errorCode,
                            errorMessage: event.errorMessage,
                            assetPackVersion: event.assetPackVersion,
                        });
                        options.onStateChange(currentState);
                        if (
                            !terminalResolved
                            && (normalizedStatus === 'installed' || normalizedStatus === 'failed')
                        ) {
                            terminalResolved = true;
                            resolveTerminalState(currentState);
                        }
                    }),
                    2000,
                    'install listener registration timed out after 2000ms',
                );
                logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-listener-registered', {
                    gameId: manifest.gameId,
                });
            } catch (error) {
                logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-listener-registration-failed', {
                    gameId: manifest.gameId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }

            logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-native-call-dispatch', {
                gameId: manifest.gameId,
                assetPackUrl: manifest.assetPackUrl,
                assetPackVersion: manifest.assetPackVersion,
                fileIndexUrl: manifest.assetPackFileIndexUrl,
            });
            let result;
            if (manifest.assetPackFileIndexUrl) {
                try {
                    result = await plugin.installGamePackageIncremental({
                        gameId: manifest.gameId,
                        runtimeChannel: manifest.runtimeChannel,
                        assetPackId: manifest.assetPackId,
                        assetPackVersion: manifest.assetPackVersion,
                        assetPackUrl: manifest.assetPackUrl,
                        assetPackChecksum: manifest.assetPackChecksum,
                        assetBaseUrl: resolvedAssetsBaseUrl,
                        fileIndexUrl: manifest.assetPackFileIndexUrl,
                        fileIndexChecksum: manifest.assetPackFileIndexChecksum,
                        allowFullFallback: manifest.assetPackDiffOnly !== true,
                    });
                } catch (error) {
                    if (!shouldFallbackToFullInstallFromBridgeError(error)) {
                        throw error;
                    }

                    if (manifest.assetPackDiffOnly) {
                        throw new Error(buildDiffOnlyFallbackBlockedMessage());
                    }

                    logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-incremental-unavailable-fallback', {
                        gameId: manifest.gameId,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    result = await dispatchFullInstall();
                }
            } else {
                result = await dispatchFullInstall();
            }
            logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-native-call-resolved', {
                gameId: manifest.gameId,
                result,
            });

            const acknowledgedStatus = normalizeNativeInstallStatus(result.status, 'manifest');
            if (acknowledgedStatus && acknowledgedStatus !== 'installed') {
                currentState = mergeGamePackageState(currentState, {
                    status: acknowledgedStatus,
                    installedVersion: result.assetPackVersion?.trim() || currentState.installedVersion,
                });
                options.onStateChange(currentState);
                logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-native-call-acknowledged', {
                    gameId: manifest.gameId,
                    status: acknowledgedStatus,
                    taskId: result.taskId,
                    accepted: result.accepted === true,
                });
                const terminalState = await terminalStatePromise;
                logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-finished-from-events', {
                    gameId: manifest.gameId,
                    status: terminalState.status,
                    installedVersion: terminalState.installedVersion,
                    localAssetBaseUrl: terminalState.localAssetBaseUrl,
                });
                return terminalState;
            }

            const assetBaseUrl = toAssetBaseUrl(result.assetRootPath);
            if (assetBaseUrl) {
                options.onInstalledAssetBaseUrl?.(manifest.gameId, assetBaseUrl);
            }

            currentState = mergeGamePackageState(currentState, {
                status: 'installed',
                progressMode: undefined,
                progressPercent: undefined,
                errorCode: undefined,
                errorMessage: undefined,
                installedVersion: result.assetPackVersion?.trim() || manifest.assetPackVersion,
                localAssetBaseUrl: assetBaseUrl,
                updatedAt: typeof result.installedAt === 'number' && Number.isFinite(result.installedAt)
                    ? result.installedAt
                    : Date.now(),
            });
            logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-finished', {
                gameId: manifest.gameId,
                installedVersion: currentState.installedVersion,
                localAssetBaseUrl: currentState.localAssetBaseUrl,
            });
            options.onStateChange(currentState);
            if (!terminalResolved) {
                terminalResolved = true;
                resolveTerminalState(currentState);
            }
            return currentState;
        } catch (error) {
            if (cancelled) {
                logMobileRuntime('NativeGamePackagePlugin', 'install-cancelled', {
                    gameId: manifest.gameId,
                    currentState,
                }, 'warn');
                return currentState;
            }

            const nextState = mergeGamePackageState(currentState, {
                status: 'failed',
                progressMode: undefined,
                progressPercent: undefined,
                errorCode: currentState.errorCode,
                errorMessage: error instanceof Error ? error.message : String(error ?? '安装失败'),
            });
            currentState = nextState;
            logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-failed', {
                gameId: manifest.gameId,
                error: error instanceof Error ? error.message : String(error),
                status: nextState.status,
                errorMessage: nextState.errorMessage,
            });
            options.onStateChange(nextState);
            if (!terminalResolved) {
                terminalResolved = true;
                resolveTerminalState(nextState);
            }
            return nextState;
        } finally {
            if (listenerHandle) {
                await listenerHandle.remove().catch(() => {});
            }
        }
    })();

    return {
        cancel: () => {
            cancelled = true;
            const cancelSource = new Error('NativeGamePackagePlugin.installHandle.cancel source');
            logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-cancel-requested', {
                gameId: manifest.gameId,
                currentState,
                sourceStack: cancelSource.stack,
            });
            void plugin.cancelInstall({ gameId: manifest.gameId }).catch((error) => {
                logMobileRuntimeCritical('NativeGamePackagePlugin', 'install-cancel-request-native-failed', {
                    gameId: manifest.gameId,
                    error: error instanceof Error ? error.message : String(error),
                });
            });
        },
        finished,
    };
};
