/* @vitest-environment happy-dom */
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Home } from '../Home';
import { MaintenancePage } from '../Maintenance';
import packageJson from '../../../package.json';
import {
    detectBrowserCompatibility,
    readBrowserCompatibilityBypass,
    writeBrowserCompatibilityBypass,
} from '../../lib/browserCompatibility';
import {
    MapContainer,
} from '../../games/summonerwars/ui/MapContainer';
import { shouldReserveSystemBackGesture } from '../../games/summonerwars/ui/mapContainerUtils';

const { nativeAndroidRuntimeState, androidLiveUpdateSnapshotState, androidLiveUpdateActivityState } = vi.hoisted(() => ({
    nativeAndroidRuntimeState: {
        value: false,
    },
    androidLiveUpdateSnapshotState: {
        value: {
            enabled: false,
            manifestUrl: '',
            channel: 'stable',
            nativeAndroid: false,
            updaterLoaded: false,
        },
    },
    androidLiveUpdateActivityState: {
        value: {
            active: false,
            phase: 'idle' as const,
        },
    },
}));

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
const mockRequestAndroidLiveUpdateCheck = vi.fn();
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
const currentAppVersionLabel = packageJson.version.replace(/^v/i, '').split('-')[0] || packageJson.version.replace(/^v/i, '');

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

vi.mock('../../lib/mobile/androidRuntime', () => ({
    isNativeAndroidRuntime: () => nativeAndroidRuntimeState.value,
    isAndroidShellBuildMode: () => false,
}));

