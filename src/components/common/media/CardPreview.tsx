import { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { buildLocalizedImageSet, getLocalizedAssetPath, getLocalizedImageUrls, type CardPreviewRef } from '../../../core';
import { OptimizedImage } from './OptimizedImage';
import { type SpriteAtlasConfig, type SpriteAtlasSource, computeSpriteStyle } from '../../../engine/primitives/spriteAtlas';

export type CardPreviewRenderer = (args: {
    previewRef: CardPreviewRef;
    locale?: string;
    className?: string;
    style?: CSSProperties;
}) => ReactNode;

export type CardSvgRenderer = (props?: Record<string, string | number>) => ReactNode;

// 向后兼容类型别名（游戏层可能直接引用）
export type CardAtlasConfig = SpriteAtlasConfig;
export type CardAtlasSource = SpriteAtlasSource;

const previewRendererRegistry = new Map<string, CardPreviewRenderer>();
const svgRendererRegistry = new Map<string, CardSvgRenderer>();
// CardPreview 专用注册表：存储 base path（不带扩展名），由 AtlasCard 用 buildLocalizedImageSet 构建实际 URL
// 与引擎层 globalSpriteAtlasRegistry（存储运行时 webp URL）独立
const cardAtlasRegistry = new Map<string, CardAtlasSource>();

export function registerCardPreviewRenderer(id: string, renderer: CardPreviewRenderer): void {
    previewRendererRegistry.set(id, renderer);
}

export function registerCardSvgRenderer(id: string, renderer: CardSvgRenderer): void {
    svgRendererRegistry.set(id, renderer);
}

/** 注册卡牌图集源（CardPreview 专用，存 base path） */
export function registerCardAtlasSource(id: string, source: CardAtlasSource): void {
    cardAtlasRegistry.set(id, source);
}

/** 获取卡牌图集源（CardPreview 专用） */
export function getCardAtlasSource(id: string): CardAtlasSource | undefined {
    return cardAtlasRegistry.get(id);
}

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
    locale?: string;
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
    if (!previewRef) return null;

    if (previewRef.type === 'image') {
        const src = getLocalizedAssetPath(previewRef.src, locale);
        return (
            <OptimizedImage
                src={src}
                fallbackSrc={previewRef.src}
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
                locale={locale}
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
    return renderer({ previewRef, locale, className, style });
}

// ============================================================================
// Atlas 精灵图卡牌（带 shimmer 占位）
// ============================================================================

/** 已加载的精灵图 URL 缓存（全局共享，避免重复检测） */
const loadedAtlasCache = new Set<string>();

interface AtlasCardProps {
    atlasId: string;
    index: number;
    locale?: string;
    className?: string;
    style?: CSSProperties;
    title?: string;
}

function AtlasCard({ atlasId, index, locale, className, style, title }: AtlasCardProps) {
    const source = getCardAtlasSource(atlasId);
    const localizedUrls = source ? getLocalizedImageUrls(source.image, locale) : null;
    const checkUrls = localizedUrls
        ? [localizedUrls.primary.webp, localizedUrls.fallback.webp].filter(Boolean)
        : [];
    const checkKey = checkUrls.join('|');

    // 精灵图是否已加载（缓存命中时直接 true）
    const [loaded, setLoaded] = useState(() => checkUrls.some((url) => loadedAtlasCache.has(url)));

    useEffect(() => {
        if (checkUrls.length === 0) {
            setLoaded(true);
            return;
        }
        if (checkUrls.some((url) => loadedAtlasCache.has(url))) {
            setLoaded(true);
            return;
        }
        setLoaded(false);
        let cancelled = false;

        const tryLoad = (index: number) => {
            if (index >= checkUrls.length) {
                if (!cancelled) setLoaded(true); // 全部失败也移除 shimmer
                return;
            }
            const url = checkUrls[index];
            const img = new Image();
            img.onload = () => {
                loadedAtlasCache.add(url);
                if (!cancelled) setLoaded(true);
            };
            img.onerror = () => tryLoad(index + 1);
            img.src = url;
        };

        tryLoad(0);
        return () => {
            cancelled = true;
        };
    }, [checkKey]);

    if (!source) return null;

    const atlasStyle = getCardAtlasStyle(index, source.config);
    const backgroundImage = buildLocalizedImageSet(source.image, locale);

    return (
        <div
            className={`${loaded ? '' : 'atlas-shimmer'} ${className ?? ''}`}
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
