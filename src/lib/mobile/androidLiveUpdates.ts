import { logMobileRuntime, logMobileRuntimeCritical } from './mobileRuntimeDebug';
import type { NativeAndroidRuntimeDiagnostics } from './androidRuntime';
import { getNativeMobileRuntimeDiagnostics } from './mobileRuntime';

type PluginListenerHandle = {
    remove(): Promise<void>;
};

type BundleStatus = 'success' | 'error' | 'pending' | 'downloading';

type BundleInfo = {
    id: string;
    version: string;
    downloaded: string;
    checksum: string;
    status: BundleStatus;
};

type CurrentBundleResult = {
    bundle: BundleInfo;
    native: string;
};

type DownloadEvent = {
    percent: number;
    bundle: BundleInfo;
};

type DownloadFailedEvent = {
    version: string;
};

type UpdateFailedEvent = {
    bundle: BundleInfo;
};

type SetEvent = {
    bundle: BundleInfo;
};

type CapacitorUpdaterModule = {
    CapacitorUpdater: {
        notifyAppReady(): Promise<{ bundle: BundleInfo }>;
        current(): Promise<CurrentBundleResult>;
        list(options?: { raw?: boolean }): Promise<{ bundles: BundleInfo[] }>;
        download(options: {
            url: string;
            version: string;
            checksum?: string;
        }): Promise<BundleInfo>;
        next(options: { id: string }): Promise<BundleInfo>;
        set(options: { id: string }): Promise<void>;
        reload(): Promise<void>;
        setMultiDelay(options: {
            delayConditions: Array<{ kind: 'background' | 'kill' | 'date' | 'nativeVersion'; value?: string }>;
        }): Promise<void>;
        addListener(
            eventName: 'download',
            listenerFunc: (event: DownloadEvent) => void,
        ): Promise<PluginListenerHandle>;
        addListener(
            eventName: 'downloadFailed',
            listenerFunc: (event: DownloadFailedEvent) => void,
        ): Promise<PluginListenerHandle>;
        addListener(
            eventName: 'updateFailed',
            listenerFunc: (event: UpdateFailedEvent) => void,
        ): Promise<PluginListenerHandle>;
        addListener(
            eventName: 'downloadComplete',
            listenerFunc: (event: { bundle: BundleInfo }) => void,
        ): Promise<PluginListenerHandle>;
        addListener(
            eventName: 'set',
            listenerFunc: (event: SetEvent) => void,
        ): Promise<PluginListenerHandle>;
    };
};

export interface AndroidLiveUpdateConfig {
    enabled: boolean;
    manifestUrl: string;
    manifestUrls: string[];
    channel: string;
    appReadyTimeoutMs: number;
}

export interface AndroidLiveUpdateSnapshot {
    enabled: boolean;
    manifestUrl: string;
    manifestUrls: string[];
    channel: string;
    nativeAndroid: boolean;
    updaterLoaded: boolean;
    nativeVersion?: string;
    currentBundleVersion?: string;
    currentDisplayVersion?: string;
    currentBundleId?: string;
    currentBundleStatus?: BundleStatus;
    manifestVersion?: string;
    manifestDisplayVersion?: string;
    manifestProductVersion?: string;
    manifestForceUpdate?: boolean;
    compatible?: boolean;
    compatibilityReason?: string;
}

export interface ReadAndroidLiveUpdateSnapshotOptions {
    includeManifest?: boolean;
    envOverride?: Record<string, string | boolean | undefined>;
}

export interface AndroidOtaManifest {
    version: string;
    displayVersion?: string;
    productVersion?: string;
    url: string;
    checksum?: string;
    channel?: string;
    /** @deprecated 禁止使用原生版本门禁，运行时将忽略 */
    targetNativeVersion?: string | string[];
    /** @deprecated 禁止使用原生版本门禁，运行时将忽略 */
    minNativeVersion?: string;
    /** @deprecated 禁止使用原生版本门禁，运行时将忽略 */
    maxNativeVersion?: string;
    notes?: string;
    publishedAt?: string;
    forceUpdate?: boolean;
    forceUpdateTitle?: string;
    forceUpdateMessage?: string;
}

type AndroidOtaManifestReadResult =
    | { status: 'success'; manifest: AndroidOtaManifest; manifestUrl: string }
    | { status: 'missing'; reason: string }
    | { status: 'error'; reason: string };

export type AndroidLiveUpdateResult =
    | { status: 'disabled' | 'not-native' | 'up-to-date' }
    | { status: 'incompatible'; version: string; reason: string; requiredNativeVersion?: string }
    | { status: 'queued'; version: string; source: 'downloaded' | 'cached'; mode: 'background' | 'immediate' }
    | { status: 'error'; reason: string };

export type AndroidLiveUpdateApplyMode = 'background' | 'immediate';

export type AndroidForceUpdatePhase =
    | 'hidden'
    | 'checking'
    | 'downloading'
    | 'applying'
    | 'native-update-required'
    | 'error';

export interface AndroidForceUpdateState {
    phase: AndroidForceUpdatePhase;
    blocking: boolean;
    version?: string;
    displayVersion?: string;
    progressPercent?: number;
    currentNativeVersion?: string;
    requiredNativeVersion?: string;
    title?: string;
    message?: string;
    reason?: string;
}

export type AndroidLiveUpdateActivityPhase =
    | 'idle'
    | 'checking'
    | 'downloading'
    | 'applying';

export interface AndroidLiveUpdateActivityState {
    active: boolean;
    phase: AndroidLiveUpdateActivityPhase;
    version?: string;
    displayVersion?: string;
    progressPercent?: number;
}

export interface AndroidLiveUpdateStartOptions {
    force?: boolean;
    onForceStateChange?: (state: AndroidForceUpdateState) => void;
    envOverride?: Record<string, string | boolean | undefined>;
    applyMode?: AndroidLiveUpdateApplyMode;
    initialImmediatePhase?: Extract<AndroidLiveUpdateActivityPhase, 'checking' | 'downloading'>;
}

const DEFAULT_OTA_CHANNEL = 'stable';
const DEFAULT_APP_READY_TIMEOUT_MS = 10000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 60000;
const DEFAULT_MANIFEST_TIMEOUT_MS = 8000;
const DEFAULT_APPLY_RELOAD_TIMEOUT_MS = 8000;
const DEBUG_ANDROID_APP_ID_SEGMENTS = new Set(['debug', 'dev', 'test', 'qa']);
const OTA_VERSION_MARKER = '-ota-';
const HIDDEN_FORCE_UPDATE_STATE: AndroidForceUpdateState = {
    phase: 'hidden',
    blocking: false,
};
const IDLE_LIVE_UPDATE_ACTIVITY_STATE: AndroidLiveUpdateActivityState = {
    active: false,
    phase: 'idle',
};

