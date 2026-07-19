/* @vitest-environment happy-dom */

import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeModalErrorBoundary } from '../HomeModalErrorBoundary';

vi.mock('../../lib/feedback/clientAutoReport', () => ({
    reportClientAutoFeedbackOnce: vi.fn(async () => undefined),
}));

vi.mock('../../lib/staleChunkReloadGuard', async () => {
    const actual = await vi.importActual<typeof import('../../lib/staleChunkReloadGuard')>('../../lib/staleChunkReloadGuard');
    return {
        ...actual,
        reloadForStaleChunkOnce: vi.fn(() => true),
    };
});

const ThrowingModalContent = () => {
    throw new Error('modal render failed');
};

const SafeModalContent = () => <div data-testid="safe-modal-content">safe</div>;

describe('HomeModalErrorBoundary', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('同一个游戏详情弹窗出错后不应因 children 引用变化反复重置', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { rerender } = render(
            <HomeModalErrorBoundary resetKey="smashup">
                <ThrowingModalContent />
            </HomeModalErrorBoundary>,
        );

        rerender(
            <HomeModalErrorBoundary resetKey="smashup">
                <ThrowingModalContent />
            </HomeModalErrorBoundary>,
        );

        rerender(
            <HomeModalErrorBoundary resetKey="dicethrone">
                <SafeModalContent />
            </HomeModalErrorBoundary>,
        );

        expect(screen.getByTestId('safe-modal-content')).toBeInTheDocument();
    });

    it('详情弹窗模块缺少导出时自动刷新一次', async () => {
        const staleGuard = await import('../../lib/staleChunkReloadGuard');
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const boundary = new HomeModalErrorBoundary({ children: null, resetKey: 'smashup' });

        boundary.componentDidCatch(
            new Error('[stale-lazy-module] ../components/lobby/GameDetailsModal missing export GameDetailsModal'),
            { componentStack: '\n    at Lazy' },
        );

        expect(staleGuard.reloadForStaleChunkOnce).toHaveBeenCalledWith('home-modal-error-boundary', window);
    });
});
