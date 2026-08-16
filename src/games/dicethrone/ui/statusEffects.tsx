// @asset-pipeline-allow
// 这里用真实 img + 裁剪容器承接 atlas/status 图标，但候选 URL、预加载缓存与 ready 事件仍统一复用 AssetLoader 链路。
import type { CSSProperties } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import {
    getAssetsBaseUrl,
    getLocalizedLocalAssetPath,
    getPreloadedImageElement,
    getResolvedImageCandidateUrl,
    getRuntimeImageCandidateUrls,
    markImageCandidateFailed,
    markImageLoaded,
    onImageReady,
} from '../../../core';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';
import { resolveI18nList } from './utils';

import { STATUS_IDS } from '../domain/ids';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import type { TokenDef } from '../domain/tokenTypes';

// 从 CharacterData 自动收集图集路径（Single Source of Truth）
const STATUS_ATLAS_PATHS: Record<string, string> = (() => {
    const paths: Record<string, string> = {};
    for (const data of Object.values(CHARACTER_DATA_MAP)) {
        if (!paths[data.statusAtlasId]) {
            paths[data.statusAtlasId] = data.statusAtlasPath;
        }
    }
    return paths;
})();

type StatusIconAtlasFrame = { x: number; y: number; w: number; h: number };
export type StatusIconAtlasConfig = {
    imageW: number;
    imageH: number;
    frames: Record<string, StatusIconAtlasFrame>;
    imagePath?: string;
};

type StatusIconAtlasResponse = {
    meta: { image: string; size: { w: number; h: number } };
    frames: Record<string, { frame: StatusIconAtlasFrame }>;
};

const isStatusIconAtlasResponse = (value: unknown): value is StatusIconAtlasResponse => {
    if (!value || typeof value !== 'object') return false;
    const data = value as StatusIconAtlasResponse;
    const size = data.meta?.size;
    const frames = data.frames;
    if (!size || typeof size.w !== 'number' || typeof size.h !== 'number') return false;
    if (!frames || typeof frames !== 'object') return false;
    return Object.values(frames).every((entry) => {
        const frame = entry?.frame;
        return Boolean(frame)
            && typeof frame.x === 'number'
            && typeof frame.y === 'number'
            && typeof frame.w === 'number'
            && typeof frame.h === 'number';
    });
};

// Map of Atlas ID -> Config
export type StatusAtlases = Record<string, StatusIconAtlasConfig>;
const DEFAULT_STATUS_ATLAS_REMOTE_BASE_URL = 'https://assets.easyboardgame.top/official';

const getAtlasFallbackLocale = (locale: string) => {
    if (locale === 'zh-CN') return 'en';
    if (locale === 'en') return 'zh-CN';
    return 'en';
};

const dedupeUrls = (urls: Array<string | undefined>) => (
    urls.filter((url, index, list): url is string => Boolean(url) && list.indexOf(url) === index)
);

const appendCapacitorFileQuerylessFallback = (url: string | undefined) => {
    if (!url) {
        return [];
    }

    const candidates = [url];
    const isCapacitorFileUrl = /^https?:\/\/[^/]+\/_capacitor_file_\//i.test(url)
        || url.startsWith('/_capacitor_file_/');
    if (!isCapacitorFileUrl) {
        return candidates;
    }

    const queryIndex = url.indexOf('?');
    if (queryIndex <= 0) {
        return candidates;
    }

    candidates.push(url.slice(0, queryIndex));
    return candidates;
};

const stripStatusAtlasAssetPrefix = (path: string) => (
    path
        .replace(/^\/+/, '')
        .replace(/^assets\//, '')
        .replace(/^i18n\/[^/]+\//, '')
);

const getStatusAtlasRemoteJsonCandidates = (path: string, locale: string) => {
    const relative = stripStatusAtlasAssetPrefix(path);
    const remoteRelativePath = `i18n/${locale}/${relative}`;
    const remoteBaseUrls = [
        /^https?:\/\//i.test(getAssetsBaseUrl()) ? getAssetsBaseUrl() : '',
        DEFAULT_STATUS_ATLAS_REMOTE_BASE_URL,
    ].filter((url, index, list): url is string => Boolean(url) && list.indexOf(url) === index);

    return remoteBaseUrls.map((baseUrl) => `${baseUrl}/${remoteRelativePath}`);
};

const getStatusAtlasJsonCandidates = (path: string, locale?: string) => {
    const effectiveLocale = locale || 'zh-CN';
    const fallbackLocale = getAtlasFallbackLocale(effectiveLocale);

    return dedupeUrls([
        ...appendCapacitorFileQuerylessFallback(getLocalizedLocalAssetPath(path, effectiveLocale)),
        ...getStatusAtlasRemoteJsonCandidates(path, effectiveLocale),
        ...appendCapacitorFileQuerylessFallback(getLocalizedLocalAssetPath(path, fallbackLocale)),
        ...getStatusAtlasRemoteJsonCandidates(path, fallbackLocale),
    ]);
};

const fetchStatusAtlasJson = async (path: string, locale?: string): Promise<StatusIconAtlasResponse | null> => {
    for (const url of getStatusAtlasJsonCandidates(path, locale)) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const data: unknown = await response.json();
            if (isStatusIconAtlasResponse(data)) {
                return data;
            }
        } catch {
            continue;
        }
    }

    return null;
};

