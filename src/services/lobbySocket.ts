/**
 * 大厅 WebSocket 服务
 * 
 * 实现房间列表的实时广播订阅，替代轮询机制
 */

import { io, Socket } from 'socket.io-client';
import { GAME_SERVER_URL } from '../config/server';
import i18n from '../lib/i18n';

const normalizeGameName = (name?: unknown) => {
    if (typeof name === 'string') return name.toLowerCase();
    if (name == null) return '';
    console.warn('[LobbySocket]', tLobbySocket('invalidGameId', { value: String(name) }));
    return '';
};

// 大厅事件类型
export const LOBBY_EVENTS = {
    // 客户端 -> 服务器
    SUBSCRIBE_LOBBY: 'lobby:subscribe',
    UNSUBSCRIBE_LOBBY: 'lobby:unsubscribe',

    // 服务器 -> 客户端
    LOBBY_UPDATE: 'lobby:update',
    MATCH_CREATED: 'lobby:matchCreated',
    MATCH_UPDATED: 'lobby:matchUpdated',
    MATCH_ENDED: 'lobby:matchEnded',
    HEARTBEAT: 'lobby:heartbeat',
} as const;

const tLobbySocket = (key: string, params?: Record<string, string | number>) => (
    i18n.t(`lobby:socket.${key}`, params)
);

const formatErrorMessage = (error: unknown) => (
    error instanceof Error ? error.message : String(error)
);

// 房间信息类型
export interface LobbyMatch {
    matchID: string;
    gameName: string;
    players: Array<{
        id: number;
        name?: string;
        isConnected?: boolean;
    }>;
    createdAt?: number;
    updatedAt?: number;
    roomName?: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
}

interface LobbySnapshotPayload {
    version: number;
    matches: LobbyMatch[];
}

interface LobbyMatchPayload {
    version: number;
    match: LobbyMatch;
}

interface LobbyMatchEndedPayload {
    version: number;
    matchID: string;
}

interface LobbyHeartbeatPayload {
    version: number;
    timestamp: number;
}

// 大厅更新回调类型
export type LobbyUpdateCallback = (matches: LobbyMatch[]) => void;

class LobbySocketService {
    private socket: Socket | null = null;
    private subscribers: Set<LobbyUpdateCallback> = new Set();
    private statusSubscribers: Set<(status: { connected: boolean; lastError?: string }) => void> = new Set();
    private isConnected = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private currentMatches: LobbyMatch[] = [];
    private lobbyVersion = -1;
    private subscribedGameId: string | null = null;

    private upsertMatch(match: LobbyMatch): void {
        const index = this.currentMatches.findIndex(m => m.matchID === match.matchID);
        if (index >= 0) {
            this.currentMatches = this.currentMatches.map(m =>
                m.matchID === match.matchID ? match : m
            );
        } else {
            this.currentMatches = [...this.currentMatches, match];
        }
    }

    private removeMatch(matchID: string): void {
        this.currentMatches = this.currentMatches.filter(m => m.matchID !== matchID);
    }

    private shouldAcceptVersion(version: number, allowEqual = false): boolean {
        if (allowEqual) return version >= this.lobbyVersion;
        return version > this.lobbyVersion;
    }

    private updateVersion(version: number): void {
        if (version > this.lobbyVersion) {
            this.lobbyVersion = version;
        }
    }

    private handleVersionRollback(version: number, context: string): boolean {
        if (version < this.lobbyVersion) {
            console.warn('[LobbySocket] 版本回退，强制刷新', {
                context,
                version,
                current: this.lobbyVersion,
            });
            this.currentMatches = [];
            this.lobbyVersion = -1;
            this.requestRefresh();
            return true;
        }
        return false;
    }

