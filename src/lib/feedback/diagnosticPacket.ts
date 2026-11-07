import type { MatchState } from '../../engine/types';
import type {
    FeedbackClientContext,
    FeedbackCommandSummary,
    FeedbackDiagnosticPacket,
    FeedbackReplayability,
} from './feedbackPayload';
import { projectFeedbackDiagnosticMetadata } from './diagnosticPacketProjectionPolicy.mjs';

export type FeedbackDiagnosticConsumptionResult = {
    consumed: boolean;
    reasons: string[];
    observed: {
        matchId?: string;
        roomId?: string;
        requestId?: string;
        stateId?: number;
        stateRevision?: number;
        decisionEpoch?: number;
        phase?: string;
        interactionId?: string;
        responseWindowId?: string;
    };
};

/**
 * 导入现场包后，直接用运行时状态证明注入内容已被消费。
 * 这是 E2E / 回放工具的断言入口，不把夹具输入当作运行事实。
 */
export function assertFeedbackDiagnosticPacketConsumed(args: {
    packet: FeedbackDiagnosticPacket;
    runtimeState: MatchState<unknown>;
    runtimeStateId?: number;
}): FeedbackDiagnosticConsumptionResult {
    const state = args.runtimeState;
    const sys = state.sys;
    const interactionId = typeof sys.interaction?.current?.id === 'string'
        ? sys.interaction.current.id
        : undefined;
    const responseWindowId = typeof sys.responseWindow?.current?.id === 'string'
        ? sys.responseWindow.current.id
        : undefined;
    const requestId = interactionId ?? responseWindowId;
    const runtimeRoomId = (sys as unknown as { roomId?: unknown }).roomId;
    const observed = {
        ...(typeof sys.matchId === 'string' ? { matchId: sys.matchId } : {}),
        ...(typeof runtimeRoomId === 'string' && runtimeRoomId.trim().length > 0
            ? { roomId: runtimeRoomId.trim() }
            : {}),
        ...(requestId ? { requestId } : {}),
        ...(args.runtimeStateId !== undefined ? { stateId: args.runtimeStateId } : {}),
        ...(typeof sys.revision === 'number' ? { stateRevision: sys.revision } : {}),
        ...(typeof sys.decisionEpoch === 'number' ? { decisionEpoch: sys.decisionEpoch } : {}),
        ...(typeof sys.phase === 'string' ? { phase: sys.phase } : {}),
        ...(interactionId ? { interactionId } : {}),
        ...(responseWindowId ? { responseWindowId } : {}),
    };
    const reasons: string[] = [];
    const correlation = args.packet.correlation;

    if (correlation.matchId && observed.matchId !== correlation.matchId) {
        reasons.push('correlation.matchId 未被运行时消费');
    }
    if (correlation.roomId && observed.roomId !== correlation.roomId) {
        reasons.push('correlation.roomId 未被运行时消费');
    }
    if (correlation.requestId && observed.requestId !== correlation.requestId) {
        reasons.push('correlation.requestId 未被运行时消费');
    }
    if (correlation.stateId !== undefined && observed.stateId !== correlation.stateId) {
        reasons.push('correlation.stateId 未被运行时消费');
    }
    if (correlation.stateRevision !== undefined && observed.stateRevision !== correlation.stateRevision) {
        reasons.push('correlation.stateRevision 未被运行时消费');
    }
    if (correlation.decisionEpoch !== undefined && observed.decisionEpoch !== correlation.decisionEpoch) {
        reasons.push('correlation.decisionEpoch 未被运行时消费');
    }
    if (args.packet.phase && observed.phase !== args.packet.phase) {
        reasons.push('phase 未被运行时消费');
    }
    if (args.packet.interaction && typeof args.packet.interaction === 'object') {
        const packetInteractionId = (args.packet.interaction as { id?: unknown }).id;
        if (typeof packetInteractionId === 'string' && observed.interactionId !== packetInteractionId) {
            reasons.push('interaction 未被运行时消费');
        }
    }
    if (args.packet.responseWindow && typeof args.packet.responseWindow === 'object') {
        const packetResponseWindowId = (args.packet.responseWindow as { id?: unknown }).id;
        if (typeof packetResponseWindowId === 'string' && observed.responseWindowId !== packetResponseWindowId) {
            reasons.push('responseWindow 未被运行时消费');
        }
    }

    return {
        consumed: reasons.length === 0,
        reasons,
        observed,
    };
}

const sanitizeCommandSummary = (value: unknown): FeedbackCommandSummary | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    const text = (candidate: unknown): string | undefined => (
        typeof candidate === 'string' && candidate.length > 0 ? candidate.slice(0, 128) : undefined
    );
    const number = (candidate: unknown): number | undefined => (
        typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined
    );
    const playerId = record.playerId === null ? null : text(record.playerId);
    const summary: FeedbackCommandSummary = {
        ...(text(record.commandId) ? { commandId: text(record.commandId) } : {}),
        ...(text(record.commandType) ? { commandType: text(record.commandType) } : {}),
        ...(playerId !== undefined ? { playerId } : {}),
        ...(number(record.issuedAt) !== undefined ? { issuedAt: number(record.issuedAt) } : {}),
        ...(number(record.stateId) !== undefined ? { stateId: number(record.stateId) } : {}),
        ...(number(record.randomCursor) !== undefined ? { randomCursor: number(record.randomCursor) } : {}),
        ...(number(record.afterStateId) !== undefined ? { afterStateId: number(record.afterStateId) } : {}),
        ...(number(record.afterRandomCursor) !== undefined ? { afterRandomCursor: number(record.afterRandomCursor) } : {}),
    };
    return Object.keys(summary).length > 0 ? summary : undefined;
};

