import type { OnlineAiClientTransportDiagnostics } from './protocol';

const ONLINE_AI_ATTEMPT_KEY_MAX_LENGTH = 180;
const ONLINE_AI_DIAGNOSTIC_ERROR_MAX_LENGTH = 300;
const ONLINE_AI_STATE_EVENT_KINDS = new Set(['none', 'sync', 'update', 'patch']);
const ONLINE_AI_PATCH_ISSUE_KINDS = new Set(['discontinuity', 'apply-failed']);

export function normalizeOnlineAiAttemptKey(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0
        ? normalized.slice(0, ONLINE_AI_ATTEMPT_KEY_MAX_LENGTH)
        : null;
}

export function normalizeOnlineAiClientTransportDiagnostics(
    value: unknown,
): OnlineAiClientTransportDiagnostics | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const raw = value as Record<string, unknown>;
    if (typeof raw.sentAt !== 'number' || !Number.isFinite(raw.sentAt)) {
        return null;
    }
    const lastStateEventKind = ONLINE_AI_STATE_EVENT_KINDS.has(String(raw.lastStateEventKind))
        ? String(raw.lastStateEventKind) as OnlineAiClientTransportDiagnostics['lastStateEventKind']
        : 'none';
    const rawPatchIssue = raw.lastPatchIssue;
    let lastPatchIssue: OnlineAiClientTransportDiagnostics['lastPatchIssue'] = null;
    if (rawPatchIssue && typeof rawPatchIssue === 'object' && !Array.isArray(rawPatchIssue)) {
        const patchIssue = rawPatchIssue as Record<string, unknown>;
        if (
            ONLINE_AI_PATCH_ISSUE_KINDS.has(String(patchIssue.kind))
            && typeof patchIssue.at === 'number'
            && Number.isFinite(patchIssue.at)
        ) {
            lastPatchIssue = {
                kind: String(patchIssue.kind) as NonNullable<typeof lastPatchIssue>['kind'],
                expectedStateID: typeof patchIssue.expectedStateID === 'number'
                    ? patchIssue.expectedStateID
                    : null,
                receivedStateID: typeof patchIssue.receivedStateID === 'number'
                    ? patchIssue.receivedStateID
                    : null,
                error: typeof patchIssue.error === 'string'
                    ? patchIssue.error.slice(0, ONLINE_AI_DIAGNOSTIC_ERROR_MAX_LENGTH)
                    : null,
                at: patchIssue.at,
            };
        }
    }
    return {
        sentAt: raw.sentAt,
        lastStateEventKind,
        lastStateEventStateID: typeof raw.lastStateEventStateID === 'number'
            ? raw.lastStateEventStateID
            : null,
        lastStateEventAt: typeof raw.lastStateEventAt === 'number'
            ? raw.lastStateEventAt
            : null,
        syncInFlight: raw.syncInFlight === true,
        lastSyncRequestReason: typeof raw.lastSyncRequestReason === 'string'
            ? raw.lastSyncRequestReason.slice(0, ONLINE_AI_DIAGNOSTIC_ERROR_MAX_LENGTH)
            : null,
        lastSyncRequestedAt: typeof raw.lastSyncRequestedAt === 'number'
            ? raw.lastSyncRequestedAt
            : null,
        lastPatchIssue,
    };
}
