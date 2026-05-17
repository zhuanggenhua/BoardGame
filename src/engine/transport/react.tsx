/**
 * React 封装层
 *
 * 提供 GameProvider（在线模式）和 LocalGameProvider（本地模式）。
 *
 * 使用方式：
 * ```tsx
 * // 在线模式
 * <GameProvider config={engineConfig} matchId={matchId} playerId={playerId} credentials={creds}>
 *   <Board />
 * </GameProvider>
 *
 * // 本地模式
 * <LocalGameProvider config={engineConfig} numPlayers={2} seed={seed}>
 *   <Board />
 * </LocalGameProvider>
 *
 * // Board 内部
 * const { state, dispatch, playerId, isConnected } = useGameClient<MyCore, MyCommands>();
 * ```
 */

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo,
} from 'react';
import * as React from 'react';
import type { ReactNode } from 'react';
import type { MatchState, Command, GameEvent, RandomFn } from '../types';
import type { EngineSystem } from '../systems/types';
import type { MatchPlayerInfo } from './protocol';
import type { GameBoardProps } from './protocol';
import type { GameEngineConfig } from './server';
import { GameTransportClient } from './client';
import {
    executePipeline,
    createSeededRandom,
    createInitialSystemState,
    type PipelineConfig,
} from '../pipeline';
import { TestHarness, isTestEnvironment } from '../testing';
import { refreshInteractionOptions } from '../systems/InteractionSystem';
import type { LatencyOptimizationConfig } from './latency/types';
import { createOptimisticEngine, filterPlayedEvents, type OptimisticEngine as OptimisticEngineType } from './latency/optimisticEngine';
import {
    resolveFollowCurrentTurnPlayerId,
    resolveLocalPregameControlledPlayerId,
} from './followCurrentTurnPlayer';
import {
    resolveLocalAiActionDelayPlan,
    resolveNextAiAction,
    getAiSeatIds,
    getGameAiRuntime,
    startCancelableAiDelay,
    resolveSeatPlayerDisplayName,
    type AiSeatController,
} from '../ai';
import { resolveLocalAiActionVisibility } from '../ai/actionVisibility';
import { persistLocalMatchSnapshot, readLocalMatchSnapshot } from './localSession';
import { onAppVisible } from '../../lib/mobile/appVisibility';
import {
    buildAiProgressMarker,
    resolveCurrentPlayerId,
    resolveForceEndTurnForStalledAi,
    resolveForceSkippableHiddenAiInteraction,
    shouldSilentlyRetryOnlineAiBatchRejection,
} from './onlineAiRecovery';
import { injectTutorialInteractionId } from './tutorialAiCommand';
import { resolveSetupPlayerIds } from './setupPlayerOrder';
import { createScopedLogger } from '../../lib/logger';

import { createCommandBatcher, type CommandBatcher } from './latency/commandBatcher';
import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../hooks/EventStreamRollbackContext';
import { setUndoAiSeatIds } from '../systems/UndoSystem';

// re-export 供外部使用（测试等场景）
export { filterPlayedEvents };
export { buildAiProgressMarker };

const localAiPerfLogger = createScopedLogger('LOCAL_AI_PERF');
function emitLocalAiPerf(stage: string, payload: Record<string, unknown>): void {
    console.log('[LOCAL_AI_PERF]', { stage, ...payload });
}
const LOCAL_AI_STALL_RECOVERY_GRACE_MS = 1_200;
const LOCAL_AI_IDLE_RETRY_MS = 120;
const NON_RECOVERABLE_REJECTED_COMMAND_ERRORS = new Set([
    'unauthorized',
    'match_not_found',
    'not_connected',
    'disconnected',
    'sync_timeout',
]);
const aiRuntimeTruthLogger = createScopedLogger('AI_RUNTIME_TRUTH');
function emitAiRuntimeTruth(stage: string, payload: Record<string, unknown>): void {
    console.log('[AI_RUNTIME_TRUTH]', { stage, ...payload });
}

export function shouldRecoverFromRejectedCommandError(reason: string): boolean {
    return !NON_RECOVERABLE_REJECTED_COMMAND_ERRORS.has(reason);
}

export function shouldForwardOnlineBatchRejectionToError(reason: string): boolean {
    return !shouldSilentlyRetryOnlineAiBatchRejection(reason);
}

function summarizeSeatControllerTypes(seatControllers: Record<string, AiSeatController>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(seatControllers)
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
            .map(([playerId, controller]) => [playerId, controller.type]),
    );
}

function resolveCoreCurrentPlayerId(core: unknown): string | null {
    if (!core || typeof core !== 'object') {
        return null;
    }
    const typedCore = core as {
        activePlayerId?: unknown;
        currentPlayerId?: unknown;
        currentPlayer?: unknown;
        turnOrder?: unknown;
        currentPlayerIndex?: unknown;
    };
    if (typeof typedCore.activePlayerId === 'string') {
        return typedCore.activePlayerId;
    }
    if (typeof typedCore.currentPlayerId === 'string') {
        return typedCore.currentPlayerId;
    }
    if (typeof typedCore.currentPlayer === 'string') {
        return typedCore.currentPlayer;
    }
    if (Array.isArray(typedCore.turnOrder) && typeof typedCore.currentPlayerIndex === 'number') {
        const indexedPlayerId = typedCore.turnOrder[typedCore.currentPlayerIndex];
        return typeof indexedPlayerId === 'string' ? indexedPlayerId : null;
    }
    return null;
}

// ============================================================================
// Context 类型
// ============================================================================

interface GameClientContextValue {
    /** 完整游戏状态 */
    state: MatchState<unknown> | null;
    /** 发送命令 */
    dispatch: (type: string, payload: unknown) => void;
    /** 当前玩家 ID */
    playerId: string | null;
    /** 对局玩家信息 */
    matchPlayers: MatchPlayerInfo[];
    /** 是否已连接（本地模式始终为 true） */
    isConnected: boolean;
    /** 是否为多人在线模式 */
    isMultiplayer: boolean;
    /** 重置游戏（本地模式用） */
    reset?: () => void;
}

const GameClientContext = createContext<GameClientContextValue | null>(null);

export function shouldRetryLocalAiAttemptAfterDispatch(args: {
    cancelled: boolean;
    activeAttemptKey: string | null;
    resolutionAttemptKey: string;
    markerBeforeDispatch: string;
    nextState: MatchState<unknown>;
}): boolean {
    if (args.cancelled) return false;
    if (args.activeAttemptKey !== null && args.activeAttemptKey !== args.resolutionAttemptKey) return false;
    return buildAiProgressMarker(args.nextState) === args.markerBeforeDispatch;
}

export function tryReserveAiAttemptKey(
    ref: { current: string | null },
    attemptKey: string,
): boolean {
    if (ref.current === attemptKey) {
        return false;
    }
    ref.current = attemptKey;
    return true;
}

export function releaseAiAttemptKeyIfMatches(
    ref: { current: string | null },
    attemptKey: string,
): void {
    if (ref.current === attemptKey) {
        ref.current = null;
    }
}

function buildLocalAiSeatStates(
    state: MatchState<unknown>,
    seatControllers: Record<string, AiSeatController>,
): Record<string, MatchState<unknown>> {
    const seatStates: Record<string, MatchState<unknown>> = {};
    for (const [playerId, controller] of Object.entries(seatControllers)) {
        if (controller.type === 'human') {
            continue;
        }
        seatStates[playerId] = state;
    }
    return seatStates;
}

// ============================================================================
// useGameClient Hook
// ============================================================================

/**
 * 获取游戏客户端上下文
 *
 * 必须在 GameProvider 或 LocalGameProvider 内部使用。
 */
export function useGameClient<
    TCore = unknown,
    TCommandMap extends Record<string, unknown> = Record<string, unknown>,
>() {
    const ctx = useContext(GameClientContext);
    if (!ctx) {
        throw new Error('useGameClient 必须在 GameProvider 或 LocalGameProvider 内部使用');
    }
    return ctx as {
        state: MatchState<TCore> | null;
        dispatch: <K extends string & keyof TCommandMap>(type: K, payload: TCommandMap[K]) => void;
        playerId: string | null;
        matchPlayers: MatchPlayerInfo[];
        isConnected: boolean;
        isMultiplayer: boolean;
        reset?: () => void;
    };
}

// ============================================================================
// useBoardProps — 兼容层 Hook
// ============================================================================

/**
 * 将 useGameClient 的输出转换为 GameBoardProps 格式
 *
 * 过渡期使用，方便现有 Board 组件逐步迁移。
 * 新代码应直接使用 useGameClient。
 */
