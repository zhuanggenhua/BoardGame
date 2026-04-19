/**
 * UGC 宿主通信桥接
 * 
 * 管理 iframe 与宿主之间的 postMessage 通信
 */

import type {
    ViewMessage,
    HostMessage,
    HostCommandResultMessage,
    HostStateUpdateMessage,
    HostInitMessage,
    HostErrorMessage,
    UGCGameState,
    PlayerId,
    PackageId,
} from '../sdk/types';
import { SDK_VERSION } from '../sdk/types';
import { UGCMessageValidator, createValidator } from '../sdk/validator';

// ============================================================================
// 类型定义
// ============================================================================

/** 命令处理器 */
export type CommandHandler = (
    commandType: string,
    playerId: PlayerId,
    params: Record<string, unknown>
) => Promise<{ success: boolean; error?: string; events?: unknown[] }>;

/** 宿主桥接配置 */
export interface HostBridgeConfig {
    /** iframe 元素 */
    iframe: HTMLIFrameElement;
    /** 游戏包 ID */
    packageId: PackageId;
    /** 当前玩家 ID */
    currentPlayerId: PlayerId;
    /** 所有玩家 ID */
    playerIds: PlayerId[];
    /** 允许的来源（空数组表示允许所有） */
    allowedOrigins?: string[];
    /** 命令处理器 */
    onCommand: CommandHandler;
    /** 状态获取器 */
    getState: () => UGCGameState;
    /** 音效播放器 */
    onPlaySfx?: (sfxKey: string, volume: number) => void;
    /** 错误处理器 */
    onError?: (error: string) => void;
}

// ============================================================================
// 宿主桥接类
// ============================================================================

export class UGCHostBridge {
    private config: HostBridgeConfig;
    private validator: UGCMessageValidator;
    private messageHandler: (event: MessageEvent) => void;
    private isReady: boolean = false;
    private viewOrigin?: string;

    constructor(config: HostBridgeConfig) {
        this.config = config;
        this.validator = createValidator();
        this.messageHandler = this.handleMessage.bind(this);
    }

    /** 启动桥接 */
    start(): void {
        window.addEventListener('message', this.messageHandler);
    }

    /** 停止桥接 */
    stop(): void {
        window.removeEventListener('message', this.messageHandler);
        this.isReady = false;
    }

    /** 发送状态更新 */
    sendStateUpdate(force: boolean = false): void {
        if (!this.isReady && !force) return;
        
        const message: HostStateUpdateMessage = {
            id: this.generateMessageId(),
            source: 'ugc-host',
            type: 'STATE_UPDATE',
            timestamp: Date.now(),
            payload: {
                state: this.config.getState(),
            },
        };
        this.postMessage(message);
    }

    /** 发送错误 */
    sendError(code: string, errorMessage: string): void {
        const message: HostErrorMessage = {
            id: this.generateMessageId(),
            source: 'ugc-host',
            type: 'ERROR',
            timestamp: Date.now(),
            payload: { code, message: errorMessage },
        };
        this.postMessage(message);
    }

    /** 处理收到的消息 */
    private async handleMessage(event: MessageEvent): Promise<void> {
        // 验证消息来源
        if (event.source !== this.config.iframe.contentWindow) {
            return;
        }

        const { allowedOrigins = [] } = this.config;
        const state = this.config.getState();

        // 校验消息
        const validation = this.validator.validateViewMessage(
            event.data,
            event.origin,
            allowedOrigins,
            state.activePlayerId
        );

        if (!validation.valid) {
            this.sendError('VALIDATION_ERROR', validation.error || '校验失败');
            this.config.onError?.(validation.error || '校验失败');
            return;
        }

        const message = event.data as ViewMessage;

        switch (message.type) {
            case 'VIEW_READY':
                this.viewOrigin = event.origin;
                await this.handleViewReady();
                break;
            case 'COMMAND':
                await this.handleCommand(message);
                break;
            case 'STATE_REQUEST':
                if (!this.viewOrigin) {
                    this.viewOrigin = event.origin;
                }
                this.sendStateUpdate(true);
                break;
            case 'PLAY_SFX':
                this.handlePlaySfx(message);
                break;
        }
    }

    /** 处理视图就绪 */
    private async handleViewReady(): Promise<void> {
        this.isReady = true;

        const initMessage: HostInitMessage = {
            id: this.generateMessageId(),
            source: 'ugc-host',
            type: 'INIT',
            timestamp: Date.now(),
            payload: {
                packageId: this.config.packageId,
                currentPlayerId: this.config.currentPlayerId,
                playerIds: this.config.playerIds,
                state: this.config.getState(),
                sdkVersion: SDK_VERSION,
            },
        };
        this.postMessage(initMessage);
    }

    /** 处理命令 */
    private async handleCommand(message: ViewMessage): Promise<void> {
        if (message.type !== 'COMMAND') return;

        const { commandType, playerId, params } = message.payload;

        try {
            const result = await this.config.onCommand(commandType, playerId, params);

            const responseMessage: HostCommandResultMessage = {
                id: this.generateMessageId(),
                source: 'ugc-host',
                type: 'COMMAND_RESULT',
                timestamp: Date.now(),
                payload: {
                    requestId: message.id,
                    success: result.success,
                    error: result.error,
                    events: result.events?.map(e => ({
                        type: typeof e === 'object' && e !== null ? (e as { type?: string }).type || 'unknown' : 'unknown',
                        data: e as Record<string, unknown>,
                    })),
                },
            };
            this.postMessage(responseMessage);

            // 命令成功后发送状态更新
            if (result.success) {
                this.sendStateUpdate(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            const responseMessage: HostCommandResultMessage = {
                id: this.generateMessageId(),
                source: 'ugc-host',
                type: 'COMMAND_RESULT',
                timestamp: Date.now(),
                payload: {
                    requestId: message.id,
                    success: false,
                    error: errorMessage,
                },
            };
            this.postMessage(responseMessage);
        }
    }

    /** 处理音效播放 */
    private handlePlaySfx(message: ViewMessage): void {
        if (message.type !== 'PLAY_SFX') return;
        const { sfxKey, volume = 1 } = message.payload;
        this.config.onPlaySfx?.(sfxKey, volume);
    }

    /** 发送消息到 iframe */
    private postMessage(message: HostMessage): void {
        const targetWindow = this.config.iframe.contentWindow;
        if (!targetWindow) return;

        const allowedOrigin = this.config.allowedOrigins?.[0];
        const targetOrigin = this.viewOrigin ?? allowedOrigin ?? '*';
        targetWindow.postMessage(message, targetOrigin);
    }

    /** 生成消息 ID */
    private generateMessageId(): string {
        return `host-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
}

// ============================================================================
// 工厂函数
// ============================================================================

/** 创建宿主桥接 */
export function createHostBridge(config: HostBridgeConfig): UGCHostBridge {
    return new UGCHostBridge(config);
}
