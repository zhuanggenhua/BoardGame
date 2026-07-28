import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { setAssetsBaseUrl } from '../../core/AssetLoader';
import type { GameManifestEntry } from '../../games/manifest.types';
import { ManifestGameThumbnail } from '../lobby/thumbnails';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
        i18n: {
            language: 'zh-CN',
        },
    }),
}));

const buildManifest = (override: Partial<GameManifestEntry> = {}): GameManifestEntry => ({
    id: 'demo',
    type: 'game',
    enabled: true,
    titleKey: 'games.demo.title',
    descriptionKey: 'games.demo.description',
    category: 'card',
    playersKey: 'games.demo.players',
    icon: '🎲',
    ...override,
});

describe('ManifestGameThumbnail', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
    });

    it('缺少 thumbnailPath 时回退到默认缩略图', () => {
        const manifest = buildManifest({ thumbnailPath: undefined });
        const html = renderToStaticMarkup(<ManifestGameThumbnail manifest={manifest} />);
        expect(html).toContain('🎲');
        expect(html).toContain('demo');
    });

    it('存在 thumbnailPath 时渲染优化图片', () => {
        const manifest = buildManifest({ thumbnailPath: 'demo/thumbnails/cover' });
        const html = renderToStaticMarkup(<ManifestGameThumbnail manifest={manifest} />);
        // 优化图片会自动指向 i18n/zh-CN/ 和 compressed/ 目录（webp）
        expect(html).toContain('src="/assets/i18n/zh-CN/demo/thumbnails/compressed/cover.webp"');
        // 首页缩略图的加载态由外层扫光承接，真实 img 在加载成功前透明，避免露出浏览器原生失败图标/alt。
        expect(html).toContain('img-shimmer');
        expect(html).toContain('opacity:0');
    });
});
