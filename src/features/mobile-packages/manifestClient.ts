import type { GameManifestMobileDelivery } from '../../games/manifest.types';
import { resolveAssetsBaseUrlFromEnv } from '../../core/AssetLoader';
import { logMobileRuntime, logMobileRuntimeCritical } from '../../lib/mobile/mobileRuntimeDebug';
import { getNativeMobileRuntimeDiagnostics } from '../../lib/mobile/mobileRuntime';
import { fetchRemoteJsonThroughNativePlugin } from './nativeGamePackagePlugin';
import type { ResolvedGamePackageManifest } from './types';

const metaEnv = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

const normalizeUrl = (value: string) => value.replace(/\/+$/, '');
const REMOTE_MANIFEST_TIMEOUT_MS = 15000;

const resolveDefaultMobilePackagePlatform = () => {
    const diagnostics = getNativeMobileRuntimeDiagnostics();
    return diagnostics.nativeIos ? 'ios' : 'android';
};

const REMOTE_MANIFEST_BASE_URL = typeof metaEnv.VITE_MOBILE_PACKAGE_MANIFEST_URL === 'string'
    ? normalizeUrl(metaEnv.VITE_MOBILE_PACKAGE_MANIFEST_URL)
    : `${normalizeUrl(resolveAssetsBaseUrlFromEnv(metaEnv))}/mobile-packages/${resolveDefaultMobilePackagePlatform()}`;

export const hasRemoteGamePackageManifestEndpoint = Boolean(REMOTE_MANIFEST_BASE_URL);

const inFlightManifestRequests = new Map<string, Promise<ResolvedGamePackageManifest>>();

const buildManifestRequestKey = (gameId: string, runtimeChannel: string) =>
    `${runtimeChannel}:${gameId}`;

