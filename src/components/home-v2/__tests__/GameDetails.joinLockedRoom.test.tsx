/* @vitest-environment happy-dom */

import { createElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Right as GameDetailsRight } from '../GameDetails';
import * as matchApi from '../../../services/matchApi';
import * as matchStatus from '../../../hooks/match/useMatchStatus';

const navigateMock = vi.fn();
const toastErrorMock = vi.fn();
const toastWarningMock = vi.fn();
const packageMocks = vi.hoisted(() => ({
    nativeAndroidRuntime: false,
    requestInstall: vi.fn(),
    dismissInstall: vi.fn(),
    cancelInstall: vi.fn(),
    confirmInstall: vi.fn(),
    retryInstall: vi.fn(),
    openNotificationSettings: vi.fn(),
    loadGameImplementation: vi.fn(),
    prefetchGameImplementation: vi.fn(),
    ensureGameCriticalImageResolverLoaded: vi.fn(),
    prefetchOnlineMatchRoute: vi.fn(),
    hookResult: null as null | Record<string, unknown>,
    createRoomModalProps: null as null | {
        isOpen?: boolean;
        initialPreferences?: unknown;
        gameManifest?: { id?: string };
        onConfirm?: (config: {
            roomName?: string;
            numPlayers: number;
            ttlSeconds: number;
            password?: string;
            enableAi: boolean;
            minimumActionDelayMs: number;
            seatControllers: Record<string, unknown>;
            setupSelections: Record<string, unknown>;
            setupData?: Record<string, unknown>;
        }) => void | Promise<void>;
    },
}));
let mockMatches = [{
    matchID: 'match-locked-1',
    players: [
        { id: 0, name: 'Host' },
        { id: 1, name: undefined },
    ],
    totalSeats: 2,
    gameName: 'tictactoe',
    roomName: '加锁房间',
    ownerKey: 'owner-2',
    ownerType: 'guest',
    isLocked: true,
}];
let mockOwnerActiveMatch: null | {
    matchID: string;
    gameName: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
} = null;

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: Record<string, unknown>) => {
                if (key === 'setup.expansions.titans') return '泰坦';
                if (key === 'setup.expansions.diy') return 'DIY';
                if (key === 'setup.deckQuery.label') return '余牌查询';
                if (key === 'setup.scenario.shanhaiguan1622') return '剧本二：山海关之议（1622）';
                if (key === 'lobby:rooms.enabledExpansions' || key === 'rooms.enabledExpansions') return '扩展';
                if (key === 'lobby:rooms.scenario' || key === 'rooms.scenario') return '剧本';
                return options?.defaultValue ?? key;
            },
            i18n: {
                language: 'zh-CN',
                hasLoadedNamespace: () => true,
                loadNamespaces: async () => undefined,
            },
        }),
    };
});

vi.mock('react-router-dom', () => ({
    useNavigate: () => navigateMock,
}));

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
        token: null,
    }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
    useToast: () => ({
        error: toastErrorMock,
        warning: toastWarningMock,
    }),
}));

vi.mock('../../../hooks/useLobbyMatchPresence', () => ({
    useLobbyMatchPresence: () => ({
        matches: mockMatches,
        hasSnapshot: true,
    }),
}));

vi.mock('../../../hooks/ui/useHomeV2CompactLandscape', () => ({
    useHomeV2CompactLandscape: () => false,
}));

vi.mock('../../../lib/mobile/androidRuntime', () => ({
    isNativeAndroidRuntime: () => packageMocks.nativeAndroidRuntime,
}));

vi.mock('../../../features/mobile-packages/useGamePackageState', () => ({
    useGamePackageState: () => ({
        isPackageManaged: false,
        cardState: {
            status: 'not-installed',
        },
        pendingInstall: null,
        isConfirmingInstall: false,
        requestInstall: packageMocks.requestInstall,
        dismissInstall: packageMocks.dismissInstall,
        cancelInstall: packageMocks.cancelInstall,
        confirmInstall: packageMocks.confirmInstall,
        retryInstall: packageMocks.retryInstall,
        notificationPermissionAction: null,
        openNotificationSettings: packageMocks.openNotificationSettings,
        ...(packageMocks.hookResult ?? {}),
    }),
}));

