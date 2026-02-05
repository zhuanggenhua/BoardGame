/**
 * 游戏资源加载器
 * 
 * 提供统一的资源路径解析、预加载和缓存管理。
 * 所有游戏资源路径相对于资源基址（默认 /assets/）。
 */

import type { GameAssets, SpriteAtlasDefinition } from './types';

// ============================================================================
// 资源路径常量
// ============================================================================

const DEFAULT_ASSETS_BASE_URL = '/assets';
const COMPRESSED_SUBDIR = 'compressed';
const LOCALIZED_ASSETS_SUBDIR = 'i18n';

const normalizeAssetsBaseUrl = (value?: string) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed.replace(/\/+$/, '');
    }
    if (trimmed.startsWith('/')) {
        return trimmed.replace(/\/+$/, '');
    }
    return `/${trimmed.replace(/\/+$/, '')}`;
};

/**
 * 资源基址（默认 /assets）。
 * 允许通过 setAssetsBaseUrl 进行覆盖，用于独立资源域名场景。
 */
let assetsBaseUrl = normalizeAssetsBaseUrl(import.meta.env?.VITE_ASSETS_BASE_URL) ?? DEFAULT_ASSETS_BASE_URL;

export function setAssetsBaseUrl(value?: string): void {
    assetsBaseUrl = normalizeAssetsBaseUrl(value) ?? DEFAULT_ASSETS_BASE_URL;
}

export function getAssetsBaseUrl(): string {
    return assetsBaseUrl;
}

// ============================================================================
// 资源注册表
// ============================================================================

const gameAssetsRegistry = new Map<string, GameAssets>();
const preloadedImages = new Map<string, HTMLImageElement>();
const preloadedAudio = new Map<string, HTMLAudioElement>();

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 注册游戏资源清单
 * 应在游戏模块初始化时调用
 */
export function registerGameAssets(gameId: string, assets: GameAssets): void {
    gameAssetsRegistry.set(gameId, assets);
}

/**
 * 获取图片路径
 * 自动处理压缩格式优先级：.avif > .webp > 原始格式
 * 
 * @param gameId 游戏 ID
 * @param key 资源键名
 * @param preferCompressed 是否优先使用压缩格式（默认 true）
 */
export function getImagePath(
    gameId: string,
    key: string,
    preferCompressed = true
): string {
    const assets = gameAssetsRegistry.get(gameId);
    if (!assets?.images?.[key]) {
        console.warn(`[AssetLoader] 未找到图片资源: ${gameId}/${key}`);
        return '';
    }

    const relativePath = assets.images[key];
    
    if (preferCompressed) {
        const basePath = relativePath.replace(/\.[^.]+$/, '');
        const dir = basePath.substring(0, basePath.lastIndexOf('/'));
        const filename = basePath.substring(basePath.lastIndexOf('/') + 1);
        return assetsPath(`${dir}/${COMPRESSED_SUBDIR}/${filename}.avif`);
    }

    return assetsPath(relativePath);
}

/**
 * 获取音频路径
 * 自动使用压缩格式 .ogg
 */
export function getAudioPath(gameId: string, key: string): string {
    const assets = gameAssetsRegistry.get(gameId);
    if (!assets?.audio?.[key]) {
        console.warn(`[AssetLoader] 未找到音频资源: ${gameId}/${key}`);
        return '';
    }

    return assetsPath(assets.audio[key]);
}

/**
 * 获取精灵图集定义
 */
export function getSpriteAtlas(
    gameId: string,
    atlasId: string
): SpriteAtlasDefinition | undefined {
    const assets = gameAssetsRegistry.get(gameId);
    return assets?.sprites?.find(s => s.id === atlasId);
}

/**
 * 预加载游戏资源
 * 返回 Promise，所有资源加载完成后 resolve
 */
