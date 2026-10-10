// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('performanceDiagnostics', () => {
    let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
    let rafCallbacks: FrameRequestCallback[];
    let currentNow: number;
    let observerCallback: ((list: PerformanceObserverEntryList) => void) | undefined;
    let observerCount: number;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        originalRequestAnimationFrame = window.requestAnimationFrame;
        rafCallbacks = [];
        currentNow = 1_000;
        observerCallback = undefined;
        observerCount = 0;

        vi.spyOn(performance, 'now').mockImplementation(() => currentNow);
        vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
        window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        });

        class StubPerformanceObserver {
            constructor(callback: (list: PerformanceObserverEntryList) => void) {
                observerCallback = callback;
                observerCount += 1;
            }

            observe() { }

            disconnect() { }
        }
        vi.stubGlobal('PerformanceObserver', StubPerformanceObserver);
    });

    afterEach(() => {
        const host = window as Window & {
            __BG_PERFORMANCE_DIAGNOSTICS_INSTALLED__?: boolean;
            __BG_PERFORMANCE_DIAGNOSTICS_STATE__?: unknown;
        };
        delete host.__BG_PERFORMANCE_DIAGNOSTICS_INSTALLED__;
        delete host.__BG_PERFORMANCE_DIAGNOSTICS_STATE__;
        window.requestAnimationFrame = originalRequestAnimationFrame;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('采集 FPS、长任务、网络请求并剥离 URL 查询参数', async () => {
        Object.defineProperty(navigator, 'connection', {
            configurable: true,
            value: { rtt: 86, effectiveType: '4g', downlink: 12.5 },
        });
        vi.mocked(performance.getEntriesByType).mockReturnValue([
            {
                entryType: 'resource',
                startTime: 1_005,
                name: 'https://example.com/api/feedback?token=secret#trace',
                initiatorType: 'fetch',
                duration: 50,
                requestStart: 1_015,
                responseStart: 1_035,
                connectStart: 1_008,
                connectEnd: 1_012,
            } as PerformanceResourceTiming,
        ]);

        const { getPerformanceDiagnostics, installPerformanceDiagnostics } = await import('../feedback/performanceDiagnostics');
        installPerformanceDiagnostics();
        installPerformanceDiagnostics();

        expect(observerCount).toBe(1);
        expect(rafCallbacks).toHaveLength(1);
        rafCallbacks.shift()?.(1_000, 0);
        rafCallbacks.shift()?.(1_016, 0);
        rafCallbacks.shift()?.(1_032, 0);
        currentNow = 1_032;
        observerCallback?.({
            getEntries: () => [{ startTime: 1_010, duration: 120 } as PerformanceEntry],
        } as PerformanceObserverEntryList);

        const diagnostics = getPerformanceDiagnostics();

        expect(diagnostics).toMatchObject({
            windowMs: 30_000,
            frame: {
                averageFps: 62.5,
                minFps: 62.5,
                averageFrameTimeMs: 16,
                maxFrameTimeMs: 16,
                bucketCount: 1,
            },
            longTasks: {
                count: 1,
                totalDurationMs: 120,
                maxDurationMs: 120,
            },
            network: {
                connectionRttMs: 86,
                effectiveType: '4g',
                downlinkMbps: 12.5,
                requestCount: 1,
                averageDurationMs: 50,
                maxDurationMs: 50,
                averageTtfbMs: 20,
                recentRequests: [{
                    path: '/api/feedback',
                    initiatorType: 'fetch',
                    durationMs: 50,
                    ttfbMs: 20,
                    connectMs: 4,
                }],
            },
        });
    });
});
