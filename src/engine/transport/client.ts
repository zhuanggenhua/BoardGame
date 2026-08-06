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
import { SOCKET_CONNECT_TIMEOUT_MS, getSocketIoTransports, shouldTryAllSocketTransports } from '../../lib/socketConnectionConfig';
import type {
    MatchPlayerInfo,
    ServerToClientEvents,
    ClientToServerEvents,
    StateUpdateMeta,
    RandomSyncMeta,
    BatchDispatchMeta,
    CommandDispatchMeta,
    MatchUiEvent,
} from './protocol';
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
    onStateUpdate?: (
        state: unknown,
        matchPlayers: MatchPlayerInfo[],
        meta?: StateUpdateMeta,
        randomMeta?: RandomSyncMeta,
    ) => void;
    /** 连接状态变更回调 */
    onConnectionChange?: (connected: boolean) => void;
    /** 玩家连接/断开回调 */
    onPlayerConnectionChange?: (playerID: string, connected: boolean) => void;
    /** 错误回调 */
    onError?: (error: string) => void;
    /** 调试事件回调 */
    onDebugEvent?: (event: {
        stage: 'sync-requested' | 'sync-received' | 'sync-timeout' | 'patch-discontinuity' | 'patch-apply-failed' | 'reconnect-requested';
        reason?: string;
        retryCount?: number;
        maxRetries?: number;
        expectedStateID?: number | null;
        receivedStateID?: number | null;
        error?: string;
    }) => void;
}

// ============================================================================
// 客户端状态
// ============================================================================

export type ClientConnectionState = 'disconnected' | 'connecting' | 'connected';

// ============================================================================
// GameTransportClient
// ============================================================================

export class GameTransportClient {
    private readonly stateUpdateSubscribers = new Set<(state: unknown) => void>();
    private readonly errorSubscribers = new Set<(error: string) => void>();
    private readonly uiEventSubscribers = new Set<(event: MatchUiEvent) => void>();
    private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
    private readonly config: GameTransportClientConfig;
    private _connectionState: ClientConnectionState = 'disconnected';
    private _latestState: unknown = null;
    private _matchPlayers: MatchPlayerInfo[] = [];
    private _destroyed = false;
    /** 最近一次成功处理的 stateID，用于增量同步连续性校验 */
    private _lastReceivedStateID: number | null = null;
    /** 正在等待全量权威状态；此期间禁止用旧 stateID 继续发命令。 */
    private _syncInFlight = false;
    private _syncTimer: ReturnType<typeof setTimeout> | null = null;
    private _syncRetries = 0;
    private _healthCheckTimer: ReturnType<typeof setInterval> | null = null;
    private _terminalError: string | null = null;
    private static readonly SYNC_TIMEOUT_MS = 5000;
    private static readonly SYNC_MAX_RETRIES = 5;
    private static readonly HEALTH_CHECK_INTERVAL_MS = 30000; // 30秒检查一次
    private static readonly TERMINAL_ERRORS = new Set(['match_not_found', 'unauthorized']);
    private static readonly COMMAND_REJECTION_RESYNC_ERRORS = new Set(['stale_state', 'player_mismatch']);

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

    subscribeStateUpdate(listener: (state: unknown) => void): () => void {
        this.stateUpdateSubscribers.add(listener);
        return () => {
            this.stateUpdateSubscribers.delete(listener);
        };
    }

    subscribeError(listener: (error: string) => void): () => void {
        this.errorSubscribers.add(listener);
        return () => {
            this.errorSubscribers.delete(listener);
        };
    }

    private notifyErrorSubscribers(error: string): void {
        for (const subscriber of this.errorSubscribers) {
            try {
                subscriber(error);
            } catch {
                // 调试/辅助订阅者异常不应影响主错误处理链路
            }
        }
    }

    private notifyStateUpdateSubscribers(state: unknown): void {
        for (const subscriber of this.stateUpdateSubscribers) {
            try {
                subscriber(state);
            } catch {
                // 调试/辅助订阅者异常不应影响主同步链路
            }
        }
    }

    subscribeUiEvent(listener: (event: MatchUiEvent) => void): () => void {
        this.uiEventSubscribers.add(listener);
        return () => {
            this.uiEventSubscribers.delete(listener);
        };
    }

    private notifyUiEventSubscribers(event: MatchUiEvent): void {
        for (const subscriber of this.uiEventSubscribers) {
            try {
                subscriber(event);
            } catch {
                // 临时 UI 订阅者异常不应影响权威状态同步。
            }
        }
    }

    /** 对局玩家信息 */
    get matchPlayers(): MatchPlayerInfo[] {
        return this._matchPlayers;
    }

