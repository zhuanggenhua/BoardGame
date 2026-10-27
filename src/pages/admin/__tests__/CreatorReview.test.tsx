// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ queue: vi.fn() }));
vi.mock('../../../api/external-games', () => ({ getCreatorReviewQueue: api.queue, reviewClaim: vi.fn(), reviewSubmission: vi.fn(), updateEmbedCheck: vi.fn() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ token: 'admin-token' }) }));
vi.mock('../../../components/home/CreatorCenter', () => ({ PrivateEvidence: () => null }));
import CreatorReview from '../CreatorReview';

beforeEach(() => { vi.clearAllMocks(); });
describe('管理员审核队列', () => {
    it('切换审核类型时重新读取队列，能看到刚提交的认领申请', async () => {
        api.queue.mockResolvedValueOnce({ submissions: [], claims: [], games: [] }).mockResolvedValueOnce({
            submissions: [], claims: [{ claimId: 'claim-1', gameId: 'game-1', applicantId: 'user-1', applicantName: '新作者',
                profileUrl: 'https://example.com/', explanation: '我是这款游戏的作者', verificationCode: 'BG-TEST',
                verificationExpiresAt: '2026-10-27T10:00:00Z', hasEvidence: true, evidenceDigest: 'hash', status: 'pending' }],
            games: [{ gameId: 'game-1', name: '新投稿游戏' }],
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(<QueryClientProvider client={client}><MemoryRouter><CreatorReview /></MemoryRouter></QueryClientProvider>);
        expect(await screen.findByText('暂无待审核投稿。')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '作者认领' }));
        expect(await screen.findByRole('heading', { name: '新投稿游戏' })).toBeTruthy();
        expect(screen.getByText('申请人：新作者')).toBeTruthy();
        expect(api.queue).toHaveBeenCalledTimes(2);
    });
});
