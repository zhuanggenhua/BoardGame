/**
 * 重赛状态上下文
 * 
 * 管理多人模式下的重赛投票状态（通过 socket）
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { matchSocket, type RematchVoteState } from '../services/matchSocket';
import { persistRematchOwnerCredentials, readStoredMatchCredentials } from '../hooks/match/useMatchStatus';
import { getOrCreateGuestId, getOwnerKey } from '../hooks/match/ownerIdentity';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
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
    /** 在线房间中需要自动同意重赛的 AI 座位 */
    setAutoAcceptedPlayerIds: (playerIds: string[]) => void;
}

const RematchContext = createContext<RematchContextValue | null>(null);
const EMPTY_AUTO_ACCEPTED_PLAYER_IDS: string[] = [];
const OWNER_REMATCH_WAIT_NOTICE_MS = 15_000;

export interface RematchProviderProps {
    /** 对局 ID（多人模式必需） */
    matchId?: string;
    /** 玩家 ID */
    playerId?: string;
    /** 是否多人模式 */
    isMultiplayer?: boolean;
    /** 房间内需要自动同意重赛的 AI 座位 */
    autoAcceptedPlayerIds?: string[];
    /** UI-only missing-room deferral while this room hands over to its successor. */
    onTransitionChange?: (matchId: string, pending: boolean) => void;
    children: React.ReactNode;
}

