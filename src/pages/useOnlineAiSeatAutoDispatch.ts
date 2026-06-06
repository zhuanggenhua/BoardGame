import { useCallback, useEffect, useRef } from 'react';
import { getGameImplementation } from '../games/registry';
import {
    releaseAiAttemptKeyIfMatches,
    tryReserveAiAttemptKey,
} from '../engine/transport/react';
import { resolveOnlineAiCurrentPlayerId } from '../engine/transport/onlineAiRecovery';
import type { GameTransportClient } from '../engine/transport/client';
import type { GameEngineConfig } from '../engine/transport/server';
import type { MatchState } from '../engine/types';
import {
    resolveLocalAiActionDelayPlan,
    resolveNextAiDispatch,
    getGameAiRuntime,
    resolveOnlineAiDecisionView,
    startCancelableAiDelay,
    type AiSeatController,
    type AiResolution,
} from '../engine/ai';
import { resolveLocalAiActionVisibility } from '../engine/ai/actionVisibility';
import { appendMatchLoadTrace } from '../lib/matchLoadTrace';
import { logMobileRuntimeCritical } from '../lib/mobile/mobileRuntimeDebug';
import {
    buildOnlineAiSeamAwareAttemptMarkers,
    buildOnlineAiIdleSeatRecoveryKey,
    buildOnlineAiSubmitBlockedRecoveryKey,
    resolveOnlineAiSeatRecoveryAttempt,
    shouldStageOnlineAiSeatOverrideFromConfirmedState,
} from './onlineAiRecovery';
import {
    emitOnlineAiPerf,
    onlineAiPerfLogger,
} from './onlineAiRuntimeSupport';
import {
    isManualSetupSelectionActionKind,
    resolveManualSetupAttemptReleaseSource,
    resolveManualSetupSelectionId,
    shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt,
} from './matchManualSetup';
import {
    finalizeOnlineAiResolutionConfirmation,
    resolveCurrentPlayerId,
    submitOnlineAiResolution,
} from './onlineAiForceSkip';
import type { OnlineAiSeatTransportRuntime } from './useOnlineAiSeatTransportRuntime';

const STALE_SEAT_RECOVERY_RETRY_MS = 350;
const STALE_ONLINE_AI_ATTEMPT_TIMEOUT_MS = 4000;

type ActiveAiAttempt = {
    attemptKey: string;
    playerId: string;
    reservedAt: number;
    sharedMarker: string;
    seatMarker: string | null;
    actionKind: string;
    pendingSelectionId: string | null;
};

type OnlineAiSeatRecoveryTracker = {
    key: string;
    lastRecoveryAt: number;
};

type OnlineAiAttemptReleaseStage = 'shared-faction-select-confirmed' | 'seat-faction-select-confirmed';

type OnlineAiResolutionSubmissionLifecycleArgs = {
    matchId: string;
    engineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
    sharedState: MatchState<unknown>;
    resolution: AiResolution;
    commandTypes: string[];
    client: GameTransportClient;
    submittedAt: number;
    lastAiAttemptKeyRef: { current: string | null };
    activeAiAttemptRef: { current: ActiveAiAttempt | null };
    aiSeatDecisionDebugRef: { current: Record<string, Record<string, unknown>> };
    aiSeatStateOverridesRef: { current: Record<string, MatchState<unknown> | null> };
    getSeatLatestState: (playerId: string) => MatchState<unknown> | null;
    requestSeatResync: OnlineAiSeatTransportRuntime['requestSeatResync'];
    scheduleAiRetry: OnlineAiSeatTransportRuntime['scheduleAiRetry'];
};

type OnlineAiSeatRecoveryFlowArgs = {
    recoveryKey: string | null;
    lastRecovery: OnlineAiSeatRecoveryTracker | null;
    onRecovered: () => void;
    onMissingKey?: () => void;
};

type OnlineAiActiveAttemptLifecycleArgs = {
    engineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
    sharedState: MatchState<unknown>;
    activeAiAttemptRef: { current: ActiveAiAttempt | null };
    aiSeatDecisionDebugRef: { current: Record<string, Record<string, unknown>> };
    getEffectiveSeatState: (playerId: string) => MatchState<unknown> | null;
    getSeatClient: (playerId: string) => GameTransportClient | null;
    requestSeatResync: OnlineAiSeatTransportRuntime['requestSeatResync'];
    clearActiveAiAttemptIfMatches: (attemptKey: string) => void;
};

