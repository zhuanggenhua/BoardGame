import { extractAiInteractionSnapshot, extractAiResponseWindowSnapshot } from '../ai/snapshots';
import type { AiInteractionSnapshot, AiResponseWindowSnapshot } from '../ai/types';
import { isEnabledControlChoiceOption } from '../systems/InteractionSystem';
import type { MatchState } from '../types';
import {
    resolveCurrentPlayerId,
    resolveUnsatisfiableReasonFromInteraction,
    type OnlineAiRecoveryEngineConfig,
    type ForceEndTurnStalledAiResolution,
    type HiddenInteractionDescriptor,
} from './onlineAiRecovery';
import { resolveOnlineAiRecoveryFingerprint } from './onlineAiWatchdogSequenceFingerprinting';

const MAX_ONLINE_AI_RECOVERY_LEGAL_ACTIONS = 8;

export type InteractionSelectabilityDiagnostic = {
    totalOptions: number;
    enabledOptions: number;
    disabledOptions: number;
    minSelectionCount: number;
    enabledOptionIds: string[];
    disabledOptionIds: string[];
    recoverableOptionIds: string[];
    selectionState:
        | 'no-options'
        | 'all-options-disabled'
        | 'recoverable-option-available'
        | 'manual-selection-required';
};

export type OnlineAiRecoveryPendingDamageDiagnostic = {
    id: unknown;
    responderId: unknown;
    responseType: unknown;
    currentDamage: unknown;
    sourceAbilityId: unknown;
    tokenUsageTotals: unknown;
};

export type OnlineAiRecoveryActionLogTailEntry = {
    text?: string;
    type?: unknown;
};

export type OnlineAiRecoveryEventTailEntry = {
    type?: string;
    timestamp?: unknown;
    payload?: unknown;
};

export type OnlineAiRecoveryLegalActionSummary = {
    total: number;
    truncated: boolean;
    items: Array<{
        actionId: string;
        kind: string;
        label: string;
        commandTypes: string[];
    }>;
};

export type OnlineAiRecoveryDecisionPreview = {
    previewSource: 'seat-policy' | 'remote-fallback-policy';
    policyId: string;
    chosenAction: {
        actionId: string;
        kind: string;
        label: string;
        commandTypes: string[];
    } | null;
    reasoningSummary: string | null;
    confidence: number | null;
    error: string | null;
};

export type OnlineAiRecoveryAiSummary = {
    seatControllerType: 'human' | 'local-ai' | 'remote-ai';
    legalActions: OnlineAiRecoveryLegalActionSummary | null;
    decisionPreview: OnlineAiRecoveryDecisionPreview | null;
};

type OnlineAiRecoveryLegalActionLike = {
    actionId: string;
    kind: string;
    label: string;
    commands: Array<{ type: string }>;
};

export type OnlineAiFeedbackDiagnosticsContext = {
    sharedInteraction: AiInteractionSnapshot | null;
    seatInteraction: AiInteractionSnapshot | null;
    sharedSelectability: InteractionSelectabilityDiagnostic | null;
    seatSelectability: InteractionSelectabilityDiagnostic | null;
    sharedResponseWindow: AiResponseWindowSnapshot | null;
    seatResponseWindow: AiResponseWindowSnapshot | null;
    pendingDamage: OnlineAiRecoveryPendingDamageDiagnostic | null;
    sharedUnsatisfiableReason: string | null;
    seatUnsatisfiableReason: string | null;
};

type OnlineAiRecoveryFeedbackFailureReason =
    | 'missing_visible_state'
    | 'private_overlay_missing'
    | 'private_overlay_stale'
    | string;

const normalizeOnlineAiDiagnosticSegment = (value: unknown, fallback: string): string => {
    if (typeof value !== 'string') {
        return fallback;
    }
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9:_-]/g, '');
    return normalized || fallback;
};