const createId = (prefix: string): string => {
    const randomUuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return prefix + '-' + randomUuid;
};

const getStateRecord = (state: MatchState<unknown> | undefined): Record<string, unknown> => (
    state && typeof state === 'object' ? state as unknown as Record<string, unknown> : {}
);

const getStateId = (state: MatchState<unknown> | undefined): number | undefined => {
    const sys = getStateRecord(state).sys as Record<string, unknown> | undefined;
    const stateId = sys?.stateId;
    return typeof stateId === 'number' ? stateId : undefined;
};

const getStateRevision = (state: MatchState<unknown> | undefined): number | undefined => {
    const sys = getStateRecord(state).sys as Record<string, unknown> | undefined;
    const revision = sys?.revision;
    return typeof revision === 'number' ? revision : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
);

const safeText = (value: unknown): string | undefined => (
    typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 128) : undefined
);

const SAFE_FEEDBACK_REASON_CODES = new Set([
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

export function projectFeedbackReasonCode(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    if (!normalized) return undefined;
    if (SAFE_FEEDBACK_REASON_CODES.has(normalized)) return normalized;
    const prefix = normalized.split(/[:|]/, 1)[0];
    return SAFE_FEEDBACK_REASON_CODES.has(prefix) ? prefix : undefined;
}

const safeNumber = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const summarizeCollectionErrors = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.flatMap((entry) => {
        const code = safeText(entry);
        if (!code) return [];
        if (code === 'private_replay_prepare_failed' || code === 'private_replay_not_captured') return [code];
        if (code.startsWith('private_replay_capture_failed')) return ['private_replay_capture_failed'];
        if (code.startsWith('private_replay_missing:')) return ['private_replay_missing_fields'];
        return [];
    })));
};

const safePlayerId = (value: unknown): string | number | undefined => (
    typeof value === 'string' ? safeText(value) : safeNumber(value)
);

export function summarizeFeedbackInteraction(value: unknown): Record<string, unknown> | undefined {
    const interaction = asRecord(value);
    if (Object.keys(interaction).length === 0) return undefined;
    const data = asRecord(interaction.data);
    const options = Array.isArray(data.options)
        ? data.options
        : Array.isArray(interaction.options) ? interaction.options : undefined;
    const disabledOptionCount = options?.filter((option) => asRecord(option).disabled === true).length;
    const summaryOptionCount = safeNumber(interaction.optionCount);
    const summaryDisabledOptionCount = safeNumber(interaction.disabledOptionCount);
    return {
        ...(safeText(interaction.id) ? { id: safeText(interaction.id) } : {}),
        ...(safeText(interaction.kind) ? { kind: safeText(interaction.kind) } : {}),
        ...(safePlayerId(interaction.playerId) !== undefined ? { playerId: safePlayerId(interaction.playerId) } : {}),
        ...(safeText(interaction.resolutionFrameId) ? { resolutionFrameId: safeText(interaction.resolutionFrameId) } : {}),
        ...(interaction.cancelPolicy === 'forbidden' ? { cancelPolicy: 'forbidden' } : {}),
        ...(options ? { optionCount: options.length, disabledOptionCount } : summaryOptionCount !== undefined
            ? {
                optionCount: summaryOptionCount,
                ...(summaryDisabledOptionCount !== undefined ? { disabledOptionCount: summaryDisabledOptionCount } : {}),
            }
            : {}),
    };
}

export function summarizeFeedbackResponseWindow(value: unknown): Record<string, unknown> | undefined {
    const window = asRecord(value);
    if (Object.keys(window).length === 0) return undefined;
    const responders = Array.isArray(window.responderQueue) ? window.responderQueue : undefined;
    const passed = Array.isArray(window.passedPlayers) ? window.passedPlayers : undefined;
    return {
        ...(safeText(window.id) ? { id: safeText(window.id) } : {}),
        ...(safeText(window.windowType) ? { windowType: safeText(window.windowType) } : {}),
        ...(responders ? { responderCount: responders.length }
            : safeNumber(window.responderCount) !== undefined ? { responderCount: safeNumber(window.responderCount) } : {}),
        ...(passed ? { passedCount: passed.length }
            : safeNumber(window.passedCount) !== undefined ? { passedCount: safeNumber(window.passedCount) } : {}),
        ...(safeNumber(window.currentResponderIndex) !== undefined ? { currentResponderIndex: safeNumber(window.currentResponderIndex) } : {}),
        ...(typeof window.pendingInteractionId === 'string' ? { hasPendingInteraction: true } : {}),
        ...(typeof window.requiredInteractionId === 'string' ? { hasRequiredInteraction: true } : {}),
        ...(typeof window.actionTakenThisRound === 'boolean' ? { actionTakenThisRound: window.actionTakenThisRound } : {}),
        ...(safeNumber(window.consecutivePassRounds) !== undefined ? { consecutivePassRounds: safeNumber(window.consecutivePassRounds) } : {}),
    };
}