export async function preloadGameAssets(gameId: string): Promise<void> {
    const assets = gameAssetsRegistry.get(gameId);
    if (!assets) {
        console.warn(`[AssetLoader] 游戏 ${gameId} 未注册资源清单`);
        return;
    }

    const promises: Promise<void>[] = [];

    if (assets.images) {
        for (const [key] of Object.entries(assets.images)) {
            const path = getImagePath(gameId, key);
            if (path && !preloadedImages.has(path)) {
                promises.push(preloadImage(path));
            }
        }
    }

    if (assets.audio) {
        for (const [key] of Object.entries(assets.audio)) {
            const path = getAudioPath(gameId, key);
            if (path && !preloadedAudio.has(path)) {
                promises.push(preloadAudioFile(path));
            }
        }
    }

    if (assets.sprites) {
        for (const atlas of assets.sprites) {
            const path = assetsPath(atlas.imagePath);
            if (!preloadedImages.has(path)) {
                promises.push(preloadImage(path));
            }
        }
    }

    await Promise.all(promises);
    console.log(`[AssetLoader] 游戏 ${gameId} 资源预加载完成`);
}

/**
 * 清除游戏资源缓存
 */
export function clearGameAssetsCache(gameId: string): void {
    const assets = gameAssetsRegistry.get(gameId);
    if (!assets) return;

    if (assets.images) {
        for (const [key] of Object.entries(assets.images)) {
            const path = getImagePath(gameId, key);
            preloadedImages.delete(path);
        }
    }

    if (assets.audio) {
        for (const [key] of Object.entries(assets.audio)) {
            const path = getAudioPath(gameId, key);
            preloadedAudio.delete(path);
        }
    }
}

// ============================================================================
// 内部辅助函数
// ============================================================================

async function preloadImage(src: string): Promise<void> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            preloadedImages.set(src, img);
            resolve();
        };
        img.onerror = () => {
            console.warn(`[AssetLoader] 图片加载失败: ${src}`);
            resolve(); // 不阻塞其他资源加载
        };
        img.src = src;
    });
}

async function preloadAudioFile(src: string): Promise<void> {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.oncanplaythrough = () => {
            preloadedAudio.set(src, audio);
            resolve();
        };
        audio.onerror = () => {
            console.warn(`[AssetLoader] 音频加载失败: ${src}`);
            resolve();
        };
        audio.src = src;
    });
}

// ============================================================================
// 便捷工具函数（统一资源路径 API）
// ============================================================================

