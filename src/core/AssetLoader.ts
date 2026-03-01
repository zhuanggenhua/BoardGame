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

// HMR 时模块会被重新执行，模块级变量会被重置为空 Map，
// 导致所有已缓存的图片/音频标记丢失，触发全量重新预加载（好几秒的白屏）。
// 将缓存挂到 window 上，使其在 HMR 时存活。
const _win = typeof window !== 'undefined' ? window as Window & {
    __BG_ASSET_CACHE__?: {
        gameAssetsRegistry: Map<string, GameAssets>;
        preloadedImages: Map<string, HTMLImageElement>;
        preloadedAudio: Map<string, HTMLAudioElement>;
    };
} : undefined;

if (_win && !_win.__BG_ASSET_CACHE__) {
    _win.__BG_ASSET_CACHE__ = {
        gameAssetsRegistry: new Map(),
        preloadedImages: new Map(),
        preloadedAudio: new Map(),
    };
}

const gameAssetsRegistry = _win?.__BG_ASSET_CACHE__?.gameAssetsRegistry ?? new Map<string, GameAssets>();
const preloadedImages = _win?.__BG_ASSET_CACHE__?.preloadedImages ?? new Map<string, HTMLImageElement>();
const preloadedAudio = _win?.__BG_ASSET_CACHE__?.preloadedAudio ?? new Map<string, HTMLAudioElement>();

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
 * 自动处理压缩格式：优先使用 .webp 压缩格式
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
        return assetsPath(`${dir}/${COMPRESSED_SUBDIR}/${filename}.webp`);
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
}

/** 单张图片预加载超时（ms）。仅防 404/网络断开，不防慢。CDN 冷启动可能 >10s */
const SINGLE_IMAGE_TIMEOUT_MS = 30_000;

// ============================================================================
// 图片就绪通知（后台加载完成 → 通知 UI 组件重渲染）
// ============================================================================

/**
 * 图片后台加载完成通知机制。
 *
 * 场景：preloadCriticalImages 超时放行后，图片仍在后台加载。
 * 加载完成时通过此机制通知订阅的 UI 组件（CardPreview/AtlasCard）触发重渲染，
 * 消除 shimmer 占位。
 *
 * 设计：简单的 Set<callback> 发布/订阅，按 URL 精确匹配。
 * 不用 EventTarget 是因为需要在 SSR 环境安全运行。
 */
type ImageReadyCallback = (url: string) => void;
const _imageReadyListeners = new Set<ImageReadyCallback>();

/** 订阅图片后台加载完成事件，返回取消订阅函数 */
export function onImageReady(callback: ImageReadyCallback): () => void {
    _imageReadyListeners.add(callback);
    return () => { _imageReadyListeners.delete(callback); };
}

/** 内部：触发图片就绪通知 */
function _emitImageReady(url: string): void {
    for (const cb of _imageReadyListeners) {
        try { cb(url); } catch { /* 订阅者异常不影响其他订阅者 */ }
    }
}

// ============================================================================
// 关键图片就绪信号（供音频预加载等待）
// ============================================================================

/**
 * 关键图片就绪信号。
 *
 * 音频预加载必须等待此信号后才能发起 XHR，
 * 避免音频请求与图片请求竞争 HTTP 连接池（同域 6 并发上限）。
 *
 * 设计：简单的布尔标志 + 轮询。比 Promise 更可靠，不存在
 * "初始 Promise 被意外 resolve"或"reset 后旧 Promise 悬空"的问题。
 *
 * 状态机：
 * - 'blocked'：有关键图片正在加载，音频必须等待
 * - 'ready'：关键图片已就绪（或无关键图片），音频可以加载
 *
 * 初始状态为 blocked：音频系统可能在 CriticalImageGate 挂载前就调用 preloadKeys，
 * 必须默认阻塞，由 CriticalImageGate 显式 signal ready。
 * 15s 保底：防止图片预加载异常时音频永远阻塞。
 */
let _criticalImagesState: 'blocked' | 'ready' = 'blocked';
let _criticalImagesEpoch = 0;

