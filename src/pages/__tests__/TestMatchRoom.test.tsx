/* @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRuntimeAdapter, GameRuntimeLocalSetupGateProps } from '../../games/gameRuntimeAdapter';

let mockSearchParams = new URLSearchParams();
let mockGameId = 'fantasyrealms';
let mockRuntimeAdapter: GameRuntimeAdapter | null = null;
const localGameProviderSpy = vi.fn();
const gamePageRuntimeProviderSpy = vi.fn();

const PassThrough = ({ children }: PropsWithChildren) => <>{children}</>;

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'zh-CN',
            resolvedLanguage: 'zh-CN',
        },
    }),
}));

vi.mock('react-router-dom', () => ({
    useParams: () => ({ gameId: mockGameId }),
    useSearchParams: () => [mockSearchParams, vi.fn()],
}));

vi.mock('../../games/registry', () => ({
    loadGameImplementation: vi.fn(async () => {}),
    getGameImplementation: vi.fn(() => ({
        engineConfig: {
            gameId: 'fantasyrealms',
            domain: {
                gameId: 'fantasyrealms',
                setup: vi.fn(),
                validate: vi.fn(),
                execute: vi.fn(),
                reduce: vi.fn(),
            },
            systems: [],
        },
        board: () => <div data-testid="board-stub">board</div>,
        runtimeAdapter: mockRuntimeAdapter ?? undefined,
    })),
}));

vi.mock('../../config/games.config', () => ({
    getGameById: vi.fn(() => ({
        id: 'fantasyrealms',
        title: '幻想国度',
        playerOptions: [2, 3, 4, 5, 6],
        bestPlayers: [3, 4],
        setupOptions: {
            variant: {
                type: 'select',
                labelKey: 'games.fantasyrealms.setup.variant.label',
                options: [
                    {
                        value: 'standard',
                        labelKey: 'games.fantasyrealms.setup.variant.standard',
                        playerOptions: [3, 4, 5, 6],
                    },
                    {
                        value: 'duel',
                        labelKey: 'games.fantasyrealms.setup.variant.duel',
                        playerOptions: [2],
                    },
                ],
                default: 'standard',
            },
            expansion: {
                type: 'select',
                labelKey: 'games.fantasyrealms.setup.expansion.label',
                options: [
                    { value: 'base', labelKey: 'games.fantasyrealms.setup.expansion.base' },
                    { value: 'cursed-hoard-suits', labelKey: 'games.fantasyrealms.setup.expansion.cursedHoardSuits' },
                ],
                default: 'base',
                createRoomDefault: 'base',
            },
        },
        ai: {
            localAi: true,
            remoteAi: false,
        },
    })),
}));

vi.mock('../../contexts/GameModeContext', () => ({
    GameModeProvider: PassThrough,
}));

vi.mock('../../core/cursor/GameCursorProvider', () => ({
    GameCursorProvider: PassThrough,
}));

vi.mock('../../components/game/framework', () => ({
    MobileBoardShell: PassThrough,
}));

vi.mock('../../components/game/framework/widgets/GameHUD', () => ({
    GameHUD: () => null,
}));

vi.mock('../../engine/transport/react', () => ({
    LocalGameProvider: (props: PropsWithChildren<Record<string, unknown>>) => {
        localGameProviderSpy(props);
        return <div data-testid="local-game-provider-probe">{props.children}</div>;
    },
    BoardBridge: () => <div data-testid="board-bridge-stub">bridge</div>,
}));

vi.mock('../../components/system/LoadingScreen', () => ({
    LoadingScreen: () => <div data-testid="loading-screen-stub">loading</div>,
}));

vi.mock('../../components/system/GameNamespaceLoadError', () => ({
    GameNamespaceLoadError: () => <div data-testid="namespace-error-stub">error</div>,
}));

vi.mock('../../components/common/SEO', () => ({
    SEO: () => null,
}));

vi.mock('../../engine/testing', () => ({
    TestHarness: {
        init: vi.fn(),
    },
}));

vi.mock('../../engine/testing/environment', () => ({
    enableTestMode: vi.fn(),
}));

vi.mock('../../shared/mobileSupport', () => ({
    getGamePageDataAttributes: () => ({}),
    resolveGameMobileSupport: (config: { preferredOrientation?: unknown }) => ({
        preferredOrientation: config.preferredOrientation,
    }),
    syncGamePageDocumentAttributes: () => undefined,
}));

vi.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({
        warning: vi.fn(),
    }),
}));

vi.mock('../../lib/audio/useGameAudio', () => ({
    playDeniedSound: vi.fn(),
}));

vi.mock('../../engine/transport/errorI18n', () => ({
    isUiHintOnlyError: () => false,
    resolveCommandError: () => 'denied',
}));

vi.mock('../../hooks/useGameNamespaceReady', () => ({
    useGameNamespaceReady: () => ({
        isGameNamespaceReady: true,
        gameNamespaceError: null,
        retryGameNamespaceLoad: vi.fn(),
    }),
}));

vi.mock('../../games/smashup/ui/SmashUpOverlayContext', () => ({
    SmashUpOverlayProvider: PassThrough,
}));

vi.mock('../../games/pageRuntimeAdapter', () => ({
    GamePageRuntimeProvider: (props: PropsWithChildren<{ gameId?: string | null }>) => {
        gamePageRuntimeProviderSpy(props);
        return <>{props.children}</>;
    },
}));

describe('TestMatchRoom', () => {
    beforeEach(() => {
        mockGameId = 'fantasyrealms';
        mockSearchParams = new URLSearchParams();
        mockRuntimeAdapter = null;
        localGameProviderSpy.mockClear();
        gamePageRuntimeProviderSpy.mockClear();
    });

    afterEach(() => {
        cleanup();
    });

    it('应按幻想国度 setup 收敛人数，并把 playerID、seatControllers、setupData 透传给 LocalGameProvider', async () => {
        mockSearchParams = new URLSearchParams(
            'players=6&playerID=1&seat1=local-ai&seat1Difficulty=hard&setup.variant=duel&setup.expansion=cursed-hoard-suits',
        );
        const { TestMatchRoom } = await import('../TestMatchRoom');

        render(<TestMatchRoom />);

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        const latestCall = localGameProviderSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(latestCall.numPlayers).toBe(2);
        expect(latestCall.playerId).toBe('1');
        expect(latestCall.followCurrentTurnPlayer).toBe(false);
        expect(latestCall.setupData).toEqual({
            variant: 'duel',
            expansion: 'cursed-hoard-suits',
            setupSelections: {
                variant: 'duel',
                expansion: 'cursed-hoard-suits',
            },
        });
        expect(latestCall.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': { type: 'local-ai', difficulty: 'hard' },
        });
    });

    it('未显式指定 seat1 时，应沿用本地对局默认的人机座位策略', async () => {
        mockSearchParams = new URLSearchParams('players=2');
        const { TestMatchRoom } = await import('../TestMatchRoom');

        render(<TestMatchRoom />);

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        const latestCall = localGameProviderSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(latestCall.followCurrentTurnPlayer).toBe(true);
        expect(latestCall.setupData).toEqual({
            variant: 'duel',
            expansion: 'base',
            setupSelections: {
                variant: 'duel',
                expansion: 'base',
            },
        });
        expect(latestCall.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': expect.objectContaining({ type: 'local-ai' }),
        });
    });

    it('未显式指定人数时，应默认落到最佳标准局人数，而不是被 2 人总体支持误切到 duel', async () => {
        mockSearchParams = new URLSearchParams('seed=default-standard');
        const { TestMatchRoom } = await import('../TestMatchRoom');

        render(<TestMatchRoom />);

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        const latestCall = localGameProviderSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(latestCall.numPlayers).toBe(3);
        expect(latestCall.setupData).toEqual({
            variant: 'standard',
            expansion: 'base',
            setupSelections: {
                variant: 'standard',
                expansion: 'base',
            },
        });
    });

    it('应通过 GamePageRuntimeProvider 挂上游戏页面运行时 provider', async () => {
        mockSearchParams = new URLSearchParams('players=2');
        const { TestMatchRoom } = await import('../TestMatchRoom');

        render(<TestMatchRoom />);

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        expect(gamePageRuntimeProviderSpy).toHaveBeenCalled();
        const latestCall = gamePageRuntimeProviderSpy.mock.calls.at(-1)?.[0] as { gameId?: string | null };
        expect(latestCall.gameId).toBe('fantasyrealms');
    });

    it('测试路由带 tutorialSetup 时，应通过游戏 runtime adapter 使用对应教程前置状态', async () => {
        mockGameId = 'qidahen';
        mockSearchParams = new URLSearchParams('tutorialSetup=water-dispatch&players=3&playerID=0');
        const resolveLocalSetup = vi.fn((context: { tutorialId?: string }) => (
            context.tutorialId === 'water-dispatch'
                ? {
                    numPlayers: 3,
                    setupSelections: { scenario: 'post-sarhu-1619' },
                    setupData: {
                        setupSelections: { scenario: 'post-sarhu-1619' },
                        qidahenTutorialCoreTransform: () => ({ transformed: true }),
                    },
                }
                : null
        ));
        mockRuntimeAdapter = { resolveLocalSetup };
        const { TestMatchRoom } = await import('../TestMatchRoom');

        render(<TestMatchRoom />);

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        expect(resolveLocalSetup).toHaveBeenCalledWith({
            searchParams: mockSearchParams,
            tutorialId: 'water-dispatch',
        });
        const latestCall = localGameProviderSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(latestCall.numPlayers).toBe(3);
        expect(latestCall.setupData).toMatchObject({
            setupSelections: { scenario: 'post-sarhu-1619' },
            qidahenTutorialCoreTransform: expect.any(Function),
        });
    });

    it('测试路由显式 setupGate=true 时，应显示游戏 setup gate 并等待确认后再挂载棋盘', async () => {
        mockGameId = 'mage-wars';
        mockSearchParams = new URLSearchParams('setupGate=true&seed=mage-selection-e2e');
        const resolveLocalSetup = vi.fn(() => ({
            numPlayers: 2,
            setupData: {
                mageWarsSeat0MageId: 'beastmaster_apprentice',
                mageWarsSeat1MageId: 'priestess_apprentice',
                setupSelections: {
                    mageWarsSeat0MageId: 'beastmaster_apprentice',
                    mageWarsSeat1MageId: 'priestess_apprentice',
                },
            },
        }));
        const LocalSetupGate = ({ onConfirm }: GameRuntimeLocalSetupGateProps) => (
            <button
                type="button"
                data-testid="test-setup-gate-confirm"
                onClick={() => onConfirm({
                    numPlayers: 2,
                    setupData: {
                        mageWarsSeat0MageId: 'warlock_apprentice',
                        mageWarsSeat1MageId: 'wizard_apprentice',
                        setupSelections: {
                            mageWarsSeat0MageId: 'warlock_apprentice',
                            mageWarsSeat1MageId: 'wizard_apprentice',
                        },
                    },
                })}
            >
                confirm setup
            </button>
        );
        mockRuntimeAdapter = {
            resolveLocalSetup,
            LocalSetupGate,
        };
        const { TestMatchRoom } = await import('../TestMatchRoom');

        render(<TestMatchRoom />);

        await waitFor(() => {
            expect(screen.getByTestId('test-setup-gate-confirm')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('local-game-provider-probe')).not.toBeInTheDocument();
        expect(localGameProviderSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('test-setup-gate-confirm'));

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        expect(resolveLocalSetup).toHaveBeenCalledWith({
            searchParams: mockSearchParams,
            tutorialId: undefined,
        });
        const latestCall = localGameProviderSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(latestCall.numPlayers).toBe(2);
        expect(latestCall.setupData).toEqual({
            mageWarsSeat0MageId: 'warlock_apprentice',
            mageWarsSeat1MageId: 'wizard_apprentice',
            setupSelections: {
                mageWarsSeat0MageId: 'warlock_apprentice',
                mageWarsSeat1MageId: 'wizard_apprentice',
            },
        });
    });
});
