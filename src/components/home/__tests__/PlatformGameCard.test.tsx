// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformGameCard } from '../PlatformGameCard';

const pointer = vi.hoisted(() => ({ coarse: false, mobile: false }));
vi.mock('../../../hooks/ui/useCoarsePointer', () => ({ useCoarsePointer: () => pointer.coarse }));
vi.mock('../../../hooks/ui/useMobileViewport', () => ({ useMobileViewport: () => pointer.mobile }));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, number | string>) => {
            if (key === 'homeV2.gamePresence.online') return `在线 ${options?.count ?? 0}`;
            if (key === 'homeV2.gamePresence.waiting') return `等待 ${options?.count ?? 0}`;
            if (key === 'homeV2.gamePresence.label') return `在线 ${options?.online ?? 0}，等待 ${options?.waiting ?? 0}`;
            if (key === 'platform.externalGamePage.externalGame') return '外部游戏';
            if (key === 'platform.addFavorite') return `收藏：${options?.game ?? ''}`;
            if (key === 'platform.removeFavorite') return `移出收藏：${options?.game ?? ''}`;
            return key;
        },
    }),
}));

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

    it('收到空大厅快照后仍显示零在线和零等待', () => {
        render(<PlatformGameCard game={game} mode="discover" favorite={false} favoritePending={false} onOpen={() => {}} onFavorite={() => {}} hasPlayerCounts />);
        const presence = document.querySelector('.platform-game-presence');
        expect(presence).not.toBeNull();
        expect(presence?.children).toHaveLength(2);
        expect(presence?.textContent).toContain('0');
        expect(presence?.parentElement?.querySelector('strong')?.textContent).toBe('甲游戏');
    });

    it('外部游戏不把未知人数显示为零，而是标明外部游戏', () => {
        render(<PlatformGameCard game={{ ...game, id: 'external-test' }} mode="discover" favorite={false} favoritePending={false} onOpen={() => {}} onFavorite={() => {}} hasPlayerCounts />);
        expect(document.querySelector('.platform-game-presence')?.textContent).toBe('外部游戏');
        expect(screen.queryByLabelText(/在线/)).toBeNull();
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
