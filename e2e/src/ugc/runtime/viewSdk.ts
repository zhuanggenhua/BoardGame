/**
 * UGC 视图 SDK 客户端
 * 
 * 供 UGC 视图代码使用，与宿主通信
 */

import type {
    HostMessage,
    HostInitMessage,
    HostStateUpdateMessage,
    HostCommandResultMessage,
    ViewCommandMessage,
    ViewStateRequestMessage,
    ViewPlaySfxMessage,
    ViewReadyMessage,
    ViewCommandType,
    UGCGameState,
    PlayerId,
    PackageId,
} from '../sdk/types';

// ============================================================================
// 类型定义
// ============================================================================

/** SDK 初始化回调 */
export type InitCallback = (data: {
    packageId: PackageId;
    currentPlayerId: PlayerId;
    playerIds: PlayerId[];
    state: UGCGameState;
    sdkVersion: string;
}) => void;

/** 状态更新回调 */
export type StateUpdateCallback = (state: UGCGameState) => void;

/** 命令结果回调 */
export type CommandResultCallback = (result: {
    requestId: string;
    success: boolean;
    error?: string;
}) => void;

/** 错误回调 */
export type ErrorCallback = (code: string, message: string) => void;

/** SDK 配置 */
export interface ViewSdkConfig {
    /** 初始化回调 */
    onInit?: InitCallback;
    /** 状态更新回调 */
    onStateUpdate?: StateUpdateCallback;
    /** 错误回调 */
    onError?: ErrorCallback;
}

// ============================================================================
// SDK 客户端类
// ============================================================================

export class UGCViewSdk {
    private config: ViewSdkConfig;
    private messageHandler: (event: MessageEvent) => void;
    private pendingCommands: Map<string, CommandResultCallback> = new Map();
    private isInitialized: boolean = false;
    private currentPlayerId: PlayerId = '';
    private state: UGCGameState | null = null;
    private readyTimer: number | null = null;

    constructor(config: ViewSdkConfig = {}) {
        this.config = config;
        this.messageHandler = this.handleMessage.bind(this);
    }

    /** 启动 SDK */
    start(): void {
        window.addEventListener('message', this.messageHandler);
        this.sendReady();
        this.startReadyPing();
    }

    /** 停止 SDK */
    stop(): void {
        window.removeEventListener('message', this.messageHandler);
        this.stopReadyPing();
        this.pendingCommands.clear();
        this.isInitialized = false;
    }

    /** 获取当前状态 */
    getState(): UGCGameState | null {
        return this.state;
    }

    /** 获取当前玩家 ID */
    getCurrentPlayerId(): PlayerId {
        return this.currentPlayerId;
    }

    /** 是否已初始化 */
    isReady(): boolean {
        return this.isInitialized;
    }

    /** 发送命令 */
    sendCommand(
        commandType: ViewCommandType,
        params: Record<string, unknown> = {},
        callback?: CommandResultCallback
    ): string {
        const id = this.generateMessageId();
        
        const message: ViewCommandMessage = {
            id,
            source: 'ugc-view',
            type: 'COMMAND',
            timestamp: Date.now(),
            payload: {
                commandType,
                playerId: this.currentPlayerId,
                params,
            },
        };

        if (callback) {
            this.pendingCommands.set(id, callback);
        }

        this.postMessage(message);
        return id;
    }

    /** 请求状态更新 */
    requestState(): void {
        const message: ViewStateRequestMessage = {
            id: this.generateMessageId(),
            source: 'ugc-view',
            type: 'STATE_REQUEST',
            timestamp: Date.now(),
        };
        this.postMessage(message);
    }

    /** 播放音效 */
    playSfx(sfxKey: string, volume: number = 1): void {
        const message: ViewPlaySfxMessage = {
            id: this.generateMessageId(),
            source: 'ugc-view',
            type: 'PLAY_SFX',
            timestamp: Date.now(),
            payload: { sfxKey, volume },
        };
        this.postMessage(message);
    }

    // ========== 便捷方法 ==========

    /** 打出卡牌 */
    playCard(cardId: string, targetIds?: string[], callback?: CommandResultCallback): string {
        return this.sendCommand('PLAY_CARD', { cardId, targetIds }, callback);
    }

    /** 选择目标 */
    selectTarget(targetIds: string[], callback?: CommandResultCallback): string {
        return this.sendCommand('SELECT_TARGET', { targetIds }, callback);
    }

