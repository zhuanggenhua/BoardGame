// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../lib/i18n';
import adminTranslations from '../../../../public/locales/zh-CN/admin.json';
import lobbyTranslations from '../../../../public/locales/zh-CN/lobby.json';
import authTranslations from '../../../../public/locales/zh-CN/auth.json';
import commonTranslations from '../../../../public/locales/zh-CN/common.json';
import { MyFeedbackModal } from '../MyFeedbackModal';

const session = vi.hoisted(() => ({ token: 'first-account', success: vi.fn(), error: vi.fn() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ token: session.token }) }));
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ success: session.success, error: session.error }) }));
vi.mock('../../../hooks/ui/useAuthModalSession', () => ({ useAuthModalSession: () => undefined }));
const item = (n: number) => ({ _id: `id-${n}`, contentPreview: `反馈第${n}条`, gameName: 'dicethrone', type: 'bug', status: 'open', createdAt: '2026-11-03T00:00:00Z' });
const response = (data: unknown, ok = true) => Promise.resolve({ ok, json: async () => data } as Response);
const modal = (open = true) => <I18nextProvider i18n={i18n}><MyFeedbackModal isOpen={open} onClose={() => undefined} /></I18nextProvider>;
beforeEach(() => { for (const [ns, resource] of Object.entries({ admin: adminTranslations, lobby: lobbyTranslations, auth: authTranslations, common: commonTranslations })) i18n.addResourceBundle('zh-CN', ns, resource, true, true); session.token = 'first-account'; vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('按服务端页码翻页，最后一页删除后回到仍有数据的页', async () => {
    let records = Array.from({ length: 7 }, (_, n) => item(n + 1));
    const requests: number[] = [];
    vi.stubGlobal('fetch', vi.fn((raw: string, options?: RequestInit) => {
        const url = new URL(raw, 'http://localhost');
        if (options?.method === 'DELETE') { records = records.filter(record => record._id !== 'id-7'); return response({ ok: true }); }
        const page = Number(url.searchParams.get('page') ?? 1);
        if (url.searchParams.has('page')) requests.push(page);
        return response({ items: records.slice((page - 1) * 6, page * 6), total: records.length });
    }));
    render(modal()); await screen.findByText('反馈第1条');
    expect(screen.getAllByText('王权骰铸')).toHaveLength(6);
    expect(screen.queryByText('games.dicethrone.title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByText('反馈第7条'); expect(screen.queryByText('反馈第1条')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '删除这条反馈' }));
    await screen.findByText('反馈第1条'); expect(screen.getByText('第 1 / 1 页')).toBeTruthy();
    expect(requests[0]).toBe(1);
    expect(requests.slice(-2)).toEqual([2, 1]);
});

it('关闭并换账户后，旧请求晚到也不能覆盖新账户列表', async () => {
    let release!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn((_url: string, options?: RequestInit) => (options?.headers as Record<string, string>).Authorization === 'Bearer first-account'
        ? new Promise<Response>(resolve => { release = resolve; }) : response({ items: [{ ...item(8), contentPreview: '新账户反馈' }], total: 1 })));
    const view = render(modal()); view.rerender(modal(false)); session.token = 'second-account'; view.rerender(modal());
    await screen.findByText('新账户反馈');
    await act(async () => { release(await response({ items: [{ ...item(1), contentPreview: '旧账户反馈' }], total: 1 })); });
    expect(screen.queryByText('旧账户反馈')).toBeNull();
});

it('切换账户后，旧账户的展开详情不能写入新账户反馈', async () => {
    let releaseDetail!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn((raw: string, options?: RequestInit) => {
        const url = new URL(raw, 'http://localhost');
        const authorization = (options?.headers as Record<string, string>).Authorization;
        if (url.pathname.endsWith('/id-1')) {
            return new Promise<Response>(resolve => { releaseDetail = resolve; });
        }
        return response({ items: [authorization === 'Bearer first-account' ? item(1) : item(8)], total: 1 });
    }));
    const view = render(modal());
    await screen.findByText('反馈第1条');
    fireEvent.click(screen.getByTestId('my-feedback-expand'));
    await screen.findByTestId('my-feedback-detail-loading');
    view.rerender(modal(false));
    session.token = 'second-account';
    view.rerender(modal());
    await screen.findByText('反馈第8条');
    await act(async () => { releaseDetail(await response({ ...item(1), content: '旧账户的完整反馈' })); });
    expect(screen.queryByText('旧账户的完整反馈')).toBeNull();
    expect(screen.getByText('反馈第8条')).toBeTruthy();
});

it('列表错误可刷新恢复，展开仍读取完整反馈', async () => {
    let first = true;
    vi.stubGlobal('fetch', vi.fn((url: string) => {
        if (url.endsWith('/id-1')) return response({ ...item(1), content: '这里是完整的反馈正文' });
        if (first) { first = false; return response({}, false); }
        return response({ items: [item(1)], total: 1 });
    }));
    render(modal()); await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    await screen.findByText('反馈第1条'); fireEvent.click(screen.getByTestId('my-feedback-expand'));
    await screen.findByText('这里是完整的反馈正文'); expect(screen.getByTestId('my-feedback-expand').getAttribute('aria-expanded')).toBe('true');
});
