import { spawnSync as defaultSpawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import {
    DEFAULT_MONGO_COMMAND,
    DEFAULT_MONGO_SSH_TARGET,
} from './feedback-status-writer.mjs';
import { projectFeedbackDiagnosticMetadata } from '../../../../../src/lib/feedback/diagnosticPacketProjectionPolicy.mjs';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
export const MAX_TARGETED_FEEDBACK_IDS = 100;
const MAX_PRIVATE_REPLAY_OUTPUT_BYTES = 8 * 1024 * 1024;
const SAFE_UNSATISFIABLE_REASONS = new Set([
    'empty-options',
    'all-options-disabled',
    'min-selection-unreachable',
]);

function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}

function shortString(value) {
    return typeof value === 'string' && value.length <= 200 ? value : undefined;
}

function shortNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function summarizeCaptureFailure(value) {
    if (typeof value !== 'string' || !value) return undefined;
    if (value.startsWith('private_replay_missing:')) return 'missing-fields';
    if (value.startsWith('private_replay_capture_failed:')) return 'capture-failed';
    return 'unknown';
}

function summarizeCollectionErrors(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((entry) => typeof entry === 'string').map((entry) => {
        if (entry === 'private_replay_not_captured') return 'private-replay-not-captured';
        if (entry.startsWith('private_replay_missing:')) return 'private-replay-missing-fields';
        if (entry.startsWith('private_replay_capture_failed:')) return 'private-replay-capture-failed';
        return 'unspecified-collection-error';
    }))].slice(0, 8);
}

function summarizeInteraction(sys) {
    const interactionState = asRecord(sys?.interaction);
    const current = asRecord(interactionState?.current);
    if (!interactionState && !current) return null;
    const data = asRecord(current?.data);
    return {
        ...(typeof interactionState?.isBlocked === 'boolean' ? { isBlocked: interactionState.isBlocked } : {}),
        current: current
            ? {
                ...(shortString(current.playerId) ? { hasPlayerId: true } : {}),
                ...(shortString(current.type) ? { type: current.type } : {}),
                ...(typeof data?.sourceId === 'string' ? { hasSourceId: true } : {}),
            }
            : null,
    };
}

function summarizeQidahenState(core) {
    const factions = asRecord(core.factions) || {};
    const playerIds = Array.isArray(core.playerIds)
        ? core.playerIds.filter((playerId) => typeof playerId === 'string')
        : [];
    const factionSelection = asRecord(core.factionSelection);
    const selections = asRecord(factionSelection?.selections) || {};
    const scenarioVote = asRecord(core.scenarioVote);
    const votes = asRecord(scenarioVote?.votes) || {};
    const choiceSummary = (groups, optionField) => Array.isArray(groups)
        ? groups.map((value) => {
            const group = asRecord(value) || {};
            const options = group[optionField];
            return {
                ...(shortNumber(group.count) !== undefined ? { count: group.count } : {}),
                optionCount: Array.isArray(options) ? options.length : 0,
            };
        })
        : [];

    return {
        factionCount: Object.keys(factions).length,
        factionSelection: factionSelection
            ? {
                pendingCount: playerIds.filter((playerId) => selections[playerId] == null).length,
                selectedCount: Object.keys(selections).length,
            }
            : null,
        scenarioVote: scenarioVote
            ? {
                hasHost: Boolean(scenarioVote.hostPlayerId),
                pendingCount: Object.entries(votes)
                    .filter(([, vote]) => vote == null)
                    .length,
            }
            : null,
        pendingScenarioCharacterChoices: choiceSummary(core.pendingScenarioCharacterChoices, 'characterIds'),
        pendingScenarioArmamentChoices: choiceSummary(core.pendingScenarioArmamentChoices, 'armamentIds'),
    };
}