    /**
     * 获取底层 socket 实例（仅供测试使用）
     * 
     * @internal
     */
    getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
        return this.socket;
    }

    /**
     * 更新本地缓存的最新状态
     *
     * 仅允许回写“服务端权威态”，作为后续 state:patch 的 apply 基线。
     * 不要传入经过 reconcile / filter / UI 修饰后的渲染态，否则会污染 patch base。
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
                transports: getSocketIoTransports(),
                tryAllTransports: shouldTryAllSocketTransports(),
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                autoConnect: true,
                timeout: SOCKET_CONNECT_TIMEOUT_MS,
            },
        );

        this.socket = socket;

        socket.on('connect', () => {
            if (this._destroyed) return;
            this._terminalError = null;
            // 连接后立即发送 sync 请求
            this.sendSync('socket-connect');
        });

        socket.on('state:sync', (matchID, state, matchPlayers, randomMeta, syncMeta) => {
            if (this._destroyed || matchID !== this.config.matchID) return;
            this.clearSyncTimer();
            this._syncRetries = 0;
            this._syncInFlight = false;
            this._connectionState = 'connected';
            this._latestState = state;
            this._matchPlayers = matchPlayers;
            // sync 是全量权威态，收到后立即建立 patch 连续性校验基线
            this._lastReceivedStateID = syncMeta?.stateID ?? null;
            this.config.onDebugEvent?.({
                stage: 'sync-received',
                receivedStateID: syncMeta?.stateID ?? null,
            });
            this.config.onConnectionChange?.(true);
            this.config.onStateUpdate?.(state, matchPlayers, syncMeta, randomMeta);
            this.notifyStateUpdateSubscribers(state);
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
            this.notifyStateUpdateSubscribers(state);
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
                this.config.onDebugEvent?.({
                    stage: 'patch-discontinuity',
                    reason: 'stateid-discontinuity',
                    expectedStateID: this._lastReceivedStateID + 1,
                    receivedStateID: meta.stateID,
                });
                this.sendSync('stateid-discontinuity');
                return;
            }

            // 应用 patch
            const result = applyPatches(this._latestState, patches);

            if (!result.success) {
                console.warn('[GameTransportClient] patch 应用失败，请求 resync', {
                    matchID,
                    error: result.error,
                });
                this.config.onDebugEvent?.({
                    stage: 'patch-apply-failed',
                    reason: 'patch-apply-failed',
                    error: result.error,
                    receivedStateID: meta.stateID,
                });
                this.sendSync('patch-apply-failed');
                return;
            }

            // 更新本地状态和 stateID
            this._latestState = result.state;
            this._lastReceivedStateID = meta.stateID;
            this._matchPlayers = matchPlayers;

            // 传递给上层，与 state:update 行为一致
            this.config.onStateUpdate?.(result.state!, matchPlayers, meta);
            this.notifyStateUpdateSubscribers(result.state!);
        });

        socket.on('error', (matchID, error) => {
            if (this._destroyed || matchID !== this.config.matchID) return;
            this.notifyErrorSubscribers(error);
            if (GameTransportClient.TERMINAL_ERRORS.has(error)) {
                this.handleTerminalError(error);
            } else if (GameTransportClient.COMMAND_REJECTION_RESYNC_ERRORS.has(error)) {
                // 服务端拒绝说明本地命令所依据的状态可能已经落后；
                // 在新的全量状态回来前禁止继续发送旧命令，避免连续 stale_state / player_mismatch。
                this.sendSync(`command-rejected:${error}`);
            }
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

        socket.on('ui:event', (matchID, event) => {
            if (this._destroyed || matchID !== this.config.matchID) return;
            this.notifyUiEventSubscribers(event);
        });

        socket.on('disconnect', () => {
            if (this._destroyed) return;
            this._connectionState = 'disconnected';
            this.config.onConnectionChange?.(false);
        });

        // socket.io 自动重连成功后重新 sync
        socket.io.on('reconnect', () => {
            if (this._destroyed || this._terminalError) return;
            this._connectionState = 'connecting';
            this._syncRetries = 0;
            this.sendSync();
        });

        // 启动健康检查
        this.setupHealthCheck();
    }

    /** 发送命令 */
    sendCommand(commandType: string, payload: unknown): void {
        if (!this.socket || this._destroyed) return;
        if (this._syncInFlight) {
            console.warn('[GameTransportClient] 全量同步进行中，命令被延后丢弃', {
                commandType,
                matchID: this.config.matchID,
            });
            return;
        }
        // 检查连接状态：只有在完成 sync 握手后才能发送命令
        if (this._connectionState !== 'connected') {
            console.warn('[GameTransportClient] 连接未就绪，命令被忽略', {
                commandType,
                connectionState: this._connectionState,
                matchID: this.config.matchID,
            });
            this.config.onError?.('not_connected');
            return;
        }
        this.socket.emit(
            'command',
            this.config.matchID,
            commandType,
            payload,
            this.config.credentials,
            {
                expectedStateID: this._lastReceivedStateID ?? undefined,
            } satisfies CommandDispatchMeta,
        );
    }

    /** 发送临时 UI 事件；不进入权威游戏状态。 */
    sendUiEvent(eventType: string, payload: unknown): void {
        if (!this.socket || this._destroyed || this._connectionState !== 'connected') return;
        this.socket.emit(
            'ui:event',
            this.config.matchID,
            eventType,
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
        if (this._syncInFlight) {
            console.warn('[GameTransportClient] 全量同步进行中，批量命令被延后丢弃', {
                batchId,
                commandCount: commands.length,
                matchID: this.config.matchID,
            });
            return;
        }
        // 检查连接状态：只有在完成 sync 握手后才能发送命令
        if (this._connectionState !== 'connected') {
            console.warn('[GameTransportClient] 连接未就绪，批量命令被拒绝', {
                batchId,
                commandCount: commands.length,
                connectionState: this._connectionState,
                matchID: this.config.matchID,
            });
            onRejected?.('not_connected');
            return;
        }

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
            ({
                expectedStateID: this._lastReceivedStateID ?? undefined,
            } satisfies BatchDispatchMeta),
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
     * 兼容旧调用点：历史代码仍使用 destroy() 释放客户端。
     * 当前语义等同于 disconnect()。
     */
    destroy(): void {
        this.disconnect();
    }

    /**
     * 主动重新同步状态
     *
     * 页面恢复可见时调用：浏览器后台标签页可能冻结 JS 执行，
     * 导致 state:update 消息虽到达 WebSocket 缓冲区但回调未执行，
     * 或心跳超时导致静默断线。重新 sync 确保状态最新。
     */
    resync(): void {
        if (this._destroyed || this._terminalError || !this.socket) return;
        if (this.socket.connected) {
            // 连接正常：直接发送 sync 获取最新状态
            // 命令拒绝已经触发同步时，合并上层 recovery 的重复 resync；
            // 初始同步尚未建立 stateID 基线时仍允许手动重发。
            if (this._syncInFlight && this._lastReceivedStateID !== null) return;
            this.sendSync('manual-resync');
        } else {
            // 连接已断：强制重连（socket.io 可能因后台节流未及时重连）
            this.config.onDebugEvent?.({
                stage: 'reconnect-requested',
                reason: 'manual-resync-disconnected',
            });
            this.socket.connect();
        }
    }

    /** 发送 sync 请求并启动超时重试 */
    private sendSync(reason: string): void {
        if (this._destroyed || this._terminalError || !this.socket?.connected) return;
        this._syncInFlight = true;
        this.clearSyncTimer();
        this.config.onDebugEvent?.({
            stage: 'sync-requested',
            reason,
            retryCount: this._syncRetries,
            expectedStateID: this._lastReceivedStateID ?? null,
        });
        this.socket.emit(
            'sync',
            this.config.matchID,
            this.config.playerID,
            this.config.credentials,
        );
        // 如果 SYNC_TIMEOUT_MS 内没收到 state:sync，自动重试
        this._syncTimer = setTimeout(() => {
            if (this._destroyed) return;
            this._syncRetries += 1;
            this.config.onDebugEvent?.({
                stage: 'sync-timeout',
                reason,
                retryCount: this._syncRetries,
                maxRetries: GameTransportClient.SYNC_MAX_RETRIES,
                expectedStateID: this._lastReceivedStateID ?? null,
            });
            if (this._syncRetries <= GameTransportClient.SYNC_MAX_RETRIES) {
                console.warn(`[GameTransport] sync 超时，重试 ${this._syncRetries}/${GameTransportClient.SYNC_MAX_RETRIES}`);
                this.sendSync(`retry-after-timeout:${reason}`);
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
            this.sendSync('update-player-id');
        }
    }

    /**
     * 启动健康检查（定期检查连接状态并主动重连）
     */
    private setupHealthCheck(): void {
        if (this._healthCheckTimer) return;
        
        this._healthCheckTimer = setInterval(() => {
            if (this._destroyed || this._terminalError || !this.socket) return;
            
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

    private handleTerminalError(error: string): void {
        if (this._terminalError) return;
        this._terminalError = error;
        this.clearSyncTimer();
        this.clearHealthCheck();
        this._syncRetries = 0;
        this._connectionState = 'disconnected';
        this._syncInFlight = false;
        this.config.onConnectionChange?.(false);
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
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
