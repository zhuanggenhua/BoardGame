/**
 * 对局 WebSocket 服务。
 *
 * 重赛、对局聊天本来就挂在 `/lobby-socket` 上，前端应复用同一条底层连接，
 * 避免 Lobby 和 Match 各自建连造成超时和重连风暴。
 */

import type { Socket } from 'socket.io-client';
import { createScopedLogger } from '../lib/logger';
import { lobbySocket } from './lobbySocket';

const log = createScopedLogger('MatchSocket');

export const REMATCH_EVENTS = {
    JOIN_MATCH: 'rematch:join',
    LEAVE_MATCH: 'rematch:leave',
    VOTE: 'rematch:vote',
    STATE_UPDATE: 'rematch:stateUpdate',
    TRIGGER_RESET: 'rematch:triggerReset',
    DEBUG_NEW_ROOM: 'debug:newRoom',
} as const;

export const MATCH_CHAT_EVENTS = {
    JOIN: 'matchChat:join',
    LEAVE: 'matchChat:leave',
    SEND: 'matchChat:send',
    MESSAGE: 'matchChat:message',
    HISTORY: 'matchChat:history',
} as const;

export interface RematchVoteState {
    votes: Record<string, boolean>;
    ready: boolean;
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

export type RematchStateCallback = (state: RematchVoteState) => void;
export type RematchResetCallback = () => void;
export type NewRoomCallback = (url: string) => void;
export type MatchChatCallback = (message: MatchChatMessage) => void;
export type MatchChatHistoryCallback = (history: MatchChatMessage[]) => void;

class MatchSocketService {
    private socket: Socket | null = null;
    private boundSocket: Socket | null = null;
    private isConnected = false;
    private isConnecting = false;
    private currentMatchId: string | null = null;
    private currentPlayerId: string | null = null;
    private currentChatMatchId: string | null = null;
    private stateCallbacks: Set<RematchStateCallback> = new Set();
    private resetCallbacks: Set<RematchResetCallback> = new Set();
    private newRoomCallbacks: Set<NewRoomCallback> = new Set();
    private chatCallbacks: Set<MatchChatCallback> = new Set();
    private chatHistoryCallbacks: Set<MatchChatHistoryCallback> = new Set();
    private currentState: RematchVoteState = { votes: {}, ready: false, revision: 0 };
    private lastAcceptedRevision = 0;

    private readonly handleConnect = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.syncActiveChannels();
    };

    private readonly handleDisconnect = () => {
        this.isConnected = false;
        this.isConnecting = false;
    };

    private readonly handleConnectError = (error: Error) => {
        log.error('connect_error', { message: error.message });
        this.isConnected = false;
        this.isConnecting = false;
    };

    private readonly handleStateUpdate = (state: RematchVoteState) => {
        const incomingRevision = state.revision ?? 0;
        if (incomingRevision < this.lastAcceptedRevision) {
            log.warn('drop_stale_rematch_state', {
                incomingRevision,
                currentRevision: this.lastAcceptedRevision,
            });
            return;
        }

        this.lastAcceptedRevision = incomingRevision;
        this.currentState = state;
        log.debug('state_update', {
            votes: state.votes,
            ready: state.ready,
            revision: state.revision,
        });
        this.notifyStateCallbacks(state);
    };

    private readonly handleReset = () => {
        this.notifyResetCallbacks();
    };

    private readonly handleNewRoom = (data: { url: string }) => {
        this.notifyNewRoomCallbacks(data.url);
    };

    private readonly handleChatMessage = (payload: MatchChatMessage) => {
        this.notifyChatCallbacks(payload);
    };

    private readonly handleChatHistory = (history: MatchChatMessage[]) => {
        this.notifyChatHistoryCallbacks(history);
    };

    connect(): void {
        const sharedSocket = this.ensureSocketConnection();
        if (!sharedSocket) {
            return;
        }

        if (sharedSocket.connected) {
            this.isConnected = true;
            this.isConnecting = false;
            this.syncActiveChannels();
            return;
        }

        this.isConnected = false;
        this.isConnecting = true;
    }

