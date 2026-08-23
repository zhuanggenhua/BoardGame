import type { CancelableAiDelayHandle } from '../ai/actionDelay';
import type { AiResolution } from '../ai/localRunner';
import type { AiSeatController } from '../ai/types';
import type { MatchState } from '../types';
import type { LocalAiCommandEffect } from './localAiCommandEffects';
import {
    logLocalAiPerfInfo,
    type LocalAiTurnTimeline,
} from './localAiDiagnostics';
import type { OnlineAiRecoveryEngineConfig } from './onlineAiRecovery';
import { prepareLocalAiExecution } from './localAiExecutionPrep';
import { executeLocalAiCommandBatch } from './localAiCommandExecution';
import {
    finalizeLocalAiDispatch,
    logLocalAiSubmitSkipped,
    waitForLocalAiExecutionDelay,
} from './localAiSubmissionTelemetry';
import {
    releaseAiAttemptKeyIfMatches,
    scheduleLocalAiRetryAfterDispatch,
} from './aiAttemptGuard';
import { resolveRuntimeSeatControllers } from './stateNormalization';

export async function executeResolvedLocalAiAction(args: {
    gameId: string;
    seed: string;
    config: OnlineAiRecoveryEngineConfig;
    resolution: AiResolution;
    seatControllers: Record<string, AiSeatController>;
    decisionResolvedAt: number;
    decisionElapsedMs: number;
    activePhaseElapsedMs: number | null;
    activePhaseStartedAt: number | null;
    startedAt: number;
    isCancelled: () => boolean;
    lastVisibleActionAt: number | null;
    ensureAiTurnTimeline: (playerId: string, matchState: MatchState<unknown>) => LocalAiTurnTimeline | undefined;
    startDelay: (delayMs: number) => CancelableAiDelayHandle;
    setPendingDelayHandle: (handle: CancelableAiDelayHandle | null) => void;
    dispatch: (type: string, payload: unknown) => void;
    getState: () => MatchState<unknown>;
    getRandomCursor?: () => number;
    restoreBatchSnapshot?: (snapshot: { state: MatchState<unknown>; randomCursor: number | null }) => void;
    commandEffectsByToken: Record<string, LocalAiCommandEffect>;
    activeAttemptKeyRef: { current: string | null };
    markerBeforeDispatch: string;
    scheduleRetry: () => void;
    onVisibleActionAt: (timestamp: number) => void;
}): Promise<void> {
    const executionPrep = prepareLocalAiExecution({
        gameId: args.gameId,
        seed: args.seed,
        resolution: args.resolution,
        seatControllers: args.seatControllers,
        decisionResolvedAt: args.decisionResolvedAt,
        decisionElapsedMs: args.decisionElapsedMs,
        activePhaseElapsedMs: args.activePhaseElapsedMs,
        lastVisibleActionAt: args.lastVisibleActionAt,
        state: args.getState(),
        ensureAiTurnTimeline: args.ensureAiTurnTimeline,
    });
    if (!executionPrep) {
        releaseAiAttemptKeyIfMatches(args.activeAttemptKeyRef, args.resolution.attemptKey);
        return;
    }

    const {
        actionVisibility,
        delayPlan,
        commandTypes,
        turnTimeline,
        decisionReadyPayload,
        scheduledPayload,
    } = executionPrep;
    logLocalAiPerfInfo('ai-decision-ready', decisionReadyPayload);
    logLocalAiPerfInfo('scheduled', scheduledPayload);

    const submissionIdentity = {
        gameId: args.gameId,
        seed: args.seed,
        playerId: args.resolution.playerId,
        source: args.resolution.source,
        actionKind: args.resolution.action.kind,
        commandTypes,
    };

    const delayOutcome = await waitForLocalAiExecutionDelay({
        identity: submissionIdentity,
        delayPlan,
        startDelay: args.startDelay,
        setPendingDelayHandle: args.setPendingDelayHandle,
        isCancelled: args.isCancelled,
    });
    if (delayOutcome === 'cancelled') {
        releaseAiAttemptKeyIfMatches(args.activeAttemptKeyRef, args.resolution.attemptKey);
        return;
    }

    if (args.isCancelled()) {
        logLocalAiSubmitSkipped({
            identity: submissionIdentity,
            delayPlan,
            isCancelled: args.isCancelled,
        });
        releaseAiAttemptKeyIfMatches(args.activeAttemptKeyRef, args.resolution.attemptKey);
        return;
    }

    const latestSeatControllers = resolveRuntimeSeatControllers({
        state: args.getState(),
        seatControllers: args.seatControllers,
    });
    const latestController = latestSeatControllers[args.resolution.playerId];
    if (!latestController || latestController.type === 'human') {
        releaseAiAttemptKeyIfMatches(args.activeAttemptKeyRef, args.resolution.attemptKey);
        return;
    }

    const { hasAnyCommandEffect } = await executeLocalAiCommandBatch({
        gameId: args.gameId,
        seed: args.seed,
        playerId: args.resolution.playerId,
        source: args.resolution.source,
        actionKind: args.resolution.action.kind,
        actionVisibility,
        attemptKey: args.resolution.attemptKey,
        commands: args.resolution.action.commands,
        turnTimeline,
        dispatch: args.dispatch,
        getState: args.getState,
        getRandomCursor: args.getRandomCursor,
        restoreBatchSnapshot: args.restoreBatchSnapshot,
        commandEffectsByToken: args.commandEffectsByToken,
        engineConfig: args.config,
    });

    finalizeLocalAiDispatch({
        identity: submissionIdentity,
        delayPlan,
        actionVisibility,
        hasAnyCommandEffect,
        decisionElapsedMs: args.decisionElapsedMs,
        startedAt: args.startedAt,
        activePhaseStartedAt: args.activePhaseStartedAt,
        onVisibleActionAt: args.onVisibleActionAt,
    });

    scheduleLocalAiRetryAfterDispatch({
        isCancelled: args.isCancelled,
        activeAttemptKeyRef: args.activeAttemptKeyRef,
        resolutionAttemptKey: args.resolution.attemptKey,
        markerBeforeDispatch: args.markerBeforeDispatch,
        getNextState: args.getState,
        scheduleRetry: args.scheduleRetry,
        engineConfig: args.config,
    });
}
