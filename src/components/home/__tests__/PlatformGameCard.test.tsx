// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
    });
    afterEach(() => {
        pointer.coarse = false;
        pointer.mobile = false;
    });

    it('介绍叠在封面内，不出现侧边悬浮预览', () => {
        const open = vi.fn();
        render(<PlatformGameCard game={game} mode="discover" favorite={false} favoritePending={false} onOpen={open} onFavorite={() => {}} />);
        const card = document.querySelector('.platform-game-card')!;
        expect(card.querySelector('.platform-game-hover-preview')).toBeNull();
        expect(card.querySelector('.platform-game-copy')?.textContent).toContain('甲游戏');
        const veil = card.querySelector('.platform-game-veil');
        expect(veil?.textContent).toContain('甲游戏');
        expect(veil?.textContent).toContain('甲规则介绍');
        expect(veil?.textContent).toContain('2-4人');
        expect(open).not.toHaveBeenCalled();
    });

    it('桌面收藏是封面星标，无可见文字', () => {
        const open = vi.fn();
        const favorite = vi.fn();
        render(<PlatformGameCard game={game} mode="discover" favorite={false} favoritePending={false} onOpen={open} onFavorite={favorite} />);
        const star = screen.getByRole('button', { name: '收藏：甲游戏' });
        expect(star.textContent).toBe('');
        expect(star.querySelector('.platform-game-favorite-label')).toBeNull();
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
        expect(card.querySelector('.platform-game-hover-preview')).toBeNull();
        expect(screen.queryByRole('button', { name: '收藏：甲游戏' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '甲游戏' }));
        expect(open).toHaveBeenCalledWith('one');
    });
});