    private ensureSocketConnection(): Socket | null {
        const sharedSocket = lobbySocket.acquireConnection('match');
        if (!sharedSocket) {
            return null;
        }

        if (this.socket !== sharedSocket) {
            this.teardownEventHandlers();
            this.socket = sharedSocket;
        }

        this.setupEventHandlers(sharedSocket);
        return sharedSocket;
    }

    private setupEventHandlers(socket: Socket): void {
        if (this.boundSocket === socket) {
            return;
        }

        this.teardownEventHandlers();
        socket.on('connect', this.handleConnect);
        socket.on('disconnect', this.handleDisconnect);
        socket.on('connect_error', this.handleConnectError);
        socket.on(REMATCH_EVENTS.STATE_UPDATE, this.handleStateUpdate);
        socket.on(REMATCH_EVENTS.TRIGGER_RESET, this.handleReset);
        socket.on(REMATCH_EVENTS.DEBUG_NEW_ROOM, this.handleNewRoom);
        socket.on(MATCH_CHAT_EVENTS.MESSAGE, this.handleChatMessage);
        socket.on(MATCH_CHAT_EVENTS.HISTORY, this.handleChatHistory);
        this.boundSocket = socket;
    }

    private teardownEventHandlers(): void {
        if (!this.boundSocket) {
            return;
        }

        this.boundSocket.off('connect', this.handleConnect);
        this.boundSocket.off('disconnect', this.handleDisconnect);
        this.boundSocket.off('connect_error', this.handleConnectError);
        this.boundSocket.off(REMATCH_EVENTS.STATE_UPDATE, this.handleStateUpdate);
        this.boundSocket.off(REMATCH_EVENTS.TRIGGER_RESET, this.handleReset);
        this.boundSocket.off(REMATCH_EVENTS.DEBUG_NEW_ROOM, this.handleNewRoom);
        this.boundSocket.off(MATCH_CHAT_EVENTS.MESSAGE, this.handleChatMessage);
        this.boundSocket.off(MATCH_CHAT_EVENTS.HISTORY, this.handleChatHistory);
        this.boundSocket = null;
    }

    private syncActiveChannels(): void {
        if (!this.socket?.connected) {
            return;
        }

        if (this.currentMatchId && this.currentPlayerId) {
            this.socket.emit(REMATCH_EVENTS.JOIN_MATCH, {
                matchId: this.currentMatchId,
                playerId: this.currentPlayerId,
            });
        }

        if (this.currentChatMatchId) {
            this.socket.emit(MATCH_CHAT_EVENTS.JOIN, { matchId: this.currentChatMatchId });
        }
    }

    private releaseConnectionIfIdle(): void {
        if (this.currentMatchId || this.currentChatMatchId) {
            return;
        }

        this.teardownEventHandlers();
        lobbySocket.releaseConnection('match');
        this.socket = lobbySocket.getSharedSocket();
        this.isConnected = false;
        this.isConnecting = false;
    }

    private notifyStateCallbacks(state: RematchVoteState): void {
        this.stateCallbacks.forEach((callback) => {
            try {
                callback(state);
            } catch (error) {
                log.error('state_callback_failed', { error });
            }
        });
    }

    private notifyResetCallbacks(): void {
        this.resetCallbacks.forEach((callback) => {
            try {
                callback();
            } catch (error) {
                log.error('reset_callback_failed', { error });
            }
        });
    }

    private notifyNewRoomCallbacks(url: string): void {
        this.newRoomCallbacks.forEach((callback) => {
            try {
                callback(url);
            } catch (error) {
                log.error('new_room_callback_failed', { error, url });
            }
        });
    }

    private notifyChatCallbacks(message: MatchChatMessage): void {
        this.chatCallbacks.forEach((callback) => {
            try {
                callback(message);
            } catch (error) {
                log.error('chat_callback_failed', { error, messageId: message.id });
            }
        });
    }

    private notifyChatHistoryCallbacks(history: MatchChatMessage[]): void {
        this.chatHistoryCallbacks.forEach((callback) => {
            try {
                callback(history);
            } catch (error) {
                log.error('chat_history_callback_failed', { error, count: history.length });
            }
        });
    }

