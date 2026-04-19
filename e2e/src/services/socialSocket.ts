import { io, Socket } from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import { AUTH_API_URL } from '../config/server';
import { createScopedLogger } from '../lib/logger';
import { onPageVisible } from './visibilityResync';
import { socketHealthChecker } from './socketHealthCheck';
import { SOCKET_CONNECT_TIMEOUT_MS, getSocketIoTransports, shouldTryAllSocketTransports } from '../lib/socketConnectionConfig';

const log = createScopedLogger('SocialSocket');

export const SOCIAL_SOCKET_CONNECT_DELAY_MS = 1500;
export const SOCIAL_SOCKET_IDLE_TIMEOUT_MS = 5000;

type IdleSchedulerTarget = {
    setTimeout: typeof window.setTimeout;
    clearTimeout: typeof window.clearTimeout;
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
};

export function scheduleDeferredSocialConnect(
    task: () => void,
    target: IdleSchedulerTarget = window,
    delayMs = SOCIAL_SOCKET_CONNECT_DELAY_MS,
    idleTimeoutMs = SOCIAL_SOCKET_IDLE_TIMEOUT_MS,
): () => void {
    let timeoutHandle: number | null = null;
    let idleHandle: number | null = null;

    timeoutHandle = target.setTimeout(() => {
        timeoutHandle = null;
        if (typeof target.requestIdleCallback === 'function') {
            idleHandle = target.requestIdleCallback(() => {
                idleHandle = null;
                task();
            }, { timeout: idleTimeoutMs });
            return;
        }

        task();
    }, delayMs);

    return () => {
        if (timeoutHandle !== null) {
            target.clearTimeout(timeoutHandle);
            timeoutHandle = null;
        }
        if (idleHandle !== null && typeof target.cancelIdleCallback === 'function') {
            target.cancelIdleCallback(idleHandle);
            idleHandle = null;
        }
    };
}

export const SOCIAL_EVENTS = {
    // 服务端 -> 客户端
    FRIEND_ONLINE: 'social:friendOnline',
    FRIEND_OFFLINE: 'social:friendOffline',
    FRIEND_REQUEST: 'social:friendRequest',
    NEW_MESSAGE: 'social:newMessage',
    GAME_INVITE: 'social:gameInvite',
    HEARTBEAT: 'social:heartbeat',

    // 客户端 -> 服务端
    HEARTBEAT_ACK: 'social:heartbeat', // 如需 ACK，可用该事件（通常 heartbeat 为 ping/pong 或自定义）
} as const;

export interface FriendStatusPayload {
    userId: string;
}

export interface FriendRequestPayload {
    requestId: string;
    from: {
        id: string;
        username: string;
        avatar?: string;
    };
    createdAt: string;
}

export interface NewMessagePayload {
    id: string;
    from: string;
    to: string;
    content: string;
    type: 'text' | 'invite';
    createdAt: string;
}

export interface GameInvitePayload {
    inviteId: string;
    from: {
        id: string;
        username: string;
    };
    gameId?: string; // 例如 'tic-tac-toe'
    roomId?: string;
    message?: string;
}

type EventCallback = (payload: unknown) => void;

class SocialSocketService {
    private socket: Socket | null = null;
    private listeners: Map<string, Set<EventCallback>> = new Map();
    private isConnected = false;
    private token: string | null = null;

    constructor() {
        // 初始化事件监听映射
        Object.values(SOCIAL_EVENTS).forEach(event => {
            this.listeners.set(event, new Set());
        });
    }

