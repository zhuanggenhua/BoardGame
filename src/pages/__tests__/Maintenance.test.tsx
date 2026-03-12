/* @vitest-environment happy-dom */
import { cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Home } from '../Home';
import { MaintenancePage } from '../Maintenance';

const mockLoggerError = vi.fn();
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
const mockLogout = vi.fn();
const mockOpenModal = vi.fn(() => 'modal-1');
const mockCloseModal = vi.fn();
const mockToastWarning = vi.fn();
const mockToastError = vi.fn();
const mockGetMatch = vi.fn();
const mockClearMatchCredentials = vi.fn();
const mockClearOwnerActiveMatch = vi.fn();
const mockPublishMatchCleanupNotice = vi.fn(() => ({
    matchID: 'match-1',
    reason: 'destroyed' as const,
    timestamp: 1,
    nonce: 'notice-1',
}));
const mockHasSeenMatchCleanupNotice = vi.fn(() => false);
const mockMarkMatchCleanupNoticeSeen = vi.fn();
const mockReadMatchCleanupNotice = vi.fn(() => null);
const mockGetLatestStoredMatchCredentials = vi.fn();
const mockReadStoredMatchCredentials = vi.fn();
const mockValidateStoredMatchSeat = vi.fn(() => ({ shouldClear: false }));
const mockGetOwnerActiveMatch = vi.fn(() => null);
const mockPruneStoredMatchCredentials = vi.fn();

let hasStoredMatch = true;
let lobbyPresenceState = {
    matches: [] as Array<{ matchID: string; gameName: string; players: unknown[] }>,
    hasSnapshot: true,
    hasSeen: true,
    exists: true,
    isMissing: false,
};

const storedMatch = {
    matchID: 'match-1',
    playerID: '0',
    credentials: 'cred-1',
    gameName: 'tictactoe',
    playerName: 'Alice',
};

vi.mock('../../lib/logger', () => ({
    logger: {
        error: (...args: unknown[]) => mockLoggerError(...args),
    },
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
}));

vi.mock('../../components/layout/CategoryPills', () => ({
    CategoryPills: () => null,
}));

vi.mock('../../components/lobby/GameDetailsModal', () => ({
    GameDetailsModal: () => null,
}));

vi.mock('../../components/lobby/GameList', () => ({
    GameList: () => null,
}));

vi.mock('../../config/games.config', () => ({
    getGamesByCategory: () => [],
    getGameById: () => null,
    refreshUgcGames: vi.fn(async () => undefined),
    subscribeGameRegistry: vi.fn(() => () => undefined),
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
        token: null,
        logout: mockLogout,
    }),
}));

vi.mock('../../components/auth/AuthModal', () => ({
    AuthModal: () => null,
}));

vi.mock('../../hooks/match/ownerIdentity', () => ({
    getOrCreateGuestId: () => 'guest-1',
    getGuestName: () => 'Guest',
    getOwnerKey: () => 'guest:guest-1',
}));

vi.mock('../../components/common/overlays/ConfirmModal', () => ({
    ConfirmModal: () => null,
}));

vi.mock('../../components/common/i18n/LanguageSwitcher', () => ({
    LanguageSwitcher: () => null,
}));

vi.mock('../../components/social/UserMenu', () => ({
    UserMenu: () => null,
}));

vi.mock('../../contexts/ModalStackContext', () => ({
    useModalStack: () => ({
        openModal: mockOpenModal,
        closeModal: mockCloseModal,
    }),
}));

vi.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({
        warning: mockToastWarning,
        error: mockToastError,
    }),
}));

vi.mock('../../hooks/routing/useUrlModal', () => ({
    useUrlModal: () => ({
        navigateAwayRef: { current: vi.fn() },
    }),
}));

vi.mock('../../components/common/SEO', () => ({
    SEO: () => null,
}));

vi.mock('../../hooks/useLobbyStats', () => ({
    useLobbyStats: () => ({ mostPopularGameId: undefined }),
}));

vi.mock('../../hooks/useLobbyMatchPresence', () => ({
    useLobbyMatchPresence: () => lobbyPresenceState,
}));

vi.mock('../../core/cursor/useGlobalCursor', () => ({
    useGlobalCursor: () => undefined,
}));

vi.mock('../../services/matchApi', () => ({
    getMatch: (...args: unknown[]) => mockGetMatch(...args),
}));