export function summarizeFeedbackActionLogEntry(value: unknown): Record<string, unknown> | undefined {
    const entry = asRecord(value);
    if (Object.keys(entry).length === 0) return undefined;
    const segments = Array.isArray(entry.segments) ? entry.segments : undefined;
    return {
        ...(safeNumber(entry.timestamp) !== undefined ? { timestamp: safeNumber(entry.timestamp) } : {}),
        ...(safePlayerId(entry.actorId) !== undefined ? { actorId: safePlayerId(entry.actorId) } : {}),
        ...(safeText(entry.kind) ? { kind: safeText(entry.kind) } : {}),
        ...(safeText(asRecord(entry.event).type) ?? safeText(entry.eventType)
            ? { eventType: safeText(asRecord(entry.event).type) ?? safeText(entry.eventType) }
            : {}),
        ...(segments ? { segmentCount: segments.length }
            : safeNumber(entry.segmentCount) !== undefined ? { segmentCount: safeNumber(entry.segmentCount) } : {}),
    };
}

export function summarizeFeedbackEventStreamEntry(value: unknown): Record<string, unknown> | undefined {
    const entry = asRecord(value);
    const event = asRecord(entry.event);
    if (Object.keys(event).length === 0) return undefined;
    return {
        ...(safeNumber(entry.id) !== undefined ? { id: safeNumber(entry.id) } : {}),
        event: {
            ...(safeText(event.type) ? { type: safeText(event.type) } : {}),
            ...(safeNumber(event.timestamp) !== undefined ? { timestamp: safeNumber(event.timestamp) } : {}),
            ...(safeText(event.sourceCommandType) ? { sourceCommandType: safeText(event.sourceCommandType) } : {}),
        },
    };
}

const summarizeMatchState = (value: unknown): Record<string, unknown> | undefined => {
    const state = asRecord(value);
    const sys = asRecord(state.sys);
    if (Object.keys(sys).length === 0) return undefined;
    const interactionState = asRecord(sys.interaction);
    const queuedInteractions = Array.isArray(interactionState.queue) ? interactionState.queue : undefined;
    const responseState = asRecord(sys.responseWindow);
    const actionLogState = asRecord(sys.actionLog);
    const eventStreamState = asRecord(sys.eventStream);
    const undoState = asRecord(sys.undo);
    const actionEntries = Array.isArray(actionLogState.entries) ? actionLogState.entries : undefined;
    const eventEntries = Array.isArray(eventStreamState.entries) ? eventStreamState.entries : undefined;
    const snapshotCount = safeNumber(undoState.snapshotCount)
        ?? (Array.isArray(undoState.snapshots) ? undoState.snapshots.length : undefined);
    const core = asRecord(state.core);
    const pendingDamage = asRecord(core.pendingDamageAllocation);
    const coreSummary = {
        ...(typeof core.currentPlayer === 'string' ? { currentPlayer: safeText(core.currentPlayer) } : {}),
        ...(Object.keys(pendingDamage).length > 0 ? { pendingDamageAllocation: {
            ...(safePlayerId(pendingDamage.playerId) !== undefined ? { playerId: safePlayerId(pendingDamage.playerId) } : {}),
            ...(safeNumber(pendingDamage.amount) !== undefined ? { amount: safeNumber(pendingDamage.amount) } : {}),
            ...(safeText(pendingDamage.damageKind) ? { damageKind: safeText(pendingDamage.damageKind) } : {}),
        } } : {}),
    };
    return {
        ...(Object.keys(coreSummary).length > 0 ? { core: coreSummary } : {}),
        sys: {
            ...(safeNumber(sys.schemaVersion) !== undefined ? { schemaVersion: safeNumber(sys.schemaVersion) } : {}),
            ...(safeText(sys.phase) ? { phase: safeText(sys.phase) } : {}),
            ...(safeNumber(sys.turnNumber) !== undefined ? { turnNumber: safeNumber(sys.turnNumber) } : {}),
            ...(safeNumber(sys.revision) !== undefined ? { revision: safeNumber(sys.revision) } : {}),
            ...(safeNumber(sys.decisionEpoch) !== undefined ? { decisionEpoch: safeNumber(sys.decisionEpoch) } : {}),
            interaction: {
                ...(summarizeFeedbackInteraction(interactionState.current)
                    ? { current: summarizeFeedbackInteraction(interactionState.current) }
                    : {}),
                ...(queuedInteractions ? { queuedCount: queuedInteractions.length } : {}),
            },
            responseWindow: summarizeFeedbackResponseWindow(responseState.current)
                ? { current: summarizeFeedbackResponseWindow(responseState.current) }
                : {},
            actionLog: {
                ...(actionEntries ? {
                    entries: actionEntries.slice(-12)
                        .map(summarizeFeedbackActionLogEntry)
                        .filter((entry): entry is Record<string, unknown> => Boolean(entry)),
                } : {}),
            },
            eventStream: {
                ...(safeNumber(eventStreamState.nextId) !== undefined ? { nextId: safeNumber(eventStreamState.nextId) } : {}),
                ...(eventEntries ? {
                    entries: eventEntries.slice(-12)
                        .map(summarizeFeedbackEventStreamEntry)
                        .filter((entry): entry is Record<string, unknown> => Boolean(entry)),
                } : {}),
            },
            undo: snapshotCount !== undefined ? { snapshotCount } : {},
        },
    };
};

