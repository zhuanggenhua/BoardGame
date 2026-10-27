// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformUploadWorkspace } from '../PlatformUploadWorkspace';
const api = vi.hoisted(() => ({ listGameSubmissions: vi.fn(async () => ({ items: [] })), saveGameSubmission: vi.fn(), submitGameSubmission: vi.fn(), uploadSubmissionCover: vi.fn() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ token: 'test', user: { id: 'owner', username: '用户' } }) }));
vi.mock('../../../api/game-submissions', () => api);
vi.mock('react-i18next', async () => {
    const [zhLobby, enLobby, zhCommon, enCommon] = await Promise.all([
        import('../../../../public/locales/zh-CN/lobby.json'),
        import('../../../../public/locales/en/lobby.json'),
        import('../../../../public/locales/zh-CN/common.json'),
        import('../../../../public/locales/en/common.json'),
    ]);
    const resources = {
        'zh-CN': { lobby: zhLobby.default, common: zhCommon.default },
        en: { lobby: enLobby.default, common: enCommon.default },
    };
    const language = 'zh-CN';
    const t = (key: string, options?: { count?: number; date?: string; defaultValue?: string }) => {
        const separator = key.indexOf(':');
        const namespace = separator >= 0 ? key.slice(0, separator) : 'lobby';
        const path = separator >= 0 ? key.slice(separator + 1) : key;
        const value = path.split('.').reduce<unknown>((current, part) => {
            if (!current || typeof current !== 'object') return undefined;
            return (current as Record<string, unknown>)[part];
        }, resources[language][namespace as 'lobby' | 'common']);
        if (typeof value !== 'string') return options?.defaultValue ?? key;
        return value.replace(/\{\{(count|date)\}\}/g, (_, name: 'count' | 'date') => String(options?.[name] ?? ''));
    };
    return { useTranslation: () => ({ t, i18n: { language, resolvedLanguage: language } }) };
});
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });
afterEach(cleanup);
describe('投稿封面选择', () => {
    it('网址输入框名称不会混入实时校验提示，提示仍可被辅助工具读取', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(<QueryClientProvider client={client}><PlatformUploadWorkspace onLogin={() => {}} /></QueryClientProvider>);
        const input = screen.getByRole('textbox', { name: '游戏链接', exact: true });
        expect(input).toHaveAccessibleDescription('填写可访问的游戏链接');
        fireEvent.change(input, { target: { value: 'https://example.com/' } });
        expect(input).toHaveAccessibleDescription('链接格式有效；尚未验证网站运行情况');
    });
    it('拒绝新文件后清除旧文件，不能把旧封面悄悄提交', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { container } = render(<QueryClientProvider client={client}><PlatformUploadWorkspace onLogin={() => {}} /></QueryClientProvider>);
        await waitFor(() => expect(api.listGameSubmissions).toHaveBeenCalled());
        const input = container.querySelector('input[type=file]')!;
        fireEvent.change(input, { target: { files: [new File(['image'], 'old.png', { type: 'image/png' })] } });
        expect(screen.getByAltText('投稿封面预览')).toBeTruthy();
        const large = new File(['x'], 'large.png', { type: 'image/png' });
        Object.defineProperty(large, 'size', { value: 11 * 1024 * 1024 });
        fireEvent.change(input, { target: { files: [large] } });
        expect(screen.getByRole('alert').textContent).toContain('10 MB');
        expect(screen.queryByAltText('投稿封面预览')).toBeNull();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    });
});
