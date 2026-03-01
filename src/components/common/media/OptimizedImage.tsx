import React from 'react';
import type { ImgHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedImageUrls, getLocalizedLocalAssetPath, isImagePreloaded, markImageLoaded } from '../../../core/AssetLoader';

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

/**
 * 回退策略（CDN 不稳定时自动降级）：
 * 0 = CDN 国际化路径（首选）
 * 1 = CDN 重试（加 ?retry=1 绕过浏览器缓存，处理瞬时连接中断）
 * 2 = 本地 /assets/ 路径（CDN 完全不可用时降级）
 * 3 = 最终失败，显示错误状态
 */
const CDN_RETRY_LEVEL = 1;
const LANGUAGE_FALLBACK_LEVEL = 2; // 语言回退级别
const LOCAL_FALLBACK_LEVEL = 3; // 本地降级级别

/** 指数退避自动重试配置 */
const AUTO_RETRY_MAX = 5;           // 最多自动重试 5 轮
const AUTO_RETRY_BASE_MS = 2000;    // 首次 2s
const AUTO_RETRY_MAX_MS = 30000;    // 上限 30s

/** 计算指数退避延迟（带 ±25% 抖动，避免多图同时重试雪崩） */
const getRetryDelay = (attempt: number) => {
    const base = Math.min(AUTO_RETRY_BASE_MS * 2 ** attempt, AUTO_RETRY_MAX_MS);
    const jitter = base * (0.75 + Math.random() * 0.5); // [0.75x, 1.25x]
    return Math.round(jitter);
};

/** 判断 src 是否为 CDN 外部 URL（http/https），本地路径无需重试/降级 */
const isCdnUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

/** 为 URL 追加重试参数，绕过浏览器对失败请求的缓存 */
const appendRetryParam = (url: string, retry: number) => {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}retry=${retry}`;
};

export const OptimizedImage = ({ src, fallbackSrc: _fallbackSrc, locale, alt, onError, onLoad: onLoadProp, style: styleProp, placeholder = true, className, ...rest }: OptimizedImageProps) => {
    const { i18n } = useTranslation();
    const effectiveLocale = locale || i18n.language || 'zh-CN';
    const [fallbackLevel, setFallbackLevel] = React.useState(0);
    const preloaded = isImagePreloaded(src, effectiveLocale);
    const [loaded, setLoaded] = React.useState(() => preloaded);
    const [errored, setErrored] = React.useState(false);
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

    // CDN 国际化路径（包含语言回退）
    const localizedUrls = getLocalizedImageUrls(src, effectiveLocale);
    const cdnUrl = localizedUrls.primary.webp;
    const cdnFallbackUrl = localizedUrls.fallback.webp; // 语言回退 URL
    
    console.log('[OptimizedImage] URLs:', {
        src,
        effectiveLocale,
        cdnUrl,
        cdnFallbackUrl,
        isCdn: isCdnUrl(cdnUrl)
    });

    // 本地降级路径（/assets/i18n/{locale}/...compressed/xxx.webp）
    const localUrl = React.useMemo(() => {
        if (!isCdnUrl(cdnUrl)) return cdnUrl; // 已经是本地路径，无需降级
        // 从原始 src 构建本地国际化压缩路径
        const localBase = getLocalizedLocalAssetPath(src, effectiveLocale);
        // 插入 compressed/ 并替换扩展名为 .webp
        const base = localBase.replace(/\.[^/.]+$/, '');
        const lastSlash = base.lastIndexOf('/');
        const dir = lastSlash >= 0 ? base.substring(0, lastSlash) : '';
        const filename = lastSlash >= 0 ? base.substring(lastSlash + 1) : base;
        if (dir.endsWith('/compressed') || dir === 'compressed') {
            return `${base}.webp`;
        }
        return dir ? `${dir}/compressed/${filename}.webp` : `compressed/${filename}.webp`;
    }, [cdnUrl, src, effectiveLocale]);

    // 根据 fallbackLevel 计算当前实际 src
    // 降级顺序：CDN primary → CDN primary retry → CDN fallback (语言回退) → 本地 primary
    const currentSrc = React.useMemo(() => {
        if (!isCdnUrl(cdnUrl)) {
            console.log('[OptimizedImage] Using local path (no CDN):', cdnUrl);
            return cdnUrl; // 本地路径不走降级
        }
        let result: string;
        switch (fallbackLevel) {
            case 0: 
                result = cdnUrl;
                break;
            case CDN_RETRY_LEVEL: 
                result = appendRetryParam(cdnUrl, 1);
                break;
            case LANGUAGE_FALLBACK_LEVEL: 
                result = cdnFallbackUrl; // 语言回退
                break;
            case LOCAL_FALLBACK_LEVEL: 
                result = localUrl;
                break;
            default: 
                result = cdnUrl;
        }
        console.log('[OptimizedImage] currentSrc:', {
            fallbackLevel,
            levelName: ['primary', 'retry', 'language-fallback', 'local'][fallbackLevel] || 'unknown',
            result
        });
        return result;
    }, [cdnUrl, cdnFallbackUrl, localUrl, fallbackLevel]);

    const isSvg = isSvgSource(currentSrc);

    // src 或 locale 变化时完全重置
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

    const handleLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
        setLoaded(true);
        autoRetryRef.current = 0; // 加载成功，重置重试计数
        markImageLoaded(src, effectiveLocale, event.currentTarget);
        if (fallbackLevel === LOCAL_FALLBACK_LEVEL) {
            console.warn('[OptimizedImage] CDN 不可用，已降级到本地资源:', src);
        }
        onLoadProp?.(event);
    };

    const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
        console.error('[OptimizedImage] Image load error:', {
            src,
            currentSrc,
            fallbackLevel,
            isCdn: isCdnUrl(cdnUrl),
            autoRetryCount: autoRetryRef.current
        });
        
        // 非 CDN 路径或已到最终失败层级 → 进入自动重试
        if (!isCdnUrl(cdnUrl) || fallbackLevel >= LOCAL_FALLBACK_LEVEL) {
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
        console.warn(`[OptimizedImage] 加载失败，尝试回退 level ${nextLevel} (${['primary', 'retry', 'language-fallback', 'local'][nextLevel]}):`, src);
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

    const showShimmer = placeholder && !loaded;

    const imgStyle: React.CSSProperties = {
        ...styleProp,
        ...(showShimmer ? SHIMMER_BG : {}),
        transition: [styleProp?.transition, 'opacity 0.3s ease'].filter(Boolean).join(', '),
        opacity: errored ? 0 : loaded ? (styleProp?.opacity ?? 1) : (placeholder ? 1 : 0),
    };

    if (isSvg) {
        return <img ref={imgRef} src={currentSrc} alt={alt ?? ''} onError={handleError} onLoad={handleLoad} style={imgStyle} className={className} {...rest} />;
    }

    return (
        <img ref={imgRef} src={currentSrc} alt={alt ?? ''} onError={handleError} onLoad={handleLoad} style={imgStyle} className={className} {...rest} />
    );
};