const SAFE_SELECTABILITY_STATES = new Set([
    'options-not-projected',
    'no-options',
    'all-options-disabled',
    'recoverable-option-available',
    'manual-selection-required',
]);

const SAFE_UNSATISFIABLE_REASONS = new Set([
    'empty-options',
    'all-options-disabled',
    'min-selection-unreachable',
]);

const summarizeCount = (value: unknown): number | undefined => {
    if (Array.isArray(value)) return Math.min(value.length, 64);
    const count = safeNumber(value);
    return count !== undefined && count >= 0 ? Math.min(Math.floor(count), 64) : undefined;
};

const summarizeSelectability = (value: unknown): Record<string, unknown> | undefined => {
    const diagnostic = asRecord(value);
    if (Object.keys(diagnostic).length === 0) return undefined;
    const selectionState = safeText(diagnostic.selectionState);
    return {
        ...Object.fromEntries(['totalOptions', 'enabledOptions', 'disabledOptions', 'minSelectionCount']
            .flatMap((key) => safeNumber(diagnostic[key]) !== undefined ? [[key, safeNumber(diagnostic[key])]] : [])),
        ...(selectionState && SAFE_SELECTABILITY_STATES.has(selectionState) ? { selectionState } : {}),
    };
};

const summarizeOnlineAiInteraction = (value: unknown): Record<string, unknown> | undefined => {
    const interaction = asRecord(value);
    if (Object.keys(interaction).length === 0) return undefined;
    const summary: Record<string, unknown> = {};
    if (typeof interaction.isBlocked === 'boolean') summary.isBlocked = interaction.isBlocked;
    for (const key of ['shared', 'seat'] as const) {
        const projected = summarizeFeedbackInteraction(interaction[key]);
        if (projected) summary[key] = projected;
    }
    for (const key of ['sharedSelectability', 'seatSelectability'] as const) {
        const projected = summarizeSelectability(interaction[key]);
        if (projected && Object.keys(projected).length > 0) summary[key] = projected;
    }
    for (const key of ['sharedUnsatisfiableReason', 'seatUnsatisfiableReason'] as const) {
        const reason = safeText(interaction[key]);
        if (reason && SAFE_UNSATISFIABLE_REASONS.has(reason)) summary[key] = reason;
    }
    return Object.keys(summary).length > 0 ? summary : undefined;
};

const summarizeGameStateSummary = (value: unknown): Record<string, unknown> | undefined => {
    const summary = asRecord(value);
    if (Object.keys(summary).length === 0) return undefined;
    const factionSelection = asRecord(summary.factionSelection);
    const scenarioVote = asRecord(summary.scenarioVote);
    const pendingCharacterChoices = Array.isArray(summary.pendingScenarioCharacterChoices)
        ? summary.pendingScenarioCharacterChoices
        : undefined;
    const pendingArmamentChoices = Array.isArray(summary.pendingScenarioArmamentChoices)
        ? summary.pendingScenarioArmamentChoices
        : undefined;
    const result: Record<string, unknown> = {};
    if (safeText(summary.turnPhase)) result.turnPhase = safeText(summary.turnPhase);
    if (Object.keys(factionSelection).length > 0) {
        const pendingCount = summarizeCount(factionSelection.pendingPlayerIds ?? factionSelection.pendingCount);
        const selectedCount = summarizeCount(factionSelection.selectedPlayerIds ?? factionSelection.selectedCount);
        result.factionSelection = {
            active: true,
            ...(pendingCount !== undefined ? { pendingCount } : {}),
            ...(selectedCount !== undefined ? { selectedCount } : {}),
        };
    }
    if (Object.keys(scenarioVote).length > 0) {
        const pendingCount = summarizeCount(scenarioVote.pendingPlayerIds ?? scenarioVote.pendingCount);
        result.scenarioVote = {
            active: true,
            ...(pendingCount !== undefined ? { pendingCount } : {}),
        };
    }
    if (pendingCharacterChoices) {
        result.pendingScenarioCharacterChoiceCount = pendingCharacterChoices.length;
        result.pendingScenarioCharacterOptionCount = pendingCharacterChoices.reduce((total, item) => (
            total + (safeNumber(asRecord(item).optionCount) ?? 0)
        ), 0);
    } else {
        const count = safeNumber(summary.pendingScenarioCharacterChoiceCount);
        const optionCount = safeNumber(summary.pendingScenarioCharacterOptionCount);
        if (count !== undefined) result.pendingScenarioCharacterChoiceCount = count;
        if (optionCount !== undefined) result.pendingScenarioCharacterOptionCount = optionCount;
    }
    if (pendingArmamentChoices) {
        result.pendingScenarioArmamentChoiceCount = pendingArmamentChoices.length;
        result.pendingScenarioArmamentOptionCount = pendingArmamentChoices.reduce((total, item) => (
            total + (safeNumber(asRecord(item).optionCount) ?? 0)
        ), 0);
    } else {
        const count = safeNumber(summary.pendingScenarioArmamentChoiceCount);
        const optionCount = safeNumber(summary.pendingScenarioArmamentOptionCount);
        if (count !== undefined) result.pendingScenarioArmamentChoiceCount = count;
        if (optionCount !== undefined) result.pendingScenarioArmamentOptionCount = optionCount;
    }
    return Object.keys(result).length > 0 ? result : undefined;
};

