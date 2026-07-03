/* @vitest-environment happy-dom */

import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeModalErrorBoundary } from '../HomeModalErrorBoundary';

vi.mock('../../lib/feedback/clientAutoReport', () => ({
    reportClientAutoFeedbackOnce: vi.fn(async () => undefined),
}));

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
        const onError = vi.fn();

        const { rerender } = render(
            <HomeModalErrorBoundary resetKey="smashup" onError={onError}>
                <ThrowingModalContent />
            </HomeModalErrorBoundary>,
        );

        expect(onError).toHaveBeenCalledTimes(1);

        rerender(
            <HomeModalErrorBoundary resetKey="smashup" onError={onError}>
                <ThrowingModalContent />
            </HomeModalErrorBoundary>,
        );

        expect(onError).toHaveBeenCalledTimes(1);

        rerender(
            <HomeModalErrorBoundary resetKey="dicethrone" onError={onError}>
                <SafeModalContent />
            </HomeModalErrorBoundary>,
        );

        expect(screen.getByTestId('safe-modal-content')).toBeInTheDocument();
        expect(onError).toHaveBeenCalledTimes(1);
    });
});