const cloneOnlineAiDiagnosticValue = (value: unknown): unknown => {
    if (value === undefined) {
        return undefined;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
};

const resolveOnlineAiResponseWindowResponderId = (
    responseWindow: AiResponseWindowSnapshot | null | undefined,
): string | null => {
    if (!responseWindow || !Array.isArray(responseWindow.responderQueue)) {
        return null;
    }
    const index = typeof responseWindow.currentResponderIndex === 'number'
        ? responseWindow.currentResponderIndex
        : 0;
    const responderId = responseWindow.responderQueue[index];
    return typeof responderId === 'string' && responderId.trim().length > 0
        ? responderId
        : null;
};

export function buildInteractionSelectabilityDiagnostic(
    snapshot: AiInteractionSnapshot | null | undefined,
): InteractionSelectabilityDiagnostic | null {
    if (!snapshot) {
        return null;
    }

    const options = Array.isArray(snapshot.options) ? snapshot.options : [];
    const enabledOptions = options.filter((option) => option.disabled !== true);
    const disabledOptions = options.filter((option) => option.disabled === true);
    const multi = snapshot.multi as { min?: unknown } | undefined;
    const minSelectionCount = typeof multi?.min === 'number' ? multi.min : 1;
    const recoverableOptionIds = minSelectionCount === 0
        ? ['__empty_selection__']
        : enabledOptions
            .filter((option) => {
                const displayMode = option.displayMode === 'card' || option.displayMode === 'button'
                    ? option.displayMode
                    : undefined;
                return isEnabledControlChoiceOption({
                    ...option,
                    label: option.label ?? option.id,
                    value: option.value,
                    displayMode,
                });
            })
            .map((option) => option.id);

    const selectionState: InteractionSelectabilityDiagnostic['selectionState'] = options.length === 0
        ? 'no-options'
        : enabledOptions.length === 0
            ? 'all-options-disabled'
            : recoverableOptionIds.length > 0
                ? 'recoverable-option-available'
                : 'manual-selection-required';

    return {
        totalOptions: options.length,
        enabledOptions: enabledOptions.length,
        disabledOptions: disabledOptions.length,
        minSelectionCount,
        enabledOptionIds: enabledOptions.map((option) => option.id),
        disabledOptionIds: disabledOptions.map((option) => option.id),
        recoverableOptionIds,
        selectionState,
    };
}

export function resolveUnsatisfiableReasonFromSelectability(
    snapshot: AiInteractionSnapshot | null | undefined,
): string | null {
    const diagnostic = buildInteractionSelectabilityDiagnostic(snapshot);
    if (!diagnostic) {
        return null;
    }
    if (diagnostic.totalOptions === 0) {
        return 'empty-options';
    }
    if (diagnostic.enabledOptions === 0) {
        return 'all-options-disabled';
    }
    if (diagnostic.minSelectionCount > 0 && diagnostic.enabledOptions < diagnostic.minSelectionCount) {
        return 'min-selection-unreachable';
    }
    return null;
}

export function buildOnlineAiPendingDamageDiagnostic(
    state: MatchState<unknown>,
): OnlineAiRecoveryPendingDamageDiagnostic | null {
    const pendingDamage = (state.core as {
        pendingDamage?: {
            id?: unknown;
            responderId?: unknown;
            responseType?: unknown;
            currentDamage?: unknown;
            sourceAbilityId?: unknown;
            tokenUsageTotals?: unknown;
        };
    } | undefined)?.pendingDamage;
    return pendingDamage ? {
        id: pendingDamage.id ?? null,
        responderId: pendingDamage.responderId ?? null,
        responseType: pendingDamage.responseType ?? null,
        currentDamage: pendingDamage.currentDamage ?? null,
        sourceAbilityId: pendingDamage.sourceAbilityId ?? null,
        tokenUsageTotals: pendingDamage.tokenUsageTotals ?? null,
    } : null;
}

export function summarizeOnlineAiRecoveryLegalActions(
    legalActions: OnlineAiRecoveryLegalActionLike[],
): OnlineAiRecoveryLegalActionSummary {
    return {
        total: legalActions.length,
        truncated: legalActions.length > MAX_ONLINE_AI_RECOVERY_LEGAL_ACTIONS,
        items: legalActions.slice(0, MAX_ONLINE_AI_RECOVERY_LEGAL_ACTIONS).map((action) => ({
            actionId: action.actionId,
            kind: action.kind,
            label: action.label,
            commandTypes: action.commands.map((command) => command.type),
        })),
    };
}

export function buildOnlineAiRecoveryStateSnapshot(args: {
    matchId: string;
    gameId: string;
    state: MatchState<unknown>;
    seatState: MatchState<unknown>;
    candidate: ForceEndTurnStalledAiResolution;
    trackerKey: string;
    progressMarker: string;
    blockerFingerprint: string | null;
    aiSummary: OnlineAiRecoveryAiSummary;
}): string {
    const interactionState = args.state.sys?.interaction as { isBlocked?: unknown } | undefined;
    const diagnostics = buildOnlineAiFeedbackDiagnosticsContext({
        sharedState: args.state,
        seatState: args.seatState,
    });

    return JSON.stringify({
        matchId: args.matchId,
        gameId: args.gameId,
        playerId: args.candidate.playerId,
        reason: args.candidate.reason,
        trackerKey: args.trackerKey,
        blockerFingerprint: args.blockerFingerprint,
        phase: args.state.sys?.phase ?? null,
        turnNumber: args.state.sys?.turnNumber ?? null,
        currentPlayerId: resolveCurrentPlayerId(args.state),
        progressMarker: args.progressMarker,
        recentActionLogTail: extractOnlineAiRecoveryActionLogTail(args.state),
        recentEventStreamTail: extractOnlineAiRecoveryEventTail(args.state),
        loop: args.candidate.reason === 'action-loop' ? (args.candidate.loopInfo ?? null) : null,
        interaction: {
            isBlocked: interactionState?.isBlocked ?? null,
            shared: diagnostics.sharedInteraction,
            sharedSelectability: diagnostics.sharedSelectability,
            sharedUnsatisfiableReason: diagnostics.sharedUnsatisfiableReason,
            seat: diagnostics.seatInteraction,
            seatSelectability: diagnostics.seatSelectability,
            seatUnsatisfiableReason: diagnostics.seatUnsatisfiableReason,
        },
        seatControllerType: args.aiSummary.seatControllerType,
        legalActions: args.aiSummary.legalActions,
        aiDecisionPreview: args.aiSummary.decisionPreview,
        responseWindow: diagnostics.sharedResponseWindow,
        pendingDamage: diagnostics.pendingDamage,
    });
}

export function buildOnlineAiUnsatisfiableInteractionStateSnapshot(args: {
    matchId: string;
    gameId: string;
    state: MatchState<unknown>;
    seatState: MatchState<unknown>;
    playerId: string;
    reason: string;
    commandType: string;
    progressMarker: string;
    aiSummary: OnlineAiRecoveryAiSummary;
}): string {
    const diagnostics = buildOnlineAiFeedbackDiagnosticsContext({
        sharedState: args.state,
        seatState: args.seatState,
        seatUnsatisfiableReasonOverride: args.reason,
    });
    const blockerFingerprint = buildOnlineAiWatchdogBlockerFingerprint({
        phase: args.seatState.sys?.phase ?? args.state.sys?.phase ?? null,
        reason: args.reason,
        sharedInteraction: diagnostics.sharedInteraction,
        seatInteraction: diagnostics.seatInteraction,
        responseWindow: diagnostics.seatResponseWindow,
        pendingDamage: diagnostics.pendingDamage,
    });

    return JSON.stringify({
        matchId: args.matchId,
        gameId: args.gameId,
        playerId: args.playerId,
        reason: args.reason,
        commandType: args.commandType,
        blockerFingerprint,
        phase: args.seatState.sys?.phase ?? args.state.sys?.phase ?? null,
        turnNumber: args.seatState.sys?.turnNumber ?? args.state.sys?.turnNumber ?? null,
        currentPlayerId: resolveCurrentPlayerId(args.seatState),
        progressMarker: args.progressMarker,
        recentActionLogTail: extractOnlineAiRecoveryActionLogTail(args.state),
        recentEventStreamTail: extractOnlineAiRecoveryEventTail(args.state),
        interaction: {
            shared: diagnostics.sharedInteraction,
            sharedSelectability: diagnostics.sharedSelectability,
            sharedUnsatisfiableReason: diagnostics.sharedUnsatisfiableReason,
            seat: diagnostics.seatInteraction,
            seatSelectability: diagnostics.seatSelectability,
            seatUnsatisfiableReason: diagnostics.seatUnsatisfiableReason,
        },
        seatControllerType: args.aiSummary.seatControllerType,
        legalActions: args.aiSummary.legalActions,
        aiDecisionPreview: args.aiSummary.decisionPreview,
        responseWindow: diagnostics.seatResponseWindow,
    });
}

export function extractOnlineAiRecoveryActionLogTail(
    state: MatchState<unknown>,
): OnlineAiRecoveryActionLogTailEntry[] {
    const entries = (state.sys?.actionLog as {
        entries?: Array<{ text?: unknown; event?: { type?: unknown } }>;
    } | undefined)?.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
        return [];
    }
    return entries.slice(-5).map((entry) => ({
        text: typeof entry?.text === 'string' ? entry.text : undefined,
        type: entry?.event?.type,
    }));
}

