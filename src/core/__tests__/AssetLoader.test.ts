import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPublicFileHashesForTesting, versionedPublicFileUrl } from '../../lib/publicFileUrl';
import {
    buildLocalizedImageSet,
    clearGameAssetBaseOverrides,
    getLocalAssetPath,
    getLocalizedLocalAssetPath,
    getLocalizedImageCandidateUrls,
    getLocalizedImageUrls,
    getOptimizedImageUrls,
    setAssetHashesForTesting,
    setAssetsBaseUrl,
    setGameAssetBaseOverride,
    setLocalizedImageIndexForTesting,
} from '../AssetLoader';

describe('AssetLoader.getOptimizedImageUrls', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
        setAssetHashesForTesting({});
    setLocalizedImageIndexForTesting({});
    setPublicFileHashesForTesting({});
    clearGameAssetBaseOverrides();
});

afterEach(() => {
    vi.unstubAllEnvs();
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

    it('dev:lite 远程素材模式让强制本地资源路径也读取公开资源域名', () => {
        vi.stubEnv('VITE_DEV_REMOTE_ASSETS', 'true');
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        expect(getLocalAssetPath('common/images/home-v2/book-catalog-wide/1.png'))
            .toBe('https://assets.easyboardgame.top/official/common/images/home-v2/book-catalog-wide/1.png');
        expect(getLocalizedLocalAssetPath('dicethrone/images/paladin/status-icons-atlas.json', 'zh-CN'))
            .toBe('https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/paladin/status-icons-atlas.json');
    });

    it('游戏包 override 生效时，本地语言化 JSON 应优先走游戏包目录', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('dicethrone', 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets');
        setAssetHashesForTesting({
            'i18n/zh-CN/dicethrone/images/cursed/status-icons-atlas.json': 'atlas5678',
        });

        expect(getLocalizedLocalAssetPath('dicethrone/images/cursed/status-icons-atlas.json', 'zh-CN'))
            .toBe('http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets/i18n/zh-CN/dicethrone/images/cursed/status-icons-atlas.json?v=atlas5678');
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

    it('当前语言素材存在时，不生成语言 fallback 候选', () => {
        setLocalizedImageIndexForTesting({
            'i18n/zh-CN/splendor/compressed/picture': 1,
            'i18n/en/splendor/compressed/picture': 1,
        });

        const candidates = getLocalizedImageCandidateUrls('splendor/picture', 'zh-CN');

        expect(candidates).toEqual([
            '/assets/i18n/zh-CN/splendor/compressed/picture.webp',
            'https://assets.easyboardgame.top/official/i18n/zh-CN/splendor/compressed/picture.webp',
        ]);
    });

    it('同源直连素材时，应收敛 /official 与 /assets 等价候选，避免同图重复下载', () => {
        const origin = window.location.origin;
        setAssetsBaseUrl(`${origin}/official`);
        setAssetHashesForTesting({
            'i18n/zh-CN/smashup/cards/compressed/goblins.webp': 'f8c7fa52',
        });
        setLocalizedImageIndexForTesting({
            'i18n/zh-CN/smashup/cards/compressed/goblins': 1,
        });

        const candidates = getLocalizedImageCandidateUrls('smashup/cards/goblins', 'zh-CN');

        expect(candidates).toEqual([
            `${origin}/official/i18n/zh-CN/smashup/cards/compressed/goblins.webp?v=f8c7fa52`,
        ]);
    });

    it('当前语言缺图但 fallback 语言存在时，应直接使用 fallback 语言', () => {
        setLocalizedImageIndexForTesting({
            'i18n/en/splendor/compressed/picture': 1,
        });

        const candidates = getLocalizedImageCandidateUrls('splendor/picture', 'zh-CN');

        expect(candidates).toEqual([
            '/assets/i18n/en/splendor/compressed/picture.webp',
            'https://assets.easyboardgame.top/official/i18n/en/splendor/compressed/picture.webp',
        ]);
    });

    it('索引缺失时保留旧行为，同时包含当前语言与 fallback 语言候选', () => {
        const candidates = getLocalizedImageCandidateUrls('splendor/picture', 'zh-CN');

        expect(candidates).toEqual([
            '/assets/i18n/zh-CN/splendor/compressed/picture.webp',
            'https://assets.easyboardgame.top/official/i18n/zh-CN/splendor/compressed/picture.webp',
            '/assets/i18n/en/splendor/compressed/picture.webp',
            'https://assets.easyboardgame.top/official/i18n/en/splendor/compressed/picture.webp',
        ]);
    });

    it('移动端游戏包候选仍优先同语言，并为 _capacitor_file_ 追加无 query 回退', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('smashup', 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets');
        setAssetHashesForTesting({
            'i18n/en/smashup/cards/compressed/cards1.webp': 'hash1234',
        });
        setLocalizedImageIndexForTesting({
            'i18n/en/smashup/cards/compressed/cards1': 1,
        });

        const candidates = getLocalizedImageCandidateUrls('smashup/cards/cards1', 'en');

        expect(candidates).toEqual([
            'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets/i18n/en/smashup/cards/compressed/cards1.webp?v=hash1234',
            'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets/i18n/en/smashup/cards/compressed/cards1.webp',
            'https://assets.easyboardgame.top/official/i18n/en/smashup/cards/compressed/cards1.webp?v=hash1234',
            '/assets/i18n/en/smashup/cards/compressed/cards1.webp?v=hash1234',
        ]);
    });

    it('移动端游戏包 CSS 背景图命中 _capacitor_file_ 时应去掉版本参数', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('dicethrone', 'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets');
        setAssetHashesForTesting({
            'i18n/zh-CN/dicethrone/images/cursed/status/compressed/诅咒金币.webp': 'coin1234',
        });
        setLocalizedImageIndexForTesting({
            'i18n/zh-CN/dicethrone/images/cursed/status/compressed/诅咒金币': 1,
        });

        expect(buildLocalizedImageSet('dicethrone/images/cursed/status/诅咒金币', 'zh-CN')).toBe(
            'url("http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets/i18n/zh-CN/dicethrone/images/cursed/status/compressed/诅咒金币.webp")',
        );
    });
});
