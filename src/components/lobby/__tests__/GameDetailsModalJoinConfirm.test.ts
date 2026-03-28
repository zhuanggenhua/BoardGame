/* @vitest-environment happy-dom */
import { createElement, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLocalMatchSearchParams, resolveSeatControllersFromSearchParams } from '../../../engine/ai';
import { GameDetailsModal } from '../GameDetailsModal';
import { AiSupportPills } from '../AiSupportPills';
import { resolveActiveMatchExitPayload, shouldPromptExitActiveMatch } from '../roomActions';
import { RoomList } from '../RoomList';

const navigateMock = vi.fn();
const openModalMock = vi.fn();
const closeModalMock = vi.fn();
const toastMock = {
    warning: vi.fn(),
    error: vi.fn(),
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => navigateMock,
}));

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
        token: null,
    }),
}));

vi.mock('../../../contexts/ModalStackContext', () => ({
    useModalStack: () => ({
        openModal: openModalMock,
        closeModal: closeModalMock,
    }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
    useToast: () => toastMock,
}));

vi.mock('../../../config/server', () => ({
    GAME_SERVER_URL: 'http://test.example',
}));

vi.mock('../../../config/games.config', () => ({
    getGameById: (gameId: string) => {
        if (gameId !== 'dicethrone') return null;
        return {
            id: 'dicethrone',
            type: 'game',
            enabled: true,
            titleKey: 'games.dicethrone.title',
            descriptionKey: 'games.dicethrone.description',
            category: 'dice',
            playersKey: 'games.dicethrone.players',
            icon: '🎲',
            allowLocalMode: true,
            playerOptions: [2],
            ai: {
                capture: true,
                localAi: true,
                remoteAi: true,
            },
        };
    },
}));

vi.mock('../../../services/lobbySocket', () => ({
    lobbySocket: {
        subscribe: vi.fn((_gameId: string, callback: (matches: unknown[]) => void) => {
            callback([]);
            return () => {};
        }),
        subscribeStatus: vi.fn(() => () => {}),
        requestRefresh: vi.fn(),
    },
}));

vi.mock('../../../hooks/match/useMatchStatus', () => ({
    claimSeat: vi.fn(),
    exitMatch: vi.fn(),
    getOwnerActiveMatch: vi.fn(() => null),
    setOwnerActiveMatch: vi.fn(),
    clearOwnerActiveMatch: vi.fn(),
    isOwnerActiveMatchSuppressed: vi.fn(() => false),
    suppressOwnerActiveMatch: vi.fn(),
    clearMatchCredentials: vi.fn(),
    readStoredMatchCredentials: vi.fn(() => null),
    listStoredMatchCredentials: vi.fn(() => []),
    getLatestStoredMatchCredentials: vi.fn(() => null),
    pruneStoredMatchCredentials: vi.fn(),
    persistMatchCredentials: vi.fn(),
}));

vi.mock('../../../hooks/match/ownerIdentity', () => ({
    getOrCreateGuestId: () => 'guest-1',
    getGuestName: () => 'Guest',
    getOwnerKey: () => 'owner-1',
    getOwnerType: () => 'guest',
}));

vi.mock('../../common/overlays/ConfirmModal', () => ({
    ConfirmModal: () => null,
}));

vi.mock('../../common/overlays/ModalBase', () => ({
    ModalBase: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));

vi.mock('../CreateRoomModal', () => ({
    CreateRoomModal: () => null,
}));

vi.mock('../../common/overlays/PasswordEntryModal', () => ({
    PasswordEntryModal: () => null,
}));

vi.mock('../LeaderboardTab', () => ({
    LeaderboardTab: () => createElement('div', null, 'leaderboard'),
}));

vi.mock('../GameDetailsChangelogSection', () => ({
    GameDetailsChangelogSection: () => createElement('div', null, 'changelog'),
}));

vi.mock('../../review/GameReviewSection', () => ({
    GameReviews: () => createElement('div', null, 'reviews'),
}));

const buildStored = (override: Partial<{ matchID: string; playerID: string; credentials: string; gameName: string }> = {}) => ({
    matchID: 'match-1',
    playerID: '1',
    credentials: 'creds',
    gameName: 'tictactoe',
    ...override,
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

beforeEach(() => {
    navigateMock.mockReset();
    openModalMock.mockReset();
    closeModalMock.mockReset();
    toastMock.warning.mockReset();
    toastMock.error.mockReset();
});

describe('GameDetailsModal join confirm helpers', () => {
    it('有活跃对局且目标不同则提示退出当前对局', () => {
        expect(shouldPromptExitActiveMatch('match-1', 'match-2')).toBe(true);
    });

    it('相同房间不提示退出当前对局', () => {
        expect(shouldPromptExitActiveMatch('match-1', 'match-1')).toBe(false);
    });

    it('缺少凭证时不返回退出参数', () => {
        const stored = buildStored({ credentials: '' });
        const result = resolveActiveMatchExitPayload('match-1', stored, null, 'dicethrone');
        expect(result).toBeNull();
    });

    it('有完整凭证时返回标准退出参数', () => {
        const stored = buildStored({ gameName: 'SmashUp', playerID: '0' });
        const result = resolveActiveMatchExitPayload('match-1', stored, null, 'dicethrone');
        expect(result).toEqual({
            gameName: 'smashup',
            playerID: '0',
            credentials: 'creds',
        });
    });

    it('缺少游戏名时回退到 ownerActive 或 fallbackGameName', () => {
        const stored = buildStored({ gameName: '' });
        const result = resolveActiveMatchExitPayload(
            'match-1',
            stored,
            { matchID: 'match-1', gameName: 'SummonerWars' },
            'dicethrone',
        );
        expect(result?.gameName).toBe('summonerwars');
    });
});

describe('AI seat controller helpers', () => {
    const aiSupport = {
        capture: true,
        localAi: true,
        remoteAi: true,
    };

    it('双人本地 AI 游戏默认让 seat1 使用 local-ai', () => {
        const searchParams = new URLSearchParams();
        const controllers = resolveSeatControllersFromSearchParams({
            numPlayers: 2,
            searchParams,
            aiSupport,
        });

        expect(controllers['0']).toEqual({ type: 'human' });
        expect(controllers['1']).toEqual({ type: 'local-ai' });
    });

    it('显式 seat 参数可以覆盖默认 controller', () => {
        const searchParams = new URLSearchParams('seat1=human');
        const controllers = resolveSeatControllersFromSearchParams({
            numPlayers: 2,
            searchParams,
            aiSupport,
        });

        expect(controllers['1']).toEqual({ type: 'human' });
    });

    it('buildLocalMatchSearchParams 会输出玩家数和 controller 参数', () => {
        const search = buildLocalMatchSearchParams({
            numPlayers: 3,
            playerOptions: [2, 3, 4],
            aiSupport,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'opening-v1' },
                '2': { type: 'remote-ai', providerId: 'astrbot' },
            },
        });

        expect(search.get('players')).toBe('3');
        expect(search.get('seat1')).toBe('local-ai:opening-v1');
        expect(search.get('seat2')).toBe('remote-ai:astrbot');
    });
});

describe('AiSupportPills', () => {
    it('只渲染已启用的 AI 能力标签', () => {
        render(createElement(AiSupportPills, {
            ai: {
                capture: true,
                localAi: true,
                remoteAi: false,
            },
        }));

        expect(screen.getByText('ai.capture')).toBeInTheDocument();
        expect(screen.getByText('ai.local')).toBeInTheDocument();
        expect(screen.queryByText('ai.remote')).toBeNull();
    });
});

describe('GameDetailsModal local AI entry', () => {
    const baseProps = {
        isOpen: true,
        onClose: vi.fn(),
        gameId: 'dicethrone',
        titleKey: 'games.dicethrone.title',
        descriptionKey: 'games.dicethrone.description',
        thumbnail: createElement('div'),
    };

    it('支持 AI 的游戏会区分单机模式和对战AI入口', () => {
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.singleDevice'));

        expect(navigateMock).toHaveBeenCalledWith('/play/dicethrone/local?seat1=human');
    });

    it('对战AI入口会直接进入本地 AI 对局', () => {
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.playAi'));

        expect(navigateMock).toHaveBeenCalledWith('/play/dicethrone/local');
    });
});

describe('RoomList lobby loading state', () => {
    const baseProps = {
        roomItems: [],
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

    it('首帧加载期间显示 loading 而不是空状态', () => {
        render(createElement(RoomList, { ...baseProps, isLobbyLoading: true }));

        expect(screen.getByText('rooms.loading')).toBeInTheDocument();
        expect(screen.queryByText('rooms.empty')).toBeNull();
    });

    it('加载完成后空列表显示暂无房间', () => {
        render(createElement(RoomList, baseProps));

        expect(screen.getByText('rooms.empty')).toBeInTheDocument();
        expect(screen.queryByText('rooms.loading')).toBeNull();
    });
});