export function RematchProvider({
    matchId,
    playerId,
    isMultiplayer = false,
    autoAcceptedPlayerIds = EMPTY_AUTO_ACCEPTED_PLAYER_IDS,
    children,
    onTransitionChange,
}: RematchProviderProps): React.ReactElement {
    const [state, setState] = useState<RematchVoteState>({ votes: {}, ready: false, revision: 0 });
    const [isConnected, setIsConnected] = useState(false);
    const autoAcceptedPlayerIdsRef = useRef(autoAcceptedPlayerIds);
    autoAcceptedPlayerIdsRef.current = autoAcceptedPlayerIds;
    const transitionCallbackRef = useRef(onTransitionChange);
    transitionCallbackRef.current = onTransitionChange;
    const resetCallbackRef = useRef<(() => void) | null>(null);
    const hasRematchStartedRef = useRef(false);
    const resetTimeoutRef = useRef<number | null>(null);
    const { user, token } = useAuth();
    const { error: showError, warning: showWarning } = useToast();
    const authRef = useRef({ user, token });
    authRef.current = { user, token };

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
            setIsConnected(false);
            return;
        }

        let active = true;
        let attemptRevision = 0;
        const finishTransition = () => {
            attemptRevision += 1;
            hasRematchStartedRef.current = false;
            clearResetTimeout();
            transitionCallbackRef.current?.(matchId, false);
        };

        // 加入对局
        matchSocket.joinMatch(matchId, playerId, {
            autoAcceptedPlayerIds: autoAcceptedPlayerIdsRef.current, credentials: readStoredMatchCredentials(matchId)?.credentials,
        });
        const unsubConnection = matchSocket.subscribeRematchConnection(setIsConnected);

        // 订阅状态更新
        const unsubState = matchSocket.subscribeState((newState) => {
            setState(newState);
        });

        // 订阅重置触发
        const unsubReset = matchSocket.subscribeReset(async () => {
            console.log('[RematchContext] subscribeReset 触发', { matchId, playerId, hasStarted: hasRematchStartedRef.current });
            if (hasRematchStartedRef.current) return;
            hasRematchStartedRef.current = true;
            const attempt = ++attemptRevision;
            const isCurrentAttempt = () => active && attemptRevision === attempt;
            clearResetTimeout();
            transitionCallbackRef.current?.(matchId, true);

            const currentMatchId = matchInfoRef.current.matchId;
            const currentPlayerId = matchInfoRef.current.playerId;
            const stored = currentMatchId ? readStoredMatchCredentials(currentMatchId) : null;
            const rawGameName = stored?.gameName;
            const gameName = rawGameName ? rawGameName.toLowerCase() : '';
            const credentials = stored?.credentials;
            console.log('[RematchContext] 凭据检查', { currentMatchId, currentPlayerId, gameName, hasCredentials: !!credentials });
            const playerName = stored?.playerName;
            const { user, token } = authRef.current;

            if (currentMatchId && currentPlayerId && gameName && credentials) {
                if (currentPlayerId === '0') {
                    // A slow response is not a failed create. Keep this attempt
                    // alive so a committed room's late proof is still handled.
                    resetTimeoutRef.current = window.setTimeout(() => {
                        if (!isCurrentAttempt()) return;
                        showWarning({ kind: 'i18n', ns: 'common', key: 'rematch.stillWaiting' });
                    }, OWNER_REMATCH_WAIT_NOTICE_MS);
                    try {
                        console.log('[RematchContext] P0 发起 playAgain', { gameName, currentMatchId });
                        const fallbackPlayerName = playerName || user?.username || `玩家${currentPlayerId}`;
                        const { nextMatchID, ownerCredentials, ownerType } = await matchApi.playAgain(gameName, currentMatchId, {
                            playerID: currentPlayerId,
                            credentials,
                            token: token ?? undefined,
                            playerName: fallbackPlayerName,
                        });
                        if (typeof nextMatchID !== 'string' || !nextMatchID.trim() || nextMatchID === currentMatchId
                            || typeof ownerCredentials !== 'string' || !ownerCredentials.trim()
                            || (ownerType !== 'guest' && ownerType !== 'user')) {
                            throw new Error('[RematchContext] invalid-create-response');
                        }
                        const nextOwnerType = ownerType;
                        const guestId = nextOwnerType === 'guest' ? getOrCreateGuestId() : undefined;
                        // Create already issued the P0 seat proof. Save it even after
                        // an in-app leave, but never replace a later selected room.
                        if (matchInfoRef.current.matchId !== currentMatchId) return;
                        const saved = await persistRematchOwnerCredentials(currentMatchId, {
                            matchID: nextMatchID, playerID: '0', credentials: ownerCredentials,
                            gameName, playerName: fallbackPlayerName,
                        }, {
                            matchID: nextMatchID, gameName, ownerType: nextOwnerType,
                            ownerKey: getOwnerKey(nextOwnerType === 'user' ? user?.id : undefined, guestId),
                        }, credentials);
                        if (!saved) {
                            if (isCurrentAttempt()) finishTransition();
                            return;
                        }
                        if (!isCurrentAttempt()) return;
                        clearResetTimeout();
                        matchSocket.broadcastNewRoom(`/play/${gameName}/match/${nextMatchID}`, ownerCredentials);
                        console.log('[RematchContext] P0 新房间已创建，跳转', { nextMatchID, gameName });
                        window.location.href = `/play/${gameName}/match/${nextMatchID}?playerID=${currentPlayerId}`;
                        return;
                    } catch (error) {
                        if (!isCurrentAttempt()) return;
                        showError({ kind: 'i18n', ns: 'common', key:
                            (error as matchApi.MatchApiError)?.code === 'REMATCH_SETUP_UNSUPPORTED'
                                ? 'rematch.setupUnsupported'
                                : (error as matchApi.MatchApiError)?.code === 'ROOM_REPLACEMENT_OUTCOME_UNKNOWN'
                                    ? 'rematch.outcomeUnknown'
                                    : (error as { code?: string })?.code === 'ROOM_CREDENTIAL_STORAGE_UNAVAILABLE'
                                        ? 'rematch.credentialsNotSaved' : 'rematch.failed' });
                        finishTransition();
                        return;
                    }
                } else {
                    // Keep the existing follower wait bound. The owner's create
                    // may already have committed, so only its actual result can
                    // end that request; a UI timeout must not discard fresh proof.
                    resetTimeoutRef.current = window.setTimeout(() => {
                        if (!isCurrentAttempt()) return;
                        showError({ kind: 'i18n', ns: 'common', key: 'rematch.waitTimeout' });
                        finishTransition();
                    }, 8000);
                    return;
                }
            }

            showError({ kind: 'i18n', ns: 'common', key: 'rematch.missingCredentials' });
            finishTransition();
        });

        // 订阅新房间通知（调试用）
        const unsubNewRoom = matchSocket.subscribeNewRoom((url) => {
            if (!active) return;
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
            active = false;
            finishTransition();
            unsubState();
            unsubConnection();
            unsubReset();
            unsubNewRoom();
            matchSocket.leaveMatch();
        };
    }, [isMultiplayer, matchId, playerId, clearResetTimeout, showError, showWarning]);

    // Metadata refresh must not tear down a handoff already in progress.
    useEffect(() => {
        if (isMultiplayer && matchId && playerId) matchSocket.setAutoAcceptedPlayerIds(autoAcceptedPlayerIds);
    }, [isMultiplayer, matchId, playerId, autoAcceptedPlayerIds]);

    // 投票
    const vote = useCallback(() => {
        console.log('[RematchContext] vote called', {
            isMultiplayer,
            matchId: matchInfoRef.current.matchId,
            playerId: matchInfoRef.current.playerId,
            isConnected: matchSocket.isSocketConnected(),
        });
        if (isMultiplayer) {
            console.log('[RematchContext] calling matchSocket.vote');
            matchSocket.vote();
        } else {
            console.warn('[RematchContext] not multiplayer, vote ignored');
        }
    }, [isMultiplayer]);

    // useMemo 包裹 Provider value，避免每次渲染创建新对象导致消费者重渲染
    const value = useMemo<RematchContextValue>(() => ({
        state,
        vote,
        isConnected,
        registerReset,
        setAutoAcceptedPlayerIds: (playerIds: string[]) => matchSocket.setAutoAcceptedPlayerIds(playerIds),
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
            setAutoAcceptedPlayerIds: () => {},
        };
    }
    return context;
}
