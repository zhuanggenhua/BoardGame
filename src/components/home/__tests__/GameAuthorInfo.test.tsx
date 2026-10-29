// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalGameAuthor, GameAuthorInfo } from '../GameAuthorInfo';

const auth = vi.hoisted(() => ({ user: { id: 'u1', username: '玩家' } as { id: string; username: string } | null, token: 't' as string | null }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { author?: string; game?: string }) => {
            const map: Record<string, string> = {
                'authorInfo.button': `电子化作者：${options?.author ?? ''}`,
                'authorInfo.buttonHint': '点击查看作者信息',
                'authorInfo.title': '作者',
                'authorInfo.game': `作品：${options?.game ?? ''}`,
                'authorInfo.hint': '当前先展示作者署名，后续如有更完整的作者介绍，会从这里展开。',
                'authorInfo.close': '关闭',
                'authorInfo.openHomepage': '打开作者主页',
                'authorInfo.claim': '申请认领',
                'authorInfo.manageWorks': '管理我的作品',
            };
            return map[key] ?? key;
        },
    }),
}));
vi.mock('../../../api/external-games', () => ({
    listCreatorClaims: vi.fn(async () => ({ items: [] })),
    createCreatorClaim: vi.fn(),
    getClaimEvidence: vi.fn(),
    submitCreatorClaim: vi.fn(),
    uploadClaimEvidence: vi.fn(),
    withdrawCreatorClaim: vi.fn(),
}));

function mount(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
    auth.user = { id: 'u1', username: '玩家' };
    auth.token = 't';
});

describe('作者信息弹层', () => {
    it('点击作者打开与原生相同的作者信息弹层', () => {
        mount(<GameAuthorInfo authorName="鸢一桑" gameName="山中小屋" />);
        fireEvent.click(screen.getByTestId('game-details-author-button-mobile'));
        expect(screen.getByTestId('game-details-author-modal')).toBeTruthy();
        expect(screen.getByText('鸢一桑')).toBeTruthy();
        expect(screen.getByText('作品：山中小屋')).toBeTruthy();
        expect(screen.queryByRole('button', { name: '申请认领' })).toBeNull();
    });

    it('外站作者弹层提供主页和申请认领', async () => {
        const onManage = vi.fn();
        mount(<ExternalGameAuthor author="鸢一桑" authorProfileUrl="https://space.bilibili.com/31976469" gameId="g1" gameName="山中小屋" isOwner={false} onManageWorks={onManage} />);
        fireEvent.click(screen.getByTestId('game-details-author-button-mobile'));
        expect(screen.getByTestId('game-details-author-modal')).toBeTruthy();
        expect(screen.getByRole('link', { name: '打开作者主页' })).toHaveAttribute('href', 'https://space.bilibili.com/31976469');
        fireEvent.click(screen.getByRole('button', { name: '申请认领' }));
        expect(screen.getByTestId('creator-claim-panel')).toBeTruthy();
        expect(await screen.findByRole('heading', { name: '申请认领' })).toBeTruthy();
        expect(screen.getByText('当前游戏：山中小屋')).toBeTruthy();
        expect(onManage).not.toHaveBeenCalled();
    });

    it('未登录时认领层提示先登录', () => {
        auth.user = null;
        auth.token = null;
        mount(<ExternalGameAuthor author="鸢一桑" gameId="g1" gameName="山中小屋" isOwner={false} onManageWorks={() => {}} />);
        fireEvent.click(screen.getByTestId('game-details-author-button-mobile'));
        fireEvent.click(screen.getByRole('button', { name: '申请认领' }));
        expect(screen.getByText('请先登录后再申请认领这款游戏。登录入口在页面顶部。')).toBeTruthy();
        expect(screen.queryByText('当前游戏：山中小屋')).toBeNull();
    });

    it('已是所有者时作者弹层提供管理作品', () => {
        const onManage = vi.fn();
        mount(<ExternalGameAuthor author="鸢一桑" gameId="g1" gameName="山中小屋" isOwner onManageWorks={onManage} />);
        fireEvent.click(screen.getByTestId('game-details-author-button-mobile'));
        fireEvent.click(screen.getByRole('button', { name: '管理我的作品' }));
        expect(onManage).toHaveBeenCalledOnce();
        expect(screen.queryByRole('button', { name: '申请认领' })).toBeNull();
    });
});