    /**
     * 连接到大厅 Socket 服务
     */
    connect(): void {
        if (this.socket?.connected) {
            console.log('[LobbySocket]', tLobbySocket('alreadyConnected'));
            return;
        }

        console.log('[LobbySocket]', tLobbySocket('connecting'));

        this.socket = io(GAME_SERVER_URL, {
            path: '/lobby-socket',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
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
            console.log('[LobbySocket]', tLobbySocket('connected'));
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.notifyStatusSubscribers({ connected: true });

            // 自动订阅大厅更新（仅当已指定 gameId）
            if (this.subscribedGameId) {
                this.socket?.emit(LOBBY_EVENTS.SUBSCRIBE_LOBBY, { gameId: this.subscribedGameId });
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('[LobbySocket]', tLobbySocket('disconnected', { reason }));
            this.isConnected = false;
            this.notifyStatusSubscribers({ connected: false });
        });

        this.socket.on('connect_error', (error) => {
            console.error('[LobbySocket]', tLobbySocket('connectError', { message: error.message }));
            this.reconnectAttempts++;
            this.notifyStatusSubscribers({ connected: false, lastError: error.message });
        });

        // 接收完整的房间列表更新
        this.socket.on(LOBBY_EVENTS.LOBBY_UPDATE, (payload: LobbySnapshotPayload) => {
            if (this.handleVersionRollback(payload.version, 'snapshot')) {
                return;
            }
            if (!this.shouldAcceptVersion(payload.version, true)) {
                console.log('[LobbySocket]', tLobbySocket('ignoreSnapshot', { version: payload.version }));
                return;
            }

            console.log('[LobbySocket]', tLobbySocket('snapshotReceived', { count: payload.matches.length, version: payload.version }));
            this.currentMatches = payload.matches;
            this.updateVersion(payload.version);
            this.notifySubscribers(payload.matches);
        });

        // 接收单个房间创建事件
        this.socket.on(LOBBY_EVENTS.MATCH_CREATED, (payload: LobbyMatchPayload) => {
            if (this.handleVersionRollback(payload.version, 'matchCreated')) {
                return;
            }
            if (!this.shouldAcceptVersion(payload.version)) {
                console.log('[LobbySocket]', tLobbySocket('ignoreMatchCreated', { version: payload.version, matchId: payload.match.matchID }));
                return;
            }

            console.log('[LobbySocket]', tLobbySocket('matchCreated', { matchId: payload.match.matchID, version: payload.version }));
            this.upsertMatch(payload.match);
            this.updateVersion(payload.version);
            this.notifySubscribers(this.currentMatches);
        });

        // 接收单个房间更新事件（玩家加入/离开）
        this.socket.on(LOBBY_EVENTS.MATCH_UPDATED, (payload: LobbyMatchPayload) => {
            if (this.handleVersionRollback(payload.version, 'matchUpdated')) {
                return;
            }
            if (!this.shouldAcceptVersion(payload.version)) {
                console.log('[LobbySocket]', tLobbySocket('ignoreMatchUpdated', { version: payload.version, matchId: payload.match.matchID }));
                return;
            }

            console.log('[LobbySocket]', tLobbySocket('matchUpdated', { matchId: payload.match.matchID, version: payload.version }));
            this.upsertMatch(payload.match);
            this.updateVersion(payload.version);
            this.notifySubscribers(this.currentMatches);
        });

        // 接收房间结束事件
        this.socket.on(LOBBY_EVENTS.MATCH_ENDED, (payload: LobbyMatchEndedPayload) => {
            if (this.handleVersionRollback(payload.version, 'matchEnded')) {
                return;
            }
            if (!this.shouldAcceptVersion(payload.version)) {
                console.log('[LobbySocket]', tLobbySocket('ignoreMatchEnded', { version: payload.version, matchId: payload.matchID }));
                return;
            }

            console.log('[LobbySocket]', tLobbySocket('matchEnded', { matchId: payload.matchID, version: payload.version }));
            this.removeMatch(payload.matchID);
            this.updateVersion(payload.version);
            this.notifySubscribers(this.currentMatches);
        });

        this.socket.on(LOBBY_EVENTS.HEARTBEAT, (payload: LobbyHeartbeatPayload) => {
            if (this.handleVersionRollback(payload.version, 'heartbeat')) {
                return;
            }
            if (payload.version > this.lobbyVersion) {
                console.log('[LobbySocket]', tLobbySocket('heartbeatStale', { version: payload.version, current: this.lobbyVersion }));
                this.requestRefresh();
                return;
            }

            if (payload.version === this.lobbyVersion) {
                console.log('[LobbySocket]', tLobbySocket('heartbeatOk', { version: payload.version }));
            }
        });
    }

    /**
     * 通知所有订阅者
     */
    private notifySubscribers(matches: LobbyMatch[]): void {
        this.subscribers.forEach(callback => {
            try {
                callback(matches);
            } catch (error) {
                console.error('[LobbySocket]', tLobbySocket('subscriberError', { message: formatErrorMessage(error) }));
            }
        });
    }

    /**
     * 通知所有状态订阅者
     */
    private notifyStatusSubscribers(status: { connected: boolean; lastError?: string }): void {
        this.statusSubscribers.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('[LobbySocket] Status subscriber error:', error);
            }
        });
    }

    /**
     * 订阅连接状态
     */
    subscribeStatus(callback: (status: { connected: boolean; lastError?: string }) => void): () => void {
        this.statusSubscribers.add(callback);
        // 立即通知当前状态
        callback({ connected: this.isConnected });
        return () => {
            this.statusSubscribers.delete(callback);
        };
    }

    /**
     * 订阅大厅更新
     */
    subscribe(gameId: string, callback: LobbyUpdateCallback): () => void {
        const normalizedGameId = normalizeGameName(gameId);
        if (!normalizedGameId) {
            console.warn('[LobbySocket]', tLobbySocket('subscribeMissingGameId'));
            return () => {
                this.subscribers.delete(callback);
            };
        }

        if (this.subscribedGameId !== normalizedGameId) {
            this.subscribedGameId = normalizedGameId;
            this.currentMatches = [];
            this.lobbyVersion = -1;
        }

        this.subscribers.add(callback);

        // 如果已有房间数据，立即通知新订阅者
        if (this.currentMatches.length > 0) {
            callback(this.currentMatches);
        }

        // 确保已连接
        if (!this.socket?.connected) {
            this.connect();
        } else {
            this.socket.emit(LOBBY_EVENTS.SUBSCRIBE_LOBBY, { gameId: this.subscribedGameId });
        }

        // 返回取消订阅函数
        return () => {
            this.subscribers.delete(callback);

            // 如果没有订阅者了，可选择断开连接以节省资源
            if (this.subscribers.size === 0) {
                console.log('[LobbySocket]', tLobbySocket('noSubscribers'));
                if (this.socket?.connected) {
                    this.socket.emit(LOBBY_EVENTS.UNSUBSCRIBE_LOBBY);
                }
                this.subscribedGameId = null;
                this.currentMatches = [];
                this.lobbyVersion = -1;
            }
        };
    }

    /**
     * 手动请求刷新房间列表
     */
    requestRefresh(gameId?: string): void {
        if (gameId) {
            const normalizedGameId = normalizeGameName(gameId);
            if (normalizedGameId && this.subscribedGameId !== normalizedGameId) {
                this.subscribedGameId = normalizedGameId;
                this.currentMatches = [];
                this.lobbyVersion = -1;
            }
        }

        if (this.socket?.connected && this.subscribedGameId) {
            this.socket.emit(LOBBY_EVENTS.SUBSCRIBE_LOBBY, { gameId: this.subscribedGameId });
        }
    }

    /**
     * 断开连接
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.emit(LOBBY_EVENTS.UNSUBSCRIBE_LOBBY);
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.currentMatches = [];
            this.lobbyVersion = -1;
        }
    }

    /**
     * 获取连接状态
     */
    getConnectionStatus(): { connected: boolean; reconnectAttempts: number } {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
        };
    }
}

// 导出单例实例
export const lobbySocket = new LobbySocketService();
