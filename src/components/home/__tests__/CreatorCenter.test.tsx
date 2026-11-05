// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
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
        expect(screen.getByText('BG-TEST').tagName).toBe('B');
        expect(screen.getByText('当前游戏：山中小屋')).toBeTruthy();
        expect(screen.getByLabelText('认证截图')).toBeTruthy();
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
