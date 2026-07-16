/* @vitest-environment happy-dom */
import { createElement, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import {
    buildLocalMatchSearchParams,
    createDefaultLocalMatchPreferences,
    DEFAULT_AI_MINIMUM_ACTION_DELAY_MS,
    normalizeSeatController,
    resolveAiMinimumActionDelayMs,
    resolveSeatControllersFromSearchParams,
} from '../../../engine/ai';
import { __resetGameDetailsModalPackageStateLogForTests, GameDetailsModal } from '../GameDetailsModal';
import { AiSupportPills } from '../AiSupportPills';
import { GameDetailsMobilePackageCard } from '../GameDetailsMobilePackageCard';
import {
    clearLocalMatchSnapshot,
    ensureLocalMatchSeedSearchParams,
    persistLocalMatchSnapshot,
    readLocalMatchSnapshot,
} from '../../../engine/transport/localSession';
import { normalizeSetupValuesForFields, resolveSetupFieldOptions } from '../CreateRoomModal';
import type { GameManifestEntry, GameSetupField } from '../../../games/manifest.types';
import { resolveActiveMatchExitPayload, shouldPromptExitActiveMatch } from '../roomActions';
import { RoomList } from '../RoomList';
import * as matchApi from '../../../services/matchApi';
import * as matchStatus from '../../../hooks/match/useMatchStatus';
import { lobbySocket } from '../../../services/lobbySocket';
import {
    refreshGamePackageStateFromNativeTask,
    resetGamePackageManagerForTests,
    startGamePackageInstall,
    hydrateInstalledNativeGamePackages,
    syncGamePackageState,
} from '../../../features/mobile-packages/packageManagerService';
import * as manifestClient from '../../../features/mobile-packages/manifestClient';
import * as nativeGamePackagePlugin from '../../../features/mobile-packages/nativeGamePackagePlugin';
import { createDefaultGamePackageState } from '../../../features/mobile-packages/types';

type LobbyStatusSnapshot = { connected: boolean; lastError?: string };
type LobbyStatusCallback = (status: LobbyStatusSnapshot) => void;

const navigateMock = vi.fn();
const openModalMock = vi.fn();
const closeModalMock = vi.fn();
const mockLoggerInfo = vi.fn();
const {
    getGameByIdMock,
    latestCreateRoomModalProps,
    latestPackageInstallModalProps,
    latestConfirmModalProps,
    latestPasswordEntryModalProps,
    ensureGameCriticalImageResolverLoadedMock,
    hasGameTutorialLoaderMock,
    prefetchGameImplementationMock,
    prefetchOnlineMatchRouteMock,
    resolveCriticalImagesMock,
    preloadWarmImagesMock,
    requestAndroidNativeUpdateCheckMock,
} = vi.hoisted(() => ({
    getGameByIdMock: vi.fn<(gameId: string) => GameManifestEntry | null>((gameId: string) => {
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
            mobileDelivery: {
                mode: 'package-managed',
                runtimeChannel: 'stable',
                modulePackId: 'dicethrone',
                assetPackId: 'dicethrone',
            },
            ai: {
                capture: true,
                localAi: true,
                remoteAi: true,
            },
        };
    }),
    latestCreateRoomModalProps: { current: null as null | Record<string, unknown> },
    latestPackageInstallModalProps: { current: null as null | Record<string, unknown> },
    latestConfirmModalProps: { current: null as null | Record<string, unknown> },
    latestPasswordEntryModalProps: { current: null as null | Record<string, unknown> },
    ensureGameCriticalImageResolverLoadedMock: vi.fn(),
    hasGameTutorialLoaderMock: vi.fn(() => true),
    prefetchGameImplementationMock: vi.fn(),
    prefetchOnlineMatchRouteMock: vi.fn(),
    resolveCriticalImagesMock: vi.fn(),
    preloadWarmImagesMock: vi.fn(),
    requestAndroidNativeUpdateCheckMock: vi.fn(),
}));

const buildMockGameManifest = (override: Partial<GameManifestEntry> = {}): GameManifestEntry => ({
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
    mobileDelivery: {
        mode: 'package-managed',
        runtimeChannel: 'stable',
        modulePackId: 'dicethrone',
        assetPackId: 'dicethrone',
    },
    ai: {
        capture: true,
        localAi: true,
        remoteAi: true,
    },
    ...override,
});
const toastMock = {
    warning: vi.fn(),
    error: vi.fn(),
};

const markGamePackageInstalled = (gameId = 'dicethrone', installedVersion = 'test-asset-pack-v1') => {
    window.localStorage.setItem(`mobile-package-state:${gameId}`, JSON.stringify({
        gameId,
        runtimeChannel: 'stable',
        status: 'installed',
        modulePackId: gameId,
        assetPackId: gameId,
        installedVersion,
        localAssetBaseUrl: `/_capacitor_file_/data/user/0/top.easyboardgame.app.debug/files/game-packages/${gameId}/current/assets`,
        updatedAt: Date.now(),
    }));
};

const markGamePackageFailed = (gameId = 'dicethrone', errorMessage = '下载失败') => {
    window.localStorage.setItem(`mobile-package-state:${gameId}`, JSON.stringify({
        gameId,
        runtimeChannel: 'stable',
        status: 'failed',
        modulePackId: gameId,
        assetPackId: gameId,
        errorMessage,
        updatedAt: Date.now(),
    }));
};

const markGamePackageQueued = (gameId = 'dicethrone') => {
    window.localStorage.setItem(`mobile-package-state:${gameId}`, JSON.stringify({
        gameId,
        runtimeChannel: 'stable',
        status: 'queued',
        progressMode: 'indeterminate',
        modulePackId: gameId,
        assetPackId: gameId,
        updatedAt: Date.now(),
    }));
};

const setImportedCapacitorRuntime = (native: boolean, platform: string) => {
    Object.assign(Capacitor, {
        isNativePlatform: () => native,
        getPlatform: () => platform,
    });
};

const setNativeAndroidRuntime = () => {
    setImportedCapacitorRuntime(true, 'android');
    Object.defineProperty(window, 'Capacitor', {
        configurable: true,
        writable: true,
        value: {
            isNativePlatform: () => true,
            getPlatform: () => 'android',
        },
    });
};

const setWebRuntime = () => {
    setImportedCapacitorRuntime(false, 'web');
    Object.defineProperty(window, 'Capacitor', {
        configurable: true,
        writable: true,
        value: undefined,
    });
};

const expandMobilePackageCardIfNeeded = () => {
    if (!screen.queryByTestId('game-details-mobile-package-card')) {
        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));
    }
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (key === 'error.createRoomErrorCodeWithStatus') {
                return `（错误码：${String(options?.code ?? '')} / 状态码：${String(options?.status ?? '')}）`;
            }
            if (key === 'error.createRoomErrorCodeOnly') {
                return `（错误码：${String(options?.code ?? '')}）`;
            }
            return key;
        },
        i18n: {
            language: 'zh-CN',
            hasLoadedNamespace: () => true,
            loadNamespaces: vi.fn().mockResolvedValue(undefined),
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => undefined,
    },
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

vi.mock('../../../api/user-settings', () => ({
    getLocalMatchPreferences: vi.fn(),
    updateLocalMatchPreferences: vi.fn(),
}));

vi.mock('../../../config/games.config', () => ({
    getGameById: getGameByIdMock,
}));

vi.mock('../../../games/registry', () => ({
    ensureGameCriticalImageResolverLoaded: (...args: unknown[]) => ensureGameCriticalImageResolverLoadedMock(...args),
    hasGameTutorialLoader: (...args: unknown[]) => hasGameTutorialLoaderMock(...args),
    prefetchGameImplementation: (...args: unknown[]) => prefetchGameImplementationMock(...args),
}));

vi.mock('../../../lib/prefetchPlayRoute', () => ({
    prefetchOnlineMatchRoute: (...args: unknown[]) => prefetchOnlineMatchRouteMock(...args),
}));

vi.mock('../../../core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../core')>();
    return {
        ...actual,
        UI_Z_INDEX: {
            ...actual.UI_Z_INDEX,
            modalTooltip: 1000,
        },
        resolveCriticalImages: (...args: unknown[]) => resolveCriticalImagesMock(...args),
        preloadWarmImages: (...args: unknown[]) => preloadWarmImagesMock(...args),
    };
});

vi.mock('../../../features/mobile-packages/nativeGamePackagePlugin', () => ({
    cancelNativeGamePackageInstall: vi.fn(async () => true),
    createNativeGamePackageInstallHandle: vi.fn(async () => null),
    ensureNativeDownloadNotificationPermission: vi.fn(async () => null),
    getNativeDownloadNotificationPermissionStatus: vi.fn(async () => null),
    listInstalledNativeGamePackages: vi.fn(async () => []),
    openNativeDownloadNotificationSettings: vi.fn(async () => false),
    readNativeGamePackageInstallState: vi.fn(async () => null),
    uninstallNativeGamePackage: vi.fn(async (gameId: string) => ({
        gameId,
        status: 'not-installed',
        updatedAt: Date.now(),
    })),
}));

vi.mock('../../../lib/mobile/androidNativeUpdates', () => ({
    requestAndroidNativeUpdateCheck: requestAndroidNativeUpdateCheckMock,
}));

