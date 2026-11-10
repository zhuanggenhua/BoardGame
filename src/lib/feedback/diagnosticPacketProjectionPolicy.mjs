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
