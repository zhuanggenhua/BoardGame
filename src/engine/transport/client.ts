/**
 * 游戏状态同步客户端
 *
 * 基于 socket.io 实现：
 * - 连接 /game namespace → 发送 sync → 接收状态
 * - 发送命令 → 接收状态更新
 * - 自动重连 + 凭证验证
 */

import { io, type Socket } from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import type { MatchPlayerInfo, ServerToClientEvents, ClientToServerEvents } from './protocol';
import { applyPatches } from './patch';

// ============================================================================
// 客户端配置
// ============================================================================

export interface GameTransportClientConfig {
    /** 服务端地址（如 '' 表示同源，或 'http://localhost:8000'） */
    server: string;
    /** 对局 ID */
    matchID: string;
    /** 玩家 ID（观战者为 null） */
    playerID: string | null;
    /** 认证凭证 */
    credentials?: string;
    /** 状态更新回调 */
    onStateUpdate?: (state: unknown, matchPlayers: MatchPlayerInfo[], meta?: { stateID?: number; lastCommandPlayerId?: string; randomCursor?: number }, randomMeta?: { seed: string; cursor: number }) => void;
    /** 连接状态变更回调 */
    onConnectionChange?: (connected: boolean) => void;
    /** 玩家连接/断开回调 */
    onPlayerConnectionChange?: (playerID: string, connected: boolean) => void;
    /** 错误回调 */
    onError?: (error: string) => void;
}

// ============================================================================
// 客户端状态
// ============================================================================

export type ClientConnectionState = 'disconnected' | 'connecting' | 'connected';

// ============================================================================
// GameTransportClient
// ============================================================================

export class GameTransportClient {
    private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
    private readonly config: GameTransportClientConfig;
    private _connectionState: ClientConnectionState = 'disconnected';
    private _latestState: unknown = null;
    private _matchPlayers: MatchPlayerInfo[] = [];
    private _destroyed = false;
    /** 最近一次成功处理的 stateID，用于增量同步连续性校验 */
    private _lastReceivedStateID: number | null = null;
    private _syncTimer: ReturnType<typeof setTimeout> | null = null;
    private _syncRetries = 0;
    private _healthCheckTimer: ReturnType<typeof setInterval> | null = null;
    private static readonly SYNC_TIMEOUT_MS = 5000;
    private static readonly SYNC_MAX_RETRIES = 5;
    private static readonly HEALTH_CHECK_INTERVAL_MS = 30000; // 30秒检查一次

    constructor(config: GameTransportClientConfig) {
        this.config = config;
    }

    /** 当前连接状态 */
    get connectionState(): ClientConnectionState {
        return this._connectionState;
    }

    /** 是否已连接 */
    get isConnected(): boolean {
        return this._connectionState === 'connected';
    }

    /** 最新游戏状态 */
    get latestState(): unknown {
        return this._latestState;
    }

    /** 对局玩家信息 */
    get matchPlayers(): MatchPlayerInfo[] {
        return this._matchPlayers;
    }

    /**
     * 更新本地缓存的最新状态
     *
     * 供 GameProvider 在乐观引擎回滚时回写权威状态，
     * 确保后续 patch 应用基准正确。
     */
    updateLatestState(state: unknown): void {
        this._latestState = state;
    }

    /** 连接到服务端 */
    connect(): void {
        if (this._destroyed || this.socket) return;

        this._connectionState = 'connecting';
        this.config.onConnectionChange?.(false);

        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
            `${this.config.server}/game`,
            {
                parser: msgpackParser,
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                autoConnect: true,
            },
        );

        this.socket = socket;

        socket.on('connect', () => {
            if (this._destroyed) return;
            // 连接后立即发送 sync 请求
            // 注意：socket.io 自动重连成功时 connect 和 reconnect 都会触发，
            // 但 sendSync 内部有 clearSyncTimer 保护，重复调用只会重置超时计时器，不会产生问题。
            this._syncRetries = 0;
            this.sendSync();
        });

        socket.on('state:sync', (matchID, state, matchPlayers, randomMeta) => {
            if (this._destroyed || matchID !== this.config.matchID) return;
            this.clearSyncTimer();
            this._syncRetries = 0;
            this._connectionState = 'connected';
            this._latestState = state;
            this._matchPlayers = matchPlayers;
            // sync 是全量同步，不携带 stateID，重置为 null
            this._lastReceivedStateID = null;
            this.config.onConnectionChange?.(true);
            this.config.onStateUpdate?.(state, matchPlayers, undefined, randomMeta);
        });