const summarizeSnapshotInteraction = (value: unknown): Record<string, unknown> | undefined => {
    const interaction = asRecord(value);
    if (Object.keys(interaction).length === 0) return undefined;
    const onlineAi = summarizeOnlineAiInteraction(interaction);
    if (onlineAi) return onlineAi;
    return summarizeFeedbackInteraction(interaction);
};

/** Full match data is kept in the admin-only private replay; packet summaries expose identifiers and counts only. */
export function projectFeedbackSnapshot(value: unknown): Record<string, unknown> | undefined {
    const stateSummary = summarizeMatchState(value);
    if (stateSummary) return stateSummary;

    const source = asRecord(value);
    if (Object.keys(source).length === 0) return undefined;
    const fields = [
        'kind', 'feedbackSource', 'gameId', 'matchId', 'playerId', 'phase', 'turnNumber',
        'stateId', 'stateID', 'stateRevision', 'decisionEpoch', 'requestId', 'commandType',
        'incidentKind', 'responseWindowType', 'interactionId', 'interactionKind', 'turnPhase',
    ] as const;
    const summary: Record<string, unknown> = {};
    for (const key of fields) {
        const value = source[key];
        const projected = key === 'turnNumber' || key === 'stateId' || key === 'stateID'
            || key === 'stateRevision' || key === 'decisionEpoch'
            ? safeNumber(value)
            : key === 'playerId' ? safePlayerId(value) : safeText(value);
        if (projected !== undefined) summary[key] = projected;
    }
    const averageCpu = safeNumber(source.averageCpu);
    if (averageCpu !== undefined) summary.averageCpu = averageCpu;
    const reason = projectFeedbackReasonCode(source.reason);
    if (reason) summary.reason = reason;
    if (source.hasBlockerFingerprint === true
        || (typeof source.blockerFingerprint === 'string' && source.blockerFingerprint.length > 0)) {
        summary.hasBlockerFingerprint = true;
    }
    if (source.hasProgressMarker === true
        || (typeof source.progressMarker === 'string' && source.progressMarker.length > 0)) {
        summary.hasProgressMarker = true;
    }
    const currentPlayerId = safePlayerId(source.currentPlayerId);
    if (currentPlayerId !== undefined) summary.currentPlayerId = currentPlayerId;
    const interaction = summarizeSnapshotInteraction(source.interaction);
    if (interaction) summary.interaction = interaction;
    const responseWindow = summarizeFeedbackResponseWindow(source.responseWindow);
    if (responseWindow) summary.responseWindow = responseWindow;
    const legalActions = summarizeLegalActions(source.legalActions);
    if (legalActions) summary.legalActions = legalActions;
    const aiDecisionPreview = summarizeAiDecisionPreview(source.aiDecisionPreview);
    if (aiDecisionPreview) summary.aiDecisionPreview = aiDecisionPreview;
    const gameStateSummary = summarizeGameStateSummary(source.gameStateSummary);
    if (gameStateSummary) summary.gameStateSummary = gameStateSummary;
    const nestedSnapshots = asRecord(source.snapshots);
    const projectedSnapshots = Object.fromEntries(
        ['before', 'at', 'after'].flatMap((key) => {
            const projected = projectFeedbackSnapshot(nestedSnapshots[key]);
            return projected ? [[key, projected]] : [];
        }),
    );
    if (Object.keys(projectedSnapshots).length > 0) summary.snapshots = projectedSnapshots;
    const randomCursor = safeNumber(source.randomCursor);
    if (randomCursor !== undefined) summary.randomCursor = randomCursor;
    for (const key of ['recentActionLogTail', 'recentEventStreamTail'] as const) {
        if (Array.isArray(source[key])) summary[key === 'recentActionLogTail' ? 'recentActionLogCount' : 'recentEventStreamCount'] = source[key].length;
    }
    const coreSummary = summarizeMatchState({ sys: { phase: source.phase, turnNumber: source.turnNumber }, core: source.core });
    if (coreSummary && 'core' in coreSummary) summary.core = coreSummary.core;
    return Object.keys(summary).length > 0 ? summary : { present: true, keys: Object.keys(source).length };
}