export const loadStatusAtlases = async (locale?: string): Promise<StatusAtlases> => {
    const promises = Object.entries(STATUS_ATLAS_PATHS).map(async ([id, path]) => {
        try {
            const data = await fetchStatusAtlasJson(path, locale);
            if (!data) return null;

            // 图片路径也需要经过 getLocalizedAssetPath 处理（去掉 .json 后缀，加上图片文件名）
            const baseDir = path.substring(0, path.lastIndexOf('/') + 1);
            const imagePath = `${baseDir}${data.meta.image.replace('.png', '')}`;  // 去掉扩展名，让 buildLocalizedImageSet 处理

            const frames = Object.fromEntries(
                Object.entries(data.frames).map(([key, entry]) => [key, entry.frame])
            );
            return { id, config: { imageW: data.meta.size.w, imageH: data.meta.size.h, frames, imagePath } };
        } catch (e) {
            console.warn(`Failed to load status atlas: ${id}`, e);
            return null;
        }
    });

    const results = await Promise.all(promises);
    return results.reduce((acc, curr) => {
        if (curr) acc[curr.id] = curr.config;
        return acc;
    }, {} as StatusAtlases);
};

import { STATUS_EFFECT_META, TOKEN_META, getVisualMetaById, type StatusEffectMeta } from '../domain/statusEffects';

// Re-export for consumers that import from ui/statusEffects
export { STATUS_EFFECT_META, TOKEN_META, type StatusEffectMeta };

const hasUsableStatusImage = (img: HTMLImageElement | null | undefined): img is HTMLImageElement =>
    Boolean(img) && img.naturalWidth > 0 && img.naturalHeight > 0;

const normalizeComparableUrl = (url: string): string => {
    if (!url) return '';
    if (typeof window === 'undefined') return url;
    try {
        return new URL(url, window.location.href).href;
    } catch {
        return url;
    }
};

const isCrossOriginStatusImageUrl = (url: string): boolean => {
    if (!/^https?:\/\//i.test(url) || /\/_capacitor_file_\//i.test(url)) {
        return false;
    }
    if (typeof window === 'undefined') {
        return true;
    }
    try {
        return new URL(url, window.location.href).origin !== window.location.origin;
    } catch {
        return false;
    }
};

const isOfficialStatusAtlasImageUrl = (url: string): boolean => (
    normalizeComparableUrl(url).startsWith(`${DEFAULT_STATUS_ATLAS_REMOTE_BASE_URL}/`)
);

const isLocalPublicStatusAtlasImageUrl = (url: string): boolean => {
    if (!url || /\/_capacitor_file_\//i.test(url)) {
        return false;
    }

    if (typeof window === 'undefined') {
        return url.startsWith('/assets/');
    }

    try {
        const parsed = new URL(url, window.location.href);
        return parsed.origin === window.location.origin && parsed.pathname.startsWith('/assets/');
    } catch {
        return url.startsWith('/assets/');
    }
};

const orderStatusAtlasImageCandidates = (candidateUrls: string[]): string[] => {
    const customOrPackageCandidates = candidateUrls.filter((url) =>
        !isOfficialStatusAtlasImageUrl(url) && !isLocalPublicStatusAtlasImageUrl(url)
    );
    const officialCandidates = candidateUrls.filter(isOfficialStatusAtlasImageUrl);
    const localPublicCandidates = candidateUrls.filter(isLocalPublicStatusAtlasImageUrl);

    return dedupeUrls([
        ...customOrPackageCandidates,
        // 棋盘状态必须优先使用随当前站点发布的正式素材；外部 CDN 只能后备。
        // 否则网络请求悬挂时不会触发 error，候选链无法到达本地图集，选择 UI 只剩空圈。
        ...localPublicCandidates,
        ...officialCandidates,
    ]);
};

const OFFICIAL_STATUS_ATLAS_RETRY_LIMIT = 2;

const appendStatusAtlasRetryFragment = (url: string, attempt: number): string => {
    const [baseUrl] = url.split('#');
    return `${baseUrl}#status-atlas-retry-${attempt}-${Date.now()}`;
};

const findCandidateIndex = (candidateUrls: string[], url: string) => {
    if (!url) return -1;
    const normalizedUrl = normalizeComparableUrl(url);
    return candidateUrls.findIndex((candidateUrl) => normalizeComparableUrl(candidateUrl) === normalizedUrl);
};

const resolveLoadedStatusCandidateUrl = (candidateUrls: string[]) => {
    const normalizedCandidates = candidateUrls.map((candidateUrl) => ({
        candidateUrl,
        normalized: normalizeComparableUrl(candidateUrl),
    }));

    for (const candidateUrl of candidateUrls) {
        const loadedStatusImage = statusImageLoadedResults.get(candidateUrl);
        if (loadedStatusImage?.renderUrl) {
            return candidateUrl;
        }
    }

    const resolvedUrl = getResolvedImageCandidateUrl(candidateUrls);
    if (resolvedUrl) {
        const normalizedResolvedUrl = normalizeComparableUrl(resolvedUrl);
        const matched = normalizedCandidates.find((candidate) => candidate.normalized === normalizedResolvedUrl);
        if (matched) {
            return matched.candidateUrl;
        }
    }

    for (const candidateUrl of candidateUrls) {
        const img = getPreloadedImageElement(candidateUrl);
        if (!hasUsableStatusImage(img)) {
            continue;
        }

        for (const src of [img.currentSrc, img.src]) {
            const normalizedSrc = normalizeComparableUrl(src);
            if (!normalizedSrc) continue;
            const matched = normalizedCandidates.find((candidate) => candidate.normalized === normalizedSrc);
            if (matched) {
                return matched.candidateUrl;
            }
        }
    }

    return '';
};