/**
 * 等待关键图片就绪（供 AudioManager 调用）
 *
 * 轮询检查状态标志，200ms 间隔，15s 保底超时。
 * 比 Promise 方案更可靠：不存在"旧 Promise 被意外 resolve"的竞态。
 */
export function waitForCriticalImages(): Promise<void> {
    if (_criticalImagesState === 'ready') return Promise.resolve();
    return new Promise<void>((resolve) => {
        const POLL_MS = 200;
        const MAX_WAIT_MS = 15_000;
        let elapsed = 0;
        let lastEpoch = _criticalImagesEpoch;
        const check = () => {
            if (_criticalImagesState === 'ready') { resolve(); return; }
            // epoch 变化 = 新一轮 preload 开始（状态已重置为 blocked），重置计时器继续等待
            if (_criticalImagesEpoch !== lastEpoch) {
                lastEpoch = _criticalImagesEpoch;
                elapsed = 0;
            }
            elapsed += POLL_MS;
            if (elapsed >= MAX_WAIT_MS) {
                console.warn('[AssetLoader] 关键图片等待超时（15s），放行音频预加载');
                resolve();
                return;
            }
            setTimeout(check, POLL_MS);
        };
        setTimeout(check, POLL_MS);
    });
}

/**
 * 标记关键图片就绪（供 CriticalImageGate 调用）
 *
 * 必须传入调用方记录的 epoch，只有 epoch 匹配时才 signal。
 * 防止旧轮次的延迟回调覆盖新轮次的 blocked 状态。
 * 不传 epoch 时无条件 signal（向后兼容，但不推荐）。
 */
export function signalCriticalImagesReady(epoch?: number): void {
    if (epoch !== undefined && epoch !== _criticalImagesEpoch) return;
    _criticalImagesState = 'ready';
}

/**
 * 获取当前 epoch（供 CriticalImageGate 记录，传给 signalCriticalImagesReady）
 */
export function getCriticalImagesEpoch(): number {
    return _criticalImagesEpoch;
}

/**
 * 同步检查关键图片是否已就绪（供 AudioManager loadBatch 每批次前检查）
 *
 * 与 waitForCriticalImages() 不同，这是纯同步调用，不阻塞。
 * 用于音频 loadBatch 在 requestIdleCallback 回调中重新确认状态，
 * 防止"round 1 ready → 音频通过 → round 2 reset blocked"的竞态窗口。
 */
export function isCriticalImagesReady(): boolean {
    return _criticalImagesState === 'ready';
}

/**
 * 重置信号为阻塞状态（每次新的 preloadCriticalImages 调用时重置）
 */
function resetCriticalImagesSignal(): void {
    _criticalImagesEpoch++;
    _criticalImagesState = 'blocked';
}

/**
 * 预加载关键图片（第一阶段：阻塞门禁）
 *
 * 合并静态清单（GameAssets.criticalImages）与动态解析器输出，
 * 等待所有关键图片加载完成。不设整体超时——图片素材确定存在，
 * 只是 CDN 冷启动可能慢，宁可多等也不要渲染空白界面。
 * 单张图片有 30s 超时防 404/网络断开。
 *
 * @param onProgress 可选进度回调，参数为 (loaded, total)
 * @returns 暖加载图片路径列表（可传给 preloadWarmImages）
 */
