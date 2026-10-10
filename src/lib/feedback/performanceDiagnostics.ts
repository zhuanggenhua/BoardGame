import type { FeedbackPerformanceContext } from './feedbackPayload';

const PERFORMANCE_WINDOW_MS = 30_000;
const MAX_RECENT_REQUESTS = 8;
const MAX_FRAME_SAMPLES = 3_600;

type FrameSample = {
    at: number;
    frameTimeMs: number;
};

type LongTaskSample = {
    at: number;
    durationMs: number;
};

type PerformanceState = {
    lastFrameAt?: number;
    frameSamples: FrameSample[];
    longTaskSamples: LongTaskSample[];
    longTaskObserver?: PerformanceObserver;
};

type PerformanceWindow = Window & {
    __BG_PERFORMANCE_DIAGNOSTICS_INSTALLED__?: boolean;
    __BG_PERFORMANCE_DIAGNOSTICS_STATE__?: PerformanceState;
};

type ConnectionLike = {
    rtt?: number;
    effectiveType?: string;
    downlink?: number;
};

const getHost = (): PerformanceWindow | null => (
    typeof window !== 'undefined' ? (window as PerformanceWindow) : null
);

const getNow = (): number => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const round = (value: number | undefined, digits = 1): number | undefined => {
    if (!Number.isFinite(value)) return undefined;
    const factor = 10 ** digits;
    return Math.round((value as number) * factor) / factor;
};

const positive = (value: number): number | undefined => value >= 0 && Number.isFinite(value) ? value : undefined;

function trimSamples(state: PerformanceState, now: number) {
    const cutoff = now - PERFORMANCE_WINDOW_MS;
    state.frameSamples = state.frameSamples
        .filter((sample) => sample.at >= cutoff)
        .slice(-MAX_FRAME_SAMPLES);
    state.longTaskSamples = state.longTaskSamples.filter((sample) => sample.at >= cutoff);
}

function scheduleFrame(state: PerformanceState) {
    const host = getHost();
    if (!host || typeof host.requestAnimationFrame !== 'function') return;

    host.requestAnimationFrame((timestamp) => {
        const frameAt = Number.isFinite(timestamp) ? timestamp : getNow();
        if (state.lastFrameAt !== undefined) {
            const frameTimeMs = frameAt - state.lastFrameAt;
            if (frameTimeMs > 0 && frameTimeMs < 10_000) {
                state.frameSamples.push({ at: frameAt, frameTimeMs });
            }
        }
        state.lastFrameAt = frameAt;
        trimSamples(state, frameAt);
        scheduleFrame(state);
    });
}

function installLongTaskObserver(state: PerformanceState) {
    if (typeof PerformanceObserver !== 'function') return;

    try {
        const observer = new PerformanceObserver((list) => {
            const now = getNow();
            for (const entry of list.getEntries()) {
                const durationMs = positive(entry.duration);
                if (durationMs === undefined) continue;
                state.longTaskSamples.push({
                    at: positive(entry.startTime) ?? now,
                    durationMs,
                });
            }
            trimSamples(state, now);
        });
        observer.observe({ type: 'longtask', buffered: true });
        state.longTaskObserver = observer;
    } catch {
        // longtask is optional and unsupported in some browsers.
    }
}

export function installPerformanceDiagnostics() {
    const host = getHost();
    if (!host || typeof performance === 'undefined' || host.__BG_PERFORMANCE_DIAGNOSTICS_INSTALLED__) {
        return;
    }

    const state: PerformanceState = {
        frameSamples: [],
        longTaskSamples: [],
    };
    host.__BG_PERFORMANCE_DIAGNOSTICS_INSTALLED__ = true;
    host.__BG_PERFORMANCE_DIAGNOSTICS_STATE__ = state;
    installLongTaskObserver(state);
    scheduleFrame(state);
}