type LoadedStatusImage = { url: string; renderUrl: string; img?: HTMLImageElement; objectUrl?: string };
type StatusImageLoadResult = LoadedStatusImage | null;
const statusImageInFlightLoads = new Map<string, Promise<StatusImageLoadResult>>();
const statusImageLoadedResults = new Map<string, LoadedStatusImage>();

export const __resetStatusEffectImageCachesForTests = () => {
    for (const result of statusImageLoadedResults.values()) {
        if (result.objectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(result.objectUrl);
        }
    }
    statusImageInFlightLoads.clear();
    statusImageLoadedResults.clear();
};

const loadStatusImageElement = (url: string, crossOrigin: boolean): Promise<HTMLImageElement | null> => new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) {
        img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
        resolve(hasUsableStatusImage(img) ? img : null);
    };
    img.onerror = () => {
        resolve(null);
    };
    img.src = url;
});

const shouldFetchStatusImageCandidate = (url: string): boolean => {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
        return false;
    }
    if (/\/_capacitor_file_\//i.test(url)) {
        return false;
    }
    return typeof fetch === 'function';
};

const loadSingleStatusImageCandidate = async (url: string): Promise<LoadedStatusImage | null> => {
    const cached = statusImageLoadedResults.get(url);
    if (cached?.renderUrl) {
        return cached;
    }

    if (shouldFetchStatusImageCandidate(url)) {
        try {
            const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
            if (response.ok) {
                const blob = await response.blob();
                if (!blob.type.toLowerCase().startsWith('image/')) {
                    return null;
                }
                if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                    const objectUrl = URL.createObjectURL(blob);
                    const img = await loadStatusImageElement(objectUrl, false);
                    if (img) {
                        const result = { url, renderUrl: objectUrl, img, objectUrl };
                        statusImageLoadedResults.set(url, result);
                        markImageLoaded(url, undefined, img, url);
                        return result;
                    }
                    if (typeof URL.revokeObjectURL === 'function') {
                        URL.revokeObjectURL(objectUrl);
                    }
                }
            }
        } catch {
            // Fall through to normal Image loading. Some environments do not support CORS fetch.
        }
    }

    const img = await loadStatusImageElement(url, false);
    if (!img) {
        return null;
    }
    const result = { url, renderUrl: url, img };
    statusImageLoadedResults.set(url, result);
    markImageLoaded(url, undefined, img, url);
    return result;
};

const loadStatusImageCandidatesShared = (candidateUrls: string[]): Promise<StatusImageLoadResult> => {
    if (candidateUrls.length === 0) {
        return Promise.resolve(null);
    }

    const inFlightKey = candidateUrls.join('|');
    const inFlight = statusImageInFlightLoads.get(inFlightKey);
    if (inFlight) {
        return inFlight;
    }

    const promise = new Promise<StatusImageLoadResult>((resolve) => {
        const tryLoad = (index: number) => {
            if (index >= candidateUrls.length) {
                resolve(null);
                return;
            }

            const url = candidateUrls[index];
            void loadSingleStatusImageCandidate(url).then((result) => {
                if (!result) {
                    tryLoad(index + 1);
                    return;
                }
                resolve(result);
            });
        };

        tryLoad(0);
    }).finally(() => {
        statusImageInFlightLoads.delete(inFlightKey);
    });

    statusImageInFlightLoads.set(inFlightKey, promise);
    return promise;
};

