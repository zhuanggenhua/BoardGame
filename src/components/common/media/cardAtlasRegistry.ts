import type { SpriteAtlasSource } from '../../../engine/primitives/spriteAtlas';
import { generateUniformAtlasConfig } from '../../../engine/primitives/spriteAtlas';
import { getPreloadedImageElement } from '../../../core';

export type CardAtlasSource = SpriteAtlasSource;

/**
 * 懒解析网格注册：只声明 rows/cols，首次访问时从预加载缓存读取图片尺寸自动生成 config。
 * 前提：CriticalImageGate 已预加载该图片（HTMLImageElement 在 preloadedImages 缓存中）。
 */
export interface LazyGridRegistration {
    image: string;
    grid: { rows: number; cols: number };
}

// CardPreview 专用注册表：存储 base path（不带扩展名），由 AtlasCard 构建本地化 URL。
const cardAtlasRegistry = new Map<string, CardAtlasSource>();
// 懒解析注册表：存储尚未解析的 grid-only 注册
const lazyRegistry = new Map<string, LazyGridRegistration>();

/** 注册卡牌图集源（CardPreview 专用） */
export function registerCardAtlasSource(id: string, source: CardAtlasSource): void {
    lazyRegistry.delete(id);
    cardAtlasRegistry.set(id, source);
}

/**
 * 注册懒解析图集（只声明 image + rows/cols）
 * 首次 getCardAtlasSource 时自动从预加载缓存读取图片尺寸生成 config。
 * 面向百游戏：新游戏只需声明网格，无需硬编码像素尺寸。
 */
export function registerLazyCardAtlasSource(id: string, reg: LazyGridRegistration): void {
    cardAtlasRegistry.delete(id);
    lazyRegistry.set(id, reg);
}

/**
 * 获取卡牌图集源（CardPreview 专用）
 * 如果是懒注册，尝试从预加载缓存解析尺寸并生成 config。
 * 解析成功后自动提升为完整注册，后续访问零开销。
 */
export function getCardAtlasSource(id: string, locale?: string): CardAtlasSource | undefined {
    const resolved = cardAtlasRegistry.get(id);
    if (resolved) return resolved;

    const lazy = lazyRegistry.get(id);
    if (!lazy) return undefined;

    // 尝试从预加载缓存获取 HTMLImageElement 的 naturalWidth/naturalHeight
    const img = getPreloadedImageElement(lazy.image, locale);
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const config = generateUniformAtlasConfig(
            img.naturalWidth, img.naturalHeight,
            lazy.grid.rows, lazy.grid.cols,
        );
        const source: CardAtlasSource = { 
            image: lazy.image, 
            config,
        };
        // 提升为完整注册，后续访问零开销
        cardAtlasRegistry.set(id, source);
        lazyRegistry.delete(id);
        return source;
    }

    // 图片尚未预加载（边缘情况），返回 undefined，AtlasCard 会 fallback 加载
    return undefined;
}

/**
 * 获取懒注册信息（供 AtlasCard fallback 加载使用）
 * 当 getCardAtlasSource 返回 undefined 时，AtlasCard 可以用此函数获取 image 路径，
 * 自行加载图片并注册到缓存中。
 */
export function getLazyRegistration(id: string): LazyGridRegistration | undefined {
    return lazyRegistry.get(id);
}

