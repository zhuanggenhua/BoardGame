import type { CancelableAiDelayHandle } from '../ai/actionDelay';
import type { AiSeatController } from '../ai/types';
import type { MatchState } from '../types';
import type { GameEngineConfig } from './engineConfig';
import { runLocalAiTurnAttempt } from './localAiTurnAttempt';
import type { LocalAiCommandEffect } from './localAiCommandEffects';
import type { LocalAiTurnTimeline } from './localAiDiagnostics';
import {
    resetLocalAiTransientState,
    resolveLocalAiAutomationBlockReason,
} from './localAiRuntimeGate';

type RefBox<T> = {
    current: T;
};

export function startLocalAiAutomationEffect(args: {
    state: MatchState<unknown>;
    config: GameEngineConfig;
    seed: string;
    seatControllers: Record<string, AiSeatController>;
    localPregameControlledPlayerId: string | null;
    activePhaseStartedAt: number | null;
    stallRecoveryGraceMs: number;
    lastAiAttemptKeyRef: RefBox<string | null>;
    lastVisibleAiActionAtRef: RefBox<number | null>;
    aiCommandEffectByTokenRef: RefBox<Record<string, LocalAiCommandEffect>>;
    aiTurnTimelineBySeatRef: RefBox<Record<string, LocalAiTurnTimeline>>;
    ensureAiTurnTimeline: (playerId: string, matchState: MatchState<unknown>) => LocalAiTurnTimeline | undefined;
    startDelay: (delayMs: number) => CancelableAiDelayHandle;
    dispatch: (type: string, payload: unknown) => void;
    getState: () => MatchState<unknown>;
    getRandomCursor: () => number;
    restoreBatchSnapshot: (snapshot: { state: MatchState<unknown>; randomCursor: number | null }) => void;
    scheduleRetry: () => void;
    onVisibleActionAt: (timestamp: number) => void;
    idleRetryMs: number;
    automationDisabled?: boolean;
}): () => void {
    const blockReason = resolveLocalAiAutomationBlockReason({
        seatControllers: args.seatControllers,
        localPregameControlledPlayerId: args.localPregameControlledPlayerId,
        automationDisabled: args.automationDisabled,
    });
    if (blockReason) {
        resetLocalAiTransientState({
            lastAiAttemptKeyRef: args.lastAiAttemptKeyRef,
            lastVisibleAiActionAtRef: args.lastVisibleAiActionAtRef,
            aiCommandEffectByTokenRef: args.aiCommandEffectByTokenRef,
            aiTurnTimelineBySeatRef: args.aiTurnTimelineBySeatRef,
        });
        return () => {};
    }

    let cancelled = false;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingDelayHandle: CancelableAiDelayHandle | null = null;
    const isCancelled = () => cancelled;

    void runLocalAiTurnAttempt({
        state: args.state,
        config: args.config,
        seed: args.seed,
        seatControllers: args.seatControllers,
        activePhaseStartedAt: args.activePhaseStartedAt,
        stallRecoveryGraceMs: args.stallRecoveryGraceMs,
        lastAiAttemptKeyRef: args.lastAiAttemptKeyRef,
        lastVisibleActionAt: args.lastVisibleAiActionAtRef.current,
        ensureAiTurnTimeline: args.ensureAiTurnTimeline,
        startDelay: args.startDelay,
        setPendingDelayHandle: (handle) => {
            pendingDelayHandle = handle;
        },
        setDelayTimer: (handle) => {
            delayTimer = handle;
        },
        dispatch: args.dispatch,
        getState: args.getState,
        getRandomCursor: args.getRandomCursor,
        restoreBatchSnapshot: args.restoreBatchSnapshot,
        commandEffectsByToken: args.aiCommandEffectByTokenRef.current,
        scheduleRetry: args.scheduleRetry,
        onVisibleActionAt: args.onVisibleActionAt,
        isCancelled,
        idleRetryMs: args.idleRetryMs,
    });

    return () => {
        cancelled = true;
        if (delayTimer) {
            clearTimeout(delayTimer);
            delayTimer = null;
        }
        pendingDelayHandle?.cancel();
        pendingDelayHandle = null;
    };
}