vi.mock('../../../hooks/match/ownerIdentity', () => ({
    getOrCreateGuestId: () => 'guest-1',
    getGuestName: () => 'Guest',
    getOwnerKey: () => 'owner-1',
    getOwnerType: () => 'guest',
}));

vi.mock('../../../hooks/match/useMatchStatus', () => ({
    claimSeat: vi.fn(),
    clearOwnerActiveMatch: vi.fn(),
    destroyMatch: vi.fn(),
    getLatestStoredMatchCredentials: vi.fn(() => null),
    getOwnerActiveMatch: vi.fn(() => mockOwnerActiveMatch),
    persistMatchCredentials: vi.fn(),
    readStoredMatchCredentials: vi.fn(() => null),
    setOwnerActiveMatch: vi.fn(),
}));

vi.mock('../../../api/review', () => ({
    fetchReviews: vi.fn(async () => []),
    fetchReviewStats: vi.fn(async () => null),
}));

vi.mock('../../../config/server', () => ({
    GAME_CHANGELOG_API_URL: 'http://test.example/game-changelogs',
    GAME_SERVER_URL: 'http://test.example',
}));

vi.mock('../../../games/registry', () => ({
    loadGameImplementation: (...args: unknown[]) => packageMocks.loadGameImplementation(...args),
    prefetchGameImplementation: (...args: unknown[]) => packageMocks.prefetchGameImplementation(...args),
    ensureGameCriticalImageResolverLoaded: (...args: unknown[]) => packageMocks.ensureGameCriticalImageResolverLoaded(...args),
}));

vi.mock('../../../lib/prefetchPlayRoute', () => ({
    prefetchOnlineMatchRoute: (...args: unknown[]) => packageMocks.prefetchOnlineMatchRoute(...args),
}));

vi.mock('../../lobby/CreateRoomModal', () => ({
    CreateRoomModal: (props: {
        isOpen?: boolean;
        initialPreferences?: unknown;
        gameManifest?: { id?: string };
        onConfirm?: (config: {
            roomName?: string;
            numPlayers: number;
            ttlSeconds: number;
            password?: string;
            enableAi: boolean;
            minimumActionDelayMs: number;
            seatControllers: Record<string, unknown>;
            setupSelections: Record<string, unknown>;
            setupData?: Record<string, unknown>;
        }) => void | Promise<void>;
    }) => {
        packageMocks.createRoomModalProps = props;
        return null;
    },
}));

vi.mock('../../common/overlays/HomeV2PaperModalFrame', () => ({
    HomeV2PaperModalFrame: ({ children, dataTestId }: { children: React.ReactNode; dataTestId?: string }) => createElement('div', { 'data-testid': dataTestId }, children),
}));

vi.mock('../../common/PasswordField', () => ({
    PasswordField: ({
        value,
        onChange,
        toggleButtonTestId,
        toggleButtonClassName: _toggleButtonClassName,
        iconSize: _iconSize,
        ...props
    }: {
        value: string;
        onChange: (event: { target: { value: string } }) => void;
        toggleButtonTestId?: string;
        [key: string]: unknown;
    }) => createElement('div', null,
        createElement('input', {
            ...props,
            value,
            onChange: (event: Event) => {
                const target = event.target as HTMLInputElement;
                onChange({ target: { value: target.value } });
            },
        }),
        toggleButtonTestId
            ? createElement('button', { type: 'button', 'data-testid': toggleButtonTestId }, 'toggle')
            : null,
    ),
}));

