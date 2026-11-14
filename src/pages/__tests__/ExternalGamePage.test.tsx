// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getGame: vi.fn(), play: vi.fn(() => ({ seconds: 0, syncError: false })) }));
vi.mock('../../api/external-games', () => ({ getExternalGame: mocks.getGame, getOwnedGame: mocks.getGame }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ token: 'test-token', isLoading: false }) }));
vi.mock('../../components/external/useExternalPlay', () => ({ useExternalPlay: mocks.play }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { name?: string }) => key === 'platform.externalGamePage.iframeTitle' ? `${options?.name} 游戏` : key }) }));
import ExternalGamePage from '../ExternalGamePage';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGame.mockResolvedValue({ gameId: 'external-test', name: '测试游戏', url: 'https://example.com/game',
        category: 'card', author: '作者', authorProfileUrl: '', description: '介绍', rules: '', coverUrl: '', published: true,
        embedStatus: 'allowed', embedReason: '', ownerUserId: null });
});
describe('外链页与计时生命周期', () => {
    it('MK 的已核验地址可保留原站来源', async () => {
        mocks.getGame.mockResolvedValueOnce({ gameId: 'external-mage-knight-web', name: 'MK', url: 'http://e7-auto.7skyun.com:41956/', published: true, embedStatus: 'unknown', embedReason: '' });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/external/external-mage-knight-web']}><Routes>
            <Route path="/external/:gameId" element={<ExternalGamePage />} />
        </Routes></MemoryRouter></QueryClientProvider>);
        const frame = await screen.findByTitle('MK 游戏');
        expect(frame.getAttribute('src')).toBe('http://e7-auto.7skyun.com:41956/');
        expect(frame.getAttribute('sandbox')).toContain('allow-same-origin');
    });
    it('仅已核验的爱丽丝地址保留原站来源，其他地址仍使用原沙箱', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const router = createMemoryRouter([{ path: '/external/:gameId', element: <ExternalGamePage /> }], { initialEntries: ['/external/external-queen-alice'] });
        mocks.getGame.mockResolvedValueOnce({ gameId: 'external-queen-alice', name: '爱丽丝', url: 'https://queen-alice.onwardtool.com/', published: true, embedStatus: 'allowed', embedReason: '' });
        render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
        const aliceFrame = await screen.findByTitle('爱丽丝 游戏');
        expect(aliceFrame.getAttribute('sandbox')).toContain('allow-same-origin');
        expect(aliceFrame.getAttribute('src')).toBe('https://onwardtool.com/queen-alice/');
        mocks.getGame.mockResolvedValueOnce({ gameId: 'external-other', name: '其他游戏', url: 'https://example.com/', published: true, embedStatus: 'allowed', embedReason: '' });
        await act(async () => { await router.navigate('/external/external-other'); });
        expect((await screen.findByTitle('其他游戏 游戏')).getAttribute('sandbox')).not.toContain('allow-same-origin');
        mocks.getGame.mockResolvedValue({ gameId: 'external-queen-alice', name: '变更地址', url: 'https://example.com/', published: true, embedStatus: 'allowed', embedReason: '' });
        await act(async () => { await router.navigate('/external/external-queen-alice'); });
        expect((await screen.findByTitle('变更地址 游戏')).getAttribute('sandbox')).not.toContain('allow-same-origin');
    });
    it('取消外站提示时不打开原网站', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/external/external-test']}><Routes>
            <Route path="/external/:gameId" element={<ExternalGamePage />} />
        </Routes></MemoryRouter></QueryClientProvider>);
        await screen.findByTitle('测试游戏 游戏');
        fireEvent.click(screen.getByRole('button', { name: 'platform.externalGamePage.openGameMenu' }));
        const link = screen.getByRole('link', { name: /platform.externalGamePage.openOriginal/ });
        const click = createEvent.click(link);
        fireEvent(link, click);
        expect(confirm).toHaveBeenCalled();
        expect(click.defaultPrevented).toBe(true);
        confirm.mockRestore();
    });
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
