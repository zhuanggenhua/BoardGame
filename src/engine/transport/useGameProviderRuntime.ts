import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { MatchState } from '../types';
import type { EngineSystem } from '../systems/types';
import { TestHarness, isTestEnvironment } from '../testing';
import { INTERACTION_COMMANDS, refreshInteractionOptions } from '../systems/InteractionSystem';
import { getTransportBatchCommands, TRANSPORT_BATCH_COMMAND } from '../batchDispatchCommand';
import type {
    ManualForceEndAiPhaseResult,
    ManualSetupSelectionRequest,
    ManualSetupSelectionResult,
    MatchPlayerInfo,
} from './protocol';
import type { GameEngineConfig } from './engineConfig';
import { GameTransportClient } from './client';
import type { LatencyOptimizationConfig } from './latency/types';
import { createOptimisticEngine, filterPlayedEvents, type OptimisticEngine as OptimisticEngineType } from './latency/optimisticEngine';
import {
    shouldRecoverFromRejectedCommandError,
    shouldForwardOnlineBatchRejectionToError as baseShouldForwardOnlineBatchRejectionToError,
} from './aiAttemptGuard';
import {
    buildAiProgressMarker,
    shouldSilentlyRetryOnlineAiBatchRejection,
} from './onlineAiRecovery';
import { normalizeReceivedStateForGame } from './stateNormalization';
import { createCommandBatcher, type CommandBatcher } from './latency/commandBatcher';
import { onAppVisible } from '../../lib/mobile/appVisibility';
import type { EventStreamRollbackValue } from '../hooks/EventStreamRollbackContext';
import type { GameClientContextValue } from './reactContext';
import { useOptionalToast } from '../../contexts/useOptionalToast';

const SERIALIZED_COMMAND_TYPES = new Set(['ADVANCE_PHASE']);
const PENDING_COMPANION_COMMAND_TYPES = new Set<string>([
    INTERACTION_COMMANDS.CONFIRM,
]);
const COMMAND_PENDING_TOAST_DEDUPE_KEY = 'game-provider:command-pending';

function shouldSerializeCommand(type: string): boolean {
    return SERIALIZED_COMMAND_TYPES.has(type);
}

function canSendWhileOptimisticPending(type: string): boolean {
    return PENDING_COMPANION_COMMAND_TYPES.has(type);
}

function canDeferCommandWaitingForPreviousStep(type: string): boolean {
    return shouldSerializeCommand(type);
}

type DeferredCommand = {
    type: string;
    payload: unknown;
};

