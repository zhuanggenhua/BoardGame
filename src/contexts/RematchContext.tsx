/**
 * 重赛状态上下文
 * 
 * 管理多人模式下的重赛投票状态（通过 socket）
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { matchSocket, type RematchVoteState } from '../services/matchSocket';

interface RematchContextValue {
    /** 重赛投票状态 */
    state: RematchVoteState;
    /** 投票 */
    vote: () => void;
    /** 是否已连接 */
    isConnected: boolean;
    /** 注册 reset 回调（当双方都投票后触发） */
    registerReset: (callback: () => void) => void;
}

const RematchContext = createContext<RematchContextValue | null>(null);

export interface RematchProviderProps {
    /** 对局 ID（多人模式必需） */
    matchId?: string;
    /** 玩家 ID */
    playerId?: string;
    /** 是否多人模式 */
    isMultiplayer?: boolean;
    children: React.ReactNode;
}

export function RematchProvider({
    matchId,
    playerId,
    isMultiplayer = false,
    children,
}: RematchProviderProps): React.ReactElement {
    const [state, setState] = useState<RematchVoteState>({ votes: {}, ready: false, revision: 0 });
    const [isConnected, setIsConnected] = useState(false);
    const resetCallbackRef = useRef<(() => void) | null>(null);

    // 注册 reset 回调
    const registerReset = useCallback((callback: () => void) => {
        resetCallbackRef.current = callback;
    }, []);

    // 多人模式：连接 socket
    useEffect(() => {
        if (!isMultiplayer || !matchId || !playerId) {
            return;
        }

        // 加入对局
        matchSocket.joinMatch(matchId, playerId);
        setIsConnected(matchSocket.isSocketConnected());

        // 订阅状态更新
        const unsubState = matchSocket.subscribeState((newState) => {
            setState(newState);
        });

        // 订阅重置触发
        const unsubReset = matchSocket.subscribeReset(() => {
            if (resetCallbackRef.current) {
                resetCallbackRef.current();
            }
        });

        return () => {
            unsubState();
            unsubReset();
            matchSocket.leaveMatch();
        };
    }, [isMultiplayer, matchId, playerId]);

    // 投票
    const vote = useCallback(() => {
        if (isMultiplayer) {
            matchSocket.vote();
        }
    }, [isMultiplayer]);

    const value: RematchContextValue = {
        state,
        vote,
        isConnected,
        registerReset,
    };

    return (
        <RematchContext.Provider value={value}>
            {children}
        </RematchContext.Provider>
    );
}

/**
 * 使用重赛状态
 */
export function useRematch(): RematchContextValue {
    const context = useContext(RematchContext);
    if (!context) {
        // 返回默认值（单人模式或未包裹 Provider）
        return {
            state: { votes: {}, ready: false, revision: 0 },
            vote: () => {},
            isConnected: false,
            registerReset: () => {},
        };
    }
    return context;
}