    /** 结束阶段 */
    endPhase(callback?: CommandResultCallback): string {
        return this.sendCommand('END_PHASE', {}, callback);
    }

    /** 结束回合 */
    endTurn(callback?: CommandResultCallback): string {
        return this.sendCommand('END_TURN', {}, callback);
    }

    /** 摸牌 */
    drawCard(count: number = 1, callback?: CommandResultCallback): string {
        return this.sendCommand('DRAW_CARD', { count }, callback);
    }

    /** 弃牌 */
    discardCard(cardIds: string[], callback?: CommandResultCallback): string {
        return this.sendCommand('DISCARD_CARD', { cardIds }, callback);
    }

    /** 响应 */
    respond(responseType: string, params?: Record<string, unknown>, callback?: CommandResultCallback): string {
        return this.sendCommand('RESPOND', { responseType, ...params }, callback);
    }

    /** 跳过 */
    pass(callback?: CommandResultCallback): string {
        return this.sendCommand('PASS', {}, callback);
    }

    // ========== 私有方法 ==========

    /** 发送就绪消息 */
    private sendReady(): void {
        const message: ViewReadyMessage = {
            id: this.generateMessageId(),
            source: 'ugc-view',
            type: 'VIEW_READY',
            timestamp: Date.now(),
        };
        this.postMessage(message);
    }

    private startReadyPing(): void {
        if (this.readyTimer) return;
        this.readyTimer = window.setInterval(() => {
            if (this.isInitialized) {
                this.stopReadyPing();
                return;
            }
            this.sendReady();
        }, 600);
    }

    private stopReadyPing(): void {
        if (this.readyTimer === null) return;
        window.clearInterval(this.readyTimer);
        this.readyTimer = null;
    }

    /** 处理收到的消息 */
    private handleMessage(event: MessageEvent): void {
        const message = event.data as HostMessage;
        
        if (!message || message.source !== 'ugc-host') {
            return;
        }

        switch (message.type) {
            case 'INIT':
                this.handleInit(message as HostInitMessage);
                break;
            case 'STATE_UPDATE':
                this.handleStateUpdate(message as HostStateUpdateMessage);
                break;
            case 'COMMAND_RESULT':
                this.handleCommandResult(message as HostCommandResultMessage);
                break;
            case 'ERROR':
                this.config.onError?.(message.payload.code, message.payload.message);
                break;
        }
    }

    /** 处理初始化 */
    private handleInit(message: HostInitMessage): void {
        this.isInitialized = true;
        this.stopReadyPing();
        this.currentPlayerId = message.payload.currentPlayerId;
        this.state = message.payload.state;

        this.config.onInit?.({
            packageId: message.payload.packageId,
            currentPlayerId: message.payload.currentPlayerId,
            playerIds: message.payload.playerIds,
            state: message.payload.state,
            sdkVersion: message.payload.sdkVersion,
        });
    }

    /** 处理状态更新 */
    private handleStateUpdate(message: HostStateUpdateMessage): void {
        this.state = message.payload.state;
        this.config.onStateUpdate?.(message.payload.state);
    }

    /** 处理命令结果 */
    private handleCommandResult(message: HostCommandResultMessage): void {
        const { requestId, success, error } = message.payload;
        const callback = this.pendingCommands.get(requestId);
        
        if (callback) {
            callback({ requestId, success, error });
            this.pendingCommands.delete(requestId);
        }
    }

    /** 发送消息到宿主 */
    private postMessage(message: unknown): void {
        window.parent.postMessage(message, '*');
    }

    /** 生成消息 ID */
    private generateMessageId(): string {
        return `view-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
}

// ============================================================================
// 工厂函数
// ============================================================================

/** 创建视图 SDK */
export function createViewSdk(config?: ViewSdkConfig): UGCViewSdk {
    return new UGCViewSdk(config);
}

// ============================================================================
// 全局单例（供简单场景使用）
// ============================================================================

let globalSdk: UGCViewSdk | null = null;

/** 获取全局 SDK 实例 */
export function getGlobalSdk(): UGCViewSdk {
    if (!globalSdk) {
        globalSdk = createViewSdk();
    }
    return globalSdk;
}

/** 初始化全局 SDK */
export function initGlobalSdk(config: ViewSdkConfig): UGCViewSdk {
    globalSdk = createViewSdk(config);
    globalSdk.start();
    return globalSdk;
}
