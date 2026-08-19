import type {
    AiBlockedResolution,
    AiDispatchResult,
    AiResolution,
} from '../ai/localRunner';
import { resolveOnlineAiDecisionView, type ResolvedOnlineAiDecisionView } from '../ai/onlineDecisionView';
import type { GameAiRuntime } from '../ai/types';
import type { MatchState } from '../types';
import {
    buildAiProgressMarker,
    buildInteractionRecoveryFingerprintHint,
    buildResponseWindowRecoveryFingerprintHint,
    type OnlineAiRecoveryEngineConfig,
    type HiddenInteractionDescriptor,
    type HiddenSimpleChoiceInteraction,
    resolveOnlineAiCurrentPlayerId,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';
import {
    buildOnlineAiRecoverySequenceStepKey,
    buildOnlineAiRecoveryTrackerSnapshot,
    readOnlineAiCurrentInteractionRecoveryFingerprintHint,
    readOnlineAiCurrentInteractionSemanticFingerprint,
    readOnlineAiCurrentResponseWindowRecoveryFingerprintHint,
    readOnlineAiCurrentSeatViewInteractionRecoveryFingerprintHint,
} from './onlineAiWatchdogSequenceFingerprinting';
import type { OnlineAiWatchdogSeatController } from './onlineAiWatchdogSeatControllers';
import type { OnlineAiWatchdogStepBookkeepingDecision } from './onlineAiWatchdogStepBookkeeping';
import type { OnlineAiRecoveryTracker } from './onlineAiWatchdogTracker';
import { resolveOnlineAiWatchdogAdvancePhaseCommandType } from './onlineAiWatchdogGameSemantics';

export function isOnlineAiInteractionRecoveryReason(
    reason: ForceEndTurnStalledAiResolution['reason'],
): boolean {
    return reason === 'visible-interaction' || reason === 'hidden-interaction';
}

export function resolveOnlineAiRecoveryPhaseLabel(
    candidate: ForceEndTurnStalledAiResolution,
): 'recover-interaction' | 'follow-up-advance' {
    return candidate.requiresConfirmedAdvancePhase ? 'recover-interaction' : 'follow-up-advance';
}

export function mapOnlineAiRecoveryCommand(args: {
    command?: { type?: string; payload?: unknown };
    advancePhaseCommandType: string;
}): { type: string; payload: unknown } {
    const { command, advancePhaseCommandType } = args;
    if (!command) {
        return { type: 'UNKNOWN', payload: {} };
    }
    if (command.type === 'ADVANCE_PHASE' && advancePhaseCommandType !== 'ADVANCE_PHASE') {
        return { ...command, type: advancePhaseCommandType, payload: command.payload ?? {} };
    }
    return {
        type: typeof command.type === 'string' ? command.type : 'UNKNOWN',
        payload: command.payload ?? {},
    };
}

export function hasHumanResponderInCurrentWindow(
    state: MatchState<unknown>,
    seatControllers: Record<string, OnlineAiWatchdogSeatController>,
): boolean {
    const currentWindow = (state.sys as { responseWindow?: { current?: unknown } } | undefined)
        ?.responseWindow?.current as {
            responderQueue?: unknown;
        } | undefined;
    if (!currentWindow) {
        return false;
    }
    const responderQueue = Array.isArray(currentWindow.responderQueue) ? currentWindow.responderQueue : [];
    return responderQueue.some((responderId) => {
        const id = typeof responderId === 'string' ? responderId : '';
        return id.length > 0 && seatControllers[id]?.type === 'human';
    });
}

export function canExecuteOnlineAiWatchdogAdvancePhase(args: {
    state: MatchState<unknown>;
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    playerId: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): boolean {
    if (!args.playerId || args.seatControllers[args.playerId]?.type === 'human') {
        return false;
    }

    if (resolveOnlineAiCurrentPlayerId(args.state, { engineConfig: args.engineConfig }) !== args.playerId) {
        return false;
    }

    const interactionState = args.state.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
    if (interactionState?.current || interactionState?.isBlocked === true) {
        return false;
    }

    if (hasHumanResponderInCurrentWindow(args.state, args.seatControllers)) {
        return false;
    }

    return true;
}

export function shouldRestrictOnlineAiRecoveryFollowUpToLegalActions(args: {
    rootCandidate: ForceEndTurnStalledAiResolution;
    nextCandidate: ForceEndTurnStalledAiResolution;
    currentPlayerIdBeforeStep: string | null;
    currentPlayerIdAfterStep: string | null;
}): boolean {
    return args.rootCandidate.requiresConfirmedAdvancePhase === true
        && isOnlineAiInteractionRecoveryReason(args.rootCandidate.reason)
        && args.nextCandidate.reason === 'active-turn'
        && args.currentPlayerIdBeforeStep !== args.rootCandidate.playerId
        && args.currentPlayerIdAfterStep === args.rootCandidate.playerId;
}

export function shouldAllowOnlineAiRecoveryNaturalContinuationAfterInteractionResolved(args: {
    actionRecoveryApplied: boolean;
    rootCandidateReason: ForceEndTurnStalledAiResolution['reason'];
    currentCandidateReason: ForceEndTurnStalledAiResolution['reason'];
    nextCandidateReason: ForceEndTurnStalledAiResolution['reason'];
    responseWindowFingerprintBeforeStep: string | null;
    seatViewInteractionAfterStep: string | null;
    restrictFollowUpToLegalActions: boolean;
}): boolean {
    return args.actionRecoveryApplied
        && isOnlineAiInteractionRecoveryReason(args.rootCandidateReason)
        && isOnlineAiInteractionRecoveryReason(args.currentCandidateReason)
        && !args.responseWindowFingerprintBeforeStep
        && !args.seatViewInteractionAfterStep
        && args.nextCandidateReason === 'active-turn'
        && !args.restrictFollowUpToLegalActions;
}

export function normalizeOnlineAiRecoveryFollowUpCandidate(args: {
    candidate: ForceEndTurnStalledAiResolution;
    restrictToLegalActions: boolean;
    allowForceCommandAfterLegalActionExhausted: boolean;
}): ForceEndTurnStalledAiResolution {
    if (!args.restrictToLegalActions) {
        return args.candidate;
    }

    return {
        ...args.candidate,
        legalActionOnly: true,
        ...(args.allowForceCommandAfterLegalActionExhausted
            ? {
                allowForceCommandAfterLegalActionExhausted: true,
            }
            : {
                resolution: {
                    ...args.candidate.resolution,
                    action: {
                        ...args.candidate.resolution.action,
                        commands: [],
                    },
                },
            }),
    };
}

export function normalizeOnlineAiRecoveryExpectedLegalActionOnlyCandidate(args: {
    candidate: ForceEndTurnStalledAiResolution;
    expectedCandidate: ForceEndTurnStalledAiResolution;
}): ForceEndTurnStalledAiResolution {
    if (
        args.expectedCandidate.reason !== 'active-turn'
        || args.expectedCandidate.legalActionOnly !== true
        || args.candidate.reason !== 'active-turn'
        || args.candidate.legalActionOnly === true
    ) {
        return args.candidate;
    }

    return {
        ...args.candidate,
        legalActionOnly: true,
        ...(args.expectedCandidate.allowForceCommandAfterLegalActionExhausted === true
            ? {
                allowForceCommandAfterLegalActionExhausted: true,
            }
            : {}),
    };
}

export function shouldAllowOnlineAiRecoveryNaturalContinuationForLiveSeat(args: {
    actionRecoveryApplied: boolean;
    nextCandidateReason: ForceEndTurnStalledAiResolution['reason'];
    hasLiveSeatConnection: boolean;
}): boolean {
    return args.actionRecoveryApplied
        && args.nextCandidateReason === 'active-turn'
        && args.hasLiveSeatConnection;
}

export function shouldAttemptOnlineAiRecoveryHardCancel(args: {
    attemptedInteractionRespond: boolean;
    currentCandidateReason: ForceEndTurnStalledAiResolution['reason'];
    nextCandidateReason: ForceEndTurnStalledAiResolution['reason'];
    interactionFingerprintBeforeStep: string | null;
    interactionFingerprintAfterStep: string | null;
}): boolean {
    return args.attemptedInteractionRespond
        && isOnlineAiInteractionRecoveryReason(args.currentCandidateReason)
        && isOnlineAiInteractionRecoveryReason(args.nextCandidateReason)
        && Boolean(args.interactionFingerprintBeforeStep)
        && args.interactionFingerprintAfterStep === args.interactionFingerprintBeforeStep;
}

export type OnlineAiHardCancelDecision =
    | {
        kind: 'skip';
    }
    | {
        kind: 'cancel';
        playerId: string;
        interactionId?: string;
    };

export function resolveOnlineAiHardCancelDecision(args: {
    candidate: ForceEndTurnStalledAiResolution;
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    currentInteraction: {
        id?: unknown;
        kind?: unknown;
        playerId?: unknown;
    } | null | undefined;
}): OnlineAiHardCancelDecision {
    if (!isOnlineAiInteractionRecoveryReason(args.candidate.reason)) {
        return { kind: 'skip' };
    }
    if (!args.candidate.playerId || args.seatControllers[args.candidate.playerId]?.type === 'human') {
        return { kind: 'skip' };
    }

    const currentInteraction = args.currentInteraction;
    if (!currentInteraction || String(currentInteraction.playerId ?? '') !== args.candidate.playerId) {
        return { kind: 'skip' };
    }
    if (currentInteraction.kind === 'compare-roll-choice') {
        return { kind: 'skip' };
    }

    return {
        kind: 'cancel',
        playerId: args.candidate.playerId,
        interactionId: typeof currentInteraction.id === 'string' ? currentInteraction.id : undefined,
    };
}

export function resolveOnlineAiHardCancelDecisionFromRuntime(args: {
    state: MatchState<unknown>;
    candidate: ForceEndTurnStalledAiResolution;
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
}): OnlineAiHardCancelDecision {
    const currentInteraction = (args.state.sys?.interaction as {
        current?: {
            id?: unknown;
            kind?: unknown;
            playerId?: unknown;
        };
    } | undefined)?.current;
    return resolveOnlineAiHardCancelDecision({
        candidate: args.candidate,
        seatControllers: args.seatControllers,
        currentInteraction,
    });
}

export type OnlineAiRecoveryForcedCommandProgress = {
    usedForcedRecoveryCommand: boolean;
    totalAdvanceSteps: number;
    totalForcedCommands: number;
    lastForcedReason: ForceEndTurnStalledAiResolution['reason'] | null;
    lastForcedPhaseLabel: 'recover-interaction' | 'follow-up-advance';
};

export function createOnlineAiRecoveryForcedCommandProgress(args: {
    initialPhaseLabel: 'recover-interaction' | 'follow-up-advance';
}): OnlineAiRecoveryForcedCommandProgress {
    return {
        usedForcedRecoveryCommand: false,
        totalAdvanceSteps: 0,
        totalForcedCommands: 0,
        lastForcedReason: null,
        lastForcedPhaseLabel: args.initialPhaseLabel,
    };
}

export function recordOnlineAiForcedRecoveryCommandAttempt(args: {
    progress: OnlineAiRecoveryForcedCommandProgress;
    candidateReason: ForceEndTurnStalledAiResolution['reason'];
    phaseLabel: 'recover-interaction' | 'follow-up-advance';
}): OnlineAiRecoveryForcedCommandProgress {
    return {
        ...args.progress,
        usedForcedRecoveryCommand: true,
        totalForcedCommands: args.progress.totalForcedCommands + 1,
        lastForcedReason: args.candidateReason,
        lastForcedPhaseLabel: args.phaseLabel,
    };
}

export function recordOnlineAiForcedRecoveryAdvanceStep(
    progress: OnlineAiRecoveryForcedCommandProgress,
): OnlineAiRecoveryForcedCommandProgress {
    return {
        ...progress,
        totalAdvanceSteps: progress.totalAdvanceSteps + 1,
    };
}

export type OnlineAiRecoveryFollowUpDecision =
    | {
        kind: 'natural-continuation';
    }
    | {
        kind: 'continue-with-candidate';
        candidate: ForceEndTurnStalledAiResolution;
    };

export type OnlineAiRecoveryFollowUpTransitionDecision =
    | {
        kind: 'natural-continuation';
    }
    | {
        kind: 'continue-with-candidate';
        candidate: ForceEndTurnStalledAiResolution;
        nextTrackerKey: string | null;
    };

export type OnlineAiRecoveryPauseDecision =
    | {
        kind: 'continue';
    }
    | {
        kind: 'pause';
        nextTrackerKey: string;
    };

export type OnlineAiRecoveryCompletionDecision =
    | {
        kind: 'fail';
        reason: 'blocker_persisted' | 'no_progress';
    }
    | {
        kind: 'success';
    };

export type OnlineAiRecoveryFailureDispatchDecision =
    | {
        kind: 'none';
    }
    | {
        kind: 'report-failure';
        candidate: ForceEndTurnStalledAiResolution;
        phaseLabel: 'recover-interaction' | 'follow-up-advance';
        reason: string;
        shouldRevalidateCandidate?: boolean;
    };

export type OnlineAiRecoverySuccessFeedbackDecision =
    | {
        kind: 'none';
    }
    | {
        kind: 'report';
        metadata: OnlineAiRecoveryResolvedFeedbackMetadata;
    };

export type OnlineAiRecoveryReportedLegalAction = {
    candidateReason: ForceEndTurnStalledAiResolution['reason'];
    playerId: string;
    actionKind: string;
    actionId: string;
    metadata?: Record<string, unknown>;
};

export type OnlineAiRecoverySequenceProgress = {
    recoverySteps: number;
    allowNaturalAiContinuation: boolean;
    lastUnreportedLegalActionRecovery: OnlineAiRecoveryReportedLegalAction | null;
};

export type OnlineAiRecoveryStepBeforeSnapshot = {
    markerBeforeStep: string;
    currentPlayerIdBeforeStep: string | null;
    stepKeyBefore: string;
    interactionFingerprintBeforeStep: string | null;
    responseWindowFingerprintBeforeStep: string | null;
};

export type OnlineAiRecoveryStepAfterSnapshot = {
    nextMarker: string;
    currentPlayerIdAfterStep: string | null;
    nextStepKey: string;
    interactionFingerprintAfterStep: string | null;
    interactionRecoveryFingerprintAfterStep: string | null;
};

export type OnlineAiRecoveryForceCommandAllowanceResolver = ((args: {
    state: MatchState<unknown>;
    phase: string;
    previousCandidate: ForceEndTurnStalledAiResolution;
    nextCandidate: ForceEndTurnStalledAiResolution;
}) => boolean) | undefined;

export type OnlineAiRecoveryFollowUpRuntimeSnapshot = {
    seatViewInteractionAfterStep: string | null;
    hasHumanResponderInCurrentWindow: boolean;
    hasLiveSeatConnection: boolean;
    allowForceCommandAfterLegalActionExhaustedRequested: boolean;
};

export function createOnlineAiRecoverySequenceProgress(): OnlineAiRecoverySequenceProgress {
    return {
        recoverySteps: 0,
        allowNaturalAiContinuation: false,
        lastUnreportedLegalActionRecovery: null,
    };
}

export function buildOnlineAiRecoveryStepBeforeSnapshot(args: {
    state: MatchState<unknown>;
    playerId: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): OnlineAiRecoveryStepBeforeSnapshot {
    const markerBeforeStep = buildAiProgressMarker(args.state, { engineConfig: args.engineConfig });
    return {
        markerBeforeStep,
        currentPlayerIdBeforeStep: resolveOnlineAiCurrentPlayerId(args.state, { engineConfig: args.engineConfig }),
        stepKeyBefore: buildOnlineAiRecoverySequenceStepKey({
            state: args.state,
            playerId: args.playerId,
            progressMarker: markerBeforeStep,
            engineConfig: args.engineConfig,
        }),
        interactionFingerprintBeforeStep: readOnlineAiCurrentInteractionSemanticFingerprint(
            args.state,
            args.playerId,
            args.engineConfig,
        ),
        responseWindowFingerprintBeforeStep: readOnlineAiCurrentResponseWindowRecoveryFingerprintHint(
            args.state,
            args.playerId,
        ),
    };
}

export function buildOnlineAiRecoveryStepAfterSnapshot(args: {
    state: MatchState<unknown>;
    playerId: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): OnlineAiRecoveryStepAfterSnapshot {
    const nextMarker = buildAiProgressMarker(args.state, { engineConfig: args.engineConfig });
    return {
        nextMarker,
        currentPlayerIdAfterStep: resolveOnlineAiCurrentPlayerId(args.state, { engineConfig: args.engineConfig }),
        nextStepKey: buildOnlineAiRecoverySequenceStepKey({
            state: args.state,
            playerId: args.playerId,
            progressMarker: nextMarker,
            engineConfig: args.engineConfig,
        }),
        interactionFingerprintAfterStep: readOnlineAiCurrentInteractionSemanticFingerprint(
            args.state,
            args.playerId,
            args.engineConfig,
        ),
        interactionRecoveryFingerprintAfterStep: readOnlineAiCurrentInteractionRecoveryFingerprintHint(
            args.state,
            args.playerId,
            args.engineConfig,
        ),
    };
}

export function resolveOnlineAiRecoveryForceCommandAllowance(args: {
    state: MatchState<unknown>;
    previousCandidate: ForceEndTurnStalledAiResolution;
    nextCandidate: ForceEndTurnStalledAiResolution;
    resolveRequested: OnlineAiRecoveryForceCommandAllowanceResolver;
}): boolean {
    const phase = typeof args.state.sys?.phase === 'string' ? args.state.sys.phase : '';
    return args.resolveRequested?.({
        state: args.state,
        phase,
        previousCandidate: args.previousCandidate,
        nextCandidate: args.nextCandidate,
    }) === true;
}

export function buildOnlineAiRecoveryFollowUpRuntimeSnapshot(args: {
    state: MatchState<unknown>;
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    rootCandidate: ForceEndTurnStalledAiResolution;
    nextCandidate: ForceEndTurnStalledAiResolution;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    hasLiveSeatConnection: boolean;
    resolvePrivateOverlay: (playerId: string) => MatchState<unknown>;
    resolveForceCommandAllowance: OnlineAiRecoveryForceCommandAllowanceResolver;
}): OnlineAiRecoveryFollowUpRuntimeSnapshot {
    return {
        seatViewInteractionAfterStep: readOnlineAiCurrentSeatViewInteractionRecoveryFingerprintHint(
            args.resolvePrivateOverlay(args.rootCandidate.playerId),
            args.rootCandidate.playerId,
            args.engineConfig,
        ),
        hasHumanResponderInCurrentWindow: hasHumanResponderInCurrentWindow(args.state, args.seatControllers),
        hasLiveSeatConnection: args.hasLiveSeatConnection,
        allowForceCommandAfterLegalActionExhaustedRequested: resolveOnlineAiRecoveryForceCommandAllowance({
            state: args.state,
            previousCandidate: args.rootCandidate,
            nextCandidate: args.nextCandidate,
            resolveRequested: args.resolveForceCommandAllowance,
        }),
    };
}

export function recordOnlineAiRecoveryStep(
    progress: OnlineAiRecoverySequenceProgress,
): OnlineAiRecoverySequenceProgress {
    return {
        ...progress,
        recoverySteps: progress.recoverySteps + 1,
    };
}

export function recordOnlineAiRecoveryAppliedLegalAction(args: {
    progress: OnlineAiRecoverySequenceProgress;
    reportedAction: OnlineAiRecoveryReportedLegalAction | null | undefined;
}): OnlineAiRecoverySequenceProgress {
    if (!args.reportedAction) {
        return args.progress;
    }

    return {
        ...args.progress,
        lastUnreportedLegalActionRecovery: args.reportedAction,
    };
}

export function markOnlineAiRecoveryNaturalContinuation(
    progress: OnlineAiRecoverySequenceProgress,
): OnlineAiRecoverySequenceProgress {
    return {
        ...progress,
        allowNaturalAiContinuation: true,
    };
}

export type OnlineAiPrivateOverlayBlockedReason =
    | 'missing-private-overlay'
    | 'stale-private-overlay';

export type OnlineAiLegalActionRecoveryResult = {
    applied: boolean;
    resolved: boolean;
    blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
    executedCommandTypes: string[];
    outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
    failedCommandType?: string;
    commandFailureReason?: string | null;
    reportedAction?: OnlineAiRecoveryReportedLegalAction | null;
};

export type OnlineAiRecoveryBlockedFailureReason =
    | 'private_overlay_stale'
    | 'private_overlay_missing'
    | 'missing_visible_state';

export type OnlineAiRecoveryResolvedFeedbackMetadata = {
    matchId: string;
    gameId: string;
    playerId: string;
    incidentKind: 'legal-action-recovered' | 'force-end-turn-success';
    severity: 'medium';
    status: 'resolved';
    reason: string;
    trackerKey: string;
    progressMarker: string;
};

export type OnlineAiRecoveryFailureFeedbackMetadata = {
    matchId: string;
    gameId: string;
    playerId: string;
    incidentKind: 'force-end-turn-failed';
    severity: 'high';
    reason: string;
    trackerKey: string;
    progressMarker: string;
};

export function buildOnlineAiRecoveryResolvedLegalActionReason(
    action: OnlineAiRecoveryReportedLegalAction,
): string {
    return `${action.candidateReason}:legal-action:${action.actionKind}:${action.actionId}`;
}

export function resolveOnlineAiRecoveryBlockedFailureReason(
    blockedReason: OnlineAiLegalActionRecoveryResult['blockedReason'],
): OnlineAiRecoveryBlockedFailureReason | null {
    return blockedReason === 'stale-private-overlay'
        ? 'private_overlay_stale'
        : blockedReason === 'missing-private-overlay'
            ? 'private_overlay_missing'
            : blockedReason === 'missing-visible-state'
                ? 'missing_visible_state'
                : null;
}

export function buildOnlineAiNoLegalActionRecoveryResult(): OnlineAiLegalActionRecoveryResult {
    return {
        applied: false,
        resolved: false,
        blockedReason: null,
        executedCommandTypes: [],
        outcome: 'no-legal-action',
        reportedAction: null,
    };
}

export function isOnlineAiPrivateOverlayBlockedReason(
    blockedReason: unknown,
): blockedReason is OnlineAiPrivateOverlayBlockedReason {
    return blockedReason === 'missing-private-overlay' || blockedReason === 'stale-private-overlay';
}

export function resolveOnlineAiEmergencyOverlayRetryBlockedReason(args: {
    canUseEmergencyOverlayFallback: boolean;
    dispatchKind: string;
    blockedReason: unknown;
}): OnlineAiPrivateOverlayBlockedReason | null {
    if (!args.canUseEmergencyOverlayFallback || args.dispatchKind !== 'blocked') {
        return null;
    }
    return isOnlineAiPrivateOverlayBlockedReason(args.blockedReason)
        ? args.blockedReason
        : null;
}

export function resolveOnlineAiOverlayResyncBlockedReason(args: {
    candidateReason: ForceEndTurnStalledAiResolution['reason'];
    visibility: unknown;
    blockedReason: unknown;
}): OnlineAiPrivateOverlayBlockedReason | null {
    if (args.candidateReason === 'response-loop' || args.visibility !== 'private-required') {
        return null;
    }
    return isOnlineAiPrivateOverlayBlockedReason(args.blockedReason)
        ? args.blockedReason
        : null;
}

export type OnlineAiDecisionViewResolvers = {
    resolveStrictOnlineDecisionView: (playerId: string) => ResolvedOnlineAiDecisionView;
    resolveEmergencyPlayerView: (playerId: string) => MatchState<unknown>;
};

export function buildOnlineAiDecisionViewResolvers(args: {
    runtime: GameAiRuntime | null;
    sharedState: MatchState<unknown>;
    resolvePrivateOverlay: (playerId: string) => MatchState<unknown>;
}): OnlineAiDecisionViewResolvers {
    const resolveEmergencyPlayerView = (playerId: string) => args.resolvePrivateOverlay(playerId);
    const resolveStrictOnlineDecisionView = (playerId: string) => resolveOnlineAiDecisionView({
        runtime: args.runtime,
        sharedState: args.sharedState,
        privateOverlay: resolveEmergencyPlayerView(playerId),
        playerId,
    });
    return {
        resolveStrictOnlineDecisionView,
        resolveEmergencyPlayerView,
    };
}

export function resolveOnlineAiVisibleStateForPlayer(args: {
    runtime: GameAiRuntime | null;
    sharedState: MatchState<unknown>;
    playerId: string;
    resolvePrivateOverlay: (playerId: string) => MatchState<unknown>;
}): {
    decisionView: ResolvedOnlineAiDecisionView;
    visibleState: MatchState<unknown>;
} {
    const decisionView = resolveOnlineAiDecisionView({
        runtime: args.runtime,
        sharedState: args.sharedState,
        privateOverlay: args.resolvePrivateOverlay(args.playerId),
        playerId: args.playerId,
    });
    return {
        decisionView,
        visibleState: decisionView.visibleState,
    };
}

export async function dispatchOnlineAiWithResolvedSeatView(args: {
    dispatchResolver: (args: {
        engineConfig: unknown;
        state: MatchState<unknown>;
        matchId: string;
        seatControllers: Record<string, unknown>;
        visibleStateResolver: (playerId: string) => MatchState<unknown> | ResolvedOnlineAiDecisionView;
    }) => Promise<AiDispatchResult>;
    engineConfig: unknown;
    state: MatchState<unknown>;
    matchId: string;
    seatControllers: Record<string, unknown>;
    decisionViewResolvers: OnlineAiDecisionViewResolvers;
    mode: 'strict' | 'emergency';
}): Promise<AiDispatchResult> {
    return args.dispatchResolver({
        engineConfig: args.engineConfig,
        state: args.state,
        matchId: args.matchId,
        seatControllers: args.seatControllers,
        visibleStateResolver: args.mode === 'strict'
            ? args.decisionViewResolvers.resolveStrictOnlineDecisionView
            : args.decisionViewResolvers.resolveEmergencyPlayerView,
    });
}

export type OnlineAiBlockedLegalActionLogContext = {
    playerId: string;
    blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay';
    visibility: 'shared' | 'private-required' | 'unknown';
    blockedKey: string;
};

export type OnlineAiBlockedLegalActionOverlayResyncRequest = {
    playerId: string;
    blockedReason: OnlineAiPrivateOverlayBlockedReason;
    blockedKey: string;
};

export type OnlineAiLegalActionDispatchDecision =
    | {
        kind: 'action';
        resolution: AiResolution;
    }
    | {
        kind: 'blocked';
        blocked: AiBlockedResolution;
        logContext: OnlineAiBlockedLegalActionLogContext;
        overlayResyncRequest: OnlineAiBlockedLegalActionOverlayResyncRequest | null;
        recoveryResult: OnlineAiLegalActionRecoveryResult;
    }
    | {
        kind: 'no-legal-action';
        recoveryResult: OnlineAiLegalActionRecoveryResult;
    }
    | {
        kind: 'retry-with-emergency-overlay';
        blocked: AiBlockedResolution;
        retryBlockedReason: OnlineAiPrivateOverlayBlockedReason;
    };

export function resolveOnlineAiLegalActionDispatchDecision(args: {
    candidateReason: ForceEndTurnStalledAiResolution['reason'];
    allowEmergencyOverlayRetry: boolean;
    dispatchResult: AiDispatchResult;
}): OnlineAiLegalActionDispatchDecision {
    if (args.dispatchResult.kind === 'action') {
        return {
            kind: 'action',
            resolution: args.dispatchResult.resolution,
        };
    }

    if (args.dispatchResult.kind !== 'blocked') {
        return {
            kind: 'no-legal-action',
            recoveryResult: buildOnlineAiNoLegalActionRecoveryResult(),
        };
    }

    const retryBlockedReason = resolveOnlineAiEmergencyOverlayRetryBlockedReason({
        canUseEmergencyOverlayFallback: args.allowEmergencyOverlayRetry,
        dispatchKind: args.dispatchResult.kind,
        blockedReason: args.dispatchResult.blockedReason,
    });
    if (retryBlockedReason) {
        return {
            kind: 'retry-with-emergency-overlay',
            blocked: args.dispatchResult,
            retryBlockedReason,
        };
    }

    const overlayResyncBlockedReason = resolveOnlineAiOverlayResyncBlockedReason({
        candidateReason: args.candidateReason,
        visibility: args.dispatchResult.visibility,
        blockedReason: args.dispatchResult.blockedReason,
    });

    return {
        kind: 'blocked',
        blocked: args.dispatchResult,
        logContext: {
            playerId: args.dispatchResult.playerId,
            blockedReason: args.dispatchResult.blockedReason,
            visibility: args.dispatchResult.visibility,
            blockedKey: args.dispatchResult.blockedKey,
        },
        overlayResyncRequest: overlayResyncBlockedReason
            ? {
                playerId: args.dispatchResult.playerId,
                blockedReason: overlayResyncBlockedReason,
                blockedKey: args.dispatchResult.blockedKey,
            }
            : null,
        recoveryResult: buildOnlineAiBlockedLegalActionRecoveryResult({
            blockedReason: args.dispatchResult.blockedReason,
        }),
    };
}

export function buildOnlineAiBlockedLegalActionRecoveryResult(args: {
    blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay';
}): OnlineAiLegalActionRecoveryResult {
    return {
        applied: false,
        resolved: false,
        blockedReason: args.blockedReason,
        executedCommandTypes: [],
        outcome: 'blocked',
        reportedAction: null,
    };
}

export function buildOnlineAiLegalActionCommandFailedResult(args: {
    executedCommandTypes?: string[];
    failedCommandType?: string;
    commandFailureReason?: string | null;
} = {}): OnlineAiLegalActionRecoveryResult {
    return {
        applied: false,
        resolved: false,
        blockedReason: null,
        executedCommandTypes: args.executedCommandTypes ?? [],
        outcome: 'legal-action-command-failed',
        ...(typeof args.failedCommandType === 'string'
            ? { failedCommandType: args.failedCommandType }
            : {}),
        ...(args.commandFailureReason !== undefined
            ? { commandFailureReason: args.commandFailureReason }
            : {}),
        reportedAction: null,
    };
}

export function buildOnlineAiAppliedLegalActionRecoveryResult(args: {
    resolved: boolean;
    executedCommandTypes: string[];
    action: OnlineAiRecoveryReportedLegalAction;
}): OnlineAiLegalActionRecoveryResult {
    return {
        applied: true,
        resolved: args.resolved,
        blockedReason: null,
        executedCommandTypes: args.executedCommandTypes,
        outcome: 'applied',
        reportedAction: args.action,
    };
}

export type OnlineAiLegalActionCommandExecutionDecision =
    | {
        kind: 'command-failed';
        recoveryResult: OnlineAiLegalActionRecoveryResult;
    }
    | {
        kind: 'applied';
        recoveryResult: OnlineAiLegalActionRecoveryResult;
        beforeTrackerSnapshot: { progressMarker: string; recoveryFingerprint: string };
        afterTrackerSnapshot: { progressMarker: string; recoveryFingerprint: string };
    };

export async function executeOnlineAiLegalActionRecoveryCommands(args: {
    candidateReason: ForceEndTurnStalledAiResolution['reason'];
    resolution: AiResolution;
    beforeTrackerSnapshot: { progressMarker: string; recoveryFingerprint: string };
    readAfterTrackerSnapshot: () => { progressMarker: string; recoveryFingerprint: string };
    executeCommand: (command: { type: string; payload: unknown }) => Promise<{
        success: boolean;
        commandFailureReason?: string | null;
    }>;
}): Promise<OnlineAiLegalActionCommandExecutionDecision> {
    const executedCommandTypes: string[] = [];
    for (const command of args.resolution.action.commands) {
        const execution = await args.executeCommand(command);
        if (!execution.success) {
            return {
                kind: 'command-failed',
                recoveryResult: buildOnlineAiLegalActionCommandFailedResult({
                    executedCommandTypes,
                    failedCommandType: command.type,
                    commandFailureReason: execution.commandFailureReason,
                }),
            };
        }
        executedCommandTypes.push(command.type);
    }

    const afterTrackerSnapshot = args.readAfterTrackerSnapshot();
    if (!didOnlineAiRecoveryTrackerSnapshotProgress({
        before: args.beforeTrackerSnapshot,
        after: afterTrackerSnapshot,
    })) {
        return {
            kind: 'command-failed',
            recoveryResult: buildOnlineAiLegalActionCommandFailedResult(),
        };
    }

    return {
        kind: 'applied',
        beforeTrackerSnapshot: args.beforeTrackerSnapshot,
        afterTrackerSnapshot,
        recoveryResult: buildOnlineAiAppliedLegalActionRecoveryResult({
            resolved: false,
            executedCommandTypes,
            action: {
                candidateReason: args.candidateReason,
                playerId: args.resolution.playerId,
                actionKind: args.resolution.action.kind,
                actionId: args.resolution.action.actionId,
            },
        }),
    };
}

export type OnlineAiAppliedLegalActionFinalizationDecision = {
    trackerDisposition: 'delete' | 'reset';
    logContext: {
        playerId: string;
        actionId: string;
        actionKind: string;
        markerBefore: string;
        markerAfter: string;
        resolved: boolean;
    };
    recoveryResult: OnlineAiLegalActionRecoveryResult;
};

export function finalizeOnlineAiAppliedLegalActionRecovery(args: {
    recoveryResult: OnlineAiLegalActionRecoveryResult;
    resolution: AiResolution;
    beforeTrackerSnapshot: { progressMarker: string };
    afterTrackerSnapshot: { progressMarker: string };
    resolved: boolean;
}): OnlineAiAppliedLegalActionFinalizationDecision {
    return {
        trackerDisposition: args.resolved ? 'delete' : 'reset',
        logContext: {
            playerId: args.resolution.playerId,
            actionId: args.resolution.action.actionId,
            actionKind: args.resolution.action.kind,
            markerBefore: args.beforeTrackerSnapshot.progressMarker,
            markerAfter: args.afterTrackerSnapshot.progressMarker,
            resolved: args.resolved,
        },
        recoveryResult: {
            ...args.recoveryResult,
            resolved: args.resolved,
        },
    };
}

export function shouldPauseOnlineAiRecoveryAfterOverlayResync(args: {
    currentCandidateReason: ForceEndTurnStalledAiResolution['reason'];
    currentCandidateLegalActionOnly: boolean;
    blockedFailureReason: OnlineAiRecoveryBlockedFailureReason | null;
    usedForcedRecoveryCommand: boolean;
    lastForcedReason: ForceEndTurnStalledAiResolution['reason'] | null;
    rootCandidateReason: ForceEndTurnStalledAiResolution['reason'];
}): boolean {
    return args.currentCandidateReason === 'active-turn'
        && args.currentCandidateLegalActionOnly !== true
        && args.blockedFailureReason != null
        && args.usedForcedRecoveryCommand
        && isOnlineAiInteractionRecoveryReason(args.lastForcedReason ?? args.rootCandidateReason);
}

export function resolveOnlineAiRecoveryPauseDecision(args: {
    state: MatchState<unknown>;
    candidate: ForceEndTurnStalledAiResolution;
    rootCandidateReason: ForceEndTurnStalledAiResolution['reason'];
    blockedFailureReason: OnlineAiRecoveryBlockedFailureReason | null;
    forcedCommandProgress: OnlineAiRecoveryForcedCommandProgress;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): OnlineAiRecoveryPauseDecision {
    const shouldPause = shouldPauseOnlineAiRecoveryAfterOverlayResync({
        currentCandidateReason: args.candidate.reason,
        currentCandidateLegalActionOnly: args.candidate.legalActionOnly === true,
        blockedFailureReason: args.blockedFailureReason,
        usedForcedRecoveryCommand: args.forcedCommandProgress.usedForcedRecoveryCommand,
        lastForcedReason: args.forcedCommandProgress.lastForcedReason,
        rootCandidateReason: args.rootCandidateReason,
    });
    if (!shouldPause) {
        return { kind: 'continue' };
    }

    return {
        kind: 'pause',
        nextTrackerKey: buildOnlineAiRecoveryTrackerSnapshot({
            state: args.state,
            candidate: args.candidate,
            engineConfig: args.engineConfig,
        }).trackerKey,
    };
}

export function shouldFallbackToRecoveryCommandAfterLegalActionAttempt(args: {
    allowForceCommandAfterLegalActionExhausted: boolean;
    currentCandidateLegalActionOnly: boolean;
    actionRecoveryOutcome: OnlineAiLegalActionRecoveryResult['outcome'];
    recoveryCommandCount: number;
}): boolean {
    return args.allowForceCommandAfterLegalActionExhausted === true
        && args.currentCandidateLegalActionOnly === true
        && args.actionRecoveryOutcome === 'no-legal-action'
        && args.recoveryCommandCount > 0;
}

export function resolveOnlineAiLegalActionUnavailableReason(args: {
    blockedFailureReason: OnlineAiRecoveryBlockedFailureReason | null;
    actionRecovery: OnlineAiLegalActionRecoveryResult;
    formatCommandFailureReason: (
        reason: string,
        failedCommandType?: string,
        commandFailureReason?: string | null,
    ) => string;
}): string {
    return args.blockedFailureReason
        ?? (args.actionRecovery.outcome === 'legal-action-command-failed'
            ? args.formatCommandFailureReason(
                'legal_action_command_failed',
                args.actionRecovery.failedCommandType,
                args.actionRecovery.commandFailureReason,
            )
            : 'legal_action_unavailable');
}

export type OnlineAiForcedRecoveryCommandDecision =
    | {
        kind: 'report-legal-action-command-failed';
        failureReason: string;
    }
    | {
        kind: 'report-legal-action-unavailable';
        failureReason: string;
    }
    | {
        kind: 'advance-guard-blocked';
    }
    | {
        kind: 'execute-forced-command';
        commandType: string;
        commandPayload: unknown;
        shouldCountAdvanceStep: boolean;
    };

export function resolveOnlineAiForcedRecoveryCommandDecision(args: {
    currentCandidate: ForceEndTurnStalledAiResolution;
    actionRecovery: OnlineAiLegalActionRecoveryResult;
    blockedFailureReason: OnlineAiRecoveryBlockedFailureReason | null;
    recoveryCommands: Array<{ type?: string; payload?: unknown }>;
    advancePhaseCommandType: string;
    state: MatchState<unknown>;
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    allowForceCommandAfterActiveTurnNoProgress: boolean;
    formatCommandFailureReason: (
        reason: string,
        failedCommandType?: string,
        commandFailureReason?: string | null,
    ) => string;
}): OnlineAiForcedRecoveryCommandDecision {
    const canFallbackToRecoveryCommandAfterActiveTurnNoProgress =
        args.currentCandidate.reason === 'active-turn'
        && args.currentCandidate.legalActionOnly !== true
        && args.actionRecovery.outcome === 'legal-action-command-failed'
        && !args.actionRecovery.failedCommandType
        && args.recoveryCommands.length > 0
        && !hasHumanResponderInCurrentWindow(args.state, args.seatControllers)
        && args.allowForceCommandAfterActiveTurnNoProgress;
    if (args.actionRecovery.outcome === 'legal-action-command-failed'
        && !canFallbackToRecoveryCommandAfterActiveTurnNoProgress) {
        return {
            kind: 'report-legal-action-command-failed',
            failureReason: args.formatCommandFailureReason(
                'legal_action_command_failed',
                args.actionRecovery.failedCommandType,
                args.actionRecovery.commandFailureReason,
            ),
        };
    }

    const canFallbackToRecoveryCommandAfterLegalActionAttempt =
        shouldFallbackToRecoveryCommandAfterLegalActionAttempt({
            allowForceCommandAfterLegalActionExhausted:
                args.currentCandidate.allowForceCommandAfterLegalActionExhausted === true,
            currentCandidateLegalActionOnly: args.currentCandidate.legalActionOnly === true,
            actionRecoveryOutcome: args.actionRecovery.outcome,
            recoveryCommandCount: args.recoveryCommands.length,
        });
    if ((args.currentCandidate.legalActionOnly === true
        && !canFallbackToRecoveryCommandAfterLegalActionAttempt)
        || args.recoveryCommands.length === 0) {
        return {
            kind: 'report-legal-action-unavailable',
            failureReason: resolveOnlineAiLegalActionUnavailableReason({
                blockedFailureReason: args.blockedFailureReason,
                actionRecovery: args.actionRecovery,
                formatCommandFailureReason: args.formatCommandFailureReason,
            }),
        };
    }

    const nextCommand = mapOnlineAiRecoveryCommand({
        command: args.recoveryCommands[0],
        advancePhaseCommandType: args.advancePhaseCommandType,
    });
    if (nextCommand.type === args.advancePhaseCommandType
        && !canExecuteOnlineAiWatchdogAdvancePhase({
            state: args.state,
            seatControllers: args.seatControllers,
            playerId: args.currentCandidate.playerId,
            engineConfig: args.engineConfig,
        })) {
        return {
            kind: 'advance-guard-blocked',
        };
    }

    return {
        kind: 'execute-forced-command',
        commandType: nextCommand.type,
        commandPayload: nextCommand.payload,
        shouldCountAdvanceStep: nextCommand.type === args.advancePhaseCommandType,
    };
}

export function resolveOnlineAiForcedRecoveryCommandDecisionFromRuntime(args: {
    gameId: string;
    state: MatchState<unknown>;
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    currentCandidate: ForceEndTurnStalledAiResolution;
    actionRecovery: OnlineAiLegalActionRecoveryResult;
    blockedFailureReason: OnlineAiRecoveryBlockedFailureReason | null;
    resolveForceCommandAllowance: OnlineAiRecoveryForceCommandAllowanceResolver;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    formatCommandFailureReason: (
        reason: string,
        failedCommandType?: string,
        commandFailureReason?: string | null,
    ) => string;
}): OnlineAiForcedRecoveryCommandDecision {
    return resolveOnlineAiForcedRecoveryCommandDecision({
        currentCandidate: args.currentCandidate,
        actionRecovery: args.actionRecovery,
        blockedFailureReason: args.blockedFailureReason,
        recoveryCommands: args.currentCandidate.resolution.action.commands,
        advancePhaseCommandType: resolveOnlineAiWatchdogAdvancePhaseCommandType({
            engineConfig: args.engineConfig,
        }),
        state: args.state,
        seatControllers: args.seatControllers,
        engineConfig: args.engineConfig,
        allowForceCommandAfterActiveTurnNoProgress: resolveOnlineAiRecoveryForceCommandAllowance({
            state: args.state,
            previousCandidate: args.currentCandidate,
            nextCandidate: args.currentCandidate,
            resolveRequested: args.resolveForceCommandAllowance,
        }),
        formatCommandFailureReason: args.formatCommandFailureReason,
    });
}

export function resolveOnlineAiForcedCommandExecutionFailureReason(args: {
    commandType: string;
    commandFailureReason?: string | null;
    formatCommandFailureReason: (
        reason: string,
        failedCommandType?: string,
        commandFailureReason?: string | null,
    ) => string;
}): string {
    return args.formatCommandFailureReason(
        'command_failed',
        args.commandType,
        args.commandFailureReason,
    );
}

export function resolveOnlineAiForcedRecoveryFailureDispatchDecision(args: {
    forcedRecoveryCommandDecision: OnlineAiForcedRecoveryCommandDecision;
    currentCandidate: ForceEndTurnStalledAiResolution;
    currentPhaseLabel: 'recover-interaction' | 'follow-up-advance';
    commandExecutionSucceeded?: boolean;
    commandFailureReason?: string | null;
    formatCommandFailureReason: (
        reason: string,
        failedCommandType?: string,
        commandFailureReason?: string | null,
    ) => string;
}): OnlineAiRecoveryFailureDispatchDecision {
    if (args.forcedRecoveryCommandDecision.kind === 'report-legal-action-command-failed'
        || args.forcedRecoveryCommandDecision.kind === 'report-legal-action-unavailable') {
        return {
            kind: 'report-failure',
            candidate: args.currentCandidate,
            phaseLabel: args.currentPhaseLabel,
            reason: args.forcedRecoveryCommandDecision.failureReason,
        };
    }

    if (args.forcedRecoveryCommandDecision.kind === 'advance-guard-blocked') {
        return {
            kind: 'report-failure',
            candidate: args.currentCandidate,
            phaseLabel: args.currentPhaseLabel,
            reason: 'advance_guard_blocked',
            shouldRevalidateCandidate: false,
        };
    }

    if (args.commandExecutionSucceeded === false) {
        return {
            kind: 'report-failure',
            candidate: args.currentCandidate,
            phaseLabel: args.currentPhaseLabel,
            reason: resolveOnlineAiForcedCommandExecutionFailureReason({
                commandType: args.forcedRecoveryCommandDecision.commandType,
                commandFailureReason: args.commandFailureReason,
                formatCommandFailureReason: args.formatCommandFailureReason,
            }),
        };
    }

    return {
        kind: 'none',
    };
}

export function buildOnlineAiRecoveryResolvedLegalActionFeedbackMetadata(args: {
    matchId: string;
    gameId: string;
    trackerKey: string;
    progressMarker: string;
    action: OnlineAiRecoveryReportedLegalAction;
}): OnlineAiRecoveryResolvedFeedbackMetadata {
    return {
        matchId: args.matchId,
        gameId: args.gameId,
        playerId: args.action.playerId,
        incidentKind: 'legal-action-recovered',
        severity: 'medium',
        status: 'resolved',
        reason: buildOnlineAiRecoveryResolvedLegalActionReason(args.action),
        trackerKey: args.trackerKey,
        progressMarker: args.progressMarker,
    };
}

export function resolveOnlineAiRecoverySuccessFeedbackDecision(args: {
    forcedCommandProgress: OnlineAiRecoveryForcedCommandProgress;
    sequenceProgress: OnlineAiRecoverySequenceProgress;
    matchId: string;
    gameId: string;
    trackerKey: string;
    progressMarker: string;
    rootPlayerId: string;
    fallbackReason: ForceEndTurnStalledAiResolution['reason'];
    fallbackPhaseLabel: 'recover-interaction' | 'follow-up-advance';
}): OnlineAiRecoverySuccessFeedbackDecision {
    if (!args.forcedCommandProgress.usedForcedRecoveryCommand && args.sequenceProgress.lastUnreportedLegalActionRecovery) {
        return {
            kind: 'report',
            metadata: buildOnlineAiRecoveryResolvedLegalActionFeedbackMetadata({
                matchId: args.matchId,
                gameId: args.gameId,
                trackerKey: args.trackerKey,
                progressMarker: args.progressMarker,
                action: args.sequenceProgress.lastUnreportedLegalActionRecovery,
            }),
        };
    }

    if (!args.forcedCommandProgress.usedForcedRecoveryCommand) {
        return {
            kind: 'none',
        };
    }

    return {
        kind: 'report',
        metadata: buildOnlineAiRecoveryForcedSuccessFeedbackMetadata({
            matchId: args.matchId,
            gameId: args.gameId,
            playerId: args.rootPlayerId,
            trackerKey: args.trackerKey,
            progressMarker: args.progressMarker,
            fallbackReason: args.fallbackReason,
            fallbackPhaseLabel: args.fallbackPhaseLabel,
            lastForcedReason: args.forcedCommandProgress.lastForcedReason,
            lastForcedPhaseLabel: args.forcedCommandProgress.lastForcedPhaseLabel,
            totalAdvanceSteps: args.forcedCommandProgress.totalAdvanceSteps,
            totalForcedCommands: args.forcedCommandProgress.totalForcedCommands,
        }),
    };
}

export function resolveOnlineAiRecoveryForcedSuccessMetadata(args: {
    fallbackReason: ForceEndTurnStalledAiResolution['reason'];
    fallbackPhaseLabel: 'recover-interaction' | 'follow-up-advance';
    lastForcedReason: ForceEndTurnStalledAiResolution['reason'] | null;
    lastForcedPhaseLabel: 'recover-interaction' | 'follow-up-advance';
    totalAdvanceSteps: number;
    totalForcedCommands: number;
}): {
    reason: string;
    reportedReason: ForceEndTurnStalledAiResolution['reason'];
    reportedPhaseLabel: 'recover-interaction' | 'follow-up-advance';
    reportedSteps: number;
} {
    const reportedReason = args.lastForcedReason ?? args.fallbackReason;
    const reportedPhaseLabel = args.lastForcedReason ? args.lastForcedPhaseLabel : args.fallbackPhaseLabel;
    const reportedSteps = Math.max(args.totalAdvanceSteps, args.totalForcedCommands, 1);
    return {
        reason: `${reportedReason}:${reportedPhaseLabel}:steps=${reportedSteps}`,
        reportedReason,
        reportedPhaseLabel,
        reportedSteps,
    };
}

export function buildOnlineAiRecoveryForcedSuccessFeedbackMetadata(args: {
    matchId: string;
    gameId: string;
    playerId: string;
    trackerKey: string;
    progressMarker: string;
    fallbackReason: ForceEndTurnStalledAiResolution['reason'];
    fallbackPhaseLabel: 'recover-interaction' | 'follow-up-advance';
    lastForcedReason: ForceEndTurnStalledAiResolution['reason'] | null;
    lastForcedPhaseLabel: 'recover-interaction' | 'follow-up-advance';
    totalAdvanceSteps: number;
    totalForcedCommands: number;
}): OnlineAiRecoveryResolvedFeedbackMetadata {
    const forcedSuccessMetadata = resolveOnlineAiRecoveryForcedSuccessMetadata({
        fallbackReason: args.fallbackReason,
        fallbackPhaseLabel: args.fallbackPhaseLabel,
        lastForcedReason: args.lastForcedReason,
        lastForcedPhaseLabel: args.lastForcedPhaseLabel,
        totalAdvanceSteps: args.totalAdvanceSteps,
        totalForcedCommands: args.totalForcedCommands,
    });
    return {
        matchId: args.matchId,
        gameId: args.gameId,
        playerId: args.playerId,
        incidentKind: 'force-end-turn-success',
        severity: 'medium',
        status: 'resolved',
        reason: forcedSuccessMetadata.reason,
        trackerKey: args.trackerKey,
        progressMarker: args.progressMarker,
    };
}

export function buildOnlineAiRecoveryFailureFeedbackMetadata(args: {
    matchId: string;
    gameId: string;
    playerId: string;
    trackerKey: string;
    progressMarker: string;
    candidateReason: ForceEndTurnStalledAiResolution['reason'];
    phaseLabel: 'recover-interaction' | 'follow-up-advance';
    reason: string;
}): OnlineAiRecoveryFailureFeedbackMetadata {
    return {
        matchId: args.matchId,
        gameId: args.gameId,
        playerId: args.playerId,
        incidentKind: 'force-end-turn-failed',
        severity: 'high',
        reason: `${args.candidateReason}:${args.phaseLabel}:${args.reason}`,
        trackerKey: args.trackerKey,
        progressMarker: args.progressMarker,
    };
}

export function resolveOnlineAiRecoveryFollowUpDecision(args: {
    state: MatchState<unknown>;
    rootCandidate: ForceEndTurnStalledAiResolution;
    currentCandidate: ForceEndTurnStalledAiResolution;
    nextCandidate: ForceEndTurnStalledAiResolution;
    actionRecoveryApplied: boolean;
    responseWindowFingerprintBeforeStep: string | null;
    seatViewInteractionAfterStep: string | null;
    restrictFollowUpToLegalActions: boolean;
    allowForceCommandAfterLegalActionExhausted: boolean;
    executedResponsePass: boolean;
    hasLiveSeatConnection: boolean;
}): OnlineAiRecoveryFollowUpDecision {
    if (shouldAllowOnlineAiRecoveryNaturalContinuationAfterInteractionResolved({
        actionRecoveryApplied: args.actionRecoveryApplied,
        rootCandidateReason: args.rootCandidate.reason,
        currentCandidateReason: args.currentCandidate.reason,
        nextCandidateReason: args.nextCandidate.reason,
        responseWindowFingerprintBeforeStep: args.responseWindowFingerprintBeforeStep,
        seatViewInteractionAfterStep: args.seatViewInteractionAfterStep,
        restrictFollowUpToLegalActions: args.restrictFollowUpToLegalActions,
    })) {
        return { kind: 'natural-continuation' };
    }

    if (args.currentCandidate.reason === 'response-window'
        && args.executedResponsePass
        && args.nextCandidate.reason === 'response-window'
        && args.nextCandidate.playerId === args.rootCandidate.playerId) {
        const suffix = buildResponseWindowRecoveryFingerprintHint(
            args.state,
            args.rootCandidate.playerId,
            'response-loop',
        );
        return {
            kind: 'continue-with-candidate',
            candidate: {
                ...args.nextCandidate,
                reason: 'response-loop',
                fingerprintHint: suffix,
                resolution: {
                    playerId: args.rootCandidate.playerId,
                    attemptKey: `force-end-turn:${args.rootCandidate.playerId}:${suffix}`,
                    source: 'local-ai',
                    action: {
                        actionId: `force-end-turn:${suffix}`,
                        kind: 'force-end-turn',
                        label: '强制结束 AI 回合',
                        commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                    },
                },
            },
        };
    }

    const normalizedCandidate = normalizeOnlineAiRecoveryFollowUpCandidate({
        candidate: args.nextCandidate,
        restrictToLegalActions: args.restrictFollowUpToLegalActions,
        allowForceCommandAfterLegalActionExhausted: args.allowForceCommandAfterLegalActionExhausted,
    });

    if (shouldAllowOnlineAiRecoveryNaturalContinuationForLiveSeat({
        actionRecoveryApplied: args.actionRecoveryApplied,
        nextCandidateReason: normalizedCandidate.reason,
        hasLiveSeatConnection: args.hasLiveSeatConnection,
    })) {
        return { kind: 'natural-continuation' };
    }

    return {
        kind: 'continue-with-candidate',
        candidate: normalizedCandidate,
    };
}

export function resolveOnlineAiRecoveryFollowUpDecisionFromRuntime(args: {
    state: MatchState<unknown>;
    rootCandidate: ForceEndTurnStalledAiResolution;
    currentCandidate: ForceEndTurnStalledAiResolution;
    nextCandidate: ForceEndTurnStalledAiResolution;
    currentPlayerIdBeforeStep: string | null;
    currentPlayerIdAfterStep: string | null;
    actionRecoveryApplied: boolean;
    responseWindowFingerprintBeforeStep: string | null;
    seatViewInteractionAfterStep: string | null;
    executedResponsePass: boolean;
    hasHumanResponderInCurrentWindow: boolean;
    hasLiveSeatConnection: boolean;
    allowForceCommandAfterLegalActionExhaustedRequested: boolean;
}): OnlineAiRecoveryFollowUpDecision {
    const restrictFollowUpToLegalActions = shouldRestrictOnlineAiRecoveryFollowUpToLegalActions({
        rootCandidate: args.rootCandidate,
        nextCandidate: args.nextCandidate,
        currentPlayerIdBeforeStep: args.currentPlayerIdBeforeStep,
        currentPlayerIdAfterStep: args.currentPlayerIdAfterStep,
    });
    const allowForceCommandAfterLegalActionExhausted = restrictFollowUpToLegalActions
        && !args.hasHumanResponderInCurrentWindow
        && args.allowForceCommandAfterLegalActionExhaustedRequested;

    return resolveOnlineAiRecoveryFollowUpDecision({
        state: args.state,
        rootCandidate: args.rootCandidate,
        currentCandidate: args.currentCandidate,
        nextCandidate: args.nextCandidate,
        actionRecoveryApplied: args.actionRecoveryApplied,
        responseWindowFingerprintBeforeStep: args.responseWindowFingerprintBeforeStep,
        seatViewInteractionAfterStep: args.seatViewInteractionAfterStep,
        restrictFollowUpToLegalActions,
        allowForceCommandAfterLegalActionExhausted,
        executedResponsePass: args.executedResponsePass,
        hasLiveSeatConnection: args.hasLiveSeatConnection,
    });
}

export function resolveOnlineAiRecoveryFollowUpTransition(args: {
    state: MatchState<unknown>;
    followUpDecision: OnlineAiRecoveryFollowUpDecision;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): OnlineAiRecoveryFollowUpTransitionDecision {
    if (args.followUpDecision.kind === 'natural-continuation') {
        return { kind: 'natural-continuation' };
    }

    const candidate = args.followUpDecision.candidate;
    return {
        kind: 'continue-with-candidate',
        candidate,
        nextTrackerKey: candidate.legalActionOnly === true
            ? buildOnlineAiRecoveryTrackerSnapshot({
                state: args.state,
                candidate,
                engineConfig: args.engineConfig,
            }).trackerKey
            : null,
    };
}

export function resolveOnlineAiRecoveryFollowUpTransitionFromRuntime(args: {
    state: MatchState<unknown>;
    rootCandidate: ForceEndTurnStalledAiResolution;
    currentCandidate: ForceEndTurnStalledAiResolution;
    nextCandidate: ForceEndTurnStalledAiResolution;
    currentPlayerIdBeforeStep: string | null;
    currentPlayerIdAfterStep: string | null;
    actionRecoveryApplied: boolean;
    responseWindowFingerprintBeforeStep: string | null;
    seatViewInteractionAfterStep: string | null;
    executedResponsePass: boolean;
    hasHumanResponderInCurrentWindow: boolean;
    hasLiveSeatConnection: boolean;
    allowForceCommandAfterLegalActionExhaustedRequested: boolean;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): OnlineAiRecoveryFollowUpTransitionDecision {
    return resolveOnlineAiRecoveryFollowUpTransition({
        state: args.state,
        followUpDecision: resolveOnlineAiRecoveryFollowUpDecisionFromRuntime(args),
        engineConfig: args.engineConfig,
    });
}

export function resolveOnlineAiRecoveryCompletionDecision(args: {
    rootPlayerId: string;
    unresolvedCandidatePlayerId: string | null;
    markerAfterRecovery: string;
    progressMarkerBeforeRecovery: string;
}): OnlineAiRecoveryCompletionDecision {
    if (args.unresolvedCandidatePlayerId === args.rootPlayerId) {
        return {
            kind: 'fail',
            reason: 'blocker_persisted',
        };
    }

    if (args.markerAfterRecovery === args.progressMarkerBeforeRecovery) {
        return {
            kind: 'fail',
            reason: 'no_progress',
        };
    }

    return { kind: 'success' };
}

export function resolveOnlineAiRecoveryCompletionFailureDispatchDecision(args: {
    rootPlayerId: string;
    unresolvedCandidate: ForceEndTurnStalledAiResolution | null;
    markerAfterRecovery: string;
    progressMarkerBeforeRecovery: string;
    currentCandidate: ForceEndTurnStalledAiResolution;
    currentPhaseLabel: 'recover-interaction' | 'follow-up-advance';
}): OnlineAiRecoveryFailureDispatchDecision {
    const completionDecision = resolveOnlineAiRecoveryCompletionDecision({
        rootPlayerId: args.rootPlayerId,
        unresolvedCandidatePlayerId: args.unresolvedCandidate?.playerId ?? null,
        markerAfterRecovery: args.markerAfterRecovery,
        progressMarkerBeforeRecovery: args.progressMarkerBeforeRecovery,
    });

    return resolveOnlineAiRecoveryFailureDispatchDecision({
        completionDecision,
        currentCandidate: args.currentCandidate,
        unresolvedCandidate: args.unresolvedCandidate,
        currentPhaseLabel: args.currentPhaseLabel,
    });
}

export function resolveOnlineAiRecoveryFailureDispatchDecision(args: {
    stepBookkeepingDecision?: OnlineAiWatchdogStepBookkeepingDecision | null;
    completionDecision?: OnlineAiRecoveryCompletionDecision | null;
    currentCandidate: ForceEndTurnStalledAiResolution;
    unresolvedCandidate?: ForceEndTurnStalledAiResolution | null;
    currentPhaseLabel: 'recover-interaction' | 'follow-up-advance';
}): OnlineAiRecoveryFailureDispatchDecision {
    if (args.stepBookkeepingDecision?.kind === 'fail') {
        return {
            kind: 'report-failure',
            candidate: args.currentCandidate,
            phaseLabel: args.currentPhaseLabel,
            reason: args.stepBookkeepingDecision.reason,
        };
    }

    if (args.completionDecision?.kind !== 'fail') {
        return { kind: 'none' };
    }

    if (args.completionDecision.reason === 'blocker_persisted' && args.unresolvedCandidate) {
        return {
            kind: 'report-failure',
            candidate: args.unresolvedCandidate,
            phaseLabel: resolveOnlineAiRecoveryPhaseLabel(args.unresolvedCandidate),
            reason: args.completionDecision.reason,
        };
    }

    return {
        kind: 'report-failure',
        candidate: args.currentCandidate,
        phaseLabel: args.currentPhaseLabel,
        reason: args.completionDecision.reason,
    };
}

export function didOnlineAiRecoveryTrackerSnapshotProgress(args: {
    before: { progressMarker: string; recoveryFingerprint: string };
    after: { progressMarker: string; recoveryFingerprint: string };
}): boolean {
    return args.after.progressMarker !== args.before.progressMarker
        || args.after.recoveryFingerprint !== args.before.recoveryFingerprint;
}

export function resolveLegalOnlyRecoveryResolved(args: {
    candidate: ForceEndTurnStalledAiResolution;
    nextCandidate: ForceEndTurnStalledAiResolution | null;
}): boolean {
    const { candidate, nextCandidate } = args;
    if (!nextCandidate || nextCandidate.playerId !== candidate.playerId) {
        return true;
    }
    if (nextCandidate.legalActionOnly !== true) {
        if (
            nextCandidate.reason === candidate.reason
            && typeof candidate.fingerprintHint === 'string'
            && candidate.fingerprintHint.length > 0
            && nextCandidate.fingerprintHint === candidate.fingerprintHint
        ) {
            return false;
        }
        return nextCandidate.reason !== 'response-window' && nextCandidate.reason !== 'response-loop';
    }
    if (nextCandidate.reason !== candidate.reason) {
        return true;
    }
    if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
        return nextCandidate.fingerprintHint !== candidate.fingerprintHint;
    }
    return false;
}

export function resolveActiveTurnRecoveryResolved(args: {
    playerId: string;
    nextCandidate: ForceEndTurnStalledAiResolution | null;
}): boolean {
    return !args.nextCandidate
        || args.nextCandidate.playerId !== args.playerId
        || args.nextCandidate.reason !== 'active-turn';
}

export function resolveVisibleInteractionRecoveryResolved(args: {
    candidate: ForceEndTurnStalledAiResolution;
    currentPlayerId: string | null;
    currentFingerprint: string | null;
}): boolean {
    if (typeof args.candidate.fingerprintHint === 'string' && args.candidate.fingerprintHint.length > 0) {
        if (args.currentFingerprint !== args.candidate.fingerprintHint) {
            return true;
        }
    }
    return args.currentPlayerId !== args.candidate.playerId;
}

export function readVisibleInteractionRecoveryLiveState(args: {
    state: MatchState<unknown>;
    playerId: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): {
    currentPlayerId: string | null;
    currentFingerprint: string | null;
} {
    const current = (args.state.sys?.interaction as { current?: { playerId?: unknown } } | undefined)?.current;
    return {
        currentPlayerId: typeof current?.playerId === 'string' ? current.playerId : null,
        currentFingerprint: current
            ? buildInteractionRecoveryFingerprintHint(
                args.state,
                current as HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction,
                args.playerId,
                { engineConfig: args.engineConfig },
            )
            : null,
    };
}

export function resolveHiddenInteractionRecoveryResolved(args: {
    candidate: ForceEndTurnStalledAiResolution;
    sharedPlayerId: string | null;
    sharedFingerprint: string | null;
    seatPlayerId: string | null;
    seatFingerprint: string | null;
    seatBlocked: boolean;
}): boolean {
    if (args.sharedPlayerId) {
        if (typeof args.candidate.fingerprintHint === 'string' && args.candidate.fingerprintHint.length > 0) {
            if (args.sharedFingerprint !== args.candidate.fingerprintHint) {
                return true;
            }
        }
        if (args.sharedPlayerId === args.candidate.playerId) {
            return false;
        }
    }

    if (args.seatPlayerId) {
        if (typeof args.candidate.fingerprintHint === 'string' && args.candidate.fingerprintHint.length > 0) {
            if (args.seatFingerprint !== args.candidate.fingerprintHint) {
                return true;
            }
        }
        return args.seatPlayerId !== args.candidate.playerId;
    }

    return !args.seatBlocked;
}

export function readHiddenInteractionRecoveryLiveState(args: {
    sharedState: MatchState<unknown>;
    seatState: MatchState<unknown>;
    playerId: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): {
    sharedPlayerId: string | null;
    sharedFingerprint: string | null;
    seatPlayerId: string | null;
    seatFingerprint: string | null;
    seatBlocked: boolean;
} {
    const sharedInteraction = args.sharedState.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
    const seatInteraction = args.seatState.sys?.interaction as { current?: { playerId?: unknown }; isBlocked?: unknown } | undefined;
    const sharedCurrent = sharedInteraction?.current as { playerId?: unknown } | undefined;
    return {
        sharedPlayerId: typeof sharedCurrent?.playerId === 'string' ? sharedCurrent.playerId : null,
        sharedFingerprint: sharedInteraction?.current
            ? buildInteractionRecoveryFingerprintHint(
                args.sharedState,
                sharedInteraction.current as HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction,
                args.playerId,
                { engineConfig: args.engineConfig },
            )
            : null,
        seatPlayerId: typeof seatInteraction?.current?.playerId === 'string' ? seatInteraction.current.playerId : null,
        seatFingerprint: seatInteraction?.current
            ? buildInteractionRecoveryFingerprintHint(
                args.seatState,
                seatInteraction.current as HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction,
                args.playerId,
                { engineConfig: args.engineConfig },
            )
            : null,
        seatBlocked: seatInteraction?.isBlocked === true,
    };
}

export function resolveResponseWindowRecoveryResolved(args: {
    candidate: ForceEndTurnStalledAiResolution;
    currentFingerprint: string | null;
    responderId: string | null;
    responderIsHuman: boolean;
}): boolean {
    if (!args.responderId) {
        return false;
    }
    if (typeof args.candidate.fingerprintHint === 'string' && args.candidate.fingerprintHint.length > 0) {
        if (args.currentFingerprint !== args.candidate.fingerprintHint) {
            return true;
        }
    }
    return args.responderId !== args.candidate.playerId || args.responderIsHuman;
}

export function readResponseWindowRecoveryLiveState(args: {
    state: MatchState<unknown>;
    playerId: string;
    reason: 'response-window' | 'response-loop';
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
}): {
    responderId: string | null;
    responderIsHuman: boolean;
    currentFingerprint: string | null;
} {
    const current = (args.state.sys?.responseWindow as {
        current?: {
            responderQueue?: unknown;
            currentResponderIndex?: unknown;
        };
    } | undefined)?.current;
    if (!current) {
        return {
            responderId: null,
            responderIsHuman: false,
            currentFingerprint: null,
        };
    }

    const responderQueue = Array.isArray(current.responderQueue) ? current.responderQueue : [];
    const responderIndex = typeof current.currentResponderIndex === 'number' ? current.currentResponderIndex : 0;
    const responderId = typeof responderQueue[responderIndex] === 'string' ? responderQueue[responderIndex] : '';
    return {
        responderId: responderId || null,
        responderIsHuman: responderId.length > 0 && args.seatControllers[responderId]?.type === 'human',
        currentFingerprint: buildResponseWindowRecoveryFingerprintHint(
            args.state,
            args.playerId,
            args.reason,
        ),
    };
}

export function syncOnlineAiRecoveryTrackerKey(
    tracker: OnlineAiRecoveryTracker,
    nextTrackerKey: string,
): void {
    if (tracker.key === nextTrackerKey) {
        return;
    }
    tracker.key = nextTrackerKey;
    tracker.lastReportedFailureReason = null;
    tracker.failureCount = 0;
}