export function useBoardProps<TCore = unknown>(): GameBoardProps<TCore> | null {
    const ctx = useContext(GameClientContext);

    if (!ctx || !ctx.state) return null;

    const { state, dispatch, playerId, matchPlayers, isConnected, isMultiplayer, reset } = ctx;

    return {
        G: state as MatchState<TCore>,
        dispatch: dispatch as GameBoardProps<TCore>['dispatch'],
        playerID: playerId,
        matchData: matchPlayers,
        isConnected,
        isMultiplayer,
        reset,
    };
}

// ============================================================================
// GameProvider（在线模式）
// ============================================================================

export interface GameProviderProps {
    /** 服务端地址 */
    server: string;
    /** 对局 ID */
    matchId: string;
    /** 玩家 ID */
    playerId: string | null;
    /** 认证凭证 */
    credentials?: string;
    /** 子组件 */
    children: ReactNode;
    /** 错误回调 */
    onError?: (error: string) => void;
    /** 连接状态变更回调 */
    onConnectionChange?: (connected: boolean) => void;
    /** 首次拿到权威状态时回调 */
    onStateReady?: () => void;
    /** 游戏引擎配置（乐观更新需要在客户端执行 Pipeline） */
    engineConfig?: GameEngineConfig;
    /** 延迟优化配置（可选，不传则不启用任何优化） */
    latencyConfig?: LatencyOptimizationConfig;
}

export function GameProvider({
    server,
    matchId,
    playerId,
    credentials,
    children,
    onError,
    onConnectionChange,
    onStateReady,
    engineConfig,
    latencyConfig,
}: GameProviderProps) {
    const [state, setState] = useState<MatchState<unknown> | null>(null);
    const [matchPlayers, setMatchPlayers] = useState<MatchPlayerInfo[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef<GameTransportClient | null>(null);

    // 延迟优化组件 refs
    const optimisticEngineRef = useRef<OptimisticEngineType | null>(null);
    const batcherRef = useRef<CommandBatcher | null>(null);
    // 批次 ID 计数器
    const batchSeqRef = useRef(0);
    // [已移除] animationDelay 机制：延迟整个 setState 会阻塞 EventStream 事件传递，
    // 破坏所有基于 EventStream 的动画（伤害飞行、治疗、状态效果等）。
    // 骰子动画最短播放时间改为在 UI 层（DiceActions）用 useMinDuration 保护。

    // 状态版本号追踪：防止旧状态覆盖新状态（WebSocket 消息乱序/重复广播）
    const lastConfirmedStateIDRef = useRef<number | null>(null);

    // 乐观回滚信号：传递给 useEventStreamCursor
    const [rollbackSignal, setRollbackSignal] = useState<EventStreamRollbackValue>({
        watermark: null,
        seq: 0,
        reconcileSeq: 0,
    });

    // 用 ref 存储回调，避免回调引用变化导致 effect 重新执行（断开重连）
    const onErrorRef = useRef(onError);
    const onConnectionChangeRef = useRef(onConnectionChange);
    const onStateReadyRef = useRef(onStateReady);
    const hasReportedStateReadyRef = useRef(false);
    const recoverFromRejectedCommand = useCallback((reason: string) => {
        if (!shouldRecoverFromRejectedCommandError(reason)) {
            return;
        }

        if (optimisticEngineRef.current) {
            optimisticEngineRef.current.reset();
            setRollbackSignal(prev => ({
                watermark: null,
                seq: prev.seq + 1,
                reconcileSeq: prev.reconcileSeq,
            }));
        }

        clientRef.current?.resync();
    }, []);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        onConnectionChangeRef.current = onConnectionChange;
    }, [onConnectionChange]);

    useEffect(() => {
        onStateReadyRef.current = onStateReady;
    }, [onStateReady]);

    // 初始化乐观更新引擎
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
            playerIds: [], // 从服务端同步后填充
        });
    }, [engineConfig, latencyConfig]);

    // 初始化命令批处理器
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
                if (!client) return;
                if (commands.length === 1) {
                    // 单条命令直接发送（不走批量协议）
                    client.sendCommand(commands[0].type, commands[0].payload);
                } else {
                    // 批量发送
                    const batchId = `b-${++batchSeqRef.current}`;
                    client.sendBatch(batchId, commands, undefined, (reason) => {
                        recoverFromRejectedCommand(reason);
                        if (shouldForwardOnlineBatchRejectionToError(reason)) {
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
                if (!hasReportedStateReadyRef.current) {
                    hasReportedStateReadyRef.current = true;
                    onStateReadyRef.current?.();
                }

                // 状态版本号检查：防止旧状态覆盖新状态（WebSocket 消息乱序/重复广播）
                if (meta?.stateID !== undefined && lastConfirmedStateIDRef.current !== null) {
                    if (meta.stateID < lastConfirmedStateIDRef.current) {
                        console.warn('[GameProvider] 忽略旧状态更新', {
                            receivedStateID: meta.stateID,
                            currentStateID: lastConfirmedStateIDRef.current,
                            receivedTurnNumber: (newState as MatchState<unknown>).core ? ((newState as MatchState<unknown>).core as { turnNumber?: number }).turnNumber : undefined,
                        });
                        return; // 忽略旧状态
                    }
                }

                // 更新最后确认的 stateID
                if (meta?.stateID !== undefined) {
                    lastConfirmedStateIDRef.current = meta.stateID;
                }

                // 乐观更新引擎：调和服务端确认状态
                const engine = optimisticEngineRef.current;
                let finalState: MatchState<unknown>;
                if (engine) {
                    // 首次收到状态时，从 matchPlayers 更新 playerIds（初始化时为空数组）
                    if (players.length > 0) {
                        engine.setPlayerIds(players.map((p) => String(p.id)));
                    }
                    // 随机数种子同步（state:sync 时携带 randomMeta）
                    if (randomMeta) {
                        engine.syncRandom(randomMeta.seed, randomMeta.cursor);
                    }
                    // 仅当 reconcile 前存在本地 pending 乐观命令时，才需要通过 reconcileSeq
                    // 通知 useEventStreamCursor 执行“静默对齐游标”。
                    // 否则（例如纯对手/AI 事件更新）不应触发 reconcileSeq，
                    // 避免把合法的新事件吞掉导致动画不播放。
                    const hadPendingBeforeReconcile = engine.hasPendingCommands();
                    const result = engine.reconcile(newState as MatchState<unknown>, meta);
                    
                    // 更新回滚信号
                    if (result.didRollback && result.optimisticEventWatermark !== null) {
                        // 回滚：通知 useEventStreamCursor 重置游标到水位线
                        setRollbackSignal(prev => ({
                            watermark: result.optimisticEventWatermark,
                            seq: prev.seq + 1,
                            reconcileSeq: prev.reconcileSeq,
                        }));
                        // 过滤已通过乐观动画播放的事件，防止重复播放
                        finalState = filterPlayedEvents(result.stateToRender, result.optimisticEventWatermark);
                    } else if (!result.didRollback && hadPendingBeforeReconcile) {
                        // reconcile 确认：静默调整游标到新的 maxId
                        setRollbackSignal(prev => ({
                            watermark: null,
                            seq: prev.seq,
                            reconcileSeq: prev.reconcileSeq + 1,
                        }));
                        finalState = result.stateToRender;
                    } else {
                        finalState = result.stateToRender;
                    }
                } else {
                    finalState = newState as MatchState<unknown>;
                }

                // 传输层 patch 基线必须保持“服务端权威态”，不能混入 reconcile/filter 后的渲染态；
                // 否则后续 state:patch 会基于被 UI 修饰过的快照 apply，导致 patch 失败并只能靠 resync/刷新恢复。
                client.updateLatestState(newState);

                // 实时刷新交互选项（如果策略是 realtime）
                const refreshedState = refreshInteractionOptions(finalState);

                setState(refreshedState);
                setMatchPlayers(players);
            },
            onConnectionChange: (connected) => {
                setIsConnected(connected);
                onConnectionChangeRef.current?.(connected);
                // 断线重连时重置乐观引擎和状态版本号追踪
                if (connected && optimisticEngineRef.current) {
                    optimisticEngineRef.current.reset();
                }
                if (connected) {
                    // 重连成功后强制通知 EventStream 游标消费者重置到最新位置，
                    // 避免失焦/断线期间的历史事件被再次消费，触发重复动画与状态抖动。
                    setRollbackSignal(prev => ({
                        watermark: null,
                        seq: prev.seq + 1,
                        reconcileSeq: prev.reconcileSeq,
                    }));
                }
                if (!connected) {
                    // 断线时重置状态版本号追踪，重连后从服务端同步最新状态
                    lastConfirmedStateIDRef.current = null;
                }
            },
            onError: (error) => {
                recoverFromRejectedCommand(error);
                onErrorRef.current?.(error);
            },
        });

        clientRef.current = client;
        client.connect();

        return () => {
            hasReportedStateReadyRef.current = false;
            client.disconnect();
            clientRef.current = null;
        };
    }, [server, matchId, playerId, credentials, recoverFromRejectedCommand]);

    // 页面可见性恢复时主动重新同步状态
    // 浏览器后台标签页会节流 timer / 冻结 JS 执行，导致：
    // 1. socket.io 心跳超时 → 服务端断开连接 → 客户端未及时重连
    // 2. state:update 消息到达 WebSocket 缓冲区但 JS 回调未执行
    // 恢复可见时主动 resync 确保状态最新
    useEffect(() => {
        return onAppVisible(() => {
            const client = clientRef.current;
            if (!client) return;
            // 重置乐观引擎：后台期间可能错过了多次状态更新，pending 队列已过时
            if (optimisticEngineRef.current) {
                optimisticEngineRef.current.reset();
                // 重置回滚信号（watermark=null 通知 useEventStreamCursor 清理 UI 状态）
                setRollbackSignal(prev => ({
                    watermark: null,
                    seq: prev.seq + 1,
                    reconcileSeq: prev.reconcileSeq,
                }));
            }
            client.resync();
        });
    }, []);

    const dispatch = useCallback((type: string, payload: unknown) => {
        // 内部：走 optimistic engine + batcher/sendCommand 路径
        const dispatchToNetwork = (cmdType: string, cmdPayload: unknown) => {
            // 1. 乐观更新
            const engine = optimisticEngineRef.current;
            if (engine) {
                const result = engine.processCommand(cmdType, cmdPayload, playerId ?? '0');
                if (result.stateToRender) {
                    const refreshed = refreshInteractionOptions(result.stateToRender);
                    setState(refreshed);
                }
            }
            // 2. 命令批处理 或 直接发送
            const batcher = batcherRef.current;
            if (batcher) {
                batcher.enqueue(cmdType, cmdPayload);
            } else {
                clientRef.current?.sendCommand(cmdType, cmdPayload);
            }
        };

        dispatchToNetwork(type, payload);
    }, [playerId]);  

    // 注册测试工具访问器（仅在测试环境生效）
    useEffect(() => {
        if (!isTestEnvironment()) return;
        
        const harness = TestHarness.getInstance();
        
        // 注册状态访问器（联机模式只允许读取）
        // 这里的 state 已经过服务端 playerView 过滤，只是当前玩家视角。
        // 若允许客户端直接写回，会把隐藏信息裁掉后的视图污染成服务器权威状态。
        // 联机 E2E 需要注入权威状态时，必须改走服务端 /test API。
        harness.state.register(
            () => state,
            () => {
                throw new Error('[GameProvider] 联机模式下禁止通过客户端玩家视图注入状态，请改用服务端 /test 状态注入接口');
            },
        );
        
        // 注册命令分发器
        harness.command.register(async (command) => {
            dispatch(command.type, command.payload);
        });
    }, [state, dispatch]);

    const value = useMemo<GameClientContextValue>(() => ({
        state,
        dispatch,
        playerId,
        matchPlayers,
        isConnected,
        isMultiplayer: true,
    }), [state, dispatch, playerId, matchPlayers, isConnected]);

    return (
        <EventStreamRollbackContext.Provider value={rollbackSignal}>
            <GameClientContext.Provider value={value}>
                {children}
            </GameClientContext.Provider>
        </EventStreamRollbackContext.Provider>
    );
}

