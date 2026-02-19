import { describe, it, expect, beforeEach } from 'vitest';
import { getOptimizedImageUrls, setAssetsBaseUrl } from '../AssetLoader';

describe('AssetLoader.getOptimizedImageUrls', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
    });

    it('SVG 资源保持原路径', () => {
        const urls = getOptimizedImageUrls('dicethrone/thumbnails/fengm.svg');
        expect(urls).toEqual({
            avif: '/assets/dicethrone/thumbnails/fengm.svg',
            webp: '/assets/dicethrone/thumbnails/fengm.svg',
        });
    });

    it('位图资源统一生成 webp 路径', () => {
        const urls = getOptimizedImageUrls('dicethrone/thumbnails/fengm.png');
        expect(urls.avif).toBe('/assets/dicethrone/thumbnails/compressed/fengm.webp');
        expect(urls.webp).toBe('/assets/dicethrone/thumbnails/compressed/fengm.webp');
    });
});
