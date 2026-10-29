// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformGameCard } from '../PlatformGameCard';

const pointer = vi.hoisted(() => ({ coarse: false, mobile: false }));
vi.mock('../../../hooks/ui/useCoarsePointer', () => ({ useCoarsePointer: () => pointer.coarse }));
vi.mock('../../../hooks/ui/useMobileViewport', () => ({ useMobileViewport: () => pointer.mobile }));

const game = {
    id: 'one',
    titleKey: '甲游戏',
    descriptionKey: '甲规则介绍',
    thumbnail: <span>甲封面</span>,
    playersKey: '2-4人',
    category: 'abstract' as const,
};

describe('现代首页卡片悬浮与触控收藏入口', () => {
    beforeEach(() => {
        pointer.coarse = false;
        pointer.mobile = false;
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('细指针悬浮后封面旁出现标题、背景图和游戏信息，移开后恢复', () => {
        const open = vi.fn();
        render(<PlatformGameCard game={game} mode="discover" favorite={false} favoritePending={false} onOpen={open} onFavorite={() => {}} />);
        const card = document.querySelector('.platform-game-card')!;
        expect(card.querySelector('.platform-game-hover-preview')).toBeNull();
        expect(card.querySelector('.platform-game-description')).toBeNull();
        expect(card.querySelector('.platform-game-veil')).toBeNull();
        fireEvent.mouseEnter(card);
        expect(card.querySelector('.platform-game-hover-preview')).toBeNull();
        act(() => { vi.advanceTimersByTime(160); });
        const preview = card.querySelector('.platform-game-hover-preview');
        expect(preview).toBeTruthy();
        expect(preview?.textContent).toContain('甲游戏');
        expect(preview?.textContent).toContain('甲规则介绍');
        expect(preview?.textContent).toContain('2-4人');
        expect(preview?.querySelector('.platform-game-hover-preview-art')?.textContent).toContain('甲封面');
        expect(preview?.querySelector('.platform-game-hover-preview-art img')).toBeNull();
        fireEvent.mouseLeave(card);
        expect(card.querySelector('.platform-game-hover-preview')).toBeNull();
        expect(open).not.toHaveBeenCalled();
    });

    it('桌面收藏沿用经典文案，仅悬浮出现，点击不打开详情', () => {
        const open = vi.fn();
        const favorite = vi.fn();
        render(<PlatformGameCard game={game} mode="discover" favorite={false} favoritePending={false} onOpen={open} onFavorite={favorite} />);
        const star = screen.getByRole('button', { name: '收藏：甲游戏' });
        expect(star.textContent).toContain('收藏');
        fireEvent.click(star);
        expect(favorite).toHaveBeenCalledWith('one', true);
        expect(open).not.toHaveBeenCalled();
    });

    it('触屏不渲染卡片收藏和侧边预览，点按直接打开', () => {
        pointer.coarse = true;
        pointer.mobile = true;
        const open = vi.fn();
        render(<PlatformGameCard game={game} mode="discover" favorite={false} favoritePending={false} onOpen={open} onFavorite={() => {}} />);
        const card = document.querySelector('.platform-game-card')!;
        fireEvent.mouseEnter(card);
        act(() => { vi.advanceTimersByTime(400); });
        expect(card.querySelector('.platform-game-hover-preview')).toBeNull();
        expect(screen.queryByRole('button', { name: '收藏：甲游戏' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '甲游戏' }));
        expect(open).toHaveBeenCalledWith('one');
    });
});