const getAtlasFrameImageStyle = (atlas: StatusIconAtlasConfig, frame: StatusIconAtlasFrame): CSSProperties => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${(atlas.imageW / frame.w) * 100}%`,
    height: `${(atlas.imageH / frame.h) * 100}%`,
    maxWidth: 'none',
    maxHeight: 'none',
    pointerEvents: 'none',
    userSelect: 'none',
    transform: `translate(${-(frame.x / atlas.imageW) * 100}%, ${-(frame.y / atlas.imageH) * 100}%)`,
    transformOrigin: 'top left',
});

const useResolvedStatusImage = (sourcePath: string | undefined, locale: string | undefined) => {
    const effectiveLocale = locale || 'zh-CN';
    const candidateUrls = React.useMemo(
        () => {
            if (!sourcePath) {
                return [];
            }

            const urls = getRuntimeImageCandidateUrls(sourcePath, effectiveLocale);
            return /status-icons-atlas/i.test(sourcePath)
                ? orderStatusAtlasImageCandidates(urls)
                : urls;
        },
        [effectiveLocale, sourcePath],
    );
    const isStatusAtlasSource = !!sourcePath && /status-icons-atlas/i.test(sourcePath);
    const loadedCandidateUrl = React.useMemo(
        () => resolveLoadedStatusCandidateUrl(candidateUrls),
        [candidateUrls],
    );
    const hasLoadedStatusCandidate = !!(
        loadedCandidateUrl
        && statusImageLoadedResults.get(loadedCandidateUrl)?.renderUrl
    );
    const initialCandidateIndex = React.useMemo(() => {
        if (candidateUrls.length === 0) return -1;
        const preloadedIndex = loadedCandidateUrl
            ? findCandidateIndex(candidateUrls, loadedCandidateUrl)
            : -1;
        return preloadedIndex >= 0 ? preloadedIndex : 0;
    }, [candidateUrls, loadedCandidateUrl]);
    const [candidateIndex, setCandidateIndex] = React.useState(initialCandidateIndex);
    const activeSourceUrl = candidateIndex >= 0 ? candidateUrls[candidateIndex] ?? '' : '';
    const [resolvedImage, setResolvedImage] = React.useState<LoadedStatusImage | null>(() => (
        activeSourceUrl ? statusImageLoadedResults.get(activeSourceUrl) ?? null : null
    ));
    const activeUrl = resolvedImage?.url === activeSourceUrl ? resolvedImage.renderUrl : activeSourceUrl;
    const rescueLoadRef = React.useRef<Promise<StatusImageLoadResult> | null>(null);
    const officialStatusAtlasRetryCountsRef = React.useRef(new Map<string, number>());

    React.useEffect(() => {
        setCandidateIndex(initialCandidateIndex);
    }, [initialCandidateIndex, loadedCandidateUrl, sourcePath, effectiveLocale]);

    React.useEffect(() => {
        const cached = activeSourceUrl ? statusImageLoadedResults.get(activeSourceUrl) : null;
        if (cached?.renderUrl) {
            setResolvedImage(cached);
        }
    }, [activeSourceUrl]);

    React.useEffect(() => {
        if (!sourcePath || candidateUrls.length === 0) {
            return;
        }
        if (loadedCandidateUrl && (!isStatusAtlasSource || hasLoadedStatusCandidate)) {
            return;
        }

        let cancelled = false;
        const load = loadStatusImageCandidatesShared(candidateUrls);
        rescueLoadRef.current = load;
        void load.then((result) => {
            if (cancelled || !result) {
                return;
            }

            if (result.img) {
                markImageLoaded(sourcePath, effectiveLocale, result.img, result.url);
            }
            setResolvedImage(result);
            const nextIndex = findCandidateIndex(candidateUrls, result.url);
            if (nextIndex >= 0) {
                setCandidateIndex(nextIndex);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [candidateUrls, effectiveLocale, hasLoadedStatusCandidate, isStatusAtlasSource, loadedCandidateUrl, sourcePath]);

    React.useEffect(() => {
        if (!sourcePath || candidateUrls.length === 0) {
            return;
        }

        return onImageReady((url) => {
            if (!candidateUrls.includes(url)) {
                return;
            }
            if (isStatusAtlasSource) {
                const loadedStatusImage = statusImageLoadedResults.get(url);
                if (!loadedStatusImage?.renderUrl) {
                    return;
                }
                setResolvedImage(loadedStatusImage);
            }
            if (!hasUsableStatusImage(getPreloadedImageElement(url))) {
                return;
            }
            const nextIndex = findCandidateIndex(candidateUrls, url);
            if (nextIndex >= 0) {
                setCandidateIndex(nextIndex);
            }
        });
    }, [candidateUrls, isStatusAtlasSource, sourcePath]);

    const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
        if (!sourcePath) return;
        const img = event.currentTarget;
        if (!hasUsableStatusImage(img)) {
            return;
        }
        markImageLoaded(activeSourceUrl, undefined, img, activeSourceUrl);
        markImageLoaded(sourcePath, effectiveLocale, img, activeSourceUrl);
    };

    const advanceToNextCandidate = () => {
        setCandidateIndex((currentIndex) => {
            if (currentIndex !== candidateIndex) {
                return currentIndex;
            }
            const nextIndex = currentIndex + 1;
            return nextIndex < candidateUrls.length ? nextIndex : -1;
        });
    };

    const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const failedUrl = event.currentTarget.currentSrc || event.currentTarget.src || '';
        const failedCandidateIndex = findCandidateIndex(candidateUrls, failedUrl);
        if (failedCandidateIndex >= 0 && failedCandidateIndex !== candidateIndex) {
            return;
        }

        if (
            sourcePath
            && /status-icons-atlas/i.test(sourcePath)
            && activeSourceUrl
            && isOfficialStatusAtlasImageUrl(activeSourceUrl)
        ) {
            const retryCount = officialStatusAtlasRetryCountsRef.current.get(activeSourceUrl) ?? 0;
            if (retryCount < OFFICIAL_STATUS_ATLAS_RETRY_LIMIT) {
                const nextRetryCount = retryCount + 1;
                officialStatusAtlasRetryCountsRef.current.set(activeSourceUrl, nextRetryCount);
                setResolvedImage({
                    url: activeSourceUrl,
                    renderUrl: appendStatusAtlasRetryFragment(activeSourceUrl, nextRetryCount),
                });
                return;
            }
        }

        if (sourcePath && activeSourceUrl) {
            markImageCandidateFailed(sourcePath, effectiveLocale, activeSourceUrl);
        }

        if (sourcePath && candidateUrls.length > 0 && isCrossOriginStatusImageUrl(activeSourceUrl)) {
            const load = loadStatusImageCandidatesShared(candidateUrls);
            rescueLoadRef.current = load;
            void load.then((result) => {
                if (rescueLoadRef.current !== load) {
                    return;
                }
                if (result) {
                    if (result.img) {
                        markImageLoaded(sourcePath, effectiveLocale, result.img, result.url);
                    }
                    setResolvedImage(result);
                    const nextIndex = findCandidateIndex(candidateUrls, result.url);
                    if (nextIndex >= 0) {
                        setCandidateIndex(nextIndex);
                    }
                    return;
                }
                advanceToNextCandidate();
            });
            return;
        }

        advanceToNextCandidate();
    };

    return {
        activeUrl,
        handleError,
        handleLoad,
        sourceUrl: activeSourceUrl,
    };
};

const ResolvedStatusIconImage = ({
    className,
    locale,
    sourcePath,
    style,
}: {
    className: string;
    locale?: string;
    sourcePath?: string;
    style?: CSSProperties;
}) => {
    const { activeUrl, handleError, handleLoad, sourceUrl } = useResolvedStatusImage(sourcePath, locale);
    if (!activeUrl) {
        return <span className={className} />;
    }

    return (
        <img
            alt=""
            aria-hidden="true"
            className={className}
            data-status-source-url={sourceUrl}
            draggable={false}
            onError={handleError}
            onLoad={handleLoad}
            src={activeUrl}
            style={style}
        />
    );
};

export const getStatusEffectIconNode = (
    meta: StatusEffectMeta,
    locale: string | undefined,
    size: 'tiny' | 'small' | 'normal' | 'fly' | 'choice',
    atlas?: StatusAtlases | null
) => {
    let frame: StatusIconAtlasFrame | undefined;
    let targetAtlas: StatusIconAtlasConfig | undefined;

    if (meta.atlasId && atlas?.[meta.atlasId]) {
        targetAtlas = atlas[meta.atlasId];
        frame = meta.frameId ? targetAtlas.frames[meta.frameId] : undefined;
    } else if (atlas && meta.frameId) {
        // Fallback: Search in all atlases
        for (const config of Object.values(atlas)) {
            if (config.frames[meta.frameId]) {
                targetAtlas = config;
                frame = config.frames[meta.frameId];
                // For debug:
                // console.log(`Found ${meta.frameId} in ${id}`);
                break;
            }
        }
    }

    if (!frame || !targetAtlas) {
        if (meta.iconPath) {
            return (
                <ResolvedStatusIconImage
                    className="block w-full h-full object-contain drop-shadow-md"
                    locale={locale}
                    sourcePath={meta.iconPath}
                />
            );
        }
        // 无精灵图且无单图时不显示内容，外层渐变背景已提供视觉标识
        return <span className="block w-full h-full" />;
    }
    const sizeClass = size === 'choice' ? 'w-full h-full' : 'w-full h-full';

    return (
        <span className={`relative block ${sizeClass} overflow-hidden`}>
            <ResolvedStatusIconImage
                className="drop-shadow-md"
                locale={locale}
                sourcePath={targetAtlas.imagePath}
                style={{
                    ...getAtlasFrameImageStyle(targetAtlas, frame),
                }}
            />
        </span>
    );
};

export const StatusEffectBadge = ({
    effectId,
    stacks,
    size = 'normal',
    locale,
    atlas,
    onClick,
    clickable = false,
    dataTestId,
}: {
    effectId: string;
    stacks: number;
    size?: 'normal' | 'small' | 'tiny';
    locale?: string;
    atlas?: StatusAtlases | null;
    onClick?: () => void;
    clickable?: boolean;
    dataTestId?: string;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const meta = STATUS_EFFECT_META[effectId] || { color: 'from-gray-500 to-gray-600' };

    // Check if sprite exists in the resolved atlas
    let hasSprite = false;
    if (atlas && meta.frameId) {
        if (meta.atlasId && atlas[meta.atlasId]) {
            hasSprite = Boolean(atlas[meta.atlasId].frames[meta.frameId]);
        } else {
            // Fallback check
            hasSprite = Object.values(atlas).some(config => Boolean(config.frames[meta.frameId!]));
        }
    }
    const description = resolveI18nList(
        t(`statusEffects.${effectId}.description`, { returnObjects: true })
    );
    const info = {
        ...meta,
        name: t(`statusEffects.${effectId}.name`) as string,
        description,
    };
    const [isHovered, setIsHovered] = React.useState(false);
    const sizeClass = size === 'tiny' ? 'w-[1.5vw] h-[1.5vw] text-[0.6vw]' : size === 'small' ? 'w-[2vw] h-[2vw] text-[0.8vw]' : 'w-[2.5vw] h-[2.5vw] text-[1vw]';
    const stackSizeClass = size === 'tiny' ? 'text-[0.4vw] min-w-[0.6vw] h-[0.6vw]' : size === 'small' ? 'text-[0.5vw] min-w-[0.8vw] h-[0.8vw]' : 'text-[0.6vw] min-w-[1vw] h-[1vw]';

    const isClickable = clickable && onClick;

    return (
        <div
            className={`relative group ${isClickable ? 'cursor-pointer' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={isClickable ? onClick : undefined}
            data-testid={dataTestId}
            data-status-id={effectId}
            data-status-stacks={stacks}
        >
            <div
                className={`
                    ${sizeClass} rounded-full flex items-center justify-center overflow-hidden
                    ${hasSprite
                        ? 'bg-transparent border-0 shadow-none'
                        : `bg-gradient-to-br ${info.color ?? 'from-gray-500 to-gray-600'} shadow-lg border border-white/30`}
                    transition-transform duration-200 hover:scale-110 ${isClickable ? 'cursor-pointer' : 'cursor-help'}
                    ${isClickable ? 'ring-2 ring-amber-400/50 hover:ring-amber-400 animate-pulse' : ''}
                `}
            >
                {getStatusEffectIconNode(info, locale, size, atlas)}
            </div>
            {stacks > 1 && (
                <div className={`absolute -bottom-[0.2vw] -right-[0.2vw] ${stackSizeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center border border-white/50`}>
                    {stacks}
                </div>
            )}

            <InfoTooltip
                title={`${info.name}${stacks > 1 ? ` ×${stacks}` : ''}`}
                content={isClickable ? [...info.description, t(`statusEffects.${STATUS_IDS.KNOCKDOWN}.clickToRemove`)] : info.description}
                isVisible={isHovered}
                position="right"
            />
        </div>
    );
};