// ============================================================================
// LocalGameProvider（本地模式）
// ============================================================================

export interface LocalGameProviderProps {
    /** 游戏引擎配置 */
    config: GameEngineConfig;
    /** 玩家数量 */
    numPlayers: number;
    /** 随机种子 */
    seed: string;
    /** 本地对局 setupData，透传给领域 setup() */
    setupData?: unknown;
    /** 子组件 */
    children: ReactNode;
    /** 命令被拒绝时的回调（验证失败） */
    onCommandRejected?: (commandType: string, error: string) => void;
    /** 座位控制器：human / local-ai / remote-ai */
    seatControllers?: Record<string, AiSeatController>;
    /**
     * 当前玩家 ID（可选）。
     * 设置后会将 playerId 传给 Board（Board 知道"我是谁"）。
     * 教程模式应传入 '0'，本地同屏对战不传（双方共享视角）。
     * 注意：本地模式不做 playerView 过滤，所有玩家信息对 Board 可见（单机/教程无需隐藏）。
     */
    playerId?: string;
    /**
     * 是否让本地模式的 Board 视角跟随当前回合玩家。
     *
     * 用于本地同屏/测试模式：回合切到谁，就显示谁的可操作手牌。
     * 教程模式应保持 false，继续固定在指定 playerId 视角。
     */
    followCurrentTurnPlayer?: boolean;
    /** 是否持久化本地对局，以便刷新后恢复进度 */
    persistSession?: boolean;
}

type LocalProviderRandom = RandomFn & {
    getCursor: () => number;
};