const fetchRemoteManifestThroughWeb = async (
    url: string,
): Promise<RemoteGamePackageManifestResponse | null> => {
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const fetchTimeoutId = abortController
        ? setTimeout(() => abortController.abort(), REMOTE_MANIFEST_TIMEOUT_MS)
        : undefined;

    try {
        const response = await fetch(url, {
            headers: {
                Accept: 'application/json',
            },
            ...(abortController ? { signal: abortController.signal } : {}),
        });

        if (!response.ok) {
            logMobileRuntimeCritical('MobilePackagesManifest', 'web-fetch-non-2xx', {
                url,
                status: response.status,
                statusText: response.statusText,
            });
            return null;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
            logMobileRuntimeCritical('MobilePackagesManifest', 'web-fetch-invalid-content-type', {
                url,
                contentType: contentType || 'unknown',
            });
            return null;
        }

        const data = await response.json() as RemoteGamePackageManifestResponse;
        logMobileRuntimeCritical('MobilePackagesManifest', 'web-fetch-success', {
            url,
            contentType,
        });
        return data;
    } catch (error) {
        logMobileRuntimeCritical('MobilePackagesManifest', 'web-fetch-failed', {
            url,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    } finally {
        if (fetchTimeoutId !== undefined) {
            clearTimeout(fetchTimeoutId);
        }
    }
};

const tryNativeHttpJson = async (url: string): Promise<RemoteGamePackageManifestResponse | null> => {
    logMobileRuntimeCritical('MobilePackagesManifest', 'native-fetch-start', { url });
    const response = await fetchRemoteJsonThroughNativePlugin(url);
    if (!response) {
        logMobileRuntimeCritical('MobilePackagesManifest', 'native-fetch-no-response', { url });
        return null;
    }
    const status = typeof response.status === 'number' ? response.status : 0;
    if (status < 200 || status >= 300) {
        logMobileRuntimeCritical('MobilePackagesManifest', 'native-fetch-non-2xx', {
            url,
            status,
            contentType: response.contentType,
        });
        return null;
    }
    const body = typeof response.body === 'string' ? response.body.trim() : '';
    if (!body) {
        logMobileRuntimeCritical('MobilePackagesManifest', 'native-fetch-empty-body', {
            url,
            status,
            contentType: response.contentType,
        });
        return null;
    }
    try {
        const parsed = JSON.parse(body) as RemoteGamePackageManifestResponse;
        logMobileRuntimeCritical('MobilePackagesManifest', 'native-fetch-success', {
            url,
            status,
            contentType: response.contentType,
            bodyLength: body.length,
        });
        return parsed;
    } catch {
        logMobileRuntimeCritical('MobilePackagesManifest', 'native-fetch-invalid-json', {
            url,
            status,
            contentType: response.contentType,
            bodyPreview: body.slice(0, 200),
        });
        return null;
    }
};

interface RemotePackInfo {
    id?: string | null;
    version?: string | null;
    url?: string | null;
    checksum?: string | null;
    fallbackUrl?: string | null;
    fallbackChecksum?: string | null;
    bytes?: number | null;
    fallbackBytes?: number | null;
    fileCount?: number | null;
    fileIndexUrl?: string | null;
    fileIndexChecksum?: string | null;
    diffOnly?: boolean | null;
}

interface RemoteGamePackageManifest {
    gameId?: string;
    runtimeChannel?: string;
    modulePack?: RemotePackInfo | null;
    assetPack?: RemotePackInfo | null;
    sharedAudioPack?: RemotePackInfo | null;
}

interface RemoteGamePackageManifestEnvelope {
    manifest?: RemoteGamePackageManifest;
    game?: RemoteGamePackageManifest;
}

type RemoteGamePackageManifestResponse =
    | RemoteGamePackageManifest
    | RemoteGamePackageManifestEnvelope;

const normalizeOptionalNumber = (value: number | undefined) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value
        : undefined;
const normalizeOptionalRemoteNumber = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value
        : undefined;
const normalizeOptionalString = (value: string | null | undefined) =>
    typeof value === 'string' && value.trim()
        ? value.trim()
        : undefined;
const normalizeOptionalHttpUrl = (value: string | null | undefined) => {
    const normalized = normalizeOptionalString(value);
    return normalized && /^https?:\/\//i.test(normalized) ? normalized : undefined;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
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

const applyRemotePack = (
    fallback: Pick<
        ResolvedGamePackageManifest,
        | 'modulePackId'
        | 'assetPackId'
        | 'modulePackVersion'
        | 'assetPackVersion'
        | 'modulePackUrl'
        | 'assetPackUrl'
        | 'modulePackChecksum'
        | 'assetPackChecksum'
        | 'assetPackFileIndexUrl'
        | 'assetPackFileIndexChecksum'
        | 'assetPackDiffOnly'
        | 'modulePackBytes'
        | 'assetPackBytes'
        | 'modulePackFileCount'
        | 'assetPackFileCount'
    >,
    type: 'module' | 'asset',
    remotePack?: RemotePackInfo | null,
) => {
    const fallbackId = type === 'module' ? fallback.modulePackId : fallback.assetPackId;
    const fallbackVersion = type === 'module' ? fallback.modulePackVersion : fallback.assetPackVersion;
    const fallbackUrl = type === 'module' ? fallback.modulePackUrl : fallback.assetPackUrl;
    const fallbackChecksum = type === 'module' ? fallback.modulePackChecksum : fallback.assetPackChecksum;
    const fallbackFileIndexUrl = type === 'module' ? undefined : fallback.assetPackFileIndexUrl;
    const fallbackFileIndexChecksum = type === 'module' ? undefined : fallback.assetPackFileIndexChecksum;
    const fallbackDiffOnly = type === 'module' ? undefined : fallback.assetPackDiffOnly;
    const fallbackBytes = type === 'module' ? fallback.modulePackBytes : fallback.assetPackBytes;
    const fallbackFileCount = type === 'module' ? fallback.modulePackFileCount : fallback.assetPackFileCount;

    if (remotePack === null) {
        return {
            id: undefined,
            version: undefined,
            url: undefined,
            checksum: undefined,
            fileIndexUrl: undefined,
            fileIndexChecksum: undefined,
            diffOnly: undefined,
            bytes: undefined,
            fileCount: undefined,
        };
    }

    const remoteFallbackUrl = normalizeOptionalHttpUrl(remotePack?.fallbackUrl);
    const remoteFallbackChecksum = normalizeOptionalString(remotePack?.fallbackChecksum);
    const remoteBytes = normalizeOptionalRemoteNumber(remotePack?.bytes);
    const remoteFallbackBytes = normalizeOptionalRemoteNumber(remotePack?.fallbackBytes);

    return {
        id: normalizeOptionalString(remotePack?.id) ?? fallbackId,
        version: normalizeOptionalString(remotePack?.version) ?? fallbackVersion,
        url: normalizeOptionalHttpUrl(remotePack?.url) ?? remoteFallbackUrl ?? fallbackUrl,
        checksum: normalizeOptionalString(remotePack?.checksum) ?? remoteFallbackChecksum ?? fallbackChecksum,
        fileIndexUrl: normalizeOptionalHttpUrl(remotePack?.fileIndexUrl) ?? fallbackFileIndexUrl,
        fileIndexChecksum: normalizeOptionalString(remotePack?.fileIndexChecksum) ?? fallbackFileIndexChecksum,
        diffOnly: typeof remotePack?.diffOnly === 'boolean' ? remotePack.diffOnly : fallbackDiffOnly,
        bytes: remoteBytes ?? remoteFallbackBytes ?? fallbackBytes,
        fileCount: normalizeOptionalRemoteNumber(remotePack?.fileCount) ?? fallbackFileCount,
    };
};

export const buildFallbackGamePackageManifest = (
    gameId: string,
    delivery?: GameManifestMobileDelivery,
): ResolvedGamePackageManifest => ({
    gameId,
    runtimeChannel: delivery?.runtimeChannel?.trim() || 'stable',
    modulePackId: delivery?.modulePackId?.trim(),
    assetPackId: delivery?.assetPackId?.trim(),
    modulePackBytes: normalizeOptionalNumber(delivery?.modulePackBytes),
    assetPackBytes: normalizeOptionalNumber(delivery?.assetPackBytes),
    source: 'fallback',
});

const mapRemoteManifest = (
    gameId: string,
    fallbackManifest: ResolvedGamePackageManifest,
    remoteManifest?: RemoteGamePackageManifest | null,
): ResolvedGamePackageManifest => {
    if (!remoteManifest) {
        return fallbackManifest;
    }

    const modulePack = applyRemotePack(fallbackManifest, 'module', remoteManifest.modulePack);
    const assetPack = applyRemotePack(fallbackManifest, 'asset', remoteManifest.assetPack);
    const sharedAudioPack = applyRemotePack({
        ...fallbackManifest,
        assetPackId: fallbackManifest.sharedAudioPackId,
        assetPackVersion: fallbackManifest.sharedAudioPackVersion,
        assetPackUrl: fallbackManifest.sharedAudioPackUrl,
        assetPackChecksum: fallbackManifest.sharedAudioPackChecksum,
        assetPackFileIndexUrl: fallbackManifest.sharedAudioPackFileIndexUrl,
        assetPackFileIndexChecksum: fallbackManifest.sharedAudioPackFileIndexChecksum,
        assetPackBytes: fallbackManifest.sharedAudioPackBytes,
        assetPackFileCount: fallbackManifest.sharedAudioPackFileCount,
    }, 'asset', remoteManifest.sharedAudioPack);

    return {
        gameId,
        runtimeChannel: remoteManifest.runtimeChannel?.trim() || fallbackManifest.runtimeChannel,
        modulePackId: modulePack.id,
        assetPackId: assetPack.id,
        modulePackVersion: modulePack.version,
        assetPackVersion: assetPack.version,
        modulePackUrl: modulePack.url,
        assetPackUrl: assetPack.url,
        modulePackChecksum: modulePack.checksum,
        assetPackChecksum: assetPack.checksum,
        assetPackFileIndexUrl: assetPack.fileIndexUrl,
        assetPackFileIndexChecksum: assetPack.fileIndexChecksum,
        assetPackDiffOnly: assetPack.diffOnly,
        sharedAudioPackId: sharedAudioPack.id,
        sharedAudioPackVersion: sharedAudioPack.version,
        sharedAudioPackUrl: sharedAudioPack.url,
        sharedAudioPackChecksum: sharedAudioPack.checksum,
        sharedAudioPackFileIndexUrl: sharedAudioPack.fileIndexUrl,
        sharedAudioPackFileIndexChecksum: sharedAudioPack.fileIndexChecksum,
        modulePackBytes: modulePack.bytes,
        assetPackBytes: assetPack.bytes,
        sharedAudioPackBytes: sharedAudioPack.bytes,
        modulePackFileCount: modulePack.fileCount,
        assetPackFileCount: assetPack.fileCount,
        sharedAudioPackFileCount: sharedAudioPack.fileCount,
        source: 'remote',
    };
};

const extractRemoteManifest = (
    response?: RemoteGamePackageManifestResponse | null,
): RemoteGamePackageManifest | null => {
    if (!response || typeof response !== 'object') {
        return null;
    }

    const envelope = response as RemoteGamePackageManifestEnvelope;
    if (envelope.manifest && typeof envelope.manifest === 'object') {
        return envelope.manifest;
    }

    if (envelope.game && typeof envelope.game === 'object') {
        return envelope.game;
    }

    return response as RemoteGamePackageManifest;
};

export const resolveGamePackageManifest = async (
    gameId: string,
    delivery?: GameManifestMobileDelivery,
): Promise<ResolvedGamePackageManifest> => {
    const fallbackManifest = buildFallbackGamePackageManifest(gameId, delivery);
    if (!hasRemoteGamePackageManifestEndpoint || !delivery || delivery.mode !== 'package-managed') {
        logMobileRuntime('MobilePackagesManifest', 'skip-remote-manifest', {
            gameId,
            hasRemoteGamePackageManifestEndpoint,
            deliveryMode: delivery?.mode ?? 'none',
            fallbackRuntimeChannel: fallbackManifest.runtimeChannel,
        });
        return fallbackManifest;
    }

    const url = `${REMOTE_MANIFEST_BASE_URL}/${encodeURIComponent(fallbackManifest.runtimeChannel)}/games/${encodeURIComponent(gameId)}.json`;
    const requestKey = buildManifestRequestKey(gameId, fallbackManifest.runtimeChannel);
    const existingRequest = inFlightManifestRequests.get(requestKey);
    if (existingRequest) {
        logMobileRuntimeCritical('MobilePackagesManifest', 'reuse-inflight-request', {
            gameId,
            url,
            requestKey,
        });
        return existingRequest;
    }

    logMobileRuntime('MobilePackagesManifest', 'fetch-start', {
        gameId,
        runtimeChannel: fallbackManifest.runtimeChannel,
        url,
        fallbackManifest,
    });

    const requestPromise = (async () => {
        try {
            const webResponse = await fetchRemoteManifestThroughWeb(url);
            if (webResponse) {
                const resolvedManifest = mapRemoteManifest(gameId, fallbackManifest, extractRemoteManifest(webResponse));
                logMobileRuntimeCritical('MobilePackagesManifest', 'resolve-success-web-fetch', {
                    gameId,
                    url,
                    resolvedManifest,
                });
                logMobileRuntime('MobilePackagesManifest', 'fetch-success', {
                    gameId,
                    url,
                    resolvedManifest,
                });
                return resolvedManifest;
            }

            logMobileRuntimeCritical('MobilePackagesManifest', 'resolve-fallback-native-fetch', {
                gameId,
                url,
            });

            let nativeResponse: RemoteGamePackageManifestResponse | null = null;
            try {
                nativeResponse = await withTimeout(
                    tryNativeHttpJson(url),
                    REMOTE_MANIFEST_TIMEOUT_MS,
                    `remote manifest native request timed out after ${REMOTE_MANIFEST_TIMEOUT_MS}ms`,
                );
            } catch (error) {
                logMobileRuntimeCritical('MobilePackagesManifest', 'native-fetch-timeout-after-web-failure', {
                    gameId,
                    url,
                    error: error instanceof Error ? error.message : String(error),
                });
            }

            if (nativeResponse) {
                const resolvedManifest = mapRemoteManifest(gameId, fallbackManifest, extractRemoteManifest(nativeResponse));
                logMobileRuntimeCritical('MobilePackagesManifest', 'resolve-success-native', {
                    gameId,
                    url,
                    resolvedManifest,
                });
                return resolvedManifest;
            }

            logMobileRuntimeCritical('MobilePackagesManifest', 'resolve-fallback-manifest', {
                gameId,
                url,
                reason: 'web-and-native-unavailable',
            });
            return fallbackManifest;
        } catch (error) {
            logMobileRuntimeCritical('MobilePackagesManifest', 'resolve-exception', {
                gameId,
                url,
                error: error instanceof Error ? error.message : String(error),
            });
            logMobileRuntime('MobilePackagesManifest', 'fetch-exception', {
                gameId,
                url,
                error,
            }, 'error');
            return fallbackManifest;
        } finally {
            inFlightManifestRequests.delete(requestKey);
        }
    })();

    inFlightManifestRequests.set(requestKey, requestPromise);
    return requestPromise;
};
