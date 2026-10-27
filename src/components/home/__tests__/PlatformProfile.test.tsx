// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ModalStackProvider } from '../../../contexts/ModalStackContext';
import { PlatformProfile } from '../PlatformProfile';
const auth = vi.hoisted(() => ({ user: { id: 'owner', username: '真实昵称', avatar: '' } as { id: string; username: string; avatar: string } | null, token: 'token', updateUsername: vi.fn(async () => {}), uploadAvatar: vi.fn(async () => {}) }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../../config/games.config', () => ({ getGameById: (id: string) => ({ id, titleKey: '山屋惊魂', thumbnail: <span>正式封面</span> }) }));
vi.mock('react-i18next', async () => {
    const [zhLobby, enLobby, zhCommon, enCommon, zhSocial, enSocial] = await Promise.all([
        import('../../../../public/locales/zh-CN/lobby.json'),
        import('../../../../public/locales/en/lobby.json'),
        import('../../../../public/locales/zh-CN/common.json'),
        import('../../../../public/locales/en/common.json'),
        import('../../../../public/locales/zh-CN/social.json'),
        import('../../../../public/locales/en/social.json'),
    ]);
    const resources = {
        'zh-CN': { lobby: zhLobby.default, common: zhCommon.default, social: zhSocial.default },
        en: { lobby: enLobby.default, common: enCommon.default, social: enSocial.default },
    };
    const language = 'zh-CN';
    const t = (key: string, options?: { count?: number; date?: string; name?: string; defaultValue?: string }) => {
        const separator = key.indexOf(':');
        const namespace = separator >= 0 ? key.slice(0, separator) : 'lobby';
        const path = separator >= 0 ? key.slice(separator + 1) : key;
        const value = path.split('.').reduce<unknown>((current, part) => {
            if (!current || typeof current !== 'object') return undefined;
            return (current as Record<string, unknown>)[part];
        }, resources[language][namespace as 'lobby' | 'common' | 'social']);
        if (typeof value !== 'string') return options?.defaultValue ?? key;
        return value.replace(/\{\{(count|date|name)\}\}/g, (_, name: 'count' | 'date' | 'name') => String(options?.[name] ?? ''));
    };
    return { useTranslation: () => ({ t, i18n: { language, resolvedLanguage: language } }) };
});
function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<ModalStackProvider><QueryClientProvider client={client}><PlatformProfile favoriteCount={2} onLogin={() => {}} /></QueryClientProvider></ModalStackProvider>);
}
beforeEach(() => {
    auth.user = { id: 'owner', username: '真实昵称', avatar: '' }; vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        return url.endsWith('/profile/matches')
            ? { ok: true, json: async () => [{ id: 'match-1', gameId: 'tictactoe', endedAt: '2026-10-16T12:00:00Z', result: 'win', opponents: ['对手'] }] }
            : { ok: true, json: async () => ({ totalPlays: 3, games: [] }) };
    }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('个人页真实数据', () => {
    it('用真实对局列表替换聚合动态，同时保留活动接口总局数', async () => {
        mount();
        await waitFor(() => expect(screen.getByTestId('profile-rail')).toHaveTextContent(/局数\s*3/));
        const row = await screen.findByTestId('match-history-row');
        expect(screen.getByRole('heading', { name: '真实昵称' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: '对局记录' })).toBeTruthy();
        expect(row.getAttribute('data-match-id')).toBe('match-1');
        expect(row).toHaveTextContent('胜利');
        expect(row).toHaveTextContent('对手');
        expect(screen.queryByText('最新动态')).toBeNull();
        expect(screen.getByTestId('profile-plays').querySelector('.platform-profile-game')).toBeNull();
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/profile/activity'), expect.objectContaining({ headers: { Authorization: 'Bearer token' } }));
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/profile/matches'), expect.objectContaining({ headers: { Authorization: 'Bearer token' } }));
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