const getContainerStyle = (maxPerRow: number, size: 'normal' | 'small' | 'tiny') => {
    const itemWidth = size === 'tiny' ? 1.5 : size === 'small' ? 2 : 2.5;
    const gap = 0.3;
    const maxWidth = maxPerRow * itemWidth + (maxPerRow - 1) * gap;
    return { maxWidth: `${maxWidth}vw` };
};

const clickableTokenHaloStyle: CSSProperties = {
    border: '2px solid rgba(253, 230, 138, 0.84)',
    background: 'conic-gradient(from 180deg, rgba(251, 191, 36, 0.18), rgba(253, 224, 71, 0.96), rgba(96, 165, 250, 0.30), rgba(253, 224, 71, 0.96), rgba(251, 191, 36, 0.18))',
    boxShadow: '0 0 14px rgba(251, 191, 36, 0.55), 0 0 24px rgba(96, 165, 250, 0.22)',
    padding: '2px',
    transform: 'translate(-50%, -50%)',
    WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
    animation: 'dicethrone-token-available-breathe 1.9s ease-in-out infinite',
};

const clickableTokenBodyStyle: CSSProperties = {
    filter: 'brightness(1.10) saturate(1.22) drop-shadow(0 0 7px rgba(253, 224, 71, 0.72)) drop-shadow(0 0 3px rgba(96, 165, 250, 0.40))',
};

