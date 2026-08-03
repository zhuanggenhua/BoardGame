import { useCallback, useEffect, useRef, useState } from 'react';
import { buildAiProgressMarker } from '../engine/transport/react';
import { GameTransportClient } from '../engine/transport/client';
import type { OnlineAiRecoveryEngineConfig } from '../engine/transport/onlineAiRecovery';
import type { MatchState } from '../engine/types';
import type { AiSeatController } from '../engine/ai';
import { onAppVisible } from '../lib/mobile/appVisibility';
import {
    buildOnlineAiSeamAwareProgressMarker,
    resolveOnlineAiEffectiveSeatState,
    resolveOnlineAiEffectiveSeatStates,
    shouldRetainOnlineAiSeatOverrideAfterLatestState,
} from './onlineAiRecovery';
import type { ManualSetupSeatDispatch } from './onlineManualSetup.types';
import {
    aiRuntimeTruthLogger,
    emitAiRuntimeTruth,
    emitOnlineAiTransport,
    onlineAiTransportLogger,
    summarizeSeatControllerTypes,
    type OnlineAiDebugWindow,
} from './onlineAiRuntimeSupport';
import { resolveCurrentPlayerId } from './onlineAiForceSkip';

const RECOVERY_FAILURE_SYNC_GRACE_MS = 700;

export type OnlineAiSeatResyncRequest = {
    playerId: string;
    client: Pick<GameTransportClient, 'resync' | 'latestState' | 'isConnected'>;
    reason: string;
    meta?: Record<string, unknown>;
};

export type OnlineAiSeatRecoveryFailureNoticeRequest = {
    targetClient: GameTransportClient;
    playerId: string;
    markerBefore: string;
    onStillStalled: () => void;
};

export type OnlineAiSeatTransportRuntime = {
    aiRetryVersion: number;
    aiSeatDecisionDebugRef: { current: Record<string, Record<string, unknown>> };
    aiSeatStateOverridesRef: { current: Record<string, MatchState<unknown> | null> };
    connectionVersion: number;
    forEachSeatClient: (visitor: (playerId: string, client: GameTransportClient) => void) => void;
    getEffectiveSeatState: (playerId: string) => MatchState<unknown> | null;
    getEffectiveSeatStates: () => Record<string, MatchState<unknown> | null>;
    getSeatClient: (playerId: string) => GameTransportClient | null;
    getSeatLatestState: (playerId: string) => MatchState<unknown> | null;
    requestSeatResync: (request: OnlineAiSeatResyncRequest) => void;
    scheduleRecoveryFailureNotice: (request: OnlineAiSeatRecoveryFailureNoticeRequest) => void;
    scheduleAiRetry: () => void;
};

