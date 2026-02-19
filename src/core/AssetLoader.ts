/**
 * 游戏资源加载器
 * 
 * 提供统一的资源路径解析、预加载和缓存管理。
 * 所有游戏资源路径相对于资源基址（默认 /assets/）。
 */

import type { GameAssets, SpriteAtlasDefinition, CriticalImageResolverResult } from './types';
import { resolveCriticalImages } from './CriticalImageResolverRegistry';

// ============================================================================
// 资源路径常量
// ============================================================================

const DEFAULT_ASSETS_BASE_URL = 'https://assets.easyboardgame.top/official';
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

/** 关键图片超时（ms） */
const CRITICAL_PRELOAD_TIMEOUT_MS = 10_000;
const SUPPORT_DETECTION_TIMEOUT_MS = 200;

// 最小化格式探测图片
const AVIF_TEST_DATA =
    'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAG1pZjFhdmlmAAAAAG1ldGEAAA';
const WEBP_TEST_DATA =
    'data:image/webp;base64,UklGRiIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

let avifSupportPromise: Promise<boolean> | null = null;
let webpSupportPromise: Promise<boolean> | null = null;

/**
 * 同步格式偏好缓存
 * 异步检测完成后写入，供 buildLocalizedImageSet 等同步函数使用。
 * null = 尚未检测完成，true/false = 检测结果
 */
let avifSupportedSync: boolean | null = null;
// webp 检测结果也缓存，供未来扩展使用（当前 buildLocalizedImageSet 仅判断 avif）
let _webpSupportedSync: boolean | null = null;

const detectImageSupport = (dataUrl: string): Promise<boolean> => {
    if (typeof Image === 'undefined') return Promise.resolve(false);
    return new Promise((resolve) => {
        let done = false;
        const img = new Image();
        const finish = (supported: boolean) => {
            if (done) return;
            done = true;
            resolve(supported);
        };
        const timer = setTimeout(() => finish(false), SUPPORT_DETECTION_TIMEOUT_MS);
        img.onload = () => {
            clearTimeout(timer);
            finish(true);
        };
        img.onerror = () => {
            clearTimeout(timer);
            finish(false);
        };
        img.src = dataUrl;
    });
};

const supportsAvif = () => {
    avifSupportPromise ??= detectImageSupport(AVIF_TEST_DATA).then(r => { avifSupportedSync = r; return r; });
    return avifSupportPromise;
};

const supportsWebp = () => {
    webpSupportPromise ??= detectImageSupport(WEBP_TEST_DATA).then(r => { _webpSupportedSync = r; return r; });
    return webpSupportPromise;
};

// 模块加载时立即启动格式检测，确保 buildLocalizedImageSet 等同步函数尽早获得结果
supportsAvif();
supportsWebp();

/**
 * 预加载关键图片（第一阶段：阻塞门禁）
 *
 * 合并静态清单（GameAssets.criticalImages）与动态解析器输出，
 * 等待所有关键图片加载完成或 10s 超时后放行。
 * 单张图片加载失败不阻塞其他图片。
 *
 * @returns 暖加载图片路径列表（可传给 preloadWarmImages）
 */
export async function preloadCriticalImages(
    gameId: string,
    gameState?: unknown,
    locale?: string,
    playerID?: string | null,
): Promise<string[]> {
    const assets = gameAssetsRegistry.get(gameId);
    const staticCritical = assets?.criticalImages ?? [];
    const staticWarm = assets?.warmImages ?? [];

    let resolved: CriticalImageResolverResult = { critical: [], warm: [] };
    if (gameState !== undefined) {
        resolved = resolveCriticalImages(gameId, gameState, locale, playerID);
    }

    // 合并去重
    const criticalPaths = [...new Set([...staticCritical, ...resolved.critical])];
    const warmPaths = [...new Set([...staticWarm, ...resolved.warm])];

    if (criticalPaths.length === 0) {
        return warmPaths;
    }

    const effectiveLocale = locale || 'zh-CN';
    const promises = criticalPaths
        .filter(Boolean)
        .map((p) => {
            const localizedPath = getLocalizedAssetPath(p, effectiveLocale);
            return preloadOptimizedImage(localizedPath);
        });

    // Promise.allSettled + 10s 超时竞争
    const startTime = Date.now();
    await Promise.race([
        Promise.allSettled(promises),
        new Promise<void>((resolve) => setTimeout(resolve, CRITICAL_PRELOAD_TIMEOUT_MS)),
    ]);

    return warmPaths;
}

/**
 * 预加载暖图片（第二阶段：后台预取）
 *
 * 在空闲时执行，不阻塞主线程。
 */
export function preloadWarmImages(paths: string[], locale?: string): void {
    if (paths.length === 0) return;

    const effectiveLocale = locale || 'zh-CN';
    const doPreload = () => {
        for (const p of paths) {
            if (!p) continue;
            const localizedPath = getLocalizedAssetPath(p, effectiveLocale);
            preloadOptimizedImage(localizedPath); // fire-and-forget
        }
    };

    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => doPreload(), { timeout: 3000 });
    } else {
        setTimeout(doPreload, 200);
    }
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

/**
 * 将已加载的图片 URL 注册到缓存（供 OptimizedImage 在 onLoad 时调用）
 * 这样同一张图片的其他实例可以跳过 shimmer
 */
export function markImageLoaded(src: string, locale?: string): void {
    const effectiveLocale = locale || 'zh-CN';
    const localizedPath = getLocalizedAssetPath(src, effectiveLocale);
    const { avif, webp } = getOptimizedImageUrls(localizedPath);
    if (avif) preloadedImages.set(avif, new Image());
    if (webp && webp !== avif) preloadedImages.set(webp, new Image());
}

