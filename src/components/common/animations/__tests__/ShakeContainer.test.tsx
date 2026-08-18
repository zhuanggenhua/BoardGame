/* @vitest-environment happy-dom */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetFxFrameClockForTests } from '../../../../engine/fx/frameClock';
import { ShakeContainer } from '../ShakeContainer';

describe('ShakeContainer', () => {
    afterEach(() => {
        cleanup();
        resetFxFrameClockForTests();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('宿主 RAF 时间戳异常时不会读空关键帧崩溃', () => {
        const pendingFrames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
            pendingFrames.push(callback);
            return pendingFrames.length;
        }));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        vi.spyOn(performance, 'now').mockReturnValue(500);

        render(
            <ShakeContainer isShaking className="target">
                <div data-testid="content" />
            </ShakeContainer>,
        );

        const target = screen.getByTestId('content').parentElement as HTMLElement;

        expect(() => {
            act(() => {
                pendingFrames.shift()!(undefined as unknown as number);
            });
        }).not.toThrow();
        expect(target.style.transform).toContain('translate3d(');
        expect(target.style.transform).not.toContain('NaN');
        expect(target.style.transform).not.toContain('undefined');
    });
});