let updaterLoader: Promise<CapacitorUpdaterModule | null> | null = null;
let notifyAppReadyPromise: Promise<void> | null = null;
let backgroundUpdatePromise: Promise<AndroidLiveUpdateResult> | null = null;
let backgroundUpdatePromiseMode: AndroidLiveUpdateApplyMode | null = null;
let listenerRegistrationPromise: Promise<PluginListenerHandle[] | null> | null = null;
const liveUpdateRequestListeners = new Set<(request: {
    interactive?: boolean;
    applyMode?: AndroidLiveUpdateApplyMode;
    initialImmediatePhase?: Extract<AndroidLiveUpdateActivityPhase, 'checking' | 'downloading'>;
}) => void>();
const liveUpdateActivityListeners = new Set<(state: AndroidLiveUpdateActivityState) => void>();
let liveUpdateActivityState: AndroidLiveUpdateActivityState = IDLE_LIVE_UPDATE_ACTIVITY_STATE;

const parseBooleanEnv = (value: string | boolean | undefined) => {
    if (typeof value === 'boolean') return value;
    return /^(1|true|yes|on)$/i.test((value || '').trim());
};

const getErrorMessage = (error: unknown) => (
    error instanceof Error ? error.message : String(error)
);

const isCapacitorUpdaterPluginUnavailableError = (error: unknown) => (
    /"capacitorupdater" plugin is not implemented on android/i.test(getErrorMessage(error))
);

const disableCapacitorUpdaterPlugin = (reason: string) => {
    updaterLoader = Promise.resolve(null);
    listenerRegistrationPromise = Promise.resolve(null);
    emitCriticalOtaLog('updater-plugin-unavailable', { reason });
    updateOtaDebugState({
        stage: 'updater-plugin-unavailable',
        updaterLoaded: false,
        reason,
    });
};

const readTrimmedEnv = (value: string | boolean | undefined) => (
    typeof value === 'string' ? value.trim() : ''
);

const isNonReleaseAndroidAppId = (appId: string) => (
    appId
        .split('.')
        .some((segment) => DEBUG_ANDROID_APP_ID_SEGMENTS.has(segment.trim().toLowerCase()))
);

const isAndroidOtaAllowedForAppId = (env: Record<string, string | boolean | undefined>) => {
    const appId = readTrimmedEnv(env.VITE_CAPACITOR_APP_ID)
        || readTrimmedEnv(env.CAPACITOR_APP_ID);
    if (!appId || !isNonReleaseAndroidAppId(appId)) {
        return true;
    }
    return parseBooleanEnv(env.VITE_ANDROID_OTA_ALLOW_DEBUG_APP);
};

const isMobileOtaAllowedForAppId = (env: Record<string, string | boolean | undefined>) => {
    const appId = readTrimmedEnv(env.VITE_CAPACITOR_APP_ID)
        || readTrimmedEnv(env.CAPACITOR_APP_ID);
    if (!appId || !isNonReleaseAndroidAppId(appId)) {
        return true;
    }
    return parseBooleanEnv(env.VITE_MOBILE_OTA_ALLOW_DEBUG_APP)
        || parseBooleanEnv(env.VITE_IOS_OTA_ALLOW_DEBUG_APP)
        || parseBooleanEnv(env.VITE_ANDROID_OTA_ALLOW_DEBUG_APP);
};

const parseTimeoutEnv = (value: string | boolean | undefined) => {
    if (typeof value !== 'string') return DEFAULT_APP_READY_TIMEOUT_MS;
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed >= 1000 ? parsed : DEFAULT_APP_READY_TIMEOUT_MS;
};

const resolveDownloadTimeoutMs = (appReadyTimeoutMs: number) => Math.max(
    DEFAULT_DOWNLOAD_TIMEOUT_MS,
    appReadyTimeoutMs * 6,
);

const isBundleReadyForActivation = (status: BundleStatus) => status === 'success' || status === 'pending';

const normalizeUrl = (value: string) => value.replace(/\/+$/, '');
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

const normalizeComparableVersion = (value: string) => {
    const [main] = value.split('+');
    return main.trim();
};

const extractBundleBaseVersion = (value: string) => {
    const normalized = normalizeComparableVersion(value);
    const otaMarkerIndex = normalized.indexOf(OTA_VERSION_MARKER);
    return (otaMarkerIndex >= 0 ? normalized.slice(0, otaMarkerIndex) : normalized).trim();
};

const extractBundleOtaRevision = (value: string) => {
    const normalized = normalizeComparableVersion(value);
    const otaMarkerIndex = normalized.indexOf(OTA_VERSION_MARKER);
    if (otaMarkerIndex < 0) {
        return null;
    }

    const revision = normalized.slice(otaMarkerIndex + OTA_VERSION_MARKER.length).trim();
    return revision || null;
};

const parseVersionParts = (value: string) => extractBundleBaseVersion(value)
    .split('.')
    .map((part) => {
        const parsed = Number.parseInt(part, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    });

const emitForceState = (
    onForceStateChange: AndroidLiveUpdateStartOptions['onForceStateChange'],
    state: AndroidForceUpdateState,
) => {
    onForceStateChange?.(state);
};

const emitLiveUpdateActivityState = (state: AndroidLiveUpdateActivityState) => {
    liveUpdateActivityState = state;
    for (const listener of liveUpdateActivityListeners) {
        listener(state);
    }
};

const setLiveUpdateActivityState = (state: AndroidLiveUpdateActivityState) => {
    emitLiveUpdateActivityState(state);
};

const setImmediateActivityPhase = (
    phase: Exclude<AndroidLiveUpdateActivityPhase, 'idle'>,
    options: { version?: string; displayVersion?: string; progressPercent?: number } = {},
) => {
    setLiveUpdateActivityState({
        active: true,
        phase,
        version: options.version,
        displayVersion: options.displayVersion,
        progressPercent: options.progressPercent,
    });
};

const clearImmediateActivityPhase = () => {
    setLiveUpdateActivityState(IDLE_LIVE_UPDATE_ACTIVITY_STATE);
};

const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error(errorMessage));
                }, timeoutMs);
            }),
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
};

const resolveManifestRequiredNativeVersion = (manifest: AndroidOtaManifest) => {
    if (typeof manifest.targetNativeVersion === 'string' && manifest.targetNativeVersion.trim()) {
        return manifest.targetNativeVersion.trim();
    }

    if (Array.isArray(manifest.targetNativeVersion) && manifest.targetNativeVersion.length === 1) {
        const onlyVersion = manifest.targetNativeVersion[0]?.trim();
        if (onlyVersion) {
            return onlyVersion;
        }
    }

    const minVersion = manifest.minNativeVersion?.trim();
    if (minVersion) {
        return minVersion;
    }

    return undefined;
};

const buildForceUpdateTitle = (manifest: AndroidOtaManifest, fallback: string) => {
    const customTitle = manifest.forceUpdateTitle?.trim();
    return customTitle || fallback;
};

const buildForceUpdateMessage = (
    manifest: AndroidOtaManifest,
    fallback: string,
) => {
    const customMessage = manifest.forceUpdateMessage?.trim();
    return customMessage || fallback;
};

