import { useState, useEffect, useMemo, useReducer, useRef, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
    getLocalizedImageCandidateUrls,
    getPreloadedImageElement,
    markImageLoaded,
    onImageReady,
    type CardPreviewRef,
} from '../../../core';
import { getOptimizedImageUrls, getLocalizedAssetPath } from '../../../core/AssetLoader';
import { OptimizedImage } from './OptimizedImage';
import { type SpriteAtlasConfig, computeSpriteStyle } from '../../../engine/primitives/spriteAtlas';
import {
    registerCardAtlasSource,
    getCardAtlasSource,
    getLazyRegistration,
    type CardAtlasSource as RegistryCardAtlasSource,
} from './cardAtlasRegistry';

export type CardPreviewRenderer = (args: {
    previewRef: CardPreviewRef;
    locale?: string;
    className?: string;
    style?: CSSProperties;
}) => ReactNode;

export type CardSvgRenderer = (props?: Record<string, string | number>) => ReactNode;

// 向后兼容类型别名（游戏层可能直接引用）
export type CardAtlasConfig = SpriteAtlasConfig;
export type CardAtlasSource = RegistryCardAtlasSource;

const isFrameAtlasConfig = (atlas: SpriteAtlasConfig): atlas is { frames: { x: number; y: number; width: number; height: number }[] } =>
    'frames' in atlas;

const scaleAtlasConfig = (
    atlas: SpriteAtlasConfig,
    imageW: number,
    imageH: number,
): SpriteAtlasConfig => {
    if (imageW <= 0 || imageH <= 0) return atlas;
    if (atlas.imageW === imageW && atlas.imageH === imageH) return atlas;

    const scaleX = imageW / atlas.imageW;
    const scaleY = imageH / atlas.imageH;

    if (isFrameAtlasConfig(atlas)) {
        return {
            ...atlas,
            imageW,
            imageH,
            frames: atlas.frames.map((frame) => ({
                x: frame.x * scaleX,
                y: frame.y * scaleY,
                width: frame.width * scaleX,
                height: frame.height * scaleY,
            })),
        };
    }

    return {
        ...atlas,
        imageW,
        imageH,
        colStarts: atlas.colStarts.map((value) => value * scaleX),
        colWidths: atlas.colWidths.map((value) => value * scaleX),
        rowStarts: atlas.rowStarts.map((value) => value * scaleY),
        rowHeights: atlas.rowHeights.map((value) => value * scaleY),
    };
};

const previewRendererRegistry = new Map<string, CardPreviewRenderer>();
const svgRendererRegistry = new Map<string, CardSvgRenderer>();

export function registerCardPreviewRenderer(id: string, renderer: CardPreviewRenderer): void {
    previewRendererRegistry.set(id, renderer);
}

export function registerCardSvgRenderer(id: string, renderer: CardSvgRenderer): void {
    svgRendererRegistry.set(id, renderer);
}

export { registerCardAtlasSource, getCardAtlasSource };

export function getCardPreviewRenderer(id: string): CardPreviewRenderer | undefined {
    return previewRendererRegistry.get(id);
}

export function getCardSvgRenderer(id: string): CardSvgRenderer | undefined {
    return svgRendererRegistry.get(id);
}

/** 计算图集帧的 CSS 裁切样式（委托到引擎层） */
export function getCardAtlasStyle(index: number, atlas: CardAtlasConfig): CSSProperties {
    return computeSpriteStyle(index, atlas);
}

export type CardPreviewProps = {
    previewRef?: CardPreviewRef | null;
    locale?: string; // 可选，不传则自动从 i18next 获取当前语言
    className?: string;
    style?: CSSProperties;
    alt?: string;
    title?: string;
};

const MIN_VALID_ATLAS_DIMENSION_PX = 16;
const LOCAL_ATLAS_CANDIDATE_TIMEOUT_MS = 3000;
const REMOTE_ATLAS_CANDIDATE_TIMEOUT_MS = 8000;
const ATLAS_AUTO_RETRY_MAX = 5;
const ATLAS_AUTO_RETRY_BASE_MS = 2000;
const ATLAS_AUTO_RETRY_MAX_MS = 30000;

const hasUsableAtlasImage = (img: HTMLImageElement | null | undefined): img is HTMLImageElement =>
    Boolean(img) && img.naturalWidth >= MIN_VALID_ATLAS_DIMENSION_PX && img.naturalHeight >= MIN_VALID_ATLAS_DIMENSION_PX;

const normalizeComparableUrl = (url: string): string => {
    if (!url) return '';
    if (typeof window === 'undefined') return url;
    try {
        return new URL(url, window.location.href).href;
    } catch {
        return url;
    }
};

