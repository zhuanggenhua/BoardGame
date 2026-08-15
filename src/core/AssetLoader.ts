/**
 * 游戏资源加载器
 * 
 * 提供统一的资源路径解析、预加载和缓存管理。
 * 资源基址默认策略：
 * - 开发 / E2E：默认走本地 /assets
 * - 生产：默认走官方资源域名
 * - 显式配置 VITE_ASSETS_BASE_URL 时优先使用显式值
 */

import type { GameAssets, SpriteAtlasDefinition, CriticalImageResolverResult } from './types';
import { resolveCriticalImages } from './CriticalImageResolverRegistry';

// ============================================================================
// 资源路径常量
// ============================================================================

const DEFAULT_ASSETS_BASE_URL = 'https://assets.easyboardgame.top/official';
const LOCAL_ASSETS_BASE_URL = '/assets';
const COMPRESSED_SUBDIR = 'compressed';
const LOCALIZED_ASSETS_SUBDIR = 'i18n';
const VERSION_PARAM = 'v';
const COMMON_AUDIO_BASE_PATH = 'common/audio';
const IMAGE_READY_HINT_STORAGE_KEY = '__BG_IMAGE_READY_HINTS__';
const IMAGE_READY_HINT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const IMAGE_CANDIDATE_FAILURE_RETRY_MS = 30_000;

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

type AssetSourceMode = 'auto' | 'local' | 'remote';

const normalizeAssetSourceMode = (value?: string): AssetSourceMode | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'auto' || normalized === 'local' || normalized === 'remote') {
        return normalized;
    }
    return null;
};

type AssetEnvLike = {
    DEV?: boolean | string;
    VITE_ASSETS_BASE_URL?: string;
    VITE_ASSET_SOURCE?: string;
    VITE_DEV_REMOTE_ASSETS?: string;
};

export function resolveAssetsBaseUrlFromEnv(env?: AssetEnvLike): string {
    const explicitBaseUrl = normalizeAssetsBaseUrl(env?.VITE_ASSETS_BASE_URL);
    if (explicitBaseUrl) return explicitBaseUrl;

    const sourceMode = normalizeAssetSourceMode(env?.VITE_ASSET_SOURCE) ?? 'auto';
    if (sourceMode === 'local') return LOCAL_ASSETS_BASE_URL;
    if (sourceMode === 'remote') return DEFAULT_ASSETS_BASE_URL;

    return env?.DEV === true || env?.DEV === 'true'
        ? LOCAL_ASSETS_BASE_URL
        : DEFAULT_ASSETS_BASE_URL;
}

/**
 * 资源基址。
 * 默认按环境自动选择，也允许通过 setAssetsBaseUrl 进行覆盖。
 */
let assetsBaseUrl = resolveAssetsBaseUrlFromEnv(import.meta.env);
let assetHashes: Record<string, string> = typeof __ASSET_HASHES__ !== 'undefined' ? __ASSET_HASHES__ : {};
let localizedImageIndex: Record<string, 1> = typeof __LOCALIZED_IMAGE_INDEX__ !== 'undefined' ? __LOCALIZED_IMAGE_INDEX__ : {};
const gameAssetBaseOverrides = new Map<string, string>();
let commonAudioAssetBaseOverride: string | undefined;
let persistentImageReadyHints: Map<string, number> | null = null;

export function setAssetsBaseUrl(value?: string): void {
    assetsBaseUrl = normalizeAssetsBaseUrl(value) ?? resolveAssetsBaseUrlFromEnv(import.meta.env);
}

export function getAssetsBaseUrl(): string {
    return assetsBaseUrl;
}

const shouldUseRemoteAssetsInLiteDev = () => (
    import.meta.env.DEV
    && import.meta.env.VITE_DEV_REMOTE_ASSETS === 'true'
    && /^https?:\/\//i.test(assetsBaseUrl)
);

export function setCommonAudioAssetBaseOverride(value?: string): void {
    commonAudioAssetBaseOverride = normalizeAssetsBaseUrl(value) ?? undefined;
}

export function setGameAssetBaseOverride(gameId: string, value?: string): void {
    const normalizedGameId = typeof gameId === 'string' ? gameId.trim() : '';
    if (!normalizedGameId) {
        return;
    }

    const normalizedValue = normalizeAssetsBaseUrl(value);
    if (!normalizedValue) {
        gameAssetBaseOverrides.delete(normalizedGameId);
        return;
    }

    gameAssetBaseOverrides.set(normalizedGameId, normalizedValue);
}

export function clearGameAssetBaseOverrides(): void {
    gameAssetBaseOverrides.clear();
}

/**
 * 允许测试环境覆盖构建期注入的资源 hash 映射。
 * 生产运行时不需要调用。
 */
export function setAssetHashesForTesting(value?: Record<string, string>): void {
    assetHashes = value ?? {};
}