export function projectFeedbackDiagnosticPacket(value: unknown): Record<string, unknown> | undefined {
    const packet = asRecord(value);
    if (Object.keys(packet).length === 0) return undefined;
    const correlation = asRecord(packet.correlation);
    const build = asRecord(packet.build);
    const snapshots = asRecord(packet.snapshots);
    const actionLogTail = Array.isArray(packet.actionLogTail) ? packet.actionLogTail : undefined;
    const eventStreamTail = Array.isArray(packet.eventStreamTail) ? packet.eventStreamTail : undefined;
    const commandTraceTail = Array.isArray(packet.commandTraceTail) ? packet.commandTraceTail : undefined;
    const collectionErrors = summarizeCollectionErrors(packet.collectionErrors);
    const metadata = projectFeedbackDiagnosticMetadata(packet);
    return {
        ...(safeNumber(packet.schemaVersion) !== undefined ? { schemaVersion: safeNumber(packet.schemaVersion) } : {}),
        ...(safeText(packet.captureId) ? { captureId: safeText(packet.captureId) } : {}),
        ...(safeText(packet.chainId) ? { chainId: safeText(packet.chainId) } : {}),
        ...(safeText(packet.capturedAt) ? { capturedAt: safeText(packet.capturedAt) } : {}),
        ...metadata,
        ...(collectionErrors.length > 0 ? { collectionErrors } : {}),
        correlation: Object.fromEntries(
            ['matchId', 'roomId', 'requestId', 'stateId', 'stateRevision', 'decisionEpoch']
                .flatMap((key) => {
                    const field = correlation[key];
                    const projected = ['stateId', 'stateRevision', 'decisionEpoch'].includes(key)
                        ? safeNumber(field)
                        : safeText(field);
                    return projected !== undefined ? [[key, projected]] : [];
                }),
        ),
        ...(Object.keys(build).length > 0 ? { build: Object.fromEntries(
            ['appVersion', 'appCommitSha', 'appBuildTime', 'appReleaseChannel']
                .flatMap((key) => safeText(build[key]) ? [[key, safeText(build[key])]] : []),
        ) } : {}),
        ...(safeText(packet.phase) ? { phase: safeText(packet.phase) } : {}),
        ...(safeNumber(packet.turnNumber) !== undefined ? { turnNumber: safeNumber(packet.turnNumber) } : {}),
        ...(safePlayerId(packet.currentPlayerId) !== undefined ? { currentPlayerId: safePlayerId(packet.currentPlayerId) } : {}),
        ...(summarizeFeedbackInteraction(packet.interaction) ? { interaction: summarizeFeedbackInteraction(packet.interaction) } : {}),
        ...(summarizeFeedbackResponseWindow(packet.responseWindow) ? { responseWindow: summarizeFeedbackResponseWindow(packet.responseWindow) } : {}),
        ...(summarizeLegalActions(packet.legalActions) ? { legalActions: summarizeLegalActions(packet.legalActions) } : {}),
        ...(summarizeAiDecisionPreview(packet.aiDecisionPreview) ? { aiDecisionPreview: summarizeAiDecisionPreview(packet.aiDecisionPreview) } : {}),
        snapshots: Object.fromEntries(
            ['before', 'at', 'after'].flatMap((key) => {
                const projected = projectFeedbackSnapshot(snapshots[key]);
                return projected ? [[key, projected]] : [];
            }),
        ),
        ...(actionLogTail ? { actionLogTail: actionLogTail.slice(-12)
            .map(summarizeFeedbackActionLogEntry).filter(Boolean) } : {}),
        ...(eventStreamTail ? { eventStreamTail: eventStreamTail.slice(-12)
            .map(summarizeFeedbackEventStreamEntry).filter(Boolean) } : {}),
        ...(commandTraceTail ? { commandTraceTail: commandTraceTail.slice(-12)
            .map(sanitizeCommandSummary).filter(Boolean) } : {}),
        ...(sanitizeCommandSummary(packet.lastCommand) ? { lastCommand: sanitizeCommandSummary(packet.lastCommand) } : {}),
        ...(safeNumber(asRecord(packet.undo).snapshotCount) !== undefined
            ? { undo: { snapshotCount: safeNumber(asRecord(packet.undo).snapshotCount) } }
            : {}),
        ...(safeNumber(packet.randomCursor) !== undefined ? { randomCursor: safeNumber(packet.randomCursor) } : {}),
    };
}

const summarizeLegalActions = (value: unknown): Record<string, unknown> | undefined => {
    const summary = asRecord(value);
    const actions = Array.isArray(value) ? value : Array.isArray(summary.items) ? summary.items : undefined;
    if (!actions && safeNumber(summary.count ?? summary.total) === undefined) return undefined;
    const actionTypes = (actions ?? []).flatMap((action) => {
        const record = asRecord(action);
        const direct = safeText(record.type) ?? safeText(record.commandType);
        if (direct) return [direct];
        if (Array.isArray(record.commandTypes)) return record.commandTypes.map(safeText).filter((type): type is string => Boolean(type));
        return [];
    });
    if (Array.isArray(summary.types)) {
        actionTypes.push(...summary.types.map(safeText).filter((type): type is string => Boolean(type)));
    }
    const types = Array.from(new Set(actionTypes)).slice(0, 32);
    return {
        count: safeNumber(summary.count ?? summary.total) ?? actions?.length ?? 0,
        types,
    };
};