export function extractOnlineAiRecoveryEventTail(
    state: MatchState<unknown>,
): OnlineAiRecoveryEventTailEntry[] {
    const entries = (state.sys?.eventStream as {
        entries?: Array<{ type?: unknown; timestamp?: unknown; payload?: unknown }>;
    } | undefined)?.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
        return [];
    }
    return entries.slice(-5).map((entry) => ({
        type: typeof entry?.type === 'string' ? entry.type : undefined,
        timestamp: entry?.timestamp,
        ...(entry?.payload !== undefined ? { payload: cloneOnlineAiDiagnosticValue(entry.payload) } : {}),
    }));
}

export function buildOnlineAiDiagnosticActionLog(args: {
    state: MatchState<unknown>;
    phase?: unknown;
    progressMarker?: string;
    trackerKey?: string;
    blockerFingerprint?: string | null;
    sharedInteraction?: AiInteractionSnapshot | null;
    interaction?: AiInteractionSnapshot | null;
    responseWindow?: AiResponseWindowSnapshot | null;
    pendingDamage?: OnlineAiRecoveryPendingDamageDiagnostic | null;
    commandType?: string;
    reason?: string;
    feedbackSource?: string;
    commandPayload?: unknown;
}): string | undefined {
    const actionLogTail = extractOnlineAiRecoveryActionLogTail(args.state);
    const eventStreamTail = extractOnlineAiRecoveryEventTail(args.state);
    const interactionOptions = (args.interaction?.options ?? []).slice(0, 8);
    const hasSharedInteraction = Boolean(args.sharedInteraction);
    const hasResponseWindow = Boolean(args.responseWindow);
    const hasPendingDamage = Boolean(args.pendingDamage);
    if (
        actionLogTail.length === 0
        && eventStreamTail.length === 0
        && interactionOptions.length === 0
        && !hasSharedInteraction
        && !hasResponseWindow
        && !hasPendingDamage
        && !args.blockerFingerprint
        && !args.commandPayload
    ) {
        return undefined;
    }
    return JSON.stringify({
        kind: 'online-ai-feedback-diagnostic',
        ...(args.phase !== undefined ? { phase: args.phase } : {}),
        ...(args.progressMarker ? { progressMarker: args.progressMarker } : {}),
        ...(args.trackerKey ? { trackerKey: args.trackerKey } : {}),
        ...(args.blockerFingerprint ? { blockerFingerprint: args.blockerFingerprint } : {}),
        ...(args.commandType ? { commandType: args.commandType } : {}),
        ...(args.reason ? { reason: args.reason } : {}),
        ...(args.feedbackSource ? { feedbackSource: args.feedbackSource } : {}),
        ...(args.commandPayload !== undefined
            ? { commandPayload: cloneOnlineAiDiagnosticValue(args.commandPayload) }
            : {}),
        actionLogTail,
        eventStreamTail,
        ...((hasSharedInteraction || args.interaction)
            ? {
                interaction: {
                    ...(args.sharedInteraction
                        ? {
                            shared: {
                                id: args.sharedInteraction.id,
                                kind: args.sharedInteraction.kind,
                                sourceId: args.sharedInteraction.sourceId,
                            },
                            sharedSelectability: buildInteractionSelectabilityDiagnostic(args.sharedInteraction),
                        }
                        : {}),
                    ...(args.interaction
                        ? {
                            seat: {
                                id: args.interaction.id,
                                kind: args.interaction.kind,
                                sourceId: args.interaction.sourceId,
                                options: interactionOptions,
                            },
                            seatSelectability: buildInteractionSelectabilityDiagnostic(args.interaction),
                        }
                        : {}),
                },
            }
            : {}),
        ...(args.responseWindow ? { responseWindow: args.responseWindow } : {}),
        ...(args.pendingDamage ? { pendingDamage: args.pendingDamage } : {}),
    });
}

