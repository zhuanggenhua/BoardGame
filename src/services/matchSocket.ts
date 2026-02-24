/**
 * 对局 WebSocket 服务
 * 
 * 处理重赛投票等对局内实时事件（独立于游戏状态同步通道）
 */

import { io, Socket } from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import { GAME_SERVER_URL } from '../config/server';
import { onPageVisible } from './visibilityResync';
import { socketHealthChecker } from './socketHealthCheck';

// 重赛事件常量（与服务端 server.ts 保持一致）
export const REMATCH_EVENTS = {
    JOIN_MATCH: 'rematch:join',
    LEAVE_MATCH: 'rematch:leave',
    VOTE: 'rematch:vote',
    STATE_UPDATE: 'rematch:stateUpdate',
    TRIGGER_RESET: 'rematch:triggerReset',
    // 调试用：广播新房间
    DEBUG_NEW_ROOM: 'debug:newRoom',
} as const;

// 对局聊天事件常量（与服务端 server.ts 保持一致）
export const MATCH_CHAT_EVENTS = {
    JOIN: 'matchChat:join',
    LEAVE: 'matchChat:leave',
    SEND: 'matchChat:send',
    MESSAGE: 'matchChat:message',
    /** 加入房间时服务端回推的历史消息 */
    HISTORY: 'matchChat:history',
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

export interface MatchChatMessage {
    id: string;
    matchId: string;
    senderId?: string;
    senderName: string;
    text: string;
    createdAt: string;
}

// 状态更新回调
export type RematchStateCallback = (state: RematchVoteState) => void;
export type RematchResetCallback = () => void;
export type NewRoomCallback = (url: string) => void;
export type MatchChatCallback = (message: MatchChatMessage) => void;
export type MatchChatHistoryCallback = (messages: MatchChatMessage[]) => void;

class MatchSocketService {
    private socket: Socket | null = null;
    private isConnected = false;
    private isConnecting = false; // 新增：防止重复连接
    private currentMatchId: string | null = null;
    private currentPlayerId: string | null = null;
    private stateCallbacks: Set<RematchStateCallback> = new Set();
    private resetCallbacks: Set<RematchResetCallback> = new Set();
    private newRoomCallbacks: Set<NewRoomCallback> = new Set();
    private chatCallbacks: Set<MatchChatCallback> = new Set();
    private chatHistoryCallbacks: Set<MatchChatHistoryCallback> = new Set();
    private currentState: RematchVoteState = { votes: {}, ready: false, revision: 0 };
    private lastAcceptedRevision = 0;
    private currentChatMatchId: string | null = null;
    private _cleanupVisibility: (() => void) | null = null;
    private _cleanupHealthCheck: (() => void) | null = null;

    /**
     * 连接到对局 Socket 服务
     */
    connect(): void {
        if (this.socket?.connected) {
            return;
        }
        if (this.isConnecting) {
            return;
        }
        if (this.socket) {
            return;
        }
        this.isConnecting = true;
        this.socket = io(GAME_SERVER_URL, {
            parser: msgpackParser,
            path: '/lobby-socket',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity, // 后台标签页冻结后需要无限重连
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000, // 限制最大重连间隔，避免指数退避过大
            timeout: 10000,
        });

        this.setupEventHandlers();
        this.setupVisibilityHandler();
        this.setupHealthCheck();
    }

    /**
     * 设置事件处理器
     */
    private setupEventHandlers(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.isConnecting = false;

            // 连接成功后自动加入对局
            if (this.currentMatchId && this.currentPlayerId) {
                this.socket?.emit(REMATCH_EVENTS.JOIN_MATCH, {
                    matchId: this.currentMatchId,
                    playerId: this.currentPlayerId,
                });
            }

            if (this.currentChatMatchId) {
                this.socket?.emit(MATCH_CHAT_EVENTS.JOIN, { matchId: this.currentChatMatchId });
            }
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.isConnecting = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('[MatchSocket] 连接错误:', error.message);
            this.isConnecting = false;
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
            this.currentState = state;
            console.log('[MatchSocket] 收到重赛状态更新', { votes: state.votes, ready: state.ready, revision: state.revision });
            this.notifyStateCallbacks(state);
        });

        // 接收重置触发事件
        this.socket.on(REMATCH_EVENTS.TRIGGER_RESET, () => {
            this.notifyResetCallbacks();
        });

        // 接收新房间通知（调试用）
        this.socket.on(REMATCH_EVENTS.DEBUG_NEW_ROOM, (data: { url: string }) => {
            this.notifyNewRoomCallbacks(data.url);
        });

        // 接收聊天消息
        this.socket.on(MATCH_CHAT_EVENTS.MESSAGE, (payload: MatchChatMessage) => {
            this.notifyChatCallbacks(payload);
        });

        // 接收历史聊天消息（加入房间时服务端回推）
        this.socket.on(MATCH_CHAT_EVENTS.HISTORY, (messages: MatchChatMessage[]) => {
            if (!Array.isArray(messages)) return;
            this.chatHistoryCallbacks.forEach((cb) => {
                try { cb(messages); } catch (e) { console.error('[MatchSocket] 历史消息回调错误:', e); }
            });
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
     * 通知新房间回调
     */
    private notifyNewRoomCallbacks(url: string): void {
        this.newRoomCallbacks.forEach((callback) => {
            try {
                callback(url);
            } catch (error) {
                console.error('[MatchSocket] 新房间回调错误:', error);
            }
        });
    }

    /**
     * 通知聊天回调
     */
    private notifyChatCallbacks(message: MatchChatMessage): void {
        this.chatCallbacks.forEach((callback) => {
            try {
                callback(message);
            } catch (error) {
                console.error('[MatchSocket] 聊天回调错误:', error);
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
     * 加入聊天房间
     */
    joinChat(matchId: string): void {
        if (this.currentChatMatchId && this.currentChatMatchId !== matchId && this.socket?.connected) {
            this.socket.emit(MATCH_CHAT_EVENTS.LEAVE);
        }
        this.currentChatMatchId = matchId;
        if (!this.socket?.connected) {
            this.connect();
        } else {
            this.socket.emit(MATCH_CHAT_EVENTS.JOIN, { matchId });
        }
    }

    /**
     * 离开聊天房间
     */
    leaveChat(): void {
        if (this.socket?.connected && this.currentChatMatchId) {
            this.socket.emit(MATCH_CHAT_EVENTS.LEAVE);
        }
        this.currentChatMatchId = null;
    }

    /**
     * 发送聊天消息
     */
    sendChat(text: string, senderId?: string, senderName?: string): { ok: boolean; reason?: 'not_connected' | 'not_joined' } {
        if (!this.socket?.connected) {
            return { ok: false, reason: 'not_connected' };
        }
        if (!this.currentChatMatchId) {
            return { ok: false, reason: 'not_joined' };
        }
        this.socket.emit(MATCH_CHAT_EVENTS.SEND, {
            text,
            senderId,
            senderName,
        });
        return { ok: true };
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
        console.log('[MatchSocket] 发送投票', { matchId: this.currentMatchId, playerId: this.currentPlayerId });
        this.socket.emit(REMATCH_EVENTS.VOTE);
    }

    /**
     * 广播新房间（调试用）
     */
    broadcastNewRoom(url: string): void {
        if (!this.socket?.connected) {
            console.warn('[MatchSocket] 广播失败：未连接');
            return;
        }
        if (!this.currentMatchId) {
            console.warn('[MatchSocket] 广播失败：未加入对局');
            return;
        }
        this.socket.emit(REMATCH_EVENTS.DEBUG_NEW_ROOM, { url });
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
     * 订阅新房间通知（调试用）
     */
    subscribeNewRoom(callback: NewRoomCallback): () => void {
        this.newRoomCallbacks.add(callback);
        return () => {
            this.newRoomCallbacks.delete(callback);
        };
    }

    /**
     * 订阅聊天消息
     */
    subscribeChat(callback: MatchChatCallback): () => void {
        this.chatCallbacks.add(callback);
        return () => {
            this.chatCallbacks.delete(callback);
        };
    }

    /**
     * 订阅历史聊天消息（加入房间时回推）
     */
    subscribeChatHistory(callback: MatchChatHistoryCallback): () => void {
        this.chatHistoryCallbacks.add(callback);
        return () => {
            this.chatHistoryCallbacks.delete(callback);
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
        this.leaveChat();
        if (this._cleanupVisibility) {
            this._cleanupVisibility();
            this._cleanupVisibility = null;
        }
        if (this._cleanupHealthCheck) {
            this._cleanupHealthCheck();
            this._cleanupHealthCheck = null;
        }
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
        this.stateCallbacks.clear();
        this.resetCallbacks.clear();
        this.chatCallbacks.clear();
    }

    /**
     * 页面恢复可见时主动重连/重新同步
     *
     * 后台标签页冻结期间 socket.io 心跳可能超时导致静默断线。
     * 即使连接仍然存活，也可能错过了重赛投票状态更新或聊天消息。
     * 恢复可见时：
     * - 已断线：强制重连（connect 事件中会自动 rejoin）
     * - 仍连接：重新请求当前重赛状态（可能错过了增量更新）
     */
    private resync(): void {
        if (!this.socket) return;
        if (this.socket.connected) {
            // 连接正常但可能错过了增量更新，重新请求当前状态
            if (this.currentMatchId && this.currentPlayerId) {
                console.log('[MatchSocket] 页面恢复可见，重新同步重赛状态');
                // 重置 revision 门控：后台期间服务端可能重启导致 revision 回退，
                // 必须接受服务端返回的最新状态
                this.lastAcceptedRevision = 0;
                this.socket.emit(REMATCH_EVENTS.JOIN_MATCH, {
                    matchId: this.currentMatchId,
                    playerId: this.currentPlayerId,
                });
            }
            // 重新请求聊天历史（可能错过了消息）
            if (this.currentChatMatchId) {
                this.socket.emit(MATCH_CHAT_EVENTS.JOIN, { matchId: this.currentChatMatchId });
            }
            return;
        }
        console.log('[MatchSocket] 页面恢复可见，重新连接');
        this.socket.connect();
    }

    /**
     * 注册 visibilitychange 监听
     */
    private setupVisibilityHandler(): void {
        if (this._cleanupVisibility) return;
        this._cleanupVisibility = onPageVisible(() => this.resync());
    }

    /**
     * 启动健康检查（定期检查连接状态并主动重连）
     */
    private setupHealthCheck(): void {
        if (this._cleanupHealthCheck) return;
        this._cleanupHealthCheck = socketHealthChecker.start({
            name: 'MatchSocket',
            getSocket: () => this.socket,
            isConnected: () => this.isConnected,
            interval: 30000, // 30秒检查一次
        });
    }

    private _cleanupHealthCheck: (() => void) | null = null;
}

// 导出单例实例
export const matchSocket = new MatchSocketService();
