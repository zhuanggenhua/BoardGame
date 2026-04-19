import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardPreview, getCardAtlasCandidateUrls, registerCardAtlasSource, registerCardPreviewRenderer } from '../CardPreview';
import type { SpriteAtlasConfig } from '../../../../engine/primitives/spriteAtlas';
import { getCardAtlasSource, getLazyRegistration, registerLazyCardAtlasSource } from '../cardAtlasRegistry';
import { clearGameAssetBaseOverrides, markImageLoaded, setAssetsBaseUrl, setGameAssetBaseOverride } from '../../../../core';
import { OptimizedImage } from '../OptimizedImage';

const TEST_UNIFORM_ATLAS: SpriteAtlasConfig = {
    imageW: 100,
    imageH: 200,
    cols: 1,
    rows: 1,
    colStarts: [0],
    colWidths: [100],
    rowStarts: [0],
    rowHeights: [200],
};

describe('CardPreview i18n atlas path', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
        clearGameAssetBaseOverrides();
    });

    it('atlas 预览在未传 locale 时默认使用 zh-CN 路径', () => {
        const atlasId = 'test:card-preview:atlas-default-locale';
        registerCardAtlasSource(atlasId, {
            image: 'smashup/cards/cards1',
            config: TEST_UNIFORM_ATLAS,
        });

        const img = new Image();
        Object.defineProperty(img, 'naturalWidth', { value: 100, configurable: true });
        Object.defineProperty(img, 'naturalHeight', { value: 200, configurable: true });
        Object.defineProperty(img, 'src', {
            value: '/assets/i18n/zh-CN/smashup/cards/compressed/cards1.webp',
            configurable: true,
        });
        Object.defineProperty(img, 'currentSrc', {
            value: '/assets/i18n/zh-CN/smashup/cards/compressed/cards1.webp',
            configurable: true,
        });
        markImageLoaded('smashup/cards/cards1', 'zh-CN', img);

        const html = renderToStaticMarkup(
            <CardPreview previewRef={{ type: 'atlas', atlasId, index: 0 }} />
        );

        // buildLocalizedImageSet 只使用 webp 格式（不再使用 image-set/avif）
        expect(html).toContain('/assets/i18n/zh-CN/smashup/cards/compressed/cards1.webp');
    });

    it('renderer 预览在未传 locale 时默认收到 zh-CN', () => {
        const rendererId = 'test:card-preview:renderer-default-locale';
        let receivedLocale: string | undefined;

        registerCardPreviewRenderer(rendererId, ({ locale }) => {
            receivedLocale = locale;
            return <span>ok</span>;
        });

        renderToStaticMarkup(
            <CardPreview previewRef={{ type: 'renderer', rendererId }} />
        );

        expect(receivedLocale).toBe('zh-CN');
    });

    it('懒注册图集在图片未预加载时应保持 undefined，交给 AtlasCard fallback 加载', () => {
        const atlasId = 'test:card-preview:lazy-atlas-unresolved';
        registerLazyCardAtlasSource(atlasId, {
            image: 'smashup/taitan/taitan1',
            grid: { rows: 7, cols: 3 },
        });

        expect(getCardAtlasSource(atlasId, 'zh-CN')).toBeUndefined();
        expect(getLazyRegistration(atlasId)).toBeDefined();
    });

    it('atlas 候选 URL 应包含本地 /assets 降级路径', () => {
        const candidates = getCardAtlasCandidateUrls('smashup/taitan/taitan1', 'zh-CN');

        expect(candidates.some((url) => url.endsWith('/i18n/zh-CN/smashup/taitan/compressed/taitan1.webp'))).toBe(true);
        expect(candidates).toContain('/assets/i18n/zh-CN/smashup/taitan/compressed/taitan1.webp');
    });

    it('远程资源模式下 atlas 候选 URL 应先尝试远端，再回退本地 /assets', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const candidates = getCardAtlasCandidateUrls('smashup/taitan/taitan1', 'zh-CN');
        const remotePrimary = 'https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/taitan/compressed/taitan1.webp';
        const localPrimary = '/assets/i18n/zh-CN/smashup/taitan/compressed/taitan1.webp';

        expect(candidates[0]).toBe(remotePrimary);
        expect(candidates).toContain(localPrimary);
        expect(candidates.indexOf(localPrimary)).toBeGreaterThan(candidates.indexOf(remotePrimary));
    });

    it('游戏包 override 生效时 atlas 候选 URL 仍应保留远端 CDN 回退', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('smashup', '/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets');

        const candidates = getCardAtlasCandidateUrls('smashup/cards/tts_atlas_8789f47742', 'en');

        expect(candidates[0]).toBe('/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets/i18n/en/smashup/cards/compressed/tts_atlas_8789f47742.webp');
        expect(candidates).toContain('https://assets.easyboardgame.top/official/i18n/en/smashup/cards/compressed/tts_atlas_8789f47742.webp');
        expect(candidates).toContain('/assets/i18n/en/smashup/cards/compressed/tts_atlas_8789f47742.webp');
    });

    it('游戏包 override 的 _capacitor_file_ 本地路径不应走 fetch/blob workaround', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('smashup', '/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets');

        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            blob: async () => new Blob(),
        });
        const originalFetch = globalThis.fetch;
        Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            writable: true,
            value: fetchSpy,
        });

        try {
            const { container } = render(
                <OptimizedImage src="smashup/cards/tts_atlas_8789f47742" locale="en" alt="test" />
            );

            await waitFor(() => {
                const img = container.querySelector('img');
                expect(img).not.toBeNull();
                expect(img?.getAttribute('data-debug-current-src')).toContain('/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets/i18n/en/smashup/cards/compressed/tts_atlas_8789f47742.webp');
                expect(img?.getAttribute('data-debug-local-fetch')).toBe('direct-native');
            });

            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            Object.defineProperty(globalThis, 'fetch', {
                configurable: true,
                writable: true,
                value: originalFetch,
            });
        }
    });

    it('图集仅命中远端回退缓存时，背景图应使用真实加载成功的候选 URL', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('smashup', '/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets');

        const atlasId = 'test:card-preview:remote-loaded-candidate';
        registerCardAtlasSource(atlasId, {
            image: 'smashup/cards/aiji',
            config: TEST_UNIFORM_ATLAS,
        });

        const img = new Image();
        Object.defineProperty(img, 'naturalWidth', { value: 512, configurable: true });
        Object.defineProperty(img, 'naturalHeight', { value: 512, configurable: true });
        Object.defineProperty(img, 'src', {
            value: 'https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/aiji.webp',
            configurable: true,
        });
        Object.defineProperty(img, 'currentSrc', {
            value: 'https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/aiji.webp',
            configurable: true,
        });

        markImageLoaded('smashup/cards/aiji', 'zh-CN', img);

        const html = renderToStaticMarkup(
            <CardPreview previewRef={{ type: 'atlas', atlasId, index: 0 }} locale="zh-CN" />
        );

        expect(html).toContain('https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/aiji.webp');
        expect(html).not.toContain('/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/smashup/current/assets/i18n/zh-CN/smashup/cards/compressed/aiji.webp');
    });

    it('懒注册图集不应把 1x1 占位图当成有效 atlas', () => {
        const atlasId = 'test:card-preview:lazy-atlas-placeholder';
        registerLazyCardAtlasSource(atlasId, {
            image: 'smashup/taitan/taitan1',
            grid: { rows: 7, cols: 3 },
        });

        const img = new Image();
        Object.defineProperty(img, 'naturalWidth', { value: 1, configurable: true });
        Object.defineProperty(img, 'naturalHeight', { value: 1, configurable: true });
        markImageLoaded('smashup/taitan/taitan1', 'zh-CN', img);

        expect(getCardAtlasSource(atlasId, 'zh-CN')).toBeUndefined();
        expect(getLazyRegistration(atlasId)).toBeDefined();
    });

    it('atlas 首轮候选失败后应自动重试并恢复显示', async () => {
        vi.useFakeTimers();
        const atlasId = 'test:card-preview:atlas-auto-retry';
        const atlasImage = 'smashup/cards/cards-auto-retry';
        registerCardAtlasSource(atlasId, {
            image: atlasImage,
            config: TEST_UNIFORM_ATLAS,
        });

        const candidateUrls = getCardAtlasCandidateUrls(atlasImage, 'zh-CN');
        const primaryUrl = candidateUrls[0];
        const attemptCount = new Map<string, number>();

        class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            naturalWidth = 100;
            naturalHeight = 200;
            currentSrc = '';
            private _src = '';

            get src() {
                return this._src;
            }

            set src(value: string) {
                this._src = value;
                this.currentSrc = value;
                const nextAttempt = (attemptCount.get(value) ?? 0) + 1;
                attemptCount.set(value, nextAttempt);
                const shouldSucceed = value === primaryUrl && nextAttempt >= 2;
                setTimeout(() => {
                    if (shouldSucceed) {
                        this.onload?.();
                        return;
                    }
                    this.onerror?.();
                }, 0);
            }
        }

        vi.stubGlobal('Image', MockImage as unknown as typeof Image);

        try {
            const { container } = render(
                <CardPreview previewRef={{ type: 'atlas', atlasId, index: 0 }} locale="zh-CN" />
            );
            const atlasNode = container.firstElementChild as HTMLElement | null;
            expect(atlasNode).not.toBeNull();
            expect(atlasNode?.className).toContain('atlas-shimmer');

            await act(async () => {
                await vi.advanceTimersByTimeAsync(100);
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(4000);
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(100);
                await Promise.resolve();
            });

            expect(attemptCount.get(primaryUrl)).toBeGreaterThanOrEqual(2);
            expect(atlasNode?.className).not.toContain('atlas-shimmer');
            expect(atlasNode?.style.backgroundImage).toContain(primaryUrl);
        } finally {
            vi.useRealTimers();
            vi.unstubAllGlobals();
        }
    });

});
