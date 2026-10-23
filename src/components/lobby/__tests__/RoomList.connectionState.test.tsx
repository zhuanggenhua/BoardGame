// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { RoomList } from '../RoomList';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it('连接失败不是空大厅或无限加载，提供明确重试入口', () => {
    const retry = vi.fn();
    render(<RoomList roomItems={[]} isLobbyLoading connectionError onRetryConnection={retry}
        showPrimaryActions={false} activeMatch={null} isActionLoading={false}
        onJoinRoom={vi.fn()} onJoinRequest={vi.fn()} onAction={vi.fn()}
        onForceExitLocal={vi.fn()} onOpenCreateRoom={vi.fn()} onSpectate={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('error.serviceUnavailable.title');
    expect(screen.queryByText('rooms.loading')).toBeNull();
    expect(screen.queryByText('rooms.empty')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'platform.retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
});
