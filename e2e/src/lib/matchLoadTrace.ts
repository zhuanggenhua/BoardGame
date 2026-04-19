type MatchLoadTracePayload = Record<string, unknown>;

export type MatchLoadTraceEntry = {
    stage: string;
    gameId?: string;
    matchId?: string;
    source?: string;
    payload?: MatchLoadTracePayload;
    timestamp: number;
};

type MatchLoadTraceContext = {
    traceId: string | null;
    startedAt: number | null;
    source?: string;
    gameId?: string;
    matchId?: string;
    entries: MatchLoadTraceEntry[];
};

type StartMatchLoadTraceParams = {
    source: string;
    stage: string;
    gameId?: string;
    matchId?: string;
    payload?: MatchLoadTracePayload;
};

type AppendMatchLoadTraceParams = {
    stage: string;
    gameId?: string;
    matchId?: string;
    source?: string;
    payload?: MatchLoadTracePayload;
};

const MAX_TRACE_ENTRIES = 160;
const MAX_RESOURCE_SAMPLES = 8;

const getTraceStore = (): MatchLoadTraceContext => {
    const globalStore = globalThis as typeof globalThis & { __BG_MATCH_LOAD_TRACE__?: MatchLoadTraceContext };
    if (!globalStore.__BG_MATCH_LOAD_TRACE__) {
        globalStore.__BG_MATCH_LOAD_TRACE__ = {
            traceId: null,
            startedAt: null,
            entries: [],
        };
    }
    return globalStore.__BG_MATCH_LOAD_TRACE__;
};

const pushTraceEntry = (entry: MatchLoadTraceEntry) => {
    const store = getTraceStore();
    store.entries.push(entry);
    if (store.entries.length > MAX_TRACE_ENTRIES) {
        store.entries.splice(0, store.entries.length - MAX_TRACE_ENTRIES);
    }
};

const buildTraceEntry = (
    params: AppendMatchLoadTraceParams,
    context: MatchLoadTraceContext,
): MatchLoadTraceEntry => ({
    stage: params.stage,
    gameId: params.gameId ?? context.gameId,
    matchId: params.matchId ?? context.matchId,
    source: params.source ?? context.source,
    payload: params.payload,
    timestamp: Date.now(),
});

export const startMatchLoadTrace = (params: StartMatchLoadTraceParams) => {
    const store = getTraceStore();
    store.traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    store.startedAt = Date.now();
    store.source = params.source;
    store.gameId = params.gameId;
    store.matchId = params.matchId;
    store.entries = [];
    pushTraceEntry(buildTraceEntry(params, store));
};

export const appendMatchLoadTrace = (params: AppendMatchLoadTraceParams) => {
    const store = getTraceStore();
    if (params.source) {
        store.source = params.source;
    }
    if (params.gameId) {
        store.gameId = params.gameId;
    }
    if (params.matchId) {
        store.matchId = params.matchId;
    }
    pushTraceEntry(buildTraceEntry(params, store));
};

export const captureRecentMatchLoadResources = (): Record<string, unknown> => {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
        return {};
    }

    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    if (!entries || entries.length === 0) {
        return { recentResourceCount: 0, recentResourceSamples: [] };
    }

    const recent = entries.slice(-MAX_RESOURCE_SAMPLES).map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        durationMs: Math.round(entry.duration),
        transferSize: 'transferSize' in entry ? entry.transferSize : undefined,
    }));

    return {
        recentResourceCount: entries.length,
        recentResourceSamples: recent,
    };
};
