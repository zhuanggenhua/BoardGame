// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassicHomeSurface } from '../ClassicHomeSurface';

vi.mock('../../lobby/GameList', () => ({ GameList: ({ games, onGameClick }: { games: { id: string; titleKey: string }[]; onGameClick: (id: string) => void }) => <>{games.map(game => <button key={game.id} onClick={() => onGameClick(game.id)}>{game.titleKey}</button>)}</> }));
vi.mock('../../layout/CategoryPills', () => ({ CategoryPills: () => <nav>分类</nav> }));

describe('经典大厅目录', () => {
    it('保持原大厅的分类和游戏入口，不增加搜索或发现收藏导航', () => {
        const open = vi.fn();
        render(<ClassicHomeSurface activeCategory="All" onCategoryChange={vi.fn()} activeMatch={null} brand="大厅" subtitle="游戏" utility={null}
            games={[{ id: 'kept', titleKey: '保留游戏' }, { id: 'other', titleKey: '其它游戏' }] as never} onGameClick={open} />);
        expect(screen.queryByRole('searchbox')).toBeNull();
        expect(screen.queryByRole('button', { name: '发现' })).toBeNull();
        expect(screen.queryByRole('button', { name: '收藏库' })).toBeNull();
        expect(screen.getByRole('button', { name: '其它游戏' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '保留游戏' }));
        expect(open).toHaveBeenCalledWith('kept');
    });
});