const matchLoadedAtlasCandidateUrl = (
    img: HTMLImageElement | null | undefined,
    candidateUrls: string[],
): string => {
    if (!hasUsableAtlasImage(img)) return '';

    const normalizedCandidates = candidateUrls.map((candidateUrl) => ({
        candidateUrl,
        normalized: normalizeComparableUrl(candidateUrl),
    }));

    for (const src of [img.currentSrc, img.src]) {
        const normalizedSrc = normalizeComparableUrl(src);
        if (!normalizedSrc) continue;
        const matchedCandidate = normalizedCandidates.find((candidate) => candidate.normalized === normalizedSrc);
        if (matchedCandidate) {
            return matchedCandidate.candidateUrl;
        }
    }

    return '';
};

const resolveLoadedAtlasCandidateUrl = (
    candidateUrls: string[],
    sourceImage?: string,
    locale?: string,
): string => {
    for (const candidateUrl of candidateUrls) {
        const matchedCandidate = matchLoadedAtlasCandidateUrl(getPreloadedImageElement(candidateUrl), candidateUrls);
        if (matchedCandidate) {
            return matchedCandidate;
        }
    }

    if (sourceImage) {
        return matchLoadedAtlasCandidateUrl(getPreloadedImageElement(sourceImage, locale), candidateUrls);
    }

    return '';
};

const getAtlasCandidateTimeoutMs = (url: string): number => (
    /^https?:\/\//i.test(url) ? REMOTE_ATLAS_CANDIDATE_TIMEOUT_MS : LOCAL_ATLAS_CANDIDATE_TIMEOUT_MS
);

const getAtlasRetryDelay = (attempt: number): number => {
    const base = Math.min(ATLAS_AUTO_RETRY_BASE_MS * 2 ** attempt, ATLAS_AUTO_RETRY_MAX_MS);
    const jitter = base * (0.75 + Math.random() * 0.5);
    return Math.round(jitter);
};

type AtlasCandidateLoaderOptions = {
    candidateUrls: string[];
    isCancelled: () => boolean;
    isStale: () => boolean;
    onSuccess: (url: string, img: HTMLImageElement) => void;
    onExhausted: () => void;
};

function loadAtlasCandidateUrls({
    candidateUrls,
    isCancelled,
    isStale,
    onSuccess,
    onExhausted,
}: AtlasCandidateLoaderOptions): () => void {
    let disposed = false;
    let resolved = false;
    const timerIds = new Set<number>();

    const clearTimers = () => {
        timerIds.forEach((timerId) => window.clearTimeout(timerId));
        timerIds.clear();
    };

    const shouldIgnore = () => disposed || resolved || isCancelled() || isStale();

    const resolveSuccess = (url: string, img: HTMLImageElement) => {
        if (shouldIgnore()) return;
        if (!hasUsableAtlasImage(img)) return;
        resolved = true;
        clearTimers();
        onSuccess(url, img);
    };

    const tryLoad = (index: number) => {
        if (shouldIgnore()) return;
        if (index >= candidateUrls.length) {
            clearTimers();
            onExhausted();
            return;
        }

        const url = candidateUrls[index];
        const img = new Image();
        let advanced = false;

        const advance = () => {
            if (advanced || shouldIgnore()) return;
            advanced = true;
            tryLoad(index + 1);
        };

        const timeoutId = window.setTimeout(() => {
            timerIds.delete(timeoutId);
            advance();
        }, getAtlasCandidateTimeoutMs(url));
        timerIds.add(timeoutId);

        img.onload = () => {
            if (shouldIgnore()) return;
            if (timerIds.has(timeoutId)) {
                window.clearTimeout(timeoutId);
                timerIds.delete(timeoutId);
            }
            if (!hasUsableAtlasImage(img)) {
                advance();
                return;
            }
            resolveSuccess(url, img);
        };

        img.onerror = () => {
            if (shouldIgnore()) return;
            if (timerIds.has(timeoutId)) {
                window.clearTimeout(timeoutId);
                timerIds.delete(timeoutId);
            }
            advance();
        };

        img.src = url;
    };

    tryLoad(0);

    return () => {
        disposed = true;
        clearTimers();
    };
}

export function getCardAtlasCandidateUrls(image: string, locale: string): string[] {
    return getLocalizedImageCandidateUrls(image, locale);
}