    connect(token: string): void {
        if (this.socket && this.token === token) {
            if (!this.socket.connected) {
                this.socket.connect();
            }
            return;
        }

        this.token = token;

        if (!this.socket) {
            // 确定 URL 基地址：若 AUTH_API_URL 为绝对路径则取其 origin；否则使用当前 window origin（依赖 proxy）。
            const baseUrl = AUTH_API_URL.startsWith('http')
                ? new URL(AUTH_API_URL).origin
                : window.location.origin;

            log.info('connecting', { baseUrl, path: '/social-socket' });

            this.socket = io(baseUrl, {
                parser: msgpackParser,
                path: '/social-socket',
                auth: { token },
                transports: getSocketIoTransports(),
                tryAllTransports: shouldTryAllSocketTransports(),
                reconnection: true,
                reconnectionAttempts: Infinity, // 后台标签页冻结后需要无限重连
                reconnectionDelay: 1000,
                timeout: SOCKET_CONNECT_TIMEOUT_MS,
            });

            this.setupEventHandlers();
            this.setupVisibilityHandler();
            this.setupHealthCheck();
            return;
        }

        // token 变更：复用现有 socket，避免重复注册监听
        this.socket.auth = { token };
        if (this.socket.connected) {
            this.socket.disconnect();
        }
        this.socket.connect();
    }

    private setupEventHandlers(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            log.info('connected');
            this.isConnected = true;
            this.notifyListeners('connect', true);
        });

        this.socket.on('disconnect', (reason) => {
            log.info('disconnected', { reason });
            this.isConnected = false;
            this.notifyListeners('disconnect', reason);
        });

        this.socket.on('connect_error', (error) => {
            log.error('connect_error', { message: error.message });
            this.isConnected = false;
        });

        // 注册所有社交事件的处理器
        Object.values(SOCIAL_EVENTS).forEach(eventName => {
            this.socket?.on(eventName, (payload) => {
                // 日志已移除：事件接收过于频繁
                this.notifyListeners(eventName, payload);
            });
        });
    }

    reconnectWithCurrentSettings(): void {
        if (!this.token) {
            return;
        }

        const token = this.token;
        this.disconnect(false);
        this.connect(token);
    }

    disconnect(clearToken = true): void {
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
            if (clearToken) {
                this.token = null;
            }
        }
    }

    /**
     * 订阅指定事件
     */
    on<TPayload = unknown>(event: string, callback: (payload: TPayload) => void): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event)?.add(callback as EventCallback);

        return () => {
            this.listeners.get(event)?.delete(callback as EventCallback);
        };
    }

    /**
     * 通知本地监听器
     */
    private notifyListeners(event: string, payload: unknown): void {
        this.listeners.get(event)?.forEach(callback => {
            try {
                callback(payload);
            } catch (err) {
                log.error('listener_failed', { event, error: err });
            }
        });
    }

    /**
     * 向服务端发送事件
     */
    emit(event: string, payload?: unknown): void {
        this.socket?.emit(event, payload);
    }

    get connected(): boolean {
        return this.isConnected;
    }

    /**
     * 页面恢复可见时主动重连/重新同步
     *
     * 后台标签页冻结期间 socket.io 心跳可能超时导致静默断线，
     * 恢复可见时主动检查连接状态并重连。
     */
    private resync(): void {
        if (!this.socket || !this.token) return;
        if (this.socket.connected) {
            // 连接正常：无需额外操作（社交事件是推送模式，不需要主动拉取）
            return;
        }
        // 连接已断：强制重连
        log.info('resync_reconnect');
        this.socket.connect();
    }

    /**
     * 注册 visibilitychange 监听（在 connect 时自动调用）
     */
    private setupVisibilityHandler(): void {
        if (this._cleanupVisibility) return; // 已注册
        this._cleanupVisibility = onPageVisible(() => this.resync());
    }

    /**
     * 启动健康检查（定期检查连接状态并主动重连）
     */
    private setupHealthCheck(): void {
        if (this._cleanupHealthCheck) return;
        this._cleanupHealthCheck = socketHealthChecker.start({
            name: 'SocialSocket',
            getSocket: () => this.socket,
            isConnected: () => this.isConnected,
            interval: 30000, // 30秒检查一次
        });
    }

    private _cleanupVisibility: (() => void) | null = null;
    private _cleanupHealthCheck: (() => void) | null = null;
}

export const socialSocket = new SocialSocketService();