export function resolveOnlineAiActivePlayerId(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'> | null;
}): string | null {
    const currentPlayerId = resolveOnlineAiCurrentPlayerId(args.sharedState, {
        engineConfig: args.engineConfig,
    });
    if (!currentPlayerId || args.seatControllers[currentPlayerId]?.type === 'human') {
        return null;
    }
    return currentPlayerId;
}

function setOnlineAiSeatDecisionDebug(
    ref: { current: Record<string, Record<string, unknown>> },
    playerId: string,
    payload: Record<string, unknown>,
): void {
    ref.current[playerId] = {
        ...payload,
        updatedAt: Date.now(),
    };
}

function resolveOnlineAiAttemptReleaseStage(args: {
    sharedState: MatchState<unknown>;
    seatState: MatchState<unknown> | null;
    playerId: string;
    actionKind: string;
    selectionId: string | null;
    engineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
}): OnlineAiAttemptReleaseStage | null {
    if (!shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt(args.actionKind)) {
        return null;
    }
    if (!isManualSetupSelectionActionKind(args.actionKind)) {
        return null;
    }
    const releaseSource = resolveManualSetupAttemptReleaseSource({
        sharedState: args.sharedState,
        seatState: args.seatState,
        playerId: args.playerId,
        actionKind: args.actionKind,
        selectionId: args.selectionId,
        engineConfig: args.engineConfig,
    });
    if (!releaseSource) {
        return null;
    }
    return releaseSource === 'shared'
        ? 'shared-faction-select-confirmed'
        : 'seat-faction-select-confirmed';
}

function createOnlineAiResolutionSubmissionLifecycle(args: OnlineAiResolutionSubmissionLifecycleArgs) {
    const {
        matchId,
        engineConfig,
        sharedState,
        resolution,
        commandTypes,
        client,
        submittedAt,
        lastAiAttemptKeyRef,
        activeAiAttemptRef,
        aiSeatDecisionDebugRef,
        aiSeatStateOverridesRef,
        getSeatLatestState,
        requestSeatResync,
        scheduleAiRetry,
    } = args;
    const scheduleRetry = scheduleAiRetry;

    return {
        scheduleRetry,
        onWillResync: (reason: string) => {
            requestSeatResync({
                playerId: resolution.playerId,
                client,
                reason: 'batch-rejected',
                meta: {
                    rejectReason: reason,
                    actionKind: resolution.action.kind,
                    commandTypes,
                },
            });
        },
        onConfirmed: (authoritativeState: unknown) => {
            setOnlineAiSeatDecisionDebug(aiSeatDecisionDebugRef, resolution.playerId, {
                stage: 'confirmed',
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
            });
            const confirmedSeatState = authoritativeState && typeof authoritativeState === 'object'
                ? authoritativeState as MatchState<unknown>
                : null;
            const shouldStageOverride = shouldStageOnlineAiSeatOverrideFromConfirmedState({
                authoritativeState,
                latestSeatState: getSeatLatestState(resolution.playerId),
                engineConfig,
            });
            if (shouldStageOverride && confirmedSeatState) {
                aiSeatStateOverridesRef.current[resolution.playerId] = confirmedSeatState;
            } else {
                delete aiSeatStateOverridesRef.current[resolution.playerId];
            }
            logMobileRuntimeCritical('MatchRoom', 'online-ai-command-confirmed', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                confirmElapsedMs: Date.now() - submittedAt,
            });
            onlineAiPerfLogger.info('confirmed', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                confirmElapsedMs: Date.now() - submittedAt,
            });
            emitOnlineAiPerf('confirmed', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                confirmElapsedMs: Date.now() - submittedAt,
            });
            if (shouldStageOverride) {
                requestSeatResync({
                    playerId: resolution.playerId,
                    client,
                    reason: 'batch-confirmed-follow-up',
                    meta: {
                        actionKind: resolution.action.kind,
                        commandTypes,
                    },
                });
            }
            const releaseStage = resolveOnlineAiAttemptReleaseStage({
                sharedState,
                seatState: confirmedSeatState,
                playerId: resolution.playerId,
                actionKind: resolution.action.kind,
                selectionId: resolveManualSetupSelectionId({
                    actionKind: resolution.action.kind,
                    payload: resolution.action.commands[0]?.payload,
                    engineConfig,
                }),
                engineConfig,
            });
            if (releaseStage) {
                setOnlineAiSeatDecisionDebug(aiSeatDecisionDebugRef, resolution.playerId, {
                    stage: releaseStage,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                });
            }
            finalizeOnlineAiResolutionConfirmation({
                lastAiAttemptKeyRef,
                resolutionAttemptKey: resolution.attemptKey,
                scheduleRetry,
            });
            if (activeAiAttemptRef.current?.attemptKey === resolution.attemptKey) {
                activeAiAttemptRef.current = null;
            }
        },
        onRejected: (reason: string) => {
            setOnlineAiSeatDecisionDebug(aiSeatDecisionDebugRef, resolution.playerId, {
                stage: 'rejected',
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                rejectReason: reason,
            });
            if (activeAiAttemptRef.current?.attemptKey === resolution.attemptKey) {
                activeAiAttemptRef.current = null;
            }
            onlineAiPerfLogger.warn('rejected', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                rejectReason: reason,
                rejectElapsedMs: Date.now() - submittedAt,
            });
            emitOnlineAiPerf('rejected', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                rejectReason: reason,
                rejectElapsedMs: Date.now() - submittedAt,
            });
        },
    };
}