function getFrameDiagnostics(state: PerformanceState): FeedbackPerformanceContext['frame'] {
    if (!state.frameSamples.length) return undefined;

    const buckets = new Map<number, number>();
    for (const sample of state.frameSamples) {
        const bucket = Math.floor(sample.at / 1_000);
        buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    const frameTimes = state.frameSamples.map((sample) => sample.frameTimeMs);
    const averageFrameTimeMs = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;

    return {
        averageFps: round(1_000 / averageFrameTimeMs),
        minFps: round(1_000 / Math.max(...frameTimes)),
        averageFrameTimeMs: round(averageFrameTimeMs),
        maxFrameTimeMs: round(Math.max(...frameTimes)),
        bucketCount: buckets.size,
    };
}

function getLongTaskDiagnostics(state: PerformanceState): FeedbackPerformanceContext['longTasks'] {
    if (!state.longTaskSamples.length) return undefined;
    const durations = state.longTaskSamples.map((sample) => sample.durationMs);
    return {
        count: durations.length,
        totalDurationMs: round(durations.reduce((sum, value) => sum + value, 0)) ?? 0,
        maxDurationMs: round(Math.max(...durations)),
    };
}

function getResourcePath(name: string): string {
    try {
        return new URL(name, window.location.href).pathname || '/';
    } catch {
        return name.split(/[?#]/, 1)[0] || '/';
    }
}

function getNetworkDiagnostics(now: number): FeedbackPerformanceContext['network'] {
    const entries = typeof performance.getEntriesByType === 'function'
        ? performance.getEntriesByType('resource')
            .filter((entry): entry is PerformanceResourceTiming => (
                entry.entryType === 'resource'
                && entry.startTime >= now - PERFORMANCE_WINDOW_MS
                && ['fetch', 'xmlhttprequest'].includes((entry as PerformanceResourceTiming).initiatorType)
            ))
        : [];
    const requests = entries.map((entry) => {
        const ttfbMs = entry.responseStart > 0 && entry.requestStart > 0
            ? positive(entry.responseStart - entry.requestStart)
            : undefined;
        const connectMs = entry.connectEnd > 0 && entry.connectStart > 0
            ? positive(entry.connectEnd - entry.connectStart)
            : undefined;
        return {
            path: getResourcePath(entry.name),
            initiatorType: entry.initiatorType || undefined,
            durationMs: round(positive(entry.duration) ?? 0) ?? 0,
            ttfbMs: round(ttfbMs),
            connectMs: round(connectMs),
        };
    });
    const connection = typeof navigator !== 'undefined'
        ? (navigator as Navigator & { connection?: ConnectionLike }).connection
        : undefined;
    const durations = entries.map((entry) => entry.duration).filter(Number.isFinite);
    const ttfbs = entries
        .map((entry) => entry.responseStart > 0 && entry.requestStart > 0 ? entry.responseStart - entry.requestStart : undefined)
        .filter((value): value is number => value !== undefined && Number.isFinite(value) && value >= 0);

    if (!connection && !requests.length) return undefined;
    return {
        connectionRttMs: round(connection?.rtt),
        effectiveType: connection?.effectiveType,
        downlinkMbps: round(connection?.downlink),
        requestCount: requests.length,
        averageDurationMs: durations.length ? round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : undefined,
        maxDurationMs: durations.length ? round(Math.max(...durations)) : undefined,
        averageTtfbMs: ttfbs.length ? round(ttfbs.reduce((sum, value) => sum + value, 0) / ttfbs.length) : undefined,
        recentRequests: requests.slice(-MAX_RECENT_REQUESTS),
    };
}

export function getPerformanceDiagnostics(): FeedbackPerformanceContext | undefined {
    const host = getHost();
    const state = host?.__BG_PERFORMANCE_DIAGNOSTICS_STATE__;
    if (!host || !state || typeof performance === 'undefined') return undefined;

    const now = getNow();
    trimSamples(state, now);
    return {
        capturedAt: new Date().toISOString(),
        windowMs: PERFORMANCE_WINDOW_MS,
        frame: getFrameDiagnostics(state),
        longTasks: getLongTaskDiagnostics(state),
        network: getNetworkDiagnostics(now),
    };
}
