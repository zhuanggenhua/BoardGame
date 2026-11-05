import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    captureCurrentFeedbackScreenshot,
    readCachedFeedbackScreenshot,
    startFeedbackScreenshotCache,
} from '../feedbackScreenshot';

const html2CanvasMocks = vi.hoisted(() => ({
    capture: vi.fn(),
    captureTarget: null as unknown,
    captureScale: null as number | null,
    excludedElements: -1,
    preservedEndgameOverlays: -1,
}));

vi.mock('html2canvas', () => ({ default: html2CanvasMocks.capture }));

describe('feedback screenshot capture', () => {
    beforeEach(() => {
        document.body.innerHTML = [
            '<main data-game-page="true">game board</main>',
            '<div data-testid="endgame-overlay">game result</div>',
        ].join('');
        html2CanvasMocks.capture.mockReset();
        html2CanvasMocks.captureTarget = null;
        html2CanvasMocks.captureScale = null;
        html2CanvasMocks.excludedElements = -1;
        html2CanvasMocks.preservedEndgameOverlays = -1;
        html2CanvasMocks.capture.mockImplementation(async (target: unknown, options: any) => {
            html2CanvasMocks.captureTarget = target;
            html2CanvasMocks.captureScale = options.scale;
            const clone = document.implementation.createHTMLDocument();
            clone.body.innerHTML = `${document.body.innerHTML}<div data-feedback-exclude="true">floating menu</div><div data-testid="feedback-modal">feedback dialog</div>`;
            await options.onclone(clone);
            html2CanvasMocks.excludedElements = clone.querySelectorAll(
                '[data-feedback-exclude="true"], [data-testid="feedback-modal"]',
            ).length;
            html2CanvasMocks.preservedEndgameOverlays = clone.querySelectorAll('[data-testid="endgame-overlay"]').length;

            return {
                width: 800,
                height: 600,
                toDataURL: () => 'data:image/jpeg;base64,current-game-screen',
            };
        });
    });

    it('captures body so the endgame portal is included, removes HUD/modal, then caches the result', async () => {
        const context = { gameId: 'dicethrone', matchId: 'match-1', mode: 'local' };

        await expect(captureCurrentFeedbackScreenshot(context)).resolves.toBe(
            'data:image/jpeg;base64,current-game-screen',
        );

        expect(html2CanvasMocks.capture).toHaveBeenCalledTimes(1);
        expect(html2CanvasMocks.captureTarget).toBe(document.body);
        expect(html2CanvasMocks.captureScale).toBe(1);
        expect(html2CanvasMocks.excludedElements).toBe(0);
        expect(html2CanvasMocks.preservedEndgameOverlays).toBe(1);
        expect(readCachedFeedbackScreenshot(context)).toMatchObject({
            dataUrl: 'data:image/jpeg;base64,current-game-screen',
        });
    });

    it('keeps the in-memory cache warm in the background and refreshes it periodically', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<main data-game-page="true">active game</main>';
        const context = { gameId: 'dicethrone', matchId: 'cache-refresh', mode: 'local' };
        const stop = startFeedbackScreenshotCache(context);

        try {
            await vi.advanceTimersByTimeAsync(800);
            expect(html2CanvasMocks.capture).toHaveBeenCalledTimes(1);
            expect(html2CanvasMocks.captureScale).toBe(1);
            const firstCapture = readCachedFeedbackScreenshot(context);
            expect(firstCapture).not.toBeNull();

            await vi.advanceTimersByTimeAsync(20_800);
            expect(html2CanvasMocks.capture).toHaveBeenCalledTimes(2);
            expect(readCachedFeedbackScreenshot(context)?.capturedAt).toBeGreaterThan(firstCapture!.capturedAt);
        } finally {
            stop();
            vi.useRealTimers();
        }
    });

    it('manual capture starts fresh while a background warmup is in flight and prevents stale overwrite', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<main data-game-page="true">active game</main>';
        const context = { gameId: 'dicethrone', matchId: 'manual-over-background', mode: 'local' };
        const pendingCaptures: Array<(canvas: HTMLCanvasElement) => void> = [];
        html2CanvasMocks.capture.mockImplementation(() => new Promise((resolve) => {
            pendingCaptures.push(resolve);
        }));
        const canvas = (dataUrl: string) => ({
            width: 800,
            height: 600,
            toDataURL: () => dataUrl,
        }) as HTMLCanvasElement;
        const waitForCaptureCount = async (expected: number) => {
            for (let attempt = 0; attempt < 50 && pendingCaptures.length < expected; attempt += 1) {
                await vi.advanceTimersByTimeAsync(0);
                await Promise.resolve();
            }
            expect(pendingCaptures).toHaveLength(expected);
        };
        const stop = startFeedbackScreenshotCache(context);

        try {
            await vi.advanceTimersByTimeAsync(800);
            await waitForCaptureCount(1);
            const manualCapture = captureCurrentFeedbackScreenshot(context);
            await waitForCaptureCount(2);

            pendingCaptures[1](canvas('data:image/jpeg;base64,current-manual'));
            await expect(manualCapture).resolves.toBe('data:image/jpeg;base64,current-manual');
            pendingCaptures[0](canvas('data:image/jpeg;base64,older-background'));
            await vi.advanceTimersByTimeAsync(0);
            for (let attempt = 0; attempt < 5; attempt += 1) await Promise.resolve();

            expect(readCachedFeedbackScreenshot(context)).toMatchObject({
                dataUrl: 'data:image/jpeg;base64,current-manual',
            });
        } finally {
            stop();
            vi.useRealTimers();
        }
    });
});
