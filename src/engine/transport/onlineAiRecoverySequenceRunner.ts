import type { MatchState } from '../types';
import { INTERACTION_COMMANDS } from '../systems/InteractionSystem';
import type { GameEngineConfig } from './engineConfig';
import {
    buildAiProgressMarker,
    resolveForceAdvancePhaseAfterRecovery,
    resolveOnlineAiCurrentPlayerId,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';
import {
    createOnlineAiActionDelayContext,
    type OnlineAiActionDelayContext,
} from './onlineAiActionDelay';
import { formatOnlineAiCommandFailureReason } from './commandFailureReason';
import {
    buildOnlineAiRecoverySequenceStepKey,
    buildOnlineAiRecoveryTrackerSnapshot,
} from './onlineAiWatchdogSequenceFingerprinting';
import {
    resolveChainedOnlineAiRecoveryCandidate,
    resolveRevalidatedOnlineAiRecoveryCandidateFromLiveState,
} from './onlineAiWatchdogCandidateValidation';
import { resolveOnlineAiWatchdogStepBookkeeping } from './onlineAiWatchdogStepBookkeeping';
import type { OnlineAiRepeatedRecoveryAttempt } from './onlineAiRepeatedRecoveryUnblockExecutor';
import type { OnlineAiWatchdogSeatController } from './onlineAiWatchdogSeatControllers';
import type { OnlineAiRecoveryTracker } from './onlineAiWatchdogTracker';
import {
    buildManualForceAdvanceAfterConfirmedRollCandidate,
    buildManualImmediateAiContinuationCandidate,
    buildOnlineAiRecoveryFollowUpRuntimeSnapshot,
    buildOnlineAiRecoveryStepAfterSnapshot,
    buildOnlineAiRecoveryStepBeforeSnapshot,
    isManualOnlineAiRecoveryContinuationCandidate,
    isOnlineAiInteractionRecoveryReason,
    resolveOnlineAiForcedRecoveryCommandDecisionFromRuntime,
    resolveOnlineAiForcedRecoveryFailureDispatchDecision,
    resolveOnlineAiHardCancelDecisionFromRuntime,
    resolveOnlineAiLegacyResponseWindowMirrorClearDecision,
    resolveOnlineAiRecoveryBlockedFailureReason,
    resolveOnlineAiRecoveryCompletionFailureDispatchDecision,
    resolveOnlineAiRecoveryFollowUpTransitionFromRuntime,
    resolveOnlineAiRecoveryPauseDecision,
    resolveOnlineAiRecoveryPhaseLabel,
    resolveOnlineAiRecoverySuccessFeedbackDecision,
    shouldPreserveManualHumanResponseWindowForceClose,
    syncOnlineAiRecoveryTrackerKey,
    type OnlineAiLegalActionRecoveryResult,
    type OnlineAiRecoveryResolvedFeedbackMetadata,
} from './onlineAiWatchdogSequenceHelpers';

export type OnlineAiRecoveryPhaseLabel = ReturnType<typeof resolveOnlineAiRecoveryPhaseLabel>;

export type OnlineAiRecoverySequenceMatch = {
    matchID: string;
    gameId: string;
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    stateID: number;
    unloaded?: boolean;
};

export type OnlineAiRecoverySequenceRoomRuntime = {
    isExecuting: () => boolean;
    tryBeginExecution: () => boolean;
    finishExecution: () => void;
    drainCommandQueueIfLoaded: () => Promise<void>;
};

export type OnlineAiRecoverySequenceExecutionTrace = {
    matchId: string;
    gameId: string;
    playerId: string;
    stateIdBefore: number;
    candidateReason: ForceEndTurnStalledAiResolution['reason'] | 'immediate-ai';
    decisionMs: number;
    executionMs: number;
    actionKind: string | null;
    commandTypes: string[];
    outcome: string;
    blockedReason?: string | null;
    commandFailureReason?: string | null;
};

export type OnlineAiRecoverySequenceRunnerHooks<TMatch extends OnlineAiRecoverySequenceMatch> = {
    createRoomRuntime: (match: TMatch) => OnlineAiRecoverySequenceRoomRuntime;
    resolveRecoveryCandidate: (
        match: TMatch,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ) => Promise<ForceEndTurnStalledAiResolution | null>;
    tryRecoverWithLegalAction: (args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        tracker: OnlineAiRecoveryTracker;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
        delayContext: OnlineAiActionDelayContext;
    }) => Promise<OnlineAiLegalActionRecoveryResult>;
    executeRecoveryCommand: (args: {
        match: TMatch;
        playerId: string;
        commandType: string;
        commandPayload: unknown;
    }) => Promise<boolean>;
    getLastCommandFailureReason: (match: TMatch) => string | null | undefined;
    clearRecoveryProgress: (matchId: string) => void;
    clearTracker: (matchId: string) => void;
    setTracker: (matchId: string, tracker: OnlineAiRecoveryTracker) => void;
    recordRepeatedAttempt: (matchId: string, trackerKey: string) => OnlineAiRepeatedRecoveryAttempt;
    clearStateBaselines: (match: TMatch) => void;
    persistState: (match: TMatch) => Promise<void>;
    broadcastState: (match: TMatch) => void;
    resolvePrivateOverlay: (match: TMatch, playerId: string) => MatchState<unknown>;
    handleRecoveryFailure: (args: {
        match: TMatch;
        tracker: OnlineAiRecoveryTracker;
        candidate: ForceEndTurnStalledAiResolution;
        phaseLabel: OnlineAiRecoveryPhaseLabel;
        progressMarkerBeforeRecovery: string;
        reason: string;
    }) => Promise<void>;
    reportRecoverySuccessFeedback: (args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarkerBeforeRecovery: string;
        metadata: OnlineAiRecoveryResolvedFeedbackMetadata;
    }) => Promise<void>;
    logExecutionTrace: (trace: OnlineAiRecoverySequenceExecutionTrace) => void;
    logLegacyResponseWindowMirrorCleared: (args: {
        match: TMatch;
        playerId: string;
        sourceId: string;
    }) => void;
    logRecoveredStalledAi: (args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        totalAdvanceSteps: number;
        repeatedAttemptCount: number;
        markerBefore: string;
        markerAfter: string;
    }) => void;
};