export function buildOnlineAiFeedbackDiagnosticsContext(args: {
    sharedState: MatchState<unknown>;
    seatState: MatchState<unknown>;
    seatUnsatisfiableReasonOverride?: string | null;
}): OnlineAiFeedbackDiagnosticsContext {
    const sharedInteraction = extractAiInteractionSnapshot(args.sharedState);
    const seatInteraction = extractAiInteractionSnapshot(args.seatState);
    const sharedSelectability = buildInteractionSelectabilityDiagnostic(sharedInteraction);
    const seatSelectability = buildInteractionSelectabilityDiagnostic(seatInteraction);
    const sharedInteractionState = (args.sharedState.sys?.interaction as { current?: unknown } | undefined)?.current;
    const seatInteractionState = (args.seatState.sys?.interaction as { current?: unknown } | undefined)?.current;
    const sharedUnsatisfiableReason = resolveUnsatisfiableReasonFromSelectability(sharedInteraction)
        ?? resolveUnsatisfiableReasonFromInteraction(
            args.sharedState,
            sharedInteractionState as HiddenInteractionDescriptor | undefined,
        );
    const seatUnsatisfiableReason = args.seatUnsatisfiableReasonOverride
        ?? resolveUnsatisfiableReasonFromSelectability(seatInteraction)
        ?? resolveUnsatisfiableReasonFromInteraction(
            args.seatState,
            seatInteractionState as HiddenInteractionDescriptor | undefined,
        );

    return {
        sharedInteraction,
        seatInteraction,
        sharedSelectability,
        seatSelectability,
        sharedResponseWindow: extractAiResponseWindowSnapshot(args.sharedState),
        seatResponseWindow: extractAiResponseWindowSnapshot(args.seatState),
        pendingDamage: buildOnlineAiPendingDamageDiagnostic(args.sharedState),
        sharedUnsatisfiableReason,
        seatUnsatisfiableReason,
    };
}