const summarizeAiDecisionPreview = (value: unknown): Record<string, unknown> | undefined => {
    const preview = asRecord(value);
    if (Object.keys(preview).length === 0) return undefined;
    const candidates = Array.isArray(preview.candidates) ? preview.candidates : undefined;
    return {
        ...(safeText(preview.commandType) ? { commandType: safeText(preview.commandType) } : {}),
        ...(safeText(preview.actionType) ? { actionType: safeText(preview.actionType) } : {}),
        ...(safeNumber(preview.candidateCount ?? candidates?.length) !== undefined
            ? { candidateCount: safeNumber(preview.candidateCount ?? candidates?.length) }
            : {}),
    };
};

export function projectFeedbackActionLogText(value?: string): string | undefined {
    if (!value?.trim()) return undefined;
    try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) {
            const entries = parsed.slice(-12).map(summarizeFeedbackActionLogEntry).filter(Boolean);
            return entries.length > 0 ? JSON.stringify(entries, null, 2) : undefined;
        }
        const log = asRecord(parsed);
        const actionLogTail = Array.isArray(log.actionLogTail) ? log.actionLogTail : [];
        const eventStreamTail = Array.isArray(log.eventStreamTail) ? log.eventStreamTail : [];
        const undoCapture = asRecord(log.undoCapture);
        const summary = {
            ...(safeText(log.kind) ? { kind: safeText(log.kind) } : {}),
            ...(safeText(log.phase) ? { phase: safeText(log.phase) } : {}),
            ...(safeNumber(log.turnNumber) !== undefined ? { turnNumber: safeNumber(log.turnNumber) } : {}),
            ...(safeNumber(log.visibleActionLogRowCount) !== undefined
                ? { visibleActionLogRowCount: safeNumber(log.visibleActionLogRowCount) }
                : {}),
            actionLogTail: actionLogTail.slice(-12).map(summarizeFeedbackActionLogEntry).filter(Boolean),
            eventStreamTail: eventStreamTail.slice(-12).map(summarizeFeedbackEventStreamEntry).filter(Boolean),
            ...(summarizeFeedbackInteraction(log.interaction) ? { interaction: summarizeFeedbackInteraction(log.interaction) } : {}),
            ...(summarizeFeedbackResponseWindow(log.responseWindow) ? { responseWindow: summarizeFeedbackResponseWindow(log.responseWindow) } : {}),
            ...(safeNumber(undoCapture.availableCount) !== undefined || safeNumber(undoCapture.capturedCount) !== undefined
                ? { undoCapture: {
                    ...(safeNumber(undoCapture.availableCount) !== undefined ? { availableCount: safeNumber(undoCapture.availableCount) } : {}),
                    ...(safeNumber(undoCapture.capturedCount) !== undefined ? { capturedCount: safeNumber(undoCapture.capturedCount) } : {}),
                } }
                : {}),
            ...(log.currentStateSummary ? { currentStateSummary: projectFeedbackSnapshot(log.currentStateSummary) } : {}),
        };
        return Object.keys(summary).length > 0 ? JSON.stringify(summary, null, 2) : undefined;
    } catch {
        return undefined;
    }
}

export function projectFeedbackSnapshotText(value?: string): string | undefined {
    if (!value?.trim()) return undefined;
    try {
        return JSON.stringify(projectFeedbackSnapshot(JSON.parse(value)), null, 2);
    } catch {
        return undefined;
    }
}

const collectMissingFields = (args: {
    state?: MatchState<unknown>;
    clientContext?: FeedbackClientContext;
    requestId?: string;
    roomId?: string;
    stateId?: number;
    stateRevision?: number;
    randomCursor?: number;
    snapshots: FeedbackDiagnosticPacket['snapshots'];
}): string[] => {
    const missing: string[] = [];
    if (!args.clientContext?.matchId) missing.push('correlation.matchId');
    if (!args.roomId) missing.push('correlation.roomId');
    if (!args.requestId) missing.push('correlation.requestId');
    if (args.stateId === undefined) missing.push('correlation.stateId');
    if (args.stateRevision === undefined) missing.push('correlation.stateRevision');
    if (typeof args.state?.sys?.decisionEpoch !== 'number') missing.push('correlation.decisionEpoch');
    if (args.randomCursor === undefined) missing.push('randomCursor');
    if (!args.state) missing.push('snapshots.at');
    else missing.push('snapshots.privateStateRedacted');
    if (!args.snapshots.before) missing.push('snapshots.before');
    if (!args.snapshots.after) missing.push('snapshots.after');
    const undo = args.state?.sys?.undo as { snapshots?: unknown[]; snapshotCount?: number } | undefined;
    if (typeof undo?.snapshotCount === 'number'
        && undo.snapshotCount > (Array.isArray(undo.snapshots) ? undo.snapshots.length : 0)) {
        missing.push('undo.snapshots');
    }
    return missing;
};