        socket.on('state:update', (matchID, state, matchPlayers, meta) => {
            if (this._destroyed || matchID !== this.config.matchID) return;
            this._latestState = state;
            this._matchPlayers = matchPlayers;
            // 全量事件更新时同步 stateID，为后续增量 patch 建立基线
            if (meta?.stateID !== undefined) {
                this._lastReceivedStateID = meta.stateID;
            }
            this.config.onStateUpdate?.(state, matchPlayers, meta);
        });

        socket.on('state:patch', (matchID, patches, matchPlayers, meta) => {
            if (this._destroyed || matchID !== this.config.matchID) return;

            // stateID 连续性校验
            if (this._lastReceivedStateID !== null && meta.stateID !== this._lastReceivedStateID + 1) {
                console.warn('[GameTransportClient] stateID 不连续，请求 resync', {
                    matchID,
                    expected: this._lastReceivedStateID + 1,
                    received: meta.stateID,
                });
                this.sendSync();
                return;
            }

            // 无基础状态，请求全量同步
            if (this._latestState === null) {
                console.warn('[GameTransportClient] 收到 patch 但无基础状态，请求 resync', { matchID });
                this.sendSync();
                return;
            }

            // 应用 patch
            const result = applyPatches(this._latestState, patches);

            if (!result.success) {
                console.warn('[GameTransportClient] patch 应用失败，请求 resync', {
                    matchID,
                    error: result.error,
                });
                this.sendSync();
                return;
            }

            // 更新本地状态和 stateID
            this._latestState = result.state;
            this._lastReceivedStateID = meta.stateID;
            this._matchPlayers = matchPlayers;

            // 传递给上层，与 state:update 行为一致
            this.config.onStateUpdate?.(result.state!, matchPlayers, meta);
        });

        socket.on('error', (matchID, error) => {
            if (this._destroyed || matchID !== this.config.matchID) return;
            this.config.onError?.(error);
        });

        socket.on('player:connected', (matchID, playerID) => {
            if (this._destroyed || matchID !== this.config.matchID) return;
            this.config.onPlayerConnectionChange?.(playerID, true);
        });

        socket.on('player:disconnected', (matchID, playerID) => {
            if (this._destroyed || matchID !== this.config.matchID) return;
            this.config.onPlayerConnectionChange?.(playerID, false);
        });

        socket.on('disconnect', () => {
            if (this._destroyed) return;
            this._connectionState = 'disconnected';
            this.config.onConnectionChange?.(false);
        });

        // socket.io 自动重连成功后的处理
        // 注意：reconnect（Manager 级别）和 connect（Socket 级别）在重连时都会触发。
        // sendSync 已在 connect 回调中处理，这里只需更新连接状态。
        socket.io.on('reconnect', () => {
            if (this._destroyed) return;
            this._connectionState = 'connecting';
        });

