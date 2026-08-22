import type { PipelineResult } from './pipeline';
import { buildRefereeDecisionSnapshot, type RefereeMessageType } from './RefereeView';
import type {
    Command,
    EventCommitEvidence,
    GameEvent,
    MatchState,
    PlayerId,
    RefereeTraceEntry,
} from './types';

export interface RefereeReplayEventSummary {
    index: number;
    type: string;
    timestamp?: number;
    sourceCommandType?: string;
}

export interface RefereeReplayEvidenceSummary {
    traceEntryId?: number;
    timingPointId: string;
    position: string;
    factKind: string;
    originalEventType: string;
    originalEventTimestamp?: number;
    commandType?: string;
    parentFrameId?: string;
    opportunityIds: string[];
    opportunityTimingPointIds: string[];
    appliedOpportunityIds: string[];
    diagnostics?: Array<{
        severity: 'error' | 'warning';
        code: string;
        message: string;
    }>;
}

export interface RefereeReplayInteractionSummary {
    visible: boolean;
    id?: string;
    kind?: string;
    playerId?: PlayerId;
    sourceId?: string;
    resolutionFrameId?: string;
    blockedByPlayerId?: PlayerId;
    optionSummary?: {
        total: number;
        enabledOptionIds: string[];
        disabledOptionIds: string[];
    };
    choiceRequest?: {
        requestId?: string;
        choiceKind?: string;
        aiDiagnosticStatus?: string;
    };
}

export interface RefereeReplayResponseWindowSummary {
    id: string;
    windowType: string;
    sourceId?: string;
    responderQueue: PlayerId[];
    currentResponderId?: PlayerId;
    currentResponderIndex: number;
    passedPlayers: PlayerId[];
    pendingInteractionId?: string;
    requiredInteractionId?: string;
    resolutionFrameId?: string;
    isCurrentResponder?: boolean;
}

export interface RefereeReplayFrameSummary {
    id: string;
    kind: string;
    status: string;
    ordering: string;
    parentFrameId?: string;
    blockedBy?: {
        type: string;
        id?: string;
        reason?: string;
    };
    phase?: string;
    deferredEventTypes: string[];
    deferredActionCount: number;
}

export interface RefereeReplayDecisionSummary {
    decisionEpoch: number;
    playerId?: PlayerId;
    messageTypes: RefereeMessageType[];
    interaction?: RefereeReplayInteractionSummary;
    responseWindow?: RefereeReplayResponseWindowSummary;
    activeFrame?: RefereeReplayFrameSummary;
    frameCount: number;
}

export interface RefereeReplayDigest {
    kind: 'referee-replay-digest';
    commandType?: string;
    eventTypes: string[];
    events: RefereeReplayEventSummary[];
    eventCommitEvidence: RefereeReplayEvidenceSummary[];
    traceEntries: RefereeReplayEvidenceSummary[];
    decision?: RefereeReplayDecisionSummary;
    randomCursor?: number;
}

export interface BuildRefereeReplayDigestOptions<TCore = unknown> {
    state?: MatchState<TCore>;
    command?: Command;
    events?: GameEvent[];
    eventCommitEvidence?: EventCommitEvidence[];
    playerId?: PlayerId;
    traceLimit?: number;
    randomCursor?: number;
    includeDecision?: boolean;
}

export interface BuildRefereeReplayDigestFromPipelineResultOptions<TCore = unknown> {
    command?: Command;
    playerId?: PlayerId;
    traceLimit?: number;
    randomCursor?: number;
    includeDecision?: boolean;
    state?: MatchState<TCore>;
}

function joinStrings(values: Array<string | number | boolean | undefined>): string {
    return values.map((value) => value === undefined ? '' : String(value)).join(':');
}

function summarizeEvidenceFingerprint(evidence: RefereeReplayEvidenceSummary): string {
    return joinStrings([
        evidence.traceEntryId,
        evidence.timingPointId,
        evidence.position,
        evidence.factKind,
        evidence.originalEventType,
        evidence.commandType,
        evidence.parentFrameId,
        evidence.opportunityIds.join(','),
        evidence.opportunityTimingPointIds.join(','),
        evidence.appliedOpportunityIds.join(','),
    ]);
}

function summarizeEvent(event: GameEvent, index: number): RefereeReplayEventSummary {
    return {
        index,
        type: event.type,
        timestamp: event.timestamp,
        sourceCommandType: event.sourceCommandType,
    };
}

