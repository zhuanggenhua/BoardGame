/* @vitest-environment happy-dom */
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RoomList } from '../RoomList';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            if (key === 'rooms.enabledExpansions') return '扩展';
            if (key === 'rooms.empty') return '暂无活跃房间';
            if (key === 'rooms.emptySlot') return '空位';
            if (key === 'rooms.seatSeparator') return ' / ';
            if (key === 'setup.expansions.titans') return '泰坦';
            if (key === 'setup.expansions.diy') return 'DIY';
            return key;
        },
    }),
}));

const baseProps = {
    activeMatch: null,
    isActionLoading: false,
    isLobbyLoading: false,
    onJoinRoom: vi.fn(),
    onJoinRequest: vi.fn(),
    onAction: vi.fn(),
    onForceExitLocal: vi.fn(),
    onOpenCreateRoom: vi.fn(),
    onSpectate: vi.fn(),
};

describe('RoomList 扩展摘要', () => {
    it('房间卡片展示已开启扩展，并保留完整展示名', () => {
        render(createElement(RoomList, {
            ...baseProps,
            gameTranslationNamespace: 'game-smashup',
            roomItems: [
                {
                    matchID: 'room-1',
                    players: [
                        { id: 0, name: '房主' },
                        { id: 1 },
                    ],
                    totalSeats: 2,
                    gameName: 'smashup',
                    roomName: '测试房间',
                    isFull: false,
                    isEmptyRoom: false,
                    playerCount: 1,
                    isMyRoom: false,
                    isOwnerRoom: false,
                    canReconnect: false,
                    myPlayerID: null,
                    myCredentials: null,
                    isHost: false,
                    gameKey: 'smashup',
                    publicSetupSummary: {
                        enabledExpansions: ['titans', 'diy'],
                    },
                },
            ],
        }));

        expect(screen.getByText('扩展')).toBeInTheDocument();
        expect(screen.getByTestId('room-expansion-tag-room-1-titans')).toHaveTextContent('泰坦');
        expect(screen.getByTestId('room-expansion-tag-room-1-diy')).toHaveTextContent('DIY');
    });
});
