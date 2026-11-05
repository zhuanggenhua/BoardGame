// @vitest-environment jsdom
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameLibrary } from '../useGameLibrary';
import { setUserFavorite } from '../../../api/user-library';
const auth = vi.hoisted(() => ({ user: null as { id: string } | null, token: null as string | null, isLoading: false }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../api/user-library', () => ({ getUserLibrary: vi.fn(async () => ({ gameIds: ['remote'] })), setUserFavorite: vi.fn(async (_token: string, id: string, favorite: boolean) => ({ gameIds: favorite ? ['remote', id] : ['remote'] })) }));
function Wrapper({ children }: { children: React.ReactNode }) {
    const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }));
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); auth.user = null; auth.token = null; });
describe('收藏所有权', () => {
    it('游客保存后重新挂载可恢复，不预置示例游戏', async () => {
        const first = renderHook(useGameLibrary, { wrapper: Wrapper });
        await waitFor(() => expect(first.result.current.isLoading).toBe(false));
        expect(first.result.current.gameIds).toEqual([]);
        await act(async () => { await first.result.current.setFavorite({ gameId: 'betrayal', favorite: true }); });
        first.unmount();
        const second = renderHook(useGameLibrary, { wrapper: Wrapper });
        await waitFor(() => expect(second.result.current.gameIds).toEqual(['betrayal']));
    });
    it('登录后使用账户收藏而非游客本机数据', async () => {
        localStorage.setItem('bg_guest_game_library', JSON.stringify(['guest-only']));
        auth.user = { id: 'alice' }; auth.token = 'test-token';
        const { result } = renderHook(useGameLibrary, { wrapper: Wrapper });
        await waitFor(() => expect(result.current.gameIds).toEqual(['remote']));
        expect(result.current.isGuest).toBe(false);
    });
    it('连续收藏三个游戏后移除其中一个，其他收藏与重进结果保持一致', async () => {
        const hook = renderHook(useGameLibrary, { wrapper: Wrapper });
        await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
        await act(async () => {
            await Promise.all(['betrayal', 'smashup', 'splendor'].map(gameId =>
                hook.result.current.setFavorite({ gameId, favorite: true })));
        });
        await waitFor(() => expect(hook.result.current.gameIds).toEqual(['betrayal', 'smashup', 'splendor']));
        await act(async () => {
            await hook.result.current.setFavorite({ gameId: 'smashup', favorite: false });
        });
        await waitFor(() => expect(hook.result.current.gameIds).toEqual(['betrayal', 'splendor']));
        hook.unmount();
        const reopened = renderHook(useGameLibrary, { wrapper: Wrapper });
        await waitFor(() => expect(reopened.result.current.gameIds).toEqual(['betrayal', 'splendor']));
        expect(setUserFavorite).not.toHaveBeenCalled();
    });
    it('提交后切换账户不能把请求令牌或收藏结果写到新账户', async () => {
        auth.user = { id: 'alice' }; auth.token = 'alice-token';
        const hook = renderHook(useGameLibrary, { wrapper: Wrapper });
        await waitFor(() => expect(hook.result.current.gameIds).toEqual(['remote']));
        let pending!: Promise<unknown>;
        act(() => {
            pending = hook.result.current.setFavorite({ gameId: 'betrayal', favorite: true });
            auth.user = { id: 'bob' }; auth.token = 'bob-token';
            hook.rerender();
        });
        await act(async () => { await pending; });
        expect(setUserFavorite).toHaveBeenLastCalledWith('alice-token', 'betrayal', true);
        await waitFor(() => expect(hook.result.current.gameIds).toEqual(['remote']));
    });

});