/** 判断是否为穿透源（data/blob/http），独立资源域名不算穿透 */
const isString = (value: unknown): value is string => typeof value === 'string';
const isHttpUrl = (src: string) => src.startsWith('http://') || src.startsWith('https://');
const isInternalAssetsUrl = (src: string) => isHttpUrl(assetsBaseUrl) && src.startsWith(assetsBaseUrl);
const isPassthroughSource = (src: unknown) => {
    if (!isString(src)) return false;
    return (
        src.startsWith('data:')
        || src.startsWith('blob:')
        || (isHttpUrl(src) && !isInternalAssetsUrl(src))
    );
};
const isSvgSource = (src: string) => /\.svg(\?|#|$)/i.test(src);

/** 移除扩展名 */
const stripExtension = (src: string) => {
    if (isPassthroughSource(src)) return src;
    return src.replace(/\.(avif|webp|png|jpe?g)$/i, '');
};

const stripAssetsBasePrefix = (normalized: string) => {
    if (normalized === assetsBaseUrl) return '';
    if (normalized.startsWith(`${assetsBaseUrl}/`)) {
        return normalized.slice(assetsBaseUrl.length + 1);
    }
    if (normalized.startsWith('/assets/')) {
        return normalized.slice('/assets/'.length);
    }
    return normalized.replace(/^\/+/, '');
};

/**
 * 规范化资源路径，统一添加资源基址（默认 /assets）
 * 支持相对路径转换
 */
export function assetsPath(path: string): string {
    if (!isString(path)) return '';
    if (isPassthroughSource(path)) return path;
    if (!path) return assetsBaseUrl;
    if (path === assetsBaseUrl || path.startsWith(`${assetsBaseUrl}/`)) return path;
    if (path.startsWith('/assets/')) return path;
    const trimmed = path.startsWith('/') ? path.slice(1) : path;
    return `${assetsBaseUrl}/${trimmed}`;
}

/**
 * 获取优化图片 URL（avif/webp）
 * 用于 <picture> 或 <img> srcset
 */
export type ImageUrlSet = { avif: string; webp: string };
export type LocalizedImageUrls = { primary: ImageUrlSet; fallback: ImageUrlSet };

export function getOptimizedImageUrls(src: string): ImageUrlSet {
    if (!isString(src) || !src) {
        return { avif: '', webp: '' };
    }
    const normalized = assetsPath(src);
    if (!normalized) {
        return { avif: '', webp: '' };
    }
    if (isPassthroughSource(normalized) || isSvgSource(normalized)) {
        return { avif: normalized, webp: normalized };
    }
    // 压缩图片在 compressed/ 子目录
    const base = stripExtension(normalized);
    const lastSlash = base.lastIndexOf('/');
    const dir = lastSlash >= 0 ? base.substring(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? base.substring(lastSlash + 1) : base;
    const compressedBase = dir ? `${dir}/${COMPRESSED_SUBDIR}/${filename}` : `${COMPRESSED_SUBDIR}/${filename}`;
    return {
        avif: `${compressedBase}.avif`,
        webp: `${compressedBase}.webp`,
    };
}

/**
 * 获取优化音频 URL（自动插入 compressed/）
 */
export function getOptimizedAudioUrl(src: string, basePath?: string): string {
    if (!isString(src) || !src) return '';
    if (isPassthroughSource(src)) return src;

    const normalizedBase = basePath ? basePath.replace(/\/+$/, '') : '';
    const trimmedSrc = src.startsWith('/') ? src.slice(1) : src;
    const fullPath = normalizedBase ? `${normalizedBase}/${trimmedSrc}` : trimmedSrc;
    const normalized = assetsPath(fullPath);
    if (!normalized) return '';

    const lastSlash = normalized.lastIndexOf('/');
    const dir = lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;

    return dir ? `${dir}/${COMPRESSED_SUBDIR}/${filename}` : `${COMPRESSED_SUBDIR}/${filename}`;
}

/**
 * 构建语言化资源路径（A 方案：本地语言目录）
 * 目录结构：/assets/i18n/<lang>/<relativePath>
 */
export function getLocalizedAssetPath(path: string, locale?: string): string {
    if (!locale || isPassthroughSource(path)) return assetsPath(path);
    const normalized = assetsPath(path);
    const relative = stripAssetsBasePrefix(normalized);
    return assetsPath(`${LOCALIZED_ASSETS_SUBDIR}/${locale}/${relative}`);
}

/**
 * 获取语言化图片 URL（包含回退）
 */
export function getLocalizedImageUrls(src: string, locale?: string): LocalizedImageUrls {
    const fallback = getOptimizedImageUrls(src);
    if (!locale || isPassthroughSource(src)) {
        return { primary: fallback, fallback };
    }
    const localizedPath = getLocalizedAssetPath(src, locale);
    return {
        primary: getOptimizedImageUrls(localizedPath),
        fallback,
    };
}

/**
 * 构建语言化图片集（用于 CSS background-image）
 * 返回支持 image-set 的 CSS 值，并包含回退层
 */
export function buildLocalizedImageSet(src: string, locale?: string): string {
    if (!isString(src) || !src) {
        console.warn(`[AssetLoader] invalid_src type=${typeof src} value=${String(src)}`);
        return '';
    }
    const { primary, fallback } = getLocalizedImageUrls(src, locale);
    const primarySet = `image-set(url("${primary.avif}") type("image/avif"), url("${primary.webp}") type("image/webp"))`;
    const fallbackSet = `image-set(url("${fallback.avif}") type("image/avif"), url("${fallback.webp}") type("image/webp"))`;
    return `${primarySet}, ${fallbackSet}`;
}

/**
 * 构建优化图片集（用于 CSS background-image）
 * 返回支持 image-set 的 CSS 值
 */
export function buildOptimizedImageSet(src: string): string {
    const { avif, webp } = getOptimizedImageUrls(src);
    return `image-set(url("${avif}") type("image/avif"), url("${webp}") type("image/webp"))`;
}

/**
 * 获取直接路径（不经过注册表）
 * 用于简单场景，直接拼接 /assets/ 前缀
 */
export function getDirectAssetPath(relativePath: string): string {
    return assetsPath(relativePath);
}
