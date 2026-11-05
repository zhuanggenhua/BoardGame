import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearGameAssetsCache, getPreloadedImageElement, markImageLoaded, preloadCriticalImages,
    registerGameAssets, setAssetsBaseUrl, __resetAssetLoaderCachesForTests } from '../AssetLoader';

afterEach(() => { __resetAssetLoaderCachesForTests(); vi.unstubAllGlobals(); });
describe('decoded image lifetime', () => {
    it('cancels pending game images, skips remaining workers and ignores late callbacks', async () => {
        const images: DeferredImage[] = [];
        class DeferredImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            naturalWidth = 0;
            naturalHeight = 0;
            complete = false;
            src = '';
            constructor() { images.push(this); }
            removeAttribute() { this.src = ''; }
        }
        vi.stubGlobal('Image', DeferredImage);
        setAssetsBaseUrl('/assets');
        const gameId = 'lifetime-game';
        registerGameAssets(gameId, { criticalImages: Array.from({ length: 20 }, (_, i) => `${gameId}/board-${i}.png`) });
        const pending = preloadCriticalImages(gameId);
        const oldCallbacks = images.map(image => image.onload);
        clearGameAssetsCache(gameId);
        await pending;
        const requests = images.length;
        for (let i = 0; i < oldCallbacks.length; i++) {
            images[i].naturalWidth = 300;
            oldCallbacks[i]?.();
        }
        expect(images).toHaveLength(requests);
        expect(document.querySelectorAll('link[rel="preload"]')).toHaveLength(0);
        expect(getPreloadedImageElement(`/assets/${gameId}/compressed/board-0.webp`)).toBeNull();
    });
    it('caps decoded image references and clears localized URLs for a departed game', () => {
        setAssetsBaseUrl('/assets');
        for (let index = 0; index < 200; index++) {
            const image = document.createElement('img');
            Object.defineProperties(image, { naturalWidth: { value: 1024 }, naturalHeight: { value: 1024 } });
            markImageLoaded(`/assets/i18n/zh-CN/lifetime-game/compressed/${index}.webp`, 'zh-CN', image);
        }
        expect(getPreloadedImageElement('/assets/i18n/zh-CN/lifetime-game/compressed/0.webp')).toBeNull();
        const latest = '/assets/i18n/zh-CN/lifetime-game/compressed/199.webp';
        expect(getPreloadedImageElement(latest)).toBeTruthy();
        clearGameAssetsCache('lifetime-game');
        expect(getPreloadedImageElement(latest)).toBeNull();
    });
});