function summarizeRecoverySnapshot(snapshotValue) {
    const snapshot = asRecord(snapshotValue);
    if (!snapshot) return null;
    const legalActions = asRecord(snapshot.legalActions);
    const aiDecisionPreview = asRecord(snapshot.aiDecisionPreview);
    const interaction = asRecord(snapshot.interaction);
    const chosenAction = asRecord(aiDecisionPreview?.chosenAction);
    const interactionSummary = interaction
        ? Object.fromEntries(
            ['isBlocked', 'sharedSelectability', 'seatSelectability']
                .filter((key) => typeof interaction[key] === 'boolean' || typeof interaction[key] === 'string')
                .map((key) => [key, interaction[key]]),
        )
        : null;
    if (interactionSummary) {
        for (const key of ['sharedUnsatisfiableReason', 'seatUnsatisfiableReason']) {
            const reason = interaction[key];
            if (typeof reason === 'string' && SAFE_UNSATISFIABLE_REASONS.has(reason)) {
                interactionSummary[key] = reason;
            }
        }
    }
    return {
        ...(shortString(snapshot.phase) !== undefined ? { phase: snapshot.phase } : {}),
        ...(shortNumber(snapshot.turnNumber) !== undefined ? { turnNumber: snapshot.turnNumber } : {}),
        ...(shortString(snapshot.currentPlayerId) ? { hasCurrentPlayer: true } : {}),
        ...(typeof snapshot.blockerFingerprint === 'string' ? { hasBlockerFingerprint: true } : {}),
        ...(typeof snapshot.progressMarker === 'string' ? { hasProgressMarker: true } : {}),
        interaction: interactionSummary,
        legalActions: legalActions
            ? {
                ...(shortNumber(legalActions.total) !== undefined ? { total: legalActions.total } : {}),
                ...(typeof legalActions.truncated === 'boolean' ? { truncated: legalActions.truncated } : {}),
            }
            : null,
        aiDecisionPreview: aiDecisionPreview
            ? {
                ...(shortString(aiDecisionPreview.previewSource) ? { previewSource: aiDecisionPreview.previewSource } : {}),
                ...(shortString(aiDecisionPreview.policyId) ? { policyId: aiDecisionPreview.policyId } : {}),
                ...(shortNumber(aiDecisionPreview.confidence) !== undefined ? { confidence: aiDecisionPreview.confidence } : {}),
                chosenActionPresent: aiDecisionPreview.chosenAction != null,
                chosenAction: chosenAction
                    ? {
                        ...(shortString(chosenAction.kind) ? { kind: chosenAction.kind } : {}),
                        ...(shortString(chosenAction.type) ? { type: chosenAction.type } : {}),
                    }
                    : null,
            }
            : null,
    };
}

function summarizeDiagnosticSnapshot(gameId, snapshotValue) {
    const snapshot = asRecord(snapshotValue);
    if (!snapshot) return null;
    if ('sys' in snapshot || 'core' in snapshot) {
        return summarizePrivateReplayState(gameId, snapshot);
    }
    return summarizeRecoverySnapshot(snapshot);
}

export function summarizePrivateReplayState(gameId, stateValue) {
    const state = asRecord(stateValue);
    if (!state) return null;
    const sys = asRecord(state.sys) || {};
    const core = asRecord(state.core) || {};
    const summary = {
        phase: typeof sys.phase === 'string' ? sys.phase : null,
        turnNumber: shortNumber(sys.turnNumber) ?? null,
        turnPhase: shortString(core.turnPhase) ?? null,
        hasCurrentPlayer: shortString(core.currentPlayer) !== undefined,
        interaction: summarizeInteraction(sys),
    };
    if (gameId === 'qidahen') Object.assign(summary, summarizeQidahenState(core));
    return summary;
}