const getManifestDisplayVersion = (manifest: AndroidOtaManifest) => (
    manifest.displayVersion?.trim()
    || manifest.productVersion?.trim()
    || manifest.version
);

const emitCriticalOtaLog = (
    stage: string,
    payload?: Record<string, unknown>,
) => {
    logMobileRuntimeCritical('OTA', stage, payload);
};

const updateOtaDebugState = (_patch: Record<string, unknown>) => {};

const emitOtaErrorState = (
    onForceStateChange: AndroidLiveUpdateStartOptions['onForceStateChange'],
    options: {
        version?: string;
        displayVersion?: string;
        title?: string;
        message: string;
        reason: string;
    },
) => {
    emitForceState(onForceStateChange, {
        phase: 'error',
        blocking: true,
        version: options.version,
        displayVersion: options.displayVersion,
        title: options.title ?? '更新失败',
        message: options.message,
        reason: options.reason,
    });
};

export const compareVersion = (left: string, right: string) => {
    const leftParts = parseVersionParts(left);
    const rightParts = parseVersionParts(right);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftValue = leftParts[index] ?? 0;
        const rightValue = rightParts[index] ?? 0;
        if (leftValue === rightValue) continue;
        return leftValue > rightValue ? 1 : -1;
    }

    return 0;
};

export const compareBundleVersion = (left: string, right: string) => {
    const baseComparison = compareVersion(left, right);
    if (baseComparison !== 0) {
        return baseComparison;
    }

    const leftRevision = extractBundleOtaRevision(left);
    const rightRevision = extractBundleOtaRevision(right);
    if (leftRevision === rightRevision) {
        return 0;
    }
    if (leftRevision == null) {
        return rightRevision == null ? 0 : -1;
    }
    if (rightRevision == null) {
        return 1;
    }

    return leftRevision > rightRevision ? 1 : -1;
};

export const readAndroidLiveUpdateConfig = (
    env: Record<string, string | boolean | undefined>,
): AndroidLiveUpdateConfig => {
    const manifestUrl = readTrimmedEnv(env.VITE_ANDROID_OTA_MANIFEST_URL)
        || readTrimmedEnv(env.VITE_IOS_OTA_MANIFEST_URL)
        || readTrimmedEnv(env.VITE_MOBILE_OTA_MANIFEST_URL);
    const manifestUrls = collectManifestUrls(
        manifestUrl,
        env.VITE_ANDROID_OTA_MANIFEST_FALLBACK_URLS,
        env.VITE_IOS_OTA_MANIFEST_FALLBACK_URLS,
        env.VITE_MOBILE_OTA_MANIFEST_FALLBACK_URLS,
    );
    const channel = readTrimmedEnv(env.VITE_ANDROID_OTA_CHANNEL)
        || readTrimmedEnv(env.VITE_IOS_OTA_CHANNEL)
        || readTrimmedEnv(env.VITE_MOBILE_OTA_CHANNEL)
        || DEFAULT_OTA_CHANNEL;
    const enabled = parseBooleanEnv(env.VITE_ANDROID_OTA_ENABLED)
        ? isAndroidOtaAllowedForAppId(env)
        : parseBooleanEnv(env.VITE_IOS_OTA_ENABLED) || parseBooleanEnv(env.VITE_MOBILE_OTA_ENABLED)
            ? isMobileOtaAllowedForAppId(env)
            : false;

    return {
        enabled: enabled && manifestUrls.length > 0,
        manifestUrl: manifestUrls[0] || manifestUrl,
        manifestUrls,
        channel,
        appReadyTimeoutMs: parseTimeoutEnv(
            env.VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS
                || env.VITE_IOS_OTA_APP_READY_TIMEOUT_MS
                || env.VITE_MOBILE_OTA_APP_READY_TIMEOUT_MS,
        ),
    };
};

const hasNativeVersionGate = (manifest: AndroidOtaManifest): boolean => {
    const targetVersions = Array.isArray(manifest.targetNativeVersion)
        ? manifest.targetNativeVersion
        : manifest.targetNativeVersion
            ? [manifest.targetNativeVersion]
            : [];
    return targetVersions.length > 0
        || typeof manifest.minNativeVersion === 'string'
        || typeof manifest.maxNativeVersion === 'string';
};

export const isManifestCompatibleWithNativeVersion = (
    manifest: AndroidOtaManifest,
    nativeVersion: string,
): { compatible: boolean; reason?: string } => {
    if (!hasNativeVersionGate(manifest)) {
        return { compatible: true };
    }

    const reason = 'manifest 包含原生版本门禁字段，已按规则忽略';
    logMobileRuntime('OTA', 'native-version-gate-ignored', {
        nativeVersion,
        targetNativeVersion: manifest.targetNativeVersion,
        minNativeVersion: manifest.minNativeVersion,
        maxNativeVersion: manifest.maxNativeVersion,
    }, 'warn');
    emitCriticalOtaLog('native-version-gate-ignored', {
        nativeVersion,
        targetNativeVersion: manifest.targetNativeVersion,
        minNativeVersion: manifest.minNativeVersion,
        maxNativeVersion: manifest.maxNativeVersion,
    });

    return { compatible: true, reason };
};

const loadUpdater = async () => {
    if (!updaterLoader) {
        updaterLoader = import('@capgo/capacitor-updater')
            .then((module) => {
                const updaterModule = module as CapacitorUpdaterModule;
                emitCriticalOtaLog('updater-module-loaded', {
                    hasCapacitorUpdater: Boolean(updaterModule.CapacitorUpdater),
                });
                return updaterModule;
            })
            .catch((error) => {
                const reason = error instanceof Error ? error.message : String(error);
                emitCriticalOtaLog('updater-module-load-failed', { reason });
                return null;
            });
    }

    return updaterLoader;
};

const toNativeDebugPatch = (_diagnostics: NativeAndroidRuntimeDiagnostics) => ({});

