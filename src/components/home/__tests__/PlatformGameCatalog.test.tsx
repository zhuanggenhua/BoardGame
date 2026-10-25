// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameConfig } from '../../../config/games.config';
import { PlatformGameCatalog } from '../PlatformGameCatalog';
vi.mock('../../../hooks/ui/useCoarsePointer', () => ({ useCoarsePointer: () => true }));
const games = [
    { id: 'one', titleKey: '甲游戏', descriptionKey: '甲规则介绍', thumbnail: <span>甲封面</span> },
    { id: 'two', titleKey: '乙游戏', descriptionKey: '乙规则介绍', thumbnail: <span>乙封面</span> },
] as GameConfig[];
describe('真实游戏目录的发现与收藏入口', () => {
    it('标题搜索与分类由同一个目录头承接，搜索仍能过滤游戏', () => {
        render(<PlatformGameCatalog heading="发现" filters={<button>全部游戏</button>} games={games}
            favoriteIds={new Set()} mode="discover" onOpen={() => {}} onFavorite={() => {}} />);
        const header = screen.getByRole('heading', { name: '发现' }).closest('.platform-catalog-header');
        expect(header?.contains(screen.getByRole('searchbox'))).toBe(true);
        expect(header?.contains(screen.getByRole('button', { name: '全部游戏' }))).toBe(true);
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: '甲' } });
        expect(screen.queryByRole('button', { name: '乙游戏' })).toBeNull();
    });
    it('触控首次点按直接进入详情，不出现中间预览；收藏不触发进入', () => {
        const open = vi.fn(); const favorite = vi.fn();
        render(<PlatformGameCatalog games={games} favoriteIds={new Set()} mode="discover" onOpen={open} onFavorite={favorite} />);
        fireEvent.click(screen.getByRole('button', { name: '甲游戏' }));
        expect(open).toHaveBeenCalledOnce();
        expect(open).toHaveBeenCalledWith('one');
        expect(screen.queryByText('查看房间')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '收藏：甲游戏' }));
        expect(favorite).toHaveBeenCalledWith('one', true);
        expect(open).toHaveBeenCalledOnce();
    });
    it('收藏只显示实际收藏，单击进入，搜索空结果可清除恢复', () => {
        const open = vi.fn();
        render(<PlatformGameCatalog games={games} favoriteIds={new Set(['two'])} mode="library" onOpen={open} onFavorite={() => {}} />);
        expect(screen.queryByRole('button', { name: '甲游戏' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '乙游戏' }));
        expect(open).toHaveBeenCalledWith('two');
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: '不存在' } });
        expect(screen.queryByRole('button', { name: '乙游戏' })).toBeNull();
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
        expect(screen.getByRole('button', { name: '乙游戏' })).toBeTruthy();
    });
});