function summarizeEvidence(
    evidence: EventCommitEvidence,
    traceEntryId?: number,
): RefereeReplayEvidenceSummary {
    return {
        traceEntryId,
        timingPointId: evidence.timingPointId,
        position: evidence.position,
        factKind: evidence.factKind,
        originalEventType: evidence.originalEventType,
        originalEventTimestamp: evidence.originalEventTimestamp,
        commandType: evidence.commandType,
        parentFrameId: evidence.parentFrameId,
        opportunityIds: [...evidence.opportunityIds],
        opportunityTimingPointIds: [...evidence.opportunityTimingPointIds],
        appliedOpportunityIds: [...evidence.appliedOpportunityIds],
        diagnostics: evidence.diagnostics?.map((diagnostic) => ({ ...diagnostic })),
    };
}

function summarizeTraceEntries(
    entries: RefereeTraceEntry[],
    traceLimit: number,
): RefereeReplayEvidenceSummary[] {
    if (entries.length === 0 || traceLimit <= 0) return [];
    const start = Math.max(0, entries.length - traceLimit);
    return entries
        .slice(start)
        .map((entry) => summarizeEvidence(entry.evidence, entry.id));
}

function summarizeInteraction(
    interaction: ReturnType<typeof buildRefereeDecisionSnapshot>['interaction'],
): RefereeReplayInteractionSummary | undefined {
    if (!interaction) return undefined;
    if (!interaction.visible) {
        return {
            visible: false,
            blockedByPlayerId: interaction.blockedByPlayerId,
        };
    }

    return {
        visible: true,
        id: interaction.id,
        kind: interaction.kind,
        playerId: interaction.playerId,
        sourceId: interaction.sourceId,
        resolutionFrameId: interaction.resolutionFrameId,
        optionSummary: interaction.optionSummary
            ? {
                total: interaction.optionSummary.total,
                enabledOptionIds: [...interaction.optionSummary.enabledOptionIds],
                disabledOptionIds: [...interaction.optionSummary.disabledOptionIds],
            }
            : undefined,
        choiceRequest: interaction.choiceRequest
            ? {
                requestId: interaction.choiceRequest.requestId,
                choiceKind: interaction.choiceRequest.choiceKind,
                aiDiagnosticStatus: interaction.choiceRequest.aiDiagnosticStatus,
            }
            : undefined,
    };
}

function summarizeActiveFrame(
    snapshot: ReturnType<typeof buildRefereeDecisionSnapshot>,
): RefereeReplayFrameSummary | undefined {
    const activeFrameId = snapshot.resolution?.activeFrameId;
    if (!activeFrameId) return undefined;
    const frame = snapshot.resolution?.frames.find((candidate) => candidate.id === activeFrameId);
    if (!frame) return undefined;

    return {
        id: frame.id,
        kind: frame.kind,
        status: frame.status,
        ordering: frame.ordering,
        parentFrameId: frame.parentFrameId,
        blockedBy: frame.blockedBy ? { ...frame.blockedBy } : undefined,
        phase: frame.phase,
        deferredEventTypes: [...frame.deferredEventTypes],
        deferredActionCount: frame.deferredActionCount,
    };
}

function summarizeDecision<TCore>(
    state: MatchState<TCore>,
    playerId?: PlayerId,
): RefereeReplayDecisionSummary {
    const snapshot = buildRefereeDecisionSnapshot(state, { playerId, traceLimit: 0 });
    return {
        decisionEpoch: snapshot.decisionEpoch,
        playerId: snapshot.playerId,
        messageTypes: snapshot.messages.map((message) => message.type),
        interaction: summarizeInteraction(snapshot.interaction),
        responseWindow: snapshot.responseWindow
            ? {
                ...snapshot.responseWindow,
                responderQueue: [...snapshot.responseWindow.responderQueue],
                passedPlayers: [...snapshot.responseWindow.passedPlayers],
            }
            : undefined,
        activeFrame: summarizeActiveFrame(snapshot),
        frameCount: snapshot.resolution?.frames.length ?? 0,
    };
}

export function buildRefereeReplayDigest<TCore = unknown>(
    options: BuildRefereeReplayDigestOptions<TCore>,
): RefereeReplayDigest {
    const traceLimit = options.traceLimit ?? 5;
    const events = options.events ?? [];
    const evidence = options.eventCommitEvidence ?? [];
    const traceEntries = options.state?.sys.refereeTrace?.entries ?? [];
    const includeDecision = options.includeDecision ?? Boolean(options.state);

    return {
        kind: 'referee-replay-digest',
        commandType: options.command?.type,
        eventTypes: events.map((event) => event.type),
        events: events.map(summarizeEvent),
        eventCommitEvidence: evidence.map((entry) => summarizeEvidence(entry)),
        traceEntries: summarizeTraceEntries(traceEntries, traceLimit),
        decision: includeDecision && options.state
            ? summarizeDecision(options.state, options.playerId)
            : undefined,
        randomCursor: options.randomCursor,
    };
}