export function useGameProviderRuntime(args: {
    server: string;
    matchId: string;
    playerId: string | null;
    credentials?: string;
    onError?: (error: string) => void;
    onConnectionChange?: (connected: boolean) => void;
    onStateReady?: () => void;
    engineConfig?: GameEngineConfig;
    latencyConfig?: LatencyOptimizationConfig;
}): {
    rollbackSignal: EventStreamRollbackValue;
    value: GameClientContextValue;
} {
    const {
        server,
        matchId,
        playerId,
        credentials,
        onError,
        onConnectionChange,
        onStateReady,
        engineConfig,
        latencyConfig,
    } = args;
    const [state, setState] = useState<MatchState<unknown> | null>(null);
    const [matchPlayers, setMatchPlayers] = useState<MatchPlayerInfo[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef<GameTransportClient | null>(null);
    const optimisticEngineRef = useRef<OptimisticEngineType | null>(null);
    const batcherRef = useRef<CommandBatcher | null>(null);
    const batchSeqRef = useRef(0);
    const lastConfirmedStateIDRef = useRef<number | null>(null);
    const commandDispatchBlockedUntilSyncRef = useRef(false);
    const inFlightSerializedCommandTypeRef = useRef<string | null>(null);
    const lastSerializedCommandRef = useRef<DeferredCommand | null>(null);
    const deferredSerializedCommandRef = useRef<DeferredCommand | null>(null);
    const dispatchRef = useRef<((type: string, payload: unknown) => boolean) | null>(null);
    const engineConfigRef = useRef(engineConfig);
    const [rollbackSignal, setRollbackSignal] = useState<EventStreamRollbackValue>({
        watermark: null,
        seq: 0,
        reconcileSeq: 0,
    });
    const onErrorRef = useRef(onError);
    const onConnectionChangeRef = useRef(onConnectionChange);
    const onStateReadyRef = useRef(onStateReady);
    const hasReportedStateReadyRef = useRef(false);
    const toast = useOptionalToast();

    const notifyCommandWaitingForPreviousStep = useCallback((queued = false) => {
        toast?.info(
            {
                kind: 'i18n',
                ns: 'common',
                key: queued
                    ? 'toast.commandQueuedAfterPreviousStep'
                    : 'toast.commandWaitingForPreviousStep',
            },
            undefined,
            { dedupeKey: COMMAND_PENDING_TOAST_DEDUPE_KEY, ttlMs: 2500 },
        );
    }, [toast]);

    const deferCommandWaitingForPreviousStep = useCallback((type: string, payload: unknown): boolean => {
        const shouldDefer = canDeferCommandWaitingForPreviousStep(type);
        if (shouldDefer && !deferredSerializedCommandRef.current) {
            deferredSerializedCommandRef.current = { type, payload };
        }
        notifyCommandWaitingForPreviousStep(shouldDefer);
        return shouldDefer;
    }, [notifyCommandWaitingForPreviousStep]);

    const clearDeferredSerializedCommand = useCallback(() => {
        deferredSerializedCommandRef.current = null;
    }, []);

    const flushDeferredSerializedCommand = useCallback(() => {
        const command = deferredSerializedCommandRef.current;
        if (!command) {
            return;
        }
        if (optimisticEngineRef.current?.hasPendingCommands()) {
            return;
        }
        const dispatchCurrent = dispatchRef.current;
        if (!dispatchCurrent) {
            return;
        }
        // 只有命令真正交给 transport 后才能移除排队项。
        // 连接尚未就绪或发送被拒绝时保留它，等待后续权威同步/重连继续尝试。
        if (dispatchCurrent(command.type, command.payload)) {
            deferredSerializedCommandRef.current = null;
        } else if (!deferredSerializedCommandRef.current) {
            // 发送失败的恢复路径会清理 deferred ref；把当前命令放回队列，
            // 避免一次瞬时传输失败吞掉玩家已经点击的下一步。
            deferredSerializedCommandRef.current = command;
        }
    }, []);

    const resetOptimisticProviderRuntime = useCallback((): boolean => {
        optimisticEngineRef.current?.reset();
        setRollbackSignal((prev) => ({
            watermark: null,
            seq: prev.seq + 1,
            reconcileSeq: prev.reconcileSeq,
        }));
        return Boolean(optimisticEngineRef.current);
    }, []);

    const requestProviderResync = useCallback((force = false) => {
        if (force) {
            clientRef.current?.resync({ force: true });
            return;
        }
        clientRef.current?.resync();
    }, []);

    const rollbackOptimisticRenderAndResync = useCallback(() => {
        commandDispatchBlockedUntilSyncRef.current = true;
        inFlightSerializedCommandTypeRef.current = null;
        clearDeferredSerializedCommand();
        resetOptimisticProviderRuntime();
        const latestState = clientRef.current?.latestState;
        if (latestState) {
            const normalizedLatestState = normalizeReceivedStateForGame(
                engineConfigRef.current,
                latestState as MatchState<unknown>,
            );
            setState(refreshInteractionOptions(normalizedLatestState));
        }
        requestProviderResync(true);
    }, [clearDeferredSerializedCommand, requestProviderResync, resetOptimisticProviderRuntime]);

    const recoverFromRejectedCommand = useCallback((reason: string) => {
        if (!shouldRecoverFromRejectedCommandError(reason)) {
            return;
        }
        commandDispatchBlockedUntilSyncRef.current = true;
        inFlightSerializedCommandTypeRef.current = null;
        if (!deferredSerializedCommandRef.current && lastSerializedCommandRef.current) {
            deferredSerializedCommandRef.current = lastSerializedCommandRef.current;
        }
        resetOptimisticProviderRuntime();
        requestProviderResync();
    }, [clearDeferredSerializedCommand, requestProviderResync, resetOptimisticProviderRuntime]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        onConnectionChangeRef.current = onConnectionChange;
    }, [onConnectionChange]);

    useEffect(() => {
        onStateReadyRef.current = onStateReady;
    }, [onStateReady]);

    useEffect(() => {
        engineConfigRef.current = engineConfig;
    }, [engineConfig]);

    useEffect(() => {
        if (!latencyConfig?.optimistic?.enabled || !engineConfig) {
            optimisticEngineRef.current = null;
            return;
        }
        optimisticEngineRef.current = createOptimisticEngine({
            pipelineConfig: {
                domain: engineConfig.domain,
                systems: engineConfig.systems as EngineSystem<unknown>[],
                systemsConfig: engineConfig.systemsConfig,
            },
            commandDeterminism: latencyConfig.optimistic.commandDeterminism ?? {},
            commandAnimationMode: latencyConfig.optimistic.animationMode ?? {},
            playerIds: [],
        });
    }, [engineConfig, latencyConfig]);

    useEffect(() => {
        if (!latencyConfig?.batching?.enabled) {
            batcherRef.current = null;
            return;
        }
        const batcher = createCommandBatcher({
            windowMs: latencyConfig.batching.windowMs ?? 50,
            maxBatchSize: latencyConfig.batching.maxBatchSize ?? 10,
            immediateCommands: latencyConfig.batching.immediateCommands ?? [],
            onFlush: (commands) => {
                const client = clientRef.current;
                if (!client) return false;
                if (commands.length === 1) {
                    return client.sendCommand(commands[0].type, commands[0].payload);
                } else {
                    const batchId = `b-${++batchSeqRef.current}`;
                    return client.sendBatch(batchId, commands, undefined, (reason) => {
                        recoverFromRejectedCommand(reason);
                        if (baseShouldForwardOnlineBatchRejectionToError(reason, shouldSilentlyRetryOnlineAiBatchRejection)) {
                            onErrorRef.current?.(reason);
                        }
                    });
                }
            },
        });
        batcherRef.current = batcher;
        return () => {
            batcher.destroy();
            batcherRef.current = null;
        };
    }, [latencyConfig, recoverFromRejectedCommand]);

    useEffect(() => {
        const client = new GameTransportClient({
            server,
            matchID: matchId,
            playerID: playerId,
            credentials,
            onStateUpdate: (newState, players, meta, randomMeta) => {
                const normalizedAuthoritativeState = normalizeReceivedStateForGame(
                    engineConfigRef.current,
                    newState as MatchState<unknown>,
                );
                if (!hasReportedStateReadyRef.current) {
                    hasReportedStateReadyRef.current = true;
                    onStateReadyRef.current?.();
                }

                if (meta?.stateID !== undefined && lastConfirmedStateIDRef.current !== null) {
                    if (meta.stateID < lastConfirmedStateIDRef.current) {
                        console.warn('[GameProvider] 忽略旧状态更新', {
                            receivedStateID: meta.stateID,
                            currentStateID: lastConfirmedStateIDRef.current,
                            receivedTurnNumber: normalizedAuthoritativeState.core
                                ? (normalizedAuthoritativeState.core as { turnNumber?: number }).turnNumber
                                : undefined,
                        });
                        return;
                    }
                }

                commandDispatchBlockedUntilSyncRef.current = false;
                inFlightSerializedCommandTypeRef.current = null;
                lastSerializedCommandRef.current = null;

                if (meta?.stateID !== undefined) {
                    lastConfirmedStateIDRef.current = meta.stateID;
                }

                const engine = optimisticEngineRef.current;
                let finalState: MatchState<unknown>;
                if (engine) {
                    if (players.length > 0) {
                        engine.setPlayerIds(players.map((player) => String(player.id)));
                    }
                    if (randomMeta) {
                        engine.syncRandom(randomMeta.seed, randomMeta.cursor);
                    }
                    const hadPendingBeforeReconcile = engine.hasPendingCommands();
                    const result = engine.reconcile(normalizedAuthoritativeState, meta);

                    if (result.didRollback && result.optimisticEventWatermark !== null) {
                        setRollbackSignal((prev) => ({
                            watermark: result.optimisticEventWatermark,
                            seq: prev.seq + 1,
                            reconcileSeq: prev.reconcileSeq,
                        }));
                        finalState = filterPlayedEvents(result.stateToRender, result.optimisticEventWatermark);
                    } else if (!result.didRollback && hadPendingBeforeReconcile) {
                        setRollbackSignal((prev) => ({
                            watermark: null,
                            seq: prev.seq,
                            reconcileSeq: prev.reconcileSeq + 1,
                        }));
                        finalState = result.stateToRender;
                    } else {
                        finalState = result.stateToRender;
                    }
                } else {
                    finalState = normalizedAuthoritativeState;
                }

                client.updateLatestState(normalizedAuthoritativeState);

                const refreshedState = refreshInteractionOptions(finalState);
                setState(refreshedState);
                setMatchPlayers(players);
                flushDeferredSerializedCommand();
            },
            onConnectionChange: (connected) => {
                setIsConnected(connected);
                onConnectionChangeRef.current?.(connected);
                if (connected) {
                    resetOptimisticProviderRuntime();
                }
                if (!connected) {
                    commandDispatchBlockedUntilSyncRef.current = false;
                    inFlightSerializedCommandTypeRef.current = null;
                    lastSerializedCommandRef.current = null;
                    clearDeferredSerializedCommand();
                    lastConfirmedStateIDRef.current = null;
                }
            },
            onError: (error) => {
                recoverFromRejectedCommand(error);
                onErrorRef.current?.(error);
            },
            onPlayerConnectionChange: (connectionPlayerId, connected) => {
                setMatchPlayers((previous) => previous.map((player) => {
                    if (String(player.id) !== String(connectionPlayerId)) {
                        return player;
                    }
                    if (player.isConnected === connected) {
                        return player;
                    }
                    return {
                        ...player,
                        isConnected: connected,
                    };
                }));
            },
        });

        clientRef.current = client;
        client.connect();

        return () => {
            hasReportedStateReadyRef.current = false;
            client.disconnect();
            clientRef.current = null;
        };
    }, [clearDeferredSerializedCommand, credentials, flushDeferredSerializedCommand, matchId, playerId, recoverFromRejectedCommand, resetOptimisticProviderRuntime, server]);

    useEffect(() => {
        return onAppVisible(() => {
            const client = clientRef.current;
            if (!client) return;
            clearDeferredSerializedCommand();
            resetOptimisticProviderRuntime();
            requestProviderResync(true);
        });
    }, [clearDeferredSerializedCommand, requestProviderResync, resetOptimisticProviderRuntime]);

    const dispatch = useCallback((type: string, payload: unknown): boolean => {
        if (commandDispatchBlockedUntilSyncRef.current) {
            notifyCommandWaitingForPreviousStep();
            return false;
        }
        if (inFlightSerializedCommandTypeRef.current === type) {
            deferCommandWaitingForPreviousStep(type, payload);
            return false;
        }
        const client = clientRef.current;
        if (!client?.canSendCommand()) {
            notifyCommandWaitingForPreviousStep();
            return false;
        }
        if (type === TRANSPORT_BATCH_COMMAND) {
            const commands = getTransportBatchCommands(payload);
            if (commands.length === 0) {
                return false;
            }
            const engine = optimisticEngineRef.current;
            if (engine?.hasPendingCommands()) {
                notifyCommandWaitingForPreviousStep();
                return false;
            }
            const batcher = batcherRef.current;
            if (batcher && !batcher.flush()) {
                if (engine) {
                    rollbackOptimisticRenderAndResync();
                }
                return false;
            }
            const batchId = `b-${++batchSeqRef.current}`;
            const sent = client.sendBatch(batchId, commands, undefined, (reason) => {
                recoverFromRejectedCommand(reason);
                if (baseShouldForwardOnlineBatchRejectionToError(reason, shouldSilentlyRetryOnlineAiBatchRejection)) {
                    onErrorRef.current?.(reason);
                }
            });
            if (!sent && engine) {
                rollbackOptimisticRenderAndResync();
            }
            return sent;
        }
        const engine = optimisticEngineRef.current;
        const sendWithoutPrediction = Boolean(engine?.hasPendingCommands() && canSendWhileOptimisticPending(type));
        if (engine?.hasPendingCommands() && !sendWithoutPrediction) {
            deferCommandWaitingForPreviousStep(type, payload);
            return false;
        }
        let shouldSend = true;
        if (engine && !sendWithoutPrediction) {
            const result = engine.processCommand(type, payload, playerId ?? '0');
            shouldSend = result.shouldSend;
            if (result.stateToRender) {
                const refreshed = refreshInteractionOptions(result.stateToRender);
                setState(refreshed);
            }
        }
        if (!shouldSend) {
            return true;
        }
        const batcher = batcherRef.current;
        let sent = false;
        if (batcher) {
            sent = batcher.enqueue(type, payload);
        } else {
            sent = client.sendCommand(type, payload);
        }
        if (!sent && engine) {
            rollbackOptimisticRenderAndResync();
            return false;
        }
        if (sent && shouldSerializeCommand(type)) {
            inFlightSerializedCommandTypeRef.current = type;
            lastSerializedCommandRef.current = { type, payload };
        }
        return sent;
    }, [deferCommandWaitingForPreviousStep, notifyCommandWaitingForPreviousStep, playerId, recoverFromRejectedCommand, rollbackOptimisticRenderAndResync]);

    useEffect(() => {
        dispatchRef.current = dispatch;
    }, [dispatch]);

    const requestManualSetupSelection = useCallback((
        request: ManualSetupSelectionRequest,
        onResult?: (result: ManualSetupSelectionResult) => void,
    ): boolean => (
        clientRef.current?.requestManualSetupSelection(request, onResult) ?? false
    ), []);

    const requestForceEndAiPhase = useCallback((
        onResult?: (result: ManualForceEndAiPhaseResult) => void,
    ): boolean => (
        clientRef.current?.requestForceEndAiPhase(onResult) ?? false
    ), []);

    const sendUiEvent = useCallback((type: string, payload: unknown) => {
        clientRef.current?.sendUiEvent(type, payload);
    }, []);

    const subscribeUiEvent = useCallback((listener: Parameters<GameTransportClient['subscribeUiEvent']>[0]) => (
        clientRef.current?.subscribeUiEvent(listener) ?? (() => undefined)
    ), []);

    useEffect(() => {
        if (!isTestEnvironment()) return;

        TestHarness.init();
        const harness = TestHarness.getInstance();
        harness.state.register(
            () => state,
            () => {
                throw new Error('[GameProvider] 联机模式下禁止通过客户端玩家视图注入状态，请改用服务端 /test 状态注入接口');
            },
        );

        harness.command.register(async (command) => {
            dispatch(command.type, command.payload);
        });
    }, [dispatch, state]);

    const value = useMemo<GameClientContextValue>(() => ({
        state,
        dispatch,
        requestManualSetupSelection,
        requestForceEndAiPhase,
        playerId,
        matchPlayers,
        seatControllers: undefined,
        isConnected,
        isMultiplayer: true,
        sendUiEvent,
        subscribeUiEvent,
    }), [dispatch, isConnected, matchPlayers, playerId, requestForceEndAiPhase, requestManualSetupSelection, sendUiEvent, state, subscribeUiEvent]);

    return {
        rollbackSignal,
        value,
    };
}

export { buildAiProgressMarker };