function createLocalProviderRandom(seed: string, initialCursor = 0): LocalProviderRandom {
    const base = createSeededRandom(seed);
    const normalizedCursor = Number.isFinite(initialCursor) && initialCursor > 0
        ? Math.floor(initialCursor)
        : 0;

    for (let i = 0; i < normalizedCursor; i += 1) {
        base.random();
    }

    let cursor = normalizedCursor;

    if (!isTestEnvironment()) {
        return {
            random: () => {
                cursor += 1;
                return base.random();
            },
            d: (max: number) => {
                cursor += 1;
                return Math.floor(base.random() * max) + 1;
            },
            range: (min: number, max: number) => {
                cursor += 1;
                return Math.floor(base.random() * (max - min + 1)) + min;
            },
            shuffle: <T,>(array: T[]): T[] => {
                const result = [...array];
                cursor += Math.max(0, result.length - 1);
                for (let i = result.length - 1; i > 0; i -= 1) {
                    const j = Math.floor(base.random() * (i + 1));
                    [result[i], result[j]] = [result[j], result[i]];
                }
                return result;
            },
            getCursor: () => cursor,
        };
    }

    TestHarness.init();
    const harness = TestHarness.getInstance();
    const nextRandom = harness.random.wrap(() => base.random());

    return {
        random: () => {
            cursor += 1;
            return nextRandom();
        },
        d: (max: number) => {
            cursor += 1;
            return Math.floor(nextRandom() * max) + 1;
        },
        range: (min: number, max: number) => {
            cursor += 1;
            return Math.floor(nextRandom() * (max - min + 1)) + min;
        },
        shuffle: <T,>(array: T[]): T[] => {
            const result = [...array];
            cursor += Math.max(0, result.length - 1);
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(nextRandom() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        },
        getCursor: () => cursor,
    };
}

export function LocalGameProvider({
    config,
    numPlayers,
    seed,
    setupData,
    children,
    onCommandRejected,
    seatControllers = {},
    playerId: localPlayerId,
    followCurrentTurnPlayer = false,
    persistSession = false,
}: LocalGameProviderProps) {
    const playerIds = useMemo(
        () => Array.from({ length: numPlayers }, (_, i) => String(i)),
        [numPlayers],
    );
    const setupPlayerIds = useMemo(
        () => resolveSetupPlayerIds({
            playerIds,
            setupData,
            seatControllers,
        }),
        [playerIds, seatControllers, setupData],
    );
    const aiSeatIds = useMemo(() => getAiSeatIds(seatControllers), [seatControllers]);
    const persistedSnapshot = useMemo(
        () => (
            persistSession
                ? readLocalMatchSnapshot({ gameId: config.gameId, seed, numPlayers })
                : null
        ),
        [config.gameId, numPlayers, persistSession, seed],
    );

    const [initialRandom] = useState<LocalProviderRandom>(() =>
        createLocalProviderRandom(seed, persistedSnapshot?.randomCursor ?? 0),
    );
    const randomRef = useRef<LocalProviderRandom>(initialRandom);
    const onCommandRejectedRef = useRef(onCommandRejected);
    const lastAiAttemptKeyRef = useRef<string | null>(null);
    const lastVisibleAiActionAtRef = useRef<number | null>(null);
    const aiCommandEffectByTokenRef = useRef<Record<string, { hasStateDelta: boolean; markerProgressed: boolean }>>({});
    const [aiRetryVersion, setAiRetryVersion] = useState(0);
    const aiActivePhaseRef = useRef<{ key: string; startedAt: number } | null>(null);
    const aiTurnTimelineBySeatRef = useRef<Record<string, {
        turnKey: string;
        turnStartedAt: number;
        decisionReadyAt: number | null;
        firstVisibleCommandLogged: boolean;
        rollCount: number;
        lastRollAt: number | null;
    }>>({});
    const aiRuntimeTruthKeyRef = useRef<string | null>(null);

    useEffect(() => {
        onCommandRejectedRef.current = onCommandRejected;
    }, [onCommandRejected]);

    const [state, setState] = useState<MatchState<unknown>>(() => {
        if (persistedSnapshot?.state) {
            return setUndoAiSeatIds(persistedSnapshot.state, aiSeatIds);
        }
        const random = initialRandom;
        
        // 检查是否启用 skipInitialization（测试模式 - 完全跳过初始化）
        const testConfig = typeof window !== 'undefined' 
            ? (window as Window & { __BG_TEST_CONFIG__?: { 
                skipInitialization?: boolean; 
                skipFactionSelect?: boolean; 
                player0Factions?: string[]; 
                player1Factions?: string[] 
            } }).__BG_TEST_CONFIG__
            : undefined;
        
        // 优先级：skipInitialization > skipFactionSelect > 正常流程
        if (testConfig?.skipInitialization) {
            // 创建最小化的空白状态（仅包含必要的框架结构）
            const core: any = {
                players: {},
                turnOrder: setupPlayerIds,
                currentPlayerIndex: 0,
                bases: [],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 1,
            };
            
            // 为每个玩家创建空白状态
            for (const pid of setupPlayerIds) {
                core.players[pid] = {
                    id: pid,
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: ['', ''],
                };
            }
            
            const sys = createInitialSystemState(
                setupPlayerIds,
                config.systems as EngineSystem[],
            );
            
            // 直接进入 playCards 阶段（测试会通过 setupScene 注入完整状态）。
            // SystemState 已统一使用顶层 `sys.phase`，这里不能再写历史遗留的 `sys.flow.phase`。
            sys.phase = 'playCards';
            return setUndoAiSeatIds({ sys, core }, aiSeatIds);
        }
        
        const shouldSkipFactionSelect = testConfig?.skipFactionSelect === true &&
                                       testConfig.player0Factions &&
                                       testConfig.player0Factions.length > 0;
        
        if (shouldSkipFactionSelect) {
            // 调用 domain.setup 创建初始状态
            const core = config.domain.setup(setupPlayerIds, random, setupData) as any;
            const sys = createInitialSystemState(
                setupPlayerIds,
                config.systems as EngineSystem[],
            );
            let currentState: MatchState<unknown> = setUndoAiSeatIds({ sys, core }, aiSeatIds);
            
            // 同步执行 4 个派系选择命令（蛇形选秀：P0 → P1 → P1 → P0）
            const selectionOrder: Array<{ playerId: string; factionIndex: number }> = [
                { playerId: '0', factionIndex: 0 },
                { playerId: '1', factionIndex: 0 },
                { playerId: '1', factionIndex: 1 },
                { playerId: '0', factionIndex: 1 },
            ];
            
            const pipelineConfig: PipelineConfig<unknown, Command, GameEvent> = {
                domain: config.domain,
                systems: config.systems as EngineSystem<unknown>[],
                systemsConfig: config.systemsConfig,
            };
            
            for (const { playerId, factionIndex } of selectionOrder) {
                const factions = playerId === '0' ? testConfig.player0Factions! : testConfig.player1Factions!;
                const factionId = factions[factionIndex];
                
                if (!factionId) {
                    console.warn(`[LocalGameProvider] 玩家 ${playerId} 的第 ${factionIndex + 1} 个派系未指定，跳过`);
                    continue;
                }

                const command: Command = {
                    type: 'su:select_faction',
                    playerId,
                    payload: { factionId },
                    timestamp: Date.now(),
                    skipValidation: true,
                };
                
                const result = executePipeline(
                    pipelineConfig,
                    currentState,
                    command,
                    random,
                    setupPlayerIds,
                );
                
                if (!result.success) {
                    console.error(`[LocalGameProvider] 派系选择失败:`, result.error);
                    break;
                }
                
                currentState = result.state;
            }
            return setUndoAiSeatIds(currentState, aiSeatIds);
        }
        
        // 正常流程：从 factionSelect 阶段开始
        const core = config.domain.setup(setupPlayerIds, random, setupData);
        const sys = createInitialSystemState(
            setupPlayerIds,
            config.systems as EngineSystem[],
        );
        return setUndoAiSeatIds({ sys, core }, aiSeatIds);
    });
    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const ensureAiTurnTimeline = useCallback((playerId: string, matchState: MatchState<unknown>) => {
        const phase = matchState.sys?.phase ?? 'unknown';
        const turnNumber = matchState.sys?.turnNumber ?? 'no-turn';
        const nextId = matchState.sys?.eventStream?.nextId ?? 'no-event';
        const turnKey = `${playerId}:${turnNumber}`;
        const existingTimeline = aiTurnTimelineBySeatRef.current[playerId];
        if (existingTimeline?.turnKey === turnKey) {
            return existingTimeline;
        }
        const nextTimeline = {
            turnKey,
            turnStartedAt: Date.now(),
            decisionReadyAt: null,
            firstVisibleCommandLogged: false,
            rollCount: 0,
            lastRollAt: null,
        };
        aiTurnTimelineBySeatRef.current[playerId] = nextTimeline;
        const turnBeginPayload = {
            gameId: config.gameId,
            matchId: `local:${config.gameId}:${seed}`,
            playerId,
            phase,
            turnNumber,
            turnKey,
            eventStreamNextId: nextId,
        };
        localAiPerfLogger.info('ai-turn-begin', turnBeginPayload);
        emitLocalAiPerf('ai-turn-begin', turnBeginPayload);
        return nextTimeline;
    }, [config.gameId, seed]);

    useEffect(() => {
        const currentPlayerId = resolveCoreCurrentPlayerId(state.core);
        if (!currentPlayerId || seatControllers[currentPlayerId]?.type === 'human') {
            aiActivePhaseRef.current = null;
            return;
        }
        const phase = state.sys?.phase ?? 'unknown';
        const turnNumber = state.sys?.turnNumber ?? 'no-turn';
        const nextId = state.sys?.eventStream?.nextId ?? 'no-event';
        const key = `${currentPlayerId}:${turnNumber}:${phase}:${nextId}`;
        if (aiActivePhaseRef.current?.key !== key) {
            aiActivePhaseRef.current = { key, startedAt: Date.now() };
        }
        ensureAiTurnTimeline(currentPlayerId, state);
    }, [ensureAiTurnTimeline, seatControllers, state]);

    const localPregameControlledPlayerId = useMemo(
        () => resolveLocalPregameControlledPlayerId({
            state,
            seatControllers,
            localPlayerId: localPlayerId ?? null,
            resolver: config.resolveLocalPregameControlledPlayerId,
        }),
        [config.resolveLocalPregameControlledPlayerId, localPlayerId, seatControllers, state],
    );

    useEffect(() => {
        const currentPlayerId = resolveCoreCurrentPlayerId(state.core);
        const seatControllerTypes = summarizeSeatControllerTypes(seatControllers);
        const hasAiSeat = Object.values(seatControllerTypes).some((type) => type !== 'human');
        const currentControllerType = currentPlayerId
            ? (seatControllerTypes[currentPlayerId] ?? 'human')
            : null;
        const payload = {
            mode: 'local',
            gameId: config.gameId,
            hasAiSeat,
            currentPlayerId,
            currentControllerType,
            phase: state.sys?.phase ?? null,
            turnNumber: state.sys?.turnNumber ?? null,
            localPregameControlledPlayerId: localPregameControlledPlayerId ?? null,
            seatControllerTypes,
        };
        const nextKey = JSON.stringify(payload);
        if (aiRuntimeTruthKeyRef.current === nextKey) {
            return;
        }
        aiRuntimeTruthKeyRef.current = nextKey;
        aiRuntimeTruthLogger.info('local-provider-state', payload);
        emitAiRuntimeTruth('local-provider-state', payload);
        if (!hasAiSeat) {
            const disabledPayload = {
                mode: 'local',
                gameId: config.gameId,
                reason: 'all-human-seats',
                seatControllerTypes,
            };
            aiRuntimeTruthLogger.warn('local-ai-disabled', disabledPayload);
            emitAiRuntimeTruth('local-ai-disabled', disabledPayload);
        }
    }, [config.gameId, localPregameControlledPlayerId, seatControllers, state]);

    useEffect(() => {
        return onAppVisible(() => {
            const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
            if (!hasAiSeat) {
                return;
            }
            if (localPregameControlledPlayerId) {
                return;
            }
            lastAiAttemptKeyRef.current = null;
            lastVisibleAiActionAtRef.current = null;
            aiCommandEffectByTokenRef.current = {};
            setAiRetryVersion((version) => version + 1);
        });
    }, [localPregameControlledPlayerId, seatControllers]);

    const dispatch = useCallback((type: string, payload: unknown) => {
        setState((prev) => {
            const payloadRecord = payload && typeof payload === 'object'
                ? (payload as Record<string, unknown>)
                : null;
            const tutorialOverrideId = typeof payloadRecord?.__tutorialPlayerId === 'string'
                ? payloadRecord.__tutorialPlayerId
                : undefined;
            const aiTraceToken = typeof payloadRecord?.__aiTraceToken === 'string'
                ? payloadRecord.__aiTraceToken
                : undefined;
            // AI 命令标记：命令失败时不触发 onCommandRejected（避免教程中 AI 操作弹 toast）
            const isTutorialAiCommand = payloadRecord?.__tutorialAiCommand === true;
            const normalizedPayload = payloadRecord && (
                '__tutorialPlayerId' in payloadRecord
                || '__tutorialAiCommand' in payloadRecord
                || '__aiTraceToken' in payloadRecord
            )
                ? (() => {
                    const {
                        __tutorialPlayerId: _ignored,
                        __tutorialAiCommand: _ignored2,
                        __aiTraceToken: _ignored3,
                        ...rest
                    } = payloadRecord;
                    return rest;
                })()
                : payload;
            const coreAny = prev.core as Record<string, unknown>;
            // 兼容两种当前玩家字段：currentPlayer（直接字段）或 turnOrder[currentPlayerIndex]（索引模式）
            const coreCurrentPlayer = typeof coreAny.currentPlayer === 'string'
                ? coreAny.currentPlayer
                : (Array.isArray(coreAny.turnOrder) && typeof coreAny.currentPlayerIndex === 'number'
                    ? (coreAny.turnOrder as string[])[coreAny.currentPlayerIndex as number]
                    : undefined);
            // ── 系统命令 playerId 解析 ──
            // 对方回合中可能触发属于"我"的效果（雄蜂防止消灭、Me First 响应窗口出牌等），
            // 这些命令的 playerId 不能用当前回合玩家，必须从对应系统状态推导。
            // 优先级：
            // 1. SYS_INTERACTION_*  → interaction 所有者（交互可能在对方回合属于我）
            // 2. 响应窗口活跃时     → 当前响应者（Me First 出牌、RESPONSE_PASS 等）
            // 3. 本地 setup 代配     → 当前被本地控制的 setup 座位
            // 4. 其他              → 当前回合玩家（默认）
            const systemPlayerId = (() => {
                // 交互命令：始终使用交互所有者
                if (type.startsWith('SYS_INTERACTION_')) {
                    return prev.sys.interaction?.current?.playerId;
                }
                // 响应窗口活跃时：所有命令（RESPONSE_PASS、PLAY_ACTION 等）使用当前响应者
                const rw = prev.sys.responseWindow?.current;
                if (rw) {
                    const idx = rw.currentResponderIndex ?? 0;
                    return rw.responderQueue?.[idx];
                }
                return undefined;
            })();
            const resolvedPlayerId = tutorialOverrideId
                ?? systemPlayerId
                ?? localPregameControlledPlayerId
                ?? coreCurrentPlayer
                ?? '0';
            const tutorialInjectedPayload = injectTutorialInteractionId({
                state: prev,
                commandType: type,
                payload: normalizedPayload,
                tutorialPlayerId: tutorialOverrideId ?? resolvedPlayerId,
                isTutorialAiCommand,
            });

            const command: Command = {
                type,
                // 系统命令从对应系统状态推导 playerId；普通命令使用当前回合玩家；教程 AI 可通过 __tutorialPlayerId 强制指定。
                playerId: resolvedPlayerId,
                payload: tutorialInjectedPayload,
                timestamp: Date.now(),
                skipValidation: true,
            };


            const pipelineConfig: PipelineConfig<unknown, Command, GameEvent> = {
                domain: config.domain,
                systems: config.systems as EngineSystem<unknown>[],
                systemsConfig: config.systemsConfig,
            };

            const result = executePipeline(
                pipelineConfig,
                prev,
                command,
                randomRef.current,
                setupPlayerIds,
            );


            if (!result.success) {
                console.warn('[LocalGame] 命令执行失败:', type, result.error);
                if (aiTraceToken) {
                    aiCommandEffectByTokenRef.current[aiTraceToken] = {
                        hasStateDelta: false,
                        markerProgressed: false,
                    };
                }
                const rejectedPayload = {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    commandType: type,
                    playerId: resolvedPlayerId,
                    error: result.error ?? 'command_failed',
                    isTutorialAiCommand,
                    phase: typeof prev.sys?.phase === 'string' ? prev.sys.phase : null,
                    turnNumber: typeof prev.sys?.turnNumber === 'number' ? prev.sys.turnNumber : null,
                };
                localAiPerfLogger.warn('command-rejected', rejectedPayload);
                emitLocalAiPerf('command-rejected', rejectedPayload);
                // AI 命令失败时静默，不弹 toast 打扰用户
                if (!isTutorialAiCommand) {
                    onCommandRejectedRef.current?.(type, result.error ?? 'command_failed');
                }
                return prev;
            }

            // 实时刷新交互选项（如果策略是 realtime）
            const refreshedState = refreshInteractionOptions(result.state);
            if (isTutorialAiCommand) {
                const playerBefore = (prev.core as {
                    players?: Record<string, { hand?: unknown; resources?: Record<string, unknown> }>;
                } | undefined)?.players?.[resolvedPlayerId];
                const playerAfter = (refreshedState.core as {
                    players?: Record<string, { hand?: unknown; resources?: Record<string, unknown> }>;
                } | undefined)?.players?.[resolvedPlayerId];
                const handCountBefore = Array.isArray(playerBefore?.hand) ? playerBefore.hand.length : null;
                const handCountAfter = Array.isArray(playerAfter?.hand) ? playerAfter.hand.length : null;
                const cpBefore = (() => {
                    const resources = playerBefore?.resources;
                    if (!resources || typeof resources !== 'object') return null;
                    const cp = resources.cp;
                    if (typeof cp === 'number') return cp;
                    const uppercaseCp = resources.CP;
                    return typeof uppercaseCp === 'number' ? uppercaseCp : null;
                })();
                const cpAfter = (() => {
                    const resources = playerAfter?.resources;
                    if (!resources || typeof resources !== 'object') return null;
                    const cp = resources.cp;
                    if (typeof cp === 'number') return cp;
                    const uppercaseCp = resources.CP;
                    return typeof uppercaseCp === 'number' ? uppercaseCp : null;
                })();
                const markerBefore = buildAiProgressMarker(prev);
                const markerAfter = buildAiProgressMarker(refreshedState);
                const markerProgressed = markerBefore !== markerAfter;
                const hasStateDelta = markerProgressed
                    || handCountBefore !== handCountAfter
                    || cpBefore !== cpAfter
                    || (typeof prev.sys?.phase === 'string' ? prev.sys.phase : null) !== (typeof refreshedState.sys?.phase === 'string' ? refreshedState.sys.phase : null)
                    || (typeof prev.sys?.eventStream?.nextId === 'number' ? prev.sys.eventStream.nextId : null)
                        !== (typeof refreshedState.sys?.eventStream?.nextId === 'number' ? refreshedState.sys.eventStream.nextId : null);
                const appliedPayload = {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    commandType: type,
                    playerId: resolvedPlayerId,
                    progressed: markerProgressed,
                    hasStateDelta,
                    phaseBefore: typeof prev.sys?.phase === 'string' ? prev.sys.phase : null,
                    phaseAfter: typeof refreshedState.sys?.phase === 'string' ? refreshedState.sys.phase : null,
                    turnBefore: typeof prev.sys?.turnNumber === 'number' ? prev.sys.turnNumber : null,
                    turnAfter: typeof refreshedState.sys?.turnNumber === 'number' ? refreshedState.sys.turnNumber : null,
                    handCountBefore,
                    handCountAfter,
                    cpBefore,
                    cpAfter,
                    markerBefore,
                    markerAfter,
                };
                if (aiTraceToken) {
                    aiCommandEffectByTokenRef.current[aiTraceToken] = {
                        hasStateDelta,
                        markerProgressed,
                    };
                }
                localAiPerfLogger.info('command-applied', appliedPayload);
                emitLocalAiPerf('command-applied', appliedPayload);
            }
            // 立即同步 ref，避免 AI 无进展检测读取到渲染前的旧快照而误触发重复重试
            stateRef.current = refreshedState;
            return refreshedState;
        });
    }, [config, localPregameControlledPlayerId, setupPlayerIds]);

    useEffect(() => {
        if (!persistSession) return;
        persistLocalMatchSnapshot({
            gameId: config.gameId,
            seed,
            numPlayers,
            state,
            randomCursor: randomRef.current.getCursor(),
        });
    }, [config.gameId, numPlayers, persistSession, seed, state]);

    useEffect(() => {
        const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
        if (!hasAiSeat) {
            lastAiAttemptKeyRef.current = null;
            lastVisibleAiActionAtRef.current = null;
            aiCommandEffectByTokenRef.current = {};
            aiTurnTimelineBySeatRef.current = {};
            return;
        }

        if (localPregameControlledPlayerId) {
            lastAiAttemptKeyRef.current = null;
            lastVisibleAiActionAtRef.current = null;
            aiCommandEffectByTokenRef.current = {};
            aiTurnTimelineBySeatRef.current = {};
            return;
        }

        let cancelled = false;
        let delayTimer: ReturnType<typeof setTimeout> | null = null;
        let pendingDelayHandle: ReturnType<typeof startCancelableAiDelay> | null = null;

        const runAiTurn = async () => {
            const startedAt = Date.now();
            const progressMarkerBeforeDispatch = buildAiProgressMarker(state);
            let resolution = await resolveNextAiAction({
                engineConfig: config,
                state,
                matchId: `local:${config.gameId}:${seed}`,
                seatControllers,
            });
            const decisionResolvedAt = Date.now();
            const decisionElapsedMs = decisionResolvedAt - startedAt;
            const activePhaseElapsedMs = aiActivePhaseRef.current
                ? decisionResolvedAt - aiActivePhaseRef.current.startedAt
                : null;

            if (cancelled) return;

            if (!resolution) {
                const seatStates = buildLocalAiSeatStates(state, seatControllers);
                const forceSkipCandidate = resolveForceSkippableHiddenAiInteraction({
                    sharedState: state,
                    seatControllers,
                    seatStates,
                });
                const stalledCandidate = forceSkipCandidate
                    ? null
                    : resolveForceEndTurnForStalledAi({
                        sharedState: state,
                        seatControllers,
                        seatStates,
                        gameId: config.gameId,
                    });
                const canApplyStalledRecovery = stalledCandidate
                    && stalledCandidate.legalActionOnly !== true
                    && (
                        stalledCandidate.reason === 'hidden-interaction'
                        || stalledCandidate.reason === 'visible-interaction'
                        || stalledCandidate.reason === 'response-window'
                        || activePhaseElapsedMs === null
                        || activePhaseElapsedMs >= LOCAL_AI_STALL_RECOVERY_GRACE_MS
                    );
                resolution = forceSkipCandidate?.resolution
                    ?? (canApplyStalledRecovery ? stalledCandidate?.resolution ?? null : null);
            }

            if (!resolution) {
                const currentAiActorId = resolveCurrentPlayerId(state);
                const shouldPollRetry = Boolean(
                    currentAiActorId && seatControllers[currentAiActorId]?.type !== 'human',
                );
                if (shouldPollRetry) {
                    delayTimer = setTimeout(() => {
                        delayTimer = null;
                        if (cancelled) return;
                        lastAiAttemptKeyRef.current = null;
                        setAiRetryVersion((version) => version + 1);
                    }, LOCAL_AI_IDLE_RETRY_MS);
                }
                localAiPerfLogger.debug('idle', {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    decisionElapsedMs,
                    activePhaseElapsedMs,
                    scheduledRetry: shouldPollRetry,
                });
                emitLocalAiPerf('idle', {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    decisionElapsedMs,
                    activePhaseElapsedMs,
                    scheduledRetry: shouldPollRetry,
                });
                lastAiAttemptKeyRef.current = null;
                return;
            }

            if (!tryReserveAiAttemptKey(lastAiAttemptKeyRef, resolution.attemptKey)) {
                return;
            }

            const controller = seatControllers[resolution.playerId];
            if (!controller || controller.type === 'human') {
                releaseAiAttemptKeyIfMatches(lastAiAttemptKeyRef, resolution.attemptKey);
                return;
            }

            const runtime = getGameAiRuntime(config.gameId);
            const actionVisibility = resolveLocalAiActionVisibility(resolution.action, runtime);
            const delayPlan = resolveLocalAiActionDelayPlan({
                controller,
                actionVisibility,
                now: decisionResolvedAt,
                lastVisibleActionAt: lastVisibleAiActionAtRef.current,
            });
            const commandTypes = resolution.action.commands.map((command) => command.type);
            const turnTimeline = ensureAiTurnTimeline(resolution.playerId, stateRef.current);
            if (turnTimeline) {
                turnTimeline.decisionReadyAt = decisionResolvedAt;
            }
            const decisionReadyPayload = {
                gameId: config.gameId,
                matchId: `local:${config.gameId}:${seed}`,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs,
                turnKey: turnTimeline?.turnKey ?? null,
                turnStartedElapsedMs: turnTimeline
                    ? decisionResolvedAt - turnTimeline.turnStartedAt
                    : null,
                activePhaseElapsedMs,
                ...delayPlan,
            };
            localAiPerfLogger.info('ai-decision-ready', decisionReadyPayload);
            emitLocalAiPerf('ai-decision-ready', decisionReadyPayload);

            localAiPerfLogger.info('scheduled', {
                gameId: config.gameId,
                matchId: `local:${config.gameId}:${seed}`,
                playerId: resolution.playerId,
                controllerType: controller.type,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs,
                activePhaseElapsedMs,
                ...delayPlan,
            });
            emitLocalAiPerf('scheduled', {
                gameId: config.gameId,
                matchId: `local:${config.gameId}:${seed}`,
                playerId: resolution.playerId,
                controllerType: controller.type,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs,
                activePhaseElapsedMs,
                ...delayPlan,
            });

            if (delayPlan.remainingDelayMs > 0) {
                pendingDelayHandle = startCancelableAiDelay(delayPlan.remainingDelayMs);
                const delayResult = await pendingDelayHandle.promise;
                pendingDelayHandle = null;
                if (delayResult.outcome === 'cancelled') {
                    localAiPerfLogger.warn('delay-cancelled', {
                        gameId: config.gameId,
                        matchId: `local:${config.gameId}:${seed}`,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        ...delayPlan,
                        waitedMs: delayResult.waitedMs,
                        cancelled,
                    });
                    emitLocalAiPerf('delay-cancelled', {
                        gameId: config.gameId,
                        matchId: `local:${config.gameId}:${seed}`,
                        playerId: resolution.playerId,
                        source: resolution.source,
                        actionKind: resolution.action.kind,
                        commandTypes,
                        ...delayPlan,
                        waitedMs: delayResult.waitedMs,
                        cancelled,
                    });
                    releaseAiAttemptKeyIfMatches(lastAiAttemptKeyRef, resolution.attemptKey);
                    return;
                }
                localAiPerfLogger.info('delay-finished', {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    ...delayPlan,
                    waitedMs: delayResult.waitedMs,
                });
                emitLocalAiPerf('delay-finished', {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    ...delayPlan,
                    waitedMs: delayResult.waitedMs,
                });
            }

            if (cancelled) {
                localAiPerfLogger.warn('submit-skipped', {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    cancelled,
                    ...delayPlan,
                });
                emitLocalAiPerf('submit-skipped', {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    cancelled,
                    ...delayPlan,
                });
                releaseAiAttemptKeyIfMatches(lastAiAttemptKeyRef, resolution.attemptKey);
                return;
            }

            let hasAnyCommandEffect = false;
            for (const [commandIndex, command] of resolution.action.commands.entries()) {
                const normalizedPayload = command.payload && typeof command.payload === 'object'
                    ? command.payload as Record<string, unknown>
                    : {};
                const playerBefore = (stateRef.current.core as {
                    players?: Record<string, { hand?: unknown; resources?: Record<string, unknown> }>;
                } | undefined)?.players?.[resolution.playerId];
                const handCountBefore = Array.isArray(playerBefore?.hand) ? playerBefore.hand.length : null;
                const cpBefore = (() => {
                    const resources = playerBefore?.resources;
                    if (!resources || typeof resources !== 'object') return null;
                    const cp = resources.cp;
                    if (typeof cp === 'number') return cp;
                    const uppercaseCp = resources.CP;
                    return typeof uppercaseCp === 'number' ? uppercaseCp : null;
                })();
                const markerBeforeCommand = buildAiProgressMarker(stateRef.current);
                const phaseBeforeCommand = typeof stateRef.current.sys?.phase === 'string'
                    ? stateRef.current.sys.phase
                    : null;
                const eventStreamNextIdBefore = typeof stateRef.current.sys?.eventStream?.nextId === 'number'
                    ? stateRef.current.sys.eventStream.nextId
                    : null;
                const aiTraceToken = `${resolution.attemptKey}:${commandIndex}:${Date.now()}`;
                dispatch(command.type, {
                    ...normalizedPayload,
                    __tutorialPlayerId: resolution.playerId,
                    __tutorialAiCommand: true,
                    __aiTraceToken: aiTraceToken,
                });
                let commandEffect = aiCommandEffectByTokenRef.current[aiTraceToken];
                if (!commandEffect) {
                    for (let retry = 0; retry < 3; retry += 1) {
                        await new Promise<void>((resolve) => setTimeout(resolve, 0));
                        commandEffect = aiCommandEffectByTokenRef.current[aiTraceToken];
                        if (commandEffect) {
                            break;
                        }
                    }
                }
                if (commandEffect) {
                    delete aiCommandEffectByTokenRef.current[aiTraceToken];
                }
                const markerAfterCommand = buildAiProgressMarker(stateRef.current);
                const playerAfter = (stateRef.current.core as {
                    players?: Record<string, { hand?: unknown; resources?: Record<string, unknown> }>;
                } | undefined)?.players?.[resolution.playerId];
                const handCountAfter = Array.isArray(playerAfter?.hand) ? playerAfter.hand.length : null;
                const cpAfter = (() => {
                    const resources = playerAfter?.resources;
                    if (!resources || typeof resources !== 'object') return null;
                    const cp = resources.cp;
                    if (typeof cp === 'number') return cp;
                    const uppercaseCp = resources.CP;
                    return typeof uppercaseCp === 'number' ? uppercaseCp : null;
                })();
                const phaseAfterCommand = typeof stateRef.current.sys?.phase === 'string'
                    ? stateRef.current.sys.phase
                    : null;
                const eventStreamNextIdAfter = typeof stateRef.current.sys?.eventStream?.nextId === 'number'
                    ? stateRef.current.sys.eventStream.nextId
                    : null;
                const progressed = commandEffect?.markerProgressed ?? (markerAfterCommand !== markerBeforeCommand);
                const hasStateDelta = commandEffect?.hasStateDelta ?? (
                    progressed
                    || handCountBefore !== handCountAfter
                    || cpBefore !== cpAfter
                    || phaseBeforeCommand !== phaseAfterCommand
                    || eventStreamNextIdBefore !== eventStreamNextIdAfter
                );
                if (hasStateDelta) {
                    hasAnyCommandEffect = true;
                }
                const commandProgressPayload = {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandType: command.type,
                    commandIndex,
                    commandTotal: resolution.action.commands.length,
                    progressed,
                    hasStateDelta,
                    handCountBefore,
                    handCountAfter,
                    cpBefore,
                    cpAfter,
                    phaseBefore: phaseBeforeCommand,
                    phaseAfter: phaseAfterCommand,
                    eventStreamNextIdBefore,
                    eventStreamNextIdAfter,
                    markerBefore: markerBeforeCommand,
                    markerAfter: markerAfterCommand,
                };
                if (hasStateDelta) {
                    const now = Date.now();
                    const timeline = aiTurnTimelineBySeatRef.current[resolution.playerId];
                    if (actionVisibility === 'visible' && timeline && !timeline.firstVisibleCommandLogged) {
                        timeline.firstVisibleCommandLogged = true;
                        const firstVisiblePayload = {
                            gameId: config.gameId,
                            matchId: `local:${config.gameId}:${seed}`,
                            playerId: resolution.playerId,
                            source: resolution.source,
                            actionKind: resolution.action.kind,
                            commandType: command.type,
                            commandIndex,
                            turnKey: timeline.turnKey,
                            turnStartedElapsedMs: now - timeline.turnStartedAt,
                            decisionReadyToVisibleMs: timeline.decisionReadyAt === null
                                ? null
                                : now - timeline.decisionReadyAt,
                            phaseBefore: phaseBeforeCommand,
                            phaseAfter: phaseAfterCommand,
                        };
                        localAiPerfLogger.info('ai-first-visible-command', firstVisiblePayload);
                        emitLocalAiPerf('ai-first-visible-command', firstVisiblePayload);
                    }
                    if (command.type === 'ROLL_DICE') {
                        const rollPayload = {
                            gameId: config.gameId,
                            matchId: `local:${config.gameId}:${seed}`,
                            playerId: resolution.playerId,
                            source: resolution.source,
                            actionKind: resolution.action.kind,
                            commandType: command.type,
                            turnKey: timeline?.turnKey ?? null,
                            rollOrdinal: timeline ? timeline.rollCount + 1 : 1,
                            gapFromPreviousRollMs: timeline?.lastRollAt === null || timeline?.lastRollAt === undefined
                                ? null
                                : now - timeline.lastRollAt,
                            turnStartedElapsedMs: timeline
                                ? now - timeline.turnStartedAt
                                : null,
                            decisionReadyToVisibleMs: timeline?.decisionReadyAt === null || timeline?.decisionReadyAt === undefined
                                ? null
                                : now - timeline.decisionReadyAt,
                            phaseBefore: phaseBeforeCommand,
                            phaseAfter: phaseAfterCommand,
                        };
                        if (timeline) {
                            timeline.rollCount += 1;
                            timeline.lastRollAt = now;
                        }
                        localAiPerfLogger.info('ai-roll-command', rollPayload);
                        emitLocalAiPerf('ai-roll-command', rollPayload);
                    }
                    localAiPerfLogger.info('command-progress', commandProgressPayload);
                    emitLocalAiPerf('command-progress', commandProgressPayload);
                    continue;
                }
                localAiPerfLogger.warn('command-no-progress', commandProgressPayload);
                emitLocalAiPerf('command-no-progress', commandProgressPayload);
            }

            if (actionVisibility === 'visible' && hasAnyCommandEffect) {
                lastVisibleAiActionAtRef.current = Date.now();
            }

            const totalElapsedMs = Date.now() - startedAt;
            localAiPerfLogger.info('dispatched', {
                gameId: config.gameId,
                matchId: `local:${config.gameId}:${seed}`,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs,
                hasAnyCommandEffect,
                ...delayPlan,
                activePhaseElapsedMs: aiActivePhaseRef.current
                    ? Date.now() - aiActivePhaseRef.current.startedAt
                    : null,
                totalElapsedMs,
            });
            emitLocalAiPerf('dispatched', {
                gameId: config.gameId,
                matchId: `local:${config.gameId}:${seed}`,
                playerId: resolution.playerId,
                source: resolution.source,
                actionKind: resolution.action.kind,
                commandTypes,
                decisionElapsedMs,
                hasAnyCommandEffect,
                ...delayPlan,
                activePhaseElapsedMs: aiActivePhaseRef.current
                    ? Date.now() - aiActivePhaseRef.current.startedAt
                    : null,
                totalElapsedMs,
            });
            if (totalElapsedMs >= 1200) {
                localAiPerfLogger.warn('slow-step', {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    decisionElapsedMs,
                    activePhaseElapsedMs: aiActivePhaseRef.current
                        ? Date.now() - aiActivePhaseRef.current.startedAt
                        : null,
                    hasAnyCommandEffect,
                    ...delayPlan,
                    totalElapsedMs,
                });
                emitLocalAiPerf('slow-step', {
                    gameId: config.gameId,
                    matchId: `local:${config.gameId}:${seed}`,
                    playerId: resolution.playerId,
                    source: resolution.source,
                    actionKind: resolution.action.kind,
                    commandTypes,
                    decisionElapsedMs,
                    activePhaseElapsedMs: aiActivePhaseRef.current
                        ? Date.now() - aiActivePhaseRef.current.startedAt
                        : null,
                    hasAnyCommandEffect,
                    ...delayPlan,
                    totalElapsedMs,
                });
            }

            setTimeout(() => {
                if (!shouldRetryLocalAiAttemptAfterDispatch({
                    cancelled,
                    activeAttemptKey: lastAiAttemptKeyRef.current,
                    resolutionAttemptKey: resolution.attemptKey,
                    markerBeforeDispatch: progressMarkerBeforeDispatch,
                    nextState: stateRef.current,
                })) {
                    return;
                }
                lastAiAttemptKeyRef.current = null;
                setAiRetryVersion((version) => version + 1);
            }, 30);
        };

        void runAiTurn();

        return () => {
            cancelled = true;
            if (delayTimer) {
                clearTimeout(delayTimer);
                delayTimer = null;
            }
            pendingDelayHandle?.cancel();
            pendingDelayHandle = null;
        };
    }, [aiRetryVersion, config, dispatch, ensureAiTurnTimeline, localPregameControlledPlayerId, seatControllers, seed, state]);

    const reset = useCallback(() => {
        randomRef.current = createLocalProviderRandom(seed);
        const random = randomRef.current;
        const core = config.domain.setup(setupPlayerIds, random, setupData);
        const sys = createInitialSystemState(
            setupPlayerIds,
            config.systems as EngineSystem[],
        );
        setState(setUndoAiSeatIds({ sys, core }, aiSeatIds));
    }, [aiSeatIds, config, seed, setupData, setupPlayerIds]);

    const matchPlayers = useMemo<MatchPlayerInfo[]>(
        () => playerIds.map((id) => ({
            id: Number(id),
            name: resolveSeatPlayerDisplayName({
                playerId: id,
                seatControllers,
            }),
            isConnected: true,
        })),
        [playerIds, seatControllers],
    );

    const localBoardPlayerId = useMemo(() => {
        if (localPregameControlledPlayerId) {
            return localPregameControlledPlayerId;
        }
        if (followCurrentTurnPlayer) {
            const currentTurnPlayerId = resolveFollowCurrentTurnPlayerId(state.core);
            if (currentTurnPlayerId) {
                return currentTurnPlayerId;
            }
        }
        return localPlayerId ?? null;
    }, [followCurrentTurnPlayer, localPlayerId, localPregameControlledPlayerId, state.core]);

    const value = useMemo<GameClientContextValue>(() => ({
        state,
        dispatch,
        playerId: localBoardPlayerId,
        matchPlayers,
        isConnected: true,
        isMultiplayer: false,
        reset,
    }), [state, dispatch, matchPlayers, reset, localBoardPlayerId]);

    // 注册测试工具访问器（仅在测试环境生效）
    useEffect(() => {
        const isTest = isTestEnvironment();
        if (!isTest) return;

        // 初始化 TestHarness（挂载到 window）
        TestHarness.init();

        const harness = TestHarness.getInstance();

        // 注册状态访问器（本地模式可直接读写当前快照）
        // 本地模式没有 playerView 过滤，因此允许 TestHarness 直接注入状态。
        harness.state.register(
            () => stateRef.current,
            (newState) => {
                const nextState = newState as MatchState<unknown>;
                stateRef.current = nextState;
                setState(nextState);
            },
        );
        
        // 注册命令分发器
        harness.command.register(async (command) => {
            dispatch(command.type, command.payload);
        });
    }, [state, dispatch]);

    // E2E 测试支持：在本地/教程模式下暴露 dispatch 和 state 到 window，供 Playwright 直接操作
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const w = window as Window & {
            __BG_LOCAL_DISPATCH__?: typeof dispatch;
            __BG_LOCAL_STATE__?: typeof state;
        };
        w.__BG_LOCAL_DISPATCH__ = dispatch;
        w.__BG_LOCAL_STATE__ = state;
        return () => {
            delete w.__BG_LOCAL_DISPATCH__;
            delete w.__BG_LOCAL_STATE__;
        };
    }, [dispatch, state]);

    return (
        <GameClientContext.Provider value={value}>
            {children}
        </GameClientContext.Provider>
    );
}


