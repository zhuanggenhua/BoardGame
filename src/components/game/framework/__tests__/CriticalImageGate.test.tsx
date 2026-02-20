import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CriticalImageGate } from '../CriticalImageGate';

const { preloadCriticalImages, preloadWarmImages } = vi.hoisted(() => ({
    preloadCriticalImages: vi.fn().mockResolvedValue([]),
    preloadWarmImages: vi.fn(),
}));

vi.mock('../../../../core', () => ({
    preloadCriticalImages,
    preloadWarmImages,
    areAllCriticalImagesCached: vi.fn().mockReturnValue(false),
    signalCriticalImagesReady: vi.fn(),
    resetCriticalImagesSignal: vi.fn(),
}));

vi.mock('../../../../core/CriticalImageResolverRegistry', () => ({
    resolveCriticalImages: vi.fn().mockReturnValue({ critical: [], warm: [] }),
}));

vi.mock('../../../system/LoadingScreen', () => ({
    LoadingScreen: ({ description }: { description?: string }) => (
        <div data-loading="true">{description ?? 'loading'}</div>
    ),
    default: ({ description }: { description?: string }) => (
        <div data-loading="true">{description ?? 'loading'}</div>
    ),
}));

describe('CriticalImageGate', () => {
    it('enabled=false 时直接渲染子内容', () => {
        const html = renderToStaticMarkup(
            <CriticalImageGate enabled={false}>
                <div>子内容</div>
            </CriticalImageGate>
        );

        expect(html).toContain('子内容');
        expect(html).not.toContain('data-loading="true"');
    });

    it('enabled=true 时显示加载屏', () => {
        const html = renderToStaticMarkup(
            <CriticalImageGate
                enabled={true}
                gameId="smashup"
                gameState={{}}
                loadingDescription="加载中"
            >
                <div>子内容</div>
            </CriticalImageGate>
        );

        expect(html).toContain('加载中');
        expect(html).not.toContain('子内容');
    });
});