vi.mock('../../lib/mobile/androidLiveUpdates', () => ({
    readAndroidLiveUpdateConfig: vi.fn(() => ({
        enabled: nativeAndroidRuntimeState.value,
        manifestUrl: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
        channel: 'stable',
        appReadyTimeoutMs: 10000,
    })),
    readAndroidLiveUpdateSnapshot: vi.fn(async () => androidLiveUpdateSnapshotState.value),
    readAndroidLiveUpdateActivityState: vi.fn(() => androidLiveUpdateActivityState.value),
    subscribeAndroidLiveUpdateActivityState: vi.fn((listener: (state: typeof androidLiveUpdateActivityState.value) => void) => {
        listener(androidLiveUpdateActivityState.value);
        return () => undefined;
    }),
    requestAndroidLiveUpdateCheck: (...args: unknown[]) => mockRequestAndroidLiveUpdateCheck(...args),
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

const translationMap: Record<string, string> = {
    'admin.systemHealth.title': '系统健康监控',
    'admin.systemHealth.description': '实时查看平台房间、玩家在线状态与后台核心指标。',
    'admin.systemHealth.socket.label': '大厅连接',
    'admin.systemHealth.socket.connected': '已连接',
    'admin.systemHealth.socket.online': '在线',
    'admin.systemHealth.socket.offline': '离线',
    'admin.systemHealth.realtime_players.title': '实时在线玩家',
    'admin.systemHealth.realtime_players.summary': '总入座 {{totalPlayers}} 人，分布在 {{activeRooms}} 个实时房间中',
    'admin.systemHealth.today_matches.title': '今日对局数',
    'admin.systemHealth.today_matches.total': '总对局：{{count}}',
    'admin.systemHealth.active_rooms.title': '实时房间（含游客）',
    'admin.systemHealth.room_distribution.title': '实时房间分布（含游客）',
    'admin.systemHealth.room_distribution.group_room_count': '{{count}} 个实时房间',
    'admin.systemHealth.room_distribution.group_online': '{{connected}}/{{total}} 在线',
    'admin.systemHealth.room_distribution.room_online': '{{connected}}/{{total}} 在线',
    'admin.systemHealth.overview.title': '平台数据概览',
    'admin.systemHealth.overview.total_users': '总注册用户',
    'admin.systemHealth.overview.persisted_rooms': '持久化房间',
    'admin.systemHealth.overview.banned_users': '封禁用户',
    'admin.roomsPage.online.online': '在线',
    'admin.roomsPage.online.offline': '离线',
    'ota.footer.bundleLabel': '更新号 {{version}}',
    'ota.footer.appLabel': 'App {{version}}',
    'ota.footer.latestLabel': '最新更新 {{version}}',
    'ota.footer.mismatchUpdateNow': 'OTA 未对齐，点击立即更新',
    'ota.footer.checkNow': '检查更新',
    'ota.footer.currentBundleTitle': 'current update number {{version}}',
    'ota.footer.currentAppShellTitle': 'app version {{version}}',
    'ota.footer.latestOtaTitle': 'latest update number {{version}}',
    'ota.footer.statusMismatchUpdateNow': 'versions are not aligned',
    'ota.footer.statusCheckNow': 'check for updates now',
    'ota.footer.ariaBundleAndApp': 'current update number {{bundleVersion}}, app version {{appVersion}}',
    'ota.footer.ariaBundleAndAppMismatch': 'current update number {{bundleVersion}}, app version {{appVersion}}, latest update number {{latestVersion}}, versions are not aligned',
};

const mockAndroidLiveUpdatesModule = () => {
    vi.doMock('../../lib/mobile/androidLiveUpdates', () => ({
        readAndroidLiveUpdateConfig: vi.fn(() => ({
            enabled: nativeAndroidRuntimeState.value,
            manifestUrl: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            channel: 'stable',
            appReadyTimeoutMs: 10000,
        })),
        readAndroidLiveUpdateSnapshot: vi.fn(async () => androidLiveUpdateSnapshotState.value),
        readAndroidLiveUpdateActivityState: vi.fn(() => androidLiveUpdateActivityState.value),
        subscribeAndroidLiveUpdateActivityState: vi.fn((listener: (state: typeof androidLiveUpdateActivityState.value) => void) => {
            listener(androidLiveUpdateActivityState.value);
            return () => undefined;
        }),
        requestAndroidLiveUpdateCheck: (...args: unknown[]) => mockRequestAndroidLiveUpdateCheck(...args),
    }));
};

vi.mock('react-i18next', () => ({
    initReactI18next: {
        type: '3rdParty',
        init: () => undefined,
    },
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const template = translationMap[key] ?? key;
            return template.replace(/\{\{(\w+)\}\}/g, (_, optionKey: string) => String(options?.[optionKey] ?? ''));
        },
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
            if (url.includes('/admin-api/stats')) {
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
            if (url.includes('/admin-api/rooms?page=1&limit=1')) {
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

    it('keeps old Chrome browsers passable after gameplay fallback adaptation', () => {
        const report = detectBrowserCompatibility('/play/smashup');

        expect(report.isCompatible).toBe(true);
        expect(report.browserName).toBe('Chrome');
        expect(report.browserVersion).toBe('109.0.0.0');
        expect(report.reasons).toEqual([]);
    });

    it('allows lower browser versions when core capabilities are still available', () => {
        Object.defineProperty(navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/70.0.3538.77 Safari/537.36',
        });

        const report = detectBrowserCompatibility('/play/smashup');

        expect(report.isCompatible).toBe(true);
        expect(report.browserName).toBe('Chrome');
        expect(report.reasons).toEqual([]);
    });

    it('keeps gameplay routes passable when matchMedia is missing but fallback paths exist', () => {
        const originalMatchMedia = window.matchMedia;
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: undefined,
        });

        const report = detectBrowserCompatibility('/play/smashup');

        expect(report.isCompatible).toBe(true);
        expect(report.reasons).toEqual([]);

        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: originalMatchMedia,
        });
    });

    it('keeps games without ResizeObserver dependence passable when the API is missing', () => {
        const originalResizeObserver = globalThis.ResizeObserver;
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: undefined,
        });

        const report = detectBrowserCompatibility('/play/smashup');

        expect(report.isCompatible).toBe(true);
        expect(report.reasons).toEqual([]);

        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: originalResizeObserver,
        });
    });

    it('keeps summonerwars gameplay passable when ResizeObserver fallback is available', () => {
        const originalResizeObserver = globalThis.ResizeObserver;
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: undefined,
        });

        const report = detectBrowserCompatibility('/play/summonerwars');

        expect(report.isCompatible).toBe(true);
        expect(report.reasons).toEqual([]);

        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: originalResizeObserver,
        });
    });

    it('移除 UGC 入口后不再为旧 dev 路由额外拦截 ResizeObserver', () => {
        const originalResizeObserver = globalThis.ResizeObserver;
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: undefined,
        });

        const report = detectBrowserCompatibility('/dev/ugc');

        expect(report.isCompatible).toBe(true);
        expect(report.reasons).toEqual([]);

        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: originalResizeObserver,
        });
    });

    it('keeps summonerwars map container renderable when ResizeObserver is missing', () => {
        const originalResizeObserver = globalThis.ResizeObserver;
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: undefined,
        });

        render(
            <div style={{ width: '800px', height: '600px' }}>
                <MapContainer
                    containerTestId="sw-map-container-fallback"
                    contentTestId="sw-map-content-fallback"
                >
                    <div style={{ width: '1200px', height: '800px' }}>fallback map</div>
                </MapContainer>
            </div>,
        );

        expect(screen.getByTestId('sw-map-container-fallback')).toBeTruthy();
        expect(screen.getByTestId('sw-map-content-fallback')).toBeTruthy();

        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: originalResizeObserver,
        });
    });

    it('reserves the left and right screen edges for the Android system back gesture', () => {
        expect(shouldReserveSystemBackGesture({
            enabled: true,
            clientX: 12,
            viewportWidth: 360,
        })).toBe(true);

        expect(shouldReserveSystemBackGesture({
            enabled: true,
            clientX: 348,
            viewportWidth: 360,
        })).toBe(true);

        expect(shouldReserveSystemBackGesture({
            enabled: true,
            clientX: 180,
            viewportWidth: 360,
        })).toBe(false);

        expect(shouldReserveSystemBackGesture({
            enabled: false,
            clientX: 12,
            viewportWidth: 360,
        })).toBe(false);
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
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: false,
            status: 404,
            json: async () => ({}),
        } as Response)));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
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
            expect(result.current.gameNamespaceError).toContain('zh namespace failed');
            expect(result.current.gameNamespaceError).toContain('fallback: 游戏文案加载失败：game-smashup HTTP 404');
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

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current.isGameNamespaceReady).toBe(true);
        expect(result.current.gameNamespaceError).toBeNull();
        expect(i18n.loadNamespaces).not.toHaveBeenCalled();
        expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it('namespace 请求长期 pending 时会在重试后显式报超时', async () => {
        vi.useFakeTimers();
        try {
            const {
                GAME_NAMESPACE_LOAD_TIMEOUT_MS,
                GAME_NAMESPACE_AUTO_RETRY_DELAY_MS,
                useGameNamespaceReady,
            } = await import('../../hooks/useGameNamespaceReady');
            const i18n = {
                language: 'zh-CN',
                resolvedLanguage: 'zh-CN',
                hasLoadedNamespace: vi.fn(() => false),
                loadNamespaces: vi.fn(() => new Promise<void>(() => {})),
            };

            const { result } = renderHook(
                ({ gameId, instance }) => useGameNamespaceReady(gameId, instance as never),
                {
                    initialProps: {
                        gameId: 'smashup',
                        instance: i18n,
                    },
                },
            );

            await act(async () => {
                await vi.advanceTimersByTimeAsync(GAME_NAMESPACE_LOAD_TIMEOUT_MS);
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(GAME_NAMESPACE_AUTO_RETRY_DELAY_MS);
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(GAME_NAMESPACE_LOAD_TIMEOUT_MS);
                await Promise.resolve();
            });

            expect(result.current.gameNamespaceError).toContain('游戏文案加载超时');
            expect(result.current.isGameNamespaceReady).toBe(false);
            expect(mockLoggerError).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('useGameImplementationReady', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.doUnmock('../../games/registry');
        vi.resetModules();
    });

    it('加载失败后支持重试，并在成功后恢复 ready', async () => {
        const mockSubscribeGameImplementationReady = vi.fn(() => vi.fn());
        const mockGetGameImplementation = vi.fn(() => null);
        const mockHasGameTutorialLoader = vi.fn(() => false);
        const mockResolveGameTutorialManifest = vi.fn(() => null);
        const mockLoadGameImplementation = vi.fn()
            .mockRejectedValueOnce(new Error('游戏客户端模块加载超时：smashup（4000ms）'))
            .mockResolvedValueOnce({ engineConfig: {}, board: () => null });

        vi.doMock('../../games/registry', () => ({
            getGameImplementation: mockGetGameImplementation,
            hasGameTutorialLoader: mockHasGameTutorialLoader,
            loadGameImplementation: mockLoadGameImplementation,
            resolveGameTutorialManifest: mockResolveGameTutorialManifest,
            subscribeGameImplementationReady: mockSubscribeGameImplementationReady,
        }));

        const { useGameImplementationReady } = await import('../../games/useGameImplementationReady');
        const { result } = renderHook(() => useGameImplementationReady('smashup'));

        await waitFor(() => {
            expect(result.current.gameImplementationError).toContain('游戏客户端模块加载超时');
        });

        act(() => {
            result.current.retryGameImplementationLoad();
        });

        await waitFor(() => {
            expect(result.current.isGameImplementationReady).toBe(true);
        });

        expect(result.current.gameImplementationError).toBeNull();
        expect(mockLoadGameImplementation).toHaveBeenCalledTimes(2);
    });

    it('超时报错后如果模块稍后实际加载完成，会自动恢复 ready', async () => {
        let readyListener: ((gameId: string) => void) | null = null;
        let implementation: { engineConfig: object; board: () => null } | null = null;
        const mockSubscribeGameImplementationReady = vi.fn((listener: (gameId: string) => void) => {
            readyListener = listener;
            return () => {
                if (readyListener === listener) {
                    readyListener = null;
                }
            };
        });
        const mockGetGameImplementation = vi.fn(() => implementation);
        const mockHasGameTutorialLoader = vi.fn(() => false);
        const mockResolveGameTutorialManifest = vi.fn(() => null);
        const mockLoadGameImplementation = vi.fn()
            .mockRejectedValueOnce(new Error('游戏客户端模块加载超时：smashup（45000ms）'));

        vi.doMock('../../games/registry', () => ({
            getGameImplementation: mockGetGameImplementation,
            hasGameTutorialLoader: mockHasGameTutorialLoader,
            loadGameImplementation: mockLoadGameImplementation,
            resolveGameTutorialManifest: mockResolveGameTutorialManifest,
            subscribeGameImplementationReady: mockSubscribeGameImplementationReady,
        }));

        const { useGameImplementationReady } = await import('../../games/useGameImplementationReady');
        const { result } = renderHook(() => useGameImplementationReady('smashup'));

        await waitFor(() => {
            expect(result.current.gameImplementationError).toContain('游戏客户端模块加载超时');
        });

        act(() => {
            implementation = { engineConfig: {}, board: () => null };
            readyListener?.('smashup');
        });

        await waitFor(() => {
            expect(result.current.isGameImplementationReady).toBe(true);
        });

        expect(result.current.gameImplementationError).toBeNull();
        expect(mockLoadGameImplementation).toHaveBeenCalledTimes(1);
    });

    it('教程路由会要求实现层补拉 tutorial 模块', async () => {
        const mockSubscribeGameImplementationReady = vi.fn(() => vi.fn());
        const mockGetGameImplementation = vi.fn(() => null);
        const mockHasGameTutorialLoader = vi.fn(() => true);
        const mockResolveGameTutorialManifest = vi.fn(() => ({ id: 'smashup-basic', steps: [] }));
        const mockLoadGameImplementation = vi.fn()
            .mockResolvedValueOnce({ engineConfig: {}, board: () => null, tutorial: { id: 'smashup-basic', steps: [] } });

        vi.doMock('../../games/registry', () => ({
            getGameImplementation: mockGetGameImplementation,
            hasGameTutorialLoader: mockHasGameTutorialLoader,
            loadGameImplementation: mockLoadGameImplementation,
            resolveGameTutorialManifest: mockResolveGameTutorialManifest,
            subscribeGameImplementationReady: mockSubscribeGameImplementationReady,
        }));

        const { useGameImplementationReady } = await import('../../games/useGameImplementationReady');
        const { result } = renderHook(() => useGameImplementationReady('smashup', { includeTutorial: true }));

        await waitFor(() => {
            expect(result.current.isGameImplementationReady).toBe(true);
        });

        expect(mockLoadGameImplementation).toHaveBeenCalledWith('smashup', { includeTutorial: true });
    });

    it('教程路由收到 runtime ready 事件时不能在 tutorial 未加载前提前就绪', async () => {
        let readyListener: ((gameId: string) => void) | null = null;
        const implementationRef: {
            current: {
                engineConfig: object;
                board: () => null;
                tutorial?: { id: string; steps: never[] };
                tutorialCatalog?: { defaultTutorialId: string; tutorials: Record<string, { manifest: { id: string; steps: never[] } }> };
            } | null;
        } = {
            current: null,
        };
        const mockSubscribeGameImplementationReady = vi.fn((listener: (gameId: string) => void) => {
            readyListener = listener;
            return vi.fn();
        });
        const mockGetGameImplementation = vi.fn(() => implementationRef.current);
        const mockHasGameTutorialLoader = vi.fn(() => true);
        const mockResolveGameTutorialManifest = vi.fn((_: string, tutorialId?: string) => {
            if (!tutorialId) {
                return implementationRef.current?.tutorial ?? null;
            }
            return implementationRef.current?.tutorialCatalog?.tutorials?.[tutorialId]?.manifest ?? null;
        });
        const mockLoadGameImplementation = vi.fn(() => new Promise<typeof implementationRef.current>((resolve) => {
            window.setTimeout(() => {
                implementationRef.current = {
                    engineConfig: {},
                    board: () => null,
                    tutorial: { id: 'smashup-basic', steps: [] },
                };
                resolve(implementationRef.current);
            }, 50);
        }));

        vi.doMock('../../games/registry', () => ({
            getGameImplementation: mockGetGameImplementation,
            hasGameTutorialLoader: mockHasGameTutorialLoader,
            loadGameImplementation: mockLoadGameImplementation,
            resolveGameTutorialManifest: mockResolveGameTutorialManifest,
            subscribeGameImplementationReady: mockSubscribeGameImplementationReady,
        }));

        const { useGameImplementationReady } = await import('../../games/useGameImplementationReady');
        const { result } = renderHook(() => useGameImplementationReady('smashup', { includeTutorial: true }));

        await waitFor(() => {
            expect(mockLoadGameImplementation).toHaveBeenCalledWith('smashup', { includeTutorial: true });
        });

        act(() => {
            implementationRef.current = {
                engineConfig: {},
                board: () => null,
            };
            readyListener?.('smashup');
        });

        expect(result.current.isGameImplementationReady).toBe(false);

        await waitFor(() => {
            expect(result.current.isGameImplementationReady).toBe(true);
        });
    });

    it('子教程路由会按 tutorialId 等待指定 manifest 就绪', async () => {
        const tutorialCatalog = {
            defaultTutorialId: 'smashup-basic',
            tutorials: {
                'smashup-basic': { manifest: { id: 'smashup-basic', steps: [] } },
                'cowboys-duel': { manifest: { id: 'smashup-cowboys-duel', steps: [] } },
            },
        };
        const implementationRef: {
            current: {
                engineConfig: object;
                board: () => null;
                tutorial?: { id: string; steps: never[] };
                tutorialCatalog?: typeof tutorialCatalog;
            } | null;
        } = {
            current: null,
        };
        const mockSubscribeGameImplementationReady = vi.fn(() => vi.fn());
        const mockGetGameImplementation = vi.fn(() => implementationRef.current);
        const mockHasGameTutorialLoader = vi.fn(() => true);
        const mockResolveGameTutorialManifest = vi.fn((_: string, tutorialId?: string) => {
            if (!tutorialId) return implementationRef.current?.tutorial ?? null;
            return implementationRef.current?.tutorialCatalog?.tutorials[tutorialId as keyof typeof tutorialCatalog.tutorials]?.manifest ?? null;
        });
        const mockLoadGameImplementation = vi.fn().mockImplementationOnce(async () => {
            implementationRef.current = {
                engineConfig: {},
                board: () => null,
                tutorial: { id: 'smashup-basic', steps: [] },
                tutorialCatalog,
            };
            return implementationRef.current;
        });

        vi.doMock('../../games/registry', () => ({
            getGameImplementation: mockGetGameImplementation,
            hasGameTutorialLoader: mockHasGameTutorialLoader,
            loadGameImplementation: mockLoadGameImplementation,
            resolveGameTutorialManifest: mockResolveGameTutorialManifest,
            subscribeGameImplementationReady: mockSubscribeGameImplementationReady,
        }));

        const { useGameImplementationReady } = await import('../../games/useGameImplementationReady');
        const { result } = renderHook(() => useGameImplementationReady('smashup', {
            includeTutorial: true,
            tutorialId: 'cowboys-duel',
        }));

        await waitFor(() => {
            expect(result.current.isGameImplementationReady).toBe(true);
        });

        expect(result.current.gameImplementationError).toBeNull();
        expect(mockLoadGameImplementation).toHaveBeenCalledWith('smashup', { includeTutorial: true });
    });

    it('多章节教程目录路由只加载 tutorialCatalog 时也会就绪', async () => {
        const tutorialCatalog = {
            defaultTutorialId: 'smashup-basic',
            tutorials: {
                'smashup-basic': { manifest: { id: 'smashup-basic', steps: [] } },
                'cowboys-duel': { manifest: { id: 'smashup-cowboys-duel', steps: [] } },
            },
        };
        const implementation = {
            engineConfig: {},
            board: () => null,
            tutorialCatalog,
        };
        const mockSubscribeGameImplementationReady = vi.fn(() => vi.fn());
        const mockGetGameImplementation = vi.fn(() => implementation);
        const mockHasGameTutorialLoader = vi.fn(() => true);
        const mockResolveGameTutorialManifest = vi.fn((_: string, tutorialId?: string) => {
            if (!tutorialId) return null;
            return tutorialCatalog.tutorials[tutorialId as keyof typeof tutorialCatalog.tutorials]?.manifest ?? null;
        });
        const mockLoadGameImplementation = vi.fn().mockResolvedValueOnce(implementation);

        vi.doMock('../../games/registry', () => ({
            getGameImplementation: mockGetGameImplementation,
            hasGameTutorialLoader: mockHasGameTutorialLoader,
            loadGameImplementation: mockLoadGameImplementation,
            resolveGameTutorialManifest: mockResolveGameTutorialManifest,
            subscribeGameImplementationReady: mockSubscribeGameImplementationReady,
        }));

        const { useGameImplementationReady } = await import('../../games/useGameImplementationReady');
        const { result } = renderHook(() => useGameImplementationReady('smashup', {
            includeTutorial: true,
        }));

        await waitFor(() => {
            expect(result.current.isGameImplementationReady).toBe(true);
        });

        expect(result.current.gameImplementationError).toBeNull();
        expect(mockLoadGameImplementation).not.toHaveBeenCalled();
    });

    it('子教程不存在时返回明确错误，不静默回落到默认教程', async () => {
        const tutorialCatalog = {
            defaultTutorialId: 'smashup-basic',
            tutorials: {
                'smashup-basic': { manifest: { id: 'smashup-basic', steps: [] } },
            },
        };
        const implementation = {
            engineConfig: {},
            board: () => null,
            tutorial: { id: 'smashup-basic', steps: [] },
            tutorialCatalog,
        };
        const mockSubscribeGameImplementationReady = vi.fn(() => vi.fn());
        const mockGetGameImplementation = vi.fn(() => implementation);
        const mockHasGameTutorialLoader = vi.fn(() => true);
        const mockResolveGameTutorialManifest = vi.fn((_: string, tutorialId?: string) => {
            if (!tutorialId) return implementation.tutorial;
            return tutorialCatalog.tutorials[tutorialId as keyof typeof tutorialCatalog.tutorials]?.manifest ?? null;
        });
        const mockLoadGameImplementation = vi.fn().mockResolvedValueOnce(implementation);

        vi.doMock('../../games/registry', () => ({
            getGameImplementation: mockGetGameImplementation,
            hasGameTutorialLoader: mockHasGameTutorialLoader,
            loadGameImplementation: mockLoadGameImplementation,
            resolveGameTutorialManifest: mockResolveGameTutorialManifest,
            subscribeGameImplementationReady: mockSubscribeGameImplementationReady,
        }));

        const { useGameImplementationReady } = await import('../../games/useGameImplementationReady');
        const { result } = renderHook(() => useGameImplementationReady('smashup', {
            includeTutorial: true,
            tutorialId: 'missing-subtutorial',
        }));

        await waitFor(() => {
            expect(result.current.gameImplementationError).toContain('未找到教程：smashup/missing-subtutorial');
        });

        expect(result.current.isGameImplementationReady).toBe(false);
    });
});