// ============================================================================
// BoardBridge — 兼容层桥接组件
// ============================================================================

/**
 * 将 Provider 上下文转换为 props 注入到 Board 组件
 *
 * Board 组件通过 props 接收 G/dispatch 等，
 * BoardBridge 从 Context 读取并注入。
 *
 * 使用 ErrorBoundary 确保 Board 组件在渲染错误时不会崩溃整个应用。
 * 使用条件渲染确保 Board 只在 props 完全就绪时才渲染。
 *
 * ```tsx
 * <GameProvider ...>
 *   <BoardBridge board={DiceThroneBoard} />
 * </GameProvider>
 * ```
 */
export function BoardBridge<TCore = unknown>({
    board: Board,
    loading: Loading,
}: {
    board: React.ComponentType<GameBoardProps<TCore>>;
    loading?: React.ReactNode;
}) {
    const props = useBoardProps<TCore>();
    
    // 确保 props 完全就绪后才渲染 Board
    // 这避免了 React 18 并发渲染可能导致的 Provider 时序问题
    if (!props) {
        return Loading ?? null;
    }
    
    // 使用 key 强制在 props 变化时重新挂载组件
    // 这确保了组件状态的清洁重置
    const stableKey = props.playerID ?? 'board';
    
    return (
        <BoardErrorBoundary fallback={Loading}>
            <Board key={stableKey} {...props} />
        </BoardErrorBoundary>
    );
}

