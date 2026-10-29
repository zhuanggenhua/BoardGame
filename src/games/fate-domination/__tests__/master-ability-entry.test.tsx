import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { FateDominationBoard } from '../Board';
vi.mock('../../../contexts/RematchContext', () => ({ useRematch: () => ({ state: { votes: {}, ready: false, revision: 0 }, vote: vi.fn(), registerReset: vi.fn() }) }));

vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ warning: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'zh-CN' } }) }));
vi.mock('../../../contexts/UndoContext', () => ({ UndoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../../components/common/media/OptimizedImage', () => ({ OptimizedImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt}/> }));
vi.mock('../ui/FateMapSurface', () => ({
    FateMapSurface: ({ legalLocations, onLocation }: { legalLocations: string[]; onLocation: (id: string) => void }) =>
        <div>{legalLocations.map(id => <button key={id} onClick={() => onLocation(id)}>地点{id}</button>)}</div>,
}));

function setup(masterId: string) {
    const adapter = createReplayAdapter(FateDominationDomain, `master-entry-${masterId}`);
    let state = adapter.setup(['0', '1', '2']);
    state = adapter.execute(state, { type: 'SELECT_MASTER', playerId: '0', payload: { masterId } }).state;
    state = adapter.execute(state, { type: 'SELECT_MASTER', playerId: '1', payload: { masterId: 'm_waver' } }).state;
    for (const playerId of ['0', '1', '2'])
        state = adapter.execute(state, { type: 'ADVANCE_PHASE', playerId, payload: {} }).state;
    state.core.players['0'].mana = 0;
    state = adapter.execute(state, { type: 'DEPLOY_MASTER', playerId: '0', payload: { locationId: 'workshop' } }).state;
    return { adapter, state };
}

it('本人牌桌发动战略部署，角色详情保持只读且对手不提供操作', () => {
    const { adapter, state } = setup('m_waver');
    let live = state;
    const dispatch = vi.fn((type, payload) => {
        live = adapter.execute(live, { type, playerId: '0', payload }).state;
    });
    const props = { G: live, dispatch, playerID: '0', isMultiplayer: true, matchData: [] };
    const view = render(<FateDominationBoard {...(props as never)}/>);
    fireEvent.click(screen.getByRole('button', { name: '查看玩家 1详情' }));
    expect(screen.getByRole('dialog')).not.toHaveTextContent('当前威力');
    expect(within(screen.getByRole('dialog')).queryByRole('button',{name:/^发动/})).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '关闭玩家详情' }));
    const ability = screen.getByRole('button', { name: '发动战略部署' });
    const count = live.core.players['0'].hand.length;
    const mana = live.core.players['0'].mana;
    fireEvent.click(ability);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith('PLAY_SKILL', {
        skillId: state.core.players['0'].skills.find(skill => skill.name === '战略部署')!.id,
    });
    expect(live.core.players['0'].hand).toHaveLength(count + 2);
    expect(live.core.players['0'].mana).toBe(mana - 1);
    view.rerender(<FateDominationBoard {...({ ...props, G: live } as never)}/>);
    expect(screen.getByRole('button', { name: '发动战略部署' })).toHaveAttribute('aria-disabled','true');
    fireEvent.click(screen.getByRole('button', { name: '查看玩家 2详情' }));
    expect(state.core.players['1'].skills.some(skill => skill.name === '战略部署')).toBe(true);
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /^发动/ })).toBeNull();
});

it('监督者从牌桌能力进入目标选择，取消不扣费，选中后确认才提交移动', () => {
    const { state } = setup('m_kirei');
    state.core.phase = 'action';
    state.core.players['0'].mana = 8;
    state.core.currentEvents = { miyama: [], shinto: [] };
    for (const location of Object.values(state.core.battlefield)) location.eventCards = [];
    const dispatch = vi.fn();
    render(<FateDominationBoard {...({ G: state, dispatch, playerID: '0', isMultiplayer: true, matchData: [] } as never)}/>);
    const begin = () => {
        fireEvent.click(screen.getByRole('button', { name: '发动监督者' }));
    };
    begin();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '取消移动' }));
    expect(dispatch).not.toHaveBeenCalled();
    begin();
    fireEvent.click(screen.getByRole('button', { name: '地点recon' }));
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确认移动至侦察' }));
    expect(dispatch).toHaveBeenCalledExactlyOnceWith('PLAY_SKILL', {
        skillId: state.core.players['0'].skills.find(skill => skill.name === '监督者')!.id,
        targetLocationId: 'recon',
    });
});


it('淘汰标记来自权威玩家状态，本人、对手席位和详情不会混作未部署', () => {
    const {state} = setup('m_waver');
    state.core.players['0'].eliminated = true;
    state.core.players['0'].locationId = null;
    state.core.players['1'].eliminated = true;
    state.core.players['1'].locationId = null;
    state.core.currentPlayerId = '2';
    render(<FateDominationBoard {...({G: state, dispatch: vi.fn(), playerID: '0', isMultiplayer: true, matchData: []} as never)}/>);
    const self=screen.getByLabelText('本人席位'),peers=screen.getByLabelText('玩家席位');
    expect(self.querySelector('.fd-runtime-avatar > .fd-avatar-elimination')).toBeTruthy();
    expect(self.querySelector('[aria-description="已淘汰，观战中"]')).toBeTruthy();
    expect(peers.querySelector('[aria-description="已淘汰"] > .fd-avatar-elimination')).toBeTruthy();
    expect(screen.getByTestId('fate-domination-primary-action')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: '查看玩家 2详情'}));
    expect(within(screen.getByRole('dialog')).getByText('已淘汰')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).queryByText('未部署')).toBeNull();
});
