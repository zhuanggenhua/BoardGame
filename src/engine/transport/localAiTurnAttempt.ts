import type { CancelableAiDelayHandle } from '../ai/actionDelay';
import type { AiSeatController } from '../ai/types';
import type { MatchState } from '../types';
import type { GameEngineConfig } from './engineConfig';
import { buildAiProgressMarker } from './onlineAiRecovery';
import {
    handleLocalAiIdleResolution,
    resolveLocalAiActionWithRecovery,
} from './localAiResolution';
import { executeResolvedLocalAiAction } from './localAiResolvedExecution';
import { tryReserveAiAttemptKey } from './aiAttemptGuard';
import type { LocalAiCommandEffect } from './localAiCommandEffects';
import type { LocalAiTurnTimeline } from './localAiDiagnostics';

export async function runLocalAiTurnAttempt(args: {
    state: MatchState<unknown>;
    config: GameEngineConfig;
    seed: string;
    seatControllers: Record<string, AiSeatController>;
    activePhaseStartedAt: number | null;
    stallRecoveryGraceMs: number;
    lastAiAttemptKeyRef: { current: string | null };
    lastVisibleActionAt: number | null;
    ensureAiTurnTimeline: (playerId: string, matchState: MatchState<unknown>) => LocalAiTurnTimeline | undefined;
    startDelay: (delayMs: number) => CancelableAiDelayHandle;
    setPendingDelayHandle: (handle: CancelableAiDelayHandle | null) => void;
    setDelayTimer: (handle: ReturnType<typeof setTimeout> | null) => void;
    dispatch: (type: string, payload: unknown) => void;
    getState: () => MatchState<unknown>;
    commandEffectsByToken: Record<string, LocalAiCommandEffect>;
    scheduleRetry: () => void;
    onVisibleActionAt: (timestamp: number) => void;
    isCancelled: () => boolean;
    idleRetryMs: number;
}): Promise<void> {
    const startedAt = Date.now();
    const progressMarkerBeforeDispatch = buildAiProgressMarker(args.state, {
        engineConfig: args.config,
        gameId: args.config.gameId,
    });
    const decisionStartedAt = Date.now();
    const activePhaseElapsedMsAtDecision = args.activePhaseStartedAt === null
        ? null
        : decisionStartedAt - args.activePhaseStartedAt;
    const resolution = await resolveLocalAiActionWithRecovery({
        state: args.state,
        config: args.config,
        matchId: `local:${args.config.gameId}:${args.seed}`,
        seatControllers: args.seatControllers,
        activePhaseElapsedMs: activePhaseElapsedMsAtDecision,
        stallRecoveryGraceMs: args.stallRecoveryGraceMs,
    });
    const decisionResolvedAt = Date.now();
    const decisionElapsedMs = decisionResolvedAt - startedAt;
    const activePhaseElapsedMs = args.activePhaseStartedAt === null
        ? null
        : decisionResolvedAt - args.activePhaseStartedAt;

    if (args.isCancelled()) return;

    if (!resolution) {
        handleLocalAiIdleResolution({
            config: args.config,
            gameId: args.config.gameId,
            seed: args.seed,
            state: args.state,
            seatControllers: args.seatControllers,
            decisionElapsedMs,
            activePhaseElapsedMs,
            isCancelled: args.isCancelled,
            scheduleRetry: () => {
                args.lastAiAttemptKeyRef.current = null;
                args.scheduleRetry();
            },
            setDelayTimer: args.setDelayTimer,
            idleRetryMs: args.idleRetryMs,
        });
        args.lastAiAttemptKeyRef.current = null;
        return;
    }

    if (!tryReserveAiAttemptKey(args.lastAiAttemptKeyRef, resolution.attemptKey)) {
        return;
    }

    await executeResolvedLocalAiAction({
        gameId: args.config.gameId,
        seed: args.seed,
        config: args.config,
        resolution,
        seatControllers: args.seatControllers,
        decisionResolvedAt,
        decisionElapsedMs,
        activePhaseElapsedMs,
        activePhaseStartedAt: args.activePhaseStartedAt,
        startedAt,
        isCancelled: args.isCancelled,
        lastVisibleActionAt: args.lastVisibleActionAt,
        ensureAiTurnTimeline: args.ensureAiTurnTimeline,
        startDelay: args.startDelay,
        setPendingDelayHandle: args.setPendingDelayHandle,
        dispatch: args.dispatch,
        getState: args.getState,
        commandEffectsByToken: args.commandEffectsByToken,
        activeAttemptKeyRef: args.lastAiAttemptKeyRef,
        markerBeforeDispatch: progressMarkerBeforeDispatch,
        scheduleRetry: args.scheduleRetry,
        onVisibleActionAt: args.onVisibleActionAt,
    });
}
