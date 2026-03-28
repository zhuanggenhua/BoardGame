import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetCriticalImageGateCacheForTests, CriticalImageGate } from '../CriticalImageGate';

const {
    areAllCriticalImagesCached,
    cancelWarmPreload,
    createWarmPreloadScheduler,
    enqueueWarmPreload,
    getCriticalImagesEpoch,
    preloadCriticalImages,
    preloadWarmImages,
    signalCriticalImagesReady,
} = vi.hoisted(() => ({
    areAllCriticalImagesCached: vi.fn().mockReturnValue(false),
    cancelWarmPreload: vi.fn(),
    enqueueWarmPreload: vi.fn(),
    createWarmPreloadScheduler: vi.fn().mockReturnValue({
        pause: vi.fn(),
        resume: vi.fn(),
        enqueue: vi.fn((...args) => enqueueWarmPreload(...args)),
    }),
    getCriticalImagesEpoch: vi.fn().mockReturnValue(1),
    preloadCriticalImages: vi.fn().mockResolvedValue([]),
    preloadWarmImages: vi.fn(),
    signalCriticalImagesReady: vi.fn(),
}));

vi.mock('../../../../core', () => ({
    areAllCriticalImagesCached,
    cancelWarmPreload,
    createWarmPreloadScheduler,
    getCriticalImagesEpoch,
    preloadCriticalImages,
    preloadWarmImages,
    signalCriticalImagesReady,
}));

const { resolveCriticalImages } = vi.hoisted(() => ({
    resolveCriticalImages: vi.fn().mockReturnValue({ critical: [], warm: [], phaseKey: 'setup' }),
}));

vi.mock('../../../../core/CriticalImageResolverRegistry', () => ({
    resolveCriticalImages,
}));

vi.mock('../../../system/LoadingScreen', () => ({
    LoadingScreen: ({ description, anchor }: { description?: string; anchor?: string }) => (
        <div data-loading="true" data-anchor={anchor ?? 'viewport'}>{description ?? 'loading'}</div>
    ),
    default: ({ description, anchor }: { description?: string; anchor?: string }) => (
        <div data-loading="true" data-anchor={anchor ?? 'viewport'}>{description ?? 'loading'}</div>
    ),
}));

beforeEach(() => {
    cleanup();
    __resetCriticalImageGateCacheForTests();
    vi.clearAllMocks();
    vi.mocked(areAllCriticalImagesCached).mockReturnValue(false);
    vi.mocked(cancelWarmPreload).mockImplementation(() => undefined);
    vi.mocked(getCriticalImagesEpoch).mockReturnValue(1);
    vi.mocked(preloadCriticalImages).mockResolvedValue([]);
    vi.mocked(preloadWarmImages).mockImplementation(() => undefined);
    vi.mocked(signalCriticalImagesReady).mockImplementation(() => undefined);
    vi.mocked(resolveCriticalImages).mockReturnValue({ critical: [], warm: [], phaseKey: 'setup' });
    vi.mocked(enqueueWarmPreload).mockImplementation(() => undefined);
});