describe('loadGameImplementation stale chunk recovery', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.doUnmock('../../games/manifest.client');
        vi.doUnmock('../../lib/staleChunkReloadGuard');
        vi.resetModules();
    });

    it('游戏 runtime 动态导入命中 stale chunk 时会触发一次页面刷新', async () => {
        const staleError = new Error('Failed to fetch dynamically imported module');
        const loadRuntime = vi.fn().mockRejectedValueOnce(staleError);
        const reloadForStaleChunkOnce = vi.fn(() => true);

        vi.doMock('../../games/manifest.client', () => ({
            GAME_CLIENT_MANIFEST: [
                {
                    manifest: {
                        id: 'smashup',
                        type: 'game',
                        enabled: true,
                    },
                    loadRuntime,
                },
            ],
        }));

        vi.doMock('../../lib/staleChunkReloadGuard', () => ({
            isStaleChunkError: (value: unknown) => value === staleError,
            reloadForStaleChunkOnce,
        }));

        const { loadGameImplementation } = await import('../../games/registry');

        await expect(loadGameImplementation('smashup')).rejects.toThrow('Failed to fetch dynamically imported module');

        expect(loadRuntime).toHaveBeenCalledTimes(1);
        expect(reloadForStaleChunkOnce).toHaveBeenCalledTimes(1);
        expect(reloadForStaleChunkOnce).toHaveBeenCalledWith('game-runtime-load-failed:smashup', window);
    });
});

