import { describe, expect, it, vi } from 'vitest';
import { navigateBackToLobbyWithModalCleanup } from '../navigateBackToLobbyWithModalCleanup';

describe('navigateBackToLobbyWithModalCleanup', () => {
    it('先静默清空弹窗栈，再带 game 参数返回大厅', () => {
        const closeAll = vi.fn();
        const navigate = vi.fn();

        navigateBackToLobbyWithModalCleanup({
            navigate,
            closeAll,
            gameId: 'qidahen',
        });

        expect(closeAll).toHaveBeenCalledWith({ skipOnClose: true });
        expect(navigate).toHaveBeenCalledWith('/?game=qidahen', { replace: true });
        expect(closeAll.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
    });

    it('没有 gameId 时回到根首页', () => {
        const closeAll = vi.fn();
        const navigate = vi.fn();

        navigateBackToLobbyWithModalCleanup({
            navigate,
            closeAll,
        });

        expect(closeAll).toHaveBeenCalledWith({ skipOnClose: true });
        expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    });
});