/**
 * 允许测试环境覆盖构建期注入的语言化图片存在索引。
 * 生产运行时不需要调用。
 */
export function setLocalizedImageIndexForTesting(value?: Record<string, 1>): void {
    localizedImageIndex = value ?? {};
}

export function __resetAssetLoaderCachesForTests(options?: { keepPersistentHints?: boolean }): void {
    preloadedImages.clear();
    preloadedAudio.clear();
    resolvedImageUrls.clear();
    imageCandidateFailures.clear();
    preloadFailCount.clear();
    inFlightPreloads.clear();

    if (options?.keepPersistentHints) {
        persistentImageReadyHints = null;
        return;
    }

    persistentImageReadyHints = new Map();
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.removeItem(IMAGE_READY_HINT_STORAGE_KEY);
        } catch {
            // ignore storage reset failures in tests
        }
    }
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
        resolvedImageUrls: Map<string, string>;
        imageCandidateFailures: Map<string, { failedAt: number; count: number }>;
    };
} : undefined;

if (_win && !_win.__BG_ASSET_CACHE__) {
    _win.__BG_ASSET_CACHE__ = {
        gameAssetsRegistry: new Map(),
        preloadedImages: new Map(),
        preloadedAudio: new Map(),
        resolvedImageUrls: new Map(),
        imageCandidateFailures: new Map(),
    };
}