vi.mock('../../../features/mobile-packages/manifestClient', () => ({
    hasRemoteGamePackageManifestEndpoint: true,
    buildFallbackGamePackageManifest: (gameId: string, delivery?: {
        runtimeChannel?: string;
        modulePackId?: string;
        assetPackId?: string;
        modulePackBytes?: number;
        assetPackBytes?: number;
    }) => ({
        gameId,
        runtimeChannel: delivery?.runtimeChannel?.trim() || 'stable',
        modulePackId: delivery?.modulePackId?.trim(),
        assetPackId: delivery?.assetPackId?.trim(),
        modulePackVersion: 'test-module-pack-v1',
        assetPackVersion: 'test-asset-pack-v1',
        modulePackBytes: delivery?.modulePackBytes,
        assetPackBytes: delivery?.assetPackBytes,
        source: 'fallback',
    }),
    resolveGamePackageManifest: vi.fn(async (gameId: string, delivery?: {
        runtimeChannel?: string;
        modulePackId?: string;
        assetPackId?: string;
        modulePackBytes?: number;
        assetPackBytes?: number;
    }) => ({
        gameId,
        runtimeChannel: delivery?.runtimeChannel?.trim() || 'stable',
        modulePackId: delivery?.modulePackId?.trim(),
        assetPackId: delivery?.assetPackId?.trim(),
        modulePackVersion: 'test-module-pack-v1',
        assetPackVersion: 'test-asset-pack-v1',
        assetPackUrl: `https://example.com/${gameId}.zip`,
        modulePackBytes: delivery?.modulePackBytes,
        assetPackBytes: delivery?.assetPackBytes,
        source: 'remote',
    })),
}));
vi.mock('../../../lib/logger', () => ({
    logger: {
        info: (...args: unknown[]) => mockLoggerInfo(...args),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        group: vi.fn(),
        groupEnd: vi.fn(),
    },
    createScopedLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

vi.mock('../../../services/lobbySocket', () => ({
    lobbySocket: {
        subscribe: vi.fn((_gameId: string, callback: (matches: unknown[]) => void) => {
            callback([]);
            return () => {};
        }),
        subscribeStatus: vi.fn<(callback: LobbyStatusCallback) => () => void>(() => () => {}),
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
    persistAiSeatCredentials: vi.fn(),
    persistMatchCredentials: vi.fn(),
    isMatchNotFoundError: (err: unknown) => String(err).includes('404'),
}));

vi.mock('../../../hooks/match/ownerIdentity', () => ({
    getOrCreateGuestId: () => 'guest-1',
    getGuestName: () => 'Guest',
    getOwnerKey: () => 'owner-1',
    getOwnerType: () => 'guest',
}));

vi.mock('../../common/overlays/ConfirmModal', () => ({
    ConfirmModal: (props: Record<string, unknown>) => {
        latestConfirmModalProps.current = props;
        return createElement('div', null,
            createElement('div', null, String(props.title ?? '')),
            createElement('div', null, String(props.description ?? '')),
            createElement('button', {
                type: 'button',
                onClick: () => {
                    void (props.onConfirm as (() => void | Promise<void>) | undefined)?.();
                },
            }, 'mock-confirm-modal-confirm'),
            createElement('button', {
                type: 'button',
                onClick: () => {
                    (props.onCancel as (() => void) | undefined)?.();
                },
            }, 'mock-confirm-modal-cancel'),
        );
    },
}));

vi.mock('../../common/overlays/ModalBase', () => ({
    ModalBase: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));

vi.mock('../CreateRoomModal', async () => {
    const actual = await vi.importActual<typeof import('../CreateRoomModal')>('../CreateRoomModal');
    return {
        ...actual,
        CreateRoomModal: ({
            isOpen,
            isLoading,
            onConfirm,
            initialPreferences,
        }: {
            isOpen: boolean;
            isLoading?: boolean;
            onConfirm: (config: unknown) => void;
            initialPreferences?: unknown;
        }) => {
            latestCreateRoomModalProps.current = { isOpen, isLoading, initialPreferences };
            const configOverride = (globalThis as unknown as {
                __BG_TEST_CREATE_ROOM_CONFIG__?: Record<string, unknown>;
            }).__BG_TEST_CREATE_ROOM_CONFIG__;
            return isOpen
                ? createElement('div', null,
                    createElement('button', {
                        type: 'button',
                        onClick: () => onConfirm(configOverride ?? {
                            roomName: 'AI 房间',
                            numPlayers: 2,
                            ttlSeconds: 0,
                            password: '',
                            enableAi: true,
                            seatControllers: {
                                '0': { type: 'human' },
                                '1': { type: 'local-ai' },
                            },
                            setupSelections: {},
                        }),
                    }, 'mock-create-room-confirm'),
                    isLoading ? createElement('span', null, 'mock-create-room-loading') : null,
                )
                : null;
        },
    };
});

vi.mock('../../common/overlays/PasswordEntryModal', () => ({
    PasswordEntryModal: (props: Record<string, unknown>) => {
        latestPasswordEntryModalProps.current = props;
        return createElement('div', null, 'mock-password-entry-modal');
    },
}));

vi.mock('../LeaderboardTab', () => ({
    LeaderboardTab: () => createElement('div', null, 'leaderboard'),
}));

vi.mock('../GameDetailsChangelogSection', () => ({
    GameDetailsChangelogSection: () => createElement('div', null, 'changelog'),
}));

vi.mock('../GamePackageInstallConfirmModal', () => ({
    GamePackageInstallConfirmModal: (props: Record<string, unknown>) => {
        latestPackageInstallModalProps.current = props;
        return createElement('div', null, 'package-install-confirm');
    },
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
    vi.useRealTimers();
    vi.clearAllMocks();
});

beforeEach(() => {
    window.localStorage.clear();
    setNativeAndroidRuntime();
    resetGamePackageManagerForTests();
    __resetGameDetailsModalPackageStateLogForTests();
    navigateMock.mockReset();
    openModalMock.mockReset();
    let modalCounter = 0;
    openModalMock.mockImplementation(() => `modal-${++modalCounter}`);
    closeModalMock.mockReset();
    getGameByIdMock.mockReset();
    getGameByIdMock.mockImplementation((gameId: string) => {
        if (gameId !== 'dicethrone') return null;
        return buildMockGameManifest();
    });
    toastMock.warning.mockReset();
    toastMock.error.mockReset();
    mockLoggerInfo.mockReset();
    requestAndroidNativeUpdateCheckMock.mockReset();
    ensureGameCriticalImageResolverLoadedMock.mockReset();
    ensureGameCriticalImageResolverLoadedMock.mockResolvedValue(undefined);
    hasGameTutorialLoaderMock.mockReset();
    hasGameTutorialLoaderMock.mockReturnValue(true);
    prefetchGameImplementationMock.mockReset();
    prefetchGameImplementationMock.mockResolvedValue(null);
    prefetchOnlineMatchRouteMock.mockReset();
    prefetchOnlineMatchRouteMock.mockResolvedValue(undefined);
    resolveCriticalImagesMock.mockReset();
    resolveCriticalImagesMock.mockReturnValue({
        critical: ['dicethrone/cards/cards1'],
        warm: [],
        phaseKey: 'init:spectator',
    });
    preloadWarmImagesMock.mockReset();
    latestCreateRoomModalProps.current = null;
    latestPackageInstallModalProps.current = null;
    latestConfirmModalProps.current = null;
    latestPasswordEntryModalProps.current = null;
    delete (globalThis as unknown as { __BG_TEST_CREATE_ROOM_CONFIG__?: unknown }).__BG_TEST_CREATE_ROOM_CONFIG__;
    vi.mocked(nativeGamePackagePlugin.ensureNativeDownloadNotificationPermission).mockResolvedValue(null);
    vi.mocked(matchStatus.getOwnerActiveMatch).mockImplementation(() => null);
    vi.mocked(matchStatus.getLatestStoredMatchCredentials).mockImplementation(() => null);
    vi.mocked(matchStatus.listStoredMatchCredentials).mockImplementation(() => []);
    vi.mocked(matchStatus.readStoredMatchCredentials).mockImplementation(() => null);
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

    it('resolveSetupFieldOptions 会按人数返回可用选项', () => {
        const field: GameSetupField = {
            type: 'select',
            labelKey: 'games.splendor.setup.startingPlayerId.label',
            optionsByPlayerCount: {
                2: [
                    { value: '0', labelKey: 'games.splendor.setup.startingPlayerId.player1' },
                    { value: '1', labelKey: 'games.splendor.setup.startingPlayerId.player2' },
                ],
                4: [
                    { value: '0', labelKey: 'games.splendor.setup.startingPlayerId.player1' },
                    { value: '1', labelKey: 'games.splendor.setup.startingPlayerId.player2' },
                    { value: '2', labelKey: 'games.splendor.setup.startingPlayerId.player3' },
                    { value: '3', labelKey: 'games.splendor.setup.startingPlayerId.player4' },
                ],
            },
            default: '0',
        };

        expect(resolveSetupFieldOptions(field, 2).map((option) => option.value)).toEqual(['0', '1']);
        expect(resolveSetupFieldOptions(field, 4).map((option) => option.value)).toEqual(['0', '1', '2', '3']);
    });

    it('normalizeSetupValuesForFields 在人数变化后会回退到合法先手选项', () => {
        const setupFields: Array<[string, GameSetupField]> = [[
            'startingPlayerId',
            {
                type: 'select',
                labelKey: 'games.splendor.setup.startingPlayerId.label',
                optionsByPlayerCount: {
                    2: [
                        { value: '0', labelKey: 'games.splendor.setup.startingPlayerId.player1' },
                        { value: '1', labelKey: 'games.splendor.setup.startingPlayerId.player2' },
                    ],
                    4: [
                        { value: '0', labelKey: 'games.splendor.setup.startingPlayerId.player1' },
                        { value: '1', labelKey: 'games.splendor.setup.startingPlayerId.player2' },
                        { value: '2', labelKey: 'games.splendor.setup.startingPlayerId.player3' },
                        { value: '3', labelKey: 'games.splendor.setup.startingPlayerId.player4' },
                    ],
                },
                default: '0',
            },
        ]] as const;

        expect(normalizeSetupValuesForFields(
            [...setupFields],
            2,
            { startingPlayerId: '3' },
        )).toEqual({ startingPlayerId: '0' });
    });
});

describe('mobile package bootstrap hydration', () => {
    it('未先进入大厅包管理 hook 时，也能把原生已安装包同步进状态缓存', async () => {
        vi.mocked(nativeGamePackagePlugin.listInstalledNativeGamePackages).mockResolvedValueOnce([
            {
                gameId: 'dicethrone',
                runtimeChannel: 'stable',
                installedVersion: '0.5.0',
                assetBaseUrl: '/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets',
            },
        ]);

        await hydrateInstalledNativeGamePackages();

        const fallbackState = createDefaultGamePackageState('dicethrone', {
            mode: 'package-managed',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
        });
        const hydratedState = syncGamePackageState('dicethrone', fallbackState);

        expect(hydratedState.status).toBe('installed');
        expect(hydratedState.installedVersion).toBe('0.5.0');
        expect(hydratedState.localAssetBaseUrl)
            .toBe('/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets');
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
        expect(controllers['1']).toEqual({ type: 'local-ai', difficulty: 'normal' });
    });

    it('创建房间首开时 AI 开关默认关闭，即使默认 seat1 controller 是 local-ai', () => {
        const manifest = buildMockGameManifest();

        expect(createDefaultLocalMatchPreferences(manifest).seatControllers['1']).toEqual({
            type: 'local-ai',
            difficulty: 'normal',
        });

        const latestProps = {
            isOpen: true,
            isLoading: false,
            initialPreferences: null,
        };
        latestCreateRoomModalProps.current = latestProps;
        expect(latestCreateRoomModalProps.current).toEqual(latestProps);
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
                '1': { type: 'local-ai', policyId: 'opening-v1', difficulty: 'hard' },
                '2': { type: 'remote-ai', providerId: 'astrbot' },
            },
        });

        expect(search.get('players')).toBe('3');
        expect(search.get('seat1')).toBe('local-ai:opening-v1');
        expect(search.get('seat1Difficulty')).toBe('hard');
        expect(search.get('seat2')).toBe('remote-ai:astrbot');
    });

    it('本地对局 URL 会保存并恢复 AI 最小时长', () => {
        const search = buildLocalMatchSearchParams({
            numPlayers: 2,
            playerOptions: [2],
            aiSupport,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'normal', minimumActionDelayMs: 0 },
            },
        });

        expect(search.get('seat1Delay')).toBe('0');

        const controllers = resolveSeatControllersFromSearchParams({
            numPlayers: 2,
            searchParams: search,
            aiSupport,
        });
        expect(controllers['1']).toEqual({
            type: 'local-ai',
            difficulty: 'normal',
            minimumActionDelayMs: 0,
        });
    });

    it('本地对局 URL 会保存并恢复 AI 手动选派系标记', () => {
        const search = buildLocalMatchSearchParams({
            numPlayers: 2,
            playerOptions: [2],
            aiSupport,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'normal', manualFactionSelection: true },
            },
        });

        expect(search.get('seat1ManualFaction')).toBe('1');

        const controllers = resolveSeatControllersFromSearchParams({
            numPlayers: 2,
            searchParams: search,
            aiSupport,
        });
        expect(controllers['1']).toEqual({
            type: 'local-ai',
            difficulty: 'normal',
            manualFactionSelection: true,
            manualSetupSelection: true,
        });
    });

    it('显式 difficulty 参数会恢复到 local-ai controller', () => {
        const searchParams = new URLSearchParams('seat1=local-ai:opening-v1&seat1Difficulty=expert');
        const controllers = resolveSeatControllersFromSearchParams({
            numPlayers: 2,
            searchParams,
            aiSupport,
        });

        expect(controllers['1']).toEqual({
            type: 'local-ai',
            policyId: 'opening-v1',
            difficulty: 'expert',
        });
    });

    it('AI controller 默认使用统一最小时长，并支持自定义覆盖', () => {
        expect(resolveAiMinimumActionDelayMs({ type: 'human' })).toBe(0);
        expect(resolveAiMinimumActionDelayMs({ type: 'local-ai' })).toBe(DEFAULT_AI_MINIMUM_ACTION_DELAY_MS);
        expect(resolveAiMinimumActionDelayMs({ type: 'remote-ai', providerId: 'astrbot' })).toBe(DEFAULT_AI_MINIMUM_ACTION_DELAY_MS);
        expect(resolveAiMinimumActionDelayMs({ type: 'local-ai' }, 3000)).toBe(3000);
        expect(resolveAiMinimumActionDelayMs({ type: 'local-ai', minimumActionDelayMs: 950 })).toBe(950);
    });

    it('normalizeSeatController 会保留并清洗 AI 最小时长', () => {
        expect(normalizeSeatController({
            type: 'local-ai',
            minimumActionDelayMs: 321.4,
        }, aiSupport)).toEqual({
            type: 'local-ai',
            minimumActionDelayMs: 321,
        });

        expect(normalizeSeatController({
            type: 'remote-ai',
            providerId: 'astrbot',
            minimumActionDelayMs: -50,
        }, aiSupport)).toEqual({
            type: 'remote-ai',
            providerId: 'astrbot',
            minimumActionDelayMs: 0,
        });
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

describe('GameDetailsMobilePackageCard', () => {
    it('进行中状态显示进度条和阶段文案', () => {
        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'manifest',
                progressMode: 'indeterminate',
            },
            onInstall: vi.fn(),
        }));

        expect(screen.getByTestId('game-details-mobile-package-progress-track')).toBeInTheDocument();
        expect(screen.getByText('packageManager.progress.manifestTitle')).toBeInTheDocument();
        expect(screen.getByText('packageManager.progress.pendingPercent')).toBeInTheDocument();
    });

    it('进行中状态点击主按钮只收起卡片，不取消下载任务', () => {
        const cancelMock = vi.fn();
        const collapseMock = vi.fn();

        render(createElement(GameDetailsMobilePackageCard, {
            gameName: '王权骰铸',
            state: {
                status: 'downloading',
                progressMode: 'determinate',
                progressPercent: 12,
            },
            onInstall: vi.fn(),
            onCancel: cancelMock,
            onCollapse: collapseMock,
        }));

        const buttons = screen.getAllByRole('button', { name: 'common:close' });
        fireEvent.click(buttons[buttons.length - 1]);

        expect(collapseMock).toHaveBeenCalledTimes(1);
        expect(cancelMock).not.toHaveBeenCalled();
    });

    it('未安装且回退到 fallback 清单时显示同步失败并保留安装按钮', () => {
        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'not-installed',
                previewResolved: true,
                manifestSource: 'fallback',
                modulePackId: 'tictactoe',
                assetPackId: 'tictactoe',
            },
            onInstall: vi.fn(),
        }));

        expect(screen.getByText('packageManager.packageSyncFailed')).toBeInTheDocument();
        expect(screen.queryByText('packageManager.packageSyncing')).toBeNull();
        expect(screen.queryByText('packageManager.packageUnpublished')).toBeNull();
        expect(screen.getByText('packageManager.installAction')).toBeInTheDocument();
    });

    it('未安装且远端清单仍在同步时显示同步中并保留安装按钮', () => {
        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'not-installed',
                modulePackId: 'tictactoe',
                assetPackId: 'tictactoe',
            },
            onInstall: vi.fn(),
        }));

        expect(screen.getByText('packageManager.packageSyncing')).toBeInTheDocument();
        expect(screen.queryByText('packageManager.packageUnpublished')).toBeNull();
        expect(screen.getByText('packageManager.installAction')).toBeInTheDocument();
    });

    it('失败状态显示重试按钮和错误文案', () => {
        const retryMock = vi.fn();

        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'failed',
                errorMessage: '当前运行环境暂不支持下载游戏包，请在 Android App 内重试。',
            },
            onInstall: vi.fn(),
            onRetry: retryMock,
        }));

        expect(screen.getByText('当前运行环境暂不支持下载游戏包，请在 Android App 内重试。')).toBeInTheDocument();

        fireEvent.click(screen.getByText('packageManager.retryAction'));

        expect(retryMock).toHaveBeenCalledTimes(1);
    });

    it('清单拉取失败时显示明确的清单失败提示', () => {
        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'failed',
                errorCode: 'manifest-fetch-failed',
            },
            onInstall: vi.fn(),
        }));

        expect(screen.getByText('packageManager.manifestFetchFailedHint')).toBeInTheDocument();
    });

    it('远端清单缺少可下载包时显示未发布提示', () => {
        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'failed',
                errorCode: 'manifest-missing',
            },
            onInstall: vi.fn(),
        }));

        expect(screen.getByText('packageManager.manifestMissingHint')).toBeInTheDocument();
    });

    it('通知权限被系统拒绝时显示打开通知设置按钮', () => {
        const openSettingsMock = vi.fn();

        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'failed',
                errorCode: 'notification-permission-required',
                errorMessage: '通知权限已被拒绝，请到系统设置中开启后再重试下载。',
            },
            onInstall: vi.fn(),
            onRetry: openSettingsMock,
            failedActionLabel: 'packageManager.notificationSettingsAction',
        }));

        fireEvent.click(screen.getByText('packageManager.notificationSettingsAction'));

        expect(openSettingsMock).toHaveBeenCalledTimes(1);
    });

    it('更新模式显示更新 App 按钮并触发更新入口', () => {
        const installMock = vi.fn();
        const updateAppMock = vi.fn();

        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'not-installed',
            },
            onInstall: installMock,
            onUpdateApp: updateAppMock,
            presentation: 'update-required',
            requiredAppVersion: '0.6.0',
        }));

        expect(screen.getByText('packageManager.updateRequiredTitle')).toBeInTheDocument();
        expect(screen.getByText('packageManager.updateRequiredHintWithVersion')).toBeInTheDocument();
        expect(screen.queryByText('packageManager.installAction')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'packageManager.updateAppAction' }));

        expect(updateAppMock).toHaveBeenCalledTimes(1);
        expect(installMock).not.toHaveBeenCalled();
    });

    it('未安装状态只保留安装按钮，不再显示下载圆球', () => {
        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'not-installed',
            },
            onInstall: vi.fn(),
        }));

        const card = screen.getByTestId('game-details-mobile-package-card');
        expect(screen.getByText('packageManager.installAction')).toBeInTheDocument();
        expect(card.querySelector('.h-10.w-10.rounded-full')).toBeNull();
    });

    it('已安装状态显示可直接进入文案', () => {
        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'installed',
            },
            onInstall: vi.fn(),
        }));

        expect(screen.getByText('packageManager.installedTitle')).toBeInTheDocument();
        expect(screen.queryByText('packageManager.installAction')).toBeNull();
        expect(screen.getByText('packageManager.installedCompletedBadge')).toBeInTheDocument();
    });

    it('已安装且有版本号时，显示版本角标', () => {
        render(createElement(GameDetailsMobilePackageCard, {
            gameName: 'Tic-Tac-Toe',
            state: {
                status: 'installed',
                installedVersion: '2026.04.01',
            },
            onInstall: vi.fn(),
        }));

        expect(screen.getByText('packageManager.installedVersionBadge')).toBeInTheDocument();
        expect(screen.queryByTestId('game-details-mobile-package-progress-track')).toBeNull();
    });
});

