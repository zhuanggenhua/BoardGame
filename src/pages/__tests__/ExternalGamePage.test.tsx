// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getGame: vi.fn(), play: vi.fn(() => ({ seconds: 0, syncError: false })) }));
vi.mock('../../api/external-games', () => ({ getExternalGame: mocks.getGame, getOwnedGame: mocks.getGame }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ token: 'test-token', isLoading: false }) }));
vi.mock('../../components/external/useExternalPlay', () => ({ useExternalPlay: mocks.play }));
import ExternalGamePage from '../ExternalGamePage';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGame.mockResolvedValue({ gameId: 'external-test', name: '测试游戏', url: 'https://example.com/game',
        category: 'card', author: '作者', authorProfileUrl: '', description: '介绍', rules: '', coverUrl: '', published: true,
        embedStatus: 'allowed', embedReason: '', ownerUserId: null });
});
describe('外链页与计时生命周期', () => {
    it('后台下架或详情重取失败时卸载 iframe 并结束计时', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/external/external-test']}><Routes>
            <Route path="/external/:gameId" element={<ExternalGamePage />} />
        </Routes></MemoryRouter></QueryClientProvider>);
        expect(await screen.findByTitle('测试游戏 游戏')).toBeTruthy();
        expect(mocks.play).toHaveBeenLastCalledWith('external-test', 'test-token', true);
        mocks.getGame.mockRejectedValue(new Error('游戏已下架'));
        await client.invalidateQueries({ queryKey: ['external-game', 'external-test'] });
        await screen.findByRole('alert');
        expect(screen.queryByTitle('测试游戏 游戏')).toBeNull();
        await waitFor(() => expect(mocks.play).toHaveBeenLastCalledWith('external-test', 'test-token', false));
    });
    it('从一个外链游戏跳到另一个时对新游戏重新开玩', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const router = createMemoryRouter([{ path: '/external/:gameId', element: <ExternalGamePage /> }], { initialEntries: ['/external/external-test'] });
        render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
        expect(await screen.findByTitle('测试游戏 游戏')).toBeTruthy();
        expect(mocks.play).toHaveBeenLastCalledWith('external-test', 'test-token', true);
        mocks.getGame.mockResolvedValue({ gameId: 'external-other', name: '另一游戏', url: 'https://example.com/other',
            category: 'card', author: '作者', authorProfileUrl: '', description: '介绍', rules: '', coverUrl: '', published: true,
            embedStatus: 'allowed', embedReason: '', ownerUserId: null });
        await act(async () => { await router.navigate('/external/external-other'); });
        await waitFor(() => expect(mocks.play).toHaveBeenLastCalledWith('external-other', 'test-token', true));
        expect(await screen.findByTitle('另一游戏 游戏')).toBeTruthy();
    });
});
