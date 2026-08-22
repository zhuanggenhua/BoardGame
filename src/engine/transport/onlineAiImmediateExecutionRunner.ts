import type { MatchState } from '../types';
import {
    buildAiProgressMarker,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';
import {
    createOnlineAiActionDelayContext,
    type OnlineAiActionDelayContext,
} from './onlineAiActionDelay';
import type { OnlineAiImmediateActionResult } from './onlineAiExecutor';
import { isOnlineAiWatchdogPublicPregameLegalActionPhase } from './onlineAiWatchdogGameSemantics';
import type { OnlineAiWatchdogSeatController } from './onlineAiWatchdogSeatControllers';
import type { OnlineAiRecoveryTracker } from './onlineAiWatchdogTracker';
import type {
    OnlineAiLegalActionRecoveryResult,
} from './onlineAiWatchdogSequenceHelpers';
import type { OnlineAiRecoverySequenceRoomRuntime } from './onlineAiRecoverySequenceRunner';

export type OnlineAiImmediateExecutionMatch = {
    matchID: string;
    gameId: string;
    state: MatchState<unknown>;
    stateID: number;
    unloaded: boolean;
    engineConfig: {
        onlineAiRecovery?: {
            allowForceCommandAfterLegalActionExhausted?: (args: {
                state: MatchState<unknown>;
                phase: string;
                previousCandidate: ForceEndTurnStalledAiResolution;
                nextCandidate: ForceEndTurnStalledAiResolution;
            }) => boolean;
        };
    };
};

export type OnlineAiImmediateExecutionRoomRuntime = OnlineAiRecoverySequenceRoomRuntime & {
    isUnloaded: () => boolean;
};

export type OnlineAiImmediateExecutionTrace = {
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

type OnlineAiLegalActionMissOutcome = Exclude<OnlineAiLegalActionRecoveryResult['outcome'], 'applied'>;

export function shouldRunImmediateForcedRecoveryAfterLegalActionMiss(args: {
    state: MatchState<unknown>;
    engineConfig: OnlineAiImmediateExecutionMatch['engineConfig'];
    candidate: ForceEndTurnStalledAiResolution;
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    outcome: OnlineAiLegalActionMissOutcome;
    failedCommandType?: string | null;
}): boolean {
    const { state, engineConfig, candidate, seatControllers, outcome, failedCommandType } = args;
    const recoveryCommands = candidate.resolution.action.commands;
    if (recoveryCommands.length === 0) {
        return false;
    }

    const currentWindow = (state.sys as { responseWindow?: { current?: unknown } } | undefined)
        ?.responseWindow?.current as { responderQueue?: unknown } | undefined;
    const responderQueue = Array.isArray(currentWindow?.responderQueue) ? currentWindow.responderQueue : [];
    const hasHumanResponder = responderQueue.some((responderId) => {
        const id = typeof responderId === 'string' ? responderId : '';
        return id.length > 0 && seatControllers[id]?.type === 'human';
    });
    if (hasHumanResponder) {
        return false;
    }

    const isDirectRecoveryCandidate = candidate.legalActionOnly !== true
        && (
            candidate.reason === 'visible-interaction'
            || candidate.reason === 'hidden-interaction'
            || candidate.reason === 'response-window'
            || candidate.reason === 'response-loop'
        );
    if (isDirectRecoveryCandidate) {
        return true;
    }

    const canTreatMissAsExhausted = outcome === 'no-legal-action'
        || (outcome === 'legal-action-command-failed' && !failedCommandType);
    if (!canTreatMissAsExhausted) {
        return false;
    }

    if (candidate.allowForceCommandAfterLegalActionExhausted === true) {
        return true;
    }

    const currentPhase = typeof state.sys?.phase === 'string' ? state.sys.phase : '';
    return engineConfig.onlineAiRecovery?.allowForceCommandAfterLegalActionExhausted?.({
        state,
        phase: currentPhase,
        previousCandidate: candidate,
        nextCandidate: candidate,
    }) === true;
}

export type OnlineAiImmediateExecutionRunnerHooks<TMatch extends OnlineAiImmediateExecutionMatch> = {
    createRoomRuntime: (match: TMatch) => OnlineAiImmediateExecutionRoomRuntime;
    buildSeatControllers: (match: TMatch) => Record<string, OnlineAiWatchdogSeatController>;
    isRecoveryInFlight: (matchId: string) => boolean;
    beginRecoveryInFlight: (matchId: string) => void;
    finishRecoveryInFlight: (matchId: string) => void;
    clearRecoveryProgress: (matchId: string) => void;
    clearCircuitBreakerMatch: (matchId: string) => void;
    clearCircuitBreakerSeat: (matchId: string, playerId: string) => void;
    executeImmediateAction: (args: {
        match: TMatch;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
        delayContext: OnlineAiActionDelayContext;
    }) => Promise<OnlineAiImmediateActionResult>;
    resolveRecoveryCandidate: (
        match: TMatch,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ) => Promise<ForceEndTurnStalledAiResolution | null>;
    buildRecoveryFingerprint: (
        match: TMatch,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarker: string,
    ) => string;
    setTracker: (matchId: string, tracker: OnlineAiRecoveryTracker) => void;
    tryRecoverWithLegalAction: (args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        tracker: OnlineAiRecoveryTracker;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
        delayContext: OnlineAiActionDelayContext;
    }) => Promise<OnlineAiLegalActionRecoveryResult>;
    runRecoverySequence: (args: {
        match: TMatch;
        tracker: OnlineAiRecoveryTracker;
        candidate: ForceEndTurnStalledAiResolution;
        progressMarker: string;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
        options: { reuseExecutionLock: true };
    }) => Promise<void>;
    logExecutionTrace: (trace: OnlineAiImmediateExecutionTrace) => void;
};

export type OnlineAiImmediateExecutionRunnerConfig<TMatch extends OnlineAiImmediateExecutionMatch> = {
    maxAdvanceSteps: number;
    maxStepsPerSlice: number;
    hooks: OnlineAiImmediateExecutionRunnerHooks<TMatch>;
};

export class OnlineAiImmediateExecutionRunner<TMatch extends OnlineAiImmediateExecutionMatch> {
    private readonly maxAdvanceSteps: number;
    private readonly maxStepsPerSlice: number;
    private readonly hooks: OnlineAiImmediateExecutionRunnerHooks<TMatch>;

    constructor(config: OnlineAiImmediateExecutionRunnerConfig<TMatch>) {
        this.maxAdvanceSteps = config.maxAdvanceSteps;
        this.maxStepsPerSlice = config.maxStepsPerSlice;
        this.hooks = config.hooks;
    }

    async run(match: TMatch, trigger: 'command-succeeded' | 'sync'): Promise<void> {
        const roomRuntime = this.hooks.createRoomRuntime(match);
        if (roomRuntime.isUnloaded() || roomRuntime.isExecuting() || this.hooks.isRecoveryInFlight(match.matchID)) {
            return;
        }

        const seatControllers = this.hooks.buildSeatControllers(match);
        const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
        if (!hasAiSeat) {
            this.hooks.clearRecoveryProgress(match.matchID);
            this.hooks.clearCircuitBreakerMatch(match.matchID);
            return;
        }

        for (const [playerId, controller] of Object.entries(seatControllers)) {
            if (controller.type === 'human') {
                this.hooks.clearCircuitBreakerSeat(match.matchID, playerId);
            }
        }

        if (!roomRuntime.tryBeginExecution()) {
            return;
        }
        this.hooks.beginRecoveryInFlight(match.matchID);
        try {
            const seenStepKeys = new Set<string>();
            const delayContext = createOnlineAiActionDelayContext();
            const aiSeatCount = Object.values(seatControllers)
                .filter((controller) => controller.type !== 'human')
                .length;
            const publicPregameStepBudget = Math.min(
                this.maxAdvanceSteps,
                Math.max(this.maxStepsPerSlice, aiSeatCount * 4),
            );
            for (let step = 0; step < this.maxAdvanceSteps; step += 1) {
                if (match.unloaded) {
                    return;
                }

                const stepStateIdBefore = match.stateID;
                const stepStartedAt = Date.now();
                const immediateAction = await this.hooks.executeImmediateAction({
                    match,
                    seatControllers,
                    delayContext,
                });
                if (immediateAction.applied) {
                    this.hooks.logExecutionTrace({
                        matchId: match.matchID,
                        gameId: match.gameId,
                        playerId: immediateAction.playerId,
                        stateIdBefore: stepStateIdBefore,
                        candidateReason: 'immediate-ai',
                        decisionMs: immediateAction.decisionMs,
                        executionMs: Date.now() - stepStartedAt - immediateAction.decisionMs,
                        actionKind: immediateAction.actionKind,
                        commandTypes: immediateAction.executedCommandTypes,
                        outcome: `normal:${trigger}`,
                        blockedReason: null,
                        commandFailureReason: immediateAction.commandFailureReason,
                    });
                    continue;
                }

                const candidate = await this.hooks.resolveRecoveryCandidate(match, seatControllers);
                if (!candidate) {
                    this.hooks.clearRecoveryProgress(match.matchID);
                    return;
                }
                const publicPregameCandidate = candidate.reason === 'seat-legal-only'
                    && isOnlineAiWatchdogPublicPregameLegalActionPhase({
                        state: match.state,
                        engineConfig: match.engineConfig,
                    });
                const stepBudget = publicPregameCandidate
                    ? publicPregameStepBudget
                    : this.maxStepsPerSlice;
                if (step >= stepBudget) {
                    return;
                }

                const progressMarker = buildAiProgressMarker(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
                const recoveryFingerprint = this.hooks.buildRecoveryFingerprint(match, candidate, progressMarker);
                const stepKey = candidate.legalActionOnly === true
                    ? `${candidate.playerId}:${candidate.reason}:${recoveryFingerprint}:${progressMarker}`
                    : `${candidate.playerId}:${candidate.reason}:${recoveryFingerprint}`;
                if (seenStepKeys.has(stepKey)) {
                    return;
                }
                seenStepKeys.add(stepKey);

                const tracker: OnlineAiRecoveryTracker = {
                    key: stepKey,
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                };
                this.hooks.setTracker(match.matchID, tracker);

                const recoveryStepStateIdBefore = match.stateID;
                const recoveryStepStartedAt = Date.now();
                const actionRecovery = await this.hooks.tryRecoverWithLegalAction({
                    match,
                    candidate,
                    tracker,
                    seatControllers,
                    delayContext,
                });
                if (!actionRecovery.applied) {
                    const shouldRunForcedRecovery = shouldRunImmediateForcedRecoveryAfterLegalActionMiss({
                        state: match.state,
                        engineConfig: match.engineConfig,
                        candidate,
                        seatControllers,
                        outcome: actionRecovery.outcome,
                        failedCommandType: actionRecovery.failedCommandType,
                    });
                    this.hooks.logExecutionTrace({
                        matchId: match.matchID,
                        gameId: match.gameId,
                        playerId: candidate.playerId,
                        stateIdBefore: recoveryStepStateIdBefore,
                        candidateReason: candidate.reason,
                        decisionMs: Date.now() - recoveryStepStartedAt,
                        executionMs: 0,
                        actionKind: null,
                        commandTypes: actionRecovery.executedCommandTypes,
                        outcome: `fallback:${trigger}:${actionRecovery.outcome}`,
                        blockedReason: actionRecovery.blockedReason,
                        commandFailureReason: actionRecovery.commandFailureReason,
                    });
                    if (!shouldRunForcedRecovery) {
                        this.hooks.clearRecoveryProgress(match.matchID);
                        return;
                    }
                    await this.hooks.runRecoverySequence({
                        match,
                        tracker,
                        candidate,
                        progressMarker,
                        seatControllers,
                        options: { reuseExecutionLock: true },
                    });
                    return;
                }

                this.hooks.logExecutionTrace({
                    matchId: match.matchID,
                    gameId: match.gameId,
                    playerId: candidate.playerId,
                    stateIdBefore: recoveryStepStateIdBefore,
                    candidateReason: candidate.reason,
                    decisionMs: Date.now() - recoveryStepStartedAt,
                    executionMs: 0,
                    actionKind: actionRecovery.reportedAction?.actionKind ?? null,
                    commandTypes: actionRecovery.executedCommandTypes,
                    outcome: `normal:${trigger}`,
                    blockedReason: null,
                    commandFailureReason: null,
                });
            }
        } finally {
            this.hooks.finishRecoveryInFlight(match.matchID);
            await roomRuntime.drainCommandQueueIfLoaded();
            roomRuntime.finishExecution();
        }
    }
}
