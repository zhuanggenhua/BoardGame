import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    __resetAssetLoaderCachesForTests,
    areAllCriticalImagesCached,
    clearGameAssetBaseOverrides,
    getLocalizedImageCandidateUrls,
    getLocalizedImageUrls,
    getPreloadedImageElement,
    getResolvedImageCacheUrl,
    getResolvedImageCandidateUrl,
    getRuntimeImageCandidateUrls,
    isImagePreloaded,
    markImageCandidateFailed,
    markImageLoaded,
    registerGameAssets,
    preloadCriticalImages,
    setAssetHashesForTesting,
    setAssetsBaseUrl,
    setGameAssetBaseOverride,
    setLocalizedImageIndexForTesting,
} from '../AssetLoader';
import { registerCriticalImageResolver } from '../CriticalImageResolverRegistry';

// Mock Image constructor
class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 300;
    naturalHeight = 600;
    private _src = '';
    get src() { return this._src; }
    set src(value: string) {
        this._src = value;
        // Default: resolve immediately
        setTimeout(() => this.onload?.(), 0);
    }
}

beforeEach(() => {
    setAssetsBaseUrl('/assets');
    setAssetHashesForTesting({});
    setLocalizedImageIndexForTesting({});
    clearGameAssetBaseOverrides();
    __resetAssetLoaderCachesForTests();
    vi.stubGlobal('Image', MockImage);
});