export function useOnlineAiSeatTransportRuntime(args: {
    server: string;
    matchId: string;
    engineConfig: OnlineAiRecoveryEngineConfig;
    seatControllers: Record<string, AiSeatController>;
    seatCredentials: Record<string, string>;
    state: MatchState<unknown> | null;
    onManualSetupDispatchReady?: (handler: ManualSetupSeatDispatch | null) => void;
}) {
    const {
        server,
        matchId,
        engineConfig,
        seatControllers,
        seatCredentials,
        state,
        onManualSetupDispatchReady,
    } = args;
    const clientsRef = useRef<Record<string, GameTransportClient>>({});
    const [connectionVersion, setConnectionVersion] = useState(0);
    const [aiRetryVersion, setAiRetryVersion] = useState(0);
    const aiRuntimeTruthKeyRef = useRef<string | null>(null);
    const latestSharedStateRef = useRef<MatchState<unknown> | null>(null);
    const pendingRecoveryCheckTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
    const aiSeatStateOverridesRef = useRef<Record<string, MatchState<unknown> | null>>({});
    const aiSeatDecisionDebugRef = useRef<Record<string, Record<string, unknown>>>({});
    const pendingSeatResyncRef = useRef<Record<string, {
        requestedAt: number;
        reason: string;
        meta?: Record<string, unknown>;
    }>>({});
    const scheduleAiRetry = useCallback(() => {
        setAiRetryVersion((version) => version + 1);
    }, []);

    useEffect(() => {
        if (!onManualSetupDispatchReady) {
            return;
        }

        const dispatchManualSetupCommand: ManualSetupSeatDispatch = (playerId, type, payload) => {
            const client = clientsRef.current[playerId];
            if (!client?.isConnected) {
                return false;
            }
            client.sendCommand(type, payload);
            return true;
        };

        onManualSetupDispatchReady(dispatchManualSetupCommand);
        return () => {
            onManualSetupDispatchReady(null);
        };
    }, [onManualSetupDispatchReady]);

    const getSeatLatestState = useCallback((playerId: string): MatchState<unknown> | null => {
        const latestState = clientsRef.current[playerId]?.latestState;
        return latestState && typeof latestState === 'object'
            ? latestState as MatchState<unknown>
            : null;
    }, []);

    const getSeatClient = useCallback((playerId: string): GameTransportClient | null => (
        clientsRef.current[playerId] ?? null
    ), []);

    const forEachSeatClient = useCallback((visitor: (playerId: string, client: GameTransportClient) => void) => {
        for (const [playerId, client] of Object.entries(clientsRef.current)) {
            visitor(playerId, client);
        }
    }, []);

    const getEffectiveSeatState = useCallback((playerId: string): MatchState<unknown> | null => (
        resolveOnlineAiEffectiveSeatState({
            playerId,
            seatStateOverrides: aiSeatStateOverridesRef.current,
            seatLatestStates: {
                [playerId]: getSeatLatestState(playerId),
            },
            engineConfig,
        })
    ), [engineConfig, getSeatLatestState]);

    const getEffectiveSeatStates = useCallback((): Record<string, MatchState<unknown> | null> => (
        resolveOnlineAiEffectiveSeatStates({
            playerIds: Object.keys(clientsRef.current),
            seatStateOverrides: aiSeatStateOverridesRef.current,
            seatLatestStates: Object.fromEntries(
                Object.keys(clientsRef.current).map((playerId) => [playerId, getSeatLatestState(playerId)]),
            ),
            engineConfig,
        })
    ), [engineConfig, getSeatLatestState]);

    useEffect(() => {
        latestSharedStateRef.current = state;
    }, [state]);

    useEffect(() => {
        const sharedState = state;
        const seatControllerTypes = summarizeSeatControllerTypes(seatControllers);
        const hasAiSeat = Object.values(seatControllerTypes).some((type) => type !== 'human');
        // Anti-pattern: this legacy current-player snapshot is for runtime telemetry only.
        // Do not promote it back into seam-aware dispatch or recovery behavior.
        const currentPlayerId = sharedState ? resolveCurrentPlayerId(sharedState) : null;
        const currentControllerType = currentPlayerId
            ? (seatControllerTypes[currentPlayerId] ?? 'human')
            : null;
        const aiClientStates = Object.fromEntries(
            Object.entries(seatControllerTypes)
                .filter(([, type]) => type !== 'human')
                .map(([playerId]) => {
                    const client = clientsRef.current[playerId];
                    return [playerId, {
                        connected: Boolean(client?.isConnected),
                        hasCredential: Boolean(seatCredentials[playerId]),
                        hasSeatState: Boolean(client?.latestState),
                    }];
                }),
        );
        const payload = {
            mode: 'online',
            source: 'OnlineAiSeatBridge',
            gameId: engineConfig.gameId,
            matchId,
            hasAiSeat,
            currentPlayerId,
            currentControllerType,
            phase: sharedState?.sys?.phase ?? null,
            turnNumber: sharedState?.sys?.turnNumber ?? null,
            seatControllerTypes,
            aiClientStates,
        };
        const nextKey = JSON.stringify(payload);
        if (aiRuntimeTruthKeyRef.current === nextKey) {
            return;
        }
        aiRuntimeTruthKeyRef.current = nextKey;
        aiRuntimeTruthLogger.info('online-seat-bridge-state', payload);
        emitAiRuntimeTruth('online-seat-bridge-state', payload);
        if (!hasAiSeat) {
            const disabledPayload = {
                mode: 'online',
                source: 'OnlineAiSeatBridge',
                gameId: engineConfig.gameId,
                matchId,
                reason: 'all-human-seats',
                seatControllerTypes,
            };
            aiRuntimeTruthLogger.warn('online-ai-disabled', disabledPayload);
            emitAiRuntimeTruth('online-ai-disabled', disabledPayload);
        }
    }, [
        connectionVersion,
        engineConfig.gameId,
        matchId,
        seatControllers,
        seatCredentials,
        state,
    ]);

    useEffect(() => {
        if (typeof window === 'undefined' || !import.meta.env.DEV) {
            return;
        }
        const debugWindow = window as OnlineAiDebugWindow;
        debugWindow.__BG_ONLINE_AI_DEBUG__ = {
            getSeatLatestState: (playerId: string) => getEffectiveSeatState(playerId),
            getSeatDecisionState: (playerId: string) => aiSeatDecisionDebugRef.current[playerId] ?? null,
            getTransportLog: () => debugWindow.__BG_ONLINE_AI_TRANSPORT_LOG__ ?? [],
            getPerfLog: () => debugWindow.__BG_ONLINE_AI_PERF_LOG__ ?? [],
            setSeatLatestStateOverride: (playerId: string, nextState: MatchState<unknown> | null) => {
                aiSeatStateOverridesRef.current[playerId] = nextState;
            },
            clearSeatLatestStateOverride: (playerId: string) => {
                delete aiSeatStateOverridesRef.current[playerId];
            },
            clearAllSeatLatestStateOverrides: () => {
                aiSeatStateOverridesRef.current = {};
            },
        };
        return () => {
            delete debugWindow.__BG_ONLINE_AI_DEBUG__;
        };
    }, [getEffectiveSeatState]);

    useEffect(() => {
        const pendingTimers = pendingRecoveryCheckTimersRef.current;
        return () => {
            for (const timer of pendingTimers) {
                clearTimeout(timer);
            }
            pendingTimers.clear();
        };
    }, []);

    const requestSeatResync = useCallback((request: OnlineAiSeatResyncRequest) => {
        const { playerId, client, reason, meta } = request;
        pendingSeatResyncRef.current[playerId] = {
            requestedAt: Date.now(),
            reason,
            meta,
        };
        // Anti-pattern: this payload is debug-only and still uses the legacy marker shape.
        // Do not reuse it for seam-aware recovery or dispatch decisions.
        const payload = {
            matchId,
            gameId: engineConfig.gameId,
            playerId,
            reason,
            clientConnected: client.isConnected,
            currentSeatMarker: getEffectiveSeatState(playerId)
                ? buildAiProgressMarker(getEffectiveSeatState(playerId) as MatchState<unknown>)
                : null,
            ...(meta ?? {}),
        };
        onlineAiTransportLogger.warn('resync-requested', payload);
        emitOnlineAiTransport('resync-requested', payload);
        client.resync();
    }, [engineConfig.gameId, getEffectiveSeatState, matchId]);

    const scheduleRecoveryFailureNotice = useCallback((request: OnlineAiSeatRecoveryFailureNoticeRequest) => {
        const { targetClient, playerId, markerBefore, onStillStalled } = request;
        requestSeatResync({
            playerId,
            client: targetClient,
            reason: 'recovery-failure-check',
            meta: { markerBefore },
        });
        const timer = setTimeout(() => {
            pendingRecoveryCheckTimersRef.current.delete(timer);
            const sharedMarker = latestSharedStateRef.current
                ? buildOnlineAiSeamAwareProgressMarker({
                    state: latestSharedStateRef.current,
                    engineConfig,
                })
                : markerBefore;
            const seatState = getEffectiveSeatState(playerId);
            const seatMarker = seatState
                ? buildOnlineAiSeamAwareProgressMarker({
                    state: seatState,
                    engineConfig,
                })
                : markerBefore;
            if (sharedMarker !== markerBefore || seatMarker !== markerBefore) {
                return;
            }
            onStillStalled();
        }, RECOVERY_FAILURE_SYNC_GRACE_MS);
        pendingRecoveryCheckTimersRef.current.add(timer);
    }, [engineConfig, getEffectiveSeatState, requestSeatResync]);

    useEffect(() => {
        const nextClientKeys = new Set(
            Object.entries(seatControllers)
                .filter(([playerId, controller]) => controller.type !== 'human' && Boolean(seatCredentials[playerId]))
                .map(([playerId]) => playerId),
        );

        for (const [playerId, client] of Object.entries(clientsRef.current)) {
            if (nextClientKeys.has(playerId)) {
                continue;
            }
            client.disconnect();
            delete clientsRef.current[playerId];
        }

        for (const playerId of nextClientKeys) {
            if (clientsRef.current[playerId]) {
                continue;
            }
            const client = new GameTransportClient({
                server,
                matchID: matchId,
                playerID: playerId,
                credentials: seatCredentials[playerId],
                onStateUpdate: (nextState) => {
                    const pendingResync = pendingSeatResyncRef.current[playerId];
                    const authoritativeState = nextState && typeof nextState === 'object'
                        ? nextState as MatchState<unknown>
                        : null;
                    const marker = authoritativeState ? buildAiProgressMarker(authoritativeState) : null;
                    const payload = {
                        matchId,
                        gameId: engineConfig.gameId,
                        playerId,
                        phase: authoritativeState?.sys?.phase ?? null,
                        turnNumber: authoritativeState?.sys?.turnNumber ?? null,
                        // Anti-pattern: transport debug logs still expose legacy current-player / marker fields.
                        // They are observational only and must not be promoted back into behavior gates.
                        currentPlayerId: authoritativeState ? resolveCurrentPlayerId(authoritativeState) : null,
                        marker,
                        pendingResyncReason: pendingResync?.reason ?? null,
                        resyncElapsedMs: pendingResync ? Date.now() - pendingResync.requestedAt : null,
                    };
                    onlineAiTransportLogger.info('state-update', payload);
                    emitOnlineAiTransport('state-update', payload);
                    delete pendingSeatResyncRef.current[playerId];
                    const existingOverride = aiSeatStateOverridesRef.current[playerId];
                    if (!shouldRetainOnlineAiSeatOverrideAfterLatestState({
                        seatStateOverride: existingOverride,
                        latestSeatState: authoritativeState,
                        engineConfig,
                    })) {
                        delete aiSeatStateOverridesRef.current[playerId];
                    }
                    scheduleAiRetry();
                },
                onConnectionChange: (connected) => {
                    const pendingResync = pendingSeatResyncRef.current[playerId];
                    const payload = {
                        matchId,
                        gameId: engineConfig.gameId,
                        playerId,
                        connected,
                        pendingResyncReason: pendingResync?.reason ?? null,
                        resyncElapsedMs: pendingResync ? Date.now() - pendingResync.requestedAt : null,
                    };
                    onlineAiTransportLogger.info('connection-change', payload);
                    emitOnlineAiTransport('connection-change', payload);
                    setConnectionVersion((version) => version + 1);
                },
                onError: (error) => {
                    const pendingResync = pendingSeatResyncRef.current[playerId];
                    const payload = {
                        matchId,
                        gameId: engineConfig.gameId,
                        playerId,
                        error,
                        pendingResyncReason: pendingResync?.reason ?? null,
                        resyncElapsedMs: pendingResync ? Date.now() - pendingResync.requestedAt : null,
                    };
                    onlineAiTransportLogger.warn('transport-error', payload);
                    emitOnlineAiTransport('transport-error', payload);
                    if (error === 'stale_state') {
                        requestSeatResync({
                            playerId,
                            client: clientsRef.current[playerId] ?? client,
                            reason: 'stale-command-state',
                        });
                    }
                },
                onDebugEvent: (event) => {
                    const payload = {
                        matchId,
                        gameId: engineConfig.gameId,
                        playerId,
                        ...event,
                    };
                    if (event.stage === 'sync-timeout'
                        || event.stage === 'patch-discontinuity'
                        || event.stage === 'patch-apply-failed') {
                        onlineAiTransportLogger.warn(event.stage, payload);
                    } else {
                        onlineAiTransportLogger.info(event.stage, payload);
                    }
                    emitOnlineAiTransport(event.stage, payload);
                },
            });
            client.connect();
            clientsRef.current[playerId] = client;
        }

        return () => {
            for (const client of Object.values(clientsRef.current)) {
                client.disconnect();
            }
            clientsRef.current = {};
        };
    }, [
        engineConfig,
        engineConfig.gameId,
        matchId,
        requestSeatResync,
        scheduleAiRetry,
        seatControllers,
        seatCredentials,
        server,
    ]);

    useEffect(() => {
        return onAppVisible(() => {
            for (const [playerId, client] of Object.entries(clientsRef.current)) {
                requestSeatResync({
                    playerId,
                    client,
                    reason: 'app-visible',
                });
            }
            scheduleAiRetry();
        });
    }, [requestSeatResync, scheduleAiRetry]);

    const runtime: OnlineAiSeatTransportRuntime = {
        aiRetryVersion,
        aiSeatDecisionDebugRef,
        aiSeatStateOverridesRef,
        connectionVersion,
        forEachSeatClient,
        getEffectiveSeatState,
        getEffectiveSeatStates,
        getSeatClient,
        getSeatLatestState,
        requestSeatResync,
        scheduleRecoveryFailureNotice,
        scheduleAiRetry,
    };

    return runtime;
}
