import {
    createContext,
    useContext,
    useEffect,
    useRef,
} from 'react';
import type { MatchState } from '../types';
import { clearCurrentGameFeedbackContext, setCurrentGameFeedbackContext } from '../../lib/feedback/gameFeedbackContext';
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
    /** 最近权威/本地运行时诊断版本；不包含随机种子或连接凭证。 */
    feedbackMetadata?: {
        /** 仅供客户端内存隔离不同对局的诊断轨迹，不写入反馈包。 */
        scopeId?: string;
        stateId?: number;
        randomCursor?: number;
    };
    /** 发送命令 */
    dispatch: (type: string, payload: unknown) => void;
    /** 当前已由服务端确认的管理员调试权限。 */
    adminDebugAvailable?: boolean;
    /** 通过服务端管理员调试通道发送作弊命令。 */
    adminDebugDispatch?: (type: string, payload: unknown) => boolean;
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

/** Keep first-trigger diagnostics bound to the latest state exposed by the shared transport. */
export function useGameFeedbackContext(value: GameClientContextValue): void {
    const lastPublishedStateRef = useRef<MatchState<unknown> | null>(null);
    useEffect(() => {
        const state = value.state;
        if (!state) {
            if (lastPublishedStateRef.current) {
                clearCurrentGameFeedbackContext(lastPublishedStateRef.current);
            }
            lastPublishedStateRef.current = null;
            return;
        }

        const revision = state.sys?.revision;
        setCurrentGameFeedbackContext({
            state,
            scopeId: value.feedbackMetadata?.scopeId,
            playerId: value.playerId,
            isGameOver: state.sys?.gameover != null,
            isLocalMode: !value.isMultiplayer,
            stateId: value.feedbackMetadata?.stateId,
            stateRevision: typeof revision === 'number' ? revision : undefined,
            randomCursor: value.feedbackMetadata?.randomCursor,
        });
        lastPublishedStateRef.current = state;
    }, [value.feedbackMetadata, value.isMultiplayer, value.playerId, value.state]);

    useEffect(() => () => {
        if (lastPublishedStateRef.current) {
            clearCurrentGameFeedbackContext(lastPublishedStateRef.current);
        }
    }, []);
}

export function useOptionalGameClient(): GameClientContextValue | null {
    return useContext(GameClientContext);
}

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
        feedbackMetadata?: {
            scopeId?: string;
            stateId?: number;
            randomCursor?: number;
        };
        dispatch: <K extends string & keyof TCommandMap>(type: K, payload: TCommandMap[K]) => void;
        adminDebugAvailable?: boolean;
        adminDebugDispatch?: (type: string, payload: unknown) => boolean;
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

/**
 * 将 useGameClient 的输出转换为 GameBoardProps 格式
 *
 * 过渡期使用，方便现有 Board 组件逐步迁移。
 * 新代码应直接使用 useGameClient。
 */
export function useBoardProps<
    TCore = unknown,
    TCommandMap extends Record<string, unknown> = Record<string, unknown>,
>(): GameBoardProps<TCore, TCommandMap> | null {
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
        dispatch: dispatch as GameBoardProps<TCore, TCommandMap>['dispatch'],
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
