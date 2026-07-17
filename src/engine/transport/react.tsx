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

import type { ReactNode } from 'react';
import type { GameEngineConfig } from './server';
import type { LatencyOptimizationConfig } from './latency/types';
import type { AiSeatController } from '../ai/types';
import {
    shouldSilentlyRetryOnlineAiBatchRejection,
} from './onlineAiRecovery';
import {
    shouldForwardOnlineBatchRejectionToError as baseShouldForwardOnlineBatchRejectionToError,
} from './aiAttemptGuard';
import { useGameProviderRuntime } from './useGameProviderRuntime';
import { useLocalGameProviderRuntime } from './useLocalGameProviderRuntime';
import {
    GameClientContext,
} from './reactContext';
export {
    useGameClient,
    GameClientOverrideProvider,
    useBoardProps,
} from './reactContext';
export {
    BoardBridge,
    BOARD_ERROR_BOUNDARY_MAX_RETRIES,
    isBoardRenderErrorRecoverable,
    shouldShowBoardRenderFallback,
} from './boardBridge';
export {
    shouldRecoverFromRejectedCommandError,
    shouldRetryLocalAiAttemptAfterDispatch,
    tryReserveAiAttemptKey,
    releaseAiAttemptKeyIfMatches,
} from './aiAttemptGuard';

import { EventStreamRollbackContext } from '../hooks/EventStreamRollbackContext';

// re-export 供外部使用（测试等场景）
export { filterPlayedEvents } from './latency/optimisticEngine';
export { buildAiProgressMarker } from './useGameProviderRuntime';

export function shouldForwardOnlineBatchRejectionToError(reason: string): boolean {
    return baseShouldForwardOnlineBatchRejectionToError(reason, shouldSilentlyRetryOnlineAiBatchRejection);
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
    const { rollbackSignal, value } = useGameProviderRuntime({
        server,
        matchId,
        playerId,
        credentials,
        onError,
        onConnectionChange,
        onStateReady,
        engineConfig,
        latencyConfig,
    });

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
    /** 本地模式玩家显示名；没有传入时只对 AI 座位生成 AI 名，真人座位交给 Board fallback。 */
    playerNames?: Record<string, string>;
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
    /** 持久化用的游戏 ID；默认使用 config.gameId */
    persistGameId?: string;
}

export function LocalGameProvider({
    config,
    numPlayers,
    seed,
    setupData,
    children,
    onCommandRejected,
    seatControllers = {},
    playerNames,
    playerId: localPlayerId,
    followCurrentTurnPlayer = false,
    persistSession = false,
    persistGameId,
}: LocalGameProviderProps) {
    const value = useLocalGameProviderRuntime({
        config,
        numPlayers,
        seed,
        setupData,
        onCommandRejected,
        seatControllers,
        playerNames,
        localPlayerId: localPlayerId ?? null,
        followCurrentTurnPlayer,
        persistSession,
        persistGameId,
    });

    return (
        <GameClientContext.Provider value={value}>
            {children}
        </GameClientContext.Provider>
    );
}