export const StatusEffectsContainer = ({
    effects,
    maxPerRow = 3,
    size = 'normal',
    className = '',
    locale,
    atlas,
    onEffectClick,
    clickableEffects,
    testIdPrefix,
}: {
    effects: Record<string, number>;
    maxPerRow?: number;
    size?: 'normal' | 'small' | 'tiny';
    className?: string;
    locale?: string;
    atlas?: StatusAtlases | null;
    /** 点击状态效果的回调 */
    onEffectClick?: (effectId: string) => void;
    /** 可点击的状态效果 ID 列表 */
    clickableEffects?: string[];
    /** E2E 可见性断言前缀，例如 dt-player-0-status */
    testIdPrefix?: string;
}) => {
    const activeEffects = Object.entries(effects).filter(([, stacks]) => stacks > 0);
    if (activeEffects.length === 0) return null;

    return (
        <div
            className={`flex flex-wrap gap-[0.3vw] ${className}`}
            style={getContainerStyle(maxPerRow, size)}
        >
            {activeEffects.map(([effectId, stacks]) => {
                const isClickable = clickableEffects?.includes(effectId) ?? false;
                return (
                    <StatusEffectBadge
                        key={effectId}
                        effectId={effectId}
                        stacks={stacks}
                        size={size}
                        locale={locale}
                        atlas={atlas}
                        onClick={isClickable ? () => onEffectClick?.(effectId) : undefined}
                        clickable={isClickable}
                        dataTestId={testIdPrefix ? `${testIdPrefix}-${effectId}` : undefined}
                    />
                );
            })}
        </div>
    );
};