    joinMatch(matchId: string, playerId: string): void {
        this.currentMatchId = matchId;
        this.currentPlayerId = playerId;
        this.currentState = { votes: {}, ready: false, revision: 0 };
        this.lastAcceptedRevision = 0;

        const socket = this.ensureSocketConnection();
        if (!socket?.connected) {
            this.isConnected = false;
            this.isConnecting = true;
            return;
        }

        this.isConnected = true;
        this.isConnecting = false;
        socket.emit(REMATCH_EVENTS.JOIN_MATCH, { matchId, playerId });
    }

    leaveMatch(): void {
        if (this.socket?.connected) {
            this.socket.emit(REMATCH_EVENTS.LEAVE_MATCH);
        }

        this.currentMatchId = null;
        this.currentPlayerId = null;
        this.currentState = { votes: {}, ready: false, revision: 0 };
        this.lastAcceptedRevision = 0;
        this.releaseConnectionIfIdle();
    }

    joinChat(matchId: string): void {
        if (this.currentChatMatchId && this.currentChatMatchId !== matchId && this.socket?.connected) {
            this.socket.emit(MATCH_CHAT_EVENTS.LEAVE);
        }

        this.currentChatMatchId = matchId;
        const socket = this.ensureSocketConnection();
        if (!socket?.connected) {
            this.isConnected = false;
            this.isConnecting = true;
            return;
        }

        this.isConnected = true;
        this.isConnecting = false;
        socket.emit(MATCH_CHAT_EVENTS.JOIN, { matchId });
    }

    leaveChat(): void {
        if (this.socket?.connected && this.currentChatMatchId) {
            this.socket.emit(MATCH_CHAT_EVENTS.LEAVE);
        }

        this.currentChatMatchId = null;
        this.releaseConnectionIfIdle();
    }

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

    vote(): void {
        if (!this.socket?.connected) {
            log.warn('vote_skipped_not_connected');
            return;
        }

        if (!this.currentMatchId || !this.currentPlayerId) {
            log.warn('vote_skipped_not_joined');
            return;
        }

        log.debug('vote', {
            matchId: this.currentMatchId,
            playerId: this.currentPlayerId,
        });
        this.socket.emit(REMATCH_EVENTS.VOTE);
    }

    broadcastNewRoom(url: string): void {
        if (!this.socket?.connected) {
            log.warn('broadcast_new_room_skipped_not_connected');
            return;
        }

        if (!this.currentMatchId) {
            log.warn('broadcast_new_room_skipped_not_joined');
            return;
        }

        this.socket.emit(REMATCH_EVENTS.DEBUG_NEW_ROOM, { url });
    }

    subscribeState(callback: RematchStateCallback): () => void {
        this.stateCallbacks.add(callback);
        callback(this.currentState);
        return () => {
            this.stateCallbacks.delete(callback);
        };
    }

    subscribeReset(callback: RematchResetCallback): () => void {
        this.resetCallbacks.add(callback);
        return () => {
            this.resetCallbacks.delete(callback);
        };
    }

    subscribeNewRoom(callback: NewRoomCallback): () => void {
        this.newRoomCallbacks.add(callback);
        return () => {
            this.newRoomCallbacks.delete(callback);
        };
    }

    subscribeChat(callback: MatchChatCallback): () => void {
        this.chatCallbacks.add(callback);
        return () => {
            this.chatCallbacks.delete(callback);
        };
    }

    subscribeChatHistory(callback: MatchChatHistoryCallback): () => void {
        this.chatHistoryCallbacks.add(callback);
        return () => {
            this.chatHistoryCallbacks.delete(callback);
        };
    }

    getState(): RematchVoteState {
        return this.currentState;
    }

    isSocketConnected(): boolean {
        return this.isConnected;
    }

    disconnect(): void {
        this.leaveMatch();
        this.leaveChat();
        this.teardownEventHandlers();
        lobbySocket.releaseConnection('match');
        this.socket = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.stateCallbacks.clear();
        this.resetCallbacks.clear();
        this.newRoomCallbacks.clear();
        this.chatCallbacks.clear();
        this.chatHistoryCallbacks.clear();
    }
}

export const matchSocket = new MatchSocketService();
