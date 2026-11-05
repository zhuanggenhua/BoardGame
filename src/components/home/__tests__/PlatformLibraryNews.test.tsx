// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformLibraryNews } from '../PlatformLibraryNews';
import type { GameConfig } from '../../../config/games.config';
const load = vi.hoisted(() => vi.fn(async (id: string) => [{ id: 'update-1', gameId: id, title: '真实更新', content: '改进规则说明', published: true, pinned: false, createdAt: '2026-10-16', updatedAt: '2026-10-16' }]));
vi.mock('../../../api/game-changelogs', () => ({ getGameChangelogs: load }));
const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('../../../hooks/ui/useMobileViewport', () => ({ useMobileViewport: () => viewport.mobile }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key, i18n: { language: 'zh-CN' } }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); viewport.mobile = false; });
describe('收藏动态', () => {
    it('只读取实际收藏的更新，默认展示动态内容', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { container } = render(<QueryClientProvider client={client}><PlatformLibraryNews games={[{ id: 'betrayal', titleKey: '山屋惊魂', thumbnail: <img src="/cover.webp" alt="游戏封面"/> } as GameConfig]} /></QueryClientProvider>);
        await waitFor(() => expect(screen.getByText('真实更新')).toBeTruthy());
        expect(load).toHaveBeenCalledTimes(1);
        expect(load.mock.calls[0][0]).toBe('betrayal');
        expect(screen.getByRole('button', { name: '收藏游戏动态' }).getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('.platform-library-news-card img')).toBeTruthy();
        expect(screen.queryByText('改进规则说明')).toBeNull();
        HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
        HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
        fireEvent.click(container.querySelector('.platform-library-news-card')!);
        expect(screen.getByText('改进规则说明')).toBeTruthy();
        expect(document.body.style.overflow).toBe('hidden');
        fireEvent.click(screen.getByRole('button', { name: '关闭动态详情' }));
        expect(screen.queryByText('改进规则说明')).toBeNull();
        expect(document.body.style.overflow).not.toBe('hidden');
    });
    it('多条动态用封面横向轨道，方向按钮滚动且可收起', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { container } = render(<QueryClientProvider client={client}><PlatformLibraryNews games={[
            { id: 'betrayal', titleKey: '山屋惊魂', thumbnail: <img src="/a.webp" alt="封面"/> },
            { id: 'smashup', titleKey: '大杀四方', thumbnail: <img src="/b.webp" alt="封面"/> },
        ] as GameConfig[]} /></QueryClientProvider>);
        await waitFor(() => expect(container.querySelectorAll('.platform-library-news-card').length).toBe(2));
        const rail = container.querySelector('.platform-library-news-track') as HTMLDivElement;
        rail.scrollBy = vi.fn();
        fireEvent.click(screen.getByRole('button', { name: '下一条动态' }));
        expect(rail.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) }));
        fireEvent.click(screen.getByRole('button', { name: '收藏游戏动态' }));
        expect(container.querySelector('.platform-library-news-track')).toBeNull();
    });
    it('打开旧动态后新更新加入轨道，不会把详情自动关闭', async () => {
        const client = new QueryClient();
        const initial = Array.from({ length: 6 }, (_, i) => ({ id: `item-${i}`, gameId: 'betrayal', title: `更新${i}`, content: `正文${i}`, published: true, pinned: false, createdAt: `2026-10-${16-i}`, updatedAt: `2026-10-${16-i}` }));
        client.setQueryData(['game-changelogs', 'betrayal'], initial);
        const { container } = render(<QueryClientProvider client={client}><PlatformLibraryNews games={[{ id: 'betrayal', titleKey: '山屋惊魂' } as GameConfig]} /></QueryClientProvider>);
        HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
        HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
        expect(container.querySelectorAll('.platform-library-news-card')).toHaveLength(1);
        fireEvent.click(container.querySelector('.platform-library-news-card')!);
        await act(async () => { client.setQueryData(['game-changelogs', 'betrayal'], [{ ...initial[0], id: 'new', title: '最新更新', createdAt: '2026-10-19', updatedAt: '2026-10-19' }, ...initial]); });
        await waitFor(() => expect(screen.getByText('最新更新')).toBeTruthy());
        expect(screen.getByText('正文0')).toBeTruthy();
        expect(container.querySelector('dialog')?.open).toBe(true);
    });
    it('手机默认折叠，展开后才占用动态卡片空间', async () => {
        viewport.mobile = true;
        const client = new QueryClient();
        const {container} = render(<QueryClientProvider client={client}><PlatformLibraryNews games={[{id:'betrayal',titleKey:'山屋惊魂'} as GameConfig]}/></QueryClientProvider>);
        expect(screen.getByRole('button',{name:'收藏游戏动态'}).getAttribute('aria-expanded')).toBe('false');
        expect(container.querySelector('.platform-library-news-track')).toBeNull();
        fireEvent.click(screen.getByRole('button',{name:'收藏游戏动态'}));
        await waitFor(() => expect(screen.getByText('真实更新')).toBeTruthy());
    });
    it('标题已经含游戏名时不再叠一行同名归属', () => {
        const client = new QueryClient();
        client.setQueryData(['game-changelogs','betrayal'],[{id:'one',title:'山屋惊魂新版角色调整',content:'说明',createdAt:'2026-10-19',updatedAt:'2026-10-19'}]);
        const {container}=render(<QueryClientProvider client={client}><PlatformLibraryNews games={[{id:'betrayal',titleKey:'山屋惊魂'} as GameConfig]}/></QueryClientProvider>);
        expect(container.querySelectorAll('.platform-library-news-caption > span')).toHaveLength(0);
        expect(screen.getByText('山屋惊魂新版角色调整')).toBeTruthy();
        HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
        HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
        fireEvent.click(container.querySelector('.platform-library-news-card')!);
        expect(container.querySelector('.platform-news-dialog header small')).toBeNull();
        expect(screen.getByRole('heading',{name:'山屋惊魂新版角色调整'})).toBeTruthy();
    });
    it('空收藏不伪造动态，也不发更新请求', () => {
        const client = new QueryClient();
        const { container } = render(<QueryClientProvider client={client}><PlatformLibraryNews games={[]} /></QueryClientProvider>);
        expect(container.textContent).toBe(''); expect(load).not.toHaveBeenCalled();
    });
});