export function buildRefereeReplayDigestFromPipelineResult<TCore = unknown>(
    result: PipelineResult<TCore>,
    options: BuildRefereeReplayDigestFromPipelineResultOptions<TCore> = {},
): RefereeReplayDigest {
    return buildRefereeReplayDigest({
        state: options.state ?? result.state,
        command: options.command,
        events: result.events,
        eventCommitEvidence: result.eventCommitEvidence,
        playerId: options.playerId,
        traceLimit: options.traceLimit,
        randomCursor: options.randomCursor,
        includeDecision: options.includeDecision,
    });
}

export function buildRefereeReplayDigestFromState<TCore = unknown>(
    state: MatchState<TCore>,
    options: Omit<BuildRefereeReplayDigestOptions<TCore>, 'state'> = {},
): RefereeReplayDigest {
    return buildRefereeReplayDigest({
        ...options,
        state,
    });
}

export function isRefereeReplayDigestEmpty(digest: RefereeReplayDigest): boolean {
    const decisionHasOnlyIdleMessage = !digest.decision
        || (
            digest.decision.messageTypes.length === 1
            && digest.decision.messageTypes[0] === 'referee:idle'
            && !digest.decision.interaction
            && !digest.decision.responseWindow
            && !digest.decision.activeFrame
            && digest.decision.frameCount === 0
        );

    return digest.events.length === 0
        && digest.eventCommitEvidence.length === 0
        && digest.traceEntries.length === 0
        && decisionHasOnlyIdleMessage
        && digest.randomCursor === undefined;
}

export function buildRefereeReplayFingerprintParts(digest: RefereeReplayDigest): string[] {
    const parts: string[] = [];

    if (digest.decision) {
        const decision = digest.decision;
        const decisionOnlyIdle = decision.messageTypes.length === 1
            && decision.messageTypes[0] === 'referee:idle'
            && !decision.interaction
            && !decision.responseWindow
            && !decision.activeFrame
            && decision.frameCount === 0;

        if (!decisionOnlyIdle) {
            parts.push(joinStrings([
                'decision',
                decision.decisionEpoch,
                decision.playerId,
                decision.messageTypes.join(','),
                decision.frameCount,
            ]));
        }

        if (decision.interaction) {
            const interaction = decision.interaction;
            if (interaction.visible) {
                parts.push(joinStrings([
                    'interaction',
                    interaction.id,
                    interaction.kind,
                    interaction.playerId,
                    interaction.sourceId,
                    interaction.resolutionFrameId,
                    interaction.optionSummary?.total,
                    interaction.optionSummary?.enabledOptionIds.join(','),
                    interaction.optionSummary?.disabledOptionIds.join(','),
                    interaction.choiceRequest?.requestId,
                    interaction.choiceRequest?.choiceKind,
                    interaction.choiceRequest?.aiDiagnosticStatus,
                ]));
            } else {
                parts.push(joinStrings([
                    'blocked-interaction',
                    interaction.blockedByPlayerId,
                ]));
            }
        }

        if (decision.responseWindow) {
            const responseWindow = decision.responseWindow;
            parts.push(joinStrings([
                'response-window',
                responseWindow.id,
                responseWindow.windowType,
                responseWindow.sourceId,
                responseWindow.currentResponderId,
                responseWindow.currentResponderIndex,
                responseWindow.responderQueue.join(','),
                responseWindow.passedPlayers.join(','),
                responseWindow.pendingInteractionId,
                responseWindow.requiredInteractionId,
                responseWindow.resolutionFrameId,
                responseWindow.isCurrentResponder,
            ]));
        }

        if (decision.activeFrame) {
            const frame = decision.activeFrame;
            parts.push(joinStrings([
                'active-frame',
                frame.id,
                frame.kind,
                frame.status,
                frame.ordering,
                frame.parentFrameId,
                frame.blockedBy?.type,
                frame.blockedBy?.id,
                frame.blockedBy?.reason,
                frame.phase,
                frame.deferredEventTypes.join(','),
                frame.deferredActionCount,
            ]));
        }
    }

    if (digest.eventCommitEvidence.length > 0) {
        parts.push(`event-commit:${digest.eventCommitEvidence.map(summarizeEvidenceFingerprint).join(';')}`);
    }

    if (digest.traceEntries.length > 0) {
        parts.push(`trace:${digest.traceEntries.map(summarizeEvidenceFingerprint).join(';')}`);
    }

    if (digest.randomCursor !== undefined) {
        parts.push(`random:${digest.randomCursor}`);
    }

    return parts;
}
