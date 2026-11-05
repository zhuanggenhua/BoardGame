import { describe, expect, it, vi } from 'vitest';
import { confirmDestructiveRoomReset, shouldShowDebugPanel } from '../debugPanelAccess';

describe('game panel access', () => {
    it('生产环境只向服务端确认过的管理员开放调试面板', () => {
        expect(shouldShowDebugPanel({
            isDevelopment: false,
            isE2EDebug: false,
            adminDebugAvailable: false,
        })).toBe(false);
        expect(shouldShowDebugPanel({
            isDevelopment: false,
            isE2EDebug: false,
            adminDebugAvailable: true,
        })).toBe(true);
    });

    it('保留开发和 E2E 调试面板入口', () => {
        expect(shouldShowDebugPanel({
            isDevelopment: true,
            isE2EDebug: false,
            adminDebugAvailable: false,
        })).toBe(true);
        expect(shouldShowDebugPanel({
            isDevelopment: false,
            isE2EDebug: true,
            adminDebugAvailable: false,
        })).toBe(true);
    });

    it('有当前房间座位凭据时必须先确认，取消就终止创建流程', () => {
        const confirm = vi.fn(() => false);

        const mayCreateRoom = confirmDestructiveRoomReset({
            isOnline: true,
            currentMatchId: 'match-current',
            currentPlayerID: '0',
            hasCurrentSeatCredentials: true,
            confirm,
        });

        expect(confirm).toHaveBeenCalledOnce();
        expect(mayCreateRoom).toBe(false);
    });

    it('没有当前房间凭据时不要求销毁确认', () => {
        const confirm = vi.fn(() => false);

        const mayCreateRoom = confirmDestructiveRoomReset({
            isOnline: true,
            currentMatchId: 'match-current',
            currentPlayerID: '0',
            hasCurrentSeatCredentials: false,
            confirm,
        });

        expect(confirm).not.toHaveBeenCalled();
        expect(mayCreateRoom).toBe(true);
    });
});
