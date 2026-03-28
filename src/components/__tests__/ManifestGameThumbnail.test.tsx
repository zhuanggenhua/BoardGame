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
    });
});