export function buildOnlineAiWatchdogBlockerFingerprint(args: {
    phase?: unknown;
    reason?: unknown;
    sharedInteraction?: AiInteractionSnapshot | null;
    seatInteraction?: AiInteractionSnapshot | null;
    responseWindow?: AiResponseWindowSnapshot | null;
    pendingDamage?: OnlineAiRecoveryPendingDamageDiagnostic | null;
}): string | null {
    const phase = normalizeOnlineAiDiagnosticSegment(args.phase, 'unknown-phase');
    const reason = normalizeOnlineAiDiagnosticSegment(args.reason, 'unknown-reason');
    const interaction = args.seatInteraction ?? args.sharedInteraction;
    if (interaction) {
        const kind = normalizeOnlineAiDiagnosticSegment(interaction.kind, 'unknown-kind');
        const sourceId = normalizeOnlineAiDiagnosticSegment(
            typeof interaction.sourceId === 'string' ? interaction.sourceId : interaction.id,
            'unknown-source',
        );
        return `${phase}:${reason}:interaction:${kind}:${sourceId}`;
    }
    if (args.responseWindow) {
        const windowType = normalizeOnlineAiDiagnosticSegment(args.responseWindow.windowType, 'unknown-window');
        const sourceId = normalizeOnlineAiDiagnosticSegment(args.responseWindow.sourceId, 'unknown-source');
        const responderId = normalizeOnlineAiDiagnosticSegment(
            resolveOnlineAiResponseWindowResponderId(args.responseWindow),
            'unknown-responder',
        );
        return `${phase}:${reason}:response-window:${windowType}:${sourceId}:${responderId}`;
    }
    if (args.pendingDamage) {
        const responseType = normalizeOnlineAiDiagnosticSegment(args.pendingDamage.responseType, 'unknown-response');
        const sourceAbilityId = normalizeOnlineAiDiagnosticSegment(
            args.pendingDamage.sourceAbilityId,
            'unknown-source-ability',
        );
        const responderId = normalizeOnlineAiDiagnosticSegment(
            args.pendingDamage.responderId,
            'unknown-responder',
        );
        return `${phase}:${reason}:pending-damage:${responseType}:${sourceAbilityId}:${responderId}`;
    }
    return null;
}