vi.mock('../../hooks/match/useMatchStatus', () => ({
    claimSeat: vi.fn(),
    clearMatchCredentials: (...args: unknown[]) => mockClearMatchCredentials(...args),
    exitMatch: vi.fn(),
    getOwnerActiveMatch: () => mockGetOwnerActiveMatch(),
    clearOwnerActiveMatch: (...args: unknown[]) => mockClearOwnerActiveMatch(...args),
    publishMatchCleanupNotice: (...args: unknown[]) => mockPublishMatchCleanupNotice(...args),
    readMatchCleanupNotice: () => mockReadMatchCleanupNotice(),
    hasSeenMatchCleanupNotice: (...args: unknown[]) => mockHasSeenMatchCleanupNotice(...args),
    markMatchCleanupNoticeSeen: (...args: unknown[]) => mockMarkMatchCleanupNoticeSeen(...args),
    isOwnerActiveMatchSuppressed: () => false,
    isMatchNotFoundError: (err: unknown) => {
        const status = typeof err === 'object' && err !== null && 'status' in err
            ? (err as { status?: unknown }).status
            : undefined;
        return status === 404 || String(err).includes('404');
    },
    rejoinMatch: vi.fn(),
    getLatestStoredMatchCredentials: () => mockGetLatestStoredMatchCredentials(),
    pruneStoredMatchCredentials: () => mockPruneStoredMatchCredentials(),
    readStoredMatchCredentials: (...args: unknown[]) => mockReadStoredMatchCredentials(...args),
    validateStoredMatchSeat: (...args: unknown[]) => mockValidateStoredMatchSeat(...args),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('Maintenance Page', () => {
    it('should export a valid React component', () => {
        expect(MaintenancePage).toBeDefined();
        expect(typeof MaintenancePage).toBe('function');
    });

    it('should keep the expected function name', () => {
        expect(MaintenancePage.name).toBe('MaintenancePage');
    });
});

describe('useGameNamespaceReady', () => {
    beforeEach(() => {
        mockLoggerError.mockReset();
    });

    it('切换语言后会重新触发游戏 namespace 加载', async () => {
        const { useGameNamespaceReady } = await import('../../hooks/useGameNamespaceReady');
        const loadedNamespaces = new Set<string>();
        const i18n = {
            language: 'zh-CN',
            resolvedLanguage: 'zh-CN',
            hasLoadedNamespace: vi.fn((namespace: string) => {
                const language = i18n.resolvedLanguage ?? i18n.language;
                return loadedNamespaces.has(`${language}:${namespace}`);
            }),
            loadNamespaces: vi.fn(async (namespace: string) => {
                const language = i18n.resolvedLanguage ?? i18n.language;
                if (language === 'zh-CN') {
                    throw new Error('zh namespace failed');
                }
                loadedNamespaces.add(`${language}:${namespace}`);
            }),
        };

        const { result, rerender } = renderHook(
            ({ gameId, instance }) => useGameNamespaceReady(gameId, instance as never),
            {
                initialProps: {
                    gameId: 'smashup',
                    instance: i18n,
                },
            },
        );

        await waitFor(() => {
            expect(result.current.gameNamespaceError).toBe('zh namespace failed');
        });

        i18n.language = 'en';
        i18n.resolvedLanguage = 'en';
        rerender({
            gameId: 'smashup',
            instance: i18n,
        });

        await waitFor(() => {
            expect(result.current.isGameNamespaceReady).toBe(true);
        });

        expect(result.current.gameNamespaceError).toBeNull();
        expect(i18n.loadNamespaces).toHaveBeenCalledTimes(2);
        expect(mockLoggerError).toHaveBeenCalledTimes(1);
    });

    it('optional namespace ??????? UGC ????', async () => {
        const { useGameNamespaceReady } = await import('../../hooks/useGameNamespaceReady');
        const i18n = {
            language: 'zh-CN',
            resolvedLanguage: 'zh-CN',
            hasLoadedNamespace: vi.fn(() => false),
            loadNamespaces: vi.fn(async () => {
                throw new Error('missing ugc namespace');
            }),
        };

        const { result } = renderHook(
            ({ gameId, instance }) => useGameNamespaceReady(gameId, instance as never, { required: false }),
            {
                initialProps: {
                    gameId: 'ugc-package-1',
                    instance: i18n,
                },
            },
        );

        expect(result.current.isGameNamespaceReady).toBe(true);
        expect(result.current.gameNamespaceError).toBeNull();
        expect(i18n.loadNamespaces).not.toHaveBeenCalled();
        expect(mockLoggerError).not.toHaveBeenCalled();
    });
});

describe('resolveFollowCurrentTurnPlayerId', () => {
    it('?? currentPlayer/currentPlayerId ? turnOrder/currentPlayerIndex', async () => {
        const { resolveFollowCurrentTurnPlayerId } = await import('../../engine/transport/followCurrentTurnPlayer');

        expect(resolveFollowCurrentTurnPlayerId({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            currentPlayer: '0',
        })).toBe('1');
        expect(resolveFollowCurrentTurnPlayerId({ currentPlayer: '1' })).toBe('1');
        expect(resolveFollowCurrentTurnPlayerId({ currentPlayerId: '2' })).toBe('2');
        expect(resolveFollowCurrentTurnPlayerId({})).toBeNull();
    });
});

describe('Home missing match confirmation', () => {
    beforeEach(() => {
        cleanup();
        hasStoredMatch = true;
        lobbyPresenceState = {
            matches: [{ matchID: 'match-1', gameName: 'tictactoe', players: [] }],
            hasSnapshot: true,
            hasSeen: true,
            exists: true,
            isMissing: false,
        };

        mockNavigate.mockClear();
        mockSetSearchParams.mockClear();
        mockLogout.mockClear();
        mockOpenModal.mockClear();
        mockCloseModal.mockClear();
        mockToastWarning.mockClear();
        mockToastError.mockClear();
        mockGetMatch.mockReset();
        mockClearMatchCredentials.mockReset();
        mockClearOwnerActiveMatch.mockReset();
        mockPublishMatchCleanupNotice.mockClear();
        mockHasSeenMatchCleanupNotice.mockClear();
        mockMarkMatchCleanupNoticeSeen.mockClear();
        mockReadMatchCleanupNotice.mockClear();
        mockGetOwnerActiveMatch.mockClear();
        mockPruneStoredMatchCredentials.mockClear();
        mockValidateStoredMatchSeat.mockClear();

        mockGetLatestStoredMatchCredentials.mockImplementation(() => (hasStoredMatch ? storedMatch : null));
        mockReadStoredMatchCredentials.mockImplementation(() => (hasStoredMatch ? storedMatch : null));
        mockClearMatchCredentials.mockImplementation(() => {
            hasStoredMatch = false;
        });

        window.localStorage.clear();
        window.sessionStorage.clear();
    });

    afterEach(() => {
        cleanup();
    });

    it('grace-period success will release the confirmation lock and recheck on the next lobby snapshot', async () => {
        mockGetMatch
            .mockResolvedValueOnce({
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockResolvedValueOnce({
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockRejectedValueOnce({ status: 404, message: 'Match not found' });

        const view = render(<Home />);

        await waitFor(() => {
            expect(mockGetMatch).toHaveBeenCalledTimes(1);
        });

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [],
            exists: false,
            isMissing: true,
        };
        view.rerender(<Home />);

        await waitFor(() => {
            expect(mockGetMatch).toHaveBeenCalledTimes(2);
        });

        expect(mockClearMatchCredentials).not.toHaveBeenCalled();

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [{ matchID: 'match-1', gameName: 'tictactoe', players: [] }],
            exists: true,
            isMissing: false,
        };
        view.rerender(<Home />);

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [],
            exists: false,
            isMissing: true,
        };
        view.rerender(<Home />);

        await waitFor(() => {
            expect(mockGetMatch).toHaveBeenCalledTimes(3);
        });

        await waitFor(() => {
            expect(mockClearMatchCredentials).toHaveBeenCalledWith('match-1');
            expect(mockClearOwnerActiveMatch).toHaveBeenCalledWith('match-1');
        });

        expect(mockPublishMatchCleanupNotice).toHaveBeenCalledWith('match-1');
        expect(mockMarkMatchCleanupNoticeSeen).toHaveBeenCalled();
        expect(mockToastWarning).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' });
    });

    it('缺失确认请求在重渲染时被取消后，应释放锁并允许后续请求继续确认', async () => {
        let rejectMissingCheck!: (reason?: unknown) => void;
        const pendingMissingCheck = new Promise((_, reject) => {
            rejectMissingCheck = reject;
        });

        mockGetMatch
            .mockResolvedValueOnce({
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockImplementationOnce(() => pendingMissingCheck)
            .mockRejectedValueOnce({ status: 404, message: 'Match not found' });

        const view = render(<Home />);

        await waitFor(() => {
            expect(mockGetMatch).toHaveBeenCalledTimes(1);
        });

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [],
            exists: false,
            isMissing: true,
        };
        view.rerender(<Home />);

        await waitFor(() => {
            expect(mockGetMatch).toHaveBeenCalledTimes(2);
        });

        view.rerender(<Home />);
        expect(mockGetMatch).toHaveBeenCalledTimes(2);

        rejectMissingCheck({ status: 404, message: 'Match not found' });

        await waitFor(() => {
            expect(mockClearMatchCredentials).toHaveBeenCalledWith('match-1');
            expect(mockClearOwnerActiveMatch).toHaveBeenCalledWith('match-1');
        });

        expect(mockPublishMatchCleanupNotice).toHaveBeenCalledWith('match-1');
        expect(mockMarkMatchCleanupNoticeSeen).toHaveBeenCalled();
        expect(mockToastWarning).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' });
    });
});