        // 启动健康检查
        this.setupHealthCheck();
    }

    /** 发送命令 */
    sendCommand(commandType: string, payload: unknown): void {
        if (!this.socket || this._destroyed) return;
        this.socket.emit(
            'command',
            this.config.matchID,
            commandType,
            payload,
            this.config.credentials,
        );
    }

    /**
     * 发送批量命令（Task 8）
     * 
     * @param batchId 批次 ID
     * @param commands 命令数组
     * @param onConfirmed 批次确认回调（返回权威状态）
     * @param onRejected 批次拒绝回调
     */
    sendBatch(
        batchId: string,
        commands: Array<{ type: string; payload: unknown }>,
        onConfirmed?: (state: unknown) => void,
        onRejected?: (reason: string) => void,
    ): void {
        if (!this.socket || this._destroyed) return;

        // 注册一次性监听器
        const confirmHandler = (matchID: string, receivedBatchId: string, state: unknown) => {
            if (matchID !== this.config.matchID || receivedBatchId !== batchId) return;
            this.socket?.off('batch:confirmed', confirmHandler);
            this.socket?.off('batch:rejected', rejectHandler);
            this.socket?.off('disconnect', disconnectHandler);
            onConfirmed?.(state);
        };

        const rejectHandler = (matchID: string, receivedBatchId: string, reason: string) => {
            if (matchID !== this.config.matchID || receivedBatchId !== batchId) return;
            this.socket?.off('batch:confirmed', confirmHandler);
            this.socket?.off('batch:rejected', rejectHandler);
            this.socket?.off('disconnect', disconnectHandler);
            onRejected?.(reason);
        };

        // socket 断开时清理监听器，避免永久泄漏
        const disconnectHandler = () => {
            this.socket?.off('batch:confirmed', confirmHandler);
            this.socket?.off('batch:rejected', rejectHandler);
            onRejected?.('disconnected');
        };

        this.socket.on('batch:confirmed', confirmHandler);
        this.socket.on('batch:rejected', rejectHandler);
        this.socket.once('disconnect', disconnectHandler);

        // 发送批次
        this.socket.emit(
            'batch',
            this.config.matchID,
            batchId,
            commands,
            this.config.credentials,
        );
    }

    /** 断开连接并清理资源 */
    disconnect(): void {
        this._destroyed = true;
        this.clearSyncTimer();
        this.clearHealthCheck();
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        this._connectionState = 'disconnected';
    }

    /**
     * 主动重新同步状态
     *
     * 页面恢复可见时调用：浏览器后台标签页可能冻结 JS 执行，
     * 导致 state:update 消息虽到达 WebSocket 缓冲区但回调未执行，
     * 或心跳超时导致静默断线。重新 sync 确保状态最新。
     */
    resync(): void {
        if (this._destroyed || !this.socket) return;
        if (this.socket.connected) {
            // 连接正常：直接发送 sync 获取最新状态
            this.sendSync();
        } else {
            // 连接已断：强制重连（socket.io 可能因后台节流未及时重连）
            this.socket.connect();
        }
    }

    /** 发送 sync 请求并启动超时重试 */
    private sendSync(): void {
        if (this._destroyed || !this.socket?.connected) return;
        this.clearSyncTimer();
        this.socket.emit(
            'sync',
            this.config.matchID,
            this.config.playerID,
            this.config.credentials,
        );
        // 如果 SYNC_TIMEOUT_MS 内没收到 state:sync，自动重试
        this._syncTimer = setTimeout(() => {
            if (this._destroyed || this._connectionState === 'connected') return;
            this._syncRetries += 1;
            if (this._syncRetries <= GameTransportClient.SYNC_MAX_RETRIES) {
                console.warn(`[GameTransport] sync 超时，重试 ${this._syncRetries}/${GameTransportClient.SYNC_MAX_RETRIES}`);
                this.sendSync();
            } else {
                console.error(`[GameTransport] sync 重试耗尽，matchID=${this.config.matchID}`);
                this.config.onError?.('sync_timeout');
            }
        }, GameTransportClient.SYNC_TIMEOUT_MS);
    }

    private clearSyncTimer(): void {
        if (this._syncTimer) {
            clearTimeout(this._syncTimer);
            this._syncTimer = null;
        }
    }

    /** 更新玩家 ID（调试面板切换视角时使用） */
    updatePlayerID(playerID: string | null): void {
        (this.config as { playerID: string | null }).playerID = playerID;
        // 重新 sync 以获取新视角的状态
        if (this.socket?.connected) {
            this.socket.emit(
                'sync',
                this.config.matchID,
                playerID,
                this.config.credentials,
            );
        }
    }

    /**
     * 启动健康检查（定期检查连接状态并主动重连）
     */
    private setupHealthCheck(): void {
        if (this._healthCheckTimer) return;
        
        this._healthCheckTimer = setInterval(() => {
            if (this._destroyed || !this.socket) return;
            
            // 检查连接状态
            if (!this.socket.connected) {
                console.log('[GameTransport] 健康检查发现断开，尝试重连');
                try {
                    this.socket.connect();
                } catch (error) {
                    console.error('[GameTransport] 重连失败:', error);
                }
            }
        }, GameTransportClient.HEALTH_CHECK_INTERVAL_MS);
        
        console.log(`[GameTransport] 健康检查已启动 (间隔: ${GameTransportClient.HEALTH_CHECK_INTERVAL_MS}ms)`);
    }

    /**
     * 清理健康检查定时器
     */
    private clearHealthCheck(): void {
        if (this._healthCheckTimer) {
            clearInterval(this._healthCheckTimer);
            this._healthCheckTimer = null;
            console.log('[GameTransport] 健康检查已停止');
        }
    }
}