describe('loadGameImplementation lazy tutorial loading', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.doUnmock('../../games/manifest.client');
        vi.resetModules();
    });

    it('普通对局先只加载 runtime，教程模式再补拉 tutorial', async () => {
        const loadRuntime = vi.fn().mockResolvedValue({
            engineConfig: {},
            board: () => null,
        });
        const loadTutorial = vi.fn().mockResolvedValue({
            id: 'smashup-basic',
            steps: [],
        });

        vi.doMock('../../games/manifest.client', () => ({
            GAME_CLIENT_MANIFEST: [
                {
                    manifest: {
                        id: 'smashup',
                        type: 'game',
                        enabled: true,
                    },
                    loadRuntime,
                    loadTutorial,
                },
            ],
        }));

        const { loadGameImplementation } = await import('../../games/registry');

        const runtimeOnly = await loadGameImplementation('smashup');
        expect(runtimeOnly?.tutorial).toBeUndefined();
        expect(loadRuntime).toHaveBeenCalledTimes(1);
        expect(loadTutorial).toHaveBeenCalledTimes(0);

        const withTutorial = await loadGameImplementation('smashup', { includeTutorial: true });
        expect(withTutorial?.tutorial).toEqual({ id: 'smashup-basic', steps: [] });
        expect(loadRuntime).toHaveBeenCalledTimes(1);
        expect(loadTutorial).toHaveBeenCalledTimes(1);
    });

    it('当教程模块返回目录结构时，会归一化出默认教程和 tutorialCatalog', async () => {
        const loadRuntime = vi.fn().mockResolvedValue({
            engineConfig: {},
            board: () => null,
        });
        const tutorialCatalog = {
            defaultTutorialId: 'smashup-basic',
            tutorials: {
                'smashup-basic': { manifest: { id: 'smashup-basic', steps: [] } },
                'cowboys-duel': { manifest: { id: 'smashup-cowboys-duel', steps: [] } },
            },
        };
        const loadTutorial = vi.fn().mockResolvedValue(tutorialCatalog);

        vi.doMock('../../games/manifest.client', () => ({
            GAME_CLIENT_MANIFEST: [
                {
                    manifest: {
                        id: 'smashup',
                        type: 'game',
                        enabled: true,
                    },
                    loadRuntime,
                    loadTutorial,
                },
            ],
        }));

        const { loadGameImplementation, resolveGameTutorialManifest } = await import('../../games/registry');

        const implementation = await loadGameImplementation('smashup', { includeTutorial: true });
        expect(implementation?.tutorial).toEqual({ id: 'smashup-basic', steps: [] });
        expect(implementation?.tutorialCatalog).toEqual(tutorialCatalog);
        expect(resolveGameTutorialManifest('smashup', 'cowboys-duel')).toEqual({ id: 'smashup-cowboys-duel', steps: [] });
    });

    it('runtime 预取不会提前占用正式加载的超时窗口', async () => {
        vi.useFakeTimers();
        try {
            const runtime = {
                engineConfig: {},
                board: () => null,
            };
            let resolveRuntime: ((value: typeof runtime) => void) | null = null;
            const loadRuntime = vi.fn(() => new Promise<typeof runtime>((resolve) => {
                resolveRuntime = resolve;
            }));

            vi.doMock('../../games/manifest.client', () => ({
                GAME_CLIENT_MANIFEST: [
                    {
                        manifest: {
                            id: 'smashup',
                            type: 'game',
                            enabled: true,
                        },
                        loadRuntime,
                    },
                ],
            }));

            const { prefetchGameImplementation, loadGameImplementation } = await import('../../games/registry');

            const prefetchPromise = prefetchGameImplementation('smashup');
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(16000);

            const blockingPromise = loadGameImplementation('smashup');
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(1000);

            resolveRuntime?.(runtime);
            await Promise.resolve();

            await expect(blockingPromise).resolves.toEqual(runtime);
            await expect(prefetchPromise).resolves.toEqual(runtime);
            expect(loadRuntime).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('ensureGameCriticalImageResolverLoaded', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.doUnmock('../../games/manifest.client');
        vi.doUnmock('../../core');
        vi.resetModules();
    });

    it('可在 runtime 之前单独懒加载 critical image resolver', async () => {
        const mockResolver = vi.fn(() => ({ critical: ['smashup/cards/cards1'], warm: [] }));
        const registerCriticalImageResolver = vi.fn();
        const getCriticalImageResolver = vi.fn(() => undefined);
        const loadCriticalImageResolver = vi.fn().mockResolvedValue(mockResolver);

        vi.doMock('../../games/manifest.client', () => ({
            GAME_CLIENT_MANIFEST: [
                {
                    manifest: {
                        id: 'smashup',
                        type: 'game',
                        enabled: true,
                    },
                    loadRuntime: vi.fn(),
                    loadCriticalImageResolver,
                },
            ],
        }));

        vi.doMock('../../core', () => ({
            getCriticalImageResolver,
            registerCriticalImageResolver,
        }));

        const { ensureGameCriticalImageResolverLoaded } = await import('../../games/registry');

        await ensureGameCriticalImageResolverLoaded('smashup');

        expect(loadCriticalImageResolver).toHaveBeenCalledTimes(1);
        expect(registerCriticalImageResolver).toHaveBeenCalledTimes(1);
        expect(registerCriticalImageResolver).toHaveBeenCalledWith('smashup', mockResolver);
    });
});