function resolveOnlineAiSeatRecoveryFlow(args: OnlineAiSeatRecoveryFlowArgs): {
    nextRecovery: OnlineAiSeatRecoveryTracker | null;
    shouldRecover: boolean;
} {
    const {
        recoveryKey,
        lastRecovery,
        onRecovered,
        onMissingKey,
    } = args;
    if (!recoveryKey) {
        onMissingKey?.();
        return {
            nextRecovery: null,
            shouldRecover: false,
        };
    }
    const recoveryAttempt = resolveOnlineAiSeatRecoveryAttempt({
        recoveryKey,
        now: Date.now(),
        lastRecovery,
    });
    if (recoveryAttempt.shouldRecover) {
        onRecovered();
    }
    return {
        nextRecovery: recoveryAttempt.nextRecovery,
        shouldRecover: recoveryAttempt.shouldRecover,
    };
}

function releaseConfirmedOnlineAiAttempt(args: OnlineAiActiveAttemptLifecycleArgs): void {
    const {
        sharedState,
        activeAiAttemptRef,
        aiSeatDecisionDebugRef,
        getEffectiveSeatState,
        clearActiveAiAttemptIfMatches,
    } = args;
    const activeAttempt = activeAiAttemptRef.current;
    if (!activeAttempt) {
        return;
    }
    const releaseStage = resolveOnlineAiAttemptReleaseStage({
        sharedState,
        seatState: getEffectiveSeatState(activeAttempt.playerId),
        playerId: activeAttempt.playerId,
        actionKind: activeAttempt.actionKind,
        selectionId: activeAttempt.pendingSelectionId,
    });
    if (!releaseStage) {
        return;
    }
    setOnlineAiSeatDecisionDebug(aiSeatDecisionDebugRef, activeAttempt.playerId, {
        stage: releaseStage,
        attemptKey: activeAttempt.attemptKey,
        selectionId: activeAttempt.pendingSelectionId,
    });
    clearActiveAiAttemptIfMatches(activeAttempt.attemptKey);
}

function releaseStaleOnlineAiAttempt(args: OnlineAiActiveAttemptLifecycleArgs): void {
    const {
        engineConfig,
        sharedState,
        activeAiAttemptRef,
        aiSeatDecisionDebugRef,
        getEffectiveSeatState,
        getSeatClient,
        requestSeatResync,
        clearActiveAiAttemptIfMatches,
    } = args;
    const activeAttempt = activeAiAttemptRef.current;
    if (!activeAttempt) {
        return;
    }
    const elapsedMs = Date.now() - activeAttempt.reservedAt;
    const currentSeatState = getEffectiveSeatState(activeAttempt.playerId);
    const {
        sharedMarker: currentSharedMarker,
        seatMarker: currentSeatMarker,
    } = buildOnlineAiSeamAwareAttemptMarkers({
        sharedState,
        seatState: currentSeatState,
        engineConfig,
    });
    if (
        elapsedMs < STALE_ONLINE_AI_ATTEMPT_TIMEOUT_MS
        || currentSharedMarker !== activeAttempt.sharedMarker
        || currentSeatMarker !== activeAttempt.seatMarker
    ) {
        return;
    }
    setOnlineAiSeatDecisionDebug(aiSeatDecisionDebugRef, activeAttempt.playerId, {
        stage: 'stale-attempt-released',
        attemptKey: activeAttempt.attemptKey,
        elapsedMs,
        sharedMarker: currentSharedMarker,
        seatMarker: currentSeatMarker,
    });
    clearActiveAiAttemptIfMatches(activeAttempt.attemptKey);
    const targetClient = getSeatClient(activeAttempt.playerId);
    if (!targetClient) {
        return;
    }
    requestSeatResync({
        playerId: activeAttempt.playerId,
        client: targetClient,
        reason: 'stale-inflight-attempt',
        meta: {
            attemptKey: activeAttempt.attemptKey,
            elapsedMs,
        },
    });
}