/** Token 徽章组件 */
export const TokenBadge = ({
    tokenId,
    amount,
    maxAmount,
    size = 'normal',
    locale,
    atlas,
    onClick,
    clickable = false,
    suppressTooltip = false,
    dataTestId,
}: {
    tokenId: string;
    amount: number;
    /** 堆叠上限（>1 时显示 数量/上限） */
    maxAmount?: number;
    size?: 'normal' | 'small' | 'tiny';
    locale?: string;
    atlas?: StatusAtlases | null;
    onClick?: () => void;
    clickable?: boolean;
    /** 需要持续露出临近操作条时，避免 hover 说明遮住该操作。 */
    suppressTooltip?: boolean;
    dataTestId?: string;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const meta = getVisualMetaById(tokenId) || { color: 'from-gray-500 to-gray-600' };

    let hasSprite = false;
    if (atlas && meta.frameId) {
        if (meta.atlasId && atlas[meta.atlasId]) {
            hasSprite = Boolean(atlas[meta.atlasId].frames[meta.frameId]);
        } else {
            hasSprite = Object.values(atlas).some(config => Boolean(config.frames[meta.frameId!]));
        }
    }
    const hasIcon = hasSprite || Boolean(meta.iconPath);
    const shouldShowShimmer = !hasIcon;
    const description = resolveI18nList(
        t(`tokens.${tokenId}.description`, { returnObjects: true })
    );
    const info = {
        ...meta,
        name: t(`tokens.${tokenId}.name`) as string,
        description,
    };
    const [isHovered, setIsHovered] = React.useState(false);
    const sizeClass = size === 'tiny' ? 'w-[1.5vw] h-[1.5vw] text-[0.6vw]' : size === 'small' ? 'w-[2vw] h-[2vw] text-[0.8vw]' : 'w-[2.5vw] h-[2.5vw] text-[1vw]';
    const stackSizeClass = size === 'tiny' ? 'text-[0.4vw] min-w-[0.6vw] h-[0.6vw]' : size === 'small' ? 'text-[0.5vw] min-w-[0.8vw] h-[0.8vw]' : 'text-[0.6vw] min-w-[1vw] h-[1vw]';

    const isClickable = clickable && onClick;

    return (
        <div
            className={`relative group ${isClickable ? 'cursor-pointer' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={isClickable ? onClick : undefined}
            data-testid={dataTestId}
            data-token-id={tokenId}
            data-token-amount={amount}
            data-token-max={maxAmount}
            data-token-clickable={isClickable ? 'true' : 'false'}
        >
            {isClickable && (
                <div
                    aria-hidden="true"
                    data-dicethrone-token-halo="available"
                    data-testid={dataTestId ? `${dataTestId}-available-halo` : undefined}
                    className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[calc(100%+0.52vw)] w-[calc(100%+0.52vw)] rounded-full"
                    style={clickableTokenHaloStyle}
                />
            )}
            {isClickable && (
                <button
                    type="button"
                    aria-label={info.name}
                    data-testid={dataTestId ? `${dataTestId}-hit-target` : undefined}
                    className="absolute left-1/2 top-1/2 z-20 min-h-[50px] min-w-[50px] -translate-x-1/2 -translate-y-1/2 rounded-full border-0 bg-transparent p-0 opacity-0"
                    onClick={(event) => {
                        event.stopPropagation();
                        onClick?.();
                    }}
                />
            )}
            <div
                data-dicethrone-token-body={isClickable ? 'available' : undefined}
                data-testid={dataTestId && isClickable ? `${dataTestId}-available-body` : undefined}
                style={isClickable ? clickableTokenBodyStyle : undefined}
                className={`
                    ${sizeClass} rounded-full flex items-center justify-center overflow-hidden
                    ${shouldShowShimmer ? 'atlas-shimmer' : ''}
                    ${hasSprite
                        ? 'bg-transparent border-0 shadow-none'
                        : `bg-gradient-to-br ${info.color ?? 'from-gray-500 to-gray-600'} shadow-lg border border-white/30`}
                    transition-transform duration-200 hover:scale-110 ${isClickable ? 'cursor-pointer pointer-events-none' : 'cursor-help'}
                    ${isClickable ? 'relative z-10 saturate-110' : ''}
                `}
            >
                {getStatusEffectIconNode(info, locale, size, atlas)}
            </div>
            {/* 有上限(>1)时始终显示 数量/上限；否则仅 amount>1 时显示数量 */}
            {(maxAmount != null && maxAmount > 1) ? (
                <div className={`absolute -bottom-[0.2vw] -right-[0.2vw] ${stackSizeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center border border-white/50 px-[0.15vw]`}>
                    {amount}/{maxAmount}
                </div>
            ) : amount > 1 ? (
                <div className={`absolute -bottom-[0.2vw] -right-[0.2vw] ${stackSizeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center border border-white/50`}>
                    {amount}
                </div>
            ) : null}

            {!suppressTooltip && (
                <InfoTooltip
                    title={`${info.name}${maxAmount != null && maxAmount > 1 ? ` ${amount}/${maxAmount}` : amount > 1 ? ` ×${amount}` : ''}`}
                    content={info.description}
                    isVisible={isHovered}
                    position="right"
                />
            )}
        </div>
    );
};

/** Token 容器组件 */
export const TokensContainer = ({
    tokens,
    maxPerRow = 3,
    size = 'normal',
    className = '',
    locale,
    atlas,
    onTokenClick,
    clickableTokens,
    tokenDefinitions,
    tokenStackLimits,
    suppressTooltips = false,
    testIdPrefix,
}: {
    tokens: Record<string, number>;
    maxPerRow?: number;
    size?: 'normal' | 'small' | 'tiny';
    className?: string;
    locale?: string;
    atlas?: StatusAtlases | null;
    /** 点击 Token 的回调 */
    onTokenClick?: (tokenId: string) => void;
    /** 可点击的 Token ID 列表 */
    clickableTokens?: string[];
    /** Token 定义列表（用于获取 stackLimit） */
    tokenDefinitions?: TokenDef[];
    /** 玩家级别的堆叠上限覆盖（技能可永久提高上限） */
    tokenStackLimits?: Record<string, number>;
    /** 当前临近操作条需要保持可读时，收起 Token 的 hover 说明。 */
    suppressTooltips?: boolean;
    /** E2E 可见性断言前缀，例如 dt-player-0-token */
    testIdPrefix?: string;
}) => {
    const activeTokens = Object.entries(tokens).filter(([, amount]) => amount > 0);
    if (activeTokens.length === 0) return null;

    /** 获取某个 token 的有效上限（玩家覆盖 > 定义 > 不显示） */
    const getEffectiveMax = (tokenId: string): number | undefined => {
        // 玩家级别覆盖优先
        const override = tokenStackLimits?.[tokenId];
        if (typeof override === 'number') {
            return override === 0 ? undefined : override; // 0 = 无限，不显示上限
        }
        const def = tokenDefinitions?.find(d => d.id === tokenId);
        const base = def?.stackLimit;
        if (base == null || base <= 1 || base === 0) return undefined; // 无限或上限1，不显示
        return base;
    };

    return (
        <div
            className={`flex flex-wrap gap-[0.3vw] ${className}`}
            style={getContainerStyle(maxPerRow, size)}
        >
            {activeTokens.map(([tokenId, amount]) => {
                const isClickable = clickableTokens?.includes(tokenId) ?? false;
                return (
                    <TokenBadge
                        key={tokenId}
                        tokenId={tokenId}
                        amount={amount}
                        maxAmount={getEffectiveMax(tokenId)}
                        size={size}
                        locale={locale}
                        atlas={atlas}
                        onClick={isClickable ? () => onTokenClick?.(tokenId) : undefined}
                        clickable={isClickable}
                        suppressTooltip={suppressTooltips}
                        dataTestId={testIdPrefix ? `${testIdPrefix}-${tokenId}` : undefined}
                    />
                );
            })}
        </div>
    );
};

// ============================================================================
// 可选择的状态效果组件（用于卡牌交互）
// ============================================================================

/** 可选择的状态效果徽章 */
export const SelectableStatusBadge = ({
    effectId,
    stacks,
    isSelected,
    isHighlighted,
    onSelect,
    dataTestId,
    size = 'normal',
    locale,
    atlas,
}: {
    effectId: string;
    stacks: number;
    isSelected?: boolean;
    isHighlighted?: boolean;
    onSelect?: () => void;
    dataTestId?: string;
    size?: 'normal' | 'small';
    locale?: string;
    atlas?: StatusAtlases | null;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const meta = STATUS_EFFECT_META[effectId] || TOKEN_META[effectId] || { color: 'from-gray-500 to-gray-600' };
    const isToken = !STATUS_EFFECT_META[effectId] && Boolean(TOKEN_META[effectId]);
    const i18nPrefix = isToken ? 'tokens' : 'statusEffects';

    let hasSprite = false;
    if (atlas && meta.frameId) {
        if (meta.atlasId && atlas[meta.atlasId]) {
            hasSprite = Boolean(atlas[meta.atlasId].frames[meta.frameId]);
        } else {
            hasSprite = Object.values(atlas).some(config => Boolean(config.frames[meta.frameId!]));
        }
    }
    const descriptionKey = `${i18nPrefix}.${effectId}.description`;
    const nameKey = `${i18nPrefix}.${effectId}.name`;
    const description = resolveI18nList(
        t(descriptionKey, { returnObjects: true, defaultValue: [] })
    );
    const info = {
        ...meta,
        name: t(nameKey, { defaultValue: effectId }) as string,
        description,
    };
    const [isHovered, setIsHovered] = React.useState(false);
    const sizeClass = size === 'small' ? 'w-[2vw] h-[2vw] text-[0.8vw]' : 'w-[2.5vw] h-[2.5vw] text-[1vw]';
    const stackSizeClass = size === 'small' ? 'text-[0.5vw] min-w-[0.8vw] h-[0.8vw]' : 'text-[0.6vw] min-w-[1vw] h-[1vw]';

    const clickable = Boolean(onSelect);

    return (
        <div
            data-testid={dataTestId}
            className={`relative group ${clickable ? 'cursor-pointer' : ''
                }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => clickable && onSelect?.()}
        >
            <div
                className={`
                    ${sizeClass} rounded-full flex items-center justify-center overflow-hidden
                    ${hasSprite
                        ? 'bg-transparent border-0 shadow-none'
                        : `bg-gradient-to-br ${info.color ?? 'from-gray-500 to-gray-600'} shadow-lg border border-white/30`}
                    transition-all duration-200
                    ${clickable ? 'hover:scale-110' : ''}
                    ${isHighlighted ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900' : ''}
                    ${isSelected ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-slate-900 scale-110' : ''}
                `}
            >
                {getStatusEffectIconNode(info, locale, size === 'small' ? 'small' : 'normal', atlas)}
            </div>
            {stacks > 1 && (
                <div className={`absolute -bottom-[0.2vw] -right-[0.2vw] ${stackSizeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center border border-white/50`}>
                    {stacks}
                </div>
            )}
            {isSelected && (
                <div className="absolute -top-[0.3vw] -right-[0.3vw] w-[1vw] h-[1vw] bg-green-500 rounded-full flex items-center justify-center z-30">
                    <Check size={12} className="text-white" strokeWidth={3} />
                </div>
            )}
            <InfoTooltip
                title={`${info.name}${stacks > 1 ? ` ×${stacks}` : ''}`}
                content={info.description}
                isVisible={isHovered}
                position="right"
            />
        </div>
    );
};

/** 可选择的状态效果容器 */
export const SelectableEffectsContainer = ({
    effects,
    tokens,
    selectedId,
    highlightAll,
    onSelectEffect,
    getItemTestId,
    maxPerRow = 3,
    size = 'normal',
    className = '',
    locale,
    atlas,
}: {
    effects: Record<string, number>;
    tokens?: Record<string, number>;
    selectedId?: string;
    highlightAll?: boolean;
    onSelectEffect?: (effectId: string) => void;
    getItemTestId?: (effectId: string) => string | undefined;
    maxPerRow?: number;
    size?: 'normal' | 'small';
    className?: string;
    locale?: string;
    atlas?: StatusAtlases | null;
}) => {
    const activeEffects = Object.entries(effects).filter(([, stacks]) => stacks > 0);
    const activeTokens = tokens ? Object.entries(tokens).filter(([, amount]) => amount > 0) : [];
    const allItems = [...activeEffects, ...activeTokens];

    if (allItems.length === 0) return null;

    return (
        <div className={`flex flex-wrap gap-[0.3vw] ${className}`} style={{ maxWidth: `${maxPerRow * 3}vw` }}>
            {allItems.map(([id, stacks]) => (
                <SelectableStatusBadge
                    key={id}
                    effectId={id}
                    stacks={stacks}
                    isSelected={selectedId === id}
                    isHighlighted={highlightAll}
                    onSelect={() => onSelectEffect?.(id)}
                    dataTestId={getItemTestId?.(id)}
                    size={size}
                    locale={locale}
                    atlas={atlas}
                />
            ))}
        </div>
    );
};
