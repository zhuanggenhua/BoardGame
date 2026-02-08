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

const LOBBY_ALL = 'all';

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
    totalSeats?: number;
    createdAt?: number;
    updatedAt?: number;
    roomName?: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
    isLocked?: boolean;
}

type LobbyGameId = string;

interface LobbySnapshotPayload {
    gameId: LobbyGameId;
    version: number;
    matches: LobbyMatch[];
}

interface LobbyMatchPayload {
    gameId: LobbyGameId;
    version: number;
    match: LobbyMatch;
}

interface LobbyMatchEndedPayload {
    gameId: LobbyGameId;
    version: number;
    matchID: string;
}

interface LobbyHeartbeatPayload {
    gameId: LobbyGameId;
    version: number;
    timestamp: number;
}

// 大厅更新回调类型
export type LobbyUpdateCallback = (matches: LobbyMatch[]) => void;

type LobbyState = {
    matches: LobbyMatch[];
    version: number;
    callbacks: Set<LobbyUpdateCallback>;
};

class LobbySocketService {
    private socket: Socket | null = null;
    private statusSubscribers: Set<(status: { connected: boolean; lastError?: string }) => void> = new Set();
    private isConnected = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private lobbyStateByGame: Map<LobbyGameId, LobbyState> = new Map();

    private ensureState(gameId: LobbyGameId): LobbyState {
        const existing = this.lobbyStateByGame.get(gameId);
        if (existing) return existing;
        const state: LobbyState = { matches: [], version: -1, callbacks: new Set() };
        this.lobbyStateByGame.set(gameId, state);
        return state;
    }

    private getState(gameId: LobbyGameId): LobbyState | null {
        return this.lobbyStateByGame.get(gameId) ?? null;
    }

    private upsertMatch(gameId: LobbyGameId, match: LobbyMatch): void {
        const state = this.getState(gameId);
        if (!state) return;
        const index = state.matches.findIndex(m => m.matchID === match.matchID);
        if (index >= 0) {
            state.matches = state.matches.map(m =>
                m.matchID === match.matchID ? match : m
            );
        } else {
            state.matches = [...state.matches, match];
        }
    }

    private removeMatch(gameId: LobbyGameId, matchID: string): void {
        const state = this.getState(gameId);
        if (!state) return;
        state.matches = state.matches.filter(m => m.matchID !== matchID);
    }

    private shouldAcceptVersion(gameId: LobbyGameId, version: number, allowEqual = false): boolean {
        const state = this.getState(gameId);
        if (!state) return false;
        if (allowEqual) return version >= state.version;
        return version > state.version;
    }

    private updateVersion(gameId: LobbyGameId, version: number): void {
        const state = this.getState(gameId);
        if (!state) return;
        if (version > state.version) {
            state.version = version;
        }
    }

    private handleVersionRollback(gameId: LobbyGameId, version: number, context: string): boolean {
        const state = this.getState(gameId);
        if (!state) return false;
        if (version < state.version) {
            console.warn('[LobbySocket] 版本回退，强制刷新', {
                context,
                gameId,
                version,
                current: state.version,
            });
            state.matches = [];
            state.version = -1;
            this.requestRefresh(gameId);
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

            // 自动订阅大厅更新（支持多 gameId）
            this.lobbyStateByGame.forEach((state, gameId) => {
                if (state.callbacks.size > 0) {
                    this.socket?.emit(LOBBY_EVENTS.SUBSCRIBE_LOBBY, { gameId });
                }
            });
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
            const state = this.getState(payload.gameId);
            if (!state) return;
            if (this.handleVersionRollback(payload.gameId, payload.version, 'snapshot')) {
                return;
            }
            if (!this.shouldAcceptVersion(payload.gameId, payload.version, true)) {
                console.log('[LobbySocket]', tLobbySocket('ignoreSnapshot', { version: payload.version }));
                return;
            }

            // 日志已移除：快照接收过于频繁
            state.matches = payload.matches;
            this.updateVersion(payload.gameId, payload.version);
            this.notifySubscribers(payload.gameId, payload.matches);
        });

        // 接收单个房间创建事件
        this.socket.on(LOBBY_EVENTS.MATCH_CREATED, (payload: LobbyMatchPayload) => {
            if (!this.getState(payload.gameId)) return;
            if (this.handleVersionRollback(payload.gameId, payload.version, 'matchCreated')) {
                return;
            }
            if (!this.shouldAcceptVersion(payload.gameId, payload.version)) {
                console.log('[LobbySocket]', tLobbySocket('ignoreMatchCreated', { version: payload.version, matchId: payload.match.matchID }));
                return;
            }

            // 日志已移除：房间创建事件过于频繁
            this.upsertMatch(payload.gameId, payload.match);
            this.updateVersion(payload.gameId, payload.version);
            this.notifySubscribers(payload.gameId, this.getState(payload.gameId)?.matches ?? []);
        });

