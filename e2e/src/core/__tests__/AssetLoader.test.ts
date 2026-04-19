import { describe, it, expect, beforeEach } from 'vitest';
import { setPublicFileHashesForTesting, versionedPublicFileUrl } from '../../lib/publicFileUrl';
import {
    getLocalAssetPath,
    getLocalizedImageUrls,
    getOptimizedImageUrls,
    setAssetHashesForTesting,
    setAssetsBaseUrl,
} from '../AssetLoader';

describe('AssetLoader.getOptimizedImageUrls', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
        setAssetHashesForTesting({});
        setPublicFileHashesForTesting({});
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

    it('为压缩图片附加内容 hash 版本参数', () => {
        setAssetHashesForTesting({
            'dicethrone/thumbnails/compressed/fengm.webp': 'abcd1234',
        });
        const urls = getOptimizedImageUrls('dicethrone/thumbnails/fengm.png');
        expect(urls.webp).toBe('/assets/dicethrone/thumbnails/compressed/fengm.webp?v=abcd1234');
    });

    it('原始位图本身带 hash 时，仍然指向压缩图的最终版本 URL', () => {
        setAssetHashesForTesting({
            'dicethrone/thumbnails/fengm.png': 'source111',
            'dicethrone/thumbnails/compressed/fengm.webp': 'target222',
        });
        const urls = getOptimizedImageUrls('dicethrone/thumbnails/fengm.png');
        expect(urls.webp).toBe('/assets/dicethrone/thumbnails/compressed/fengm.webp?v=target222');
    });

    it('本地化位图在原图带 hash 时也能生成正确的压缩图 URL', () => {
        setAssetHashesForTesting({
            'i18n/zh-CN/dicethrone/thumbnails/fengm.png': 'locale111',
            'i18n/zh-CN/dicethrone/thumbnails/compressed/fengm.webp': 'locale222',
            'i18n/en/dicethrone/thumbnails/compressed/fengm.webp': 'fallback333',
        });
        const urls = getLocalizedImageUrls('dicethrone/thumbnails/fengm.png', 'zh-CN');
        expect(urls.primary.webp).toBe('/assets/i18n/zh-CN/dicethrone/thumbnails/compressed/fengm.webp?v=locale222');
        expect(urls.fallback.webp).toBe('/assets/i18n/en/dicethrone/thumbnails/compressed/fengm.webp?v=fallback333');
    });

    it('本地 JSON 路径也附加内容 hash，保证更新立即生效', () => {
        setAssetHashesForTesting({
            'atlas-configs/dicethrone/ability-cards-common.atlas.json': 'ef567890',
        });
        expect(getLocalAssetPath('atlas-configs/dicethrone/ability-cards-common.atlas.json'))
            .toBe('/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json?v=ef567890');
    });

    it('public 根目录字体与 logo 资源也会附加内容 hash', () => {
        setPublicFileHashesForTesting({
            'fonts/inter-400-latin.woff2': 'font12345',
            'logos/logo_1_grid.svg': 'logo67890',
        });
        expect(versionedPublicFileUrl('/fonts/inter-400-latin.woff2'))
            .toBe('/fonts/inter-400-latin.woff2?v=font12345');
        expect(versionedPublicFileUrl('/logos/logo_1_grid.svg'))
            .toBe('/logos/logo_1_grid.svg?v=logo67890');
    });

    it('显式排除的动态 game-data 文件保持原路径', () => {
        setPublicFileHashesForTesting({
            'game-data/summonerwars.layout.json': 'layout1111',
        });
        expect(versionedPublicFileUrl('/game-data/summonerwars.layout.json'))
            .toBe('/game-data/summonerwars.layout.json');
    });
});
