/* @vitest-environment happy-dom */
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RoomList } from '../RoomList';
import type { GameManifestEntry } from '../../../shared/gameManifest.types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            if (key === 'rooms.enabledExpansions') return '扩展';
            if (key === 'rooms.scenario') return '剧本';
            if (key === 'rooms.scenarioPending') return '未定剧本';
            if (key === 'rooms.empty') return '暂无活跃房间';
            if (key === 'rooms.emptySlot') return '空位';
            if (key === 'setup.scenario.firstScenario') return '赤红杰克归来';
            if (key === 'rooms.seatSeparator') return ' / ';
            if (key === 'setup.expansions.titans') return '泰坦';
            if (key === 'setup.expansions.diy') return 'DIY';
            if (key === 'setup.deckQuery.label') return '余牌查询';
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

const smashUpManifest = {
    id: 'smashup',
    type: 'game',
    enabled: true,
    titleKey: 'games.smashup.title',
    descriptionKey: 'games.smashup.description',
    category: 'card',
    playersKey: 'games.smashup.players',
    icon: 'SU',
    setupOptions: {
        expansions: {
            type: 'multi-select',
            labelKey: 'games.smashup.setup.expansions.label',
            options: [
                { value: 'titans', labelKey: 'games.smashup.setup.expansions.titans' },
                { value: 'deckQuery', labelKey: 'games.smashup.setup.deckQuery.label' },
                { value: 'diy', labelKey: 'games.smashup.setup.expansions.diy' },
            ],
        },
    },
} satisfies GameManifestEntry;

const betrayalManifest = {
    id: 'betrayal',
    type: 'game',
    enabled: true,
    titleKey: 'games.betrayal.title',
    descriptionKey: 'games.betrayal.description',
    category: 'card',
    playersKey: 'games.betrayal.players',
    icon: '屋',
    publicRoomSetupSummary: {
        scenario: {
            options: {
                'first-scenario': { labelKey: 'setup.scenario.firstScenario' },
            },
            pendingLabel: {
                labelKey: 'rooms.scenarioPending',
                namespace: 'lobby',
                defaultValue: '未定剧本',
            },
        },
    },
} satisfies GameManifestEntry;

describe('RoomList 扩展摘要', () => {
    it('房间卡片展示已开启扩展，并保留完整展示名', () => {
        render(createElement(RoomList, {
            ...baseProps,
            gameManifest: smashUpManifest,
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
                        enabledExpansions: ['titans', 'deckQuery', 'diy'],
                    },
                },
            ],
        }));

        expect(screen.getByText('扩展')).toBeInTheDocument();
        expect(screen.getByTestId('room-expansion-tag-room-1-titans')).toHaveTextContent('泰坦');
        expect(screen.getByTestId('room-expansion-tag-room-1-diy')).toHaveTextContent('DIY');
        expect(screen.getByTestId('room-expansion-tag-room-1-deckQuery')).toHaveTextContent('余牌查询');
    });

    it('山屋惊魂房间展示当前剧本或未定剧本', () => {
        render(createElement(RoomList, {
            ...baseProps,
            gameManifest: betrayalManifest,
            gameTranslationNamespace: 'game-betrayal',
            roomItems: [
                {
                    matchID: 'room-selected',
                    players: [
                        { id: 0, name: '房主' },
                        { id: 1 },
                        { id: 2 },
                    ],
                    totalSeats: 3,
                    gameName: 'betrayal',
                    roomName: '已选剧本房间',
                    isFull: false,
                    isEmptyRoom: false,
                    playerCount: 1,
                    isMyRoom: false,
                    isOwnerRoom: false,
                    canReconnect: false,
                    myPlayerID: null,
                    myCredentials: null,
                    isHost: false,
                    gameKey: 'betrayal',
                    publicSetupSummary: {
                        scenarioId: 'first-scenario',
                    },
                },
                {
                    matchID: 'room-pending',
                    players: [
                        { id: 0, name: '房主' },
                        { id: 1 },
                        { id: 2 },
                    ],
                    totalSeats: 3,
                    gameName: 'betrayal',
                    roomName: '未定剧本房间',
                    isFull: false,
                    isEmptyRoom: false,
                    playerCount: 1,
                    isMyRoom: false,
                    isOwnerRoom: false,
                    canReconnect: false,
                    myPlayerID: null,
                    myCredentials: null,
                    isHost: false,
                    gameKey: 'betrayal',
                    publicSetupSummary: {},
                },
            ],
        }));

        expect(screen.getAllByText('剧本')).toHaveLength(2);
        expect(screen.getByTestId('room-scenario-tag-room-selected')).toHaveTextContent('赤红杰克归来');
        expect(screen.getByTestId('room-scenario-tag-room-pending')).toHaveTextContent('未定剧本');
    });
});
