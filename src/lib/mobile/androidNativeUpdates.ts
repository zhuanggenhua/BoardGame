import { registerPlugin } from '@capacitor/core';
import { compareVersion } from './androidLiveUpdates';
import { logMobileRuntime, logMobileRuntimeCritical } from './mobileRuntimeDebug';
import { isNativeAndroidRuntime } from './androidRuntime';
import packageJson from '../../../package.json';

type PluginListenerHandle = {
    remove(): Promise<void>;
};

export type NativeAppUpdateTaskStatus =
    | 'queued'
    | 'downloading'
    | 'verifying'
    | 'prepared'
    | 'permission-required'
    | 'installing'
    | 'error';

type NativeAppUpdateProgressMode = 'determinate' | 'indeterminate';

export type NativeAppUpdateErrorCode =
    | 'network-timeout'
    | 'http-error'
    | 'resume-not-supported'
    | 'checksum-mismatch'
    | 'insufficient-storage'
    | 'file-io'
    | 'cancelled'
    | 'installer-launch-failed'
    | 'task-conflict'
    | 'unknown';

export interface NativeAppUpdateTaskSnapshot {
    version?: string;
    status?: NativeAppUpdateTaskStatus;
    progressPercent?: number;
    progressMode?: NativeAppUpdateProgressMode;
    errorCode?: NativeAppUpdateErrorCode;
    errorMessage?: string;
    apkFilePath?: string;
    updatedAt?: number;
}

export interface NativeAppUpdatePrepareResult extends Omit<NativeAppUpdateTaskSnapshot, 'status'> {
    status?: NativeAppUpdateTaskStatus | 'installer-launched';
}

type NativeAppUpdatePlugin = {
    getAppInfo(): Promise<{
        packageName?: string;
        versionName?: string;
        versionCode?: number;
        canRequestPackageInstalls?: boolean;
    }>;
    prepareUpdateInstall(options: {
        version: string;
        url: string;
        checksum?: string;
        autoInstall?: boolean;
    }): Promise<NativeAppUpdatePrepareResult>;
    installPreparedUpdate(options: {
        version: string;
    }): Promise<{
        status?: 'permission-required' | 'installer-launched';
        version?: string;
        apkFilePath?: string;
    }>;
    getPreparedUpdateState(options: {
        version: string;
    }): Promise<{
        exists?: boolean;
        version?: string;
        status?: NativeAppUpdateTaskStatus;
        progressPercent?: number;
        progressMode?: NativeAppUpdateProgressMode;
        errorCode?: NativeAppUpdateErrorCode;
        errorMessage?: string;
        apkFilePath?: string;
        updatedAt?: number;
    }>;
    openUnknownSourcesSettings(): Promise<void>;
    addListener(
        eventName: 'updateStateChanged',
        listenerFunc: (event: NativeAppUpdateTaskSnapshot) => void,
    ): Promise<PluginListenerHandle>;
};

export interface AndroidNativeUpdateConfig {
    enabled: boolean;
    manifestUrl: string;
    manifestUrls: string[];
    channel: string;
}

export interface AndroidNativeUpdateManifest {
    version: string;
    versionCode?: number;
    url: string;
    checksum?: string;
    channel?: string;
    notes?: string;
    publishedAt?: string;
    forceUpdate?: boolean;
    forceUpdateTitle?: string;
    forceUpdateMessage?: string;
}

export interface AndroidAppInfo {
    packageName?: string;
    versionName: string;
    versionCode?: number;
    canRequestPackageInstalls: boolean;
}

export interface AndroidNativeUpdateAvailability {
    available: boolean;
    reason?: 'disabled' | 'not-native' | 'up-to-date';
    manifest?: AndroidNativeUpdateManifest;
    appInfo?: AndroidAppInfo;
}

export interface AndroidWebAppDownloadConfig {
    directDownloadUrl: string;
    manifestUrl: string;
    manifestUrls: string[];
}

export type AndroidWebAppDownloadResolution =
    | {
        url: string;
        source: 'manifest' | 'versioned' | 'direct';
    }
    | {
        url: null;
        reason: 'missing-config' | 'manifest-unavailable';
    };

export type AndroidNativeUpdatePhase =
    | 'hidden'
    | 'checking'
    | 'downloading'
    | 'verifying'
    | 'permission-required'
    | 'installing'
    | 'error';

