import { io, Socket } from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import { AUTH_API_URL } from '../config/server';

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

            console.log('[SocialSocket] Connecting to', baseUrl, 'path: /social-socket');

            this.socket = io(baseUrl, {
                parser: msgpackParser,
                path: '/social-socket',
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            this.setupEventHandlers();
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
            console.log('[SocialSocket] Connected');
            this.isConnected = true;
            this.notifyListeners('connect', true);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('[SocialSocket] Disconnected:', reason);
            this.isConnected = false;
            this.notifyListeners('disconnect', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('[SocialSocket] Connection error:', error.message);
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

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.token = null;
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
                console.error(`[SocialSocket] Error in listener for ${event}:`, err);
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
}

export const socialSocket = new SocialSocketService();
