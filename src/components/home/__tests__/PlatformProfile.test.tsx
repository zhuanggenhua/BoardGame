// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformProfile } from '../PlatformProfile';
const auth = vi.hoisted(() => ({ user: { id: 'owner', username: '真实昵称', avatar: '' } as { id: string; username: string; avatar: string } | null, token: 'token', updateUsername: vi.fn(async () => {}), uploadAvatar: vi.fn(async () => {}) }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../config/games.config', () => ({ getGameById: (id: string) => ({ id, titleKey: '山屋惊魂', thumbnail: <span>正式封面</span> }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><PlatformProfile favoriteCount={2} onOpenGame={() => {}} onLogin={() => {}} /></QueryClientProvider>);
}
beforeEach(() => {
    auth.user = { id: 'owner', username: '真实昵称', avatar: '' }; vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ totalPlays: 3, games: [{ gameId: 'betrayal', plays: 3, lastPlayed: '2026-10-16T12:00:00Z' }] }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('个人页真实数据', () => {
    it('显示账户资料与服务端局数，不把未知时长编成小时', async () => {
        mount();
        await waitFor(() => expect(screen.getByText('局数 3')).toBeTruthy());
        expect(screen.getByRole('heading', { name: '真实昵称' })).toBeTruthy();
        expect(screen.getByText('未记录')).toBeTruthy();
        const meta = screen.getByText('局数 3').parentElement;
        expect(meta?.className).toBe('platform-profile-game-meta');
        expect(meta?.querySelector('time')).toBeTruthy();
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/profile/activity'), expect.objectContaining({ headers: { Authorization: 'Bearer token' } }));
    });
    it('编辑昵称调用已有账户接口，未选头像不会重复上传', async () => {
        mount();
        fireEvent.click(screen.getByRole('button', { name: '编辑个人资料' }));
        fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '新的昵称' } });
        fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
        await waitFor(() => expect(auth.updateUsername).toHaveBeenCalledWith('新的昵称'));
        expect(auth.uploadAvatar).not.toHaveBeenCalled();
    });
    it('游客没有账户记录，不能发带账户令牌的活动请求', () => {
        auth.user = null; mount();
        expect(screen.getByRole('button', { name: '登录' })).toBeTruthy();
        expect(fetch).not.toHaveBeenCalled();
    });
});