export function summarizeFeedbackDiagnosticPacket(packetValue) {
    let packet = packetValue;
    if (typeof packet === 'string') {
        try {
            packet = JSON.parse(packet);
        } catch {
            return { parseStatus: 'invalid-json' };
        }
    }
    const value = asRecord(packet);
    if (!value) return null;
    const metadata = projectFeedbackDiagnosticMetadata(value);
    const correlation = asRecord(value.correlation) || {};
    const snapshots = asRecord(value.snapshots) || {};
    let stateAt = snapshots.at;
    if (typeof stateAt === 'string') {
        try {
            stateAt = JSON.parse(stateAt);
        } catch {
            stateAt = null;
        }
    }
    return {
        ...(shortNumber(value.schemaVersion) !== undefined ? { schemaVersion: value.schemaVersion } : {}),
        ...(shortString(value.captureId) ? { hasCaptureId: true } : {}),
        ...(shortString(value.chainId) ? { hasChainId: true } : {}),
        ...(shortString(value.capturedAt) ? { capturedAt: value.capturedAt } : {}),
        ...metadata,
        correlation: Object.fromEntries(
            [
                ['matchId', 'hasMatchId'],
                ['roomId', 'hasRoomId'],
                ['requestId', 'hasRequestId'],
                ['stateId', 'hasStateId'],
                ['stateRevision', 'hasStateRevision'],
                ['decisionEpoch', 'hasDecisionEpoch'],
            ]
                .filter(([key]) => typeof correlation[key] === 'string' || typeof correlation[key] === 'number')
                .map(([, presenceKey]) => [presenceKey, true]),
        ),
        ...(shortString(value.phase) ? { phase: value.phase } : {}),
        ...(shortNumber(value.turnNumber) !== undefined ? { turnNumber: value.turnNumber } : {}),
        ...(shortString(value.currentPlayerId) ? { hasCurrentPlayer: true } : {}),
        interaction: summarizeInteraction({ interaction: value.interaction }),
        stateAtSummary: summarizeDiagnosticSnapshot(value.gameId, stateAt),
        collectionErrors: Array.isArray(value.collectionErrors)
            ? summarizeCollectionErrors(value.collectionErrors)
            : [],
    };
}

const SAFE_COMPATIBILITY_REASON_CODES = new Set([
    'command_failed',
    'pipeline_error',
    'legal_action_command_failed',
    'visible-interaction',
    'hidden-interaction',
    'response-window',
    'response-loop',
    'active-turn',
    'action-loop',
    'legal-action-only',
    'pending-damage',
    'force-end-turn',
    'failure-budget-exhausted',
    'stale-epoch',
    'stale_state',
    'online_ai_circuit_open',
    'unsatisfiable-interaction-auto-skipped',
    'empty-options',
    'all-options-disabled',
    'no-enabled-options',
    'missing-visible-state',
    'response-window-stalled',
    'diagnostic_available',
]);