export function CardPreview({
    previewRef,
    locale,
    className,
    style,
    alt = 'Card Preview',
    title,
}: CardPreviewProps): ReactNode {
    const { i18n } = useTranslation();
    
    if (!previewRef) return null;
    const effectiveLocale = locale || i18n.language || 'zh-CN';

    if (previewRef.type === 'image') {
        return (
            <OptimizedImage
                src={previewRef.src}
                locale={effectiveLocale}
                className={className}
                style={style}
                alt={alt}
                title={title}
            />
        );
    }

    if (previewRef.type === 'atlas') {
        return (
            <AtlasCard
                atlasId={previewRef.atlasId}
                index={previewRef.index}
                locale={effectiveLocale}
                className={className}
                style={style}
                title={title}
            />
        );
    }

    if (previewRef.type === 'svg') {
        const renderer = getCardSvgRenderer(previewRef.svgId);
        if (!renderer) return null;
        return (
            <span className={className} style={style} title={title}>
                {renderer(previewRef.props)}
            </span>
        );
    }

    const renderer = getCardPreviewRenderer(previewRef.rendererId);
    if (!renderer) return null;
    return renderer({ previewRef, locale: effectiveLocale, className, style });
}

// ============================================================================
// Atlas 精灵图卡牌（带 shimmer 占位）
// ============================================================================

interface AtlasCardProps {
    atlasId: string;
    index: number;
    locale?: string;
    className?: string;
    style?: CSSProperties;
    title?: string;
}

