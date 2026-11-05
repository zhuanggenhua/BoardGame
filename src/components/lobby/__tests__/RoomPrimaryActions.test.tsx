// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RoomPrimaryActions } from '../RoomPrimaryActions';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
const match = { matchID: 'room-1', gameName: 'betrayal', canReconnect: true, myPlayerID: '0', myCredentials: 'fixture', isHost: true };
function props() { return { compact: true, activeMatch: match, isActionLoading: false, onJoinRoom: vi.fn(), onAction: vi.fn(), onForceExitLocal: vi.fn(), onOpenCreateRoom: vi.fn() }; }
it('紧凑布局保留回房与房主操作，省略重复通知', () => {
    const p = props(); render(<RoomPrimaryActions {...p}/>);
    expect(screen.queryByText('activeMatch.notice')).toBeNull();
    fireEvent.click(screen.getByText('activeMatch.return'));
    expect(p.onJoinRoom).toHaveBeenCalledWith('room-1', 'betrayal');
    const danger = screen.getByText('actions.destroy');
    expect(danger.getAttribute('data-action-tone')).toBe('danger');
    fireEvent.click(danger); expect(p.onAction).toHaveBeenCalledWith('room-1', '0', 'fixture', true);
});
it('非房主离开保留玩家身份且使用警告语义', () => {
    const p = props(); render(<RoomPrimaryActions {...p} activeMatch={{ ...match, isHost: false, myPlayerID: '1' }}/>);
    const leave = screen.getByText('actions.leave'); expect(leave.getAttribute('data-action-tone')).toBe('warning');
    fireEvent.click(leave); expect(p.onAction).toHaveBeenCalledWith('room-1', '1', 'fixture', false);
});
it('失去重连凭据时只清理本地记录', () => {
    const p = props(); render(<RoomPrimaryActions {...p} activeMatch={{ ...match, canReconnect: false, myCredentials: null }}/>);
    fireEvent.click(screen.getByText('actions.forceExit')); expect(p.onForceExitLocal).toHaveBeenCalledWith('room-1');
    expect(p.onAction).not.toHaveBeenCalled();
});
it('没有对局时仍创建房间，旧布局继续显示通知', () => {
    const p = props(); const { rerender } = render(<RoomPrimaryActions {...p} activeMatch={null}/>);
    fireEvent.click(screen.getByText('actions.createRoom')); expect(p.onOpenCreateRoom).toHaveBeenCalledOnce();
    rerender(<RoomPrimaryActions {...p} compact={false}/>); expect(screen.getByText('activeMatch.notice')).toBeTruthy();
});