export interface AndroidNativeUpdateState {
    phase: AndroidNativeUpdatePhase;
    blocking: boolean;
    version?: string;
    progressPercent?: number;
    title?: string;
    message?: string;
    errorCode?: NativeAppUpdateErrorCode;
    reason?: string;
}

export interface AndroidPreparedUpdateState extends NativeAppUpdateTaskSnapshot {
    version: string;
    status: NativeAppUpdateTaskStatus;
}

type NativeUpdateRequest = {
    interactive?: boolean;
};

const DEFAULT_NATIVE_UPDATE_CHANNEL = 'stable';
const DEFAULT_NATIVE_UPDATE_CONTROL_MANIFEST_BASE_URL = 'https://assets.easyboardgame.top/official/native-app-updates/android';
const DEFAULT_NATIVE_UPDATE_DOWNLOAD_MANIFEST_BASE_URL = 'http://8.148.71.102/official/native-app-updates/android';
const DEFAULT_NATIVE_UPDATE_MANIFEST_BASE_URL = DEFAULT_NATIVE_UPDATE_CONTROL_MANIFEST_BASE_URL;
const DEBUG_ANDROID_APP_ID_SEGMENTS = new Set(['debug', 'dev', 'test', 'qa']);
const nativeUpdateRequestListeners = new Set<(request: NativeUpdateRequest) => void>();
const nativePlugin = registerPlugin<NativeAppUpdatePlugin>('AppUpdate');
let nativePluginLoader: NativeAppUpdatePlugin | null | undefined;

const getErrorMessage = (error: unknown) => (
    error instanceof Error ? error.message : String(error)
);

const isPluginNotImplementedError = (error: unknown) => (
    /plugin is not implemented on android/i.test(getErrorMessage(error))
);

export const HIDDEN_ANDROID_NATIVE_UPDATE_STATE: AndroidNativeUpdateState = {
    phase: 'hidden',
    blocking: false,
};

const clampPercent = (value: number | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
};

const isNativeTaskStatus = (value: string): value is NativeAppUpdateTaskStatus => (
    value === 'queued'
    || value === 'downloading'
    || value === 'verifying'
    || value === 'prepared'
    || value === 'permission-required'
    || value === 'installing'
    || value === 'error'
);

const isNativeErrorCode = (value: string): value is NativeAppUpdateErrorCode => (
    value === 'network-timeout'
    || value === 'http-error'
    || value === 'resume-not-supported'
    || value === 'checksum-mismatch'
    || value === 'insufficient-storage'
    || value === 'file-io'
    || value === 'cancelled'
    || value === 'installer-launch-failed'
    || value === 'task-conflict'
    || value === 'unknown'
);

const parseBooleanEnv = (value: string | boolean | undefined) => {
    if (typeof value === 'boolean') return value;
    return /^(1|true|yes|on)$/i.test((value || '').trim());
};

const readTrimmedEnv = (value: string | boolean | undefined) => (
    typeof value === 'string' ? value.trim() : ''
);

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const splitUrlList = (value: string | boolean | undefined) => {
    if (typeof value !== 'string') return [];
    return value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
};

const collectManifestUrls = (
    primaryUrl: string,
    ...fallbackValues: Array<string | boolean | undefined>
) => {
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const candidate of [primaryUrl, ...fallbackValues.flatMap(splitUrlList)]) {
        const normalized = readTrimmedEnv(candidate).replace(/\/+$/, '');
        if (!normalized || !isAbsoluteHttpUrl(normalized) || seen.has(normalized)) continue;
        seen.add(normalized);
        urls.push(normalized);
    }
    return urls;
};

const isNonReleaseAndroidAppId = (appId: string) => (
    appId
        .split('.')
        .some((segment) => DEBUG_ANDROID_APP_ID_SEGMENTS.has(segment.trim().toLowerCase()))
);

const isAndroidNativeUpdateAllowedForAppId = (env: Partial<ImportMetaEnv> & { CAPACITOR_APP_ID?: string }) => {
    const appId = readTrimmedEnv(env.VITE_CAPACITOR_APP_ID) || readTrimmedEnv(env.CAPACITOR_APP_ID);
    if (!appId || !isNonReleaseAndroidAppId(appId)) {
        return true;
    }
    return parseBooleanEnv(env.VITE_ANDROID_NATIVE_UPDATE_ALLOW_DEBUG_APP);
};