describe('preloadCriticalImages', () => {
    it('无注册资产时立即返回空暖列表', async () => {
        const warm = await preloadCriticalImages('nonexistent-game');
        expect(warm).toEqual([]);
    });

    it('仅使用静态 criticalImages（无解析器）', async () => {
        registerGameAssets('test-static', {
            criticalImages: ['test/img1.png', 'test/img2.png'],
            warmImages: ['test/warm1.png'],
        });
        const warm = await preloadCriticalImages('test-static');
        expect(warm).toEqual(['test/warm1.png']);
    });

    it('合并静态列表与动态解析器输出（去重）', async () => {
        registerGameAssets('test-merge', {
            criticalImages: ['shared/img.png'],
            warmImages: ['static/warm.png'],
        });
        registerCriticalImageResolver('test-merge', () => ({
            critical: ['shared/img.png', 'dynamic/img.png'],
            warm: ['dynamic/warm.png', 'static/warm.png'],
        }));
        const warm = await preloadCriticalImages('test-merge', {});
        // critical 去重：shared/img.png 只出现一次
        // warm 去重：static/warm.png 只出现一次
        expect(warm).toContain('static/warm.png');
        expect(warm).toContain('dynamic/warm.png');
        // 验证去重
        expect(new Set(warm).size).toBe(warm.length);
    });

    it('解析器抛出异常时回退到静态列表', async () => {
        registerGameAssets('test-error', {
            criticalImages: ['fallback.png'],
        });
        registerCriticalImageResolver('test-error', () => {
            throw new Error('resolver boom');
        });
        // Should not throw, and should still preload static images
        const warm = await preloadCriticalImages('test-error', {});
        expect(warm).toEqual([]);
    });

    it('单张图片加载失败不阻塞整体', async () => {
        // Override Image to fail for specific src
        vi.stubGlobal('Image', class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            private _src = '';
            get src() { return this._src; }
            set src(value: string) {
                this._src = value;
                if (value.includes('fail')) {
                    setTimeout(() => this.onerror?.(), 0);
                } else {
                    setTimeout(() => this.onload?.(), 0);
                }
            }
        });

        registerGameAssets('test-fail', {
            criticalImages: ['ok.png', 'fail.png'],
        });

        // Should resolve without throwing
        const warm = await preloadCriticalImages('test-fail');
        expect(warm).toEqual([]);
    });

    it('单张图片超时后不阻塞整体加载', async () => {
        vi.useFakeTimers();

        let imageCount = 0;
        vi.stubGlobal('Image', class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            private _src = '';
            get src() { return this._src; }
            set src(value: string) { 
                this._src = value;
                imageCount++;
                // 第一张图片永远不触发（模拟超时），第二张图片立即成功
                if (imageCount === 2 && this.onload) {
                    setTimeout(() => this.onload?.(), 0);
                }
            }
        });

        registerGameAssets('test-timeout', {
            criticalImages: ['slow.png', 'fast.png'],
        });

        const promise = preloadCriticalImages('test-timeout');

        // 推进单张图片的 30s 超时
        await vi.advanceTimersByTimeAsync(30_001);
        // 确保所有计时器与微任务都被清空，避免 Promise 挂起
        await vi.runAllTimersAsync();

        const warm = await promise;
        expect(warm).toEqual([]);

        vi.useRealTimers();
    });

    it('图片 naturalWidth 已可用但 onload 不触发时，也应视为加载成功', async () => {
        vi.stubGlobal('Image', class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            naturalWidth = 0;
            naturalHeight = 0;
            complete = false;
            private _src = '';

            get src() { return this._src; }
            set src(value: string) {
                this._src = value;
                this.complete = true;
                this.naturalWidth = 2048;
                this.naturalHeight = 1673;
            }
        });

        registerGameAssets('test-natural-width-ready', {
            criticalImages: ['slow-but-decoded.png'],
        });

        const warm = await preloadCriticalImages('test-natural-width-ready');
        expect(warm).toEqual([]);
        expect(isImagePreloaded('/assets/i18n/zh-CN/compressed/slow-but-decoded.webp')).toBe(true);
    });

    it('关键图预加载命中带版本参数的 native URL 后，图集查询也能拿到缓存元素', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('smashup', '/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets');
        setAssetHashesForTesting({
            'i18n/en/smashup/cards/compressed/cards1.webp': 'hash1234',
        });

        registerGameAssets('smashup', {
            criticalImages: ['smashup/cards/cards1'],
        });

        await preloadCriticalImages('smashup', undefined, 'en');

        const hashedUrl = getLocalizedImageUrls('smashup/cards/cards1', 'en').primary.webp;
        expect(hashedUrl).toContain('/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets/i18n/en/smashup/cards/compressed/cards1.webp?v=hash1234');
        expect(isImagePreloaded(hashedUrl)).toBe(true);
        expect(getPreloadedImageElement(hashedUrl)).not.toBeNull();
        expect(getPreloadedImageElement('smashup/cards/cards1', 'en')).not.toBeNull();
    });

    it('游戏包本地候选命中 _capacitor_file_ 时，应在带版本参数 URL 后补无 query 回退', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('smashup', 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets');
        setAssetHashesForTesting({
            'i18n/en/smashup/cards/compressed/cards1.webp': 'hash1234',
        });

        const candidates = getLocalizedImageCandidateUrls('smashup/cards/cards1', 'en');

        expect(candidates[0]).toBe('http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets/i18n/en/smashup/cards/compressed/cards1.webp?v=hash1234');
        expect(candidates[1]).toBe('http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets/i18n/en/smashup/cards/compressed/cards1.webp');
        expect(candidates).toContain('https://assets.easyboardgame.top/official/i18n/en/smashup/cards/compressed/cards1.webp?v=hash1234');
    });

    it('不同资源 base 的同一张图应复用统一缓存键', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setAssetHashesForTesting({
            'i18n/en/smashup/cards/compressed/cards1.webp': 'hash1234',
        });

        const remoteUrl = getLocalizedImageUrls('smashup/cards/cards1', 'en').primary.webp;
        const loadedImage = new Image() as HTMLImageElement;
        loadedImage.src = remoteUrl;
        markImageLoaded(remoteUrl, undefined, loadedImage);

        expect(isImagePreloaded('/assets/i18n/en/smashup/cards/compressed/cards1.webp?v=hash1234')).toBe(true);
        expect(getPreloadedImageElement('/assets/i18n/en/smashup/cards/compressed/cards1.webp?v=hash1234')).not.toBeNull();
    });

    it('逻辑资源应能恢复真实加载成功的 fallback URL', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const fallbackUrl = '/assets/i18n/zh-CN/smashup/cards/compressed/cards1.webp';
        const loadedImage = new Image() as HTMLImageElement;
        Object.defineProperty(loadedImage, 'naturalWidth', { value: 300, configurable: true });
        Object.defineProperty(loadedImage, 'naturalHeight', { value: 600, configurable: true });
        Object.defineProperty(loadedImage, 'src', { value: fallbackUrl, configurable: true });
        Object.defineProperty(loadedImage, 'currentSrc', { value: fallbackUrl, configurable: true });

        markImageLoaded('smashup/cards/cards1', 'zh-CN', loadedImage);

        const candidateUrls = getLocalizedImageCandidateUrls('smashup/cards/cards1', 'zh-CN');

        expect(getResolvedImageCacheUrl('smashup/cards/cards1', 'zh-CN')).toBe(fallbackUrl);
        expect(getResolvedImageCandidateUrl(candidateUrls, 'smashup/cards/cards1', 'zh-CN')).toBe(fallbackUrl);
    });

    it('blob 渲染成功时缓存应保留原始候选 URL 而不是 blob URL', () => {
        const originalCandidateUrl = '/assets/i18n/zh-CN/smashup/cards/compressed/cards1.webp';
        const blobUrl = 'blob:http://127.0.0.1:6174/mock-blob';
        const loadedImage = new Image() as HTMLImageElement;
        Object.defineProperty(loadedImage, 'naturalWidth', { value: 300, configurable: true });
        Object.defineProperty(loadedImage, 'naturalHeight', { value: 600, configurable: true });
        Object.defineProperty(loadedImage, 'src', { value: blobUrl, configurable: true });
        Object.defineProperty(loadedImage, 'currentSrc', { value: blobUrl, configurable: true });

        markImageLoaded('smashup/cards/cards1', 'zh-CN', loadedImage, originalCandidateUrl);

        expect(getResolvedImageCacheUrl('smashup/cards/cards1', 'zh-CN')).toBe(originalCandidateUrl);
    });

    it('近期失败的候选应在后续挂载时自动后移，避免反复从坏 URL 起步', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const candidateUrls = getLocalizedImageCandidateUrls('smashup/cards/cards1', 'zh-CN');
        expect(candidateUrls.length).toBeGreaterThan(1);

        markImageCandidateFailed('smashup/cards/cards1', 'zh-CN', candidateUrls[0]);

        const reordered = getRuntimeImageCandidateUrls('smashup/cards/cards1', 'zh-CN');

        expect(reordered[0]).toBe(candidateUrls[1]);
        expect(reordered[reordered.length - 1]).toBe(candidateUrls[0]);
    });

    it('同步缓存探测远端 compressed webp fallback 时，不应重复追加 .webp', () => {
        const probedUrls: string[] = [];

        vi.stubGlobal('Image', class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            naturalWidth = 0;
            naturalHeight = 0;
            complete = false;
            private _src = '';

            get src() {
                return this._src;
            }

            set src(value: string) {
                this._src = value;
                probedUrls.push(value);
            }
        });

        registerGameAssets('test-remote-fallback-probe', {
            criticalImages: ['smashup/cards/cards1'],
        });

        expect(areAllCriticalImagesCached('test-remote-fallback-probe', undefined, 'zh-CN')).toBe(false);
        expect(probedUrls.some((url) => url.includes('cards1.webp.webp'))).toBe(false);
        expect(probedUrls).toContain(
            'https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/cards1.webp',
        );
    });

    it('runtime 内存缓存丢失后，可凭持久化 ready hint 跳过关键图阻塞门禁', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setAssetHashesForTesting({
            'i18n/en/smashup/cards/compressed/cards1.webp': 'hash1234',
        });

        registerGameAssets('test-persistent-hint', {
            criticalImages: ['smashup/cards/cards1'],
        });

        const remoteUrl = getLocalizedImageUrls('smashup/cards/cards1', 'en').primary.webp;
        const loadedImage = new Image() as HTMLImageElement;
        loadedImage.src = remoteUrl;
        markImageLoaded(remoteUrl, undefined, loadedImage);

        __resetAssetLoaderCachesForTests({ keepPersistentHints: true });

        expect(areAllCriticalImagesCached('test-persistent-hint', undefined, 'en')).toBe(true);
    });

    it('runtime 内存缓存丢失后，同步磁盘缓存探测命中仍可判定关键图已就绪', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setAssetHashesForTesting({
            'i18n/en/smashup/cards/compressed/cards1.webp': 'hash1234',
        });

        registerGameAssets('test-sync-disk-hit', {
            criticalImages: ['smashup/cards/cards1'],
        });

        vi.stubGlobal('Image', class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            naturalWidth = 0;
            naturalHeight = 0;
            complete = false;
            private _src = '';

            get src() {
                return this._src;
            }

            set src(value: string) {
                this._src = value;
                if (value.includes('cards1.webp?v=hash1234')) {
                    this.complete = true;
                    this.naturalWidth = 300;
                    this.naturalHeight = 600;
                }
            }
        });

        expect(areAllCriticalImagesCached('test-sync-disk-hit', undefined, 'en')).toBe(true);
    });
});
