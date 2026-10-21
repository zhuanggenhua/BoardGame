import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatchRoomPageEffects } from '../useMatchRoomPageEffects';

vi.mock('../../lib/matchLoadTrace', () => ({ appendMatchLoadTrace: vi.fn() }));
vi.mock('../../lib/mobile/androidRuntime', () => ({ isNativeAndroidRuntime: () => false }));

const args = (gameId: string) => ({
    gameId,
    isTutorialRoute: true,
    searchParams: new URLSearchParams(),
    gamePageDataAttributes: {
        'data-game-page': 'true',
        'data-game-id': gameId,
        'data-mobile-profile': 'landscape-adapted',
        'data-mobile-layout-preset': 'board-shell',
    },
});

describe('房间页面的全局布局属性生命周期', () => {
    beforeEach(() => {
        for (const target of [document.documentElement, document.body]) {
            for (const key of [...target.attributes].map(attribute => attribute.name)) {
                if (key.startsWith('data-game-') || key.startsWith('data-mobile-')) target.removeAttribute(key);
            }
        }
    });

    it('离开游戏后移除游戏属性，避免大厅继承缩放和滚动锁', () => {
        const { unmount } = renderHook(() => useMatchRoomPageEffects(args('summonerwars')));
        expect(document.body.dataset.gameId).toBe('summonerwars');
        unmount();
        for (const target of [document.documentElement, document.body]) {
            expect(target.hasAttribute('data-game-page')).toBe(false);
            expect(target.hasAttribute('data-mobile-layout-preset')).toBe(false);
        }
    });

    it('连续切换游戏后卸载，恢复进入第一局之前的属性', () => {
        const { rerender, unmount } = renderHook(({ gameId }) => useMatchRoomPageEffects(args(gameId)), {
            initialProps: { gameId: 'summonerwars' },
        });
        rerender({ gameId: 'smashup' });
        expect(document.body.dataset.gameId).toBe('smashup');
        unmount();
        expect(document.documentElement.hasAttribute('data-game-id')).toBe(false);
        expect(document.body.hasAttribute('data-game-id')).toBe(false);
    });
});
