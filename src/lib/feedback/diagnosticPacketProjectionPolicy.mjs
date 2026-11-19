const SAFE_DIAGNOSTIC_SOURCES = new Set(['user', 'client-auto', 'server']);
const SAFE_COLLECTION_STATUSES = new Set(['complete', 'partial', 'failed']);
const SAFE_REPLAYABILITIES = new Set(['full', 'partial', 'unreplayable']);
const SAFE_MISSING_FIELDS = new Set([
    'correlation.matchId',
    'correlation.roomId',
    'correlation.requestId',
    'correlation.stateId',
    'correlation.stateRevision',
    'correlation.decisionEpoch',
    'randomCursor',
    'privateReplay',
    'privateReplay.trigger',
    'privateReplay.stateSnapshot',
    'snapshots.at',
    'snapshots.privateStateRedacted',
    'snapshots.before',
    'snapshots.after',
    'undo.snapshots',
]);

const MAX_MISSING_FIELDS = 12;

function safeEnum(value, allowed) {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return allowed.has(normalized) ? normalized : undefined;
}

/** Shared public/triage projection policy for historical diagnostic metadata. */
export function projectFeedbackDiagnosticMetadata(value) {
    const packet = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const source = safeEnum(packet.source, SAFE_DIAGNOSTIC_SOURCES);
    const collectionStatus = safeEnum(packet.collectionStatus, SAFE_COLLECTION_STATUSES);
    const replayability = safeEnum(packet.replayability, SAFE_REPLAYABILITIES);
    const missingFields = Array.isArray(packet.missingFields)
        ? [...new Set(packet.missingFields
            .filter((field) => typeof field === 'string')
            .map((field) => field.trim())
            .filter((field) => SAFE_MISSING_FIELDS.has(field)))].slice(0, MAX_MISSING_FIELDS)
        : undefined;

    return {
        ...(source ? { source } : {}),
        ...(collectionStatus ? { collectionStatus } : {}),
        ...(replayability ? { replayability } : {}),
        ...(missingFields ? { missingFields } : {}),
    };
}

export function projectStoredFeedbackErrorLocation(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const { bundle, line, column } = value;
    if (typeof bundle !== 'string' || !/^[a-zA-Z0-9_-]{8,16}$/.test(bundle)
        || !Number.isInteger(line) || line < 0 || line > 9999999
        || !Number.isInteger(column) || column < 0 || column > 9999999) return undefined;
    return { bundle, line, column };
}

export function projectFailedFeedbackAsset(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const { path, observedAt, responseStatus, timingResponseStartPresent, online } = value;
    if (typeof path !== 'string' || path.length > 256 || !/^\/assets\/[A-Za-z0-9_.-]+\.css$/.test(path)
        || typeof observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(observedAt)
        || !Number.isFinite(Date.parse(observedAt))) return undefined;
    const timings = Object.fromEntries(
        ['durationMs', 'transferSize', 'encodedBodySize', 'decodedBodySize']
            .filter((key) => Number.isFinite(value[key]) && value[key] >= 0)
            .map((key) => [key, value[key]]),
    );
    return {
        path, observedAt, ...timings,
        ...(Number.isInteger(responseStatus) && responseStatus >= 100 && responseStatus <= 599 ? { responseStatus } : {}),
        ...(typeof timingResponseStartPresent === 'boolean' ? { timingResponseStartPresent } : {}),
        ...(typeof online === 'boolean' ? { online } : {}),
    };
}