export async function preloadCriticalImages(
    gameId: string,
    gameState?: unknown,
    locale?: string,
    playerID?: string | null,
    onProgress?: (loaded: number, total: number) => void,
): Promise<string[]> {
    // 取消旧的 warm 预加载队列，释放连接池给 critical 请求
    cancelWarmPreload();
    // 重置就绪信号，阻塞音频预加载直到本轮关键图片完成
    resetCriticalImagesSignal();

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
        // 无关键图片（如教程 factionSelect 阶段）：不 signal，保持 blocked。
        // 后续阶段（playing）会再次调用 preloadCriticalImages 并在完成后 signal。
        // 不能在这里 signal——音频会立即抢连接，比下一阶段的图片请求更快。
        return warmPaths;
    }

    const effectiveLocale = locale || 'zh-CN';
    const startTime = performance.now();

    // 限制并发数为 6（HTTP/1.1 同域连接上限）
    const CRITICAL_CONCURRENCY = 6;
    const filtered = criticalPaths.filter(Boolean);
    const total = filtered.length;
    let loaded = 0;
    let cursor = 0;

    onProgress?.(0, total);

    const runWorker = async (): Promise<void> => {
        while (cursor < filtered.length) {
            const p = filtered[cursor++];
            const localizedPath = getLocalizedAssetPath(p, effectiveLocale);
            await preloadOptimizedImage(localizedPath);
            loaded++;
            onProgress?.(loaded, total);
        }
    };

    // 等待所有关键图片加载完成，不设整体超时
    await Promise.all(
        Array.from({ length: Math.min(CRITICAL_CONCURRENCY, filtered.length) }, () => runWorker()),
    );

    const elapsed = performance.now() - startTime;
    if (elapsed > 500) {
        console.warn(`[AssetLoader] ${gameId} 关键图片预加载耗时 ${elapsed.toFixed(0)}ms（${total} 张）`);
    }

    // 关键图片就绪 — 但不立即 resolve 音频信号。
    // 返回 warmPaths 给 CriticalImageGate，由它启动 warm 预加载后再 resolve 信号，
    // 确保 warm 图片（如基地图集）先于音频占住连接池。
    // 信号由 CriticalImageGate 在调用 preloadWarmImages 之后手动 signalCriticalImagesReady()。

    return warmPaths;
}

/**
 * 同步检查所有关键图片是否已在缓存中
 *
 * 用于 CriticalImageGate 的快速路径：如果所有图片都已预加载过，
 * 可以跳过异步预加载流程，避免刷新时闪一帧 LoadingScreen。
 */
export function areAllCriticalImagesCached(
    gameId: string,
    gameState?: unknown,
    locale?: string,
    playerID?: string | null,
): boolean {
    const assets = gameAssetsRegistry.get(gameId);
    const staticCritical = assets?.criticalImages ?? [];

    let resolved: CriticalImageResolverResult = { critical: [], warm: [] };
    if (gameState !== undefined) {
        resolved = resolveCriticalImages(gameId, gameState, locale, playerID);
    }

    const criticalPaths = [...new Set([...staticCritical, ...resolved.critical])];
    if (criticalPaths.length === 0) return true;

    const effectiveLocale = locale || 'zh-CN';
    for (const p of criticalPaths) {
        if (!p) continue;
        const localizedPath = getLocalizedAssetPath(p, effectiveLocale);
        const { webp } = getOptimizedImageUrls(localizedPath);
        if (!webp) return false;
        const el = preloadedImages.get(webp);
        // 必须真正加载成功（naturalWidth > 0），超时占位的空 Image 不算
        if (!el || el.naturalWidth === 0) return false;
    }
    return true;
}


/**
 * 暖加载取消令牌。每次调用 preloadWarmImages 时生成新令牌，
 * 旧令牌自动失效，尚未开始的 warm 请求不再发起。
 * 已发出的网络请求无法取消（Image 不支持 abort），但可以阻止队列中后续请求。
 */
let warmAbortToken = 0;

/**
 * 被取消的 warm 路径暂存区。
 * cancelWarmPreload 时把当前队列中未完成的路径存入，
 * 下一次 preloadWarmImages 调用时自动合并（已加载的会被 preloadOptimizedImage 跳过）。
 * 保证 warm 资源"延迟但不丢失"。
 * scope 限定为同一 gameId，跨游戏/跨路由的 pending 不恢复。
 */
let _pendingWarmPaths: Set<string> = new Set();
let _pendingWarmLocale: string | undefined;
let _pendingWarmGameId: string | undefined;

/** 当前 warm 队列的路径和进度，供取消时回收未完成的部分 */
let _currentWarmPaths: string[] = [];
let _currentWarmCursor = 0;
let _currentWarmGameId: string | undefined;