const getConfigFromMetaEnv = (envOverride?: Record<string, string | boolean | undefined>) => {
    const metaEnv = envOverride ?? ((import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {});
    return readAndroidLiveUpdateConfig(metaEnv);
};

const buildManifestRequestUrl = (url: string) => {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set('ota-check', String(Date.now()));
    return parsedUrl.toString();
};

const readManifest = async (
    url: string,
    timeoutMs: number = DEFAULT_MANIFEST_TIMEOUT_MS,
): Promise<AndroidOtaManifestReadResult> => {
    logMobileRuntime('OTA', 'manifest-fetch-start', { url, timeoutMs });
    emitCriticalOtaLog('manifest-fetch-start', { url, timeoutMs });
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutHandle = setTimeout(() => {
        abortController?.abort();
    }, timeoutMs);
    try {
        const response = await fetch(buildManifestRequestUrl(url), {
            method: 'GET',
            cache: 'no-store',
            redirect: 'manual',
            headers: {
                Accept: 'application/json',
            },
            ...(abortController ? { signal: abortController.signal } : {}),
        });
        const responseType = (response as Response & { type?: string }).type;
        const redirected = (response as Response & { redirected?: boolean }).redirected === true;
        if (redirected || responseType === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
            throw new Error('manifest request redirected; latest.json 控制入口不允许重定向');
        }
        if (response.status === 404) {
            logMobileRuntime('OTA', 'manifest-fetch-404', { url }, 'warn');
            return { status: 'missing', reason: `404 ${url}` };
        }
        if (!response.ok) {
            throw new Error(`manifest request failed: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(`manifest content-type invalid: ${contentType || 'unknown'}`);
        }

        const data = await response.json() as Partial<AndroidOtaManifest>;
        if (!data.version || !data.url || !isAbsoluteHttpUrl(data.url)) {
            throw new Error('manifest 缺少 version/url 或 url 非法');
        }

        const manifest = {
            version: data.version,
            displayVersion: data.displayVersion?.trim() || undefined,
            productVersion: data.productVersion?.trim() || undefined,
            url: data.url,
            checksum: data.checksum,
            channel: data.channel,
            targetNativeVersion: data.targetNativeVersion,
            minNativeVersion: data.minNativeVersion,
            maxNativeVersion: data.maxNativeVersion,
            notes: data.notes,
            publishedAt: data.publishedAt,
            forceUpdate: data.forceUpdate === true,
            forceUpdateTitle: data.forceUpdateTitle,
            forceUpdateMessage: data.forceUpdateMessage,
        };
        logMobileRuntime('OTA', 'manifest-fetch-success', {
            url,
            manifest,
        });
        emitCriticalOtaLog('manifest-fetch-success', {
            url,
            manifestVersion: manifest.version,
            manifestDisplayVersion: manifest.displayVersion,
            manifestProductVersion: manifest.productVersion,
            manifestForceUpdate: manifest.forceUpdate === true,
            targetNativeVersion: manifest.targetNativeVersion,
            minNativeVersion: manifest.minNativeVersion,
            maxNativeVersion: manifest.maxNativeVersion,
        });
        return { status: 'success', manifest, manifestUrl: url };
    } catch (error) {
        const reason = getErrorMessage(error);
        console.warn('[OTA] 读取 manifest 失败', error);
        logMobileRuntime('OTA', 'manifest-fetch-failed', {
            url,
            error,
        }, 'error');
        emitCriticalOtaLog('manifest-fetch-failed', {
            url,
            error,
        });
        return { status: 'error', reason };
    } finally {
        clearTimeout(timeoutHandle);
    }
};

const readManifestFromCandidates = async (
    urls: string[],
    timeoutMs: number = DEFAULT_MANIFEST_TIMEOUT_MS,
): Promise<AndroidOtaManifestReadResult> => {
    const candidates = urls.filter(isAbsoluteHttpUrl);
    if (candidates.length === 0) {
        return { status: 'error', reason: '没有可用的 OTA 清单地址' };
    }

    const failures: string[] = [];
    let sawMissing = false;
    for (const candidateUrl of candidates) {
        const result = await readManifest(candidateUrl, timeoutMs);
        if (result.status === 'success') {
            emitCriticalOtaLog('manifest-candidate-selected', {
                manifestUrl: candidateUrl,
                candidateCount: candidates.length,
            });
            return result;
        }
        sawMissing = sawMissing || result.status === 'missing';
        failures.push(`${candidateUrl}: ${result.status === 'missing' ? result.reason : result.reason}`);
    }

    const reason = `已尝试 ${candidates.length} 个清单入口均失败：${failures.join('；')}`;
    return sawMissing && failures.length === candidates.length
        ? { status: 'missing', reason }
        : { status: 'error', reason };
};

export const readAndroidLiveUpdateSnapshot = async (
    options: ReadAndroidLiveUpdateSnapshotOptions = {},
): Promise<AndroidLiveUpdateSnapshot> => {
    const { includeManifest = true, envOverride } = options;
    const config = getConfigFromMetaEnv(envOverride);
    const baseSnapshot: AndroidLiveUpdateSnapshot = {
        enabled: config.enabled,
        manifestUrl: config.manifestUrl,
        manifestUrls: config.manifestUrls,
        channel: config.channel,
        nativeAndroid: false,
        updaterLoaded: false,
    };

    emitCriticalOtaLog('snapshot-read-start', {
        enabled: config.enabled,
        manifestUrl: config.manifestUrl,
        manifestUrls: config.manifestUrls,
        channel: config.channel,
        includeManifest,
    });

    if (!config.enabled) {
        emitCriticalOtaLog('snapshot-read-disabled', { ...baseSnapshot });
        return baseSnapshot;
    }

    const nativeDiagnostics = getNativeMobileRuntimeDiagnostics();
    emitCriticalOtaLog('native-runtime-check', {
        context: 'snapshot-read',
        ...nativeDiagnostics,
    });
    const nativeMobile = nativeDiagnostics.nativeMobile;
    if (!nativeMobile) {
        const snapshot = {
            ...baseSnapshot,
            nativeAndroid: nativeDiagnostics.nativeAndroid,
        };
        emitCriticalOtaLog('snapshot-read-not-native', {
            ...snapshot,
            ...nativeDiagnostics,
        });
        return snapshot;
    }

    const updaterModule = await loadUpdater();
    if (!updaterModule) {
        const snapshot = {
            ...baseSnapshot,
            nativeAndroid: nativeDiagnostics.nativeAndroid,
            updaterLoaded: false,
        };
        emitCriticalOtaLog('snapshot-read-updater-missing', { ...snapshot });
        return snapshot;
    }

    const manifestResult = includeManifest ? await readManifestFromCandidates(config.manifestUrls) : null;
    const manifest = manifestResult?.status === 'success' ? manifestResult.manifest : null;
    const manifestUrl = manifestResult?.status === 'success' ? manifestResult.manifestUrl : config.manifestUrl;
    let current: CurrentBundleResult;
    try {
        current = await updaterModule.CapacitorUpdater.current();
    } catch (error) {
        if (!isCapacitorUpdaterPluginUnavailableError(error)) {
            throw error;
        }
        disableCapacitorUpdaterPlugin(getErrorMessage(error));
        const snapshot = {
            ...baseSnapshot,
            nativeAndroid: nativeDiagnostics.nativeAndroid,
            updaterLoaded: false,
        };
        emitCriticalOtaLog('snapshot-read-updater-unavailable', { ...snapshot });
        return snapshot;
    }
    const compatibility = manifest
        ? isManifestCompatibleWithNativeVersion(manifest, current.native)
        : undefined;
    const manifestDisplayVersion = manifest ? getManifestDisplayVersion(manifest) : undefined;

    const snapshot: AndroidLiveUpdateSnapshot = {
        ...baseSnapshot,
        manifestUrl,
        nativeAndroid: nativeDiagnostics.nativeAndroid,
        updaterLoaded: true,
        nativeVersion: current.native,
        currentBundleVersion: current.bundle.version,
        currentDisplayVersion: manifest && manifest.version === current.bundle.version
            ? manifestDisplayVersion
            : undefined,
        currentBundleId: current.bundle.id,
        currentBundleStatus: current.bundle.status,
        manifestVersion: manifest?.version,
        manifestDisplayVersion,
        manifestProductVersion: manifest?.productVersion,
        manifestForceUpdate: manifest?.forceUpdate === true,
        compatible: compatibility?.compatible,
        compatibilityReason: compatibility?.reason,
    };
    emitCriticalOtaLog('snapshot-read-success', { ...snapshot });
    return snapshot;
};

const queueDownloadedBundle = async (
    updater: CapacitorUpdaterModule['CapacitorUpdater'],
    bundleId: string,
) => {
    await updater.next({ id: bundleId });
    await updater.setMultiDelay({
        // Capgo 的 background delay 需要显式毫秒值；传空值会导致“已下载但切后台不生效”的假象。
        delayConditions: [{ kind: 'background', value: '0' }],
    });
};

const applyBundleImmediately = async (
    updater: CapacitorUpdaterModule['CapacitorUpdater'],
    bundleId: string,
) => {
    await withTimeout(
        updater.set({ id: bundleId }),
        DEFAULT_APPLY_RELOAD_TIMEOUT_MS,
        `OTA 切换超时：set bundle 超过 ${DEFAULT_APPLY_RELOAD_TIMEOUT_MS}ms`,
    );

    try {
        await withTimeout(
            updater.reload(),
            DEFAULT_APPLY_RELOAD_TIMEOUT_MS,
            `OTA 重启超时：reload 超过 ${DEFAULT_APPLY_RELOAD_TIMEOUT_MS}ms`,
        );
    } catch (error) {
        console.warn('[OTA] 原生 reload 未按预期完成，回退到 window.location.reload()', error);
        if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
            window.location.reload();
            return;
        }
        throw error;
    }
};

const removeListenerSafely = async (handle: PluginListenerHandle | null) => {
    if (!handle) return;
    try {
        await handle.remove();
    } catch {
        // 忽略监听器清理失败，避免覆盖主错误。
    }
};

export const notifyAndroidBundleReady = async () => {
    if (!notifyAppReadyPromise) {
        notifyAppReadyPromise = (async () => {
            const nativeDiagnostics = getNativeMobileRuntimeDiagnostics();
            const nativeMobile = nativeDiagnostics.nativeMobile;
            logMobileRuntime('OTA', 'notify-app-ready-native-check', {
                ...nativeDiagnostics,
            });
            updateOtaDebugState({
                stage: 'notify-app-ready-native-check',
                ...toNativeDebugPatch(nativeDiagnostics),
            });
            if (!nativeMobile) return;

            const updaterModule = await loadUpdater();
            logMobileRuntime('OTA', 'notify-app-ready-updater-check', {
                updaterLoaded: Boolean(updaterModule),
            });
            updateOtaDebugState({
                stage: 'notify-app-ready-updater-check',
                updaterLoaded: Boolean(updaterModule),
            });
            if (!updaterModule) return;

            try {
                await updaterModule.CapacitorUpdater.notifyAppReady();
                logMobileRuntime('OTA', 'notify-app-ready-success');
                emitCriticalOtaLog('notify-app-ready-success');
                updateOtaDebugState({
                    stage: 'notify-app-ready-success',
                });
            } catch (error) {
                if (isCapacitorUpdaterPluginUnavailableError(error)) {
                    disableCapacitorUpdaterPlugin(getErrorMessage(error));
                    return;
                }
                console.warn('[OTA] notifyAppReady 调用失败', error);
                logMobileRuntime('OTA', 'notify-app-ready-failed', { error }, 'error');
                emitCriticalOtaLog('notify-app-ready-failed', { error });
                updateOtaDebugState({
                    stage: 'notify-app-ready-failed',
                    reason: error instanceof Error ? error.message : String(error),
                });
            }
        })();
    }

    return notifyAppReadyPromise;
};

export const registerAndroidLiveUpdateListeners = async () => {
    if (!listenerRegistrationPromise) {
        listenerRegistrationPromise = (async () => {
            const nativeDiagnostics = getNativeMobileRuntimeDiagnostics();
            const nativeMobile = nativeDiagnostics.nativeMobile;
            if (!nativeMobile) return null;

            const updaterModule = await loadUpdater();
            logMobileRuntime('OTA', 'register-listeners-updater-check', {
                updaterLoaded: Boolean(updaterModule),
            });
            updateOtaDebugState({
                stage: 'register-listeners-updater-check',
                updaterLoaded: Boolean(updaterModule),
            });
            if (!updaterModule) return null;

            const { CapacitorUpdater } = updaterModule;
            let handles: PluginListenerHandle[];
            try {
                handles = await Promise.all([
                    CapacitorUpdater.addListener('download', (event) => {
                        updateOtaDebugState({
                            stage: 'listener-download-progress',
                            currentBundleVersion: event.bundle.version,
                            currentBundleId: event.bundle.id,
                            currentBundleStatus: event.bundle.status,
                        });
                        if (!liveUpdateActivityState.active) {
                            return;
                        }
                        setLiveUpdateActivityState({
                            active: true,
                            phase: 'downloading',
                            version: event.bundle.version,
                            progressPercent: Math.max(0, Math.min(100, Math.round(event.percent))),
                        });
                    }),
                    CapacitorUpdater.addListener('downloadComplete', (event) => {
                        console.info('[OTA] bundle 下载完成', event.bundle.version || event.bundle.id || 'unknown');
                        updateOtaDebugState({
                            stage: 'listener-download-complete',
                            currentBundleVersion: event.bundle.version,
                            currentBundleId: event.bundle.id,
                            currentBundleStatus: event.bundle.status,
                        });
                    }),
                    CapacitorUpdater.addListener('downloadFailed', (event) => {
                        console.warn('[OTA] bundle 下载失败', event.version || 'unknown');
                        updateOtaDebugState({
                            stage: 'listener-download-failed',
                            reason: event.version,
                        });
                    }),
                    CapacitorUpdater.addListener('updateFailed', (event) => {
                        console.warn('[OTA] bundle 更新失败', event.bundle.version || event.bundle.id || 'unknown');
                        updateOtaDebugState({
                            stage: 'listener-update-failed',
                            currentBundleVersion: event.bundle.version,
                            currentBundleId: event.bundle.id,
                            currentBundleStatus: event.bundle.status,
                        });
                    }),
                    CapacitorUpdater.addListener('set', (event) => {
                        console.info('[OTA] bundle 已切换', event.bundle.version || event.bundle.id || 'unknown');
                        updateOtaDebugState({
                            stage: 'listener-set',
                            currentBundleVersion: event.bundle.version,
                            currentBundleId: event.bundle.id,
                            currentBundleStatus: event.bundle.status,
                        });
                    }),
                ]);
            } catch (error) {
                if (!isCapacitorUpdaterPluginUnavailableError(error)) {
                    throw error;
                }
                disableCapacitorUpdaterPlugin(getErrorMessage(error));
                return null;
            }

            return handles;
        })();
    }

    return listenerRegistrationPromise;
};

export const requestAndroidLiveUpdateCheck = (request: {
    interactive?: boolean;
    applyMode?: AndroidLiveUpdateApplyMode;
    initialImmediatePhase?: Extract<AndroidLiveUpdateActivityPhase, 'checking' | 'downloading'>;
} = {}) => {
    if ((request.applyMode ?? 'immediate') === 'immediate') {
        setImmediateActivityPhase(request.initialImmediatePhase ?? 'checking');
    }
    for (const listener of liveUpdateRequestListeners) {
        listener(request);
    }
};

export const readAndroidLiveUpdateActivityState = () => liveUpdateActivityState;

export const subscribeAndroidLiveUpdateActivityState = (
    listener: (state: AndroidLiveUpdateActivityState) => void,
) => {
    listener(liveUpdateActivityState);
    liveUpdateActivityListeners.add(listener);
    return () => {
        liveUpdateActivityListeners.delete(listener);
    };
};

export const subscribeAndroidLiveUpdateRequests = (
    listener: (request: {
        interactive?: boolean;
        applyMode?: AndroidLiveUpdateApplyMode;
        initialImmediatePhase?: Extract<AndroidLiveUpdateActivityPhase, 'checking' | 'downloading'>;
    }) => void,
) => {
    liveUpdateRequestListeners.add(listener);
    return () => {
        liveUpdateRequestListeners.delete(listener);
    };
};

export const startAndroidLiveUpdateBackgroundCheck = async (
    options: AndroidLiveUpdateStartOptions = {},
): Promise<AndroidLiveUpdateResult> => {
    const requestedApplyMode = options.applyMode ?? 'background';
    const shouldStartNewRun = !backgroundUpdatePromise
        || (requestedApplyMode === 'immediate' && backgroundUpdatePromiseMode === 'background');

    if (shouldStartNewRun) {
        const runPromise = (async () => {
            const { onForceStateChange } = options;
            const applyMode = requestedApplyMode;
            if (applyMode === 'immediate') {
                const initialImmediatePhase = options.initialImmediatePhase ?? 'checking';
                emitForceState(onForceStateChange, {
                    phase: initialImmediatePhase,
                    blocking: true,
                    title: initialImmediatePhase === 'downloading' ? '正在下载更新' : '正在检查更新',
                    message: initialImmediatePhase === 'downloading'
                        ? '正在下载并准备应用新版本，请稍候。'
                        : '正在检查并准备应用新版本，请稍候。',
                });
                setImmediateActivityPhase(initialImmediatePhase);
            } else {
                emitForceState(onForceStateChange, HIDDEN_FORCE_UPDATE_STATE);
            }

            const config = getConfigFromMetaEnv(options.envOverride);
            emitCriticalOtaLog('background-check-start', {
                force: options.force === true,
                enabled: config.enabled,
                manifestUrl: config.manifestUrl,
                manifestUrls: config.manifestUrls,
                channel: config.channel,
            });
            updateOtaDebugState({
                stage: 'background-check-start',
                resultStatus: undefined,
                reason: undefined,
            });
            logMobileRuntime('OTA', 'background-check-start', {
                force: options.force === true,
                config,
            });
            if (!config.enabled) {
                if (applyMode === 'immediate') {
                    clearImmediateActivityPhase();
                }
                logMobileRuntime('OTA', 'background-check-disabled', { config }, 'warn');
                emitCriticalOtaLog('background-check-disabled', { config });
                updateOtaDebugState({
                    stage: 'background-check-disabled',
                    resultStatus: 'disabled',
                });
                return { status: 'disabled' } as const;
            }

            const nativeDiagnostics = getNativeMobileRuntimeDiagnostics();
            const nativeMobile = nativeDiagnostics.nativeMobile;
            logMobileRuntime('OTA', 'background-check-native-check', {
                ...nativeDiagnostics,
            });
            if (!nativeMobile) {
                if (applyMode === 'immediate') {
                    clearImmediateActivityPhase();
                }
                emitCriticalOtaLog('background-check-not-native', { ...nativeDiagnostics });
                updateOtaDebugState({
                    stage: 'background-check-not-native',
                    resultStatus: 'not-native',
                    ...toNativeDebugPatch(nativeDiagnostics),
                });
                return { status: 'not-native' } as const;
            }

            const nativeOperationTimeoutMs = Math.max(config.appReadyTimeoutMs, 8000);
            const downloadTimeoutMs = resolveDownloadTimeoutMs(config.appReadyTimeoutMs);

            const updaterModule = await loadUpdater();
            if (!updaterModule) {
                if (applyMode === 'immediate') {
                    clearImmediateActivityPhase();
                }
                logMobileRuntime('OTA', 'background-check-updater-missing', {}, 'error');
                emitCriticalOtaLog('background-check-updater-missing');
                updateOtaDebugState({
                    stage: 'background-check-updater-missing',
                    resultStatus: 'error',
                    nativeAndroid: true,
                    updaterLoaded: false,
                    reason: '未能加载 OTA 插件',
                });
                return { status: 'error', reason: '未能加载 OTA 插件' } as const;
            }

            const manifestResult = await readManifestFromCandidates(
                config.manifestUrls,
                Math.max(DEFAULT_MANIFEST_TIMEOUT_MS, config.appReadyTimeoutMs),
            );
            if (manifestResult.status === 'missing') {
                if (applyMode === 'immediate') {
                    clearImmediateActivityPhase();
                }
                const reason = `OTA 清单不存在：${manifestResult.reason}`;
                logMobileRuntime('OTA', 'background-check-manifest-missing', {
                    manifestUrl: config.manifestUrl,
                    manifestUrls: config.manifestUrls,
                    reason,
                }, 'warn');
                emitCriticalOtaLog('background-check-manifest-missing', {
                    manifestUrl: config.manifestUrl,
                    manifestUrls: config.manifestUrls,
                    reason,
                });
                updateOtaDebugState({
                    stage: 'background-check-manifest-missing',
                    resultStatus: 'error',
                    reason,
                });
                emitOtaErrorState(onForceStateChange, {
                    title: '更新清单不存在',
                    message: '无法找到更新清单，请稍后重试或重新安装最新版本。',
                    reason,
                });
                return { status: 'error', reason } as const;
            }
            if (manifestResult.status === 'error') {
                if (applyMode === 'immediate') {
                    clearImmediateActivityPhase();
                }
                const reason = `OTA 清单读取失败：${manifestResult.reason}`;
                logMobileRuntime('OTA', 'background-check-manifest-error', {
                    manifestUrl: config.manifestUrl,
                    manifestUrls: config.manifestUrls,
                    reason,
                }, 'error');
                emitCriticalOtaLog('background-check-manifest-error', {
                    manifestUrl: config.manifestUrl,
                    manifestUrls: config.manifestUrls,
                    reason,
                });
                updateOtaDebugState({
                    stage: 'background-check-manifest-error',
                    resultStatus: 'error',
                    reason,
                });
                emitOtaErrorState(onForceStateChange, {
                    title: '更新失败',
                    message: '无法读取更新清单，请检查网络后重试。',
                    reason,
                });
                return { status: 'error', reason } as const;
            }

            const manifest = manifestResult.manifest;
            const manifestUrl = manifestResult.manifestUrl;
            const manifestDisplayVersion = getManifestDisplayVersion(manifest);

            const isForceUpdate = manifest.forceUpdate === true;
            const resolvedApplyMode = isForceUpdate ? 'immediate' : applyMode;

            try {
                const { CapacitorUpdater } = updaterModule;
                const current = await withTimeout(
                    CapacitorUpdater.current(),
                    nativeOperationTimeoutMs,
                    `OTA 校验超时：读取当前 bundle 超过 ${nativeOperationTimeoutMs}ms`,
                );
                emitCriticalOtaLog('current-bundle-read', {
                    nativeVersion: current.native,
                    currentBundleVersion: current.bundle.version,
                    currentBundleId: current.bundle.id,
                    currentBundleStatus: current.bundle.status,
                    manifestVersion: manifest.version,
                    manifestUrl,
                });
                updateOtaDebugState({
                    stage: 'current-bundle-read',
                    nativeVersion: current.native,
                    currentBundleVersion: current.bundle.version,
                    currentBundleId: current.bundle.id,
                    currentBundleStatus: current.bundle.status,
                    manifestVersion: manifest.version,
                    manifestUrl,
                });
                logMobileRuntime('OTA', 'current-bundle-read', {
                    current,
                });
                const compatibility = isManifestCompatibleWithNativeVersion(manifest, current.native);
                emitCriticalOtaLog('compatibility-checked', {
                    manifestVersion: manifest.version,
                    nativeVersion: current.native,
                    compatible: compatibility.compatible,
                    reason: compatibility.reason,
                });
                updateOtaDebugState({
                    stage: 'compatibility-checked',
                    nativeVersion: current.native,
                    compatible: compatibility.compatible,
                    compatibilityReason: compatibility.reason,
                });
                logMobileRuntime('OTA', 'compatibility-checked', {
                    manifestVersion: manifest.version,
                    nativeVersion: current.native,
                    compatibility,
                });
                if (!compatibility.compatible) {
                    if (resolvedApplyMode === 'immediate') {
                        clearImmediateActivityPhase();
                    }
                    const requiredNativeVersion = resolveManifestRequiredNativeVersion(manifest);
                    emitCriticalOtaLog('compatibility-incompatible', {
                        manifestVersion: manifest.version,
                        nativeVersion: current.native,
                        requiredNativeVersion,
                        reason: compatibility.reason,
                        forceUpdate: isForceUpdate,
                    });
                    updateOtaDebugState({
                        stage: 'compatibility-incompatible',
                        resultStatus: 'incompatible',
                        reason: compatibility.reason,
                        compatible: false,
                    });
                    if (isForceUpdate) {
                        emitForceState(onForceStateChange, {
                            phase: 'native-update-required',
                            blocking: true,
                            version: manifest.version,
                            displayVersion: manifestDisplayVersion,
                            currentNativeVersion: current.native,
                            requiredNativeVersion,
                            title: buildForceUpdateTitle(manifest, '需要更新 App'),
                            message: buildForceUpdateMessage(
                                manifest,
                                requiredNativeVersion
                                    ? `当前 App 版本过旧，需要升级到 ${requiredNativeVersion} 或更高版本后继续使用。`
                                    : '当前 App 版本过旧，需要先安装新版本后继续使用。',
                            ),
                            reason: compatibility.reason,
                        });
                    } else {
                        emitForceState(onForceStateChange, HIDDEN_FORCE_UPDATE_STATE);
                    }
                    return {
                        status: 'incompatible',
                        version: manifest.version,
                        reason: compatibility.reason || 'bundle 与当前原生版本不兼容',
                        requiredNativeVersion,
                    } as const;
                }

                const manifestVsCurrent = compareBundleVersion(manifest.version, current.bundle.version);
                if (manifestVsCurrent <= 0) {
                    if (resolvedApplyMode === 'immediate') {
                        clearImmediateActivityPhase();
                    }
                    emitCriticalOtaLog('already-up-to-date', {
                        currentVersion: current.bundle.version,
                        manifestVersion: manifest.version,
                        comparison: manifestVsCurrent,
                    });
                    logMobileRuntime('OTA', 'already-up-to-date', {
                        currentVersion: current.bundle.version,
                        manifestVersion: manifest.version,
                        comparison: manifestVsCurrent,
                    });
                    emitForceState(onForceStateChange, HIDDEN_FORCE_UPDATE_STATE);
                    return { status: 'up-to-date' } as const;
                }

                if (resolvedApplyMode === 'immediate') {
                    setImmediateActivityPhase('checking', {
                        version: manifest.version,
                        displayVersion: manifestDisplayVersion,
                    });
                    emitForceState(onForceStateChange, {
                        phase: 'checking',
                        blocking: true,
                        version: manifest.version,
                        displayVersion: manifestDisplayVersion,
                        title: '正在准备更新',
                        message: '正在检查并应用新版本，请稍候。',
                    });
                }

                const bundleList = await withTimeout(
                    CapacitorUpdater.list(),
                    nativeOperationTimeoutMs,
                    `OTA 校验超时：读取本地 bundle 列表超过 ${nativeOperationTimeoutMs}ms`,
                );
                const cachedBundle = bundleList.bundles.find(
                    (bundle) => bundle.version === manifest.version && isBundleReadyForActivation(bundle.status),
                );
                if (cachedBundle) {
                    emitCriticalOtaLog('cached-bundle-hit', {
                        bundleId: cachedBundle.id,
                        version: cachedBundle.version,
                        status: cachedBundle.status,
                        forceUpdate: isForceUpdate,
                    });
                    updateOtaDebugState({
                        stage: 'cached-bundle-hit',
                        currentBundleVersion: cachedBundle.version,
                        currentBundleId: cachedBundle.id,
                        currentBundleStatus: cachedBundle.status,
                    });
                    logMobileRuntime('OTA', 'cached-bundle-hit', {
                        cachedBundle,
                    });
                    if (resolvedApplyMode === 'immediate') {
                        setImmediateActivityPhase('applying', {
                            version: manifest.version,
                            displayVersion: manifestDisplayVersion,
                            progressPercent: 100,
                        });
                        emitForceState(onForceStateChange, {
                            phase: 'applying',
                            blocking: true,
                            version: manifest.version,
                            displayVersion: manifestDisplayVersion,
                            progressPercent: 100,
                            title: '正在重启应用',
                            message: '更新包已准备完成，正在重启并切换到新版本。',
                        });
                        await applyBundleImmediately(CapacitorUpdater, cachedBundle.id);
                        emitCriticalOtaLog('cached-bundle-applied-immediately', {
                            bundleId: cachedBundle.id,
                            version: manifest.version,
                        });
                        updateOtaDebugState({
                            stage: 'cached-bundle-applied-immediately',
                            resultStatus: 'queued',
                            currentBundleVersion: manifest.version,
                            currentBundleId: cachedBundle.id,
                        });
                        return {
                            status: 'queued',
                            version: manifest.version,
                            source: 'cached',
                            mode: 'immediate',
                        } as const;
                    }

                    await queueDownloadedBundle(CapacitorUpdater, cachedBundle.id);
                    emitCriticalOtaLog('cached-bundle-queued', {
                        bundleId: cachedBundle.id,
                        version: manifest.version,
                    });
                    updateOtaDebugState({
                        stage: 'cached-bundle-queued',
                        resultStatus: 'queued',
                        currentBundleVersion: manifest.version,
                        currentBundleId: cachedBundle.id,
                    });
                    logMobileRuntime('OTA', 'cached-bundle-queued', {
                        bundleId: cachedBundle.id,
                        version: manifest.version,
                    });
                    emitForceState(onForceStateChange, HIDDEN_FORCE_UPDATE_STATE);
                    return {
                        status: 'queued',
                        version: manifest.version,
                        source: 'cached',
                        mode: 'background',
                    } as const;
                }

                const downloadHandle: PluginListenerHandle | null = null;

                try {
                    if (resolvedApplyMode === 'immediate') {
                        setImmediateActivityPhase('downloading', {
                            version: manifest.version,
                            displayVersion: manifestDisplayVersion,
                        });
                        emitForceState(onForceStateChange, {
                            phase: 'downloading',
                            blocking: true,
                            version: manifest.version,
                            displayVersion: manifestDisplayVersion,
                            title: '正在下载更新',
                            message: '正在下载并准备重启应用，请稍候。',
                        });
                    }

                    logMobileRuntime('OTA', 'download-start', {
                        manifestVersion: manifest.version,
                        bundleUrl: normalizeUrl(manifest.url),
                        checksum: manifest.checksum ?? '',
                        forceUpdate: isForceUpdate,
                    });
                    emitCriticalOtaLog('download-start', {
                        manifestVersion: manifest.version,
                        bundleUrl: normalizeUrl(manifest.url),
                        checksum: manifest.checksum ?? '',
                        forceUpdate: isForceUpdate,
                    });
                    updateOtaDebugState({
                        stage: 'download-start',
                        manifestVersion: manifest.version,
                    });
                    const downloadedBundle = await withTimeout(
                        CapacitorUpdater.download({
                            url: normalizeUrl(manifest.url),
                            version: manifest.version,
                            checksum: manifest.checksum,
                        }),
                        downloadTimeoutMs,
                        `OTA 下载超时：超过 ${downloadTimeoutMs}ms 未完成 bundle 下载`,
                    );
                    emitCriticalOtaLog('download-finished', {
                        downloadedBundle,
                    });
                    updateOtaDebugState({
                        stage: 'download-finished',
                        currentBundleVersion: downloadedBundle.version,
                        currentBundleId: downloadedBundle.id,
                        currentBundleStatus: downloadedBundle.status,
                    });
                    logMobileRuntime('OTA', 'download-finished', {
                        downloadedBundle,
                    });

                    await removeListenerSafely(downloadHandle);

                    if (resolvedApplyMode === 'immediate') {
                        setImmediateActivityPhase('applying', {
                            version: manifest.version,
                            displayVersion: manifestDisplayVersion,
                            progressPercent: 100,
                        });
                        emitForceState(onForceStateChange, {
                            phase: 'applying',
                            blocking: true,
                            version: manifest.version,
                            displayVersion: manifestDisplayVersion,
                            progressPercent: 100,
                            title: '正在重启应用',
                            message: '更新已下载完成，正在重启并切换到新版本。',
                        });
                        await applyBundleImmediately(CapacitorUpdater, downloadedBundle.id);
                        emitCriticalOtaLog('downloaded-bundle-applied-immediately', {
                            bundleId: downloadedBundle.id,
                            version: manifest.version,
                        });
                        updateOtaDebugState({
                            stage: 'downloaded-bundle-applied-immediately',
                            resultStatus: 'queued',
                            currentBundleVersion: manifest.version,
                            currentBundleId: downloadedBundle.id,
                        });
                        logMobileRuntime('OTA', 'downloaded-bundle-applied-immediately', {
                            bundleId: downloadedBundle.id,
                            version: manifest.version,
                        });
                        return {
                            status: 'queued',
                            version: manifest.version,
                            source: 'downloaded',
                            mode: 'immediate',
                        } as const;
                    }

                    await queueDownloadedBundle(CapacitorUpdater, downloadedBundle.id);
                    emitCriticalOtaLog('downloaded-bundle-queued', {
                        bundleId: downloadedBundle.id,
                        version: manifest.version,
                    });
                    updateOtaDebugState({
                        stage: 'downloaded-bundle-queued',
                        resultStatus: 'queued',
                        currentBundleVersion: manifest.version,
                        currentBundleId: downloadedBundle.id,
                    });
                    logMobileRuntime('OTA', 'downloaded-bundle-queued', {
                        bundleId: downloadedBundle.id,
                        version: manifest.version,
                    });
                    emitForceState(onForceStateChange, HIDDEN_FORCE_UPDATE_STATE);
                    return {
                        status: 'queued',
                        version: manifest.version,
                        source: 'downloaded',
                        mode: resolvedApplyMode,
                    } as const;
                } catch (error) {
                    await removeListenerSafely(downloadHandle);
                    throw error;
                }
            } catch (error) {
                if (resolvedApplyMode === 'immediate') {
                    clearImmediateActivityPhase();
                }
                const reason = error instanceof Error ? error.message : String(error);
                logMobileRuntime('OTA', 'background-check-failed', {
                    manifestVersion: manifest.version,
                    reason,
                }, 'error');
                emitCriticalOtaLog('background-check-failed', {
                    manifestVersion: manifest.version,
                    reason,
                });
                updateOtaDebugState({
                    stage: 'background-check-failed',
                    resultStatus: 'error',
                    reason,
                    manifestVersion: manifest.version,
                });
                emitOtaErrorState(onForceStateChange, {
                    version: manifest.version,
                    displayVersion: manifestDisplayVersion,
                    title: buildForceUpdateTitle(manifest, '更新失败'),
                    message: buildForceUpdateMessage(manifest, '下载或切换新版本失败，请重试。'),
                    reason,
                });
                return {
                    status: 'error',
                    reason,
                } as const;
            }
        })();

        backgroundUpdatePromise = runPromise;
        backgroundUpdatePromiseMode = requestedApplyMode;
        void runPromise.finally(() => {
            if (backgroundUpdatePromise === runPromise) {
                backgroundUpdatePromise = null;
                backgroundUpdatePromiseMode = null;
            }
        });
    }

    return backgroundUpdatePromise!;
};