describe('GamePackageInstallConfirmModal', () => {
    it('已安装旧版本但存在更新时，仍显示确认下载按钮', async () => {
        const { GamePackageInstallConfirmModal: RealGamePackageInstallConfirmModal } = await vi.importActual<typeof import('../GamePackageInstallConfirmModal')>('../GamePackageInstallConfirmModal');
        const onConfirm = vi.fn();
        const onClose = vi.fn();
        const onCancel = vi.fn();

        render(createElement(RealGamePackageInstallConfirmModal, {
            gameName: '王权骰铸',
            state: {
                status: 'installed',
                installedVersion: '0.5.0',
                availableVersion: '0.5.1',
                isUpdateAvailable: true,
            },
            assetPackId: 'dicethrone',
            assetPackBytes: 16211486,
            onConfirm,
            onClose,
            onCancel,
        }));

        expect(screen.getByText('packageManager.confirmTitle')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'packageManager.confirmAction' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});

describe('GameDetailsModal create room ai entry', () => {
    const baseProps = {
        isOpen: true,
        onClose: vi.fn(),
        gameId: 'dicethrone',
        titleKey: 'games.dicethrone.title',
        descriptionKey: 'games.dicethrone.description',
        thumbnail: createElement('div'),
    };

    it('打开详情弹窗时会提前预热联机房间冷加载依赖', async () => {
        render(createElement(GameDetailsModal, baseProps));

        await waitFor(() => {
            expect(ensureGameCriticalImageResolverLoadedMock).toHaveBeenCalledWith('dicethrone');
            expect(prefetchGameImplementationMock).toHaveBeenCalledWith('dicethrone', { includeTutorial: false });
            expect(prefetchOnlineMatchRouteMock).toHaveBeenCalled();
        });
    });

    it('创建房间弹窗内直接配置 AI，不再显示独立对战 AI 入口', async () => {
        markGamePackageInstalled();
        vi.spyOn(matchApi, 'createMatch').mockResolvedValueOnce({
            matchID: 'match-ai-1',
            ownerPlayerID: '0',
            ownerCredentials: 'host-cred',
        });
        let resolveAiSeatClaim: ((value: { playerCredentials: string }) => void) | null = null;
        vi.spyOn(matchApi, 'claimSeat').mockImplementationOnce(() => new Promise((resolve) => {
            resolveAiSeatClaim = resolve;
        }));

        render(createElement(GameDetailsModal, baseProps));

        expect(screen.queryByText('actions.playAi')).toBeNull();
        expect(screen.queryByText('ai.configureTitle')).toBeNull();

        fireEvent.click(screen.getByText('actions.createRoom'));
        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
        expect(ensureGameCriticalImageResolverLoadedMock).toHaveBeenCalledWith('dicethrone');
        expect(prefetchGameImplementationMock).toHaveBeenCalledWith('dicethrone', { includeTutorial: false });
        fireEvent.click(screen.getByText('mock-create-room-confirm'));

        await waitFor(() => {
            expect(matchStatus.persistAiSeatCredentials).toHaveBeenCalledWith('match-ai-1', {});
        });
        expect(navigateMock).not.toHaveBeenCalledWith('/play/dicethrone/match/match-ai-1?playerID=0');

        expect(matchApi.createMatch).toHaveBeenCalledWith(
            'dicethrone',
            expect.objectContaining({
                numPlayers: 2,
                playerName: 'Guest',
                setupData: expect.objectContaining({
                    enableAi: true,
                    seatControllers: expect.objectContaining({
                        '0': { type: 'human' },
                        '1': { type: 'local-ai' },
                    }),
                }),
            }),
            undefined,
        );
        expect(matchStatus.claimSeat).not.toHaveBeenCalled();
        expect(matchApi.claimSeat).toHaveBeenCalledWith(
            'dicethrone',
            'match-ai-1',
            '1',
            expect.objectContaining({
                guestId: 'guest-1',
            }),
        );
        expect(preloadWarmImagesMock).toHaveBeenCalledWith(
            ['dicethrone/cards/cards1'],
            'zh-CN',
            'dicethrone',
        );

        await act(async () => {
            resolveAiSeatClaim?.({ playerCredentials: 'ai-seat-1' });
            await Promise.resolve();
        });

        expect(matchStatus.persistAiSeatCredentials).toHaveBeenLastCalledWith('match-ai-1', {
            '1': 'ai-seat-1',
        });
        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/play/dicethrone/match/match-ai-1?playerID=0');
        });
    });

    it('创建 3 AI 房间时必须顺序占座，避免并发写 metadata 覆盖后续 AI 凭据', async () => {
        markGamePackageInstalled();
        getGameByIdMock.mockImplementation((gameId: string) => {
            if (gameId !== 'dicethrone') return null;
            return buildMockGameManifest({ playerOptions: [2, 4] });
        });
        (globalThis as unknown as { __BG_TEST_CREATE_ROOM_CONFIG__?: Record<string, unknown> }).__BG_TEST_CREATE_ROOM_CONFIG__ = {
            roomName: '四人 AI 房间',
            numPlayers: 4,
            ttlSeconds: 0,
            password: '',
            enableAi: true,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
                '2': { type: 'local-ai', manualFactionSelection: true },
                '3': { type: 'local-ai', manualFactionSelection: true },
            },
            setupSelections: {},
        };
        vi.spyOn(matchApi, 'createMatch').mockResolvedValueOnce({
            matchID: 'match-ai-3',
            ownerPlayerID: '0',
            ownerCredentials: 'host-cred',
        });

        const startedSeats: string[] = [];
        const resolvers: Record<string, (value: { playerCredentials: string }) => void> = {};
        vi.spyOn(matchApi, 'claimSeat').mockImplementation((_gameId, _matchId, playerId) => new Promise((resolve) => {
            startedSeats.push(playerId);
            resolvers[playerId] = resolve;
        }));

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));
        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('mock-create-room-confirm'));

        await waitFor(() => {
            expect(startedSeats).toEqual(['1']);
        });
        expect(navigateMock).not.toHaveBeenCalledWith('/play/dicethrone/match/match-ai-3?playerID=0');

        await act(async () => {
            resolvers['1']?.({ playerCredentials: 'ai-seat-1' });
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(startedSeats).toEqual(['1', '2']);
        });

        await act(async () => {
            resolvers['2']?.({ playerCredentials: 'ai-seat-2' });
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(startedSeats).toEqual(['1', '2', '3']);
        });
        expect(navigateMock).not.toHaveBeenCalledWith('/play/dicethrone/match/match-ai-3?playerID=0');

        await act(async () => {
            resolvers['3']?.({ playerCredentials: 'ai-seat-3' });
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/play/dicethrone/match/match-ai-3?playerID=0');
        });
        expect(matchStatus.persistAiSeatCredentials).toHaveBeenLastCalledWith('match-ai-3', {
            '1': 'ai-seat-1',
            '2': 'ai-seat-2',
            '3': 'ai-seat-3',
        });
    });

    it('加入房间时直接让服务端分配席位，不再先 getMatch 猜空位', async () => {
        markGamePackageInstalled();
        vi.mocked(lobbySocket.subscribe).mockImplementationOnce((_gameId, callback) => {
            callback([{
                matchID: 'match-join-1',
                players: [
                    { id: 0, name: 'Host' },
                    { id: 1, name: undefined },
                ],
                totalSeats: 2,
                gameName: 'dicethrone',
                roomName: '测试房间',
                ownerKey: 'owner-2',
                ownerType: 'guest',
                isLocked: false,
            }]);
            return () => {};
        });
        const getMatchSpy = vi.spyOn(matchApi, 'getMatch');
        const joinMatchSpy = vi.spyOn(matchApi, 'joinMatch').mockResolvedValueOnce({
            playerID: '1',
            playerCredentials: 'guest-seat-1',
        });

        render(createElement(GameDetailsModal, baseProps));

        await waitFor(() => {
            expect(screen.getByText('actions.join')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('actions.join'));

        await waitFor(() => {
            expect(joinMatchSpy).toHaveBeenCalledWith(
                'dicethrone',
                'match-join-1',
                expect.objectContaining({
                    playerName: 'Guest',
                    data: expect.objectContaining({
                        guestId: 'guest-1',
                    }),
                }),
            );
        });
        expect(joinMatchSpy.mock.calls[0]?.[2]).not.toHaveProperty('playerID');
        expect(getMatchSpy).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/play/dicethrone/match/match-join-1?playerID=1');
        });
    });

    it('加入加锁房间时会通过 modal stack 打开密码弹窗，并确认后带密码 joinMatch', async () => {
        markGamePackageInstalled();
        vi.mocked(lobbySocket.subscribe).mockImplementationOnce((_gameId, callback) => {
            callback([{
                matchID: 'match-locked-1',
                players: [
                    { id: 0, name: 'Host' },
                    { id: 1, name: undefined },
                ],
                totalSeats: 2,
                gameName: 'dicethrone',
                roomName: '加锁房间',
                ownerKey: 'owner-2',
                ownerType: 'guest',
                isLocked: true,
            }]);
            return () => {};
        });
        const joinMatchSpy = vi.spyOn(matchApi, 'joinMatch').mockResolvedValueOnce({
            playerID: '1',
            playerCredentials: 'guest-seat-locked-1',
        });

        render(createElement(GameDetailsModal, baseProps));

        await waitFor(() => {
            expect(screen.getByText('actions.join')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('actions.join'));

        await waitFor(() => {
            expect(openModalMock).toHaveBeenCalled();
        });

        const passwordModalConfig = openModalMock.mock.calls.at(-1)?.[0] as {
            render: (props: { close: () => void; closeOnBackdrop: boolean }) => ReactNode;
        };
        render(passwordModalConfig.render({
            close: vi.fn(),
            closeOnBackdrop: true,
        }));

        expect(screen.getByText('mock-password-entry-modal')).toBeInTheDocument();
        expect(latestPasswordEntryModalProps.current).toEqual(
            expect.objectContaining({
                open: true,
            }),
        );

        await act(async () => {
            const onConfirm = latestPasswordEntryModalProps.current?.onConfirm as (password: string) => void;
            onConfirm('1234');
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(joinMatchSpy).toHaveBeenCalledWith(
                'dicethrone',
                'match-locked-1',
                expect.objectContaining({
                    playerName: 'Guest',
                    data: expect.objectContaining({
                        guestId: 'guest-1',
                        password: '1234',
                    }),
                }),
            );
        });
    });

    it('未保存过 AI 偏好时，创建房间弹窗默认传入空偏好', async () => {
        markGamePackageInstalled();
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));

        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });

        expect(latestCreateRoomModalProps.current).toEqual(
            expect.objectContaining({
                initialPreferences: null,
            }),
        );
    });

    it('package-managed 游戏默认只渲染悬浮下载按钮', () => {
        render(createElement(GameDetailsModal, baseProps));

        expect(screen.getByTestId('game-details-mobile-package-toggle')).toBeInTheDocument();
        expect(screen.queryByTestId('game-details-mobile-package-card')).toBeNull();
        expect(screen.queryByText('packageManager.installAction')).toBeNull();
    });

    it('点击悬浮下载按钮后展开卡片，并可通过外层叉收起', () => {
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));

        expect(screen.getByTestId('game-details-mobile-package-card')).toBeInTheDocument();
        expect(screen.getByText('packageManager.installAction')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('game-details-mobile-package-card-collapse'));

        expect(screen.queryByTestId('game-details-mobile-package-card')).toBeNull();
        expect(screen.getByTestId('game-details-mobile-package-toggle')).toBeInTheDocument();
    });

    it('打开详情后会预取远端素材包状态，并在下载卡片上显示同步完成', async () => {
        vi.mocked(manifestClient.resolveGamePackageManifest).mockImplementationOnce(async (gameId: string, delivery?: {
            runtimeChannel?: string;
            modulePackId?: string;
            assetPackId?: string;
        }) => ({
            gameId,
            runtimeChannel: delivery?.runtimeChannel?.trim() || 'stable',
            modulePackId: delivery?.modulePackId?.trim(),
            assetPackId: delivery?.assetPackId?.trim(),
            modulePackVersion: 'test-module-pack-v1',
            assetPackVersion: 'test-asset-pack-v1',
            assetPackBytes: 12 * 1024 * 1024,
            assetPackUrl: `https://example.com/${gameId}.zip`,
            source: 'remote',
        }));

        render(createElement(GameDetailsModal, baseProps));

        await waitFor(() => {
            expect(vi.mocked(manifestClient.resolveGamePackageManifest)).toHaveBeenCalledTimes(1);
        });

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));

        expect(await screen.findByText('packageManager.packageSyncCompleted')).toBeInTheDocument();
        expect(screen.queryByText('packageManager.sizeUnknown')).toBeNull();
    });

    it('网页版不渲染 package-managed 下载入口', () => {
        setWebRuntime();
        render(createElement(GameDetailsModal, baseProps));

        expect(screen.queryByTestId('game-details-mobile-package-toggle')).toBeNull();
        expect(screen.queryByTestId('game-details-mobile-package-card')).toBeNull();
        expect(screen.queryByText('packageManager.installAction')).toBeNull();
    });

    it('相同 package 状态快照在重挂载后只记录一次日志', () => {
        const firstRender = render(createElement(GameDetailsModal, baseProps));
        firstRender.unmount();
        render(createElement(GameDetailsModal, baseProps));

        const packageStateLogs = mockLoggerInfo.mock.calls.filter(
            ([message]) => message === '[GameDetailsModal] 游戏包状态变化',
        );

        expect(packageStateLogs).toHaveLength(1);
        expect(packageStateLogs[0]?.[1]).toEqual(expect.objectContaining({
            gameId: 'dicethrone',
            status: 'not-installed',
        }));
    });

    it('未下载 package-managed 游戏时，创建房间仍走普通网页流程', async () => {
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));

        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
        expect(screen.queryByText('package-install-confirm')).toBeNull();
        expect(latestPackageInstallModalProps.current).toBeNull();
    });

    it('模拟安装成功后关闭确认弹窗，不回退到确认下载', async () => {
        vi.mocked(nativeGamePackagePlugin.createNativeGamePackageInstallHandle).mockImplementationOnce(
            async (_manifest, options) => {
                const installedState = {
                    gameId: 'dicethrone',
                    runtimeChannel: 'stable',
                    status: 'installed' as const,
                    modulePackId: 'dicethrone',
                    assetPackId: 'dicethrone',
                    installedVersion: 'test-asset-pack-v1',
                    localAssetBaseUrl: '/_capacitor_file_/data/user/0/top.easyboardgame.app.debug/files/game-packages/dicethrone/current/assets',
                    updatedAt: Date.now(),
                };

                return {
                    cancel: vi.fn(),
                    finished: (async () => {
                        options.onStateChange(installedState);
                        return installedState;
                    })(),
                };
            },
        );

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));
        fireEvent.click(screen.getByText('packageManager.installAction'));
        expect(screen.getByText('package-install-confirm')).toBeInTheDocument();

        const modalProps = latestPackageInstallModalProps.current as null | {
            onConfirm?: () => Promise<void>;
        };

        expect(modalProps?.onConfirm).toBeTypeOf('function');

        await act(async () => {
            await modalProps?.onConfirm?.();
        });

        await waitFor(() => {
            expect(screen.queryByText('package-install-confirm')).toBeNull();
        }, { timeout: 4000 });
    }, 10000);

    it('确认下载时远端清单仍缺素材包地址，不调用原生安装器', async () => {
        vi.mocked(manifestClient.resolveGamePackageManifest).mockResolvedValue({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
            modulePackVersion: 'test-module-pack-v1',
            assetPackVersion: 'test-asset-pack-v1',
            source: 'remote',
        });

        render(createElement(GameDetailsModal, baseProps));

        await waitFor(() => {
            expect(vi.mocked(manifestClient.resolveGamePackageManifest)).toHaveBeenCalledTimes(1);
        });

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));
        fireEvent.click(screen.getByText('packageManager.installAction'));
        expect(screen.getByText('package-install-confirm')).toBeInTheDocument();

        const modalProps = latestPackageInstallModalProps.current as null | {
            onConfirm?: () => Promise<void>;
        };
        expect(modalProps?.onConfirm).toBeTypeOf('function');

        await act(async () => {
            await modalProps?.onConfirm?.();
        });

        expect(nativeGamePackagePlugin.createNativeGamePackageInstallHandle).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText('packageManager.manifestMissingHint')).toBeInTheDocument();
        });
    });

    it('确认下载进行中时重复点击只触发一次 re-resolve', async () => {
        vi.mocked(manifestClient.resolveGamePackageManifest).mockImplementationOnce(async (gameId: string, delivery?: {
            runtimeChannel?: string;
            modulePackId?: string;
            assetPackId?: string;
        }) => ({
            gameId,
            runtimeChannel: delivery?.runtimeChannel?.trim() || 'stable',
            modulePackId: delivery?.modulePackId?.trim(),
            assetPackId: delivery?.assetPackId?.trim(),
            modulePackVersion: 'test-module-pack-v1',
            assetPackVersion: 'test-asset-pack-v1',
            source: 'remote',
        }));

        let resolveManifestPromise: ((value: {
            gameId: string;
            runtimeChannel: string;
            modulePackId?: string;
            assetPackId?: string;
            modulePackVersion?: string;
            assetPackVersion?: string;
            assetPackUrl?: string;
            source: 'fallback' | 'remote';
        }) => void) | null = null;

        vi.mocked(nativeGamePackagePlugin.createNativeGamePackageInstallHandle).mockResolvedValueOnce({
            cancel: vi.fn(),
            finished: Promise.resolve({
                gameId: 'dicethrone',
                runtimeChannel: 'stable',
                status: 'installed',
                installedVersion: 'test-asset-pack-v1',
                localAssetBaseUrl: '/_capacitor_file_/data/user/0/top.easyboardgame.app.debug/files/game-packages/dicethrone/current/assets',
                updatedAt: Date.now(),
            }),
        });

        render(createElement(GameDetailsModal, baseProps));

        await waitFor(() => {
            expect(vi.mocked(manifestClient.resolveGamePackageManifest)).toHaveBeenCalledTimes(1);
        });
        await act(async () => {});
        vi.mocked(manifestClient.resolveGamePackageManifest).mockClear();
        vi.mocked(manifestClient.resolveGamePackageManifest).mockImplementationOnce(async () => await new Promise((resolve) => {
            resolveManifestPromise = resolve;
        }));

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));
        fireEvent.click(screen.getByText('packageManager.installAction'));
        expect(screen.getByText('package-install-confirm')).toBeInTheDocument();

        const modalProps = latestPackageInstallModalProps.current as null | {
            onConfirm?: () => Promise<void>;
        };
        expect(modalProps?.onConfirm).toBeTypeOf('function');

        let firstConfirm: Promise<void> | undefined;
        let secondConfirm: Promise<void> | undefined;
        await act(async () => {
            firstConfirm = modalProps?.onConfirm?.();
            secondConfirm = modalProps?.onConfirm?.();
        });

        expect(vi.mocked(manifestClient.resolveGamePackageManifest)).toHaveBeenCalledTimes(1);

        resolveManifestPromise?.({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
            modulePackVersion: 'test-module-pack-v1',
            assetPackVersion: 'test-asset-pack-v1',
            assetPackUrl: 'https://example.com/dicethrone.zip',
            source: 'remote',
        });

        await act(async () => {
            await Promise.allSettled([firstConfirm, secondConfirm]);
        });
    });

    it('冷启动读到陈旧 queued 持久化状态时，回退为可重试失败态', async () => {
        markGamePackageQueued();
        render(createElement(GameDetailsModal, baseProps));

        expect(screen.getByTestId('game-details-mobile-package-toggle')).toBeInTheDocument();
        expandMobilePackageCardIfNeeded();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'packageManager.retryAction' })).toBeInTheDocument();
        });
        expect(screen.queryByText('packageManager.progress.label')).toBeNull();

        const stored = JSON.parse(window.localStorage.getItem('mobile-package-state:dicethrone') ?? '{}');
        expect(stored).toEqual(expect.objectContaining({
            status: 'failed',
            errorMessage: '上次下载未完成，请重新发起。',
        }));
    });

    it('冷启动读到原生 downloading 但任务已不存在时，回退为可重试失败态', async () => {
        vi.mocked(nativeGamePackagePlugin.readNativeGamePackageInstallState).mockResolvedValueOnce({
            exists: true,
            state: {
                gameId: 'dicethrone',
                status: 'downloading',
                progressMode: 'determinate',
                progressPercent: 3,
                installedVersion: 'test-asset-pack-v1',
                updatedAt: Date.now(),
            },
            taskRunning: false,
        });

        render(createElement(GameDetailsModal, baseProps));

        expandMobilePackageCardIfNeeded();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'packageManager.retryAction' })).toBeInTheDocument();
        });
        expect(screen.queryByText('packageManager.progress.label')).toBeNull();

        const stored = JSON.parse(window.localStorage.getItem('mobile-package-state:dicethrone') ?? '{}');
        expect(stored).toEqual(expect.objectContaining({
            status: 'failed',
            errorMessage: '上次下载未完成，请重新发起。',
        }));
    });

    it('原生已自愈清掉坏包时，前端同步清理残留 installed 状态', async () => {
        markGamePackageInstalled('dicethrone', 'test-asset-pack-v1');
        vi.mocked(nativeGamePackagePlugin.readNativeGamePackageInstallState).mockResolvedValueOnce({
            exists: false,
            state: {
                gameId: 'dicethrone',
                status: 'not-installed',
                updatedAt: Date.now(),
            },
            taskRunning: false,
        });

        const fallbackState = createDefaultGamePackageState('dicethrone', {
            mode: 'package-managed',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
        });
        syncGamePackageState('dicethrone', fallbackState);

        const nextState = await refreshGamePackageStateFromNativeTask('dicethrone', fallbackState);

        expect(nextState).toEqual(expect.objectContaining({
            status: 'not-installed',
            installedVersion: undefined,
            localAssetBaseUrl: undefined,
            errorCode: undefined,
            errorMessage: undefined,
        }));
        expect(JSON.parse(window.localStorage.getItem('mobile-package-state:dicethrone') ?? '{}')).toEqual(
            expect.objectContaining({
                status: 'not-installed',
            }),
        );
    });

    it('原生任务仍在运行但状态文件缺失时，前端应保留下载中状态而不是重置为未安装', async () => {
        const fallbackState = createDefaultGamePackageState('dicethrone', {
            mode: 'package-managed',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
        });

        window.localStorage.setItem('mobile-package-state:dicethrone', JSON.stringify({
            ...fallbackState,
            status: 'downloading',
            progressMode: 'determinate',
            progressPercent: 42,
            updatedAt: Date.now(),
        }));
        syncGamePackageState('dicethrone', fallbackState);

        vi.mocked(nativeGamePackagePlugin.readNativeGamePackageInstallState).mockResolvedValueOnce({
            exists: false,
            state: {
                gameId: 'dicethrone',
                status: 'manifest',
                updatedAt: Date.now(),
            },
            taskRunning: true,
        });

        const nextState = await refreshGamePackageStateFromNativeTask('dicethrone', fallbackState);

        expect(nextState).toEqual(expect.objectContaining({
            status: 'downloading',
            progressMode: 'determinate',
            progressPercent: 42,
        }));
        expect(JSON.parse(window.localStorage.getItem('mobile-package-state:dicethrone') ?? '{}')).toEqual(
            expect.objectContaining({
                status: 'downloading',
                progressPercent: 42,
            }),
        );
    });

    it('安装任务运行时会轮询原生下载百分比，避免前端卡片一直显示等待中', async () => {
        vi.useFakeTimers();
        let resolveFinished: ((value: {
            gameId: string;
            runtimeChannel: string;
            status: 'installed';
            installedVersion: string;
            localAssetBaseUrl: string;
            updatedAt: number;
        }) => void) | null = null;
        vi.mocked(nativeGamePackagePlugin.createNativeGamePackageInstallHandle).mockImplementationOnce(
            async (_manifest, options) => ({
                cancel: vi.fn(),
                finished: new Promise((resolve) => {
                    resolveFinished = (value) => {
                        options.onStateChange(value);
                        resolve(value);
                    };
                }),
            }),
        );
        vi.mocked(nativeGamePackagePlugin.readNativeGamePackageInstallState).mockResolvedValueOnce({
            exists: true,
            state: {
                gameId: 'dicethrone',
                status: 'downloading',
                progressMode: 'determinate',
                progressPercent: 42,
                installedVersion: 'test-asset-pack-v2',
                updatedAt: Date.now(),
            },
            taskRunning: true,
        });

        const fallbackState = createDefaultGamePackageState('dicethrone', {
            mode: 'package-managed',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
        });
        syncGamePackageState('dicethrone', fallbackState);

        const installPromise = startGamePackageInstall({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
            assetPackVersion: 'test-asset-pack-v2',
            assetPackUrl: 'https://example.com/dicethrone-v2.zip',
            source: 'remote',
        }, 'packageManager.runtimeUnsupported');

        await vi.advanceTimersByTimeAsync(1000);

        expect(JSON.parse(window.localStorage.getItem('mobile-package-state:dicethrone') ?? '{}')).toEqual(
            expect.objectContaining({
                status: 'downloading',
                progressMode: 'determinate',
                progressPercent: 42,
            }),
        );

        resolveFinished?.({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            status: 'installed',
            installedVersion: 'test-asset-pack-v2',
            localAssetBaseUrl: '/_capacitor_file_/data/user/0/top.easyboardgame.app.debug/files/game-packages/dicethrone/current/assets',
            updatedAt: Date.now(),
        });

        await expect(installPromise).resolves.toEqual(expect.objectContaining({
            status: 'installed',
            installedVersion: 'test-asset-pack-v2',
        }));
    });

    it('原生安装器创建卡住时，3 秒内失败而不是无限停留 queued', async () => {
        vi.useFakeTimers();
        vi.mocked(nativeGamePackagePlugin.createNativeGamePackageInstallHandle).mockImplementationOnce(
            async () => await new Promise(() => {}),
        );

        const fallbackState = createDefaultGamePackageState('dicethrone', {
            mode: 'package-managed',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
        });
        syncGamePackageState('dicethrone', fallbackState);

        const installPromise = startGamePackageInstall({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
            assetPackVersion: 'test-asset-pack-v1',
            assetPackUrl: 'https://example.com/dicethrone.zip',
            source: 'remote',
        }, 'packageManager.runtimeUnsupported');

        await vi.advanceTimersByTimeAsync(3100);

        await expect(installPromise).resolves.toEqual(expect.objectContaining({
            status: 'failed',
            errorMessage: '创建原生安装器超时，请重新发起。',
        }));
    });

    it('通知权限未处理完前，不提前写入 queued，授权后才进入下载队列', async () => {
        let resolvePermission: ((value: {
            required: boolean;
            granted: boolean;
            canPrompt: boolean;
            state: 'granted';
            requested: boolean;
        }) => void) | null = null;
        let resolveFinished: ((value: {
            gameId: string;
            runtimeChannel: string;
            status: 'installed';
            modulePackId: string;
            assetPackId: string;
            installedVersion: string;
            localAssetBaseUrl: string;
            updatedAt: number;
        }) => void) | null = null;

        vi.mocked(nativeGamePackagePlugin.ensureNativeDownloadNotificationPermission).mockImplementationOnce(
            () => new Promise((resolve) => {
                resolvePermission = resolve;
            }),
        );
        vi.mocked(nativeGamePackagePlugin.createNativeGamePackageInstallHandle).mockImplementationOnce(
            async (_manifest, options) => ({
                cancel: vi.fn(),
                finished: new Promise((resolve) => {
                    resolveFinished = (value) => {
                        options.onStateChange(value);
                        resolve(value);
                    };
                }),
            }),
        );

        const fallbackState = createDefaultGamePackageState('dicethrone', {
            mode: 'package-managed',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
        });
        syncGamePackageState('dicethrone', fallbackState);

        const installPromise = startGamePackageInstall({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
            assetPackVersion: 'test-asset-pack-v1',
            assetPackUrl: 'https://example.com/dicethrone.zip',
            source: 'remote',
        }, 'packageManager.runtimeUnsupported');

        expect(vi.mocked(nativeGamePackagePlugin.createNativeGamePackageInstallHandle)).not.toHaveBeenCalled();
        expect(JSON.parse(window.localStorage.getItem('mobile-package-state:dicethrone') ?? '{}')).toEqual(expect.objectContaining({
            status: 'not-installed',
        }));

        resolvePermission?.({
            required: true,
            granted: true,
            canPrompt: false,
            state: 'granted',
            requested: true,
        });

        await waitFor(() => {
            expect(vi.mocked(nativeGamePackagePlugin.createNativeGamePackageInstallHandle)).toHaveBeenCalledTimes(1);
            expect(JSON.parse(window.localStorage.getItem('mobile-package-state:dicethrone') ?? '{}')).toEqual(expect.objectContaining({
                status: 'queued',
            }));
        });

        resolveFinished?.({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            status: 'installed',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
            installedVersion: 'test-asset-pack-v1',
            localAssetBaseUrl: '/_capacitor_file_/data/user/0/top.easyboardgame.app.debug/files/game-packages/dicethrone/current/assets',
            updatedAt: Date.now(),
        });

        await expect(installPromise).resolves.toEqual(expect.objectContaining({
            status: 'installed',
            installedVersion: 'test-asset-pack-v1',
        }));
    });

    it('通知权限被拒绝时，不进入 queued，直接回退为失败态', async () => {
        vi.mocked(nativeGamePackagePlugin.ensureNativeDownloadNotificationPermission).mockResolvedValueOnce({
            required: true,
            granted: false,
            canPrompt: false,
            state: 'denied',
            requested: true,
            message: '通知权限已被拒绝，请到系统设置中开启后再重试下载。',
        });

        const fallbackState = createDefaultGamePackageState('dicethrone', {
            mode: 'package-managed',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
        });
        syncGamePackageState('dicethrone', fallbackState);

        await expect(startGamePackageInstall({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
            assetPackVersion: 'test-asset-pack-v1',
            assetPackUrl: 'https://example.com/dicethrone.zip',
            source: 'remote',
        }, 'packageManager.runtimeUnsupported')).resolves.toEqual(expect.objectContaining({
            status: 'failed',
            errorCode: 'notification-permission-required',
            errorMessage: '通知权限已被拒绝，请到系统设置中开启后再重试下载。',
        }));

        expect(vi.mocked(nativeGamePackagePlugin.createNativeGamePackageInstallHandle)).not.toHaveBeenCalled();
        expect(JSON.parse(window.localStorage.getItem('mobile-package-state:dicethrone') ?? '{}')).toEqual(expect.objectContaining({
            status: 'failed',
            errorCode: 'notification-permission-required',
        }));
    });

    it('冷启动读到通知权限失败且系统不可再弹窗时，显示打开通知设置入口', async () => {
        window.localStorage.setItem('mobile-package-state:dicethrone', JSON.stringify({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            status: 'failed',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
            errorCode: 'notification-permission-required',
            errorMessage: '通知权限已被拒绝，请到系统设置中开启后再重试下载。',
            updatedAt: Date.now(),
        }));
        vi.mocked(nativeGamePackagePlugin.getNativeDownloadNotificationPermissionStatus).mockResolvedValue({
            required: true,
            granted: false,
            canPrompt: false,
            state: 'denied',
            requested: true,
            message: '通知权限已被拒绝，请到系统设置中开启后再重试下载。',
        });
        vi.mocked(nativeGamePackagePlugin.openNativeDownloadNotificationSettings).mockResolvedValue(true);

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'packageManager.notificationSettingsAction' })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'packageManager.notificationSettingsAction' }));

        expect(nativeGamePackagePlugin.openNativeDownloadNotificationSettings).toHaveBeenCalledTimes(1);
    });

    it('通知权限恢复后，冷启动会把旧失败态恢复成可重新下载', async () => {
        window.localStorage.setItem('mobile-package-state:dicethrone', JSON.stringify({
            gameId: 'dicethrone',
            runtimeChannel: 'stable',
            status: 'failed',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
            errorCode: 'notification-permission-required',
            errorMessage: '通知权限已被拒绝，请到系统设置中开启后再重试下载。',
            updatedAt: Date.now(),
        }));
        vi.mocked(nativeGamePackagePlugin.getNativeDownloadNotificationPermissionStatus).mockResolvedValue({
            required: true,
            granted: true,
            canPrompt: false,
            state: 'granted',
            requested: true,
        });

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'packageManager.installAction' })).toBeInTheDocument();
        });

        const stored = JSON.parse(window.localStorage.getItem('mobile-package-state:dicethrone') ?? '{}');
        expect(stored).toEqual(expect.objectContaining({
            status: 'not-installed',
        }));
        expect(stored.errorCode).toBeUndefined();
    });

    it('下载完成后，package-managed 游戏允许创建房间', async () => {
        markGamePackageInstalled();
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));
        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
    });

    it('已下载 package-managed 游戏时，默认保留删除素材包圆球入口且不展开卡片', () => {
        markGamePackageInstalled('dicethrone', 'test-asset-pack-v1');
        render(createElement(GameDetailsModal, baseProps));

        expect(screen.getByTestId('game-details-mobile-package-toggle')).toBeInTheDocument();
        expect(screen.queryByTestId('game-details-mobile-package-card')).toBeNull();
        expect(screen.getByTestId('game-details-title')).toHaveAttribute('data-installed-version', 'v1');
        expect(screen.queryByText('packageManager.installedTitle')).toBeNull();
    });

    it('已下载 package-managed 游戏展开删除素材包卡片后，可通过外层叉收起', () => {
        markGamePackageInstalled('dicethrone', 'test-asset-pack-v1');
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));

        expect(screen.getByTestId('game-details-mobile-package-card')).toBeInTheDocument();
        expect(screen.getByText('packageManager.installedTitle')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('game-details-mobile-package-card-collapse'));

        expect(screen.queryByTestId('game-details-mobile-package-card')).toBeNull();
        expect(screen.getByTestId('game-details-mobile-package-toggle')).toBeInTheDocument();
    });

    it('已安装旧版本 package-managed 游戏时，会重新显示下载安装入口', async () => {
        markGamePackageInstalled('dicethrone', '0.5.0');
        render(createElement(GameDetailsModal, baseProps));

        await waitFor(() => {
            expect(screen.getByTestId('game-details-mobile-package-card')).toBeInTheDocument();
        });

        expect(screen.getByText('packageManager.installAction')).toBeInTheDocument();
        expect(screen.getByTestId('game-details-title')).not.toHaveAttribute('data-installed-version');
    });

    it('已安装旧版本 package-managed 游戏时，点击下载安装会保留更新确认弹窗', async () => {
        markGamePackageInstalled('dicethrone', '0.5.0');
        render(createElement(GameDetailsModal, baseProps));

        await waitFor(() => {
            expect(screen.getByText('packageManager.installAction')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('packageManager.installAction'));

        await waitFor(() => {
            expect(screen.getByText('package-install-confirm')).toBeInTheDocument();
        });

        await act(async () => {});

        expect(screen.getByText('package-install-confirm')).toBeInTheDocument();
        expect(latestPackageInstallModalProps.current).toEqual(expect.objectContaining({
            closeOnBackdrop: true,
            state: expect.objectContaining({
                status: 'installed',
                installedVersion: '0.5.0',
                isUpdateAvailable: true,
                availableVersion: 'test-asset-pack-v1',
            }),
        }));
    });

    it('已安装状态缺少版本号时，回退显示下载入口而不是已完成角标', () => {
        markGamePackageInstalled('dicethrone', '');
        render(createElement(GameDetailsModal, baseProps));

        expect(screen.getByTestId('game-details-mobile-package-toggle')).toBeInTheDocument();
        expect(screen.queryByTestId('game-details-mobile-package-card')).toBeNull();

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));

        expect(screen.getByText('packageManager.installAction')).toBeInTheDocument();
    });

    it('已安装状态为 mock-installed 时，回退显示下载入口而不是误判为已安装', () => {
        markGamePackageInstalled('dicethrone', 'mock-installed');
        render(createElement(GameDetailsModal, baseProps));

        expect(screen.getByTestId('game-details-mobile-package-toggle')).toBeInTheDocument();
        expect(screen.queryByTestId('game-details-mobile-package-card')).toBeNull();

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));

        expect(screen.getByText('packageManager.installAction')).toBeInTheDocument();
        expect(screen.queryByText('packageManager.installedTitle')).toBeNull();
    });

    it('已安装状态为 mock-installed 时，会自动把本地状态归一化回未安装', async () => {
        markGamePackageInstalled('dicethrone', 'mock-installed');
        render(createElement(GameDetailsModal, baseProps));

        await waitFor(() => {
            const stored = window.localStorage.getItem('mobile-package-state:dicethrone');
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored!);
            expect(parsed).toEqual(expect.objectContaining({
                status: 'not-installed',
            }));
            expect(parsed).not.toHaveProperty('installedVersion');
        });
    });

    it('已安装状态缺少版本号时，创建房间仍走普通网页流程', async () => {
        markGamePackageInstalled('dicethrone', '');
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));

        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
        expect(screen.queryByText('package-install-confirm')).toBeNull();
        expect(latestPackageInstallModalProps.current).toBeNull();
    });

    it('已安装状态缺少版本号时，点击下载安装仍保持确认弹窗并按未安装态处理', async () => {
        markGamePackageInstalled('dicethrone', '');
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));
        fireEvent.click(screen.getByText('packageManager.installAction'));

        await waitFor(() => {
            expect(screen.getByText('package-install-confirm')).toBeInTheDocument();
        });

        expect(latestPackageInstallModalProps.current).toEqual(expect.objectContaining({
            closeOnBackdrop: true,
            state: expect.objectContaining({
                status: 'not-installed',
                installedVersion: undefined,
            }),
        }));
    });

    it('失败状态默认收起为重试按钮，不自动展开下载详情', () => {
        markGamePackageFailed();
        render(createElement(GameDetailsModal, baseProps));

        expect(screen.getByTestId('game-details-mobile-package-toggle')).toBeInTheDocument();
        expect(screen.queryByTestId('game-details-mobile-package-card')).toBeNull();
        expect(screen.queryByText('packageManager.retryAction')).toBeNull();

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));

        expect(screen.getByTestId('game-details-mobile-package-card')).toBeInTheDocument();
        expect(screen.getByText('packageManager.retryAction')).toBeInTheDocument();
    });

    it('校验失败状态展开后显示重新下载素材包按钮', () => {
        markGamePackageFailed('dicethrone', '本地临时文件校验失败');
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByTestId('game-details-mobile-package-toggle'));

        expect(screen.getByTestId('game-details-mobile-package-card')).toBeInTheDocument();
        expect(screen.getByText('packageManager.checksumMismatchHint')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'packageManager.retryFullDownloadAction' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'packageManager.retryAction' })).toBeNull();
    });

    it('标记必须更新时，默认展开更新卡片并可发起原生 App 更新', () => {
        getGameByIdMock.mockImplementation((gameId: string) => {
            if (gameId !== 'dicethrone') return null;
            return buildMockGameManifest({
                mobileDelivery: {
                    mode: 'package-managed',
                    runtimeChannel: 'stable',
                    modulePackId: 'dicethrone',
                    assetPackId: 'dicethrone',
                    requiresAppUpdate: true,
                    requiredAppVersion: '0.6.0',
                },
            });
        });

        render(createElement(GameDetailsModal, baseProps));

        expect(screen.getByTestId('game-details-mobile-package-toggle')).toBeInTheDocument();
        expect(screen.getByTestId('game-details-mobile-package-card')).toBeInTheDocument();
        expect(screen.getByText('packageManager.updateRequiredTitle')).toBeInTheDocument();
        expect(screen.queryByText('packageManager.installAction')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'packageManager.updateAppAction' }));

        expect(requestAndroidNativeUpdateCheckMock).toHaveBeenCalledTimes(1);
        expect(requestAndroidNativeUpdateCheckMock).toHaveBeenCalledWith({ interactive: true });
    });

    it('未下载 package-managed 游戏时，教程入口会立即跳转并在后台补拉 tutorial', () => {
        prefetchGameImplementationMock.mockReturnValue(new Promise(() => {}));
        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.tutorial'));

        expect(prefetchGameImplementationMock).toHaveBeenCalledWith('dicethrone', { includeTutorial: true });
        expect(navigateMock).toHaveBeenCalledWith('/play/dicethrone/tutorial');
        expect(screen.queryByText('package-install-confirm')).toBeNull();
        expect(latestPackageInstallModalProps.current).toBeNull();
    });

    it('未注册教程模块时不显示教程入口', () => {
        hasGameTutorialLoaderMock.mockReturnValue(false);

        render(createElement(GameDetailsModal, baseProps));

        expect(screen.queryByText('actions.tutorial')).toBeNull();
    });

    it('标记必须更新时，创建房间仍走普通网页流程', async () => {
        getGameByIdMock.mockImplementation((gameId: string) => {
            if (gameId !== 'dicethrone') return null;
            return buildMockGameManifest({
                mobileDelivery: {
                    mode: 'package-managed',
                    runtimeChannel: 'stable',
                    modulePackId: 'dicethrone',
                    assetPackId: 'dicethrone',
                    requiresAppUpdate: true,
                    requiredAppVersion: '0.6.0',
                },
            });
        });

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));

        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
        expect(screen.queryByText('package-install-confirm')).toBeNull();
        expect(latestPackageInstallModalProps.current).toBeNull();
    });

    it('观战前发现房间 404 时不再跳进对局页，并提示房间已销毁', async () => {
        markGamePackageInstalled();
        vi.mocked(lobbySocket.subscribe).mockImplementationOnce((_gameId, callback) => {
            callback([{
                matchID: 'match-spectate',
                players: [
                    { id: 0, name: 'A' },
                    { id: 1, name: 'B' },
                ],
                totalSeats: 2,
                gameName: 'dicethrone',
                roomName: '测试房间',
                ownerKey: 'owner-2',
                ownerType: 'guest',
                isLocked: false,
            }]);
            return () => {};
        });
        vi.spyOn(matchApi, 'getMatch').mockRejectedValueOnce(new Error('404: Match not found'));

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByTitle('actions.spectate'));

        await waitFor(() => {
            expect(navigateMock).not.toHaveBeenCalledWith('/play/dicethrone/match/match-spectate?spectate=1');
        });
        expect(vi.mocked(lobbySocket.requestRefresh)).toHaveBeenCalledWith('dicethrone');
        expect(toastMock.warning).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' });
    });

    it('builtin 游戏不渲染移动端包管理入口', () => {
        getGameByIdMock.mockImplementation((gameId: string) => {
            if (gameId !== 'dicethrone') return null;
            return buildMockGameManifest({
                mobileDelivery: {
                    mode: 'builtin',
                },
            });
        });

        render(createElement(GameDetailsModal, baseProps));

        expect(screen.queryByTestId('game-details-mobile-package-card')).toBeNull();
    });

    it('创建房间时显示进入对局 loading', async () => {
        markGamePackageInstalled();
        let resolveCreateMatch: ((value: { matchID: string; ownerPlayerID?: string; ownerCredentials?: string }) => void) | null = null;
        vi.spyOn(matchApi, 'createMatch').mockImplementationOnce(() => new Promise((resolve) => {
            resolveCreateMatch = resolve as (value: { matchID: string; ownerPlayerID?: string; ownerCredentials?: string }) => void;
        }));
        vi.spyOn(matchApi, 'claimSeat').mockResolvedValueOnce({ playerCredentials: 'ai-seat-creds' });

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));
        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('mock-create-room-confirm'));

        await waitFor(() => {
            expect(screen.getByText('matchRoom.title.creating')).toBeInTheDocument();
            expect(screen.getByText('matchRoom.creatingRoom')).toBeInTheDocument();
            expect(screen.getByTestId('loading-screen-progress')).toHaveTextContent('matchRoom.loadingProgress.preparingRoom');
        });

        resolveCreateMatch?.({ matchID: 'match-created', ownerPlayerID: '0', ownerCredentials: 'seat-creds' });

        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/play/dicethrone/match/match-created?playerID=0');
        });
    });

    it('创建房间确认被连续触发时，只会提交一次 create 请求', async () => {
        markGamePackageInstalled();
        let resolveCreateMatch: ((value: { matchID: string; ownerPlayerID?: string; ownerCredentials?: string }) => void) | null = null;
        const createMatchSpy = vi.spyOn(matchApi, 'createMatch').mockImplementationOnce(() => new Promise((resolve) => {
            resolveCreateMatch = resolve as (value: { matchID: string; ownerPlayerID?: string; ownerCredentials?: string }) => void;
        }));
        vi.spyOn(matchApi, 'claimSeat').mockResolvedValueOnce({ playerCredentials: 'ai-seat-creds' });

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));
        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });

        const confirmButton = screen.getByText('mock-create-room-confirm');
        fireEvent.click(confirmButton);
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(createMatchSpy).toHaveBeenCalledTimes(1);
        });

        resolveCreateMatch?.({
            matchID: 'match-created',
            ownerPlayerID: '0',
            ownerCredentials: 'seat-creds',
        });

        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/play/dicethrone/match/match-created?playerID=0');
        });
    });

    it('仅有本地旧房主状态时，会隐藏创建按钮并保留返回/强制退出入口', async () => {
        markGamePackageInstalled();
        vi.mocked(matchStatus.getOwnerActiveMatch).mockImplementation(() => ({
            matchID: 'match-stale',
            gameName: 'dicethrone',
            ownerKey: 'owner-1',
            ownerType: 'guest',
        }));

        render(createElement(GameDetailsModal, baseProps));

        expect(screen.queryByTestId('game-details-open-create-room')).toBeNull();
        expect(screen.getByText('activeMatch.notice')).toBeInTheDocument();
        expect(screen.getByText('activeMatch.return')).toBeInTheDocument();
        expect(screen.getByText('actions.forceExit')).toBeInTheDocument();
    });

    it('已有旧房间凭证时，会隐藏创建按钮并保留返回/销毁入口', async () => {
        markGamePackageInstalled();
        const stored = buildStored({
            matchID: 'match-old',
            playerID: '0',
            credentials: 'host-creds',
            gameName: 'dicethrone',
        });
        vi.mocked(matchStatus.getLatestStoredMatchCredentials).mockImplementation(() => stored);
        vi.mocked(matchStatus.listStoredMatchCredentials).mockImplementation(() => [stored]);

        render(createElement(GameDetailsModal, baseProps));

        expect(screen.queryByTestId('game-details-open-create-room')).toBeNull();
        expect(screen.getByText('activeMatch.notice')).toBeInTheDocument();
        expect(screen.getByText('activeMatch.return')).toBeInTheDocument();
        expect(screen.getByText('actions.destroy')).toBeInTheDocument();
    });

    it('服务端返回 ACTIVE_MATCH_EXISTS 时，会弹出强制清理确认并带 force 重试创建', async () => {
        markGamePackageInstalled();
        const activeMatchExistsError = Object.assign(
            new Error('409: {"error":"ACTIVE_MATCH_EXISTS","gameName":"dicethrone","matchID":"match-old","canForceReplace":true}'),
            {
                status: 409,
                details: '{"error":"ACTIVE_MATCH_EXISTS","gameName":"dicethrone","matchID":"match-old","canForceReplace":true}',
                code: 'ACTIVE_MATCH_EXISTS',
            },
        );
        const createMatchSpy = vi.spyOn(matchApi, 'createMatch')
            .mockRejectedValueOnce(activeMatchExistsError)
            .mockResolvedValueOnce({
                matchID: 'match-new',
                ownerPlayerID: '0',
                ownerCredentials: 'seat-creds',
            });
        vi.spyOn(matchApi, 'claimSeat').mockResolvedValueOnce({ playerCredentials: 'ai-seat-creds' });

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));
        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('mock-create-room-confirm'));

        await waitFor(() => {
            expect(openModalMock).toHaveBeenCalled();
        });

        const forceModalConfig = openModalMock.mock.calls.at(-1)?.[0] as {
            render: (props: { close: () => void; closeOnBackdrop: boolean }) => ReactNode;
        };
        render(forceModalConfig.render({
            close: vi.fn(),
            closeOnBackdrop: true,
        }));

        expect(latestConfirmModalProps.current).toMatchObject({
            title: 'confirm.forceReplaceOwnerRoom.title',
            description: 'confirm.forceReplaceOwnerRoom.description',
            confirmText: 'confirm.forceReplaceOwnerRoom.confirm',
        });

        fireEvent.click(screen.getByText('mock-confirm-modal-confirm'));

        await waitFor(() => {
            expect(createMatchSpy).toHaveBeenCalledTimes(2);
        });
        expect(createMatchSpy.mock.calls[0]?.[1]).toMatchObject({
            forceReplaceOwnerRoom: undefined,
        });
        expect(createMatchSpy.mock.calls[1]?.[1]).toMatchObject({
            forceReplaceOwnerRoom: true,
        });
        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/play/dicethrone/match/match-new?playerID=0');
        });
    });

    it('创建房间失败时 toast 会显示错误码和状态码', async () => {
        markGamePackageInstalled();
        const error = Object.assign(new Error('401: Invalid token'), {
            status: 401,
            details: 'Invalid token',
            code: 'INVALID_TOKEN',
        });
        vi.spyOn(matchApi, 'createMatch').mockRejectedValueOnce(error);

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));
        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('mock-create-room-confirm'));

        await waitFor(() => {
            expect(toastMock.error).toHaveBeenCalledWith(
                'error.createRoomInvalidToken （错误码：INVALID_TOKEN / 状态码：401）',
                { kind: 'i18n', key: 'error.createRoomFailed', ns: 'lobby' },
                { dedupeKey: 'create-room-failed.INVALID_TOKEN.401' },
            );
        });
    });

    it('房间已创建但本地收尾失败时，不再提示创建失败并回到大厅刷新', async () => {
        markGamePackageInstalled();
        vi.spyOn(matchApi, 'createMatch').mockResolvedValueOnce({
            matchID: 'match-created',
            ownerPlayerID: '0',
            ownerCredentials: 'seat-creds',
        });
        vi.mocked(matchStatus.persistMatchCredentials).mockImplementationOnce(() => {
            throw new Error('QuotaExceededError');
        });

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));
        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('mock-create-room-confirm'));

        await waitFor(() => {
            expect(toastMock.warning).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomCreatedButEnterFailed', ns: 'lobby' });
        });
        expect(vi.mocked(lobbySocket.requestRefresh)).toHaveBeenCalledWith('dicethrone');
        expect(navigateMock).not.toHaveBeenCalled();
        expect(toastMock.error).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.queryByText('mock-create-room-confirm')).toBeNull();
        });
    });

    it('房间已创建但抢座失败时，会关闭创建弹窗并提示回大厅重试', async () => {
        markGamePackageInstalled();
        vi.spyOn(matchApi, 'createMatch').mockResolvedValueOnce({
            matchID: 'match-created',
            ownerPlayerID: '0',
        });
        vi.mocked(matchStatus.claimSeat).mockResolvedValueOnce({
            success: false,
            error: 'forbidden',
        });

        render(createElement(GameDetailsModal, baseProps));

        fireEvent.click(screen.getByText('actions.createRoom'));
        await waitFor(() => {
            expect(screen.getByText('mock-create-room-confirm')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('mock-create-room-confirm'));

        await waitFor(() => {
            expect(toastMock.warning).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomCreatedButClaimFailed', ns: 'lobby' });
        });
        expect(vi.mocked(lobbySocket.requestRefresh)).toHaveBeenCalledWith('dicethrone');
        expect(navigateMock).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.queryByText('mock-create-room-confirm')).toBeNull();
        });
    });

    it('socket 瞬时错误恢复后不再立刻弹服务不可用提示', async () => {
        vi.useFakeTimers();
        let statusCallback: LobbyStatusCallback | null = null;
        vi.mocked(lobbySocket.subscribeStatus).mockImplementationOnce((callback: LobbyStatusCallback) => {
            statusCallback = callback;
            return () => {};
        });

        render(createElement(GameDetailsModal, baseProps));

        statusCallback?.({ connected: false, lastError: 'websocket error' });
        expect(toastMock.error).not.toHaveBeenCalled();

        statusCallback?.({ connected: true });
        vi.advanceTimersByTime(1600);

        expect(toastMock.error).not.toHaveBeenCalled();
    });
});

