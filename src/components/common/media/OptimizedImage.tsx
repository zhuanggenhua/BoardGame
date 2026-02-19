import React from 'react';
import type { ImgHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedImageUrls, isImagePreloaded, markImageLoaded } from '../../../core/AssetLoader';

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
 * 回退层级：
 * 0 = localized 路径（i18n/{locale}/...）
 * 1 = fallbackSrc（显式指定的备选源）
 */
export const OptimizedImage = ({ src, fallbackSrc: _fallbackSrc, locale, alt, onError, onLoad: onLoadProp, style: styleProp, placeholder = true, className, ...rest }: OptimizedImageProps) => {
    const { i18n } = useTranslation();
    // 优先使用传入的 locale，否则从 i18next 获取当前语言
    const effectiveLocale = locale || i18n.language || 'zh-CN';
    const [fallbackLevel, setFallbackLevel] = React.useState(0);
    const preloaded = isImagePreloaded(src, effectiveLocale);
    const [loaded, setLoaded] = React.useState(() => preloaded);
    const [errored, setErrored] = React.useState(false);
    const imgRef = React.useRef<HTMLImageElement>(null);
    
    // 预计算所有层级的 URL
    const localizedUrls = getLocalizedImageUrls(src, effectiveLocale);
    const level0Urls = localizedUrls.primary;  // i18n/{locale}/...
    const level1Urls = localizedUrls.fallback;  // 不带 i18n 前缀的回退路径

    // 根据当前 fallbackLevel 选择活跃 URL
    const activeUrls = fallbackLevel === 0 ? level0Urls : level1Urls;

    const isSvg = isSvgSource(activeUrls.webp);
    const currentSrc = activeUrls.webp;
    
    // src 或 locale 变化时完全重置
    React.useLayoutEffect(() => {
        setFallbackLevel(0);
        setErrored(false);
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
        markImageLoaded(src, effectiveLocale);
        onLoadProp?.(event);
    };

    const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
        console.error('[OptimizedImage] 加载失败:', currentSrc, 'fallbackLevel=', fallbackLevel);
        // 旧路径资源已被删除，不再 fallback，直接报错
        setErrored(true);
        setLoaded(true);
        onError?.(event);
    };

    const showShimmer = placeholder && !loaded;

    const imgStyle: React.CSSProperties = {
        ...styleProp,
        ...(showShimmer ? SHIMMER_BG : {}),
        transition: [styleProp?.transition, 'opacity 0.3s ease'].filter(Boolean).join(', '),
        opacity: errored ? 0 : loaded ? (styleProp?.opacity ?? 1) : (placeholder ? 1 : 0),
    };

    if (isSvg) {
        return <img ref={imgRef} src={activeUrls.webp} alt={alt ?? ''} onError={handleError} onLoad={handleLoad} style={imgStyle} className={className} {...rest} />;
    }

    return (
        <img ref={imgRef} src={activeUrls.webp} alt={alt ?? ''} onError={handleError} onLoad={handleLoad} style={imgStyle} className={className} {...rest} />
    );
};