describe('CriticalImageGate', () => {
    it('enabled=false 时直接渲染子内容', () => {
        const html = renderToStaticMarkup(
            <CriticalImageGate enabled={false}>
                <div>子内容</div>
            </CriticalImageGate>,
        );

        expect(html).toContain('子内容');
        expect(html).not.toContain('data-loading="true"');
    });

    it('enabled=true 且需要加载时显示加载屏', () => {
        const html = renderToStaticMarkup(
            <CriticalImageGate
                enabled={true}
                gameId="smashup"
                gameState={{}}
                loadingDescription="加载中"
            >
                <div>子内容</div>
            </CriticalImageGate>,
        );

        expect(html).toContain('加载中');
        expect(html).not.toContain('子内容');
    });

    it('阻塞渲染时应使用容器锚定的加载层', () => {
        const html = renderToStaticMarkup(
            <CriticalImageGate
                enabled={true}
                gameId="smashup"
                gameState={{}}
                loadingDescription="加载中"
            >
                <div>子内容</div>
            </CriticalImageGate>,
        );

        expect(html).toContain('data-anchor="container"');
    });

    it('空 critical 阶段会快速放行，不会卡在加载页', async () => {
        vi.mocked(resolveCriticalImages).mockReturnValue({
            critical: [],
            warm: [],
            phaseKey: 'tutorial-setup',
        });

        render(
            <CriticalImageGate
                enabled={true}
                gameId="cardia"
                gameState={{ sys: { tutorial: { active: true, stepIndex: 0 } } }}
                loadingDescription="加载中"
            >
                <div>子内容</div>
            </CriticalImageGate>,
        );

        await waitFor(() => {
            expect(screen.getByText('子内容')).toBeInTheDocument();
        });

        expect(screen.queryByText('加载中')).toBeNull();
        expect(preloadCriticalImages).not.toHaveBeenCalled();
        expect(preloadWarmImages).not.toHaveBeenCalled();
        expect(signalCriticalImagesReady).not.toHaveBeenCalled();
    });

    it('同一 runKey 重挂载后不重复显示加载屏', async () => {
        let resolvePreload: ((paths: string[]) => void) | null = null;
        vi.mocked(preloadCriticalImages).mockImplementation(
            () => new Promise<string[]>((resolve) => {
                resolvePreload = resolve;
            }),
        );
        vi.mocked(resolveCriticalImages).mockReturnValue({
            critical: ['dicethrone/images/Common/background'],
            warm: [],
            phaseKey: 'setup:0:0:monk|1:barbarian',
        });

        const firstView = render(
            <CriticalImageGate
                enabled={true}
                gameId="dicethrone"
                gameState={{}}
                locale="zh-CN"
                playerID="0"
                loadingDescription="加载中"
            >
                <div>子内容</div>
            </CriticalImageGate>,
        );

        expect(screen.getByText('加载中')).toBeInTheDocument();

        resolvePreload?.([]);
        await waitFor(() => {
            expect(screen.getByText('子内容')).toBeInTheDocument();
        });

        firstView.unmount();

        render(
            <CriticalImageGate
                enabled={true}
                gameId="dicethrone"
                gameState={{}}
                locale="zh-CN"
                playerID="0"
                loadingDescription="加载中"
            >
                <div>子内容</div>
            </CriticalImageGate>,
        );

        expect(screen.getByText('子内容')).toBeInTheDocument();
        expect(screen.queryByText('加载中')).toBeNull();
        expect(preloadCriticalImages).toHaveBeenCalledTimes(1);
    });

    it('关键图命中缓存后，phaseKey 变化仍会重排 warm 队列', async () => {
        vi.mocked(areAllCriticalImagesCached).mockReturnValue(true);
        vi.mocked(resolveCriticalImages).mockImplementation((_gameId, state) => {
            const phase = String((state as { phase: string }).phase);
            return {
                critical: ['dicethrone/images/Common/background'],
                warm: [`warm:${phase}`],
                phaseKey: phase,
            };
        });

        const view = render(
            <CriticalImageGate
                enabled={true}
                gameId="dicethrone"
                gameState={{ phase: 'setup:monk' }}
                locale="zh-CN"
                playerID="0"
            >
                <div>子内容</div>
            </CriticalImageGate>,
        );

        await waitFor(() => {
            expect(screen.getByText('子内容')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(cancelWarmPreload).toHaveBeenCalledTimes(1);
            expect(preloadWarmImages).toHaveBeenCalledWith(['warm:setup:monk'], 'zh-CN', 'dicethrone');
        });

        view.rerender(
            <CriticalImageGate
                enabled={true}
                gameId="dicethrone"
                gameState={{ phase: 'setup:barbarian' }}
                locale="zh-CN"
                playerID="0"
            >
                <div>子内容</div>
            </CriticalImageGate>,
        );

        await waitFor(() => {
            expect(cancelWarmPreload).toHaveBeenCalledTimes(2);
            expect(preloadWarmImages).toHaveBeenLastCalledWith(['warm:setup:barbarian'], 'zh-CN', 'dicethrone');
        });

        expect(preloadCriticalImages).not.toHaveBeenCalled();
    });

    it('blockRendering=false 时立即渲染子内容，同时继续后台预加载', async () => {
        let resolvePreload: ((paths: string[]) => void) | null = null;
        vi.mocked(preloadCriticalImages).mockImplementation(
            () => new Promise<string[]>((resolve) => {
                resolvePreload = resolve;
            }),
        );
        vi.mocked(resolveCriticalImages).mockReturnValue({
            critical: ['smashup/images/card-back'],
            warm: [],
            phaseKey: 'opening-hand',
        });

        render(
            <CriticalImageGate
                enabled={true}
                blockRendering={false}
                gameId="smashup"
                gameState={{}}
                locale="zh-CN"
                loadingDescription="加载中"
            >
                <div>子内容</div>
            </CriticalImageGate>,
        );

        expect(screen.getByText('子内容')).toBeInTheDocument();
        expect(screen.queryByText('加载中')).toBeNull();
        expect(preloadCriticalImages).toHaveBeenCalledTimes(1);

        resolvePreload?.(['warm:image']);
        await waitFor(() => {
            expect(enqueueWarmPreload).toHaveBeenCalledWith(['warm:image'], 'zh-CN', 'smashup');
        });
    });
});
