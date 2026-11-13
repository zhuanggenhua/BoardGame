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
const diceCapture = vi.hoisted(() => vi.fn());

vi.mock('html2canvas', () => ({ default: html2CanvasMocks.capture }));
vi.mock('../../dice-box-threejs/canvasCapture', () => ({ captureDiceCanvas: diceCapture }));

describe('feedback screenshot capture', () => {
    beforeEach(() => {
        document.body.innerHTML = [
            '<main data-game-page="true">game board</main>',
            '<div data-testid="endgame-overlay">game result</div>',
        ].join('');
        html2CanvasMocks.capture.mockReset();
        diceCapture.mockReset();
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

    it('encodes the real capture in a worker with the same dimensions and JPEG quality', async () => {
        const bitmap = { close: vi.fn() };
        const terminate = vi.fn();
        const postMessage = vi.fn(function (this: any, message: unknown) {
            expect(message).toEqual({ bitmap, maxWidth: 1280, maxHeight: 960, quality: 0.7 });
            queueMicrotask(() => this.onmessage({ data: { dataUrl: 'data:image/jpeg;base64,worker' } }));
        });
        class MockWorker {
            onmessage: any;
            onerror: any;
            postMessage = postMessage;
            terminate = terminate;
        }
        vi.stubGlobal('Worker', MockWorker);
        vi.stubGlobal('OffscreenCanvas', class {});
        vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
        try {
            await expect(captureCurrentFeedbackScreenshot({ gameId: 'qidahen', matchId: 'worker' }))
                .resolves.toBe('data:image/jpeg;base64,worker');
            expect(postMessage).toHaveBeenCalledTimes(1);
            expect(terminate).toHaveBeenCalledTimes(1);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it.each(['error', 'timeout'] as const)('falls back to the original encoder when the worker reports %s', async (failure) => {
        vi.useFakeTimers();
        const terminate = vi.fn();
        const bitmap = { close: vi.fn() };
        class MockWorker {
            onmessage: any;
            onerror: any;
            onmessageerror: any;
            terminate = terminate;
            postMessage() {
                if (failure === 'error') queueMicrotask(() => this.onerror({ message: 'worker failed' }));
            }
        }
        vi.stubGlobal('Worker', MockWorker);
        vi.stubGlobal('OffscreenCanvas', class {});
        vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const result = captureCurrentFeedbackScreenshot({ gameId: 'qidahen', matchId: `worker-${failure}` });
            await vi.advanceTimersByTimeAsync(5100);
            await expect(result).resolves.toBe('data:image/jpeg;base64,current-game-screen');
            expect(terminate).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalledTimes(1);
        } finally {
            warn.mockRestore();
            vi.unstubAllGlobals();
            vi.useRealTimers();
        }
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

    it('defers automatic capture during rolling, allows manual capture, and resumes when rolling ends', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<main data-game-page="true"><div data-battle-roll-phase="artillery" data-battle-roll-state="rolling"></div></main>';
        const context = { gameId: 'qidahen', matchId: 'rolling' };
        const stop = startFeedbackScreenshotCache(context);
        try {
            await vi.advanceTimersByTimeAsync(25_000);
            expect(html2CanvasMocks.capture).not.toHaveBeenCalled();
            await expect(captureCurrentFeedbackScreenshot(context)).resolves.toBe('data:image/jpeg;base64,current-game-screen');
            expect(html2CanvasMocks.capture).toHaveBeenCalledTimes(1);
            document.querySelector('[data-battle-roll-state]')!.setAttribute('data-battle-roll-state', 'damage');
            await vi.advanceTimersByTimeAsync(0);
            expect(html2CanvasMocks.capture).toHaveBeenCalledTimes(1);
            document.querySelector('[data-battle-roll-state]')!.remove();
            await vi.advanceTimersByTimeAsync(0);
            expect(html2CanvasMocks.capture).toHaveBeenCalledTimes(2);
        } finally { stop(); vi.useRealTimers(); }
    });

    it('retries a background capture if rolling begins while its clone is being prepared', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<main data-game-page="true">active game</main>';
        const context = { gameId: 'qidahen', matchId: 'rolling-race' };
        let release: (() => void) | undefined;
        const original = html2CanvasMocks.capture.getMockImplementation()!;
        html2CanvasMocks.capture.mockImplementationOnce(async (_target: unknown, options: any) => {
            await new Promise<void>(resolve => { release = resolve; });
            await options.onclone(document.implementation.createHTMLDocument());
            throw new Error('deferred clone unexpectedly continued');
        });
        const stop = startFeedbackScreenshotCache(context);
        try {
            await vi.advanceTimersByTimeAsync(800);
            expect(release).toBeDefined();
            const rolling = document.createElement('div'); rolling.setAttribute('data-battle-roll-phase', 'artillery'); rolling.setAttribute('data-battle-roll-state', 'rolling');
            document.body.appendChild(rolling);
            release!();
            await vi.advanceTimersByTimeAsync(0);
            expect(html2CanvasMocks.capture).toHaveBeenCalledTimes(1);
            html2CanvasMocks.capture.mockImplementation(original);
            rolling.remove();
            await vi.advanceTimersByTimeAsync(0);
            expect(html2CanvasMocks.capture).toHaveBeenCalledTimes(2);
            expect(readCachedFeedbackScreenshot(context)).not.toBeNull();
        } finally { stop(); vi.useRealTimers(); }
    });

    it('replaces the cloned dice canvas with the sampled frame without modifying the live die', async () => {
        document.body.innerHTML = '<main data-game-page="true"><div data-testid="die-1" data-dice-physics-source="dice-box-threejs" data-dice-engine-ready="true"><canvas data-dice-physics-source="dice-box-threejs"></canvas></div></main>';
        const live = document.querySelector('canvas')!;
        diceCapture.mockReturnValue({ toDataURL: () => 'data:image/png;base64,sampled-die' });
        html2CanvasMocks.capture.mockImplementationOnce(async (_target: unknown, options: any) => {
            const clone = document.implementation.createHTMLDocument();
            clone.body.innerHTML = '<div data-testid="die-1" data-dice-physics-source="dice-box-threejs"><img src="data:image/png;base64,empty"></div>';
            await options.onclone(clone);
            expect(clone.querySelector('img')!.src).toBe('data:image/png;base64,sampled-die');
            return { width: 800, height: 600, toDataURL: () => 'data:image/jpeg;base64,current-game-screen' };
        });
        await captureCurrentFeedbackScreenshot({ gameId: 'qidahen', matchId: 'dice-snapshot' });
        expect(diceCapture).toHaveBeenCalledWith(live);
        expect(document.querySelector('canvas')).toBe(live);
    });

    it('fails explicitly if a visible die has no registered capture', async () => {
        document.body.innerHTML = '<main data-game-page="true"><div data-dice-physics-source="dice-box-threejs"><canvas></canvas></div></main>';
        diceCapture.mockReturnValue(null);
        await expect(captureCurrentFeedbackScreenshot({ gameId: 'qidahen', matchId: 'missing-dice-capture' }))
            .rejects.toThrow('骰子渲染画布未注册截图');
    });

    it('does not run a deferred capture after its session is stopped', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<main data-game-page="true"><div data-dice-physics-source="dice-box-threejs" data-dice-settled="false"></div></main>';
        const stop = startFeedbackScreenshotCache({ gameId: 'qidahen', matchId: 'rolling-stop' });
        try {
            stop(); document.querySelector('[data-dice-physics-source]')!.remove();
            await vi.advanceTimersByTimeAsync(21_000);
            expect(html2CanvasMocks.capture).not.toHaveBeenCalled();
        } finally { vi.useRealTimers(); }
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