function summarizeCompatibilityActionLog(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    let parsed;
    try {
        parsed = JSON.parse(value);
    } catch {
        return { present: true, format: 'unstructured', characterCount: value.length };
    }
    if (Array.isArray(parsed)) {
        const entries = parsed.slice(-12).flatMap((entryValue) => {
            const entry = asRecord(entryValue) || {};
            const event = asRecord(entry.event) || {};
            const segments = Array.isArray(entry.segments) ? entry.segments : null;
            const timestamp = shortNumber(entry.timestamp);
            const kind = shortString(entry.kind);
            const eventType = shortString(event.type);
            const segmentCount = shortNumber(entry.segmentCount) ?? (segments ? segments.length : undefined);
            const summary = {
                ...(timestamp !== undefined ? { timestamp } : {}),
                ...(kind ? { kind } : {}),
                ...(eventType ? { eventType } : {}),
                ...(segmentCount !== undefined ? { segmentCount } : {}),
            };
            return Object.keys(summary).length > 0 ? [summary] : [];
        });
        return { present: true, entryCount: parsed.length, entries };
    }
    const record = asRecord(parsed);
    if (!record) return { present: true, format: 'unsupported' };
    const actionLogTail = Array.isArray(record.actionLogTail) ? record.actionLogTail : [];
    const eventStreamTail = Array.isArray(record.eventStreamTail) ? record.eventStreamTail : [];
    const phase = shortString(record.phase);
    const turnNumber = shortNumber(record.turnNumber);
    const visibleActionLogRowCount = shortNumber(record.visibleActionLogRowCount);
    const interaction = asRecord(record.interaction);
    const interactionData = asRecord(interaction?.data);
    const interactionSummary = interaction
        ? {
            ...(typeof interaction.isBlocked === 'boolean' ? { isBlocked: interaction.isBlocked } : {}),
            ...(shortString(interaction.type) ? { type: shortString(interaction.type) } : {}),
            ...(shortNumber(interactionData?.options?.length) !== undefined
                ? { optionCount: shortNumber(interactionData.options.length) }
                : Array.isArray(interactionData?.options) ? { optionCount: interactionData.options.length } : {}),
        }
        : undefined;
    return {
        present: true,
        ...(phase ? { phase } : {}),
        ...(turnNumber !== undefined ? { turnNumber } : {}),
        ...(visibleActionLogRowCount !== undefined ? { visibleActionLogRowCount } : {}),
        actionLogEntryCount: actionLogTail.length,
        eventStreamEntryCount: eventStreamTail.length,
        ...(interactionSummary ? { interaction: interactionSummary } : {}),
    };
}

function summarizeCompatibilitySnapshot(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    let parsed;
    try {
        parsed = JSON.parse(value);
    } catch {
        return { present: true, format: 'unstructured', characterCount: value.length };
    }
    const record = asRecord(parsed);
    if (!record) return { present: true, format: 'unsupported' };
    if ('sys' in record || 'core' in record) {
        return { present: true, ...summarizePrivateReplayState(record.gameId, record) };
    }
    const summary = { present: true };
    for (const key of ['kind', 'feedbackSource', 'gameId', 'phase', 'commandType', 'incidentKind', 'responseWindowType', 'interactionKind', 'turnPhase']) {
        if (shortString(record[key])) summary[key] = shortString(record[key]);
    }
    for (const [key, presenceKey] of [
        ['matchId', 'hasMatchId'],
        ['roomId', 'hasRoomId'],
        ['requestId', 'hasRequestId'],
        ['interactionId', 'hasInteractionId'],
        ['currentPlayerId', 'hasCurrentPlayer'],
    ]) {
        if (shortString(record[key])) summary[presenceKey] = true;
    }
    for (const [key, presenceKey] of [
        ['stateId', 'hasStateId'],
        ['stateID', 'hasStateId'],
        ['stateRevision', 'hasStateRevision'],
        ['decisionEpoch', 'hasDecisionEpoch'],
    ]) {
        if (shortNumber(record[key]) !== undefined) summary[presenceKey] = true;
    }
    for (const key of ['turnNumber', 'randomCursor']) {
        if (shortNumber(record[key]) !== undefined) summary[key] = shortNumber(record[key]);
    }
    if (typeof record.blockerFingerprint === 'string' && record.blockerFingerprint.length > 0) summary.hasBlockerFingerprint = true;
    if (typeof record.progressMarker === 'string' && record.progressMarker.length > 0) summary.hasProgressMarker = true;
    if (record.reason && typeof record.reason === 'string') {
        const reason = record.reason.trim().split(/[:|]/, 1)[0];
        if (SAFE_COMPATIBILITY_REASON_CODES.has(reason)) summary.reason = reason;
    }
    const interaction = asRecord(record.interaction);
    if (interaction) {
        const projected = {};
        for (const key of ['isBlocked', 'sharedSelectability', 'seatSelectability']) {
            if (typeof interaction[key] === 'boolean' || typeof interaction[key] === 'string') projected[key] = interaction[key];
        }
        for (const key of ['sharedUnsatisfiableReason', 'seatUnsatisfiableReason']) {
            if (SAFE_UNSATISFIABLE_REASONS.has(interaction[key])) projected[key] = interaction[key];
        }
        if (Object.keys(projected).length > 0) summary.interaction = projected;
    }
    return summary;
}

