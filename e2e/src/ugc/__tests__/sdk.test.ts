/**
 * UGC SDK 通信协议测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    UGCMessageValidator,
    createValidator,
    DEFAULT_VALIDATION_CONFIG,
    SDK_VERSION,
} from '../sdk';
import type { ViewCommandMessage } from '../sdk';

describe('UGC SDK', () => {
    describe('UGCMessageValidator', () => {
        let validator: UGCMessageValidator;

        beforeEach(() => {
            validator = createValidator();
        });

        it('应创建默认校验器', () => {
            expect(validator).toBeInstanceOf(UGCMessageValidator);
        });

        it('应校验消息结构 - 有效消息', () => {
            const message: ViewCommandMessage = {
                id: 'msg-1',
                source: 'ugc-view',
                type: 'COMMAND',
                timestamp: Date.now(),
                payload: {
                    commandType: 'PLAY_CARD',
                    playerId: 'player-1',
                    params: { cardId: 'card-1' },
                },
            };

            const result = validator.validateViewMessage(message, 'http://localhost', []);
            expect(result.valid).toBe(true);
        });

        it('应校验消息结构 - 缺少 ID', () => {
            const message = {
                source: 'ugc-view',
                type: 'COMMAND',
                timestamp: Date.now(),
            };

            const result = validator.validateMessageStructure(message);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('ID');
        });

        it('应校验消息结构 - 错误来源', () => {
            const message = {
                id: 'msg-1',
                source: 'unknown',
                type: 'COMMAND',
                timestamp: Date.now(),
            };

            const result = validator.validateMessageStructure(message);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('来源');
        });

        it('应校验来源白名单', () => {
            const result1 = validator.validateOrigin('http://localhost', ['http://localhost']);
            expect(result1.valid).toBe(true);

            const result2 = validator.validateOrigin('http://evil.com', ['http://localhost']);
            expect(result2.valid).toBe(false);

            const result3 = validator.validateOrigin('http://any.com', []);
            expect(result3.valid).toBe(true); // 空白名单允许所有
        });

        it('应校验消息大小', () => {
            const smallMessage = { data: 'small' };
            const result1 = validator.validateMessageSize(smallMessage);
            expect(result1.valid).toBe(true);

            const largeMessage = { data: 'x'.repeat(100000) };
            const result2 = validator.validateMessageSize(largeMessage);
            expect(result2.valid).toBe(false);
        });

        it('应校验命令频率', () => {
            const result1 = validator.validateCommandRate('player-1');
            expect(result1.valid).toBe(true);

            const result2 = validator.validateCommandRate('player-1');
            expect(result2.valid).toBe(false); // 太快

            validator.resetRateLimit('player-1');
            const result3 = validator.validateCommandRate('player-1');
            expect(result3.valid).toBe(true);
        });

        it('应校验玩家回合', () => {
            const result1 = validator.validatePlayerTurn('player-1', 'player-1');
            expect(result1.valid).toBe(true);

            const result2 = validator.validatePlayerTurn('player-2', 'player-1');
            expect(result2.valid).toBe(false);
        });
    });

    describe('SDK 常量', () => {
        it('应有正确的 SDK 版本', () => {
            expect(SDK_VERSION).toBe('1.0.0');
        });

        it('应有正确的默认配置', () => {
            expect(DEFAULT_VALIDATION_CONFIG.commandRateLimitMs).toBe(100);
            expect(DEFAULT_VALIDATION_CONFIG.maxMessageSize).toBe(64 * 1024);
            expect(DEFAULT_VALIDATION_CONFIG.validateTurn).toBe(true);
        });
    });
});