export function extractOnlineAiRecoveryFingerprintFromTrackerKey(
    playerId: string,
    reason: string,
    trackerKey: string,
): string | null {
    const prefix = `${playerId}:${reason}:`;
    if (!trackerKey.startsWith(prefix)) {
        return null;
    }
    const fingerprint = trackerKey.slice(prefix.length).trim();
    return fingerprint || null;
}

export function resolveOnlineAiRecoveryFeedbackFingerprint(args: {
    baseFingerprint: string | null | undefined;
    failureReason?: OnlineAiRecoveryFeedbackFailureReason;
}): string | null {
    const baseFingerprint = args.baseFingerprint?.trim();
    if (!baseFingerprint) {
        return null;
    }

    const detailedFailureFingerprintSegment = args.failureReason === 'missing_visible_state'
        ? 'missing-visible-state'
        : args.failureReason === 'private_overlay_missing'
            ? 'missing-private-overlay'
            : args.failureReason === 'private_overlay_stale'
                ? 'stale-private-overlay'
                : null;
    if (detailedFailureFingerprintSegment) {
        return `${baseFingerprint}:${detailedFailureFingerprintSegment}`;
    }
    return baseFingerprint;
}

export function resolveOnlineAiRecoveryBlockerFingerprint(args: {
    state: MatchState<unknown>;
    candidate: ForceEndTurnStalledAiResolution;
    trackerKey: string;
    progressMarker: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    failureReason?: OnlineAiRecoveryFeedbackFailureReason;
}): string | null {
    return resolveOnlineAiRecoveryFeedbackFingerprint({
        baseFingerprint: args.candidate.fingerprintHint
            ?? extractOnlineAiRecoveryFingerprintFromTrackerKey(
                args.candidate.playerId,
                args.candidate.reason,
                args.trackerKey,
            )
            ?? resolveOnlineAiRecoveryFingerprint({
                state: args.state,
                candidate: args.candidate,
                progressMarker: args.progressMarker,
                engineConfig: args.engineConfig,
            }),
        failureReason: args.failureReason,
    });
}