const resolveAndroidNativeUpdateChannel = (env: Partial<ImportMetaEnv>) => (
    typeof env.VITE_ANDROID_NATIVE_UPDATE_CHANNEL === 'string' && env.VITE_ANDROID_NATIVE_UPDATE_CHANNEL.trim()
        ? env.VITE_ANDROID_NATIVE_UPDATE_CHANNEL.trim()
        : DEFAULT_NATIVE_UPDATE_CHANNEL
);

const buildDefaultAndroidNativeUpdateManifestUrl = (channel: string) => (
    `${DEFAULT_NATIVE_UPDATE_MANIFEST_BASE_URL}/${channel}/latest.json`
);

const buildDefaultAndroidNativeUpdateFallbackManifestUrl = (channel: string) => (
    `${DEFAULT_NATIVE_UPDATE_DOWNLOAD_MANIFEST_BASE_URL}/${channel}/latest.json`
);

const buildVersionedAndroidApkUrl = (manifestUrl: string, version: string) => {
    if (!isAbsoluteHttpUrl(manifestUrl) || !version.trim()) {
        return '';
    }

    try {
        const parsedUrl = new URL(manifestUrl);
        parsedUrl.pathname = parsedUrl.pathname.replace(/\/latest\.json$/i, `/packages/${encodeURIComponent(version.trim())}.apk`);
        parsedUrl.search = '';
        parsedUrl.hash = '';
        return parsedUrl.toString();
    } catch {
        return '';
    }
};

const appendDownloadCacheBust = (
    downloadUrl: string,
    token: string | undefined,
) => {
    if (!isAbsoluteHttpUrl(downloadUrl) || !token?.trim()) {
        return downloadUrl;
    }

    try {
        const parsedUrl = new URL(downloadUrl);
        parsedUrl.searchParams.set('v', token.trim());
        return parsedUrl.toString();
    } catch {
        return downloadUrl;
    }
};

const getNativePlugin = (): NativeAppUpdatePlugin | null => {
    if (nativePluginLoader !== undefined) {
        return nativePluginLoader;
    }

    if (!isNativeAndroidRuntime()) {
        nativePluginLoader = null;
        return nativePluginLoader;
    }

    nativePluginLoader = nativePlugin;
    return nativePluginLoader;
};

export const readAndroidNativeUpdateConfig = (env: Partial<ImportMetaEnv> = import.meta.env): AndroidNativeUpdateConfig => {
    const channel = resolveAndroidNativeUpdateChannel(env);
    const configuredManifestUrl = typeof env.VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL === 'string'
        ? env.VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL.trim()
        : '';
    const hasInvalidConfiguredManifestUrl = configuredManifestUrl !== '' && !isAbsoluteHttpUrl(configuredManifestUrl);
    const manifestUrls = hasInvalidConfiguredManifestUrl
        ? []
        : collectManifestUrls(
            configuredManifestUrl || buildDefaultAndroidNativeUpdateManifestUrl(channel),
            env.VITE_ANDROID_NATIVE_UPDATE_MANIFEST_FALLBACK_URLS,
            buildDefaultAndroidNativeUpdateFallbackManifestUrl(channel),
        );
    const manifestUrl = manifestUrls[0] || configuredManifestUrl;

    return {
        enabled: parseBooleanEnv(env.VITE_ANDROID_NATIVE_UPDATE_ENABLED)
            && manifestUrls.length > 0
            && isAndroidNativeUpdateAllowedForAppId(env),
        manifestUrl,
        manifestUrls,
        channel,
    };
};

export const readAndroidWebAppDownloadConfig = (
    env: Partial<ImportMetaEnv> = import.meta.env,
): AndroidWebAppDownloadConfig => {
    const channel = resolveAndroidNativeUpdateChannel(env);
    const config = readAndroidNativeUpdateConfig(env);
    const manifestUrls = config.manifestUrls.length > 0
        ? config.manifestUrls
        : collectManifestUrls(
            buildDefaultAndroidNativeUpdateManifestUrl(channel),
            buildDefaultAndroidNativeUpdateFallbackManifestUrl(channel),
        );
    return {
        directDownloadUrl: typeof env.VITE_ANDROID_APP_DOWNLOAD_URL === 'string'
            ? env.VITE_ANDROID_APP_DOWNLOAD_URL.trim()
            : '',
        manifestUrl: manifestUrls[0] || '',
        manifestUrls,
    };
};