describe('resolveGameImplementationLoadTimeoutMs', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.doUnmock('../../games/registry');
        vi.resetModules();
    });

    it('生产桌面维持 15000ms，开发冷启动和慢设备放宽超时', async () => {
        const {
            DEVELOPMENT_GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS,
            GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS,
            SLOW_DEVICE_GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS,
            resolveGameImplementationLoadTimeoutMs,
        } = await import('../../games/registry');

        expect(resolveGameImplementationLoadTimeoutMs({
            windowObject: { innerWidth: 1440 },
            navigatorObject: {
                connection: { effectiveType: '4g', saveData: false },
                deviceMemory: 8,
                hardwareConcurrency: 8,
            },
            isDevelopmentRuntime: false,
            isNativeAndroid: false,
            isCoarsePointer: false,
        })).toBe(GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS);

        expect(resolveGameImplementationLoadTimeoutMs({
            windowObject: { innerWidth: 1440 },
            navigatorObject: {
                connection: { effectiveType: '4g', saveData: false },
                deviceMemory: 8,
                hardwareConcurrency: 8,
            },
            isDevelopmentRuntime: true,
            isNativeAndroid: false,
            isCoarsePointer: false,
        })).toBe(DEVELOPMENT_GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS);

        expect(resolveGameImplementationLoadTimeoutMs({
            windowObject: { innerWidth: 390 },
            navigatorObject: {
                connection: { effectiveType: '3g', saveData: true },
                deviceMemory: 4,
                hardwareConcurrency: 4,
            },
            isDevelopmentRuntime: false,
            isNativeAndroid: false,
            isCoarsePointer: true,
        })).toBe(SLOW_DEVICE_GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS);

        expect(resolveGameImplementationLoadTimeoutMs({
            windowObject: { innerWidth: 1440 },
            navigatorObject: {
                connection: { effectiveType: '4g', saveData: false },
                deviceMemory: 8,
                hardwareConcurrency: 8,
            },
            isDevelopmentRuntime: false,
            isNativeAndroid: false,
            isCoarsePointer: false,
            isTestMode: true,
        })).toBe(SLOW_DEVICE_GAME_IMPLEMENTATION_LOAD_TIMEOUT_MS);
    });
});

