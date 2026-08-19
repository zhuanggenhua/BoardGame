/* @vitest-environment happy-dom */
import { readFileSync } from 'node:fs';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFxFrameSubscriberCount, resetFxFrameClockForTests } from '../../../../engine/fx/frameClock';
import { ShakeContainer } from '../ShakeContainer';

describe('ShakeContainer', () => {
    afterEach(() => {
        cleanup();
        resetFxFrameClockForTests();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('使用本地时间驱动震动，不订阅共享 FX 帧时钟', () => {
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
        expect(getFxFrameSubscriberCount()).toBe(0);

        expect(() => {
            act(() => {
                pendingFrames.shift()!(undefined as unknown as number);
            });
        }).not.toThrow();
        expect(getFxFrameSubscriberCount()).toBe(0);
        expect(target.style.transform).toContain('translate3d(');
        expect(target.style.transform).not.toContain('NaN');
        expect(target.style.transform).not.toContain('undefined');
    });

    it('受击反馈组件不应接入共享 FX 帧时钟', () => {
        const localFeedbackFiles = [
            '../ShakeContainer.tsx',
            '../DamageFlash.tsx',
            '../ImpactContainer.tsx',
            '../HitStopContainer.tsx',
            '../useDamageFlash.ts',
            '../PulseGlow.tsx',
        ];

        for (const relativePath of localFeedbackFiles) {
            const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
            expect(source, relativePath).not.toMatch(/\b(scheduleFxFrameCallback|subscribeFxFrame|FxFrameSubscription)\b/);
        }
    });
});
