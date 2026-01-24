/**
 * 对局 WebSocket 服务
 * 
 * 处理重赛投票等对局内实时事件（独立于 boardgame.io 的游戏状态同步）
 */

import { io, Socket } from 'socket.io-client';
import { GAME_SERVER_URL } from '../config/server';

// 重赛事件常量（与服务端 server.ts 保持一致）
export const REMATCH_EVENTS = {
    JOIN_MATCH: 'rematch:join',
    LEAVE_MATCH: 'rematch:leave',
    VOTE: 'rematch:vote',
    STATE_UPDATE: 'rematch:stateUpdate',
    TRIGGER_RESET: 'rematch:triggerReset',
} as const;

// 重赛投票状态
export interface RematchVoteState {
    votes: Record<string, boolean>;
    ready: boolean;
    /**
     * 递增版本号，用于客户端丢弃旧状态（解决刷新/重连时的状态回退竞态）
     */
    revision: number;
}

// 状态更新回调
export type RematchStateCallback = (state: RematchVoteState) => void;
export type RematchResetCallback = () => void;

class MatchSocketService {
    private socket: Socket | null = null;
    private isConnected = false;
    private currentMatchId: string | null = null;
    private currentPlayerId: string | null = null;
    private stateCallbacks: Set<RematchStateCallback> = new Set();
    private resetCallbacks: Set<RematchResetCallback> = new Set();
    private currentState: RematchVoteState = { votes: {}, ready: false, revision: 0 };
    private lastAcceptedRevision = 0;

    /**
     * 连接到对局 Socket 服务
     */
    connect(): void {
        if (this.socket?.connected) {
            return;
        }

        this.socket = io(GAME_SERVER_URL, {
            path: '/lobby-socket',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000,
        });

        this.setupEventHandlers();
    }

    /**
     * 设置事件处理器
     */
    private setupEventHandlers(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('[MatchSocket] 已连接');
            this.isConnected = true;

            // 重连后自动重新加入对局
            if (this.currentMatchId && this.currentPlayerId) {
                this.socket?.emit(REMATCH_EVENTS.JOIN_MATCH, {
                    matchId: this.currentMatchId,
                    playerId: this.currentPlayerId,
                });
            }
        });

        this.socket.on('disconnect', () => {
            console.log('[MatchSocket] 已断开');
            this.isConnected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('[MatchSocket] 连接错误:', error.message);
        });

        // 接收重赛状态更新
        this.socket.on(REMATCH_EVENTS.STATE_UPDATE, (state: RematchVoteState) => {
            // 防止刷新/重连时出现旧状态覆盖新状态（例如：服务端 reset 后短时间内又 emit 了旧 ready=true）
            const incomingRev = state.revision ?? 0;
            if (incomingRev < this.lastAcceptedRevision) {
                console.warn('[MatchSocket] 忽略回退的 rematch 状态', {
                    incoming: incomingRev,
                    current: this.lastAcceptedRevision,
                    state,
                });
                return;
            }
            this.lastAcceptedRevision = incomingRev;
            console.log('[MatchSocket] 收到状态更新:', state);
            this.currentState = state;
            this.notifyStateCallbacks(state);
        });

        // 接收重置触发事件
        this.socket.on(REMATCH_EVENTS.TRIGGER_RESET, () => {
            console.log('[MatchSocket] 收到重置触发');
            this.notifyResetCallbacks();
        });
    }

    /**
     * 通知状态回调
     */
    private notifyStateCallbacks(state: RematchVoteState): void {
        this.stateCallbacks.forEach((callback) => {
            try {
                callback(state);
            } catch (error) {
                console.error('[MatchSocket] 状态回调错误:', error);
            }
        });
    }

    /**
     * 通知重置回调
     */
    private notifyResetCallbacks(): void {
        this.resetCallbacks.forEach((callback) => {
            try {
                callback();
            } catch (error) {
                console.error('[MatchSocket] 重置回调错误:', error);
            }
        });
    }

    /**
     * 加入对局（订阅重赛状态）
     */
    joinMatch(matchId: string, playerId: string): void {
        this.currentMatchId = matchId;
        this.currentPlayerId = playerId;
        this.currentState = { votes: {}, ready: false, revision: 0 };
        this.lastAcceptedRevision = 0;

        if (!this.socket?.connected) {
            this.connect();
        } else {
            this.socket.emit(REMATCH_EVENTS.JOIN_MATCH, { matchId, playerId });
        }
    }

    /**
     * 离开对局
     */
    leaveMatch(): void {
        if (this.socket?.connected) {
            this.socket.emit(REMATCH_EVENTS.LEAVE_MATCH);
        }
        this.currentMatchId = null;
        this.currentPlayerId = null;
        this.currentState = { votes: {}, ready: false, revision: 0 };
        this.lastAcceptedRevision = 0;
    }

    /**
     * 投票重赛
     */
    vote(): void {
        if (!this.socket?.connected) {
            console.warn('[MatchSocket] 投票失败：未连接');
            return;
        }
        if (!this.currentMatchId || !this.currentPlayerId) {
            console.warn('[MatchSocket] 投票失败：未加入对局');
            return;
        }
        this.socket.emit(REMATCH_EVENTS.VOTE);
    }

    /**
     * 订阅状态更新
     */
    subscribeState(callback: RematchStateCallback): () => void {
        this.stateCallbacks.add(callback);
        // 立即通知当前状态
        callback(this.currentState);
        return () => {
            this.stateCallbacks.delete(callback);
        };
    }

    /**
     * 订阅重置触发
     */
    subscribeReset(callback: RematchResetCallback): () => void {
        this.resetCallbacks.add(callback);
        return () => {
            this.resetCallbacks.delete(callback);
        };
    }

    /**
     * 获取当前状态
     */
    getState(): RematchVoteState {
        return this.currentState;
    }

    /**
     * 获取连接状态
     */
    isSocketConnected(): boolean {
        return this.isConnected;
    }

    /**
     * 断开连接
     */
    disconnect(): void {
        this.leaveMatch();
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
        this.stateCallbacks.clear();
        this.resetCallbacks.clear();
    }
}

// 导出单例实例
export const matchSocket = new MatchSocketService();