type OnlineAiSeatAutoDispatchArgs = {
    matchId: string;
    engineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
    state: MatchState<unknown> | null;
    seatControllers: Record<string, AiSeatController>;
    seatCredentials: Record<string, string>;
    lastAiAttemptKeyRef: { current: string | null };
    runtime: OnlineAiSeatTransportRuntime;
};

export function useOnlineAiSeatAutoDispatch(args: OnlineAiSeatAutoDispatchArgs): void {
    const {
        matchId,
        engineConfig,
        state,
        seatControllers,
        seatCredentials,
        lastAiAttemptKeyRef,
        runtime,
    } = args;
    const {
        aiRetryVersion,
        aiSeatDecisionDebugRef,
        aiSeatStateOverridesRef,
        connectionVersion,
        forEachSeatClient,
        getEffectiveSeatState,
        getSeatClient,
        getSeatLatestState,
        requestSeatResync,
        scheduleAiRetry,
    } = runtime;

    const lastVisibleAiActionAtRef = useRef<number | null>(null);
    const staleSeatDecisionKeyRef = useRef<string | null>(null);
    const staleSeatRecoveryRef = useRef<OnlineAiSeatRecoveryTracker | null>(null);
    const aiActivePhaseRef = useRef<{ key: string; startedAt: number } | null>(null);
    const activeAiAttemptRef = useRef<ActiveAiAttempt | null>(null);

    const clearActiveAiAttemptIfMatches = useCallback((attemptKey: string) => {
        releaseAiAttemptKeyIfMatches(lastAiAttemptKeyRef, attemptKey);
        if (activeAiAttemptRef.current?.attemptKey === attemptKey) {
            activeAiAttemptRef.current = null;
        }
    }, [lastAiAttemptKeyRef]);

    useEffect(() => {
        if (!state || typeof state !== 'object') {
            aiActivePhaseRef.current = null;
            return;
        }
        const sharedState = state as MatchState<unknown>;
        const activeAiPlayerId = resolveOnlineAiActivePlayerId({
            sharedState,
            seatControllers,
            engineConfig,
        });
        if (!activeAiPlayerId) {
            aiActivePhaseRef.current = null;
            return;
        }
        const phase = sharedState.sys?.phase ?? 'unknown';
        const turnNumber = sharedState.sys?.turnNumber ?? 'no-turn';
        const nextId = sharedState.sys?.eventStream?.nextId ?? 'no-event';
        const key = `${activeAiPlayerId}:${turnNumber}:${phase}:${nextId}`;
        if (aiActivePhaseRef.current?.key !== key) {
            aiActivePhaseRef.current = { key, startedAt: Date.now() };
        }
    }, [engineConfig, seatControllers, state]);

    useEffect(() => {
        const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
        if (!hasAiSeat || !state) {
            lastAiAttemptKeyRef.current = null;
            activeAiAttemptRef.current = null;
            lastVisibleAiActionAtRef.current = null;
            staleSeatRecoveryRef.current = null;
            return;
        }
        const sharedState = state as MatchState<unknown>;

        let cancelled = false;
        let delayTimer: ReturnType<typeof setTimeout> | null = null;
        let pendingDelayHandle: ReturnType<typeof startCancelableAiDelay> | null = null;

        const scheduleRetryAfterRecovery = () => {
            delayTimer = setTimeout(() => {
                delayTimer = null;
                scheduleAiRetry();
            }, STALE_SEAT_RECOVERY_RETRY_MS);
        };

        const requestAllSeatResync = (reason: string, meta: Record<string, unknown>) => {
            forEachSeatClient((seatPlayerId, seatClient) => {
                requestSeatResync({
                    playerId: seatPlayerId,
                    client: seatClient,
                    reason,
                    meta,
                });
            });
        };

        const tryRecoverOnlineAiSeat = (args: {
            recoveryKey: string | null;
            onRecovered: () => void;
            onMissingKey?: () => void;
        }): boolean => {
            const recoveryFlow = resolveOnlineAiSeatRecoveryFlow({
                recoveryKey: args.recoveryKey,
                lastRecovery: staleSeatRecoveryRef.current,
                onRecovered: args.onRecovered,
                onMissingKey: args.onMissingKey,
            });
            staleSeatRecoveryRef.current = recoveryFlow.nextRecovery;
            if (!recoveryFlow.shouldRecover) {
                return false;
            }
            scheduleRetryAfterRecovery();
            return true;
        };

        const handleBlockedDispatch = (
            aiDispatchResult: Extract<Awaited<ReturnType<typeof resolveNextAiDispatch>>, { kind: 'blocked' }>,
            decisionElapsedMs: number,
        ) => {
            aiSeatDecisionDebugRef.current[aiDispatchResult.playerId] = {
                stage: 'blocked',
                blockedReason: aiDispatchResult.blockedReason,
                visibility: aiDispatchResult.visibility,
                diagnostics: aiDispatchResult.diagnostics,
                updatedAt: Date.now(),
            };
            // Anti-pattern: this legacy current-player field is emitted for diagnostics only.
            // Do not feed it back into seam-aware recovery or dispatch gates.
            logMobileRuntimeCritical('MatchRoom', 'online-ai-dispatch-blocked', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: aiDispatchResult.playerId,
                blockedReason: aiDispatchResult.blockedReason,
                visibility: aiDispatchResult.visibility,
                phase: sharedState.sys?.phase ?? null,
                turnNumber: sharedState.sys?.turnNumber ?? null,
                sharedCurrentPlayerId: resolveCurrentPlayerId(sharedState),
            });
            onlineAiPerfLogger.debug('blocked', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: aiDispatchResult.playerId,
                blockedReason: aiDispatchResult.blockedReason,
                visibility: aiDispatchResult.visibility,
                decisionElapsedMs,
            });
            emitOnlineAiPerf('blocked', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: aiDispatchResult.playerId,
                blockedReason: aiDispatchResult.blockedReason,
                visibility: aiDispatchResult.visibility,
                decisionElapsedMs,
            });
            if (lastAiAttemptKeyRef.current) {
                return;
            }
            const staleDecisionKey = aiDispatchResult.blockedKey;
            if (staleSeatDecisionKeyRef.current !== staleDecisionKey) {
                staleSeatDecisionKeyRef.current = staleDecisionKey;
                appendMatchLoadTrace({
                    stage: 'online-ai-seat-state-stale',
                    source: 'match-room',
                    gameId: engineConfig.gameId,
                    matchId,
                    payload: {
                        playerId: aiDispatchResult.playerId,
                        visibility: aiDispatchResult.visibility,
                        blockedReason: aiDispatchResult.blockedReason,
                        sharedTurnNumber: aiDispatchResult.diagnostics?.sharedTurnNumber ?? null,
                        sharedPhase: aiDispatchResult.diagnostics?.sharedPhase ?? null,
                        sharedCurrentPlayerId: aiDispatchResult.diagnostics?.sharedCurrentPlayerId ?? null,
                        seatTurnNumber: aiDispatchResult.diagnostics?.privateTurnNumber ?? null,
                        seatPhase: aiDispatchResult.diagnostics?.privatePhase ?? null,
                        seatCurrentPlayerId: aiDispatchResult.diagnostics?.privateCurrentPlayerId ?? null,
                    },
                });
                console.warn('[OnlineAiSeatBridge] blocked AI decision', {
                    matchId,
                    gameId: engineConfig.gameId,
                    playerId: aiDispatchResult.playerId,
                    visibility: aiDispatchResult.visibility,
                    blockedReason: aiDispatchResult.blockedReason,
                    sharedTurnNumber: aiDispatchResult.diagnostics?.sharedTurnNumber ?? null,
                    sharedPhase: aiDispatchResult.diagnostics?.sharedPhase ?? null,
                    sharedCurrentPlayerId: aiDispatchResult.diagnostics?.sharedCurrentPlayerId ?? null,
                    seatTurnNumber: aiDispatchResult.diagnostics?.privateTurnNumber ?? null,
                    seatPhase: aiDispatchResult.diagnostics?.privatePhase ?? null,
                    seatCurrentPlayerId: aiDispatchResult.diagnostics?.privateCurrentPlayerId ?? null,
                });
            }
            tryRecoverOnlineAiSeat({
                recoveryKey: staleDecisionKey,
                onRecovered: () => {
                    requestAllSeatResync('blocked-stale-decision', {
                        blockedKey: staleDecisionKey,
                        blockedReason: aiDispatchResult.blockedReason,
                    });
                },
                onMissingKey: () => {
                    staleSeatRecoveryRef.current = null;
                },
            });
        };

        const handleIdleDispatch = (
            aiDispatchResult: Extract<Awaited<ReturnType<typeof resolveNextAiDispatch>>, { kind: 'idle' }>,
            decisionElapsedMs: number,
        ) => {
            const sharedState = state as MatchState<unknown>;
            const activeAiPlayerId = resolveOnlineAiActivePlayerId({
                sharedState,
                seatControllers,
                engineConfig,
            });
            if (activeAiPlayerId) {
                aiSeatDecisionDebugRef.current[activeAiPlayerId] = {
                    stage: 'idle',
                    idleReason: aiDispatchResult.idleReason,
                    updatedAt: Date.now(),
                };
            }
            // Anti-pattern: this legacy current-player field is emitted for diagnostics only.
            // Do not feed it back into seam-aware recovery or dispatch gates.
            logMobileRuntimeCritical('MatchRoom', 'online-ai-dispatch-idle', {
                gameId: engineConfig.gameId,
                matchId,
                idleReason: aiDispatchResult.idleReason,
                phase: sharedState.sys?.phase ?? null,
                turnNumber: sharedState.sys?.turnNumber ?? null,
                sharedCurrentPlayerId: resolveCurrentPlayerId(sharedState),
            });
            onlineAiPerfLogger.debug('idle', {
                gameId: engineConfig.gameId,
                matchId,
                idleReason: aiDispatchResult.idleReason,
                decisionElapsedMs,
            });
            emitOnlineAiPerf('idle', {
                gameId: engineConfig.gameId,
                matchId,
                idleReason: aiDispatchResult.idleReason,
                decisionElapsedMs,
            });
            if (lastAiAttemptKeyRef.current) {
                return;
            }
            if (activeAiPlayerId) {
                const idleDecisionKey = buildOnlineAiIdleSeatRecoveryKey({
                    playerId: activeAiPlayerId,
                    authoritativeState: sharedState,
                    engineConfig,
                });
                tryRecoverOnlineAiSeat({
                    recoveryKey: idleDecisionKey,
                    onRecovered: () => {
                    requestAllSeatResync('idle-active-ai', {
                        blockedKey: idleDecisionKey,
                    });
                    },
                });
            } else {
                staleSeatRecoveryRef.current = null;
            }
            staleSeatDecisionKeyRef.current = null;
        };

        const submitResolvedAction = async (
            resolution: AiResolution,
            startedAt: number,
            decisionResolvedAt: number,
            commandTypes: string[],
        ) => {
            aiSeatDecisionDebugRef.current[resolution.playerId] = {
                stage: 'action',
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                updatedAt: Date.now(),
            };
            // Anti-pattern: this legacy current-player field is emitted for diagnostics only.
            // Do not feed it back into seam-aware recovery or dispatch gates.
            logMobileRuntimeCritical('MatchRoom', 'online-ai-dispatch-action', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                phase: (state as MatchState<unknown>).sys?.phase ?? null,
                turnNumber: sharedState.sys?.turnNumber ?? null,
                sharedCurrentPlayerId: resolveCurrentPlayerId(sharedState),
            });
            if (!tryReserveAiAttemptKey(lastAiAttemptKeyRef, resolution.attemptKey)) {
                aiSeatDecisionDebugRef.current[resolution.playerId] = {
                    stage: 'duplicate-attempt-suppressed',
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    attemptKey: resolution.attemptKey,
                    activeAttemptKey: lastAiAttemptKeyRef.current,
                    updatedAt: Date.now(),
                };
                return;
            }
            activeAiAttemptRef.current = {
                attemptKey: resolution.attemptKey,
                playerId: resolution.playerId,
                reservedAt: Date.now(),
                ...buildOnlineAiSeamAwareAttemptMarkers({
                    sharedState,
                    seatState: getEffectiveSeatState(resolution.playerId),
                    engineConfig,
                }),
                actionKind: resolution.action.kind,
                pendingSelectionId: (() => {
                    const firstCommand = resolution.action.commands[0];
                    return resolveManualSetupSelectionId({
                        actionKind: resolution.action.kind,
                        payload: firstCommand?.payload,
                        engineConfig,
                    });
                })(),
            };

            const controller = seatControllers[resolution.playerId];
            const client = getSeatClient(resolution.playerId);
            if (!controller || controller.type === 'human' || !client?.isConnected) {
                // Anti-pattern: this legacy current-player field is emitted for diagnostics only.
                // Do not feed it back into seam-aware recovery or dispatch gates.
                logMobileRuntimeCritical('MatchRoom', 'online-ai-submit-blocked', {
                    gameId: engineConfig.gameId,
                    matchId,
                    resolutionPlayerId: resolution.playerId,
                    resolutionActionKind: resolution.action.kind,
                    resolutionCommandTypes: commandTypes,
                    hasController: Boolean(controller),
                    controllerType: controller?.type ?? null,
                    hasCredential: Boolean(seatCredentials[resolution.playerId]),
                    hasClient: Boolean(client),
                    clientConnected: Boolean(client?.isConnected),
                    clientHasSeatState: Boolean(client?.latestState),
                    currentPlayerId: resolveCurrentPlayerId(sharedState),
                    phase: sharedState.sys?.phase ?? null,
                    turnNumber: sharedState.sys?.turnNumber ?? null,
                });
                if (controller && controller.type !== 'human' && client) {
                    const submitBlockedRecoveryKey = buildOnlineAiSubmitBlockedRecoveryKey({
                        playerId: resolution.playerId,
                        resolution,
                        authoritativeState: sharedState,
                        engineConfig,
                    });
                    tryRecoverOnlineAiSeat({
                        recoveryKey: submitBlockedRecoveryKey,
                        onRecovered: () => {
                        requestSeatResync({
                            playerId: resolution.playerId,
                            client,
                            reason: 'submit-blocked',
                            meta: {
                                blockedKey: submitBlockedRecoveryKey,
                                actionKind: resolution.action.kind,
                                commandTypes,
                            },
                        });
                        },
                    });
                }
                clearActiveAiAttemptIfMatches(resolution.attemptKey);
                return;
            }

            const now = Date.now();
            const runtime = getGameAiRuntime(engineConfig.gameId);
            const actionVisibility = resolveLocalAiActionVisibility(resolution.action, runtime);
            const preScheduleElapsedMs = now - startedAt;
            const delayPlan = resolveLocalAiActionDelayPlan({
                controller,
                actionVisibility,
                now,
                defaultMinimumActionDelayMs: runtime?.defaultMinimumActionDelayMs,
                lastVisibleActionAt: lastVisibleAiActionAtRef.current,
                observedState: sharedState,
                extraElapsedBudgetMs: [preScheduleElapsedMs],
            });
            const activePhaseElapsedMs = aiActivePhaseRef.current
                ? decisionResolvedAt - aiActivePhaseRef.current.startedAt
                : null;
            onlineAiPerfLogger.info('scheduled', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                controllerType: controller.type,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs: decisionResolvedAt - startedAt,
                activePhaseElapsedMs,
                ...delayPlan,
                clientConnected: client.isConnected,
            });
            emitOnlineAiPerf('scheduled', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                controllerType: controller.type,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs: decisionResolvedAt - startedAt,
                activePhaseElapsedMs,
                ...delayPlan,
                clientConnected: client.isConnected,
            });

            if (delayPlan.remainingDelayMs > 0) {
                pendingDelayHandle = startCancelableAiDelay(delayPlan.remainingDelayMs);
                const delayResult = await pendingDelayHandle.promise;
                pendingDelayHandle = null;
                if (delayResult.outcome === 'cancelled') {
                    onlineAiPerfLogger.warn('delay-cancelled', {
                        gameId: engineConfig.gameId,
                        matchId,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        ...delayPlan,
                        waitedMs: delayResult.waitedMs,
                        cancelled,
                        clientConnected: client.isConnected,
                    });
                    emitOnlineAiPerf('delay-cancelled', {
                        gameId: engineConfig.gameId,
                        matchId,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        ...delayPlan,
                        waitedMs: delayResult.waitedMs,
                        cancelled,
                        clientConnected: client.isConnected,
                    });
                    clearActiveAiAttemptIfMatches(resolution.attemptKey);
                    return;
                }
                onlineAiPerfLogger.info('delay-finished', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    ...delayPlan,
                    waitedMs: delayResult.waitedMs,
                });
                emitOnlineAiPerf('delay-finished', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    ...delayPlan,
                    waitedMs: delayResult.waitedMs,
                });
            }

            if (cancelled || !client.isConnected) {
                onlineAiPerfLogger.warn('submit-skipped', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    cancelled,
                    clientConnected: client.isConnected,
                    ...delayPlan,
                });
                emitOnlineAiPerf('submit-skipped', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    cancelled,
                    clientConnected: client.isConnected,
                    ...delayPlan,
                });
                clearActiveAiAttemptIfMatches(resolution.attemptKey);
                return;
            }

            const submittedAt = Date.now();
            const submitElapsedMs = submittedAt - startedAt;
            if (delayPlan.actionVisibility === 'visible') {
                lastVisibleAiActionAtRef.current = submittedAt;
            }
            onlineAiPerfLogger.info('submitted', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs: decisionResolvedAt - startedAt,
                activePhaseElapsedMs: aiActivePhaseRef.current
                    ? submittedAt - aiActivePhaseRef.current.startedAt
                    : null,
                ...delayPlan,
                submitElapsedMs,
            });
            emitOnlineAiPerf('submitted', {
                gameId: engineConfig.gameId,
                matchId,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs: decisionResolvedAt - startedAt,
                activePhaseElapsedMs: aiActivePhaseRef.current
                    ? submittedAt - aiActivePhaseRef.current.startedAt
                    : null,
                ...delayPlan,
                submitElapsedMs,
            });
            if (submitElapsedMs >= 1200) {
                onlineAiPerfLogger.warn('slow-step', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    decisionElapsedMs: decisionResolvedAt - startedAt,
                    activePhaseElapsedMs: aiActivePhaseRef.current
                        ? submittedAt - aiActivePhaseRef.current.startedAt
                        : null,
                    ...delayPlan,
                    submitElapsedMs,
                });
                emitOnlineAiPerf('slow-step', {
                    gameId: engineConfig.gameId,
                    matchId,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    decisionElapsedMs: decisionResolvedAt - startedAt,
                    activePhaseElapsedMs: aiActivePhaseRef.current
                        ? submittedAt - aiActivePhaseRef.current.startedAt
                        : null,
                    ...delayPlan,
                    submitElapsedMs,
                });
            }

            aiSeatDecisionDebugRef.current[resolution.playerId] = {
                stage: 'submitted',
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                updatedAt: Date.now(),
            };
            const submissionLifecycle = createOnlineAiResolutionSubmissionLifecycle({
                matchId,
                engineConfig,
                sharedState,
                resolution,
                commandTypes,
                client,
                submittedAt,
                lastAiAttemptKeyRef,
                activeAiAttemptRef,
                aiSeatDecisionDebugRef,
                aiSeatStateOverridesRef,
                getSeatLatestState,
                requestSeatResync,
                scheduleAiRetry,
            });
            submitOnlineAiResolution({
                client,
                resolution,
                lastAiAttemptKeyRef,
                scheduleRetry: submissionLifecycle.scheduleRetry,
                engineConfig,
                onWillResync: submissionLifecycle.onWillResync,
                onConfirmed: submissionLifecycle.onConfirmed,
                onRejected: submissionLifecycle.onRejected,
            });
        };

        const runAiTurn = async () => {
            releaseConfirmedOnlineAiAttempt({
                sharedState,
                activeAiAttemptRef,
                aiSeatDecisionDebugRef,
                getEffectiveSeatState,
                getSeatClient,
                requestSeatResync,
                clearActiveAiAttemptIfMatches,
            });
            releaseStaleOnlineAiAttempt({
                engineConfig,
                sharedState,
                activeAiAttemptRef,
                aiSeatDecisionDebugRef,
                getEffectiveSeatState,
                getSeatClient,
                requestSeatResync,
                clearActiveAiAttemptIfMatches,
            });

            const startedAt = Date.now();
            const aiDispatchResult = await resolveNextAiDispatch({
                engineConfig: engineConfig as GameEngineConfig,
                state,
                matchId,
                seatControllers,
                visibleStateResolver: (playerId) => {
                    const sharedState = state as MatchState<unknown>;
                    const privateOverlay = getEffectiveSeatState(playerId);
                    return resolveOnlineAiDecisionView({
                        runtime: getGameImplementation(engineConfig.gameId).ai,
                        sharedState,
                        privateOverlay,
                        playerId,
                    });
                },
            });
            const decisionResolvedAt = Date.now();
            const decisionElapsedMs = decisionResolvedAt - startedAt;

            if (cancelled) {
                return;
            }

            if (aiDispatchResult.kind === 'blocked') {
                handleBlockedDispatch(aiDispatchResult, decisionElapsedMs);
                return;
            }

            if (aiDispatchResult.kind === 'idle') {
                handleIdleDispatch(aiDispatchResult, decisionElapsedMs);
                return;
            }

            staleSeatDecisionKeyRef.current = null;
            staleSeatRecoveryRef.current = null;
            const resolution = aiDispatchResult.resolution;
            const commandTypes = resolution.action.commands.map((command) => command.type);
            await submitResolvedAction(resolution, startedAt, decisionResolvedAt, commandTypes);
        };

        void runAiTurn();

        return () => {
            cancelled = true;
            if (delayTimer) {
                clearTimeout(delayTimer);
            }
            pendingDelayHandle?.cancel();
            pendingDelayHandle = null;
        };
    }, [
        aiRetryVersion,
        aiSeatDecisionDebugRef,
        aiSeatStateOverridesRef,
        clearActiveAiAttemptIfMatches,
        engineConfig,
        connectionVersion,
        forEachSeatClient,
        getEffectiveSeatState,
        getSeatClient,
        getSeatLatestState,
        lastAiAttemptKeyRef,
        matchId,
        requestSeatResync,
        seatControllers,
        seatCredentials,
        scheduleAiRetry,
        state,
    ]);
}