export function summarizeLegacyFeedbackDiagnostics(item) {
    const error = asRecord(item?.errorContext);
    const source = typeof error?.source === 'string' && [
        'online-ai-watchdog', 'infra-cpu-watch', 'react.error_boundary', 'feedback.performance',
        'client-auto-report', 'client-runtime-guard', 'client-window-error',
        'client-unhandled-rejection', 'react-error-boundary', 'board-render-error',
        'home-modal-error-boundary',
    ].includes(error.source) ? error.source : undefined;
    const safeErrorNames = new Set([
        'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
        'URIError', 'EvalError', 'AggregateError', 'DOMException', 'AbortError',
        'NetworkError', 'TimeoutError',
    ]);
    const errorName = typeof error?.name === 'string' && safeErrorNames.has(error.name)
        ? error.name
        : undefined;
    const rawMessage = typeof error?.message === 'string' ? error.message.trim() : '';
    const messageCode = rawMessage
        ? rawMessage.split(/[:|]/, 1)[0]
        : '';
    const safeMessageCode = SAFE_COMPATIBILITY_REASON_CODES.has(messageCode) ? messageCode : undefined;
    const route = typeof item?.clientContext?.route === 'string' ? item.clientContext.route : '';
    const routeClass = /^\/play\/[^/?#]+\/match(?:\/[^/?#]+)?(?:[?#].*)?$/.test(route)
        ? 'game-match'
        : route.startsWith('/admin') ? 'admin' : route.startsWith('/play') ? 'game' : route ? 'other' : undefined;
    return {
        errorContext: {
            present: Boolean(error && Object.keys(error).length > 0),
            ...(source ? { source } : {}),
            ...(errorName ? { name: errorName } : {}),
            ...(safeMessageCode ? { messageCode: safeMessageCode } : {}),
            ...(typeof error?.stack === 'string' && error.stack.trim() ? { hasStack: true } : {}),
            ...(typeof error?.jsStack === 'string' && error.jsStack.trim() ? { hasJsStack: true } : {}),
            ...(typeof error?.componentStack === 'string' && error.componentStack.trim() ? { hasComponentStack: true } : {}),
        },
        ...(routeClass ? { routeClass } : {}),
        actionLog: summarizeCompatibilityActionLog(item?.actionLog),
        stateSnapshot: summarizeCompatibilitySnapshot(item?.stateSnapshot),
    };
}

export function summarizePrivateFeedbackReplay(encodedReplay, replayError) {
    const captureFailure = summarizeCaptureFailure(replayError);
    if (typeof encodedReplay !== 'string' || !encodedReplay.trim()) {
        return {
            status: 'not-attached',
            ...(captureFailure ? { captureFailure } : {}),
        };
    }
    if (encodedReplay.length > 1_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedReplay)) {
        return { status: 'invalid-encoding' };
    }

    try {
        const archive = JSON.parse(gunzipSync(
            Buffer.from(encodedReplay, 'base64'),
            { maxOutputLength: MAX_PRIVATE_REPLAY_OUTPUT_BYTES },
        ).toString('utf8'));
        const value = asRecord(archive);
        if (!value || !asRecord(value.state)) return { status: 'invalid-archive' };
        return {
            status: 'available',
            ...(captureFailure ? { captureFailure } : {}),
            ...(shortNumber(value.schemaVersion) !== undefined ? { schemaVersion: value.schemaVersion } : {}),
            ...(shortString(value.matchId) ? { hasMatchId: true } : {}),
            ...(shortString(value.gameId) ? { gameId: value.gameId } : {}),
            ...(shortNumber(value.stateId) !== undefined ? { hasStateId: true } : {}),
            ...(shortNumber(value.randomCursor) !== undefined ? { randomCursor: value.randomCursor } : {}),
            stateSummary: summarizePrivateReplayState(value.gameId, value.state),
        };
    } catch {
        return { status: 'decode-failed' };
    }
}