function AtlasCard({ atlasId, index, locale, className, style, title }: AtlasCardProps) {
    const { i18n } = useTranslation();
    const effectiveLocale = locale || i18n.language || 'zh-CN';
    const [sourceVersion, bumpSourceVersion] = useReducer((n: number) => n + 1, 0);
    const [retryVersion, bumpRetryVersion] = useReducer((n: number) => n + 1, 0);
    const source = useMemo(
        () => {
            void sourceVersion;
            void retryVersion;
            return getCardAtlasSource(atlasId, effectiveLocale);
        },
        [atlasId, effectiveLocale, retryVersion, sourceVersion],
    );
    const checkUrls = useMemo(
        () => (source ? getCardAtlasCandidateUrls(source.image, effectiveLocale) : []),
        [effectiveLocale, source],
    );

    const checkKey = checkUrls.join('|');
    const loadedCandidateUrl = useMemo(
        () => (source ? resolveLoadedAtlasCandidateUrl(checkUrls, source.image, effectiveLocale) : ''),
        [checkUrls, effectiveLocale, source],
    );
    const derivedActiveUrl = loadedCandidateUrl || checkUrls[0] || '';
    const derivedLoaded = Boolean(loadedCandidateUrl) || checkUrls.length === 0;
    const [loadState, setLoadState] = useState(() => ({
        checkKey,
        activeUrl: derivedActiveUrl,
        loaded: derivedLoaded,
    }));
    const { activeUrl, loaded } = loadState.checkKey === checkKey
        ? loadState
        : {
            checkKey,
            activeUrl: derivedActiveUrl,
            loaded: derivedLoaded,
        };
    const loadAttemptRef = useRef(0);
    const retryAttemptRef = useRef(0);
    const retryTimerRef = useRef<number | null>(null);

    const clearRetryTimer = () => {
        if (retryTimerRef.current != null) {
            window.clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    };

    const scheduleAtlasRetry = useMemo(
        () => (reason: string) => {
            if (retryAttemptRef.current >= ATLAS_AUTO_RETRY_MAX) {
                console.error(`[CardPreview] 图集加载失败且已达最大重试次数，停止自动重试: ${atlasId} (${reason})`);
                return;
            }
            const attempt = retryAttemptRef.current;
            retryAttemptRef.current = attempt + 1;
            const delay = getAtlasRetryDelay(attempt);
            clearRetryTimer();
            retryTimerRef.current = window.setTimeout(() => {
                retryTimerRef.current = null;
                bumpRetryVersion();
            }, delay);
            console.warn(`[CardPreview] 图集候选已耗尽，${delay}ms 后自动重试（第 ${attempt + 1}/${ATLAS_AUTO_RETRY_MAX} 轮）: ${atlasId} (${reason})`);
        },
        [atlasId],
    );

    // 只有真实加载完成（loaded）或预加载缓存已命中（preloaded）时，才允许移除 shimmer。
    // 不能仅因为 activeUrl 已解析出来就视为已加载：
    // activeUrl 只代表“选中了候选 URL”，不代表图片请求/解码已经完成。
    // 否则会出现 atlas 在真实像素尚未就绪时就提前暴露，导致“早截空、晚截有图”。
    const effectiveLoaded = loaded || Boolean(loadedCandidateUrl);

    useEffect(() => {
        retryAttemptRef.current = 0;
        clearRetryTimer();
        return () => {
            clearRetryTimer();
        };
    }, [atlasId, checkKey, effectiveLocale]);

    // 订阅后台加载完成通知：CriticalImageGate 超时放行后，
    // 精灵图在后台继续加载，完成时触发重渲染消除 shimmer
    const [, bumpTick] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
        if (!source) return;
        const localizedPath = getLocalizedAssetPath(source.image, effectiveLocale);
        const { webp } = getOptimizedImageUrls(localizedPath);
        if (!webp) return;
        return onImageReady((url) => {
            if (url === webp || checkUrls.includes(url)) {
                if (!hasUsableAtlasImage(getPreloadedImageElement(url))) return;
                setLoadState((current) => {
                    if (current.checkKey !== checkKey) return current;
                    return { checkKey, activeUrl: url, loaded: true };
                });
                bumpTick();
            }
        });
    }, [checkKey, checkUrls, effectiveLocale, source]);

    useEffect(() => {
        // 如果已预加载，直接标记为已加载
        if (loadedCandidateUrl || checkUrls.length === 0) return;
        const currentAttempt = loadAttemptRef.current + 1;
        loadAttemptRef.current = currentAttempt;
        let cancelled = false;
        const markReady = (url?: string) => {
            if (!cancelled && loadAttemptRef.current === currentAttempt) {
                retryAttemptRef.current = 0;
                clearRetryTimer();
                setLoadState((current) => {
                    if (current.checkKey !== checkKey) return current;
                    return {
                        checkKey,
                        activeUrl: url ?? current.activeUrl,
                        loaded: true,
                    };
                });
            }
        };
        const stopLoading = loadAtlasCandidateUrls({
            candidateUrls: checkUrls,
            isCancelled: () => cancelled,
            isStale: () => loadAttemptRef.current !== currentAttempt,
            onSuccess: (url, img) => {
                markImageLoaded(source.image, effectiveLocale, img);
                markImageLoaded(url, undefined, img);
                markReady(url);
            },
            onExhausted: () => {
                scheduleAtlasRetry(`atlas:${atlasId}`);
            },
        });

        return () => {
            cancelled = true;
            stopLoading();
        };
    }, [atlasId, checkKey, checkUrls, effectiveLocale, loadedCandidateUrl, retryVersion, scheduleAtlasRetry, source]);

    const atlasImage = useMemo(() => {
        if (!source) return null;
        return (activeUrl ? getPreloadedImageElement(activeUrl) : null)
            ?? getPreloadedImageElement(source.image, effectiveLocale);
    }, [activeUrl, effectiveLocale, source]);
    const atlasConfig = useMemo(
        () => (source
            ? scaleAtlasConfig(source.config, atlasImage?.naturalWidth ?? 0, atlasImage?.naturalHeight ?? 0)
            : null),
        [atlasImage?.naturalHeight, atlasImage?.naturalWidth, source],
    );

    // Fallback：source 为 undefined 时（CriticalImageGate 预加载超时/失败），
    // 自行加载图片获取尺寸，触发懒解析提升
    useEffect(() => {
        if (source) return; // 已有 source，无需 fallback
        const lazy = getLazyRegistration(atlasId);
        if (!lazy) return; // 非懒注册，无法 fallback

        let cancelled = false;
        const candidates = getCardAtlasCandidateUrls(lazy.image, effectiveLocale);
        const stopLoading = loadAtlasCandidateUrls({
            candidateUrls: candidates,
            isCancelled: () => cancelled,
            isStale: () => false,
            onSuccess: (url, img) => {
                retryAttemptRef.current = 0;
                clearRetryTimer();
                markImageLoaded(lazy.image, effectiveLocale, img);
                markImageLoaded(url, undefined, img);
                if (!cancelled) {
                    setLoadState((current) => ({
                        checkKey: current.checkKey,
                        activeUrl: url,
                        loaded: true,
                    }));
                    bumpSourceVersion();
                }
            },
            onExhausted: () => {
                scheduleAtlasRetry(`lazy-atlas:${atlasId}`);
            },
        });

        return () => {
            cancelled = true;
            stopLoading();
        };
    }, [source, atlasId, effectiveLocale, retryVersion, scheduleAtlasRetry]);

    if (!source) {
        // 显示 shimmer 占位而非 null，等待 fallback 加载完成
        const lazy = getLazyRegistration(atlasId);
        if (lazy) {
            return (
                <div
                    className={`atlas-shimmer ${className ?? ''}`}
                    title={title}
                    style={style}
                />
            );
        }
        return null;
    }

    const atlasStyle = computeSpriteStyle(index, atlasConfig ?? source.config);
    const backgroundImage = effectiveLoaded && activeUrl ? `url("${activeUrl}")` : '';

    return (
        <div
            className={`${effectiveLoaded ? '' : 'atlas-shimmer'} ${className ?? ''}`}
            title={title}
            style={{
                backgroundImage,
                backgroundRepeat: 'no-repeat',
                ...atlasStyle,
                ...style,
            }}
        />
    );
}
