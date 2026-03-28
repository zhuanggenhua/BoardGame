/* @vitest-environment happy-dom */
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Home } from '../Home';
import { MaintenancePage } from '../Maintenance';
import {
    detectBrowserCompatibility,
    readBrowserCompatibilityBypass,
    writeBrowserCompatibilityBypass,
} from '../../lib/browserCompatibility';

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
let mockAuthToken: string | null = null;

let hasStoredMatch = true;
let lobbyPresenceState = {
    matches: [] as Array<{ matchID: string; gameName: string; players: unknown[] }>,
    hasSnapshot: true,
    hasSeen: true,
    exists: true,
    isMissing: false,
};
let lobbyStatsValue = {
    matches: [] as Array<{ matchID: string; gameName: string; roomName?: string; players: Array<{ id: number; name?: string; isConnected?: boolean }> }>,
    mostPopularGameId: undefined as string | undefined,
    hasSnapshot: true,
};

const storedMatch = {
    matchID: 'match-1',
    playerID: '0',
    credentials: 'cred-1',
    gameName: 'tictactoe',
    playerName: 'Alice',
};

const originalCss = globalThis.CSS;
const originalUserAgent = navigator.userAgent;

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
        token: mockAuthToken,
        logout: mockLogout,
    }),
}));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
        token: mockAuthToken,
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
    useLobbyStats: () => lobbyStatsValue,
}));

vi.mock('@/hooks/useLobbyStats', () => ({
    useLobbyStats: () => lobbyStatsValue,
}));

vi.mock('@/services/lobbySocket', () => ({
    lobbySocket: {
        subscribeStatus: (callback: (status: { connected: boolean }) => void) => {
            callback({ connected: true });
            return () => undefined;
        },
        getConnectionStatus: () => ({ connected: true, reconnectAttempts: 0 }),
    },
}));

vi.mock('../../services/lobbySocket', () => ({
    lobbySocket: {
        subscribeStatus: (callback: (status: { connected: boolean }) => void) => {
            callback({ connected: true });
            return () => undefined;
        },
        getConnectionStatus: () => ({ connected: true, reconnectAttempts: 0 }),
    },
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

describe('SystemHealthPage', () => {
    beforeEach(() => {
        cleanup();
        mockAuthToken = 'admin-token';
        lobbyStatsValue = {
            matches: [
                {
                    matchID: 'room-alpha',
                    gameName: 'smashup',
                    roomName: 'Alpha 房',
                    players: [
                        { id: 0, name: 'Alice', isConnected: true },
                        { id: 1, name: 'Bob', isConnected: false },
                    ],
                },
                {
                    matchID: 'room-beta',
                    gameName: 'smashup',
                    roomName: 'Beta 房',
                    players: [
                        { id: 0, name: 'Carol', isConnected: true },
                    ],
                },
            ],
            mostPopularGameId: 'smashup',
            hasSnapshot: true,
        };

        vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
            const url = typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url;
            if (url.includes('/admin/stats')) {
                return {
                    ok: true,
                    json: async () => ({
                        totalUsers: 99,
                        totalMatches: 200,
                        todayMatches: 12,
                        bannedUsers: 3,
                    }),
                } as Response;
            }
            if (url.includes('/admin/rooms?page=1&limit=1')) {
                return {
                    ok: true,
                    json: async () => ({ total: 7 }),
                } as Response;
            }
            throw new Error(`unexpected fetch: ${url}`);
        }));
    });

    afterEach(() => {
        mockAuthToken = null;
        vi.unstubAllGlobals();
        cleanup();
    });

    it('renders realtime room player online states grouped by game', async () => {
        const { default: SystemHealthPage } = await import('../admin/SystemHealth');

        render(<SystemHealthPage />);

        expect(await screen.findByText('系统健康监控')).toBeTruthy();
        expect(await screen.findByText('Alpha 房')).toBeTruthy();
        expect(screen.getByText('Beta 房')).toBeTruthy();
        expect(screen.getByText('Alice')).toBeTruthy();
        expect(screen.getByText('Bob')).toBeTruthy();
        expect(screen.getAllByText('在线').length).toBeGreaterThan(0);
        expect(screen.getAllByText('离线').length).toBeGreaterThan(0);
        expect(screen.getByText('持久化房间')).toBeTruthy();
    });
});

describe('browser compatibility detection', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        Object.defineProperty(navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 (Linux; Android 14; Redmi) AppleWebKit/537.36 Chrome/109.0.0.0 Mobile Safari/537.36 MiuiBrowser/18.2.1',
        });
        Object.defineProperty(globalThis, 'CSS', {
            configurable: true,
            value: {
                supports: vi.fn((property: string, value: string) => {
                    if (property === 'color' && value.startsWith('oklch(')) return false;
                    if (property === 'translate' && value === '1px') return false;
                    return true;
                }),
                registerProperty: undefined,
            },
        });
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'userAgent', {
            configurable: true,
            value: originalUserAgent,
        });
        Object.defineProperty(globalThis, 'CSS', {
            configurable: true,
            value: originalCss,
        });
        window.sessionStorage.clear();
    });

    it('detects missing CSS features and parses browser identity', () => {
        const report = detectBrowserCompatibility();

        expect(report.isCompatible).toBe(false);
        expect(report.browserName).toBe('Chrome');
        expect(report.browserVersion).toBe('109.0.0.0');
        expect(report.reasons).toEqual([
            'css-oklch',
            'css-translate',
            'css-register-property',
        ]);
    });

    it('supports bypassing the compatibility gate for the current session', () => {
        expect(readBrowserCompatibilityBypass()).toBe(false);

        writeBrowserCompatibilityBypass(true);
        expect(readBrowserCompatibilityBypass()).toBe(true);

        writeBrowserCompatibilityBypass(false);
        expect(readBrowserCompatibilityBypass()).toBe(false);
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

    it('optional namespace 缺失时不阻塞 UGC 页面', async () => {
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
    it('优先使用 turnOrder/currentPlayerIndex，其次 currentPlayer/currentPlayerId', async () => {
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