describe('localSession helpers', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('ensureLocalMatchSeedSearchParams 会补 seed 且保留原参数', () => {
        const search = ensureLocalMatchSeedSearchParams(new URLSearchParams('players=2&seat1=local-ai'), 'seed-fixed');

        expect(search.get('players')).toBe('2');
        expect(search.get('seat1')).toBe('local-ai');
        expect(search.get('seed')).toBe('seed-fixed');
    });

    it('persist/read/clear local snapshot 正常工作', () => {
        const state = {
            core: { turn: 3 },
            sys: { phase: 'main' },
        } as any;

        persistLocalMatchSnapshot({
            gameId: 'dicethrone',
            seed: 'seed-1',
            numPlayers: 2,
            state,
            randomCursor: 7,
        });

        expect(readLocalMatchSnapshot({
            gameId: 'dicethrone',
            seed: 'seed-1',
            numPlayers: 2,
        })).toMatchObject({
            gameId: 'dicethrone',
            seed: 'seed-1',
            numPlayers: 2,
            randomCursor: 7,
            state,
        });

        expect(readLocalMatchSnapshot({
            gameId: 'dicethrone',
            seed: 'seed-1',
            numPlayers: 3,
        })).toBeNull();

        clearLocalMatchSnapshot('dicethrone', 'seed-1');

        expect(readLocalMatchSnapshot({
            gameId: 'dicethrone',
            seed: 'seed-1',
            numPlayers: 2,
        })).toBeNull();
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