export type OnlineAiRecoverySequenceRunnerConfig<TMatch extends OnlineAiRecoverySequenceMatch> = {
    maxAdvanceSteps: number;
    maxStepsPerSlice: number;
    hooks: OnlineAiRecoverySequenceRunnerHooks<TMatch>;
};

export class OnlineAiRecoverySequenceRunner<TMatch extends OnlineAiRecoverySequenceMatch> {
    private readonly maxAdvanceSteps: number;
    private readonly maxStepsPerSlice: number;
    private readonly hooks: OnlineAiRecoverySequenceRunnerHooks<TMatch>;

    constructor(config: OnlineAiRecoverySequenceRunnerConfig<TMatch>) {
        this.maxAdvanceSteps = config.maxAdvanceSteps;
        this.maxStepsPerSlice = config.maxStepsPerSlice;
        this.hooks = config.hooks;
    }

    async run(args: {
        match: TMatch;
        tracker: OnlineAiRecoveryTracker;
        candidate: ForceEndTurnStalledAiResolution;
        progressMarkerBeforeRecovery: string;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
        options?: { reuseExecutionLock?: boolean; allowManualImmediateAiContinuation?: boolean };
    }): Promise<void> {
        const {
            match,
            tracker,
            candidate,
            progressMarkerBeforeRecovery,
            seatControllers,
            options,
        } = args;
        if (match.unloaded) {
            tracker.autoSubmittedAt = null;
            return;
        }

        const reuseExecutionLock = options?.reuseExecutionLock === true;
        const roomRuntime = this.hooks.createRoomRuntime(match);
        if (roomRuntime.isExecuting() && !reuseExecutionLock) {
            tracker.autoSubmittedAt = null;
            return;
        }

        if (!reuseExecutionLock && !roomRuntime.tryBeginExecution()) {
            tracker.autoSubmittedAt = null;
            return;
        }

        const resolveChainedRecoveryCandidate = async (expectedPlayerId: string): Promise<ForceEndTurnStalledAiResolution | null> => {
            const nextCandidate = await this.hooks.resolveRecoveryCandidate(match, seatControllers);
            return resolveChainedOnlineAiRecoveryCandidate(nextCandidate, expectedPlayerId);
        };
        const resolveWatchdogCurrentPlayerId = (): string | null => resolveOnlineAiCurrentPlayerId(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const revalidateRecoveryCandidate = async (
            expectedCandidate: ForceEndTurnStalledAiResolution,
        ): Promise<ForceEndTurnStalledAiResolution | null> => {
            let rawLatestCandidate = await this.hooks.resolveRecoveryCandidate(match, seatControllers);
            if (!rawLatestCandidate && shouldPreserveManualHumanResponseWindowForceClose({
                state: match.state,
                expectedCandidate,
                seatControllers,
                currentPlayerId: resolveWatchdogCurrentPlayerId(),
            })) {
                rawLatestCandidate = expectedCandidate;
            }
            const latestProgressMarker = buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            const revalidatedCandidate = resolveRevalidatedOnlineAiRecoveryCandidateFromLiveState({
                rawLatestCandidate,
                expectedCandidate,
                expectedTrackerKey: tracker.key,
                state: match.state,
                progressMarker: latestProgressMarker,
                engineConfig: match.engineConfig,
            });
            if (!revalidatedCandidate) {
                this.hooks.clearTracker(match.matchID);
                tracker.autoSubmittedAt = null;
                return null;
            }

            return revalidatedCandidate;
        };
        const syncRecoveryTrackerToCandidate = (
            nextCandidate: ForceEndTurnStalledAiResolution,
        ): void => {
            const snapshot = buildOnlineAiRecoveryTrackerSnapshot({
                state: match.state,
                candidate: nextCandidate,
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            syncOnlineAiRecoveryTrackerKey(tracker, snapshot.trackerKey);
        };
        const clearConfiguredLegacyResponseWindowMirror = async (
            currentCandidate: ForceEndTurnStalledAiResolution,
        ): Promise<boolean> => {
            const clearDecision = resolveOnlineAiLegacyResponseWindowMirrorClearDecision({
                state: match.state,
                legacySourceIds: match.engineConfig.onlineAiRecovery?.legacyResponseWindowMirrorSourceIds ?? [],
            });
            if (clearDecision.kind !== 'clear') {
                return false;
            }

            match.state = {
                ...match.state,
                sys: {
                    ...match.state.sys,
                    responseWindow: {
                        ...(match.state.sys?.responseWindow ?? {}),
                        current: undefined,
                    },
                },
            };
            match.stateID += 1;
            this.hooks.clearStateBaselines(match);
            await this.hooks.persistState(match);
            this.hooks.broadcastState(match);
            this.hooks.logLegacyResponseWindowMirrorCleared({
                match,
                playerId: currentCandidate.playerId,
                sourceId: clearDecision.sourceId,
            });
            return true;
        };

        let currentCandidate = candidate;
        let phaseLabel: OnlineAiRecoveryPhaseLabel = resolveOnlineAiRecoveryPhaseLabel(currentCandidate);
        let totalAdvanceSteps = 0;
        let totalForcedCommands = 0;
        let usedForcedRecoveryCommand = false;
        let lastForcedReason: ForceEndTurnStalledAiResolution['reason'] | null = null;
        let lastForcedPhaseLabel: OnlineAiRecoveryPhaseLabel = phaseLabel;

        const tryHardCancelCurrentAiInteraction = async (
            candidateToCancel: ForceEndTurnStalledAiResolution,
        ): Promise<boolean> => {
            const hardCancelDecision = resolveOnlineAiHardCancelDecisionFromRuntime({
                state: match.state,
                candidate: candidateToCancel,
                seatControllers,
            });
            if (hardCancelDecision.kind !== 'cancel') {
                return false;
            }

            usedForcedRecoveryCommand = true;
            totalForcedCommands += 1;
            lastForcedReason = candidateToCancel.reason;
            lastForcedPhaseLabel = phaseLabel;

            return this.hooks.executeRecoveryCommand({
                match,
                playerId: hardCancelDecision.playerId,
                commandType: INTERACTION_COMMANDS.CANCEL,
                commandPayload: {
                    interactionId: hardCancelDecision.interactionId,
                },
            });
        };

        try {
            const seenStepKeys = new Set<string>();
            const delayContext = createOnlineAiActionDelayContext();
            let recoverySteps = 0;
            let allowNaturalAiContinuation = false;
            let lastUnreportedLegalActionRecovery: {
                candidateReason: ForceEndTurnStalledAiResolution['reason'];
                playerId: string;
                actionKind: string;
                actionId: string;
            } | null = null;
            if (currentCandidate.legalActionOnly !== true) {
                const initialCandidate = await revalidateRecoveryCandidate(currentCandidate);
                if (!initialCandidate) {
                    return;
                }
                currentCandidate = initialCandidate;
            }
            seenStepKeys.add(buildOnlineAiRecoverySequenceStepKey({
                state: match.state,
                playerId: currentCandidate.playerId,
                progressMarker: progressMarkerBeforeRecovery,
                engineConfig: match.engineConfig,
            }));

            while (recoverySteps <= this.maxAdvanceSteps) {
                const canUseManualImmediateContinuationSlice =
                    isManualOnlineAiRecoveryContinuationCandidate(currentCandidate);
                if (recoverySteps >= this.maxStepsPerSlice
                    && !canUseManualImmediateContinuationSlice) {
                    syncRecoveryTrackerToCandidate(currentCandidate);
                    tracker.firstSeenAt = Date.now();
                    tracker.autoSubmittedAt = null;
                    return;
                }
                phaseLabel = resolveOnlineAiRecoveryPhaseLabel(currentCandidate);
                const stepStateIdBefore = match.stateID;
                const stepStartedAt = Date.now();
                const beforeStepSnapshot = buildOnlineAiRecoveryStepBeforeSnapshot({
                    state: match.state,
                    playerId: currentCandidate.playerId,
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
                const actionRecovery = await this.hooks.tryRecoverWithLegalAction({
                    match,
                    candidate: currentCandidate,
                    tracker,
                    seatControllers,
                    delayContext,
                });
                this.hooks.logExecutionTrace({
                    matchId: match.matchID,
                    gameId: match.gameId,
                    playerId: currentCandidate.playerId,
                    stateIdBefore: stepStateIdBefore,
                    candidateReason: currentCandidate.reason,
                    decisionMs: Date.now() - stepStartedAt,
                    executionMs: 0,
                    actionKind: actionRecovery.reportedAction?.actionKind ?? null,
                    commandTypes: actionRecovery.executedCommandTypes,
                    outcome: actionRecovery.outcome,
                    blockedReason: actionRecovery.blockedReason,
                    commandFailureReason: actionRecovery.applied ? null : actionRecovery.commandFailureReason,
                });
                const blockedFailureReason = resolveOnlineAiRecoveryBlockedFailureReason(actionRecovery.blockedReason);
                if (actionRecovery.applied && actionRecovery.reportedAction) {
                    lastUnreportedLegalActionRecovery = actionRecovery.reportedAction;
                }
                const executedCommandTypes = new Set<string>(actionRecovery.executedCommandTypes);

                if (!actionRecovery.applied) {
                    if (
                        isManualOnlineAiRecoveryContinuationCandidate(currentCandidate)
                        && actionRecovery.outcome === 'no-legal-action'
                        && currentCandidate.resolution.action.commands.length === 0
                    ) {
                        break;
                    }
                    const pauseDecision = resolveOnlineAiRecoveryPauseDecision({
                        state: match.state,
                        candidate: currentCandidate,
                        rootCandidateReason: candidate.reason,
                        blockedFailureReason,
                        forcedCommandProgress: {
                            usedForcedRecoveryCommand,
                            totalAdvanceSteps,
                            totalForcedCommands,
                            lastForcedReason,
                            lastForcedPhaseLabel,
                        },
                        engineConfig: match.engineConfig,
                        gameId: match.gameId,
                    });
                    if (pauseDecision.kind === 'pause') {
                        syncOnlineAiRecoveryTrackerKey(tracker, pauseDecision.nextTrackerKey);
                        return;
                    }
                    const forcedRecoveryCommandDecision = resolveOnlineAiForcedRecoveryCommandDecisionFromRuntime({
                        gameId: match.gameId,
                        state: match.state,
                        seatControllers,
                        currentCandidate,
                        actionRecovery,
                        blockedFailureReason,
                        resolveForceCommandAllowance: match.engineConfig.onlineAiRecovery?.allowForceCommandAfterLegalActionExhausted,
                        engineConfig: match.engineConfig,
                        formatCommandFailureReason: formatOnlineAiCommandFailureReason,
                    });
                    const forcedFailureDecision = resolveOnlineAiForcedRecoveryFailureDispatchDecision({
                        forcedRecoveryCommandDecision,
                        currentCandidate,
                        currentPhaseLabel: phaseLabel,
                        formatCommandFailureReason: formatOnlineAiCommandFailureReason,
                    });
                    if (forcedFailureDecision.kind === 'report-failure') {
                        const failureCandidate = forcedFailureDecision.shouldRevalidateCandidate === false
                            ? forcedFailureDecision.candidate
                            : await revalidateRecoveryCandidate(forcedFailureDecision.candidate);
                        if (!failureCandidate) {
                            return;
                        }
                        currentCandidate = failureCandidate;
                        await this.hooks.handleRecoveryFailure({
                            match,
                            tracker,
                            candidate: failureCandidate,
                            phaseLabel: forcedFailureDecision.phaseLabel,
                            progressMarkerBeforeRecovery,
                            reason: forcedFailureDecision.reason,
                        });
                        return;
                    }
                    if (forcedRecoveryCommandDecision.kind !== 'execute-forced-command') {
                        throw new Error(`Unhandled online AI forced recovery decision: ${forcedRecoveryCommandDecision.kind}`);
                    }
                    usedForcedRecoveryCommand = true;
                    totalForcedCommands += 1;
                    lastForcedReason = currentCandidate.reason;
                    lastForcedPhaseLabel = phaseLabel;
                    const nextSuccess = await this.hooks.executeRecoveryCommand({
                        match,
                        playerId: currentCandidate.playerId,
                        commandType: forcedRecoveryCommandDecision.commandType,
                        commandPayload: forcedRecoveryCommandDecision.commandPayload,
                    });
                    if (!nextSuccess) {
                        const commandFailureReason = this.hooks.getLastCommandFailureReason(match);
                        const forcedExecutionFailureDecision = resolveOnlineAiForcedRecoveryFailureDispatchDecision({
                            forcedRecoveryCommandDecision,
                            currentCandidate,
                            currentPhaseLabel: phaseLabel,
                            commandExecutionSucceeded: false,
                            commandFailureReason,
                            formatCommandFailureReason: formatOnlineAiCommandFailureReason,
                        });
                        if (forcedExecutionFailureDecision.kind !== 'report-failure') {
                            throw new Error('Expected failed online AI forced command to produce recovery failure feedback');
                        }
                        const revalidatedCandidate = await revalidateRecoveryCandidate(
                            forcedExecutionFailureDecision.candidate,
                        );
                        if (!revalidatedCandidate) {
                            return;
                        }
                        currentCandidate = revalidatedCandidate;
                        await this.hooks.handleRecoveryFailure({
                            match,
                            tracker,
                            candidate: currentCandidate,
                            phaseLabel,
                            progressMarkerBeforeRecovery,
                            reason: forcedExecutionFailureDecision.reason,
                        });
                        return;
                    }
                    executedCommandTypes.add(forcedRecoveryCommandDecision.commandType);

                    if (forcedRecoveryCommandDecision.shouldCountAdvanceStep) {
                        totalAdvanceSteps += 1;
                    }
                }

                recoverySteps += 1;
                const attemptedInteractionRespond = executedCommandTypes.has(INTERACTION_COMMANDS.RESPOND);
                if (executedCommandTypes.size > 0) {
                    await clearConfiguredLegacyResponseWindowMirror(currentCandidate);
                }
                const afterStepSnapshot = buildOnlineAiRecoveryStepAfterSnapshot({
                    state: match.state,
                    playerId: currentCandidate.playerId,
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
                const stepBookkeepingDecision = resolveOnlineAiWatchdogStepBookkeeping({
                    stepKeyBefore: beforeStepSnapshot.stepKeyBefore,
                    nextStepKey: afterStepSnapshot.nextStepKey,
                    seenStepKeys,
                    attemptedInteractionRespond,
                    interactionFingerprintBeforeStep: beforeStepSnapshot.interactionFingerprintBeforeStep,
                    interactionFingerprintAfterStep: afterStepSnapshot.interactionFingerprintAfterStep,
                    interactionRecoveryFingerprintAfterStep: afterStepSnapshot.interactionRecoveryFingerprintAfterStep,
                    currentCandidateFingerprintHint: currentCandidate.fingerprintHint,
                    actionRecoveryApplied: actionRecovery.applied,
                    actionRecoveryOutcome: actionRecovery.outcome,
                    blockedFailureReason,
                });
                if (stepBookkeepingDecision.kind === 'attempt-hard-cancel') {
                    if (await tryHardCancelCurrentAiInteraction(currentCandidate)) {
                        const postCancelCandidate = await resolveChainedRecoveryCandidate(candidate.playerId);
                        if (!postCancelCandidate || postCancelCandidate.playerId !== candidate.playerId) {
                            break;
                        }
                        currentCandidate = postCancelCandidate;
                        continue;
                    }
                }
                if (stepBookkeepingDecision.kind === 'fail' || stepBookkeepingDecision.kind === 'attempt-hard-cancel') {
                    const revalidatedCandidate = await revalidateRecoveryCandidate(currentCandidate);
                    if (!revalidatedCandidate) {
                        return;
                    }
                    currentCandidate = revalidatedCandidate;
                    const stepFailureReason = stepBookkeepingDecision.kind === 'fail'
                        ? stepBookkeepingDecision.reason
                        : actionRecovery.outcome === 'blocked' && blockedFailureReason
                            ? blockedFailureReason
                            : 'no_progress';
                    await this.hooks.handleRecoveryFailure({
                        match,
                        tracker,
                        candidate: currentCandidate,
                        phaseLabel,
                        progressMarkerBeforeRecovery,
                        reason: stepFailureReason,
                    });
                    return;
                }
                seenStepKeys.add(afterStepSnapshot.nextStepKey);

                const nextCandidate = await resolveChainedRecoveryCandidate(candidate.playerId);
                if (!nextCandidate || nextCandidate.playerId !== candidate.playerId) {
                    const manualForceAdvanceCandidate = buildManualForceAdvanceAfterConfirmedRollCandidate({
                        allowManualImmediateAiContinuation: options?.allowManualImmediateAiContinuation === true,
                        expectedPlayerId: candidate.playerId,
                        previousAction: actionRecovery.reportedAction,
                        state: match.state,
                        seatControllers,
                        currentPlayerId: resolveWatchdogCurrentPlayerId(),
                        engineConfig: match.engineConfig,
                        gameId: match.gameId,
                    });
                    if (manualForceAdvanceCandidate) {
                        currentCandidate = manualForceAdvanceCandidate;
                        continue;
                    }
                    const manualContinuationCandidate = buildManualImmediateAiContinuationCandidate({
                        allowManualImmediateAiContinuation: options?.allowManualImmediateAiContinuation === true,
                        expectedPlayerId: candidate.playerId,
                        previousActionKind: actionRecovery.reportedAction?.actionKind,
                        state: match.state,
                        seatControllers,
                        currentPlayerId: resolveWatchdogCurrentPlayerId(),
                        engineConfig: match.engineConfig,
                        gameId: match.gameId,
                    });
                    if (manualContinuationCandidate) {
                        currentCandidate = manualContinuationCandidate;
                        continue;
                    }
                    if (candidate.requiresConfirmedAdvancePhase === true) {
                        const followUpResolution = resolveForceAdvancePhaseAfterRecovery({
                            authoritativeState: match.state,
                            seatControllers,
                            playerId: candidate.playerId,
                            engineConfig: match.engineConfig,
                            gameId: match.gameId,
                        });
                        if (followUpResolution) {
                            currentCandidate = {
                                playerId: candidate.playerId,
                                reason: 'active-turn',
                                fingerprintHint: followUpResolution.attemptKey,
                                resolution: followUpResolution,
                            };
                            continue;
                        }
                    }
                    break;
                }
                const followUpRuntimeSnapshot = buildOnlineAiRecoveryFollowUpRuntimeSnapshot({
                    state: match.state,
                    seatControllers,
                    rootCandidate: candidate,
                    nextCandidate,
                    engineConfig: match.engineConfig,
                    hasLiveSeatConnection: false,
                    resolvePrivateOverlay: (playerId) => this.hooks.resolvePrivateOverlay(match, playerId),
                    resolveForceCommandAllowance: match.engineConfig.onlineAiRecovery?.allowForceCommandAfterLegalActionExhausted,
                });
                if (attemptedInteractionRespond
                    && isOnlineAiInteractionRecoveryReason(currentCandidate.reason)
                    && isOnlineAiInteractionRecoveryReason(nextCandidate.reason)
                    && beforeStepSnapshot.interactionFingerprintBeforeStep
                    && afterStepSnapshot.interactionFingerprintAfterStep === beforeStepSnapshot.interactionFingerprintBeforeStep
                    && await tryHardCancelCurrentAiInteraction(nextCandidate)) {
                    const postCancelCandidate = await resolveChainedRecoveryCandidate(candidate.playerId);
                    if (!postCancelCandidate || postCancelCandidate.playerId !== candidate.playerId) {
                        break;
                    }
                    currentCandidate = postCancelCandidate;
                    continue;
                }
                const followUpTransition = resolveOnlineAiRecoveryFollowUpTransitionFromRuntime({
                    state: match.state,
                    rootCandidate: candidate,
                    currentCandidate,
                    nextCandidate,
                    currentPlayerIdBeforeStep: beforeStepSnapshot.currentPlayerIdBeforeStep,
                    currentPlayerIdAfterStep: afterStepSnapshot.currentPlayerIdAfterStep,
                    actionRecoveryApplied: actionRecovery.applied,
                    responseWindowFingerprintBeforeStep: beforeStepSnapshot.responseWindowFingerprintBeforeStep,
                    seatViewInteractionAfterStep: followUpRuntimeSnapshot.seatViewInteractionAfterStep,
                    executedResponsePass: executedCommandTypes.has('RESPONSE_PASS'),
                    hasHumanResponderInCurrentWindow: followUpRuntimeSnapshot.hasHumanResponderInCurrentWindow,
                    hasLiveSeatConnection: followUpRuntimeSnapshot.hasLiveSeatConnection,
                    allowForceCommandAfterLegalActionExhaustedRequested:
                        followUpRuntimeSnapshot.allowForceCommandAfterLegalActionExhaustedRequested,
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
                if (followUpTransition.kind === 'natural-continuation') {
                    allowNaturalAiContinuation = true;
                    break;
                }
                const normalizedNextCandidate = followUpTransition.candidate;
                const manualContinuationCandidate = buildManualImmediateAiContinuationCandidate({
                    allowManualImmediateAiContinuation: options?.allowManualImmediateAiContinuation === true,
                    expectedPlayerId: candidate.playerId,
                    previousActionKind: actionRecovery.reportedAction?.actionKind,
                    state: match.state,
                    seatControllers,
                    currentPlayerId: resolveWatchdogCurrentPlayerId(),
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
                const manualForceAdvanceCandidate = buildManualForceAdvanceAfterConfirmedRollCandidate({
                    allowManualImmediateAiContinuation: options?.allowManualImmediateAiContinuation === true,
                    expectedPlayerId: candidate.playerId,
                    previousAction: actionRecovery.reportedAction,
                    state: match.state,
                    seatControllers,
                    currentPlayerId: resolveWatchdogCurrentPlayerId(),
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
                if (manualForceAdvanceCandidate) {
                    currentCandidate = manualForceAdvanceCandidate;
                    continue;
                }
                if (manualContinuationCandidate) {
                    currentCandidate = {
                        ...normalizedNextCandidate,
                        legalActionOnly: true,
                        fingerprintHint: manualContinuationCandidate.fingerprintHint,
                    };
                    continue;
                }
                const shouldContinueLegalOnlyActiveTurnExecution =
                    actionRecovery.applied
                    && candidate.reason === 'active-turn-legal-only'
                    && normalizedNextCandidate.reason === 'active-turn'
                    && normalizedNextCandidate.resolution.action.commands.length > 0;
                if (shouldContinueLegalOnlyActiveTurnExecution) {
                    currentCandidate = normalizedNextCandidate;
                    continue;
                }
                if (followUpTransition.nextTrackerKey) {
                    syncOnlineAiRecoveryTrackerKey(tracker, followUpTransition.nextTrackerKey);
                }
                currentCandidate = normalizedNextCandidate;
            }

            const markerAfterRecovery = buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            const unresolvedCandidate = allowNaturalAiContinuation
                ? null
                : await resolveChainedRecoveryCandidate(candidate.playerId);
            const completionFailureDecision = resolveOnlineAiRecoveryCompletionFailureDispatchDecision({
                rootPlayerId: candidate.playerId,
                unresolvedCandidate,
                markerAfterRecovery,
                progressMarkerBeforeRecovery,
                currentCandidate,
                currentPhaseLabel: phaseLabel,
            });
            if (completionFailureDecision.kind === 'report-failure') {
                const revalidatedCandidate = await revalidateRecoveryCandidate(completionFailureDecision.candidate);
                if (!revalidatedCandidate) {
                    return;
                }
                currentCandidate = revalidatedCandidate;
                const failurePhaseLabel = completionFailureDecision.reason === 'blocker_persisted'
                    ? resolveOnlineAiRecoveryPhaseLabel(revalidatedCandidate)
                    : completionFailureDecision.phaseLabel;
                await this.hooks.handleRecoveryFailure({
                    match,
                    tracker,
                    candidate: revalidatedCandidate,
                    phaseLabel: failurePhaseLabel,
                    progressMarkerBeforeRecovery,
                    reason: completionFailureDecision.reason,
                });
                return;
            }

            const repeatedAttempt = this.hooks.recordRepeatedAttempt(match.matchID, tracker.key);
            this.hooks.logRecoveredStalledAi({
                match,
                candidate,
                totalAdvanceSteps,
                repeatedAttemptCount: repeatedAttempt.count,
                markerBefore: progressMarkerBeforeRecovery,
                markerAfter: markerAfterRecovery,
            });

            this.hooks.clearTracker(match.matchID);
            const successFeedbackDecision = resolveOnlineAiRecoverySuccessFeedbackDecision({
                forcedCommandProgress: {
                    usedForcedRecoveryCommand,
                    totalAdvanceSteps,
                    totalForcedCommands,
                    lastForcedReason,
                    lastForcedPhaseLabel,
                },
                sequenceProgress: {
                    recoverySteps,
                    allowNaturalAiContinuation,
                    lastUnreportedLegalActionRecovery,
                },
                matchId: match.matchID,
                gameId: match.gameId,
                trackerKey: tracker.key,
                progressMarker: progressMarkerBeforeRecovery,
                rootPlayerId: candidate.playerId,
                fallbackReason: candidate.reason,
                fallbackPhaseLabel: phaseLabel,
                shouldReportObservedRecoveryWithoutForcedCommand:
                    match.engineConfig.onlineAiRecovery?.reportObservedRecoveryWithoutForcedCommand === true,
            });
            if (successFeedbackDecision.kind === 'report') {
                await this.hooks.reportRecoverySuccessFeedback({
                    match,
                    candidate,
                    trackerKey: tracker.key,
                    progressMarkerBeforeRecovery,
                    metadata: successFeedbackDecision.metadata,
                });
            }
        } finally {
            await roomRuntime.drainCommandQueueIfLoaded();
            if (!reuseExecutionLock) {
                roomRuntime.finishExecution();
            }
        }
    }
}