/**
 * 查询图片是否已被预加载（供渲染组件跳过 shimmer）
 * 接受原始资源路径（自动转换）或已转换的 optimized URL
 */
export function isImagePreloaded(src: string, locale?: string): boolean {
    if (preloadedImages.has(src)) return true;
    
    const effectiveLocale = locale || 'zh-CN';
    const localizedPath = getLocalizedAssetPath(src, effectiveLocale);
    
    // 如果 src 已经是 compressed/ 下的 URL，直接检查 avif/webp 变体
    if (localizedPath.includes(`/${COMPRESSED_SUBDIR}/`)) {
        const base = stripExtension(localizedPath);
        return preloadedImages.has(`${base}.avif`) || preloadedImages.has(`${base}.webp`);
    }

    // 转换为 optimized URL 后检查
    const { avif, webp } = getOptimizedImageUrls(localizedPath);
    return preloadedImages.has(avif) || preloadedImages.has(webp);
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

async function preloadImageWithResult(src: string): Promise<boolean> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            preloadedImages.set(src, img);
            resolve(true);
        };
        img.onerror = () => {
            console.warn(`[AssetLoader] 图片加载失败: ${src}`);
            resolve(false);
        };
        img.src = src;
    });
}

async function preloadOptimizedImage(src: string): Promise<void> {
    const { avif, webp } = getOptimizedImageUrls(src);
    if (!avif && !webp) return;
    if (avif === webp) {
        if (preloadedImages.has(avif)) return;
        await preloadImage(avif);
        return;
    }

    const preferAvif = await supportsAvif();
    let primary = avif;
    let fallback = webp;
    if (!preferAvif) {
        const preferWebp = await supportsWebp();
        primary = preferWebp ? webp : avif;
        fallback = preferWebp ? avif : webp;
    }

    // 临时调试日志：确认预加载的实际 URL
    if (src.includes('dice')) {
        console.debug(`[AssetLoader:dice] preloadOptimizedImage src=${src} preferAvif=${preferAvif} primary=${primary}`);
    }

    if (preloadedImages.has(primary)) return;
    const ok = await preloadImageWithResult(primary);
    if (src.includes('dice')) {
        console.debug(`[AssetLoader:dice] preloadOptimizedImage result ok=${ok} primary=${primary}`);
    }
    if (!ok && fallback && !preloadedImages.has(fallback)) {
        await preloadImageWithResult(fallback);
    }
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
const isInternalAssetsUrl = (src: string) => {
    if (!isHttpUrl(assetsBaseUrl)) return false;
    return src.startsWith(assetsBaseUrl) || src.startsWith(`${assetsBaseUrl}/`);
};
const isPassthroughSource = (src: unknown) => {
    if (!isString(src)) return false;
    if (src.startsWith('data:') || src.startsWith('blob:')) return true;
    // HTTP URL 但不是内部资源域名 → 穿透
    if (isHttpUrl(src) && !isInternalAssetsUrl(src)) return true;
    return false;
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
 * 
 * 幂等性保证：如果路径已包含 i18n/<locale>/ 前缀，不会重复添加
 */
export function getLocalizedAssetPath(path: string, locale?: string): string {
    if (!locale || isPassthroughSource(path)) return assetsPath(path);
    const normalized = assetsPath(path);
    const relative = stripAssetsBasePrefix(normalized);
    
    // 幂等性检查：如果已经包含 i18n/<locale>/ 前缀，直接返回
    const localizedPrefix = `${LOCALIZED_ASSETS_SUBDIR}/${locale}/`;
    if (relative.startsWith(localizedPrefix)) {
        return normalized;
    }
    
    return assetsPath(`${localizedPrefix}${relative}`);
}

/**
 * 获取语言化图片 URL（包含回退）
 */
export function getLocalizedImageUrls(src: string, locale?: string): LocalizedImageUrls {
    if (!locale || isPassthroughSource(src)) {
        const urls = getOptimizedImageUrls(src);
        return { primary: urls, fallback: urls };
    }
    const localizedPath = getLocalizedAssetPath(src, locale);
    const primary = getOptimizedImageUrls(localizedPath);
    // 原始路径已删除，fallback 也指向国际化路径
    return { primary, fallback: primary };
}

/**
 * 构建语言化图片集（用于 CSS background-image）
 * 
 * 所有素材已迁移到国际化目录。
 * 根据浏览器格式支持能力选择 avif（优先）或 webp，
 * 与 preloadOptimizedImage 的格式选择逻辑保持一致，确保预加载命中。
 */
export function buildLocalizedImageSet(src: string, locale?: string): string {
    if (!isString(src) || !src) {
        console.warn(`[AssetLoader] invalid_src type=${typeof src} value=${String(src)}`);
        return '';
    }
    const { primary } = getLocalizedImageUrls(src, locale);
    // 根据已检测的格式支持能力选择最佳格式，未检测完成时 fallback 到 webp
    const url = (avifSupportedSync && primary.avif) ? primary.avif
        : primary.webp || primary.avif;
    // 临时调试日志：确认格式选择和缓存命中
    if (src.includes('dice')) {
        const cached = preloadedImages.has(url);
        console.debug(`[AssetLoader:dice] buildLocalizedImageSet src=${src} avifSync=${avifSupportedSync} url=${url} cached=${cached}`);
    }
    return `url("${url}")`;
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