        // 接收单个房间更新事件（玩家加入/离开）
        this.socket.on(LOBBY_EVENTS.MATCH_UPDATED, (payload: LobbyMatchPayload) => {
            if (!this.getState(payload.gameId)) return;
            if (this.handleVersionRollback(payload.gameId, payload.version, 'matchUpdated')) {
                return;
            }
            if (!this.shouldAcceptVersion(payload.gameId, payload.version)) {
                console.log('[LobbySocket]', tLobbySocket('ignoreMatchUpdated', { version: payload.version, matchId: payload.match.matchID }));
                return;
            }

            // 日志已移除：房间更新事件过于频繁
            this.upsertMatch(payload.gameId, payload.match);
            this.updateVersion(payload.gameId, payload.version);
            this.notifySubscribers(payload.gameId, this.getState(payload.gameId)?.matches ?? []);
        });

        // 接收房间结束事件
        this.socket.on(LOBBY_EVENTS.MATCH_ENDED, (payload: LobbyMatchEndedPayload) => {
            if (!this.getState(payload.gameId)) return;
            if (this.handleVersionRollback(payload.gameId, payload.version, 'matchEnded')) {
                return;
            }
            if (!this.shouldAcceptVersion(payload.gameId, payload.version)) {
                console.log('[LobbySocket]', tLobbySocket('ignoreMatchEnded', { version: payload.version, matchId: payload.matchID }));
                return;
            }

            // 日志已移除：房间结束事件过于频繁
            this.removeMatch(payload.gameId, payload.matchID);
            this.updateVersion(payload.gameId, payload.version);
            this.notifySubscribers(payload.gameId, this.getState(payload.gameId)?.matches ?? []);
        });

        this.socket.on(LOBBY_EVENTS.HEARTBEAT, (payload: LobbyHeartbeatPayload) => {
            if (!this.getState(payload.gameId)) return;
            if (this.handleVersionRollback(payload.gameId, payload.version, 'heartbeat')) {
                return;
            }
            const currentVersion = this.getState(payload.gameId)?.version ?? -1;
            if (payload.version > currentVersion) {
                console.log('[LobbySocket]', tLobbySocket('heartbeatStale', { version: payload.version, current: currentVersion }));
                this.requestRefresh(payload.gameId);
                return;
            }

            // 日志已移除：心跳检查过于频繁
        });
    }

    /**
     * 通知所有订阅者
     */
    private notifySubscribers(gameId: LobbyGameId, matches: LobbyMatch[]): void {
        const state = this.getState(gameId);
        if (!state) return;
        state.callbacks.forEach(callback => {
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
            return () => {};
        }

        const resolvedGameId = normalizedGameId === LOBBY_ALL ? LOBBY_ALL : normalizedGameId;
        const state = this.ensureState(resolvedGameId);

        state.callbacks.add(callback);

        // 如果已有房间数据，立即通知新订阅者
        if (state.matches.length > 0) {
            callback(state.matches);
        }

        // 确保已连接
        if (!this.socket?.connected) {
            this.connect();
        } else {
            this.socket.emit(LOBBY_EVENTS.SUBSCRIBE_LOBBY, { gameId: resolvedGameId });
        }

        // 返回取消订阅函数
        return () => {
            state.callbacks.delete(callback);

            if (state.callbacks.size === 0) {
                // 日志已移除：无订阅者提示过于频繁
                if (this.socket?.connected) {
                    this.socket.emit(LOBBY_EVENTS.UNSUBSCRIBE_LOBBY, { gameId: resolvedGameId });
                }
                state.matches = [];
                state.version = -1;
            }
        };
    }

    /**
     * 手动请求刷新房间列表
     */
    requestRefresh(gameId?: string): void {
        if (gameId) {
            const normalizedGameId = normalizeGameName(gameId);
            if (!normalizedGameId) return;
            const resolvedGameId = normalizedGameId === LOBBY_ALL ? LOBBY_ALL : normalizedGameId;
            this.ensureState(resolvedGameId);
            if (this.socket?.connected) {
                this.socket.emit(LOBBY_EVENTS.SUBSCRIBE_LOBBY, { gameId: resolvedGameId });
            }
            return;
        }

        if (this.socket?.connected) {
            this.lobbyStateByGame.forEach((state, activeGameId) => {
                if (state.callbacks.size > 0) {
                    this.socket?.emit(LOBBY_EVENTS.SUBSCRIBE_LOBBY, { gameId: activeGameId });
                }
            });
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
            this.lobbyStateByGame.forEach((state) => {
                state.matches = [];
                state.version = -1;
            });
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