describe('resolveFollowCurrentTurnPlayerId', () => {
    it('优先使用显式当前玩家字段，缺失时回退 turnOrder/currentPlayerIndex', async () => {
        const { resolveFollowCurrentTurnPlayerId } = await import('../../engine/transport/followCurrentTurnPlayer');

        expect(resolveFollowCurrentTurnPlayerId({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            currentPlayer: '0',
        })).toBe('0');
        expect(resolveFollowCurrentTurnPlayerId({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
        })).toBe('1');
        expect(resolveFollowCurrentTurnPlayerId({ currentPlayer: '1' })).toBe('1');
        expect(resolveFollowCurrentTurnPlayerId({ currentPlayerId: '2' })).toBe('2');
        expect(resolveFollowCurrentTurnPlayerId({})).toBeNull();
    });
});

describe('Home missing match confirmation', () => {
    beforeEach(() => {
        cleanup();
        nativeAndroidRuntimeState.value = false;
        androidLiveUpdateSnapshotState.value = {
            enabled: false,
            manifestUrl: '',
            channel: 'stable',
            nativeAndroid: false,
            updaterLoaded: false,
        };
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

describe('Home native runtime footer', () => {
    const renderHomeVersionFooter = async () => {
        const { HomeVersionFooter } = await import('../../components/home/HomeVersionFooter');
        return render(<HomeVersionFooter />);
    };

    beforeEach(() => {
        vi.resetModules();
        mockAndroidLiveUpdatesModule();
        cleanup();
        nativeAndroidRuntimeState.value = false;
        androidLiveUpdateSnapshotState.value = {
            enabled: false,
            manifestUrl: '',
            channel: 'stable',
            nativeAndroid: false,
            updaterLoaded: false,
        };
        mockGetLatestStoredMatchCredentials.mockImplementation(() => null);
        mockReadStoredMatchCredentials.mockImplementation(() => null);
        mockGetOwnerActiveMatch.mockReturnValue(null);
        mockGetMatch.mockReset();
        mockSetSearchParams.mockReset();
        mockNavigate.mockReset();
        mockRequestAndroidLiveUpdateCheck.mockReset();
        androidLiveUpdateActivityState.value = {
            active: false,
            phase: 'idle',
        };
    });

    afterEach(() => {
        cleanup();
    });

    it('网页端只显示单一版本号，不显示 Bundle/App/OTA 信息', async () => {
        await renderHomeVersionFooter();

        await waitFor(() => {
            expect(screen.getByText(currentAppVersionLabel)).toBeInTheDocument();
        });

        expect(screen.queryByText(/^Bundle /)).toBeNull();
        expect(screen.queryByText(/^App /)).toBeNull();
        expect(screen.queryByText(/^Latest /)).toBeNull();
        expect(screen.queryByText('OTA 未对齐')).toBeNull();
    });

    it('原生 Android 下即使快照未返回也显示 Bundle/App 骨架信息', async () => {
        nativeAndroidRuntimeState.value = true;

        await renderHomeVersionFooter();

        await waitFor(() => {
            expect(screen.getByText(`更新号 ${currentAppVersionLabel}`)).toBeInTheDocument();
        });

        expect(screen.getByText(`App ${currentAppVersionLabel}`)).toBeInTheDocument();
    });

    it('原生 Android 且快照确认后显示 Bundle/App/OTA 信息', async () => {
        nativeAndroidRuntimeState.value = true;
        androidLiveUpdateSnapshotState.value = {
            enabled: true,
            manifestUrl: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            channel: 'stable',
            nativeAndroid: true,
            updaterLoaded: true,
            nativeVersion: '0.5.1',
            currentBundleVersion: '0.5.0-ota-2026-04-04',
            currentDisplayVersion: '600',
            manifestVersion: '0.5.1-ota-2026-04-04',
            manifestDisplayVersion: '601',
        };

        await renderHomeVersionFooter();

        await waitFor(() => {
            expect(screen.getByText('更新号 600')).toBeInTheDocument();
        });

        expect(screen.getByText('App 0.5.1')).toBeInTheDocument();
        expect(screen.getByText('最新更新 601')).toBeInTheDocument();
        expect(screen.queryByText(/0\.5\.1-ota-2026-04-04/)).toBeNull();
        expect(screen.getByText('OTA 未对齐，点击立即更新')).toBeInTheDocument();
    });

    it('点击 OTA 未对齐角标时直接触发即时 OTA 检查', async () => {
        nativeAndroidRuntimeState.value = true;
        androidLiveUpdateSnapshotState.value = {
            enabled: true,
            manifestUrl: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            channel: 'stable',
            nativeAndroid: true,
            updaterLoaded: true,
            nativeVersion: '0.5.1',
            currentBundleVersion: '0.5.0-ota-2026-04-04',
            currentDisplayVersion: '600',
            manifestVersion: '0.5.1-ota-2026-04-04',
            manifestDisplayVersion: '601',
        };

        await renderHomeVersionFooter();

        const footerButton = await screen.findByRole('button', {
            name: /versions are not aligned/i,
        });

        await act(async () => {
            footerButton.click();
        });

        expect(mockRequestAndroidLiveUpdateCheck).toHaveBeenCalledWith({
            interactive: true,
            applyMode: 'immediate',
            initialImmediatePhase: 'downloading',
        });
    });

    it('原生 Android 版本已对齐时点击右下角仍会触发即时 OTA 检查', async () => {
        nativeAndroidRuntimeState.value = true;
        androidLiveUpdateSnapshotState.value = {
            enabled: true,
            manifestUrl: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
            channel: 'stable',
            nativeAndroid: true,
            updaterLoaded: true,
            nativeVersion: '0.5.1',
            currentBundleVersion: '0.5.1-ota-2026-04-04',
            currentDisplayVersion: '601',
            manifestVersion: '0.5.1-ota-2026-04-04',
            manifestDisplayVersion: '601',
        };

        await renderHomeVersionFooter();

        const footerButton = await screen.findByRole('button', {
            name: /current update number 601, app version 0\.5\.1/i,
        });

        await act(async () => {
            footerButton.click();
        });

        expect(mockRequestAndroidLiveUpdateCheck).toHaveBeenCalledWith({
            interactive: true,
            applyMode: 'immediate',
            initialImmediatePhase: 'checking',
        });
        expect(screen.queryByText('更新号 0.5.1-ota-2026-04-04')).toBeNull();
    });
});
