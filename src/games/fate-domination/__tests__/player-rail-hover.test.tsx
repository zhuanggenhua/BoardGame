import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { FatePlayerRail } from '../ui/FatePlayerRail';

vi.mock('../../../components/common/media/OptimizedImage', () => ({ OptimizedImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt}/> }));
vi.mock('../../../components/common/media/CardPreview', () => ({ CardPreview: ({ title }: { title: string }) => <span>{title}</span> }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

function mount() {
    const core = createReplayAdapter(FateDominationDomain, 'avatar-hover').setup(['0', '1', '2']).core;
    core.players['1'].publicView = {
        power: 3, handCount: 2, deckCount: 15, discardCount: 0, skillCards: [], playedSkills: [],
        playedCards: [{ id: 'public', definitionId: 'cardB1' }, { id: 'secret', definitionId: 'hidden' }],
    };
    const inspect = vi.fn();
    function Harness() {
        const [selected, setSelected] = useState<string | null>(null);
        return <FatePlayerRail core={core} viewerId="0" selectedId={selected} nameFor={id => `玩家${id}`} onSelect={setSelected} onDetail={vi.fn()} onInspect={inspect}/>;
    }
    const view = render(<Harness/>);
    return { core, refresh: () => view.rerender(<Harness/>), inspect, avatar: screen.getByRole('button', { name: '查看玩家1详情' }) };
}

it('对手公开合计威力无需悬浮或打开详情即可比较，并随正式投影更新', () => {
    const { core, refresh } = mount();
    const power = screen.getByLabelText('玩家1合计威力');
    expect(power).toHaveTextContent('威力3');
    expect(screen.queryByLabelText('玩家1已打出')).toBeNull();
    core.players['1'].publicView!.power = 8;
    refresh();
    expect(screen.getByLabelText('玩家1合计威力')).toHaveTextContent('威力8');
});

it('头像移到牌排途中有宽限，悬浮牌排暂停收起，点击可放大，移开后收起', () => {
    vi.useFakeTimers();
    const { avatar, inspect } = mount();
    fireEvent.pointerEnter(avatar);
    const row = screen.getByLabelText('玩家1已打出');
    fireEvent.pointerLeave(avatar.closest('section')!);
    act(() => vi.advanceTimersByTime(2000));
    expect(row).toBeInTheDocument();
    fireEvent.pointerEnter(row);
    act(() => vi.advanceTimersByTime(4000));
    const card = within(row).getByRole('button');
    fireEvent.click(card);
    expect(inspect).toHaveBeenCalledOnce();
    expect(within(row).getByAltText('暗置攻击牌')).toBeInTheDocument();
    expect(within(row).getAllByRole('button')).toHaveLength(1);
    fireEvent.pointerLeave(row);
    act(() => vi.advanceTimersByTime(2500));
    expect(screen.queryByLabelText('玩家1已打出')).toBeNull();
});

it('移到另一头像取消旧收起计时，键盘进入牌排同样保持展开', () => {
    vi.useFakeTimers();
    const { avatar } = mount();
    fireEvent.pointerEnter(avatar);
    fireEvent.pointerLeave(avatar.closest('section')!);
    fireEvent.focus(screen.getByRole('button', { name: '查看玩家2详情' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByLabelText('玩家2已打出')).toBeInTheDocument();
    expect(screen.queryByLabelText('玩家1已打出')).toBeNull();
    fireEvent.keyDown(screen.getByLabelText('玩家2已打出'), { key: 'Escape' });
    expect(screen.queryByLabelText('玩家2已打出')).toBeNull();
});
