import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { FateDominationBoard } from '../Board';

const endgameActions = vi.hoisted(() => ({ vote: vi.fn(), registerReset: vi.fn(), exit: vi.fn() }));
// This suite verifies gameover/reset wiring, not requestAnimationFrame-driven exit timing.
vi.mock('framer-motion', async (importOriginal) => ({
    ...await importOriginal<typeof import('framer-motion')>(),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../../contexts/RematchContext', () => ({ useRematch: () => ({ state: { votes: {}, ready: false, revision: 0 }, vote: endgameActions.vote, registerReset: endgameActions.registerReset }) }));
vi.mock('../../../contexts/MatchRoomExitContext', () => ({ useMatchRoomExit: () => ({ exitToLobby: endgameActions.exit }) }));
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ warning: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'zh-CN' } }) }));
vi.mock('../../../contexts/UndoContext', () => ({ UndoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../../hooks/ui/useDeferredRender', () => ({ useDeferredRender: (active: boolean) => active }));
vi.mock('../../../components/common/animations', () => ({ VictoryParticles: () => null }));
vi.mock('../../../components/common/media/OptimizedImage', () => ({ OptimizedImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt}/> }));
vi.mock('../ui/FateMapSurface', () => ({ FateMapSurface: () => <div/> }));

it('正式sys终局显示赢家和战果，重赛入口调用reset；只有core中间结果不能打开终局', async () => {
    const initial = createReplayAdapter(FateDominationDomain, 'fate-endgame-ui').setup(['0', '1', '2']);
    initial.core.phase = 'complete';
    initial.core.round = 11;
    initial.core.gameResult = { winner: '1', scores: { '0': 8, '1': 12, '2': 4 } };
    const reset = vi.fn();
    const props = { G: initial, playerID: null, isMultiplayer: false, dispatch: vi.fn(), reset, matchData: [{ id: 0, name: '甲' }, { id: 1, name: '乙' }, { id: 2, name: '丙' }] };
    const view = render(<MemoryRouter><FateDominationBoard {...(props as never)}/></MemoryRouter>);
    expect(screen.queryByTestId('endgame-overlay')).toBeNull();
    const completed = structuredClone(initial);
    completed.sys.gameover = initial.core.gameResult;
    view.rerender(<MemoryRouter><FateDominationBoard {...({ ...props, G: completed } as never)}/></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('endgame-overlay')).toBeTruthy());
    expect(screen.getByRole('heading', { name: '乙赢得圣杯战争' })).toBeTruthy();
    expect(screen.getByLabelText('乙战果').textContent).toContain('12');
    fireEvent.click(screen.getByTestId('rematch-play-again'));
    expect(reset).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId('rematch-back-to-lobby'));
    expect(endgameActions.exit).toHaveBeenCalledOnce();
    const restarted = createReplayAdapter(FateDominationDomain, 'fate-endgame-restart').setup(['0', '1', '2']);
    view.rerender(<MemoryRouter><FateDominationBoard {...({ ...props, G: restarted } as never)}/></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('endgame-overlay')).toBeNull());
});

it('正式无人获胜的终局不能误显示平局或某席位获胜', async () => {
    const G = createReplayAdapter(FateDominationDomain, 'fate-all-defeated-ui').setup(['0', '1', '2']);
    G.core.phase = 'complete'; G.core.round = 11;
    G.sys.gameover = { winners: [], draw: false, scores: { '0': 10, '1': 10, '2': 4 } };
    render(<MemoryRouter><FateDominationBoard {...({ G, playerID: null, isMultiplayer: false, dispatch: vi.fn(), reset: vi.fn() } as never)}/></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: '所有御主败北' })).toBeTruthy());
});

it('多人终局投票沿共享重赛owner，不直接重置本机', async () => {
    const G = createReplayAdapter(FateDominationDomain, 'fate-online-endgame').setup(['0', '1', '2']);
    G.core.phase = 'complete'; G.sys.gameover = { winner: '0', scores: { '0': 12, '1': 9, '2': 3 } };
    const reset = vi.fn();
    render(<MemoryRouter><FateDominationBoard {...({ G, playerID: '0', isMultiplayer: true, dispatch: vi.fn(), reset } as never)}/></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('rematch-vote')).toBeTruthy());
    fireEvent.click(screen.getByTestId('rematch-vote'));
    expect(endgameActions.vote).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
});