/**
 * 取消当前正在进行的暖加载队列。
 * 由 preloadCriticalImages 在启动新一轮关键图片预加载时调用，
 * 释放浏览器连接池给 critical 请求。
 * 未完成的 warm 路径会被暂存，下一轮 preloadWarmImages 时自动恢复（同 gameId 内）。
 */
export function cancelWarmPreload(): void {
    // 把当前队列中尚未开始加载的路径存入暂存区（仅限同 gameId）
    for (let i = _currentWarmCursor; i < _currentWarmPaths.length; i++) {
        const p = _currentWarmPaths[i];
        if (p) _pendingWarmPaths.add(p);
    }
    _pendingWarmGameId = _currentWarmGameId;
    // 令牌自增，使旧队列的 worker 退出
    warmAbortToken++;
    _currentWarmPaths = [];
    _currentWarmCursor = 0;
    _currentWarmGameId = undefined;
}

/**
 * 预加载暖图片（第二阶段：后台预取）
 *
 * 在空闲时执行，有限并发（3 路），不阻塞主线程。
 * 支持取消：新的 critical 预加载启动时会调用 cancelWarmPreload()，
 * 队列中尚未开始的 warm 请求将被跳过，但会在下一轮自动恢复（同 gameId 内）。
 */
const WARM_CONCURRENCY = 3;