export function buildPrivateReplayMongoReadScript(ids) {
    const normalizedIds = [...new Set(ids.map((id) => String(id)))];
    if (normalizedIds.length > MAX_TARGETED_FEEDBACK_IDS) {
        throw new Error(`私密回放读取最多指定 ${MAX_TARGETED_FEEDBACK_IDS} 个反馈 ID`);
    }
    if (normalizedIds.some((id) => !OBJECT_ID_RE.test(id))) {
        throw new Error('私密回放读取要求有效的 Mongo ObjectId');
    }
    return `
const feedbackIds = ${JSON.stringify(normalizedIds)};
const items = db.feedbacks.find(
  { _id: { $in: feedbackIds.map((id) => ObjectId(id)) } },
  { _id: 1, privateReplay: 1, privateReplayError: 1 }
).toArray();
print(JSON.stringify({ items: items.map((item) => ({
  id: String(item._id),
  privateReplay: typeof item.privateReplay === 'string' ? item.privateReplay : null,
  privateReplayError: typeof item.privateReplayError === 'string' ? item.privateReplayError : null
})) }));
quit(0);
`;
}

function parseMongoReadResult(stdout) {
    for (const line of String(stdout || '').split(/\r?\n/).reverse()) {
        const start = line.indexOf('{');
        const end = line.lastIndexOf('}');
        if (start < 0 || end <= start) continue;
        try {
            const payload = JSON.parse(line.slice(start, end + 1));
            if (Array.isArray(payload?.items)) return payload.items;
        } catch {
            // Ignore shell banners and parse the JSON emitted by mongosh.
        }
    }
    throw new Error('生产 Mongo 私密回放读取未返回有效结果');
}

export function readPrivateFeedbackReplaysViaMongoSsh(ids, deps = {}) {
    const uniqueIds = [...new Set(ids.map((id) => String(id)))];
    if (uniqueIds.length === 0) return new Map();
    if (uniqueIds.length > MAX_TARGETED_FEEDBACK_IDS) {
        throw new Error(`私密回放读取最多指定 ${MAX_TARGETED_FEEDBACK_IDS} 个反馈 ID`);
    }
    const spawnSyncImpl = deps.spawnSync || defaultSpawnSync;
    const sshTarget = deps.mongoSshTarget
        || process.env.BOARDGAME_FEEDBACK_MONGO_SSH_TARGET
        || DEFAULT_MONGO_SSH_TARGET;
    const mongoCommand = deps.mongoCommand
        || process.env.BOARDGAME_FEEDBACK_MONGO_COMMAND
        || DEFAULT_MONGO_COMMAND;
    const result = spawnSyncImpl('ssh', [
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=8',
        '-o', 'ServerAliveInterval=5',
        '-o', 'ServerAliveCountMax=2',
        sshTarget,
        mongoCommand,
    ], {
        input: buildPrivateReplayMongoReadScript(uniqueIds),
        encoding: 'utf8',
        maxBuffer: 128 * 1024 * 1024,
        timeout: 20_000,
    });
    if (result.error || result.status !== 0) {
        throw new Error(`生产 Mongo 私密回放读取失败（ssh 退出码 ${result.status ?? 'unknown'}）`);
    }

    const items = parseMongoReadResult(result.stdout);
    const found = new Map();
    for (const item of items) {
        if (!item || !OBJECT_ID_RE.test(String(item.id || ''))) continue;
        found.set(String(item.id), {
            privateReplay: typeof item.privateReplay === 'string' ? item.privateReplay : null,
            privateReplayError: typeof item.privateReplayError === 'string' ? item.privateReplayError : null,
        });
    }
    return found;
}
