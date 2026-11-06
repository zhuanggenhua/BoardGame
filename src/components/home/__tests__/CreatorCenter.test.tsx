// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatorClaimPanel, MySubmissions, MyWorks } from '../CreatorCenter';

const api = vi.hoisted(() => ({
    listGameSubmissions: vi.fn(),
    listOwnedGames: vi.fn(),
    listCreatorClaims: vi.fn(),
    listExternalGames: vi.fn(),
    createCreatorClaim: vi.fn(),
    getClaimEvidence: vi.fn(),
    submitCreatorClaim: vi.fn(),
    uploadClaimEvidence: vi.fn(),
    withdrawCreatorClaim: vi.fn(),
}));
vi.mock('../../../api/game-submissions', () => ({ listGameSubmissions: api.listGameSubmissions }));
vi.mock('../../../api/external-games', () => ({
    listOwnedGames: api.listOwnedGames,
    listCreatorClaims: api.listCreatorClaims,
    listExternalGames: api.listExternalGames,
    createCreatorClaim: api.createCreatorClaim,
    getClaimEvidence: api.getClaimEvidence,
    submitCreatorClaim: api.submitCreatorClaim,
    uploadClaimEvidence: api.uploadClaimEvidence,
    withdrawCreatorClaim: api.withdrawCreatorClaim,
}));

function mount(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => { vi.clearAllMocks(); });

describe('创作者中心空态与列表', () => {
    it.each(['选择', '拖放'] as const)('%s认证图片共用格式和大小校验并提交同一文件', async method => {
        const NativeURL = URL;
        vi.stubGlobal('URL', class extends NativeURL {
            static createObjectURL = vi.fn(() => 'blob:claim-evidence');
            static revokeObjectURL = vi.fn();
        });
        try {
            api.listCreatorClaims.mockResolvedValue({ items: [] });
            api.createCreatorClaim.mockResolvedValue({ claimId: 'drop-claim' });
            api.uploadClaimEvidence.mockResolvedValue({});
            api.submitCreatorClaim.mockResolvedValue({});
            mount(<CreatorClaimPanel token="t" userId="u" gameId="g1" gameName="山中小屋" onClose={() => {}} />);
            await screen.findByRole('heading', { name: '申请认领' });
            const upload = document.querySelector('.platform-cover-upload')!;
            const input = screen.getByLabelText('认证截图上传');
            const select = (file: File) => method === '拖放'
                ? fireEvent.drop(upload, { dataTransfer: { files: [file] } })
                : fireEvent.change(input, { target: { files: [file] } });
            select(new File(['invalid'], 'rules.pdf', { type: 'application/pdf' }));
            expect(await screen.findByRole('alert')).toHaveTextContent(/PNG/);
            select(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('截图不能超过 5 MB');
            expect(screen.queryByRole('img')).toBeNull();
            const file = new File(['synthetic image'], 'proof.png', { type: 'image/png' });
            select(file);
            expect(screen.queryByRole('alert')).toBeNull();
            expect(await screen.findByRole('img')).toHaveAttribute('src', 'blob:claim-evidence');
            fireEvent.change(screen.getByLabelText('作者主页'), { target: { value: 'https://example.com/author' } });
            fireEvent.change(screen.getByLabelText('你与游戏的关系'), { target: { value: '我是这款游戏的作者和开发者。' } });
            fireEvent.click(screen.getByRole('button', { name: '提交审核' }));
            await waitFor(() => expect(api.uploadClaimEvidence).toHaveBeenCalledWith('t', 'drop-claim', file));
            await waitFor(() => expect(api.submitCreatorClaim).toHaveBeenCalledWith('t', 'drop-claim'));
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('投稿空态只保留一个投稿入口', async () => {
        api.listGameSubmissions.mockResolvedValue({ items: [] });
        const onOpen = vi.fn();
        mount(<MySubmissions token="t" userId="u" onOpen={onOpen} />);
        expect(await screen.findByText('还没有符合条件的投稿')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '＋ 投稿游戏' }));
        expect(onOpen).toHaveBeenCalledOnce();
        expect(screen.getAllByRole('button', { name: '＋ 投稿游戏' })).toHaveLength(1);
    });

    it('投稿列表用状态徽章显示审核进度', async () => {
        api.listGameSubmissions.mockResolvedValue({ items: [{
            submissionId: 's1', name: '山中小屋', status: 'pending', updatedAt: '2026-10-27T00:00:00Z', coverUrl: '',
        }] });
        mount(<MySubmissions token="t" userId="u" onOpen={() => {}} />);
        expect(await screen.findByText('山中小屋')).toBeTruthy();
        expect(screen.getByText('待审核', { selector: '.creator-status' })).toHaveClass('is-pending');
        expect(screen.getByRole('button', { name: '查看投稿' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '＋ 投稿游戏' })).toBeTruthy();
    });

    it('作品空态说明去详情点作者认领', async () => {
        api.listOwnedGames.mockResolvedValue({ items: [] });
        mount(<MyWorks token="t" userId="u" onOpenGame={() => {}} />);
        expect(await screen.findByText('还没有可管理的作品')).toBeTruthy();
        expect(screen.getByText(/点击作者名字/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: '申请认领' })).toBeNull();
    });

    it('认领面板绑定当前游戏并保留验证短码与截图', async () => {
        api.listCreatorClaims.mockResolvedValue({ items: [{
            claimId: 'c1', gameId: 'g1', status: 'draft', profileUrl: 'https://example.com/',
            verificationCode: 'BG-TEST', verificationExpiresAt: '2026-10-28T00:00:00Z', hasEvidence: false,
        }] });
        mount(<CreatorClaimPanel token="t" userId="u" gameId="g1" gameName="山中小屋" onClose={() => {}} />);
        expect(await screen.findByText(/验证短码/)).toBeTruthy();
        expect(screen.getByText('BG-TEST').tagName).toBe('STRONG');
        expect(screen.getByText('当前游戏：山中小屋')).toBeTruthy();
        expect(screen.getByLabelText('认证截图上传')).toBeTruthy();
        expect(screen.queryByLabelText('选择游戏')).toBeNull();
        expect(screen.queryByRole('button', { name: '创建认证申请' })).toBeNull();
        expect(screen.getByRole('button', { name: '提交审核' })).toHaveClass('platform-submit');
    });

    it('空白认领填写复用投稿表单并要求截图才能送审', async () => {
        api.listCreatorClaims.mockResolvedValue({ items: [] });
        mount(<CreatorClaimPanel token="t" userId="u" gameId="g1" gameName="山中小屋" onClose={() => {}} />);
        expect(await screen.findByRole('heading', { name: '申请认领' })).toBeTruthy();
        expect(document.querySelector('.platform-upload-form')).toBeTruthy();
        expect(document.querySelector('.platform-upload-fields')).toBeTruthy();
        expect(document.querySelector('.platform-cover-upload')).toBeTruthy();
        expect(screen.getByText('当前游戏：山中小屋')).toBeTruthy();
        fireEvent.change(screen.getByLabelText('作者主页'), { target: { value: 'https://example.com/author' } });
        fireEvent.change(screen.getByLabelText('你与游戏的关系'), { target: { value: '我是这款游戏的作者和开发者。' } });
        fireEvent.click(screen.getByRole('button', { name: '提交审核' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/截图|证据/);
        expect(api.createCreatorClaim).not.toHaveBeenCalled();
        expect(api.submitCreatorClaim).not.toHaveBeenCalled();
    });
});