export const BOARD_ERROR_BOUNDARY_MAX_RETRIES = 5;

export const isBoardRenderErrorRecoverable = (error?: Error | null) => {
    const message = error?.message ?? '';
    return message.includes('AudioProvider')
        || message.includes('useAudio')
        || message.includes('Context');
};

export const shouldShowBoardRenderFallback = ({
    error,
    retryCount,
    fallback,
}: {
    error?: Error | null;
    retryCount: number;
    fallback?: React.ReactNode;
}) => Boolean(fallback)
    && Boolean(error)
    && isBoardRenderErrorRecoverable(error)
    && retryCount < BOARD_ERROR_BOUNDARY_MAX_RETRIES;

/**
 * Board 组件的错误边界
 * 
 * 捕获 Board 渲染过程中的错误，防止整个应用崩溃。
 * 常见错误包括：
 * - AudioProvider 未初始化
 * - 其他 Context Provider 缺失
 * - 组件内部逻辑错误
 * 
 * 自动重试机制：
 * - 捕获错误后等待 500ms 自动重试
 * - 最多重试 5 次
 * - 重试期间显示 loading fallback
 */
class BoardErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback?: React.ReactNode },
    { hasError: boolean; error?: Error; retryCount: number }
> {
    private retryTimer: NodeJS.Timeout | null = null;
    private readonly maxRetries = BOARD_ERROR_BOUNDARY_MAX_RETRIES;

    constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, retryCount: 0 };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[BoardBridge] Board 组件渲染错误:', error, errorInfo);
        console.error('[BoardBridge] 错误堆栈:', error.stack);
        
        const isRecoverable = isBoardRenderErrorRecoverable(error);
        
        if (isRecoverable && this.state.retryCount < this.maxRetries) {
            // 指数退避：500ms, 1000ms, 2000ms, 4000ms, 5000ms (最大)
            const delay = Math.min(500 * Math.pow(2, this.state.retryCount), 5000);
            
            console.warn(`[BoardBridge] 检测到可恢复错误，将在 ${delay}ms 后重试 (${this.state.retryCount + 1}/${this.maxRetries})`);
            
            this.retryTimer = setTimeout(() => {
                this.setState(prev => ({
                    hasError: false,
                    error: undefined,
                    retryCount: prev.retryCount + 1
                }));
            }, delay);
        } else {
            if (this.state.retryCount >= this.maxRetries) {
                console.error('[BoardBridge] 已达到最大重试次数，放弃重试');
            } else {
                console.error('[BoardBridge] 错误不可恢复，不进行重试');
            }
        }
    }

    componentDidUpdate(prevProps: { children: React.ReactNode }) {
        // 如果 children 变化，重置错误状态和重试计数
        if (this.state.hasError && prevProps.children !== this.props.children) {
            this.setState({ hasError: false, error: undefined, retryCount: 0 });
        }
    }

    componentWillUnmount() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
    }

    render() {
        if (this.state.hasError) {
            if (shouldShowBoardRenderFallback({
                error: this.state.error,
                retryCount: this.state.retryCount,
                fallback: this.props.fallback,
            })) {
                return this.props.fallback;
            }

            return (
                <div data-bg-friendly-screen="true" className="w-full h-full flex items-center justify-center text-red-300 text-sm p-4">
                    <div className="text-center">
                        <div className="mb-2">游戏加载失败</div>
                        <div className="text-xs text-white/50 mb-2">
                            {this.state.error?.message || '未知错误'}
                        </div>
                        {this.state.retryCount >= this.maxRetries && (
                            <div className="text-xs text-white/30">
                                已重试 {this.maxRetries} 次
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
