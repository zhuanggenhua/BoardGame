import type { MatchState } from '../types';
import type { AiSeatController } from '../ai';
import type { LocalAiCommandEffect } from './localAiCommandEffects';
import {
    logAiRuntimeTruthInfo,
    logAiRuntimeTruthWarn,
    resolveCoreCurrentPlayerId,
    summarizeSeatControllerTypes,
    type LocalAiTurnTimeline,
} from './localAiDiagnostics';
import {
    hasAutomatedSeat,
    resetLocalAiTransientState,
    resolveLocalAiAutomationBlockReason,
} from './localAiRuntimeGate';

type RefBox<T> = {
    current: T;
};

export function syncLocalAiActivePhase(args: {
    state: MatchState<unknown>;
    seatControllers: Record<string, AiSeatController>;
    activePhaseRef: RefBox<{ key: string; startedAt: number } | null>;
    ensureAiTurnTimeline: (playerId: string, matchState: MatchState<unknown>) => LocalAiTurnTimeline | undefined;
}): void {
    const currentPlayerId = resolveCoreCurrentPlayerId(args.state.core);
    if (!currentPlayerId || args.seatControllers[currentPlayerId]?.type === 'human') {
        args.activePhaseRef.current = null;
        return;
    }

    const phase = args.state.sys?.phase ?? 'unknown';
    const turnNumber = args.state.sys?.turnNumber ?? 'no-turn';
    const nextId = args.state.sys?.eventStream?.nextId ?? 'no-event';
    const key = `${currentPlayerId}:${turnNumber}:${phase}:${nextId}`;
    if (args.activePhaseRef.current?.key !== key) {
        args.activePhaseRef.current = { key, startedAt: Date.now() };
    }
    args.ensureAiTurnTimeline(currentPlayerId, args.state);
}

export function logLocalAiProviderRuntimeTruth(args: {
    state: MatchState<unknown>;
    gameId: string;
    seatControllers: Record<string, AiSeatController>;
    localPregameControlledPlayerId: string | null;
    runtimeTruthKeyRef: RefBox<string | null>;
}): void {
    const currentPlayerId = resolveCoreCurrentPlayerId(args.state.core);
    const seatControllerTypes = summarizeSeatControllerTypes(args.seatControllers);
    const hasAiSeat = hasAutomatedSeat(args.seatControllers);
    const currentControllerType = currentPlayerId
        ? (seatControllerTypes[currentPlayerId] ?? 'human')
        : null;
    const payload = {
        mode: 'local',
        gameId: args.gameId,
        hasAiSeat,
        currentPlayerId,
        currentControllerType,
        phase: args.state.sys?.phase ?? null,
        turnNumber: args.state.sys?.turnNumber ?? null,
        localPregameControlledPlayerId: args.localPregameControlledPlayerId ?? null,
        seatControllerTypes,
    };
    const nextKey = JSON.stringify(payload);
    if (args.runtimeTruthKeyRef.current === nextKey) {
        return;
    }
    args.runtimeTruthKeyRef.current = nextKey;
    logAiRuntimeTruthInfo('local-provider-state', payload);
    if (!hasAiSeat) {
        logAiRuntimeTruthWarn('local-ai-disabled', {
            mode: 'local',
            gameId: args.gameId,
            reason: 'all-human-seats',
            seatControllerTypes,
        });
    }
}

export function recoverLocalAiOnAppVisible(args: {
    seatControllers: Record<string, AiSeatController>;
    localPregameControlledPlayerId: string | null;
    lastAiAttemptKeyRef: RefBox<string | null>;
    lastVisibleAiActionAtRef: RefBox<number | null>;
    aiCommandEffectByTokenRef: RefBox<Record<string, LocalAiCommandEffect>>;
    onRetry: () => void;
    automationDisabled?: boolean;
}): void {
    if (resolveLocalAiAutomationBlockReason({
        seatControllers: args.seatControllers,
        localPregameControlledPlayerId: args.localPregameControlledPlayerId,
        automationDisabled: args.automationDisabled,
    })) {
        return;
    }
    resetLocalAiTransientState({
        lastAiAttemptKeyRef: args.lastAiAttemptKeyRef,
        lastVisibleAiActionAtRef: args.lastVisibleAiActionAtRef,
        aiCommandEffectByTokenRef: args.aiCommandEffectByTokenRef,
    });
    args.onRetry();
}
