import React from 'react';
import type { ImgHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import {
    getResolvedImageCacheUrl,
    getRuntimeImageCandidateUrls,
    isImagePreloaded,
    markImageCandidateFailed,
    markImageLoaded,
} from '../../../core/AssetLoader';

type OptimizedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
    /** 原始资源路径（相对于游戏目录，如 dicethrone/images/...） */
    src: string;
    fallbackSrc?: string;
    /** 语言代码，可选，不传则自动从 i18next 获取当前语言 */
    locale?: string;
    /** 是否显示加载占位 shimmer，默认 true */
    placeholder?: boolean;
};

const isSvgSource = (src: string) => /^data:image\/svg\+xml[;,]/i.test(src) || /\.svg(\?|#|$)/i.test(src);

/** 加载中 shimmer 背景样式（CSS background-position 动画，零额外 DOM） */
export const SHIMMER_BG: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.08)',
    backgroundImage: 'linear-gradient(100deg, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.08) 60%)',
    backgroundSize: '200% 100%',
    animation: 'img-shimmer 1.5s linear infinite',
};

/** 指数退避自动重试配置 */
const AUTO_RETRY_MAX = 5;           // 最多自动重试 5 轮
const AUTO_RETRY_BASE_MS = 2000;    // 首次 2s
const AUTO_RETRY_MAX_MS = 30000;    // 上限 30s
// Vite 开发 / E2E 在 Windows 上首次传大型本地图集可能超过 10 秒。
// 先等本地真实加载或报错收敛，再切到远端 CDN 候选；否则截图验收会
// 过早退到远端资源，出现牌面灰占位或 complete=false 的不稳定状态。
const LOCAL_CANDIDATE_TIMEOUT_MS = 20_000;
const REMOTE_CANDIDATE_TIMEOUT_MS = 8000;

/** 计算指数退避延迟（带 ±25% 抖动，避免多图同时重试雪崩） */
const getRetryDelay = (attempt: number) => {
    const base = Math.min(AUTO_RETRY_BASE_MS * 2 ** attempt, AUTO_RETRY_MAX_MS);
    const jitter = base * (0.75 + Math.random() * 0.5); // [0.75x, 1.25x]
    return Math.round(jitter);
};

/**
 * 判断 src 是否为真正的远端资源：
 * - /assets/... 与相对路径都视为本地资源链
 * - 指向当前页面同源 origin 的绝对 URL 也视为本地资源链
 * - 只有跨域 http/https 才按远端 CDN 处理
 */