const gameAssetsRegistry = _win?.__BG_ASSET_CACHE__?.gameAssetsRegistry ?? new Map<string, GameAssets>();
const preloadedImages = _win?.__BG_ASSET_CACHE__?.preloadedImages ?? new Map<string, HTMLImageElement>();
const preloadedAudio = _win?.__BG_ASSET_CACHE__?.preloadedAudio ?? new Map<string, HTMLAudioElement>();
const resolvedImageUrls = _win?.__BG_ASSET_CACHE__?.resolvedImageUrls ?? new Map<string, string>();
const imageCandidateFailures = _win?.__BG_ASSET_CACHE__?.imageCandidateFailures ?? new Map<string, { failedAt: number; count: number }>();

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

    const preloadCriticalImageCandidates = async (path: string): Promise<void> => {
        const candidates = getRuntimeImageCandidateUrls(path, effectiveLocale);
        if (candidates.length === 0) return;
        for (const candidate of candidates) {
            if (isImagePreloaded(candidate)) return;
            await preloadOptimizedImage(candidate);
            if (isImagePreloaded(candidate)) return;
        }
    };

    const runWorker = async (): Promise<void> => {
        while (cursor < filtered.length) {
            const p = filtered[cursor++];
            await preloadCriticalImageCandidates(p);
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
        const candidates = getLocalizedImageCandidateUrls(p, effectiveLocale);
        if (candidates.length === 0) return false;
        const hasLoadedCandidate = candidates.some((candidate) => hasImageReadyEvidence(candidate, effectiveLocale));
        if (!hasLoadedCandidate) return false;
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

const getImageFallbackLocale = (locale: string): string => {
    if (locale === 'zh-CN') return 'en';
    if (locale === 'en') return 'zh-CN';
    return 'en';
};

/**
 * 将已加载的图片 URL 注册到缓存（供 OptimizedImage 在 onLoad 时调用）
 * 这样同一张图片的其他实例可以跳过 shimmer。
 *
 * @param imgElement 可选，传入已加载成功的 HTMLImageElement（naturalWidth > 0），
 *   确保 isImagePreloaded 能正确判断。未传时创建占位 Image 并设置 src，
 *   浏览器通常会从磁盘缓存命中使 naturalWidth 立即可用。
 */
function normalizePreloadedImageCacheKey(src: string, locale?: string): string {
    const effectiveLocale = locale || 'zh-CN';
    const normalized = assetsPath(src);

    if (!normalized) return '';

    if (normalized.includes(`/${COMPRESSED_SUBDIR}/`)) {
        return replaceImageExtension(normalized, '.webp');
    }

    return getOptimizedImageUrls(getLocalizedAssetPath(normalized, effectiveLocale)).webp;
}

function replaceImageExtension(src: string, nextExtension: string): string {
    const { path, query, hash } = splitUrlParts(src);
    const normalizedPath = path.replace(/\.(avif|webp|png|jpe?g|gif|svg)$/i, '');
    return `${normalizedPath}${nextExtension}${query ? `?${query}` : ''}${hash}`;
}

function stripVersionParam(value: string): string {
    const { path, query, hash } = splitUrlParts(value);
    if (!query) return value;
    const params = new URLSearchParams(query);
    if (!params.has(VERSION_PARAM)) return value;
    params.delete(VERSION_PARAM);
    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}${hash}` : `${path}${hash}`;
}

function toCanonicalAssetCacheKey(value: string): string {
    if (!isString(value) || !value || isPassthroughSource(value)) {
        return '';
    }

    const normalized = assetsPath(value);
    if (!normalized || isPassthroughSource(normalized)) {
        return '';
    }

    const { path, query } = splitUrlParts(normalized);
    const relativeKey = stripKnownAssetPrefixes(path);
    if (!relativeKey) {
        return '';
    }

    const version = new URLSearchParams(query).get(VERSION_PARAM);
    return version ? `${relativeKey}?${VERSION_PARAM}=${version}` : relativeKey;
}

function getPersistentImageReadyHintKeys(src: string, locale?: string): string[] {
    const keys = new Set<string>();
    const normalizedKey = normalizePreloadedImageCacheKey(src, locale);
    const normalizedCanonical = toCanonicalAssetCacheKey(normalizedKey);
    if (normalizedCanonical) {
        keys.add(normalizedCanonical);
    }

    const exactKey = assetsPath(src);
    const exactCanonical = toCanonicalAssetCacheKey(exactKey);
    if (exactCanonical) {
        keys.add(exactCanonical);
    }

    return [...keys];
}

function loadPersistentImageReadyHints(): Map<string, number> {
    if (persistentImageReadyHints) {
        return persistentImageReadyHints;
    }

    const now = Date.now();
    const hints = new Map<string, number>();

    if (typeof window !== 'undefined') {
        try {
            const raw = window.localStorage.getItem(IMAGE_READY_HINT_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Record<string, unknown>;
                Object.entries(parsed).forEach(([key, value]) => {
                    if (typeof value !== 'number' || !Number.isFinite(value)) {
                        return;
                    }
                    if (now - value > IMAGE_READY_HINT_TTL_MS) {
                        return;
                    }
                    hints.set(key, value);
                });
            }
        } catch {
            // ignore malformed / unavailable storage
        }
    }

    persistentImageReadyHints = hints;
    return hints;
}

function persistImageReadyHints(): void {
    if (typeof window === 'undefined' || !persistentImageReadyHints) {
        return;
    }

    try {
        const serialized = JSON.stringify(Object.fromEntries(persistentImageReadyHints.entries()));
        window.localStorage.setItem(IMAGE_READY_HINT_STORAGE_KEY, serialized);
    } catch {
        // ignore quota / storage failures
    }
}

function rememberPersistentImageReadyHint(src: string, locale?: string): void {
    const keys = getPersistentImageReadyHintKeys(src, locale);
    if (keys.length === 0) {
        return;
    }

    const hints = loadPersistentImageReadyHints();
    const now = Date.now();
    keys.forEach((key) => hints.set(key, now));
    persistImageReadyHints();
}

function hasPersistentImageReadyHint(src: string, locale?: string): boolean {
    const keys = getPersistentImageReadyHintKeys(src, locale);
    if (keys.length === 0) {
        return false;
    }

    const hints = loadPersistentImageReadyHints();
    return keys.some((key) => hints.has(key));
}

function getSynchronousImageProbeUrls(src: string, locale?: string): string[] {
    const urls = new Set<string>();
    const pushProbeUrl = (url: string) => {
        if (!url) return;
        urls.add(url);

        // 无 query 的探测只对 Capacitor 本地文件有价值：部分 Android
        // WebView 对 file-like URL 的 query 支持不稳定。对普通 HTTP 资源，
        // 给 Image.src 赋值就是一次真实网络请求；再探测无版本 URL 会把
        // 同一张大图按第二个缓存键重新下载。
        if (!isCapacitorFileAssetUrl(url)) return;
        const unversioned = stripVersionParam(url);
        if (unversioned) {
            urls.add(unversioned);
        }
    };

    const exactKey = assetsPath(src);
    if (exactKey) {
        pushProbeUrl(exactKey);
    }

    const normalizedKey = normalizePreloadedImageCacheKey(src, locale);
    if (normalizedKey) {
        pushProbeUrl(normalizedKey);
    }

    return [...urls].filter(Boolean);
}

function probeSynchronousImageReady(src: string, locale?: string): boolean {
    for (const url of getSynchronousImageProbeUrls(src, locale)) {
        const testImg = new Image();
        testImg.src = url;
        if (testImg.complete && testImg.naturalWidth > 0) {
            cacheLoadedImage(url, testImg, locale);
            return true;
        }
    }
    return false;
}

function hasImageReadyEvidence(src: string, locale?: string): boolean {
    if (isImagePreloaded(src, locale)) {
        return true;
    }

    if (hasPersistentImageReadyHint(src, locale)) {
        return true;
    }

    return probeSynchronousImageReady(src, locale);
}

function getPreloadedImageCacheKeys(src: string, locale?: string): string[] {
    const keys = new Set<string>();
    const exactKey = assetsPath(src);
    if (exactKey) {
        keys.add(exactKey);
        keys.add(stripVersionParam(exactKey));
        const exactCanonical = toCanonicalAssetCacheKey(exactKey);
        if (exactCanonical) {
            keys.add(exactCanonical);
            keys.add(stripVersionParam(exactCanonical));
        }
    }

    const normalizedKey = normalizePreloadedImageCacheKey(src, locale);
    if (normalizedKey) {
        keys.add(normalizedKey);
        keys.add(stripVersionParam(normalizedKey));
        const normalizedCanonical = toCanonicalAssetCacheKey(normalizedKey);
        if (normalizedCanonical) {
            keys.add(normalizedCanonical);
            keys.add(stripVersionParam(normalizedCanonical));
        }
    }

    return [...keys];
}

function getImageCandidateRuntimeKey(src: string, locale?: string, candidateUrl?: string): string {
    const effectiveLocale = locale || 'zh-CN';
    const sourceKey = toCanonicalAssetCacheKey(normalizePreloadedImageCacheKey(src, effectiveLocale))
        || toCanonicalAssetCacheKey(assetsPath(src))
        || src;
    const resolvedCandidate = candidateUrl ? stripVersionParam(assetsPath(candidateUrl)) : '';
    return `${effectiveLocale}|${sourceKey}|${resolvedCandidate}`;
}

function rememberImageCandidateFailure(src: string, locale: string | undefined, candidateUrl: string): void {
    const key = getImageCandidateRuntimeKey(src, locale, candidateUrl);
    const record = imageCandidateFailures.get(key);
    imageCandidateFailures.set(key, {
        failedAt: Date.now(),
        count: (record?.count ?? 0) + 1,
    });
}

function forgetImageCandidateFailure(src: string, locale: string | undefined, candidateUrl?: string): void {
    if (!candidateUrl) return;
    imageCandidateFailures.delete(getImageCandidateRuntimeKey(src, locale, candidateUrl));
}

function isImageCandidateRecentlyFailed(src: string, locale: string | undefined, candidateUrl: string): boolean {
    const record = imageCandidateFailures.get(getImageCandidateRuntimeKey(src, locale, candidateUrl));
    if (!record) return false;
    return Date.now() - record.failedAt < IMAGE_CANDIDATE_FAILURE_RETRY_MS;
}

function orderImageCandidatesByRuntimeState(src: string, locale: string, candidateUrls: readonly string[]): string[] {
    if (candidateUrls.length === 0) return [];
    const preferred: string[] = [];
    const deferred: string[] = [];
    for (const candidateUrl of candidateUrls) {
        if (isImageCandidateRecentlyFailed(src, locale, candidateUrl)) {
            deferred.push(candidateUrl);
        } else {
            preferred.push(candidateUrl);
        }
    }
    return preferred.length > 0 ? [...preferred, ...deferred] : [...candidateUrls];
}

function cacheLoadedImage(src: string, imgElement: HTMLImageElement, locale?: string, resolvedUrl?: string): void {
    const keys = getPreloadedImageCacheKeys(src, locale);
    const effectiveResolvedUrl = resolvedUrl || imgElement.currentSrc || imgElement.src || '';
    for (const key of keys) {
        preloadedImages.set(key, imgElement);
        if (effectiveResolvedUrl) {
            resolvedImageUrls.set(key, effectiveResolvedUrl);
        }
        forgetImageCandidateFailure(src, locale, effectiveResolvedUrl);
    }
    rememberPersistentImageReadyHint(src, locale);
    _emitImageReady(src);
    keys.forEach((key) => _emitImageReady(key));
}

export function markImageLoaded(src: string, locale?: string, imgElement?: HTMLImageElement, resolvedUrl?: string): void {
    const cacheKeys = getPreloadedImageCacheKeys(src, locale);
    if (cacheKeys.length === 0) return;
    if (imgElement && imgElement.naturalWidth > 0) {
        cacheLoadedImage(src, imgElement, locale, resolvedUrl);
    } else {
        // 回退：创建 Image 并设置 src，浏览器磁盘缓存命中时 naturalWidth 立即可用
        const img = new Image();
        img.src = cacheKeys[0];
        for (const key of cacheKeys) {
            preloadedImages.set(key, img);
        }
    }
}

/**
 * 获取已预加载的 HTMLImageElement（供图集懒解析尺寸）
 * 接受原始资源路径（自动转换为 optimized URL 后查找缓存）
 * 返回 null 表示图片尚未预加载
 */
export function getPreloadedImageElement(src: string, locale?: string): HTMLImageElement | null {
    for (const key of [src, ...getPreloadedImageCacheKeys(src, locale)]) {
        const cached = preloadedImages.get(key);
        if (cached) {
            return cached;
        }
    }
    return null;
}

/**
 * 获取缓存中真实加载成功的图片 URL。
 *
 * 这是渲染组件恢复成功候选的统一入口：同一逻辑资源如果曾经从 fallback
 * 候选加载成功，后续重新挂载时必须复用 img.currentSrc/img.src，而不是重新
 * 回到候选链起点。
 */
export function getResolvedImageCacheUrl(src: string, locale?: string): string {
    for (const key of [src, ...getPreloadedImageCacheKeys(src, locale)]) {
        const cached = preloadedImages.get(key);
        if (!cached || cached.naturalWidth <= 0) {
            continue;
        }

        return resolvedImageUrls.get(key) || cached.currentSrc || cached.src || '';
    }

    return '';
}

/**
 * 从一组候选 URL 中恢复已经命中的真实 URL。
 *
 * candidateUrls 用于精确匹配当前候选链；sourceImage 作为逻辑资源兜底，
 * 用于处理资源 base/override 变化后，缓存里仍保存着上一轮真实 currentSrc
 * 的情况。
 */
export function getResolvedImageCandidateUrl(
    candidateUrls: readonly string[],
    sourceImage?: string,
    locale?: string,
): string {
    for (const candidateUrl of candidateUrls) {
        const resolved = getResolvedImageCacheUrl(candidateUrl);
        if (resolved) {
            return resolved;
        }
    }

    return sourceImage ? getResolvedImageCacheUrl(sourceImage, locale) : '';
}

export function getRuntimeImageCandidateUrls(src: string, locale: string): string[] {
    return orderImageCandidatesByRuntimeState(src, locale, getLocalizedImageCandidateUrls(src, locale));
}

export function markImageCandidateFailed(src: string, locale: string | undefined, candidateUrl: string): void {
    if (!candidateUrl) return;
    rememberImageCandidateFailure(src, locale, candidateUrl);
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

    for (const key of getPreloadedImageCacheKeys(src, locale)) {
        if (check(key)) {
            return true;
        }
    }

    return false;
}

// ============================================================================
// 内部辅助函数
// ============================================================================

async function preloadImage(src: string): Promise<void> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            cacheLoadedImage(src, img);
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
        const settleFromDimensions = () => {
            if (img.naturalWidth > 0) {
                cacheLoadedImage(src, img);
                finish(true);
                return true;
            }
            return false;
        };
        const timer = timeoutMs != null
            ? setTimeout(() => {
                console.debug(`[AssetLoader] 图片加载超时（${timeoutMs}ms），跳过: ${src}`);
                if (settleFromDimensions()) {
                    return;
                }
                // 超时 ≠ 失败：浏览器的 Image 请求仍在后台继续。
                // 注册后台回调，加载完成后自动更新缓存并通知 UI 组件。
                img.onload = () => {
                    cacheLoadedImage(src, img);
                    removePreloadLink(src);
                    // 通知订阅者：超时的图片已在后台加载完成
                    _emitImageReady(src);
                };
                finish(false);
            }, timeoutMs)
            : null;
        img.onload = () => {
            if (timer) clearTimeout(timer);
            cacheLoadedImage(src, img);
            finish(true);
        };
        img.onerror = () => {
            if (timer) clearTimeout(timer);
            console.debug(`[AssetLoader] 图片加载失败（将尝试备选格式）: ${src}`);
            finish(false);
        };
        img.src = src;
        if (img.complete && settleFromDimensions()) {
            if (timer) clearTimeout(timer);
        }
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

    // 优先吃内存缓存 / 同步磁盘缓存命中，避免刷新后因为运行时 Map 丢失而再次阻塞。
    if (probeSynchronousImageReady(webp)) {
        return;
    }

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
const stripKnownAssetPrefixes = (value: string) => {
    const { path } = splitUrlParts(value);
    if (path.startsWith('/assets/')) {
        return path.slice('/assets/'.length);
    }
    if (path === assetsBaseUrl) {
        return '';
    }
    if (path.startsWith(`${assetsBaseUrl}/`)) {
        return path.slice(assetsBaseUrl.length + 1);
    }
    for (const overrideBase of gameAssetBaseOverrides.values()) {
        if (path === overrideBase) {
            return '';
        }
        if (path.startsWith(`${overrideBase}/`)) {
            return path.slice(overrideBase.length + 1);
        }
    }
    return path.replace(/^\/+/, '');
};
const resolveGameIdFromAssetRelativePath = (value: string) => {
    const trimmed = stripKnownAssetPrefixes(value);
    if (!trimmed) {
        return undefined;
    }

    const segments = trimmed.split('/').filter(Boolean);
    if (segments.length === 0) {
        return undefined;
    }

    if (segments[0] === LOCALIZED_ASSETS_SUBDIR && segments.length >= 3) {
        return segments[2];
    }
    if (segments[0] === 'atlas-configs' && segments.length >= 2) {
        return segments[1];
    }
    return segments[0];
};
const resolveAssetBaseUrlForPath = (value: string) => {
    if (commonAudioAssetBaseOverride) {
        const trimmed = stripKnownAssetPrefixes(value);
        if (trimmed === COMMON_AUDIO_BASE_PATH || trimmed.startsWith(`${COMMON_AUDIO_BASE_PATH}/`)) {
            return commonAudioAssetBaseOverride;
        }
    }
    const gameId = resolveGameIdFromAssetRelativePath(value);
    return gameId ? gameAssetBaseOverrides.get(gameId) : undefined;
};
const isInternalAssetsUrl = (src: string) => {
    if (src.startsWith(assetsBaseUrl) || src.startsWith(`${assetsBaseUrl}/`)) {
        return true;
    }
    for (const overrideBase of gameAssetBaseOverrides.values()) {
        if (src.startsWith(overrideBase) || src.startsWith(`${overrideBase}/`)) {
            return true;
        }
    }
    return false;
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
const isCapacitorFileAssetUrl = (src: string) => {
    const { path } = splitUrlParts(src);
    return /^https?:\/\/[^/]+\/_capacitor_file_\//i.test(path)
        || path.startsWith('/_capacitor_file_/');
};
const isLocalBrowserAssetOrigin = () => {
    const maybeProcess = (globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
    }).process;
    if (maybeProcess?.env?.VITEST) {
        return false;
    }
    if (typeof window === 'undefined') {
        return false;
    }

    const hostname = window.location?.hostname?.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
};

const isSameOriginAsCurrentPage = (url: string) => {
    if (typeof window === 'undefined' || !window.location?.origin) {
        return false;
    }
    try {
        return new URL(url, window.location.href).origin === window.location.origin;
    } catch {
        return false;
    }
};

const shouldCollapseSameOriginAssetCandidates = () => (
    isHttpUrl(assetsBaseUrl) && isSameOriginAsCurrentPage(assetsBaseUrl)
);

const getEquivalentAssetCandidateKey = (url: string) => {
    if (!url || isCapacitorFileAssetUrl(url)) {
        return '';
    }

    const { path } = splitUrlParts(url);
    let candidatePath = path;
    if (isHttpUrl(path)) {
        try {
            candidatePath = new URL(path).pathname;
        } catch {
            candidatePath = path;
        }
    }

    const relative = stripKnownAssetPrefixes(candidatePath);
    if (!relative) {
        return '';
    }

    return relative.replace(/^official\//, '');
};

const collapseSameOriginAssetCandidates = (candidateUrls: string[]) => {
    const exactUnique = candidateUrls.filter((url, index, list): url is string => (
        Boolean(url) && list.indexOf(url) === index
    ));

    if (!shouldCollapseSameOriginAssetCandidates()) {
        return exactUnique;
    }

    const seen = new Set<string>();
    return exactUnique.filter((url) => {
        const key = getEquivalentAssetCandidateKey(url);
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

/** 移除扩展名 */
const stripExtension = (src: string) => {
    if (isPassthroughSource(src)) return src;
    const { path } = splitUrlParts(src);
    return path.replace(/\.(avif|webp|png|jpe?g|gif|svg)$/i, '');
};

const stripAssetsBasePrefix = (normalized: string) => {
    return stripKnownAssetPrefixes(normalized);
};

const splitUrlParts = (value: string) => {
    const hashIndex = value.indexOf('#');
    const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
    const queryIndex = withoutHash.indexOf('?');
    return {
        path: queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash,
        query: queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '',
        hash,
    };
};

const resolveVersionedAssetUrl = (value: string) => {
    if (!isString(value) || !value || isPassthroughSource(value)) return value;

    const { path, query, hash } = splitUrlParts(value);
    const relativeKey = stripAssetsBasePrefix(path);
    if (!relativeKey) return value;

    const version = assetHashes[relativeKey];
    if (!version) return value;

    const params = new URLSearchParams(query);
    if (params.get(VERSION_PARAM) === version) return value;
    params.set(VERSION_PARAM, version);

    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}${hash}` : `${path}${hash}`;
};

const resolveVersionedRemoteAssetUrl = (value: string, relativeKey: string) => {
    if (!isString(value) || !value) return value;

    const version = assetHashes[relativeKey];
    if (!version) return value;

    const { path, query, hash } = splitUrlParts(value);
    const params = new URLSearchParams(query);
    if (params.get(VERSION_PARAM) === version) return value;
    params.set(VERSION_PARAM, version);

    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}${hash}` : `${path}${hash}`;
};

/**
 * 规范化资源路径，统一添加当前资源基址
 * 支持相对路径转换
 */
export function assetsPath(path: string): string {
    if (!isString(path)) return '';
    if (isPassthroughSource(path)) return path;
    const overrideBaseUrl = resolveAssetBaseUrlForPath(path);
    if (!path) return overrideBaseUrl || assetsBaseUrl;
    if (overrideBaseUrl) {
        const relativePath = stripKnownAssetPrefixes(path);
        if (!relativePath) {
            return overrideBaseUrl;
        }
        return `${overrideBaseUrl}/${relativePath}`;
    }
    if (path === assetsBaseUrl || path.startsWith(`${assetsBaseUrl}/`)) return resolveVersionedAssetUrl(path);
    if (path.startsWith('/assets/')) return resolveVersionedAssetUrl(path);
    const trimmed = path.startsWith('/') ? path.slice(1) : path;
    return resolveVersionedAssetUrl(`${assetsBaseUrl}/${trimmed}`);
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
        return {
            avif: resolveVersionedAssetUrl(normalized),
            webp: resolveVersionedAssetUrl(normalized),
        };
    }
    // 压缩图片在 compressed/ 子目录
    const base = stripExtension(normalized);
    const lastSlash = base.lastIndexOf('/');
    const dir = lastSlash >= 0 ? base.substring(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? base.substring(lastSlash + 1) : base;

    // 防御性检查：如果路径已包含 /compressed/，不再重复插入
    if (dir.endsWith(`/${COMPRESSED_SUBDIR}`) || dir === COMPRESSED_SUBDIR) {
        const webpUrl = resolveVersionedAssetUrl(`${base}.webp`);
        return { avif: webpUrl, webp: webpUrl };
    }

    const compressedBase = dir ? `${dir}/${COMPRESSED_SUBDIR}/${filename}` : `${COMPRESSED_SUBDIR}/${filename}`;
    const webpUrl = resolveVersionedAssetUrl(`${compressedBase}.webp`);
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

    const { path } = splitUrlParts(normalized);
    const lastSlash = path.lastIndexOf('/');
    const dir = lastSlash >= 0 ? path.substring(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;

    return resolveVersionedAssetUrl(
        dir ? `${dir}/${COMPRESSED_SUBDIR}/${filename}` : `${COMPRESSED_SUBDIR}/${filename}`
    );
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
        return { primary: urls, fallback: urls };
    }
    
    const localizedPath = getLocalizedAssetPath(src, locale);
    const primary = getOptimizedImageUrls(localizedPath);
    
    const fallbackLocale = getImageFallbackLocale(locale);
    const fallbackPath = getLocalizedAssetPath(src, fallbackLocale);
    const fallback = getOptimizedImageUrls(fallbackPath);
    
    return { primary, fallback };
}

const toLocalizedImageIndexKeyFromUrl = (value: string) => {
    if (!isString(value) || !value) {
        return undefined;
    }

    const relative = stripKnownAssetPrefixes(splitUrlParts(value).path);
    if (!relative.startsWith(`${LOCALIZED_ASSETS_SUBDIR}/`)) {
        return undefined;
    }

    return relative.replace(/\.(avif|webp|png|jpe?g|gif|svg)$/i, '');
};

const getLocalizedImageIndexKey = (src: string, locale: string) => {
    if (!isString(src) || !src || !locale || isPassthroughSource(src)) {
        return undefined;
    }

    const localizedPath = getLocalizedAssetPath(src, locale);
    const localizedUrl = getOptimizedImageUrls(localizedPath).webp;
    return toLocalizedImageIndexKeyFromUrl(localizedUrl);
};

const hasLocalizedImageAsset = (src: string, locale: string) => {
    const key = getLocalizedImageIndexKey(src, locale);
    return key ? localizedImageIndex[key] === 1 : false;
};

const resolveLocalizedImageLocales = (src: string, locale: string): string[] => {
    const effectiveLocale = locale || 'zh-CN';
    const fallbackLocale = getImageFallbackLocale(effectiveLocale);

    if (hasLocalizedImageAsset(src, effectiveLocale)) {
        return [effectiveLocale];
    }

    if (fallbackLocale !== effectiveLocale && hasLocalizedImageAsset(src, fallbackLocale)) {
        return [fallbackLocale];
    }

    return fallbackLocale === effectiveLocale
        ? [effectiveLocale]
        : [effectiveLocale, fallbackLocale];
};

const toLocalizedCompressedRelativePath = (src: string, locale: string): string => {
    const relative = stripKnownAssetPrefixes(splitUrlParts(src).path);
    if (!relative) {
        return `i18n/${locale}`;
    }

    const localized = relative.startsWith(`i18n/${locale}/`)
        ? relative
        : `i18n/${locale}/${relative}`;
    const base = localized.replace(/\.(webp|png|jpe?g)$/i, '');
    const lastSlash = base.lastIndexOf('/');
    const dir = lastSlash >= 0 ? base.slice(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? base.slice(lastSlash + 1) : base;

    if (dir.endsWith(`/${COMPRESSED_SUBDIR}`) || dir === COMPRESSED_SUBDIR) {
        return `${base}.webp`;
    }

    return dir ? `${dir}/${COMPRESSED_SUBDIR}/${filename}.webp` : `${COMPRESSED_SUBDIR}/${filename}.webp`;
};

export function getLocalizedImageCandidateUrls(src: string, locale: string): string[] {
    if (!isString(src) || !src) {
        return [];
    }

    if (src.startsWith('data:') || isPassthroughSource(src)) {
        const directUrl = getOptimizedImageUrls(src).webp || src;
        return directUrl ? [directUrl] : [];
    }

    const effectiveLocale = locale || 'zh-CN';
    const remoteBaseUrl = getAssetsBaseUrl();
    const candidateLocales = resolveLocalizedImageLocales(src, effectiveLocale);
    const candidates: string[] = [];
    const pushCandidate = (url: string) => {
        if (!url) return;
        candidates.push(url);
        if (!isCapacitorFileAssetUrl(url)) {
            return;
        }

        const unversionedUrl = stripVersionParam(url);
        if (unversionedUrl && unversionedUrl !== url) {
            candidates.push(unversionedUrl);
        }
    };

    candidateLocales.forEach((candidateLocale) => {
        const localizedPath = getLocalizedAssetPath(src, candidateLocale);
        const localizedUrl = getOptimizedImageUrls(localizedPath).webp;
        const remoteRelative = toLocalizedCompressedRelativePath(src, candidateLocale);
        const remoteBaseUrls = [
            /^https?:\/\//i.test(remoteBaseUrl) ? remoteBaseUrl : '',
            DEFAULT_ASSETS_BASE_URL,
        ].filter((url, index, list): url is string => Boolean(url) && list.indexOf(url) === index);
        const publicUrl = resolveVersionedAssetUrl(`/assets/${remoteRelative}`);
        const preferPublicAssetBeforeRemote = (import.meta.env.DEV || isLocalBrowserAssetOrigin())
            && !isCapacitorFileAssetUrl(localizedUrl);

        pushCandidate(localizedUrl);
        if (preferPublicAssetBeforeRemote) {
            pushCandidate(publicUrl);
        }
        remoteBaseUrls.forEach((baseUrl) => {
            pushCandidate(resolveVersionedRemoteAssetUrl(`${baseUrl}/${remoteRelative}`, remoteRelative));
        });
        if (!preferPublicAssetBeforeRemote) {
            pushCandidate(publicUrl);
        }
    });

    return collapseSameOriginAssetCandidates(candidates);
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
    const primaryUrl = isCapacitorFileAssetUrl(primary.webp)
        ? stripVersionParam(primary.webp)
        : primary.webp;
    // CSS background-image 的多 url 是叠层，不是可靠的失败回退。
    // 统一只返回主路径；需要显式回退的场景在调用层处理。
    return primaryUrl ? `url("${primaryUrl}")` : '';
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
 * 构建本地资源路径（始终走 /assets/，不走远程资源域名）
 * 用于 JSON 配置文件等必须随本地包提供的资源
 */
export function getLocalAssetPath(path: string): string {
    if (!isString(path) || !path) return '/assets';
    if (isPassthroughSource(path)) return path;
    const relative = stripKnownAssetPrefixes(splitUrlParts(path).path);
    if (!relative) {
        return '/assets';
    }

    const overrideBaseUrl = resolveAssetBaseUrlForPath(relative);
    if (overrideBaseUrl) {
        return resolveVersionedAssetUrl(`${overrideBaseUrl}/${relative}`);
    }

    if (shouldUseRemoteAssetsInLiteDev()) {
        return resolveVersionedAssetUrl(`${assetsBaseUrl}/${relative}`);
    }

    return resolveVersionedAssetUrl(`/assets/${relative}`);
}

/**
 * 构建本地语言化资源路径（始终走 /assets/，不走远程资源域名）
 * 用于 JSON 配置文件等必须随本地包提供的资源
 */
export function getLocalizedLocalAssetPath(path: string, locale?: string): string {
    if (!locale || isPassthroughSource(path)) return getLocalAssetPath(path);
    const relative = stripKnownAssetPrefixes(splitUrlParts(path).path);
    const overrideBaseUrl = resolveAssetBaseUrlForPath(relative);
    const localizedPrefix = `${LOCALIZED_ASSETS_SUBDIR}/${locale}/`;
    const localizedRelative = relative.startsWith(localizedPrefix)
        ? relative
        : `${localizedPrefix}${relative}`;

    if (overrideBaseUrl) {
        return resolveVersionedAssetUrl(`${overrideBaseUrl}/${localizedRelative}`);
    }

    if (shouldUseRemoteAssetsInLiteDev()) {
        return resolveVersionedAssetUrl(`${assetsBaseUrl}/${localizedRelative}`);
    }

    return resolveVersionedAssetUrl(`/assets/${localizedRelative}`);
}
