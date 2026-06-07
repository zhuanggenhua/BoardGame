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

export const MATCH_EMOTE_EVENTS = {
    JOIN: 'matchEmote:join',
    LEAVE: 'matchEmote:leave',
    SEND: 'matchEmote:send',
    SHOW: 'matchEmote:show',
    ERROR: 'matchEmote:error',
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

export interface MatchEmoteEvent {
    matchId: string;
    playerId: string;
    emoteId: string;
    createdAt: string;
}

export type MatchEmoteSendReason =
    | 'not_connected'
    | 'not_joined'
    | 'missing_payload'
    | 'match_not_found'
    | 'not_player'
    | 'invalid_emote'
    | 'rate_limited';

export type RematchStateCallback = (state: RematchVoteState) => void;
export type RematchResetCallback = () => void;
export type NewRoomCallback = (url: string) => void;
export type MatchChatCallback = (message: MatchChatMessage) => void;
export type MatchChatHistoryCallback = (history: MatchChatMessage[]) => void;
export type MatchEmoteCallback = (event: MatchEmoteEvent) => void;

class MatchSocketService {
    private socket: Socket | null = null;
    private boundSocket: Socket | null = null;
    private isConnected = false;
    private isConnecting = false;
    private currentMatchId: string | null = null;
    private currentPlayerId: string | null = null;
    private currentChatMatchId: string | null = null;
    private currentEmoteMatchId: string | null = null;
    private currentEmotePlayerId: string | null = null;
    private currentAutoAcceptedPlayerIds: string[] = [];
    private stateCallbacks: Set<RematchStateCallback> = new Set();
    private resetCallbacks: Set<RematchResetCallback> = new Set();
    private newRoomCallbacks: Set<NewRoomCallback> = new Set();
    private chatCallbacks: Set<MatchChatCallback> = new Set();
    private chatHistoryCallbacks: Set<MatchChatHistoryCallback> = new Set();
    private emoteCallbacks: Set<MatchEmoteCallback> = new Set();
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

    private readonly handleEmoteShow = (payload: MatchEmoteEvent) => {
        this.notifyEmoteCallbacks(payload);
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
        socket.on(MATCH_EMOTE_EVENTS.SHOW, this.handleEmoteShow);
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
        this.boundSocket.off(MATCH_EMOTE_EVENTS.SHOW, this.handleEmoteShow);
        this.boundSocket = null;
    }

    private syncActiveChannels(): void {
        if (!this.socket?.connected) {
            return;
        }

        if (this.currentMatchId && this.currentPlayerId) {
            this.socket.emit(REMATCH_EVENTS.JOIN_MATCH, this.buildJoinMatchPayload(this.currentMatchId, this.currentPlayerId));
        }

        if (this.currentChatMatchId) {
            this.socket.emit(MATCH_CHAT_EVENTS.JOIN, { matchId: this.currentChatMatchId });
        }

        if (this.currentEmoteMatchId && this.currentEmotePlayerId) {
            this.socket.emit(MATCH_EMOTE_EVENTS.JOIN, {
                matchId: this.currentEmoteMatchId,
                playerId: this.currentEmotePlayerId,
            });
        }
    }

    private releaseConnectionIfIdle(): void {
        if (this.currentMatchId || this.currentChatMatchId || this.currentEmoteMatchId) {
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

    private notifyEmoteCallbacks(event: MatchEmoteEvent): void {
        this.emoteCallbacks.forEach((callback) => {
            try {
                callback(event);
            } catch (error) {
                log.error('emote_callback_failed', { error, emoteId: event.emoteId });
            }
        });
    }

    joinMatch(matchId: string, playerId: string, options?: { autoAcceptedPlayerIds?: string[] }): void {
        this.currentMatchId = matchId;
        this.currentPlayerId = playerId;
        this.currentAutoAcceptedPlayerIds = this.normalizeAutoAcceptedPlayerIds(options?.autoAcceptedPlayerIds ?? []);
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
        socket.emit(REMATCH_EVENTS.JOIN_MATCH, this.buildJoinMatchPayload(matchId, playerId));
    }

    private normalizeAutoAcceptedPlayerIds(playerIds: string[]): string[] {
        return [...new Set(
            playerIds.filter((playerId) => typeof playerId === 'string' && playerId.trim().length > 0).map((playerId) => playerId.trim()),
        )];
    }

    private buildJoinMatchPayload(matchId: string, playerId: string): { matchId: string; playerId: string; autoAcceptedPlayerIds?: string[] } {
        return {
            matchId,
            playerId,
            ...(this.currentAutoAcceptedPlayerIds.length > 0
                ? { autoAcceptedPlayerIds: this.currentAutoAcceptedPlayerIds }
                : {}),
        };
    }

    setAutoAcceptedPlayerIds(playerIds: string[]): void {
        this.currentAutoAcceptedPlayerIds = this.normalizeAutoAcceptedPlayerIds(playerIds);

        if (this.socket?.connected && this.currentMatchId && this.currentPlayerId) {
            this.socket.emit(REMATCH_EVENTS.JOIN_MATCH, this.buildJoinMatchPayload(this.currentMatchId, this.currentPlayerId));
        }
    }

    leaveMatch(): void {
        if (this.socket?.connected) {
            this.socket.emit(REMATCH_EVENTS.LEAVE_MATCH);
        }

        this.currentMatchId = null;
        this.currentPlayerId = null;
        this.currentAutoAcceptedPlayerIds = [];
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

    joinEmotes(matchId: string, playerId: string): void {
        if (this.currentEmoteMatchId && this.currentEmoteMatchId !== matchId && this.socket?.connected) {
            this.socket.emit(MATCH_EMOTE_EVENTS.LEAVE);
        }

        this.currentEmoteMatchId = matchId;
        this.currentEmotePlayerId = playerId;
        const socket = this.ensureSocketConnection();
        if (!socket?.connected) {
            this.isConnected = false;
            this.isConnecting = true;
            return;
        }

        this.isConnected = true;
        this.isConnecting = false;
        socket.emit(MATCH_EMOTE_EVENTS.JOIN, { matchId, playerId });
    }

    leaveEmotes(): void {
        if (this.socket?.connected && this.currentEmoteMatchId) {
            this.socket.emit(MATCH_EMOTE_EVENTS.LEAVE);
        }

        this.currentEmoteMatchId = null;
        this.currentEmotePlayerId = null;
        this.releaseConnectionIfIdle();
    }

    sendEmote(
        emoteId: string,
        onResult?: (response: { ok: boolean; reason?: MatchEmoteSendReason }) => void,
    ): { ok: boolean; reason?: MatchEmoteSendReason } {
        if (!this.socket?.connected) {
            return { ok: false, reason: 'not_connected' };
        }

        if (!this.currentEmoteMatchId || !this.currentEmotePlayerId) {
            return { ok: false, reason: 'not_joined' };
        }

        this.socket.emit(MATCH_EMOTE_EVENTS.SEND, {
            emoteId,
            matchId: this.currentEmoteMatchId,
            playerId: this.currentEmotePlayerId,
        }, (response?: { ok?: boolean; reason?: MatchEmoteSendReason }) => {
            onResult?.({
                ok: response?.ok !== false,
                reason: response?.reason,
            });
            if (response?.ok === false) {
                log.warn('emote_send_rejected', {
                    matchId: this.currentEmoteMatchId,
                    playerId: this.currentEmotePlayerId,
                    emoteId,
                    reason: response.reason,
                });
            }
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

    subscribeEmote(callback: MatchEmoteCallback): () => void {
        this.emoteCallbacks.add(callback);
        return () => {
            this.emoteCallbacks.delete(callback);
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
        this.leaveEmotes();
        this.teardownEventHandlers();
        lobbySocket.releaseConnection('match');
        this.socket = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.currentAutoAcceptedPlayerIds = [];
        this.stateCallbacks.clear();
        this.resetCallbacks.clear();
        this.newRoomCallbacks.clear();
        this.chatCallbacks.clear();
        this.chatHistoryCallbacks.clear();
        this.emoteCallbacks.clear();
    }
}

export const matchSocket = new MatchSocketService();
