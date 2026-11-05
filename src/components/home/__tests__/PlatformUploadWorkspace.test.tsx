// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSubmissionForm, PlatformUploadWorkspace } from '../PlatformUploadWorkspace';
const api = vi.hoisted(() => ({ listGameSubmissions: vi.fn(async () => ({ items: [] })), saveGameSubmission: vi.fn(), submitGameSubmission: vi.fn(), uploadSubmissionCover: vi.fn(), uploadSubmissionRules: vi.fn(), removeSubmissionRules: vi.fn() }));
const ownedApi = vi.hoisted(() => ({ updateOwnedGame: vi.fn(), uploadOwnedCover: vi.fn(), uploadOwnedRules: vi.fn(), removeOwnedRules: vi.fn() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ token: 'test', user: { id: 'owner', username: '用户' } }) }));
vi.mock('../../../api/game-submissions', () => api);
vi.mock('../../../api/external-games', () => ownedApi);
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

describe('投稿字段与规则文件', () => {
    it('迟到的旧列表响应不能冲掉已保存草稿或卸载失败后的编辑器', async () => {
        let releaseList!: (value: { items: never[] }) => void;
        api.listGameSubmissions.mockImplementationOnce(() => new Promise(resolve => { releaseList = resolve; }));
        const draft = { submissionId: 'race-draft', name: '林间探险', url: 'https://example.com/game', description: '游戏介绍', rules: '', author: '作者', category: 'card', status: 'draft' as const, coverUrl: '', updatedAt: '', reviewComment: '' };
        api.saveGameSubmission.mockResolvedValue(draft);
        api.uploadSubmissionRules.mockRejectedValueOnce(new Error('上传失败，保留草稿'));
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        function SelectedWorkspace() {
            const [id, setId] = React.useState<string>();
            return <PlatformUploadWorkspace onLogin={() => {}} submissionId={id} onSelectSubmission={setId} />;
        }
        render(<QueryClientProvider client={client}><SelectedWorkspace /></QueryClientProvider>);
        await waitFor(() => expect(api.listGameSubmissions).toHaveBeenCalled());
        fillRequired();
        fireEvent.change(screen.getByLabelText('规则文件', { selector: 'input' }), { target: { files: [rules()] } });
        fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
        await screen.findByText('上传失败，保留草稿');
        await act(async () => { releaseList({ items: [] }); await new Promise(resolve => setTimeout(resolve, 30)); });
        expect(screen.getByRole('textbox', { name: '游戏名称' })).toHaveValue('林间探险');
        expect(screen.getByText('林间探险规则.pdf')).toBeTruthy();
        expect(screen.getByRole('alert')).toHaveTextContent('上传失败，保留草稿');
    });
    it('指定投稿加载失败时给出错误和重试，不冒充新投稿表单', async () => {
        api.listGameSubmissions.mockRejectedValueOnce(new Error('offline'));
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(<QueryClientProvider client={client}><PlatformUploadWorkspace onLogin={() => {}} submissionId="selected-draft" onSelectSubmission={() => {}} /></QueryClientProvider>);
        await screen.findByRole('alert');
        expect(screen.queryByRole('textbox', { name: '游戏名称' })).toBeNull();
        expect(screen.getByRole('button', { name: '重试', exact: true })).toBeTruthy();
    });
    const fillRequired = () => {
        fireEvent.change(screen.getByRole('textbox', { name: '游戏名称' }), { target: { value: '林间探险' } });
        fireEvent.change(screen.getByRole('textbox', { name: '游戏链接', exact: true }), { target: { value: 'https://example.com/game' } });
        fireEvent.change(screen.getByRole('textbox', { name: '介绍' }), { target: { value: '与朋友一起探索森林。' } });
    };
    const rules = () => new File(['%PDF-1.4\n%%EOF'], '林间探险规则.pdf', { type: 'application/pdf' });
    it('只收集有实际展示用途的字段，规则文件随草稿保存', async () => {
        api.saveGameSubmission.mockResolvedValue({ submissionId: 'rules-draft' });
        api.uploadSubmissionRules.mockResolvedValue({ rulesDocument: { url: '/rules.pdf', name: rules().name, size: 20 } });
        const saved = vi.fn(); const { container } = render(<GameSubmissionForm onSaved={saved} />);
        expect(container.querySelector('[name=durationMinutes]')).toBeNull();
        fillRequired();
        const file = rules();
        fireEvent.change(screen.getByLabelText('规则文件', { selector: 'input' }), { target: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
        await waitFor(() => expect(saved).toHaveBeenCalledWith('rules-draft'));
        expect(api.uploadSubmissionRules).toHaveBeenCalledWith('test', 'rules-draft', file);
        expect(api.submitGameSubmission).not.toHaveBeenCalled();
        expect(api.saveGameSubmission.mock.calls.at(-1)![1]).not.toHaveProperty('durationMinutes');
    });
    it('规则上传失败不送审，重试保留输入并沿用已创建草稿编号', async () => {
        api.saveGameSubmission.mockResolvedValue({ submissionId: 'retry-draft' });
        api.uploadSubmissionCover.mockResolvedValue({ coverUrl: '/cover.webp' });
        api.uploadSubmissionRules.mockRejectedValueOnce(new Error('规则上传失败，请重试')).mockResolvedValue({ rulesDocument: { url: '/rules.pdf', name: rules().name, size: 20 } });
        api.submitGameSubmission.mockResolvedValue({});
        const saved = vi.fn(); render(<GameSubmissionForm onSaved={saved} />); fillRequired();
        fireEvent.change(screen.getByLabelText('封面', { selector: 'input' }), { target: { files: [new File(['image'], 'cover.png', { type: 'image/png' })] } });
        fireEvent.change(screen.getByLabelText('规则文件', { selector: 'input' }), { target: { files: [rules()] } });
        fireEvent.click(screen.getByRole('button', { name: '提交审核' }));
        await screen.findByText('规则上传失败，请重试');
        expect(api.submitGameSubmission).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled();
        expect(screen.getByRole('textbox', { name: '游戏名称' })).toHaveValue('林间探险');
        fireEvent.click(screen.getByRole('button', { name: '提交审核' }));
        await waitFor(() => expect(api.submitGameSubmission).toHaveBeenCalledWith('test', 'retry-draft'));
        expect(api.saveGameSubmission.mock.calls.at(-1)![2]).toBe('retry-draft');
    });
    it('重新打开的草稿可查看及移除规则文件', async () => {
        const record = { submissionId: 'old-draft', name: '林间探险', url: 'https://example.com/game', description: '游戏介绍', rules: '', author: '作者', category: 'card', status: 'draft' as const, coverUrl: '/cover.webp', updatedAt: '', reviewComment: '', rulesDocument: { url: '/rules.pdf', name: '规则.pdf', size: 40 } };
        api.saveGameSubmission.mockResolvedValue(record); api.removeSubmissionRules.mockResolvedValue({ removed: true });
        const saved = vi.fn(); render(<GameSubmissionForm record={record} onSaved={saved} />);
        expect(screen.getByRole('link', { name: '规则.pdf' })).toHaveAttribute('href', '/rules.pdf');
        fireEvent.click(screen.getByRole('button', { name: '移除规则文件' }));
        fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
        await waitFor(() => expect(saved).toHaveBeenCalledWith('old-draft'));
        expect(api.removeSubmissionRules).toHaveBeenCalledWith('test', 'old-draft');
    });
    it('非 PDF 文件就地报错且阻止提交，移除错误后可不带附件保存草稿', async () => {
        render(<GameSubmissionForm onSaved={() => {}} />); fillRequired();
        fireEvent.change(screen.getByLabelText('规则文件', { selector: 'input' }), { target: { files: [new File(['text'], '规则.txt', { type: 'text/plain' })] } });
        expect(screen.getByRole('alert')).toHaveTextContent('请选择 PDF');
        fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
        expect(api.saveGameSubmission).not.toHaveBeenCalled();
        api.saveGameSubmission.mockResolvedValue({ submissionId: 'without-rules' });
        fireEvent.click(screen.getByRole('button', { name: '移除规则文件', exact: true }));
        fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
        await waitFor(() => expect(api.saveGameSubmission).toHaveBeenCalled());
        expect(api.uploadSubmissionRules).not.toHaveBeenCalled();
    });
    it('认证作者编辑作品走作品文件接口，不创建新的投稿', async () => {
        const ownedGame = { gameId: 'external-owned', name: '林间探险', url: 'https://example.com/game', description: '游戏介绍', rules: '', durationMinutes: 45, author: '作者', category: 'card', coverUrl: '/cover.webp', published: true, embedStatus: 'unknown' as const, embedReason: '', ownerUserId: 'owner', updatedAt: '' };
        ownedApi.updateOwnedGame.mockResolvedValue(ownedGame); ownedApi.uploadOwnedRules.mockResolvedValue({});
        const saved = vi.fn(); render(<GameSubmissionForm ownedGame={ownedGame} onSaved={saved} />);
        const file = rules(); fireEvent.change(screen.getByLabelText('规则文件', { selector: 'input' }), { target: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: '保存作品', exact: true }));
        await waitFor(() => expect(saved).toHaveBeenCalledWith('external-owned'));
        expect(ownedApi.uploadOwnedRules).toHaveBeenCalledWith('test', 'external-owned', file);
        expect(ownedApi.updateOwnedGame).toHaveBeenCalledWith('test', 'external-owned', expect.objectContaining({ durationMinutes: 45 }));
        expect(api.saveGameSubmission).not.toHaveBeenCalled();
    });
});
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });
afterEach(cleanup);
describe('投稿封面选择', () => {
    it('网址输入框名称不会混入实时校验提示，提示仍可被辅助工具读取', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(<QueryClientProvider client={client}><PlatformUploadWorkspace onLogin={() => {}} onSelectSubmission={() => {}} /></QueryClientProvider>);
        const input = screen.getByRole('textbox', { name: '游戏链接', exact: true });
        expect(input).toHaveAccessibleDescription('填写可访问的游戏链接');
        fireEvent.change(input, { target: { value: 'https://example.com/' } });
        expect(input).toHaveAccessibleDescription('链接格式有效；尚未验证网站运行情况');
    });
    it('拒绝新文件后清除旧文件，不能把旧封面悄悄提交', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { container } = render(<QueryClientProvider client={client}><PlatformUploadWorkspace onLogin={() => {}} onSelectSubmission={() => {}} /></QueryClientProvider>);
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
    it('拖入封面后保存草稿不送审，再次提交沿用草稿并上传所选文件', async () => {
        const saved = vi.fn();
        api.saveGameSubmission.mockResolvedValue({ submissionId: 'draft-one' });
        api.uploadSubmissionCover.mockResolvedValue({ coverUrl: '/cover.webp' });
        api.submitGameSubmission.mockResolvedValue({});
        render(<GameSubmissionForm onSaved={saved} />);
        fireEvent.change(screen.getByRole('textbox', { name: '游戏名称' }), { target: { value: '林间探险' } });
        fireEvent.change(screen.getByRole('textbox', { name: '游戏链接', exact: true }), { target: { value: 'https://example.com/game' } });
        fireEvent.change(screen.getByRole('textbox', { name: '介绍' }), { target: { value: '与朋友一起探索森林。' } });
        const image = new File(['image'], 'forest.png', { type: 'image/png' });
        fireEvent.drop(screen.getByRole('button', { name: '添加封面' }).closest('.platform-cover-upload')!, { dataTransfer: { files: [image] } });
        await screen.findByAltText('投稿封面预览');
        fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
        await waitFor(() => expect(saved).toHaveBeenCalledWith('draft-one'));
        expect(api.uploadSubmissionCover).toHaveBeenCalledWith('test', 'draft-one', image);
        expect(api.submitGameSubmission).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '提交审核' }));
        await waitFor(() => expect(api.submitGameSubmission).toHaveBeenCalledWith('test', 'draft-one'));
        expect(api.saveGameSubmission).toHaveBeenLastCalledWith('test', expect.objectContaining({ name: '林间探险', url: 'https://example.com/game', description: '与朋友一起探索森林。' }), 'draft-one');
    });
    it('拖入非图片给出就地错误，取消选图不会清除已有封面', async () => {
        const { container } = render(<GameSubmissionForm onSaved={() => {}} />);
        const input = container.querySelector('input[type=file]')!;
        fireEvent.change(input, { target: { files: [new File(['image'], 'cover.png', { type: 'image/png' })] } });
        await screen.findByAltText('投稿封面预览');
        fireEvent.change(input, { target: { files: [] } });
        expect(screen.getByAltText('投稿封面预览')).toBeTruthy();
        fireEvent.drop(container.querySelector('.platform-cover-upload')!, { dataTransfer: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] } });
        expect(screen.getByRole('alert')).toHaveTextContent('请选择 PNG');
        expect(screen.queryByAltText('投稿封面预览')).toBeNull();
    });
});