const isRemoteUrl = (url: string) => {
    if (!/^https?:\/\//i.test(url)) return false;
    if (typeof window === 'undefined' || !window.location?.origin) return true;
    try {
        return new URL(url, window.location.href).origin !== window.location.origin;
    } catch {
        return true;
    }
};

const isPublicAssetsUrl = (url: string) => {
    if (url.startsWith('/assets/')) return true;
    if (typeof window === 'undefined' || !window.location?.origin) return false;
    try {
        const resolved = new URL(url, window.location.href);
        return resolved.origin === window.location.origin && resolved.pathname.startsWith('/assets/');
    } catch {
        return false;
    }
};

const shouldUseBlobFetchForLocalAsset = (url: string) => {
    if (!import.meta.env.DEV) return false;
    return isPublicAssetsUrl(url);
};

/** 为 URL 追加重试参数，绕过浏览器对失败请求的缓存 */
const appendRetryParam = (url: string, retry: number) => {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}retry=${retry}`;
};

const getCandidateTimeoutMs = (url: string) => (
    isRemoteUrl(url) ? REMOTE_CANDIDATE_TIMEOUT_MS : LOCAL_CANDIDATE_TIMEOUT_MS
);

export const OptimizedImage = ({
    src,
    fallbackSrc: _fallbackSrc,
    locale,
    alt,
    onError,
    onLoad: onLoadProp,
    onDragStart,
    style: styleProp,
    placeholder = true,
    className,
    draggable = false,
    ...rest
}: OptimizedImageProps) => {
    const { i18n } = useTranslation();
    const effectiveLocale = locale || i18n.language || 'zh-CN';
    const [fallbackLevel, setFallbackLevel] = React.useState(0);
    const preloaded = isImagePreloaded(src, effectiveLocale);
    const [loaded, setLoaded] = React.useState(() => preloaded);
    const [errored, setErrored] = React.useState(false);
    const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
    const [localFetchDebug, setLocalFetchDebug] = React.useState('idle');
    const imgRef = React.useRef<HTMLImageElement>(null);
    /** 自动重试轮次（所有回退用尽后从 0 开始计数） */
    const autoRetryRef = React.useRef(0);
    const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    /** 重置回退链，从 CDN 首选路径重新开始 */
    const resetFallbackChain = React.useCallback(() => {
        retryTimerRef.current = null;
        setFallbackLevel(0);
        setErrored(false);
        setLoaded(false);
    }, []);

    const candidateUrls = React.useMemo(() => {
        return getRuntimeImageCandidateUrls(src, effectiveLocale);
    }, [src, effectiveLocale]);

    const fallbackCandidates = React.useMemo(() => {
        const candidates: Array<{ url: string; label: string }> = [];
        const pushCandidate = (url: string, label: string) => {
            if (!url) return;
            if (candidates.some(candidate => candidate.url === url)) return;
            candidates.push({ url, label });
        };

        candidateUrls.forEach((url, index) => {
            if (index === 0) {
                pushCandidate(url, 'primary');
                return;
            }

            if (isRemoteUrl(url)) {
                pushCandidate(url, 'remote-fallback');
                return;
            }

            if (index === 1) {
                pushCandidate(url, 'language-fallback');
                return;
            }

            pushCandidate(url, isPublicAssetsUrl(url) ? 'public-fallback' : 'native-fallback');
        });

        const primaryUrl = candidateUrls[0] ?? '';
        if (primaryUrl && isRemoteUrl(primaryUrl)) {
            pushCandidate(appendRetryParam(primaryUrl, 1), 'retry');
        }

        return candidates;
    }, [candidateUrls]);

    const currentCandidate = fallbackCandidates[Math.min(fallbackLevel, Math.max(fallbackCandidates.length - 1, 0))];
    const defaultCurrentSrc = currentCandidate?.url ?? candidateUrls[0] ?? '';
    const restoredLoadedSrc = React.useMemo(
        () => getResolvedImageCacheUrl(src, effectiveLocale),
        [src, effectiveLocale],
    );
    const currentSrc = restoredLoadedSrc || defaultCurrentSrc;
    const isLocalFallback = currentCandidate != null
        && currentCandidate.label !== 'primary'
        && !isRemoteUrl(currentCandidate.url);
    const isLocalPrimary = !isRemoteUrl(currentSrc);
    const renderedSrc = objectUrl ?? currentSrc;
    const hasRestoredLoadedSrc = Boolean(restoredLoadedSrc);

    const isSvg = isSvgSource(renderedSrc);
    const rememberEarlierCandidateFailures = React.useCallback((successfulUrl: string) => {
        const successfulIndex = candidateUrls.indexOf(successfulUrl);
        if (successfulIndex <= 0) return;
        candidateUrls
            .slice(0, successfulIndex)
            .forEach((candidateUrl) => markImageCandidateFailed(src, effectiveLocale, candidateUrl));
    }, [candidateUrls, effectiveLocale, src]);
    
    // 同步修正：如果 loaded 为 false 但缓存已就绪，立即同步为 true，
    // 避免 useLayoutEffect 异步更新导致的一帧 shimmer 闪烁
    const effectiveLoaded = loaded || preloaded;

    // 只有逻辑资源或语言切换时才完全重置。
    // 不能把 currentSrc（候选 URL 切换）放进依赖里，否则切到 fallback 后会立刻
    // 把 fallbackLevel 清回 0，重新回到已失败的 primary，形成无限重试环。
    React.useLayoutEffect(() => {
        setFallbackLevel(0);
        setErrored(false);
        autoRetryRef.current = 0;
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
        if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
            setLoaded(true);
        } else if (isImagePreloaded(src, effectiveLocale)) {
            setLoaded(true);
        } else {
            setLoaded(false);
        }
    }, [src, effectiveLocale]);

    // currentSrc 变化时（fallbackLevel 切换导致）检查新 URL 是否已缓存
    const prevSrcRef = React.useRef(currentSrc);
    React.useLayoutEffect(() => {
        if (prevSrcRef.current !== currentSrc) {
            prevSrcRef.current = currentSrc;
            setObjectUrl(null);
            setLocalFetchDebug('idle');
            if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
                setLoaded(true);
            } else if (isImagePreloaded(src, effectiveLocale)) {
                setLoaded(true);
            } else {
                setLoaded(false);
            }
            setErrored(false);
        }
    }, [currentSrc, src, effectiveLocale]);

    // 仅在开发态 public /assets/... 链路下，才走 fetch -> blob workaround。
    // Android 游戏包会落到 /_capacitor_file_/...；这里若继续 fetch，会把已安装的本地包
    // 也套进开发兜底链路，导致图片长时间停在加载态。
    React.useEffect(() => {
        if (!isLocalPrimary || isSvg || hasRestoredLoadedSrc) return undefined;
        if (!shouldUseBlobFetchForLocalAsset(currentSrc)) {
            setLocalFetchDebug(isPublicAssetsUrl(currentSrc) ? 'direct' : 'direct-native');
            return undefined;
        }
        let cancelled = false;
        let nextObjectUrl: string | null = null;
        setLocalFetchDebug('fetching');

        void (async () => {
            try {
                const response = await fetch(currentSrc, { credentials: 'same-origin' });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const blob = await response.blob();
                if (cancelled) return;
                setLoaded(false);
                nextObjectUrl = URL.createObjectURL(blob);
                setObjectUrl(nextObjectUrl);
                setLocalFetchDebug('blob-ready');
            } catch (error) {
                if (!cancelled) {
                    setObjectUrl(null);
                    setLocalFetchDebug(`fetch-error:${error instanceof Error ? error.message : 'unknown'}`);
                }
            }
        })();

        return () => {
            cancelled = true;
            if (nextObjectUrl) {
                URL.revokeObjectURL(nextObjectUrl);
            }
        };
    }, [currentSrc, hasRestoredLoadedSrc, isLocalPrimary, isSvg]);

    React.useEffect(() => {
        if (effectiveLoaded || errored) return undefined;
        const nextLevel = fallbackLevel + 1;
        if (nextLevel >= fallbackCandidates.length || !currentSrc) return undefined;

        const timeoutId = window.setTimeout(() => {
            const img = imgRef.current;
            if (img?.complete && img.naturalWidth > 0) return;
            console.warn(`[OptimizedImage] 当前候选加载超时，切换到 fallback level ${nextLevel} (${fallbackCandidates[nextLevel]?.label ?? 'unknown'}):`, src);
            setFallbackLevel(nextLevel);
        }, getCandidateTimeoutMs(currentSrc));

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [currentSrc, effectiveLoaded, errored, fallbackCandidates, fallbackLevel, src]);

    // 某些浏览器/资源组合下，img 已经拿到尺寸，但 onload 事件没有稳定触发；
    // 这会让组件一直停在 shimmer/黑底占位。这里补一个基于 DOM 实际状态的兜底收敛。
    React.useEffect(() => {
        if (loaded || errored) return undefined;
        let frameId = 0;
        let cancelled = false;

        const settleFromDom = () => {
            if (cancelled) return;
            const img = imgRef.current;
            if (img?.complete && img.naturalWidth > 0) {
                rememberEarlierCandidateFailures(currentSrc);
                markImageLoaded(currentSrc, undefined, img, currentSrc);
                markImageLoaded(src, effectiveLocale, img, currentSrc);
                setLoaded(true);
                return;
            }
            frameId = window.requestAnimationFrame(settleFromDom);
        };

        frameId = window.requestAnimationFrame(settleFromDom);
        return () => {
            cancelled = true;
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, [currentCandidate, currentSrc, effectiveLocale, errored, loaded, rememberEarlierCandidateFailures, renderedSrc, src]);

    const handleLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
        setLoaded(true);
        autoRetryRef.current = 0; // 加载成功，重置重试计数
        rememberEarlierCandidateFailures(currentSrc);
        markImageLoaded(currentSrc, undefined, event.currentTarget, currentSrc);
        markImageLoaded(src, effectiveLocale, event.currentTarget, currentSrc);
        if (isLocalFallback) {
            console.warn('[OptimizedImage] CDN 不可用，已降级到本地资源:', src);
        }
        onLoadProp?.(event);
    };

    const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
        markImageCandidateFailed(src, effectiveLocale, currentSrc);
        console.error('[OptimizedImage] ❌ 图片加载失败:', {
            src,
            currentSrc,
            fallbackLevel,
            isCdn: isRemoteUrl(currentSrc),
            autoRetryCount: autoRetryRef.current,
            error: event.type
        });
        
        const hasMoreFallback = fallbackLevel + 1 < fallbackCandidates.length;
        if (!hasMoreFallback) {
            const attempt = autoRetryRef.current;
            if (attempt < AUTO_RETRY_MAX) {
                // 指数退避自动重试：重置回退链从头再来
                autoRetryRef.current = attempt + 1;
                const delay = getRetryDelay(attempt);
                console.warn(`[OptimizedImage] 所有回退已用尽，${delay}ms 后自动重试（第 ${attempt + 1}/${AUTO_RETRY_MAX} 轮）:`, src);
                retryTimerRef.current = setTimeout(resetFallbackChain, delay);
            } else {
                // 超过最大重试次数，最终放弃
                console.error('[OptimizedImage] 加载失败（已达最大重试次数）:', src);
                setErrored(true);
                setLoaded(true);
                onError?.(event);
            }
            return;
        }
        // 还有回退层级，推进到下一级
        const nextLevel = fallbackLevel + 1;
        console.warn(`[OptimizedImage] 加载失败，尝试回退 level ${nextLevel} (${fallbackCandidates[nextLevel]?.label ?? 'unknown'}):`, src);
        setFallbackLevel(nextLevel);
    };

    // 监听网络恢复事件：断网恢复后立即重试，不等定时器
    React.useEffect(() => {
        if (!errored && autoRetryRef.current === 0) return; // 没有失败过，不需要监听
        const handleOnline = () => {
            if (autoRetryRef.current > 0 && autoRetryRef.current < AUTO_RETRY_MAX) {
                console.info('[OptimizedImage] 网络恢复，立即重试:', src);
                if (retryTimerRef.current) {
                    clearTimeout(retryTimerRef.current);
                }
                resetFallbackChain();
            }
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [errored, src, resetFallbackChain]);

    // 组件卸载时清理定时器
    React.useEffect(() => {
        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        };
    }, []);

    const showShimmer = placeholder && !effectiveLoaded;

    const imgStyle: React.CSSProperties = {
        ...styleProp,
        ...(showShimmer ? SHIMMER_BG : {}),
        transition: [styleProp?.transition, 'opacity 0.3s ease'].filter(Boolean).join(', '),
        opacity: errored ? 0 : effectiveLoaded ? (styleProp?.opacity ?? 1) : (placeholder ? 1 : 0),
    };

    const handleDragStart: React.DragEventHandler<HTMLImageElement> = (event) => {
        if (draggable !== true) {
            event.preventDefault();
        }
        onDragStart?.(event);
    };

    if (isSvg) {
        return (
            <img
                ref={imgRef}
                src={renderedSrc}
                alt={alt ?? ''}
                draggable={draggable}
                onDragStart={handleDragStart}
                onError={handleError}
                onLoad={handleLoad}
                style={imgStyle}
                className={className}
                data-debug-current-src={currentSrc}
                data-debug-rendered-src={renderedSrc}
                data-debug-object-url={objectUrl ?? ''}
                data-debug-local-fetch={localFetchDebug}
                {...rest}
            />
        );
    }

    return (
        <img
            ref={imgRef}
            src={renderedSrc}
            alt={alt ?? ''}
            draggable={draggable}
            onDragStart={handleDragStart}
            onError={handleError}
            onLoad={handleLoad}
            style={imgStyle}
            className={className}
            data-debug-current-src={currentSrc}
            data-debug-rendered-src={renderedSrc}
            data-debug-object-url={objectUrl ?? ''}
            data-debug-local-fetch={localFetchDebug}
            {...rest}
        />
    );
};
