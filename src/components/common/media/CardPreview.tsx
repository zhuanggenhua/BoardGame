import { useState, useEffect, useReducer, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { buildLocalizedImageSet, getLocalizedImageUrls, isImagePreloaded, markImageLoaded, onImageReady, type CardPreviewRef } from '../../../core';
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
    // 优先使用传入的 locale，否则从 i18next 获取当前语言
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

    // 传入 locale 以支持懒解析模式（从预加载缓存读取图片尺寸）
    const [resolvedSource, setResolvedSource] = useState(() => getCardAtlasSource(atlasId, effectiveLocale));
    const source = resolvedSource ?? getCardAtlasSource(atlasId, effectiveLocale);

    // 使用统一的 isImagePreloaded 检查（与 CriticalImageGate 共享缓存）
    const preloaded = source ? isImagePreloaded(source.image, effectiveLocale) : false;
    const [loaded, setLoaded] = useState(() => preloaded);

    // 同步修正：如果 loaded 为 false 但缓存已就绪，立即同步为 true，
    // 避免 useEffect 异步更新导致的一帧 shimmer 闪烁
    const effectiveLoaded = loaded || preloaded;

    const localizedUrls = source ? getLocalizedImageUrls(source.image, effectiveLocale) : null;
    const checkUrls = localizedUrls
        ? [...new Set([localizedUrls.primary.webp, localizedUrls.fallback.webp].filter(Boolean))]
        : [];
    const checkKey = checkUrls.join('|');

    // 订阅后台加载完成通知：CriticalImageGate 超时放行后，
    // 精灵图在后台继续加载，完成时触发重渲染消除 shimmer
    const [, bumpTick] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
        if (!source) return;
        const localizedPath = getLocalizedAssetPath(source.image, effectiveLocale);
        const { webp } = getOptimizedImageUrls(localizedPath);
        if (!webp) return;
        // 防御竞态：订阅前图片可能已在后台加载完成，立即检查一次
        if (isImagePreloaded(source.image, effectiveLocale)) {
            setLoaded(true);
        }
        return onImageReady((url) => {
            if (url === webp) {
                setLoaded(true);
                bumpTick();
            }
        });
    }, [source?.image, effectiveLocale]);

    useEffect(() => {
        // 如果已预加载，直接标记为已加载
        if (source && isImagePreloaded(source.image, effectiveLocale)) {
            setLoaded(true);
            return;
        }
        if (checkUrls.length === 0) {
            setLoaded(true);
            return;
        }
        setLoaded(false);
        let cancelled = false;

        const tryLoad = (idx: number) => {
            if (idx >= checkUrls.length) {
                if (!cancelled) setLoaded(true); // 全部失败也移除 shimmer
                return;
            }
            const url = checkUrls[idx];
            const img = new Image();
            img.onload = () => {
                // 注册到统一缓存，供其他组件复用
                if (source) markImageLoaded(source.image, effectiveLocale, img);
                if (!cancelled) setLoaded(true);
            };
            img.onerror = () => tryLoad(idx + 1);
            img.src = url;
        };

        tryLoad(0);
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkKey, source?.image, effectiveLocale]);

    // Fallback：source 为 undefined 时（CriticalImageGate 预加载超时/失败），
    // 自行加载图片获取尺寸，触发懒解析提升
    useEffect(() => {
        if (source) return; // 已有 source，无需 fallback
        const lazy = getLazyRegistration(atlasId);
        if (!lazy) return; // 非懒注册，无法 fallback

        let cancelled = false;
        const urls = getLocalizedImageUrls(lazy.image, effectiveLocale);
        const candidates = [...new Set([urls.primary.webp, urls.fallback.webp].filter(Boolean))];

        const tryFallback = (idx: number) => {
            if (idx >= candidates.length || cancelled) return;
            const url = candidates[idx];
            const img = new Image();
            img.onload = () => {
                if (cancelled) return;
                // 注册到预加载缓存，使 getCardAtlasSource 下次能解析成功
                markImageLoaded(lazy.image, effectiveLocale, img);
                // 重新尝试获取 source（此时缓存已有图片，懒解析应成功）
                const newSource = getCardAtlasSource(atlasId, effectiveLocale);
                if (newSource && !cancelled) {
                    setResolvedSource(newSource);
                    setLoaded(true);
                }
            };
            img.onerror = () => tryFallback(idx + 1);
            img.src = url;
        };

        tryFallback(0);
        return () => { cancelled = true; };
    }, [source, atlasId, effectiveLocale]);

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

    const atlasStyle = computeSpriteStyle(index, source.config);
    const backgroundImage = buildLocalizedImageSet(source.image, effectiveLocale);

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
