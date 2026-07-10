import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useState } from 'react';
import { CardPreview, getCardAtlasCandidateUrls, registerCardAtlasSource, registerCardPreviewRenderer } from '../CardPreview';
import type { SpriteAtlasConfig } from '../../../../engine/primitives/spriteAtlas';
import { getCardAtlasSource, getLazyRegistration, registerLazyCardAtlasSource } from '../cardAtlasRegistry';
import { clearGameAssetBaseOverrides, markImageLoaded, setAssetsBaseUrl, setGameAssetBaseOverride } from '../../../../core';
import { __resetAssetLoaderCachesForTests } from '../../../../core/AssetLoader';
import { OptimizedImage } from '../OptimizedImage';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../lib/i18n';
import { QIDAHEN_CARD_ATLAS_IDS } from '../../../../games/qidahen/ui/cardAtlas';

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

    it('同一个 CardPreview 在 atlas 与使用 Hooks 的 renderer 之间切换时，不应触发 Hooks 顺序错误', () => {
        const atlasId = 'test:card-preview:toggle-hook-renderer-atlas';
        const rendererId = 'test:card-preview:toggle-hook-renderer';

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

        registerCardPreviewRenderer(rendererId, ({ locale }) => {
            const [count] = useState(1);
            return <span data-testid="hook-renderer">{locale}-{count}</span>;
        });

        const { rerender, getByTestId, container } = render(
            <I18nextProvider i18n={i18n}>
                <CardPreview previewRef={{ type: 'atlas', atlasId, index: 0 }} />
            </I18nextProvider>
        );

        expect(container.querySelector('[data-card-atlas-frame="true"]')).not.toBeNull();

        rerender(
            <I18nextProvider i18n={i18n}>
                <CardPreview previewRef={{ type: 'renderer', rendererId }} />
            </I18nextProvider>
        );

        expect(getByTestId('hook-renderer').textContent).toBe('zh-CN-1');

        rerender(
            <I18nextProvider i18n={i18n}>
                <CardPreview previewRef={{ type: 'atlas', atlasId, index: 0 }} />
            </I18nextProvider>
        );

        expect(container.querySelector('[data-card-atlas-frame="true"]')).not.toBeNull();
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

    it('七大恨普通手牌图集在 App 已安装包下应使用真实 img 裁片', () => {
        const installedAtlasUrl = '/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/qidahen/current/assets/i18n/zh-CN/qidahen/cards/atlases/compressed/ordinary-hand-atlas05.webp';
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        setGameAssetBaseOverride('qidahen', '/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/qidahen/current/assets');

        const img = new Image();
        Object.defineProperty(img, 'naturalWidth', { value: 4798, configurable: true });
        Object.defineProperty(img, 'naturalHeight', { value: 4625, configurable: true });
        Object.defineProperty(img, 'src', {
            value: installedAtlasUrl,
            configurable: true,
        });
        Object.defineProperty(img, 'currentSrc', {
            value: installedAtlasUrl,
            configurable: true,
        });
        markImageLoaded('qidahen/cards/atlases/ordinary-hand-atlas05', 'zh-CN', img);

        const html = renderToStaticMarkup(
            <CardPreview
                previewRef={{ type: 'atlas', atlasId: QIDAHEN_CARD_ATLAS_IDS.ATLAS05_ORDINARY_HAND, index: 0 }}
                locale="zh-CN"
            />
        );

        expect(html).toContain('data-card-atlas-img="true"');
        expect(html).toContain(installedAtlasUrl);
        expect(html).not.toContain('background-image');
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

    it('OptimizedImage 已命中本地 fallback 后，后续挂载应直接复用成功候选而非重试 primary', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const fallbackUrl = '/assets/i18n/zh-CN/smashup/cards/compressed/cards1.webp';
        const img = new Image();
        Object.defineProperty(img, 'naturalWidth', { value: 300, configurable: true });
        Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true });
        Object.defineProperty(img, 'src', {
            value: fallbackUrl,
            configurable: true,
        });
        Object.defineProperty(img, 'currentSrc', {
            value: fallbackUrl,
            configurable: true,
        });

        markImageLoaded('smashup/cards/cards1', 'zh-CN', img);

        const { container } = render(
            <OptimizedImage src="smashup/cards/cards1" locale="zh-CN" alt="test" />
        );

        await waitFor(() => {
            const image = container.querySelector('img');
            expect(image).not.toBeNull();
            expect(image?.getAttribute('data-debug-current-src')).toBe(fallbackUrl);
            expect(image?.getAttribute('src')).toBe(fallbackUrl);
        });
    });

    it('OptimizedImage 命中已缓存的本地正式图片后，不应再走 fetch/blob 慢链', async () => {
        __resetAssetLoaderCachesForTests();
        setAssetsBaseUrl('/assets');

        const cachedUrl = '/assets/i18n/zh-CN/dicethrone/images/monk/compressed/player-board.webp';
        const img = new Image();
        Object.defineProperty(img, 'naturalWidth', { value: 2048, configurable: true });
        Object.defineProperty(img, 'naturalHeight', { value: 1248, configurable: true });
        Object.defineProperty(img, 'src', {
            value: cachedUrl,
            configurable: true,
        });
        Object.defineProperty(img, 'currentSrc', {
            value: cachedUrl,
            configurable: true,
        });
        markImageLoaded('dicethrone/images/monk/player-board', 'zh-CN', img);

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
                <OptimizedImage src="dicethrone/images/monk/player-board" locale="zh-CN" alt="test" />
            );

            await waitFor(() => {
                const image = container.querySelector('img');
                expect(image).not.toBeNull();
                expect(image?.getAttribute('data-debug-current-src')).toBe(cachedUrl);
                expect(image?.getAttribute('src')).toBe(cachedUrl);
                expect(image?.getAttribute('data-debug-local-fetch')).toBe('idle');
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

    it('OptimizedImage 切到 fallback 候选后不应被重置回 primary', async () => {
        __resetAssetLoaderCachesForTests();
        setAssetsBaseUrl('/assets');

        const candidateUrls = getCardAtlasCandidateUrls('smashup/cards/cards1', 'zh-CN');
        const primaryUrl = candidateUrls[0];
        const fallbackUrl = candidateUrls[1];

        const { container } = render(
            <OptimizedImage src="smashup/cards/cards1" locale="zh-CN" alt="test" />
        );

        const image = container.querySelector('img');
        expect(image).not.toBeNull();
        expect(image?.getAttribute('data-debug-current-src')).toBe(primaryUrl);

        fireEvent.error(image!);

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        await waitFor(() => {
            const nextImage = container.querySelector('img');
            expect(nextImage?.getAttribute('data-debug-current-src')).toBe(fallbackUrl);
            expect(nextImage?.getAttribute('src')).toBe(fallbackUrl);
        });
    });

    it('图集仅命中远端回退缓存时，裁片图片应使用真实加载成功的候选 URL', () => {
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

    it('sourceImage 已缓存但候选 URL 变更时，应复用已加载 currentSrc 而非重试加载', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const atlasId = 'test:card-preview:source-cache-fallback';
        registerCardAtlasSource(atlasId, {
            image: 'smashup/cards/source-cache-fallback',
            config: TEST_UNIFORM_ATLAS,
        });

        const img = new Image();
        Object.defineProperty(img, 'naturalWidth', { value: 512, configurable: true });
        Object.defineProperty(img, 'naturalHeight', { value: 512, configurable: true });
        Object.defineProperty(img, 'src', {
            value: 'https://old-cdn.example.com/i18n/zh-CN/smashup/cards/compressed/source-cache-fallback.webp',
            configurable: true,
        });
        Object.defineProperty(img, 'currentSrc', {
            value: 'https://old-cdn.example.com/i18n/zh-CN/smashup/cards/compressed/source-cache-fallback.webp',
            configurable: true,
        });

        markImageLoaded('smashup/cards/source-cache-fallback', 'zh-CN', img);

        const html = renderToStaticMarkup(
            <CardPreview previewRef={{ type: 'atlas', atlasId, index: 0 }} locale="zh-CN" />
        );

        expect(html).toContain('https://old-cdn.example.com/i18n/zh-CN/smashup/cards/compressed/source-cache-fallback.webp');
    });

    it('懒注册 atlas 命中同步磁盘缓存但未触发 onload 时，也应恢复显示', async () => {
        const atlasId = 'test:card-preview:lazy-sync-cache-hit';
        const atlasImage = 'smashup/cards/lazy-sync-cache-hit';
        registerLazyCardAtlasSource(atlasId, {
            image: atlasImage,
            grid: { rows: 1, cols: 1 },
        });

        const primaryUrl = getCardAtlasCandidateUrls(atlasImage, 'zh-CN')[0];

        class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            naturalWidth = 0;
            naturalHeight = 0;
            complete = false;
            currentSrc = '';
            private _src = '';

            get src() {
                return this._src;
            }

            set src(value: string) {
                this._src = value;
                this.currentSrc = value;
                if (value === primaryUrl) {
                    this.complete = true;
                    this.naturalWidth = 100;
                    this.naturalHeight = 200;
                }
            }
        }

        vi.stubGlobal('Image', MockImage as unknown as typeof Image);

        try {
            const { container } = render(
                <CardPreview previewRef={{ type: 'atlas', atlasId, index: 0 }} locale="zh-CN" />
            );

            await act(async () => {
                await Promise.resolve();
                await Promise.resolve();
            });

            await waitFor(() => {
                const atlasNode = container.querySelector('[data-card-atlas-frame="true"]');
                const atlasImage = container.querySelector('img[data-card-atlas-img="true"]');
                expect(atlasNode).not.toBeNull();
                expect(atlasImage).not.toBeNull();
                expect(atlasImage?.getAttribute('src')).toBe(primaryUrl);
                expect(atlasNode?.className).not.toContain('atlas-shimmer');
            });
        } finally {
            vi.unstubAllGlobals();
        }
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
            const atlasImage = container.querySelector('img[data-card-atlas-img="true"]');
            expect(atlasImage?.getAttribute('src')).toBe(primaryUrl);
        } finally {
            vi.useRealTimers();
            vi.unstubAllGlobals();
        }
    });

    it('同一图集并发渲染时应复用 in-flight 加载请求', async () => {
        vi.useFakeTimers();
        const atlasId = 'test:card-preview:atlas-shared-inflight';
        const atlasImage = 'smashup/cards/cards-shared-inflight';
        registerCardAtlasSource(atlasId, {
            image: atlasImage,
            config: TEST_UNIFORM_ATLAS,
        });

        const candidateUrls = getCardAtlasCandidateUrls(atlasImage, 'zh-CN');
        const primaryUrl = candidateUrls[0];
        let primaryRequestCount = 0;

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
                if (value === primaryUrl) {
                    primaryRequestCount += 1;
                }
                setTimeout(() => {
                    this.onload?.();
                }, 0);
            }
        }

        vi.stubGlobal('Image', MockImage as unknown as typeof Image);

        try {
            render(
                <div>
                    <CardPreview previewRef={{ type: 'atlas', atlasId, index: 0 }} locale="zh-CN" />
                    <CardPreview previewRef={{ type: 'atlas', atlasId, index: 0 }} locale="zh-CN" />
                </div>
            );

            await act(async () => {
                await vi.runAllTimersAsync();
                await Promise.resolve();
            });

            expect(primaryRequestCount).toBe(1);
        } finally {
            vi.useRealTimers();
            vi.unstubAllGlobals();
        }
    });

});
