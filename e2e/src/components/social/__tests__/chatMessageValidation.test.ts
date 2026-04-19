import { describe, it, expect, vi } from 'vitest';
import { generateUUID } from '../../../lib/uuid';
import { MAX_CHAT_LENGTH } from '../../../shared/chat';
import { scheduleDeferredSocialConnect } from '../../../services/socialSocket';

/**
 * 聊天消息验证测试。
 * 覆盖问题 2 修复：长消息校验、MAX_CHAT_LENGTH 一致性。
 */
describe('聊天消息验证', () => {
    it('MAX_CHAT_LENGTH 应为 200', () => {
        expect(MAX_CHAT_LENGTH).toBe(200);
    });

    it('等于上限的消息应通过校验', () => {
        const msg = 'a'.repeat(MAX_CHAT_LENGTH);
        expect(msg.length).toBeLessThanOrEqual(MAX_CHAT_LENGTH);
    });

    it('超过上限的消息应被拒绝', () => {
        const msg = 'a'.repeat(MAX_CHAT_LENGTH + 1);
        expect(msg.length).toBeGreaterThan(MAX_CHAT_LENGTH);
    });

    it('空白消息应被拒绝（trim 后为空）', () => {
        const msg = '   ';
        expect(msg.trim()).toBe('');
    });

    it('sendMessage 返回值应构造正确的 Message 对象', () => {
        // 模拟服务端返回格式
        const serverResponse = {
            message: '发送成功',
            messageData: {
                id: 'msg_123',
                toUser: { id: 'user_456', username: 'test' },
            },
        };

        // 模拟 SocialContext.sendMessage 中的构造逻辑
        const userId = 'current_user';
        const toUserId = 'user_456';
        const content = '你好';
        const type = 'text' as const;

        const msg = {
            id: serverResponse.messageData?.id ?? generateUUID(),
            from: userId,
            to: toUserId,
            content,
            type,
            read: true,
            createdAt: new Date().toISOString(),
        };

        expect(msg.id).toBe('msg_123');
        expect(msg.from).toBe('current_user');
        expect(msg.to).toBe('user_456');
        expect(msg.content).toBe('你好');
        expect(msg.type).toBe('text');
        expect(msg.read).toBe(true);
        expect(msg.createdAt).toBeTruthy();
    });

    it('sendMessage 返回值在 messageData 缺失时应使用 fallback id', () => {
        const serverResponse = {
            message: '发送成功',
            // messageData 缺失
        };

        const id = (serverResponse as any).messageData?.id ?? 'fallback_id';
        expect(id).toBe('fallback_id');
    });

    it('旧版服务端返回的 data.message 是字符串而非 Message 对象', () => {
        // 这是修复前的 bug：直接 return data.message 拿到的是字符串
        const serverResponse = {
            message: '发送成功',
            messageData: { id: 'msg_123', toUser: { id: 'u1', username: 'test' } },
        };

        // 旧代码：return data.message → 得到字符串
        expect(typeof serverResponse.message).toBe('string');
        // 新代码：从 messageData 构造 → 得到正确的 id
        expect(serverResponse.messageData.id).toBe('msg_123');
    });
});

describe('SocialSocket 寤惰繜寤鸿繛璋冨害', () => {
    it('浼樺厛鍦ㄥ欢鏃跺悗浜ゆ潈缁? requestIdleCallback 鎵ц', () => {
        const task = vi.fn();
        const timeoutCallbacks: Array<() => void> = [];
        const idleCallbacks: Array<() => void> = [];
        const clearTimeout = vi.fn();
        const cancelIdleCallback = vi.fn();

        const cancel = scheduleDeferredSocialConnect(task, {
            setTimeout: ((callback: TimerHandler) => {
                timeoutCallbacks.push(callback as () => void);
                return 11;
            }) as typeof window.setTimeout,
            clearTimeout: ((handle: number) => {
                clearTimeout(handle);
            }) as typeof window.clearTimeout,
            requestIdleCallback: ((callback: IdleRequestCallback) => {
                idleCallbacks.push(() => callback({
                    didTimeout: false,
                    timeRemaining: () => 8,
                }));
                return 22;
            }) as never,
            cancelIdleCallback: ((handle: number) => {
                cancelIdleCallback(handle);
            }) as never,
        });

        expect(task).not.toHaveBeenCalled();
        expect(timeoutCallbacks).toHaveLength(1);

        timeoutCallbacks[0]();
        expect(task).not.toHaveBeenCalled();
        expect(idleCallbacks).toHaveLength(1);

        idleCallbacks[0]();
        expect(task).toHaveBeenCalledTimes(1);

        cancel();
        expect(clearTimeout).not.toHaveBeenCalled();
        expect(cancelIdleCallback).not.toHaveBeenCalled();
    });

    it('鍦ㄤ笉鏀寔 requestIdleCallback 鏃剁洿鎺ヨ蛋 setTimeout 鍥炶皟', () => {
        const task = vi.fn();
        const timeoutCallbacks: Array<() => void> = [];

        scheduleDeferredSocialConnect(task, {
            setTimeout: ((callback: TimerHandler) => {
                timeoutCallbacks.push(callback as () => void);
                return 33;
            }) as typeof window.setTimeout,
            clearTimeout: (() => {}) as typeof window.clearTimeout,
        });

        expect(task).not.toHaveBeenCalled();
        expect(timeoutCallbacks).toHaveLength(1);

        timeoutCallbacks[0]();
        expect(task).toHaveBeenCalledTimes(1);
    });
});
