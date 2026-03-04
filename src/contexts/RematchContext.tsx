/**
 * 重赛状态上下文
 * 
 * 管理多人模式下的重赛投票状态（通过 socket）
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { matchSocket, type RematchVoteState } from '../services/matchSocket';
import { claimSeat, readStoredMatchCredentials } from '../hooks/match/useMatchStatus';
import { getOrCreateGuestId } from '../hooks/match/ownerIdentity';
import { useAuth } from './AuthContext';
import * as matchApi from '../services/matchApi';

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
    const hasRematchStartedRef = useRef(false);
    const resetTimeoutRef = useRef<number | null>(null);
    const { user, token } = useAuth();

    const matchInfoRef = useRef<{ matchId?: string; playerId?: string }>({ matchId, playerId });
    useEffect(() => {
        matchInfoRef.current = { matchId, playerId };
    }, [matchId, playerId]);

    const clearResetTimeout = useCallback(() => {
        if (resetTimeoutRef.current !== null) {
            window.clearTimeout(resetTimeoutRef.current);
            resetTimeoutRef.current = null;
        }
    }, []);

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
        const unsubReset = matchSocket.subscribeReset(async () => {
            console.log('[RematchContext] subscribeReset 触发', { matchId, playerId, hasStarted: hasRematchStartedRef.current });
            if (hasRematchStartedRef.current) return;
            hasRematchStartedRef.current = true;
            clearResetTimeout();

            const currentMatchId = matchInfoRef.current.matchId;
            const currentPlayerId = matchInfoRef.current.playerId;
            const stored = currentMatchId ? readStoredMatchCredentials(currentMatchId) : null;
            const rawGameName = stored?.gameName;
            const gameName = rawGameName ? rawGameName.toLowerCase() : '';
            const credentials = stored?.credentials;
            console.log('[RematchContext] 凭据检查', { currentMatchId, currentPlayerId, gameName, hasCredentials: !!credentials, stored });
            const playerName = stored?.playerName;

            if (currentMatchId && currentPlayerId && gameName && credentials) {
                if (currentPlayerId === '0') {
                    try {
                        console.log('[RematchContext] P0 发起 playAgain', { gameName, currentMatchId });
                        const guestId = user?.id ? undefined : getOrCreateGuestId();
                        const { nextMatchID } = await matchApi.playAgain(gameName, currentMatchId, {
                            playerID: currentPlayerId,
                            credentials,
                            guestId,
                        });
                        const fallbackPlayerName = playerName || user?.username || `玩家${currentPlayerId}`;
                        const claimResult = user?.id && token
                            ? await claimSeat(gameName, nextMatchID, currentPlayerId, {
                                token,
                                playerName: user.username,
                            })
                            : await claimSeat(gameName, nextMatchID, currentPlayerId, {
                                guestId,
                                playerName: fallbackPlayerName,
                            });
                        if (!claimResult.success || !claimResult.credentials) {
                            throw new Error('[RematchContext] claim-seat-failed');
                        }
                        matchSocket.broadcastNewRoom(`/play/${gameName}/match/${nextMatchID}`);
                        console.log('[RematchContext] P0 新房间已创建，跳转', { nextMatchID, gameName });
                        window.location.href = `/play/${gameName}/match/${nextMatchID}?playerID=${currentPlayerId}`;
                        return;
                    } catch (error) {
                        console.error('[RematchContext] playAgain 失败，回退为本地 reset', error);
                    }
                } else {
                    resetTimeoutRef.current = window.setTimeout(() => {
                        console.warn('[RematchContext] 等待新房间超时，回退为本地 reset');
                        if (resetCallbackRef.current) {
                            resetCallbackRef.current();
                        }
                        hasRematchStartedRef.current = false;
                    }, 8000);
                    return;
                }
            }

            if (resetCallbackRef.current) {
                resetCallbackRef.current();
            }
            hasRematchStartedRef.current = false;
        });

        // 订阅新房间通知（调试用）
        const unsubNewRoom = matchSocket.subscribeNewRoom((url) => {
            console.log('[RematchContext] 收到新房间通知，跳转到:', url);
            clearResetTimeout();
            const currentPlayerId = matchInfoRef.current.playerId;
            if (currentPlayerId === '0') {
                window.location.href = `${url}?playerID=0`;
                return;
            }
            // 跳转到新房间（作为玩家 1 加入）
            window.location.href = `${url}?join=true`;
        });

        return () => {
            unsubState();
            unsubReset();
            unsubNewRoom();
            matchSocket.leaveMatch();
            hasRematchStartedRef.current = false;
            clearResetTimeout();
        };
    }, [isMultiplayer, matchId, playerId]);

    // 投票
    const vote = useCallback(() => {
        if (isMultiplayer) {
            matchSocket.vote();
        }
    }, [isMultiplayer]);

    // useMemo 包裹 Provider value，避免每次渲染创建新对象导致消费者重渲染
    const value = useMemo<RematchContextValue>(() => ({
        state,
        vote,
        isConnected,
        registerReset,
    }), [state, vote, isConnected, registerReset]);

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