export const readAndroidAppInfo = async (): Promise<AndroidAppInfo | null> => {
    const plugin = getNativePlugin();
    if (!plugin) {
        return null;
    }

    try {
        const result = await plugin.getAppInfo();
        return {
            packageName: typeof result.packageName === 'string' && result.packageName.trim()
                ? result.packageName.trim()
                : undefined,
            versionName: typeof result.versionName === 'string' && result.versionName.trim()
                ? result.versionName.trim()
                : '0.0.0',
            versionCode: typeof result.versionCode === 'number' && Number.isFinite(result.versionCode)
                ? result.versionCode
                : undefined,
            canRequestPackageInstalls: result.canRequestPackageInstalls === true,
        };
    } catch (error) {
        logMobileRuntimeCritical('NativeUpdate', 'app-info-read-failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
};

export const fetchAndroidNativeUpdateManifest = async (
    manifestUrl: string,
    fetchImpl: typeof fetch = fetch,
    options: { strict?: boolean } = {},
): Promise<AndroidNativeUpdateManifest | null> => {
    const strict = options.strict === true;
    if (!isAbsoluteHttpUrl(manifestUrl)) {
        if (strict) {
            throw new Error(`原生更新清单地址无效：${manifestUrl || '(empty)'}`);
        }
        return null;
    }

    try {
        const response = await fetchImpl(manifestUrl, {
            method: 'GET',
            cache: 'no-store',
            redirect: 'manual',
            headers: {
                Accept: 'application/json',
            },
        });

        const responseType = (response as Response & { type?: string }).type;
        const redirected = (response as Response & { redirected?: boolean }).redirected === true;
        if (redirected || responseType === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
            throw new Error('原生更新清单发生重定向；latest.json 控制入口不允许重定向');
        }
        if (response.status === 404) {
            logMobileRuntime('NativeUpdate', 'manifest-missing', { manifestUrl }, 'warn');
            throw new Error(`原生更新清单不存在：${manifestUrl}`);
        }
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as Record<string, unknown>;
        const version = typeof data.version === 'string' ? data.version.trim() : '';
        const url = typeof data.url === 'string' ? data.url.trim() : '';
        if (!version || !isAbsoluteHttpUrl(url)) {
            if (strict) {
                throw new Error(`原生更新清单格式无效：${manifestUrl}`);
            }
            return null;
        }

        return {
            version,
            url,
            versionCode: typeof data.versionCode === 'number' && Number.isFinite(data.versionCode)
                ? data.versionCode
                : undefined,
            checksum: typeof data.checksum === 'string' && data.checksum.trim() ? data.checksum.trim() : undefined,
            channel: typeof data.channel === 'string' && data.channel.trim() ? data.channel.trim() : undefined,
            notes: typeof data.notes === 'string' && data.notes.trim() ? data.notes.trim() : undefined,
            publishedAt: typeof data.publishedAt === 'string' && data.publishedAt.trim() ? data.publishedAt.trim() : undefined,
            forceUpdate: data.forceUpdate === true,
            forceUpdateTitle: typeof data.forceUpdateTitle === 'string' && data.forceUpdateTitle.trim()
                ? data.forceUpdateTitle.trim()
                : undefined,
            forceUpdateMessage: typeof data.forceUpdateMessage === 'string' && data.forceUpdateMessage.trim()
                ? data.forceUpdateMessage.trim()
                : undefined,
        };
    } catch (error) {
        logMobileRuntimeCritical('NativeUpdate', 'manifest-read-failed', {
            manifestUrl,
            error: error instanceof Error ? error.message : String(error),
        });
        if (strict) {
            throw error;
        }
        return null;
    }
};

const fetchAndroidNativeUpdateManifestFromCandidates = async (
    manifestUrls: string[],
    fetchImpl: typeof fetch = fetch,
    options: { strict?: boolean } = {},
): Promise<AndroidNativeUpdateManifest | null> => {
    const candidates = manifestUrls.filter(isAbsoluteHttpUrl);
    if (candidates.length === 0) {
        if (options.strict === true) {
            throw new Error('没有可用的原生更新清单地址');
        }
        return null;
    }

    const failures: string[] = [];
    for (const manifestUrl of candidates) {
        try {
            const manifest = await fetchAndroidNativeUpdateManifest(manifestUrl, fetchImpl, { strict: true });
            if (manifest) {
                logMobileRuntime('NativeUpdate', 'manifest-candidate-selected', {
                    manifestUrl,
                    candidateCount: candidates.length,
                });
                return manifest;
            }
            failures.push(`${manifestUrl}: 清单格式无效`);
        } catch (error) {
            failures.push(`${manifestUrl}: ${getErrorMessage(error)}`);
        }
    }

    if (options.strict === true) {
        throw new Error(`原生更新清单读取失败，已尝试 ${candidates.length} 个入口：${failures.join('；')}`);
    }
    return null;
};

export const resolveAndroidWebAppDownload = async (
    env: Partial<ImportMetaEnv> = import.meta.env,
    fetchImpl: typeof fetch = fetch,
): Promise<AndroidWebAppDownloadResolution> => {
    const { directDownloadUrl, manifestUrl, manifestUrls } = readAndroidWebAppDownloadConfig(env);
    const versionedFallbackUrls = manifestUrls
        .map((candidateUrl) => buildVersionedAndroidApkUrl(candidateUrl, packageJson.version))
        .filter(Boolean);
    const versionedFallbackUrl = versionedFallbackUrls[versionedFallbackUrls.length - 1] || '';

    if (manifestUrl) {
        const manifest = await fetchAndroidNativeUpdateManifestFromCandidates(manifestUrls, fetchImpl);
        if (manifest?.url) {
            const cacheBustToken = manifest.checksum || manifest.publishedAt || manifest.version;
            return {
                url: appendDownloadCacheBust(manifest.url, cacheBustToken),
                source: 'manifest',
            };
        }

        if (versionedFallbackUrl) {
            return {
                url: appendDownloadCacheBust(versionedFallbackUrl, packageJson.version),
                source: 'versioned',
            };
        }

        if (directDownloadUrl && isAbsoluteHttpUrl(directDownloadUrl)) {
            return {
                url: directDownloadUrl,
                source: 'direct',
            };
        }

        return {
            url: null,
            reason: 'manifest-unavailable',
        };
    }

    if (directDownloadUrl && isAbsoluteHttpUrl(directDownloadUrl)) {
        return {
            url: directDownloadUrl,
            source: 'direct',
        };
    }

    return {
        url: null,
        reason: 'missing-config',
    };
};

export const isAndroidNativeUpdateAvailable = (
    manifest: AndroidNativeUpdateManifest,
    appInfo: AndroidAppInfo,
) => {
    if (typeof manifest.versionCode === 'number' && typeof appInfo.versionCode === 'number') {
        return manifest.versionCode > appInfo.versionCode;
    }
    return compareVersion(manifest.version, appInfo.versionName) > 0;
};

export const checkAndroidNativeUpdateAvailability = async (): Promise<AndroidNativeUpdateAvailability> => {
    const config = readAndroidNativeUpdateConfig();
    if (!config.enabled) {
        return { available: false, reason: 'disabled' };
    }

    const appInfo = await readAndroidAppInfo();
    if (!appInfo) {
        return { available: false, reason: 'not-native' };
    }

    const manifest = await fetchAndroidNativeUpdateManifestFromCandidates(config.manifestUrls, fetch, { strict: true });
    if (!manifest) {
        throw new Error(`原生更新清单格式无效：${config.manifestUrls.join(', ')}`);
    }
    if (!isAndroidNativeUpdateAvailable(manifest, appInfo)) {
        return { available: false, reason: 'up-to-date', manifest, appInfo };
    }

    return {
        available: true,
        manifest,
        appInfo,
    };
};

export const prepareAndroidNativeUpdateInstall = async (
    manifest: AndroidNativeUpdateManifest,
    options: { autoInstall?: boolean } = {},
) => {
    const plugin = getNativePlugin();
    if (!plugin) {
        throw new Error('当前环境不支持原生更新安装');
    }
    const autoInstall = options.autoInstall ?? true;
    return plugin.prepareUpdateInstall({
        version: manifest.version,
        url: manifest.url,
        checksum: manifest.checksum,
        autoInstall,
    });
};

export const startAndroidNativeUpdatePreload = async (manifest: AndroidNativeUpdateManifest) => {
    const plugin = getNativePlugin();
    if (!plugin) {
        throw new Error('当前环境不支持原生更新安装');
    }
    return plugin.prepareUpdateInstall({
        version: manifest.version,
        url: manifest.url,
        checksum: manifest.checksum,
        autoInstall: false,
    });
};

export const continueAndroidNativeUpdateInstall = async (version: string) => {
    const plugin = getNativePlugin();
    if (!plugin) {
        throw new Error('当前环境不支持原生更新安装');
    }
    return plugin.installPreparedUpdate({ version });
};

export const readPreparedAndroidUpdateState = async (version: string): Promise<AndroidPreparedUpdateState | null> => {
    const normalizedVersion = version.trim();
    if (!normalizedVersion) {
        return null;
    }

    const plugin = getNativePlugin();
    if (!plugin) {
        return null;
    }

    try {
        const result = await plugin.getPreparedUpdateState({ version: normalizedVersion });
        if (result.exists !== true || typeof result.status !== 'string' || !isNativeTaskStatus(result.status)) {
            return null;
        }

        const resolvedVersion = typeof result.version === 'string' && result.version.trim()
            ? result.version.trim()
            : normalizedVersion;

        return {
            version: resolvedVersion,
            status: result.status,
            progressPercent: clampPercent(result.progressPercent),
            progressMode: result.progressMode === 'determinate' || result.progressMode === 'indeterminate'
                ? result.progressMode
                : undefined,
            errorCode: typeof result.errorCode === 'string' && isNativeErrorCode(result.errorCode)
                ? result.errorCode
                : undefined,
            errorMessage: typeof result.errorMessage === 'string' && result.errorMessage.trim()
                ? result.errorMessage.trim()
                : undefined,
            apkFilePath: typeof result.apkFilePath === 'string' && result.apkFilePath.trim()
                ? result.apkFilePath.trim()
                : undefined,
            updatedAt: typeof result.updatedAt === 'number' && Number.isFinite(result.updatedAt)
                ? result.updatedAt
                : undefined,
        };
    } catch (error) {
        logMobileRuntimeCritical('NativeUpdate', 'prepared-state-read-failed', {
            version: normalizedVersion,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
};

export const openAndroidUnknownSourcesSettings = async () => {
    const plugin = getNativePlugin();
    if (!plugin) {
        throw new Error('当前环境不支持原生更新安装');
    }
    return plugin.openUnknownSourcesSettings();
};

export const subscribeAndroidNativeUpdateState = async (
    listener: (event: NativeAppUpdateTaskSnapshot) => void,
): Promise<PluginListenerHandle | null> => {
    const plugin = getNativePlugin();
    if (!plugin) {
        return null;
    }
    try {
        return await plugin.addListener('updateStateChanged', listener);
    } catch (error) {
        const message = getErrorMessage(error);
        logMobileRuntimeCritical('NativeUpdate', 'subscribe-state-failed', {
            error: message,
            isPluginNotImplemented: isPluginNotImplementedError(error),
        });
        return null;
    }
};

export const mapNativeUpdateEventToState = (
    event: Pick<NativeAppUpdateTaskSnapshot, 'version' | 'status' | 'progressPercent' | 'errorCode' | 'errorMessage'>,
    options: {
        blocking: boolean;
        title?: string;
        message?: string;
    },
): AndroidNativeUpdateState => {
    const phaseMap: Record<string, AndroidNativeUpdatePhase> = {
        queued: 'checking',
        downloading: 'downloading',
        verifying: 'verifying',
        prepared: 'hidden',
        'permission-required': 'permission-required',
        installing: 'installing',
        error: 'error',
    };

    return {
        phase: phaseMap[event.status || ''] || 'hidden',
        blocking: options.blocking,
        version: event.version,
        progressPercent: clampPercent(event.progressPercent),
        title: options.title,
        message: options.message,
        errorCode: event.errorCode,
        reason: event.errorMessage,
    };
};

export const requestAndroidNativeUpdateCheck = (request: NativeUpdateRequest = {}) => {
    for (const listener of nativeUpdateRequestListeners) {
        listener(request);
    }
};

export const subscribeAndroidNativeUpdateRequests = (listener: (request: NativeUpdateRequest) => void) => {
    nativeUpdateRequestListeners.add(listener);
    return () => {
        nativeUpdateRequestListeners.delete(listener);
    };
};
