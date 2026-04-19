/**
 * UGC 宿主校验器
 * 
 * 校验来自 UGC 视图的消息，确保安全性与合法性
 */

import type {
    ViewMessage,
    ViewCommandMessage,
    ValidationResult,
    HostValidationConfig,
    PlayerId,
} from './types';
import { DEFAULT_VALIDATION_CONFIG } from './types';

// ============================================================================
// 校验器
// ============================================================================

export class UGCMessageValidator {
    private config: Required<HostValidationConfig>;
    private lastCommandTime: Map<string, number> = new Map();

    constructor(config: Partial<HostValidationConfig> = {}) {
        this.config = {
            allowedCommands: config.allowedCommands ?? [],
            commandRateLimitMs: config.commandRateLimitMs ?? DEFAULT_VALIDATION_CONFIG.commandRateLimitMs!,
            maxMessageSize: config.maxMessageSize ?? DEFAULT_VALIDATION_CONFIG.maxMessageSize!,
            validateTurn: config.validateTurn ?? DEFAULT_VALIDATION_CONFIG.validateTurn!,
        };
    }

    /**
     * 校验消息来源
     */
    validateOrigin(origin: string, allowedOrigins: string[]): ValidationResult {
        if (allowedOrigins.length === 0) {
            return { valid: true };
        }
        if (!allowedOrigins.includes(origin)) {
            return { valid: false, error: `非法来源: ${origin}` };
        }
        return { valid: true };
    }

    /**
     * 校验消息大小
     */
    validateMessageSize(message: unknown): ValidationResult {
        const size = JSON.stringify(message).length;
        if (size > this.config.maxMessageSize) {
            return { valid: false, error: `消息过大: ${size} > ${this.config.maxMessageSize}` };
        }
        return { valid: true };
    }

    /**
     * 校验消息结构
     */
    validateMessageStructure(message: unknown): ValidationResult {
        if (!message || typeof message !== 'object') {
            return { valid: false, error: '消息格式无效' };
        }

        const msg = message as Record<string, unknown>;
        if (!msg.id || typeof msg.id !== 'string') {
            return { valid: false, error: '缺少消息 ID' };
        }
        if (msg.source !== 'ugc-view') {
            return { valid: false, error: '消息来源必须是 ugc-view' };
        }
        if (!msg.type || typeof msg.type !== 'string') {
            return { valid: false, error: '缺少消息类型' };
        }

        return { valid: true };
    }

    /**
     * 校验命令频率
     */
    validateCommandRate(playerId: PlayerId): ValidationResult {
        const now = Date.now();
        const lastTime = this.lastCommandTime.get(playerId) ?? 0;
        const elapsed = now - lastTime;

        if (elapsed < this.config.commandRateLimitMs) {
            return { valid: false, error: `命令过于频繁，请等待 ${this.config.commandRateLimitMs - elapsed}ms` };
        }

        this.lastCommandTime.set(playerId, now);
        return { valid: true };
    }

    /**
     * 校验命令类型白名单
     */
    validateCommandType(message: ViewCommandMessage): ValidationResult {
        if (this.config.allowedCommands.length === 0) {
            return { valid: true };
        }
        if (!this.config.allowedCommands.includes(message.payload.commandType)) {
            return { valid: false, error: `不允许的命令类型: ${message.payload.commandType}` };
        }
        return { valid: true };
    }

    /**
     * 校验玩家回合
     */
    validatePlayerTurn(
        playerId: PlayerId,
        activePlayerId: PlayerId,
        allowOutOfTurn: boolean = false
    ): ValidationResult {
        if (!this.config.validateTurn || allowOutOfTurn) {
            return { valid: true };
        }
        if (playerId !== activePlayerId) {
            return { valid: false, error: '不是你的回合' };
        }
        return { valid: true };
    }

    /**
     * 完整校验视图消息
     */
    validateViewMessage(
        message: unknown,
        origin: string,
        allowedOrigins: string[],
        activePlayerId?: PlayerId
    ): ValidationResult {
        // 1. 校验来源
        const originResult = this.validateOrigin(origin, allowedOrigins);
        if (!originResult.valid) return originResult;

        // 2. 校验大小
        const sizeResult = this.validateMessageSize(message);
        if (!sizeResult.valid) return sizeResult;

        // 3. 校验结构
        const structureResult = this.validateMessageStructure(message);
        if (!structureResult.valid) return structureResult;

        const viewMessage = message as ViewMessage;

        // 4. 命令特定校验
        if (viewMessage.type === 'COMMAND') {
            const cmdMessage = viewMessage as ViewCommandMessage;

            // 校验命令类型白名单
            const typeResult = this.validateCommandType(cmdMessage);
            if (!typeResult.valid) return typeResult;

            // 校验命令频率
            const rateResult = this.validateCommandRate(cmdMessage.payload.playerId);
            if (!rateResult.valid) return rateResult;

            // 校验玩家回合
            if (activePlayerId) {
                const turnResult = this.validatePlayerTurn(
                    cmdMessage.payload.playerId,
                    activePlayerId
                );
                if (!turnResult.valid) return turnResult;
            }
        }

        return { valid: true };
    }

    /**
     * 重置频率限制
     */
    resetRateLimit(playerId?: PlayerId): void {
        if (playerId) {
            this.lastCommandTime.delete(playerId);
        } else {
            this.lastCommandTime.clear();
        }
    }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建默认校验器
 */
export function createValidator(config?: Partial<HostValidationConfig>): UGCMessageValidator {
    return new UGCMessageValidator(config);
}
