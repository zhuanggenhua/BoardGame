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

import { createCommandBatcher, type CommandBatcher } from './latency/commandBatcher';

// re-export 供外部使用（测试等场景）
export { filterPlayedEvents };

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

    // 用 ref 存储回调，避免回调引用变化导致 effect 重新执行（断开重连）
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const onConnectionChangeRef = useRef(onConnectionChange);
    onConnectionChangeRef.current = onConnectionChange;

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
                    client.sendBatch(batchId, commands);
                }
            },
        });
        batcherRef.current = batcher;
        return () => {
            batcher.destroy();
            batcherRef.current = null;
        };
    }, [latencyConfig]);

    useEffect(() => {
        const client = new GameTransportClient({
            server,
            matchID: matchId,
            playerID: playerId,
            credentials,
            onStateUpdate: (newState, players, meta, randomMeta) => {
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
                    const result = engine.reconcile(newState as MatchState<unknown>, meta);
                    if (result.didRollback && result.optimisticEventWatermark !== null) {
                        // 回滚：过滤已通过乐观动画播放的事件，防止重复播放
                        finalState = filterPlayedEvents(result.stateToRender, result.optimisticEventWatermark);
                    } else {
                        finalState = result.stateToRender;
                    }
                } else {
                    finalState = newState as MatchState<unknown>;
                }

                // 实时刷新交互选项（如果策略是 realtime）
                const refreshedState = refreshInteractionOptions(finalState);

                // ── 增量诊断日志：交互状态变更 ──
                const interactionCurrent = (refreshedState as MatchState<unknown>).sys?.interaction?.current;
                if (interactionCurrent || meta?.stateID !== undefined) {
                    console.log('[GameProvider:onStateUpdate]', {
                        stateID: meta?.stateID ?? '-',
                        interactionId: interactionCurrent?.id ?? 'none',
                        interactionPlayer: interactionCurrent?.playerId ?? '-',
                        sourceId: interactionCurrent?.sourceId ?? '-',
                        ts: Date.now(),
                    });
                }
                
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
                if (!connected) {
                    // 断线时重置状态版本号追踪，重连后从服务端同步最新状态
                    lastConfirmedStateIDRef.current = null;
                }
            },
            onError: (error) => {
                onErrorRef.current?.(error);
            },
        });

        clientRef.current = client;
        client.connect();

        return () => {
            client.disconnect();
            clientRef.current = null;
        };
    }, [server, matchId, playerId, credentials]);

    // 页面可见性恢复时主动重新同步状态
    // 浏览器后台标签页会节流 timer / 冻结 JS 执行，导致：
    // 1. socket.io 心跳超时 → 服务端断开连接 → 客户端未及时重连
    // 2. state:update 消息到达 WebSocket 缓冲区但 JS 回调未执行
    // 恢复可见时主动 resync 确保状态最新
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) return;
            const client = clientRef.current;
            if (!client) return;
            // 重置乐观引擎：后台期间可能错过了多次状态更新，pending 队列已过时
            if (optimisticEngineRef.current) {
                optimisticEngineRef.current.reset();
            }
            client.resync();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const dispatch = useCallback((type: string, payload: unknown) => {
        // ── 增量诊断日志：交互/响应窗口命令 ──
        const isInteractionCmd = type.startsWith('SYS_INTERACTION_') || type === 'RESPONSE_PASS';
        if (isInteractionCmd) {
            const pl = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
            console.log('[GameProvider:dispatch]', {
                type,
                optionId: pl.optionId ?? pl.optionIds ?? '-',
                playerId,
                stateID: lastConfirmedStateIDRef.current,
                ts: Date.now(),
            });
        }

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
        
        // 注册状态访问器
        harness.state.register(
            () => state,
            (newState) => setState(newState as MatchState<unknown>)
        );
        
        // 注册命令分发器
        harness.command.register(async (command) => {
            dispatch(command.type, command.payload);
        });
        
        console.log('[GameProvider] 测试工具访问器已注册');
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
        <GameClientContext.Provider value={value}>
            {children}
        </GameClientContext.Provider>
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
    /** 子组件 */
    children: ReactNode;
    /** 命令被拒绝时的回调（验证失败） */
    onCommandRejected?: (commandType: string, error: string) => void;
    /**
     * 当前玩家 ID（可选）。
     * 设置后会将 playerId 传给 Board（Board 知道"我是谁"）。
     * 教程模式应传入 '0'，本地同屏对战不传（双方共享视角）。
     * 注意：本地模式不做 playerView 过滤，所有玩家信息对 Board 可见（单机/教程无需隐藏）。
     */
    playerId?: string;
}

export function LocalGameProvider({
    config,
    numPlayers,
    seed,
    children,
    onCommandRejected,
    playerId: localPlayerId,
}: LocalGameProviderProps) {
    const playerIds = useMemo(
        () => Array.from({ length: numPlayers }, (_, i) => String(i)),
        [numPlayers],
    );

    const randomRef = useRef<RandomFn>(createSeededRandom(seed));
    const onCommandRejectedRef = useRef(onCommandRejected);
    onCommandRejectedRef.current = onCommandRejected;

    const [state, setState] = useState<MatchState<unknown>>(() => {
        const random = randomRef.current;
        const core = config.domain.setup(playerIds, random);
        const sys = createInitialSystemState(
            playerIds,
            config.systems as EngineSystem[],
        );
        return { sys, core };
    });

    const dispatch = useCallback((type: string, payload: unknown) => {
        setState((prev) => {
            const payloadRecord = payload && typeof payload === 'object'
                ? (payload as Record<string, unknown>)
                : null;
            const tutorialOverrideId = typeof payloadRecord?.__tutorialPlayerId === 'string'
                ? payloadRecord.__tutorialPlayerId
                : undefined;
            // AI 命令标记：命令失败时不触发 onCommandRejected（避免教程中 AI 操作弹 toast）
            const isTutorialAiCommand = payloadRecord?.__tutorialAiCommand === true;
            const normalizedPayload = payloadRecord && ('__tutorialPlayerId' in payloadRecord || '__tutorialAiCommand' in payloadRecord)
                ? (() => {
                    const { __tutorialPlayerId: _ignored, __tutorialAiCommand: _ignored2, ...rest } = payloadRecord;
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
            // 3. 其他              → 当前回合玩家（默认）
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
            const resolvedPlayerId = tutorialOverrideId ?? systemPlayerId ?? coreCurrentPlayer ?? '0';

            const command: Command = {
                type,
                // 系统命令从对应系统状态推导 playerId；普通命令使用当前回合玩家；教程 AI 可通过 __tutorialPlayerId 强制指定。
                playerId: resolvedPlayerId,
                payload: normalizedPayload,
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
                playerIds,
            );


            if (!result.success) {
                console.warn('[LocalGame] 命令执行失败:', type, result.error);
                // AI 命令失败时静默，不弹 toast 打扰用户
                if (!isTutorialAiCommand) {
                    onCommandRejectedRef.current?.(type, result.error ?? 'command_failed');
                }
                return prev;
            }

            // 实时刷新交互选项（如果策略是 realtime）
            const refreshedState = refreshInteractionOptions(result.state);
            return refreshedState;
        });
    }, [config, playerIds]);

    const reset = useCallback(() => {
        randomRef.current = createSeededRandom(seed);
        const random = randomRef.current;
        const core = config.domain.setup(playerIds, random);
        const sys = createInitialSystemState(
            playerIds,
            config.systems as EngineSystem[],
        );
        setState({ sys, core });
    }, [config, playerIds, seed]);

    const matchPlayers = useMemo<MatchPlayerInfo[]>(
        () => playerIds.map((id) => ({ id: Number(id), isConnected: true })),
        [playerIds],
    );

    const value = useMemo<GameClientContextValue>(() => ({
        state,
        dispatch,
        playerId: localPlayerId ?? null, // 本地模式无特定玩家身份（未传 playerId 时）
        matchPlayers,
        isConnected: true,
        isMultiplayer: false,
        reset,
    }), [state, dispatch, matchPlayers, reset, localPlayerId, config.domain]);

    // 注册测试工具访问器（仅在测试环境生效）
    useEffect(() => {
        if (!isTestEnvironment()) return;
        
        const harness = TestHarness.getInstance();
        
        // 注册状态访问器
        harness.state.register(
            () => state,
            (newState) => setState(newState as MatchState<unknown>)
        );
        
        // 注册命令分发器
        harness.command.register(async (command) => {
            dispatch(command.type, command.payload);
        });
        
        console.log('[LocalGameProvider] 测试工具访问器已注册');
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
    private readonly maxRetries = 5;

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
        
        // 检查是否为可恢复错误
        const isRecoverable = error.message?.includes('AudioProvider') || 
                              error.message?.includes('useAudio') ||
                              error.message?.includes('Context');
        
        if (isRecoverable && this.state.retryCount < this.maxRetries) {
            // 指数退避：500ms, 1000ms, 2000ms, 4000ms, 5000ms (最大)
            const delay = Math.min(500 * Math.pow(2, this.state.retryCount), 5000);
            
            console.warn(`[BoardBridge] 检测到可恢复错误，将在 ${delay}ms 后重试 (${this.state.retryCount + 1}/${this.maxRetries})`);
            
            this.retryTimer = setTimeout(() => {
                console.log(`[BoardBridge] 重试渲染 (${this.state.retryCount + 1}/${this.maxRetries})`);
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
            console.log('[BoardBridge] children 变化，重置错误状态');
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
            // 如果还在重试范围内，显示 loading fallback
            if (this.state.retryCount < this.maxRetries && this.props.fallback) {
                return this.props.fallback;
            }
            
            // 超过重试次数或没有 fallback，显示错误信息
            if (this.props.fallback && this.state.retryCount >= this.maxRetries) {
                return this.props.fallback;
            }
            
            return (
                <div className="w-full h-full flex items-center justify-center text-red-300 text-sm p-4">
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