vi.mock('../../lobby/gameDetailsContent', () => ({
    resolveGameAuthorName: () => '',
    resolveGameDisplayName: (game: { id: string }) => game.id,
    resolveGameDescription: () => 'desc',
}));

beforeEach(() => {
    packageMocks.nativeAndroidRuntime = false;
    packageMocks.hookResult = null;
    packageMocks.createRoomModalProps = null;
    packageMocks.loadGameImplementation.mockReset();
    packageMocks.loadGameImplementation.mockResolvedValue(null);
    packageMocks.prefetchGameImplementation.mockReset();
    packageMocks.prefetchGameImplementation.mockResolvedValue(null);
    packageMocks.ensureGameCriticalImageResolverLoaded.mockReset();
    packageMocks.ensureGameCriticalImageResolverLoaded.mockResolvedValue(undefined);
    packageMocks.prefetchOnlineMatchRoute.mockReset();
    packageMocks.prefetchOnlineMatchRoute.mockResolvedValue(undefined);
    mockOwnerActiveMatch = null;
    mockMatches = [{
        matchID: 'match-locked-1',
        players: [
            { id: 0, name: 'Host' },
            { id: 1, name: undefined },
        ],
        totalSeats: 2,
        gameName: 'tictactoe',
        roomName: '加锁房间',
        ownerKey: 'owner-2',
        ownerType: 'guest',
        isLocked: true,
    }];
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('HomeV2 GameDetails locked room join', () => {
    it('纸牌帮首次创建房间时不把默认本地 AI 三人偏好误当成保存偏好', async () => {
        localStorage.removeItem('local_ai_match_preferences:the-gang');

        render(createElement(GameDetailsRight, {
            game: {
                id: 'the-gang',
                type: 'game',
                enabled: true,
                titleKey: 'games.the-gang.title',
                descriptionKey: 'games.the-gang.description',
                category: 'card',
                playersKey: 'games.the-gang.players',
                icon: 'TG',
                playerOptions: [3, 4, 5, 6, 7, 8, 9, 10],
                bestPlayers: [4, 5, 6],
                ai: {
                    capture: true,
                    localAi: true,
                    remoteAi: false,
                    defaultLocalAiSeats: 'all-opponents',
                },
            },
        }));

        fireEvent.click(screen.getByTestId('home-v2-create-room-button'));

        await waitFor(() => {
            expect(packageMocks.createRoomModalProps?.isOpen).toBe(true);
        });
        expect(packageMocks.createRoomModalProps?.gameManifest?.id).toBe('the-gang');
        expect(packageMocks.createRoomModalProps?.initialPreferences).toBeNull();
    });

    it('法师战争 Home V2 创建房间也先走游戏选择页，再用选择结果创建正式房间', async () => {
        const selectedSetupSelections = {
            mageWarsSeat0MageId: 'beastmaster_apprentice',
            mageWarsSeat1MageId: 'priestess_apprentice',
        };
        packageMocks.loadGameImplementation.mockResolvedValueOnce({
            runtimeAdapter: {
                resolveCreateRoomSetup: () => ({
                    numPlayers: 2,
                    setupSelections: {
                        mageWarsSeat0MageId: 'warlock_apprentice',
                        mageWarsSeat1MageId: 'wizard_apprentice',
                    },
                    setupData: {
                        mageWarsSeat0MageId: 'warlock_apprentice',
                        mageWarsSeat1MageId: 'wizard_apprentice',
                        setupSelections: {
                            mageWarsSeat0MageId: 'warlock_apprentice',
                            mageWarsSeat1MageId: 'wizard_apprentice',
                        },
                    },
                }),
                CreateRoomSetupGate: ({
                    mode,
                    initialSetup,
                    onConfirm,
                }: {
                    mode: string;
                    initialSetup: { setupSelections?: Record<string, unknown> };
                    onConfirm: (setup: {
                        numPlayers: number;
                        setupSelections: Record<string, string>;
                        setupData: Record<string, unknown>;
                    }) => void;
                }) => createElement('button', {
                    type: 'button',
                    'data-testid': 'mock-home-v2-mage-wars-setup-gate',
                    'data-mode': mode,
                    'data-initial-seat0': String(initialSetup.setupSelections?.mageWarsSeat0MageId ?? ''),
                    onClick: () => onConfirm({
                        numPlayers: 2,
                        setupSelections: selectedSetupSelections,
                        setupData: {
                            ...selectedSetupSelections,
                            mageWarsSeat0SpellbookEntries: [{ spellCardId: 2601, count: 1 }],
                            mageWarsSeat1SpellbookEntries: [{ spellCardId: 2604, count: 1 }],
                            setupSelections: selectedSetupSelections,
                        },
                    }),
                }, 'mock-home-v2-mage-wars-setup-gate'),
            },
        });
        const createMatchSpy = vi.spyOn(matchApi, 'createMatch').mockResolvedValueOnce({
            matchID: 'match-home-v2-mage-wars',
        });
        vi.mocked(matchStatus.claimSeat).mockResolvedValueOnce({ success: true, credentials: 'cred-0' });

        render(createElement(GameDetailsRight, {
            game: {
                id: 'mage-wars',
                type: 'game',
                enabled: true,
                titleKey: 'games.mage-wars.title',
                descriptionKey: 'games.mage-wars.description',
                category: 'wargame',
                playersKey: 'games.mage-wars.players',
                icon: 'MW',
                playerOptions: [2],
                createRoomSetup: {
                    hiddenSelectionKeys: ['mageWarsSeat0MageId', 'mageWarsSeat1MageId'],
                    showSetupOptions: false,
                    preCreateSetupGate: true,
                },
            },
        }));

        fireEvent.click(screen.getByTestId('home-v2-create-room-button'));

        await waitFor(() => {
            expect(packageMocks.createRoomModalProps?.isOpen).toBe(true);
        });
        await act(async () => {
            await packageMocks.createRoomModalProps?.onConfirm?.({
                roomName: 'Home V2 Mage Room',
                numPlayers: 2,
                ttlSeconds: 0,
                password: '',
                enableAi: false,
                minimumActionDelayMs: 0,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'human' },
                },
                setupSelections: {},
            });
        });

        await waitFor(() => {
            expect(screen.getByTestId('mock-home-v2-mage-wars-setup-gate')).toBeInTheDocument();
        });
        expect(screen.getByTestId('mock-home-v2-mage-wars-setup-gate')).toHaveAttribute('data-mode', 'create-room');
        expect(screen.getByTestId('mock-home-v2-mage-wars-setup-gate')).toHaveAttribute('data-initial-seat0', 'warlock_apprentice');
        expect(createMatchSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('mock-home-v2-mage-wars-setup-gate'));

        await waitFor(() => {
            expect(createMatchSpy).toHaveBeenCalledTimes(1);
        });
        expect(createMatchSpy).toHaveBeenCalledWith(
            'mage-wars',
            expect.objectContaining({
                numPlayers: 2,
                setupData: expect.objectContaining({
                    roomName: 'Home V2 Mage Room',
                    mageWarsSeat0MageId: 'beastmaster_apprentice',
                    mageWarsSeat1MageId: 'priestess_apprentice',
                    mageWarsSeat0SpellbookEntries: [{ spellCardId: 2601, count: 1 }],
                    mageWarsSeat1SpellbookEntries: [{ spellCardId: 2604, count: 1 }],
                    setupSelections: selectedSetupSelections,
                }),
            }),
            undefined,
        );
        expect(matchStatus.claimSeat).toHaveBeenCalledWith('mage-wars', 'match-home-v2-mage-wars', '0', expect.objectContaining({
            guestId: 'guest-1',
            playerName: 'Guest',
        }));
        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/play/mage-wars/match/match-home-v2-mage-wars?playerID=0');
        });
    });

    it('确认密码后会先 getMatch，再带密码 join，并导航到返回的座位', async () => {
        const getMatchSpy = vi.spyOn(matchApi, 'getMatch').mockResolvedValueOnce({
            matchID: 'match-locked-1',
            gameName: 'tictactoe',
            players: [
                { id: 0, name: 'Host' },
                { id: 1, name: undefined },
            ],
        });
        const joinMatchSpy = vi.spyOn(matchApi, 'joinMatch').mockResolvedValueOnce({
            playerID: '1',
            playerCredentials: 'cred-1',
        });

        render(createElement(GameDetailsRight, {
            game: {
                id: 'tictactoe',
                type: 'game',
                enabled: true,
                titleKey: 'games.tictactoe.title',
                descriptionKey: 'games.tictactoe.description',
                category: 'abstract',
                playersKey: 'games.tictactoe.players',
                icon: 'XO',
                playerOptions: [2],
            },
        }));

        fireEvent.click(screen.getByRole('button', { name: /加锁房间/ }));

        const passwordInput = await screen.findByTestId('home-v2-room-password-input');
        fireEvent.change(passwordInput, { target: { value: '654321' } });
        fireEvent.click(screen.getByTestId('home-v2-room-password-confirm'));

        await waitFor(() => {
            expect(getMatchSpy).toHaveBeenCalledWith('tictactoe', 'match-locked-1');
        });
        await waitFor(() => {
            expect(joinMatchSpy).toHaveBeenCalledWith('tictactoe', 'match-locked-1', expect.objectContaining({
                playerID: '1',
                playerName: 'Guest',
                data: expect.objectContaining({
                    guestId: 'guest-1',
                    password: '654321',
                }),
            }));
        });
        expect(vi.mocked(matchStatus.persistMatchCredentials)).toHaveBeenCalledWith('match-locked-1', expect.objectContaining({
            playerID: '1',
            credentials: 'cred-1',
            gameName: 'tictactoe',
        }));
        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/play/tictactoe/match/match-locked-1?playerID=1');
        });
    });

    it('Android 原生运行时 package-managed 游戏会显示圆球下载入口，并在展开卡片后触发安装请求', async () => {
        packageMocks.nativeAndroidRuntime = true;
        packageMocks.hookResult = {
            isPackageManaged: true,
            cardState: {
                status: 'not-installed',
                previewResolved: true,
                manifestSource: 'remote',
                assetPackId: 'tictactoe-assets',
                assetPackBytes: 1024,
            },
        };

        render(createElement(GameDetailsRight, {
            game: {
                id: 'tictactoe',
                type: 'game',
                enabled: true,
                titleKey: 'games.tictactoe.title',
                descriptionKey: 'games.tictactoe.description',
                category: 'abstract',
                playersKey: 'games.tictactoe.players',
                icon: 'XO',
                playerOptions: [2],
                mobileDelivery: {
                    mode: 'package-managed',
                    runtimeChannel: 'stable',
                    assetPackId: 'tictactoe-assets',
                },
            },
        }));

        fireEvent.click(await screen.findByTestId('home-v2-mobile-package-toggle'));
        expect(packageMocks.requestInstall).not.toHaveBeenCalled();
        expect(await screen.findByTestId('game-details-mobile-package-card')).toBeInTheDocument();

        fireEvent.click(screen.getByText('packageManager.installAction'));

        expect(packageMocks.requestInstall).toHaveBeenCalledTimes(1);
    });

    it('房间账本会显示已开启的扩展摘要', async () => {
        mockMatches = [{
            matchID: 'match-smashup-1',
            players: [
                { id: 0, name: '房主' },
                { id: 1, name: undefined },
            ],
            totalSeats: 2,
            gameName: 'smashup',
            roomName: '扩展房间',
            ownerKey: 'owner-2',
            ownerType: 'guest',
            isLocked: false,
            publicSetupSummary: {
                enabledExpansions: ['titans', 'diy', 'deckQuery'],
            },
        }];

        render(createElement(GameDetailsRight, {
            game: {
                id: 'smashup',
                type: 'game',
                enabled: true,
                titleKey: 'games.smashup.title',
                descriptionKey: 'games.smashup.description',
                category: 'card',
                playersKey: 'games.smashup.players',
                icon: 'SU',
                playerOptions: [2, 4],
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
            },
        }));

        expect(await screen.findByTestId('home-v2-room-expansion-summary-match-smashup-1'))
            .toHaveTextContent('扩展：泰坦 / DIY / 余牌查询');
    });

    it('七大恨房间账本会显示当前剧本摘要', async () => {
        mockMatches = [{
            matchID: 'match-qidahen-1',
            players: [
                { id: 0, name: '大明' },
                { id: 1, name: '蒙古' },
                { id: 2, name: '后金' },
            ],
            totalSeats: 3,
            gameName: 'qidahen',
            roomName: '山海关房间',
            ownerKey: 'owner-2',
            ownerType: 'guest',
            isLocked: false,
            publicSetupSummary: {
                scenarioId: 'shanhaiguan-1622',
            },
        }];

        render(createElement(GameDetailsRight, {
            game: {
                id: 'qidahen',
                type: 'game',
                enabled: true,
                titleKey: 'games.qidahen.title',
                descriptionKey: 'games.qidahen.description',
                category: 'wargame',
                playersKey: 'games.qidahen.players',
                icon: '恨',
                playerOptions: [3],
                publicRoomSetupSummary: {
                    scenario: {
                        options: {
                            'shanhaiguan-1622': { labelKey: 'setup.scenario.shanhaiguan1622' },
                        },
                    },
                },
            },
        }));

        expect(await screen.findByTestId('home-v2-room-scenario-summary-match-qidahen-1'))
            .toHaveTextContent('剧本：剧本二：山海关之议（1622）');
    });

    it('当前房主房间会显示独立销毁入口，并在确认后调用销毁接口与隐藏房间行', async () => {
        mockMatches = [{
            matchID: 'match-owner-1',
            players: [
                { id: 0, name: 'Guest' },
                { id: 1, name: undefined },
            ],
            totalSeats: 2,
            gameName: 'tictactoe',
            roomName: '我的房间',
            ownerKey: 'owner-1',
            ownerType: 'guest',
            isLocked: false,
        }];
        mockOwnerActiveMatch = {
            matchID: 'match-owner-1',
            gameName: 'tictactoe',
            ownerKey: 'owner-1',
            ownerType: 'guest',
        };

        vi.mocked(matchStatus.readStoredMatchCredentials).mockReturnValue({
            matchID: 'match-owner-1',
            playerID: '0',
            credentials: 'owner-cred',
            gameName: 'tictactoe',
        });
        vi.mocked(matchStatus.destroyMatch).mockResolvedValue({
            success: true,
        });

        render(createElement(GameDetailsRight, {
            game: {
                id: 'tictactoe',
                type: 'game',
                enabled: true,
                titleKey: 'games.tictactoe.title',
                descriptionKey: 'games.tictactoe.description',
                category: 'abstract',
                playersKey: 'games.tictactoe.players',
                icon: 'XO',
                playerOptions: [2],
            },
        }));

        expect(screen.queryByTestId('home-v2-room-destroy-button')).not.toBeInTheDocument();
        expect(screen.getByTestId('home-v2-active-room-banner')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('home-v2-active-room-destroy-button'));
        expect(await screen.findByTestId('home-v2-destroy-room-panel')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('home-v2-destroy-room-confirm'));

        await waitFor(() => {
            expect(matchStatus.destroyMatch).toHaveBeenCalledWith('tictactoe', 'match-owner-1', '0', 'owner-cred');
        });
        await waitFor(() => {
            expect(screen.queryByText('我的房间')).not.toBeInTheDocument();
        });
    });
});
