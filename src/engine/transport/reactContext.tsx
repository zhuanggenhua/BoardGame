import {
    createContext,
    useContext,
    useMemo,
} from 'react';
import type { ReactNode } from 'react';
import type { MatchState } from '../types';
import type {
    MatchPlayerInfo,
    GameBoardProps,
    ManualForceEndAiPhaseResult,
    ManualSetupSelectionRequest,
    ManualSetupSelectionResult,
    MatchUiEvent,
} from './protocol';
import type { AiSeatController } from '../ai/types';

export interface GameClientContextValue {
    /** 完整游戏状态 */
    state: MatchState<unknown> | null;
    /** 发送命令 */
    dispatch: (type: string, payload: unknown) => void;
    /** 请求服务端为人工准备选择执行当前 AI seat 的权威合法动作。 */
    requestManualSetupSelection?: (
        request: ManualSetupSelectionRequest,
        onResult?: (result: ManualSetupSelectionResult) => void,
    ) => boolean;
    /** 请求服务端立即恢复 / 强制收口当前 AI 阶段。 */
    requestForceEndAiPhase?: (
        onResult?: (result: ManualForceEndAiPhaseResult) => void,
    ) => boolean;
    /** 当前玩家 ID */
    playerId: string | null;
    /** 对局玩家信息 */
    matchPlayers: MatchPlayerInfo[];
    /** 座位控制器：human / local-ai / remote-ai */
    seatControllers?: Record<string, AiSeatController>;
    /** 是否已连接（本地模式始终为 true） */
    isConnected: boolean;
    /** 是否为多人在线模式 */
    isMultiplayer: boolean;
    /** 重置游戏（本地模式用） */
    reset?: () => void;
    /** 发送临时 UI 事件；仅在线模式实际转发 */
    sendUiEvent?: (type: string, payload: unknown) => void;
    /** 订阅同局其它客户端发来的临时 UI 事件 */
    subscribeUiEvent?: (listener: (event: MatchUiEvent) => void) => () => void;
}

export const GameClientContext = createContext<GameClientContextValue | null>(null);

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
        requestManualSetupSelection?: (
            request: ManualSetupSelectionRequest,
            onResult?: (result: ManualSetupSelectionResult) => void,
        ) => boolean;
        requestForceEndAiPhase?: (
            onResult?: (result: ManualForceEndAiPhaseResult) => void,
        ) => boolean;
        playerId: string | null;
        matchPlayers: MatchPlayerInfo[];
        seatControllers?: Record<string, AiSeatController>;
        isConnected: boolean;
        isMultiplayer: boolean;
        reset?: () => void;
        sendUiEvent?: (type: string, payload: unknown) => void;
        subscribeUiEvent?: (listener: (event: MatchUiEvent) => void) => () => void;
    };
}

export function GameClientOverrideProvider({
    children,
    state,
    playerId,
    dispatch,
}: {
    children: ReactNode;
    state?: MatchState<unknown> | null;
    playerId?: string | null;
    dispatch?: (type: string, payload: unknown) => void;
}) {
    const ctx = useContext(GameClientContext);
    if (!ctx) {
        throw new Error('GameClientOverrideProvider 必须在 GameProvider 或 LocalGameProvider 内部使用');
    }

    const value = useMemo<GameClientContextValue>(() => ({
        ...ctx,
        ...(state !== undefined ? { state } : {}),
        ...(playerId !== undefined ? { playerId } : {}),
        ...(dispatch ? { dispatch } : {}),
    }), [ctx, dispatch, playerId, state]);

    return (
        <GameClientContext.Provider value={value}>
            {children}
        </GameClientContext.Provider>
    );
}

/**
 * 将 useGameClient 的输出转换为 GameBoardProps 格式
 *
 * 过渡期使用，方便现有 Board 组件逐步迁移。
 * 新代码应直接使用 useGameClient。
 */
export function useBoardProps<TCore = unknown>(): GameBoardProps<TCore> | null {
    const ctx = useContext(GameClientContext);

    if (!ctx || !ctx.state) return null;

    const {
        state,
        dispatch,
        playerId,
        matchPlayers,
        seatControllers,
        isConnected,
        isMultiplayer,
        reset,
        sendUiEvent,
        subscribeUiEvent,
    } = ctx;

    return {
        G: state as MatchState<TCore>,
        dispatch: dispatch as GameBoardProps<TCore>['dispatch'],
        playerID: playerId,
        matchData: matchPlayers,
        seatControllers,
        isConnected,
        isMultiplayer,
        reset,
        sendUiEvent,
        subscribeUiEvent,
    };
}