const resolveReplayability = (missingFields: string[]): FeedbackReplayability => {
    if (missingFields.length === 0) return 'full';
    if (missingFields.includes('snapshots.at')) return 'unreplayable';
    return 'partial';
};

export function buildFeedbackDiagnosticPacket(args: {
    state?: MatchState<unknown>;
    clientContext?: FeedbackClientContext;
    source: FeedbackDiagnosticPacket['source'];
    chainId?: string;
    roomId?: string;
    requestId?: string;
    stateId?: number;
    stateRevision?: number;
    randomCursor?: number;
    before?: MatchState<unknown>;
    after?: MatchState<unknown>;
    legalActions?: unknown;
    aiDecisionPreview?: unknown;
    commandTraceTail?: unknown[];
    lastCommand?: unknown;
    collectionErrors?: string[];
}): FeedbackDiagnosticPacket {
    const state = args.state;
    const sys = state?.sys;
    const stateId = args.stateId ?? getStateId(state);
    const stateRevision = args.stateRevision ?? getStateRevision(state);
    const snapshots = {
        before: projectFeedbackSnapshot(args.before),
        at: projectFeedbackSnapshot(state),
        after: projectFeedbackSnapshot(args.after),
    };
    const missingFields = collectMissingFields({
        state,
        clientContext: args.clientContext,
        requestId: args.requestId,
        roomId: args.roomId,
        stateId,
        stateRevision,
        randomCursor: args.randomCursor,
        snapshots,
    });
    const collectionStatus = args.collectionErrors?.length || missingFields.length > 0
        ? 'partial'
        : 'complete';
    const replayability = resolveReplayability(missingFields);
    const commandTraceTail = args.commandTraceTail
        ?.slice(-12)
        .map(sanitizeCommandSummary)
        .filter((entry): entry is FeedbackCommandSummary => Boolean(entry));
    const lastCommand = sanitizeCommandSummary(args.lastCommand);
    const undoState = sys?.undo as unknown as { snapshotCount?: unknown; snapshots?: unknown } | undefined;
    const undoSnapshotCount = typeof undoState?.snapshotCount === 'number'
        ? undoState.snapshotCount
        : Array.isArray(undoState?.snapshots) ? undoState.snapshots.length : undefined;

    return {
        schemaVersion: 1,
        captureId: createId('feedback'),
        ...(args.chainId ? { chainId: args.chainId } : {}),
        capturedAt: new Date().toISOString(),
        source: args.source,
        collectionStatus,
        replayability,
        missingFields,
        correlation: {
            matchId: args.clientContext?.matchId,
            ...(args.roomId ? { roomId: args.roomId } : {}),
            ...(args.requestId ? { requestId: args.requestId } : {}),
            ...(stateId !== undefined ? { stateId } : {}),
            ...(stateRevision !== undefined ? { stateRevision } : {}),
            ...(typeof sys?.decisionEpoch === 'number' ? { decisionEpoch: sys.decisionEpoch } : {}),
        },
        build: args.clientContext
            ? {
                appVersion: args.clientContext.appVersion,
                appCommitSha: args.clientContext.appCommitSha,
                appBuildTime: args.clientContext.appBuildTime,
                appReleaseChannel: args.clientContext.appReleaseChannel,
            }
            : undefined,
        phase: sys?.phase,
        turnNumber: sys?.turnNumber,
        currentPlayerId: typeof state?.core === 'object'
            ? typeof (state.core as Record<string, unknown>)?.currentPlayer === 'string'
                ? (state.core as Record<string, unknown>).currentPlayer as string
                : undefined
            : undefined,
        interaction: summarizeFeedbackInteraction(sys?.interaction?.current),
        responseWindow: summarizeFeedbackResponseWindow(sys?.responseWindow?.current),
        legalActions: summarizeLegalActions(args.legalActions),
        aiDecisionPreview: summarizeAiDecisionPreview(args.aiDecisionPreview),
        snapshots,
        actionLogTail: Array.isArray(sys?.actionLog?.entries)
            ? sys.actionLog.entries.slice(-12).map(summarizeFeedbackActionLogEntry).filter(Boolean)
            : undefined,
        eventStreamTail: Array.isArray(sys?.eventStream?.entries)
            ? sys.eventStream.entries.slice(-12).map(summarizeFeedbackEventStreamEntry).filter(Boolean)
            : undefined,
        ...(commandTraceTail?.length ? { commandTraceTail } : {}),
        ...(lastCommand ? { lastCommand } : {}),
        undo: undoState ? { snapshotCount: undoSnapshotCount } : undefined,
        ...(args.randomCursor !== undefined ? { randomCursor: args.randomCursor } : {}),
        ...(args.collectionErrors?.length ? { collectionErrors: args.collectionErrors } : {}),
    };
}

export const serializeFeedbackDiagnosticPacket = (
    packet: FeedbackDiagnosticPacket | undefined,
): string | undefined => {
    if (!packet) return undefined;
    try {
        return JSON.stringify(projectFeedbackDiagnosticPacket(packet), null, 2);
    } catch {
        return undefined;
    }
};