export function preloadWarmImages(paths: string[], locale?: string, gameId?: string): void {
    const effectiveLocale = locale || 'zh-CN';

    // 合并上一轮被取消的 warm 路径（仅限同 gameId，跨游戏的 pending 丢弃）
    const merged = new Set(paths.filter(Boolean));
    if (_pendingWarmPaths.size > 0
        && (_pendingWarmGameId === gameId || (!_pendingWarmGameId && !gameId))
        && (_pendingWarmLocale === effectiveLocale || !_pendingWarmLocale)) {
        for (const p of _pendingWarmPaths) merged.add(p);
    }
    _pendingWarmPaths = new Set();
    _pendingWarmLocale = undefined;
    _pendingWarmGameId = undefined;

    const allPaths = [...merged];
    if (allPaths.length === 0) return;

    // 记录当前队列，供 cancelWarmPreload 回收
    _currentWarmPaths = allPaths;
    _currentWarmCursor = 0;
    _currentWarmGameId = gameId;
    _pendingWarmLocale = effectiveLocale;

    // 生成新令牌，自动使旧的 warm 队列失效
    const token = ++warmAbortToken;

    const doPreload = async () => {
        const run = async (): Promise<void> => {
            while (_currentWarmCursor < allPaths.length) {
                if (warmAbortToken !== token) return; // 已取消
                const p = allPaths[_currentWarmCursor++];
                if (!p) continue;
                const localizedPath = getLocalizedAssetPath(p, effectiveLocale);
                await preloadOptimizedImage(localizedPath);
            }
        };
        // 启动 N 路并发 worker
        await Promise.all(Array.from({ length: Math.min(WARM_CONCURRENCY, allPaths.length) }, () => run()));
        // 正常完成，清空当前队列记录
        if (warmAbortToken === token) {
            _currentWarmPaths = [];
            _currentWarmCursor = 0;
            _currentWarmGameId = undefined;
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
 * 这样同一张图片的其他实例可以跳过 shimmer。
 *
 * @param imgElement 可选，传入已加载成功的 HTMLImageElement（naturalWidth > 0），
 *   确保 isImagePreloaded 能正确判断。未传时创建占位 Image 并设置 src，
 *   浏览器通常会从磁盘缓存命中使 naturalWidth 立即可用。
 */
export function markImageLoaded(src: string, locale?: string, imgElement?: HTMLImageElement): void {
    const effectiveLocale = locale || 'zh-CN';
    const localizedPath = getLocalizedAssetPath(src, effectiveLocale);
    const { webp } = getOptimizedImageUrls(localizedPath);
    if (!webp) return;
    if (imgElement && imgElement.naturalWidth > 0) {
        preloadedImages.set(webp, imgElement);
    } else {
        // 回退：创建 Image 并设置 src，浏览器磁盘缓存命中时 naturalWidth 立即可用
        const img = new Image();
        img.src = webp;
        preloadedImages.set(webp, img);
    }
}

/**
 * 获取已预加载的 HTMLImageElement（供图集懒解析尺寸）
 * 接受原始资源路径（自动转换为 optimized URL 后查找缓存）
 * 返回 null 表示图片尚未预加载
 */
export function getPreloadedImageElement(src: string, locale?: string): HTMLImageElement | null {
    const effectiveLocale = locale || 'zh-CN';
    const localizedPath = getLocalizedAssetPath(src, effectiveLocale);
    const { webp } = getOptimizedImageUrls(localizedPath);
    return preloadedImages.get(webp) ?? null;
}

/**
 * 查询图片是否已被预加载（供渲染组件跳过 shimmer）
 * 接受原始资源路径（自动转换）或已转换的 optimized URL
 * 
 * 只有真正加载成功的图片（naturalWidth > 0）才返回 true。
 */
export function isImagePreloaded(src: string, locale?: string): boolean {
    const check = (url: string) => {
        const el = preloadedImages.get(url);
        return el != null && el.naturalWidth > 0;
    };

    if (check(src)) return true;

    const effectiveLocale = locale || 'zh-CN';
    const localizedPath = getLocalizedAssetPath(src, effectiveLocale);

    // 如果 src 已经是 compressed/ 下的 URL，直接检查 webp 变体
    if (localizedPath.includes(`/${COMPRESSED_SUBDIR}/`)) {
        const base = stripExtension(localizedPath);
        return check(`${base}.webp`);
    }

    // 转换为 optimized URL 后检查
    const { webp } = getOptimizedImageUrls(localizedPath);
    return check(webp);
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

/**
 * 通过 <link rel="preload"> 预加载图片（浏览器标准方案）
 *
 * 与 new Image() 不同，<link rel="preload" as="image"> 有两个关键优势：
 * 1. 浏览器给予高优先级（High），高于 XHR 的默认优先级
 * 2. 预加载的资源会进入 HTTP 缓存，后续 CSS background-image 请求直接命中，
 *    不会重新发起网络请求（new Image() 在某些 CDN 缓存策略下不保证复用）
 *
 * 注意：不设置 crossorigin 属性，因为 CSS background-image 以 no-cors 模式请求。
 * 如果 preload 用 crossorigin="anonymous"（CORS 模式），浏览器会认为是不同的缓存键，
 * 导致 background-image 无法复用预加载缓存。preload 的请求模式必须与消费方一致。
 *
 * 这是 W3C 标准的资源优先级方案，所有现代浏览器均支持。
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/preload
 */
function injectPreloadLink(src: string): HTMLLinkElement | null {
    if (typeof document === 'undefined') return null;
    // 避免重复注入
    const existing = document.querySelector(`link[rel="preload"][href="${CSS.escape(src)}"]`);
    if (existing) return existing as HTMLLinkElement;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    // 不设置 crossOrigin — 与 CSS background-image 的 no-cors 模式保持一致，
    // 确保浏览器复用同一个缓存条目
    document.head.appendChild(link);
    return link;
}

/** 清理已完成的 preload link（避免 <head> 堆积） */
function removePreloadLink(src: string): void {
    if (typeof document === 'undefined') return;
    const link = document.querySelector(`link[rel="preload"][href="${CSS.escape(src)}"]`);
    if (link) link.remove();
}

async function preloadImageWithResult(src: string, timeoutMs?: number): Promise<boolean> {
    return new Promise((resolve) => {
        let done = false;
        // 同时注入 <link rel="preload"> 确保浏览器高优先级加载 + HTTP 缓存复用
        injectPreloadLink(src);
        const img = new Image();
        // 不设置 crossOrigin — 与 CSS background-image 的 no-cors 模式保持一致
        const finish = (ok: boolean) => {
            if (done) return;
            done = true;
            // 加载完成后清理 preload link
            removePreloadLink(src);
            resolve(ok);
        };
        const timer = timeoutMs != null
            ? setTimeout(() => {
                console.debug(`[AssetLoader] 图片加载超时（${timeoutMs}ms），跳过: ${src}`);
                // 超时 ≠ 失败：浏览器的 Image 请求仍在后台继续。
                // 注册后台回调，加载完成后自动更新缓存并通知 UI 组件。
                img.onload = () => {
                    preloadedImages.set(src, img);
                    removePreloadLink(src);
                    // 通知订阅者：超时的图片已在后台加载完成
                    _emitImageReady(src);
                };
                finish(false);
            }, timeoutMs)
            : null;
        img.onload = () => {
            if (timer) clearTimeout(timer);
            preloadedImages.set(src, img);
            finish(true);
        };
        img.onerror = () => {
            if (timer) clearTimeout(timer);
            console.debug(`[AssetLoader] 图片加载失败（将尝试备选格式）: ${src}`);
            finish(false);
        };
        img.src = src;
    });
}

/** 图片加载失败计数（超过阈值后标记为已处理，避免每次阶段切换都重新等待 10s 超时） */
const preloadFailCount = new Map<string, number>();
const MAX_PRELOAD_RETRIES = 2;

/** 正在加载中的 Promise 去重表，避免同一 URL 并发多次请求 */
const inFlightPreloads = new Map<string, Promise<void>>();

async function preloadOptimizedImage(src: string): Promise<void> {
    const { webp } = getOptimizedImageUrls(src);
    if (!webp) return;
    // 已成功加载过的跳过（naturalWidth > 0 表示真正加载成功）
    const cached = preloadedImages.get(webp);
    if (cached && cached.naturalWidth > 0) return;
    // 同一 URL 正在加载中 → 复用已有 Promise，不发新请求
    const inFlight = inFlightPreloads.get(webp);
    if (inFlight) return inFlight;
    const promise = (async () => {
        const ok = await preloadImageWithResult(webp, SINGLE_IMAGE_TIMEOUT_MS);
        if (!ok) {
            // 超时/失败：记录失败次数。
            // 只有真正失败（onerror，如 404）才累计；超时的图片仍在后台加载，
            // preloadImageWithResult 的超时回调会在加载完成后自动更新 preloadedImages。
            // 超过阈值后标记为已处理（空 Image 占位），避免持续 404 的图片
            // 导致每次阶段切换都重新等待超时。
            const count = (preloadFailCount.get(webp) ?? 0) + 1;
            preloadFailCount.set(webp, count);
            if (count >= MAX_PRELOAD_RETRIES) {
                // 只有缓存中没有任何引用时才放空占位（避免覆盖超时回调写入的有效 Image）
                if (!preloadedImages.has(webp)) {
                    preloadedImages.set(webp, new Image());
                }
            }
        }
    })();
    inFlightPreloads.set(webp, promise);
    promise.finally(() => inFlightPreloads.delete(webp));
    return promise;
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
    if (src.includes('?raw') || src.includes('&raw')) return true;
    // HTTP URL 但不是内部资源域名 → 穿透
    if (isHttpUrl(src) && !isInternalAssetsUrl(src)) return true;
    return false;
};
const isSvgSource = (src: string) => /\.svg(\?|#|$)/i.test(src);

/** 移除扩展名 */
const stripExtension = (src: string) => {
    if (isPassthroughSource(src)) return src;
    return src.replace(/\.(webp|png|jpe?g)$/i, '');
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
 * 获取优化图片 URL（webp）
 * 用于 <img> src
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

    // 防御性检查：如果路径已包含 /compressed/，不再重复插入
    if (dir.endsWith(`/${COMPRESSED_SUBDIR}`) || dir === COMPRESSED_SUBDIR) {
        const webpUrl = `${base}.webp`;
        return { avif: webpUrl, webp: webpUrl };
    }

    const compressedBase = dir ? `${dir}/${COMPRESSED_SUBDIR}/${filename}` : `${COMPRESSED_SUBDIR}/${filename}`;
    const webpUrl = `${compressedBase}.webp`;
    return {
        avif: webpUrl,  // 统一使用 webp，avif 收益不大且增加复杂度
        webp: webpUrl,
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
 * 
 * 回退策略：
 * - 中文 (zh-CN) → 英文 (en)
 * - 英文 (en) → 中文 (zh-CN)
 * - 其他语言 → 英文 (en) → 中文 (zh-CN)
 * 
 * 这样确保中文和英文素材必有一个可用，未来添加新语言素材时自动生效。
 */
export function getLocalizedImageUrls(src: string, locale?: string): LocalizedImageUrls {
    if (!locale || isPassthroughSource(src)) {
        const urls = getOptimizedImageUrls(src);
        console.log('[AssetLoader] getLocalizedImageUrls (no locale):', { src, urls });
        return { primary: urls, fallback: urls };
    }
    
    const localizedPath = getLocalizedAssetPath(src, locale);
    const primary = getOptimizedImageUrls(localizedPath);
    
    // 回退逻辑：中文 ↔ 英文互为回退
    let fallbackLocale: string;
    if (locale === 'zh-CN') {
        fallbackLocale = 'en';
    } else if (locale === 'en') {
        fallbackLocale = 'zh-CN';
    } else {
        // 其他语言先回退到英文
        fallbackLocale = 'en';
    }
    
    const fallbackPath = getLocalizedAssetPath(src, fallbackLocale);
    const fallback = getOptimizedImageUrls(fallbackPath);
    
    console.log('[AssetLoader] getLocalizedImageUrls:', {
        src,
        locale,
        fallbackLocale,
        localizedPath,
        fallbackPath,
        primaryUrl: primary.webp,
        fallbackUrl: fallback.webp
    });
    
    return { primary, fallback };
}

/**
 * 构建语言化图片集（用于 CSS background-image）
 * 
 * 所有素材已迁移到国际化目录，统一使用 webp 格式。
 */
export function buildLocalizedImageSet(src: string, locale?: string): string {
    if (!isString(src) || !src) {
        console.warn(`[AssetLoader] invalid_src type=${typeof src} value=${String(src)}`);
        return '';
    }
    const { primary } = getLocalizedImageUrls(src, locale);
    return `url("${primary.webp}")`;
}

/**
 * 构建优化图片集（用于 CSS background-image）
 * 统一使用 webp 格式
 */
export function buildOptimizedImageSet(src: string): string {
    const { webp } = getOptimizedImageUrls(src);
    return `url("${webp}")`;
}

/**
 * 获取直接路径（不经过注册表）
 * 用于简单场景，直接拼接 /assets/ 前缀
 */
export function getDirectAssetPath(relativePath: string): string {
    return assetsPath(relativePath);
}

/**
 * 构建本地资源路径（始终走 /assets/，不走 CDN）
 * 用于 JSON 配置文件等不应上传到 R2 的资源
 */
export function getLocalAssetPath(path: string): string {
    if (!isString(path) || !path) return '/assets';
    if (isPassthroughSource(path)) return path;
    const trimmed = path.startsWith('/') ? path.slice(1) : path;
    return `/assets/${trimmed}`;
}

/**
 * 构建本地语言化资源路径（始终走 /assets/，不走 CDN）
 * 用于 JSON 配置文件等不应上传到 R2 的资源
 */
export function getLocalizedLocalAssetPath(path: string, locale?: string): string {
    if (!locale || isPassthroughSource(path)) return getLocalAssetPath(path);
    // 去掉可能的前缀
    let relative = path;
    if (relative.startsWith('/assets/')) relative = relative.slice('/assets/'.length);
    if (relative.startsWith(assetsBaseUrl + '/')) relative = relative.slice(assetsBaseUrl.length + 1);
    relative = relative.replace(/^\/+/, '');
    // 幂等性检查
    const localizedPrefix = `${LOCALIZED_ASSETS_SUBDIR}/${locale}/`;
    if (relative.startsWith(localizedPrefix)) return `/assets/${relative}`;
    return `/assets/${localizedPrefix}${relative}`;
}
