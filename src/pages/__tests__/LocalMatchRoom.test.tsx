/* @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRuntimeAdapter, GameRuntimeLocalSetupGateProps } from '../../games/gameRuntimeAdapter';

let mockSearchParams = new URLSearchParams();
let mockRuntimeAdapter: GameRuntimeAdapter | null = null;
const navigateSpy = vi.fn();
const localGameProviderSpy = vi.fn();

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
    useParams: () => ({ gameId: 'fantasyrealms' }),
    useSearchParams: () => [mockSearchParams, vi.fn()],
    useNavigate: () => navigateSpy,
}));

vi.mock('../../games/registry', () => ({
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

vi.mock('../../components/game/framework/CriticalImageGate', () => ({
    CriticalImageGate: PassThrough,
}));

vi.mock('../../components/game/framework/MobileBoardShell', () => ({
    MobileBoardShell: PassThrough,
}));

vi.mock('../../components/game/framework/widgets/GameHUD', () => ({
    GameHUD: () => null,
}));

vi.mock('../../engine/transport/localReact', () => ({
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

vi.mock('../../hooks/ui/usePerformanceMonitor', () => ({
    usePerformanceMonitor: vi.fn(),
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

vi.mock('../../shared/mobileSupport', () => ({
    getGamePageDataAttributes: () => ({}),
    resolveGameMobileSupport: (config: { preferredOrientation?: unknown }) => ({
        preferredOrientation: config.preferredOrientation,
    }),
    syncGamePageDocumentAttributes: () => undefined,
}));

vi.mock('../../hooks/useGameNamespaceReady', () => ({
    useGameNamespaceReady: () => ({
        isGameNamespaceReady: true,
        gameNamespaceError: null,
        retryGameNamespaceLoad: vi.fn(),
    }),
}));

vi.mock('../../games/useGameImplementationReady', () => ({
    useGameImplementationReady: () => ({
        isGameImplementationReady: true,
        gameImplementationError: null,
        retryGameImplementationLoad: vi.fn(),
    }),
}));

vi.mock('../../games/pageRuntimeAdapter', () => ({
    GamePageRuntimeProvider: PassThrough,
}));

describe('LocalMatchRoom', () => {
    beforeEach(() => {
        mockSearchParams = new URLSearchParams();
        mockRuntimeAdapter = null;
        navigateSpy.mockClear();
        localGameProviderSpy.mockClear();
    });

    afterEach(() => {
        cleanup();
    });

    it('幻想国度二人变体链接应把无效人数收敛到 2，并透传扩展 setupData', async () => {
        mockSearchParams = new URLSearchParams(
            'players=6&seed=test-seed&setup.variant=duel&setup.expansion=cursed-hoard-suits',
        );
        const { LocalMatchRoom } = await import('../LocalMatchRoom');

        render(<LocalMatchRoom />);

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        const latestCall = localGameProviderSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(latestCall.numPlayers).toBe(2);
        expect(latestCall.seed).toBe('test-seed');
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
            '1': expect.objectContaining({ type: 'local-ai' }),
        });
        expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('幻想国度 legacy 二人本地链接未显式写 variant 时，也应自动按 duel 收敛到 2 人', async () => {
        mockSearchParams = new URLSearchParams('players=2&seed=legacy-two-player');
        const { LocalMatchRoom } = await import('../LocalMatchRoom');

        render(<LocalMatchRoom />);

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        const latestCall = localGameProviderSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(latestCall.numPlayers).toBe(2);
        expect(latestCall.setupData).toEqual({
            variant: 'duel',
            expansion: 'base',
            setupSelections: {
                variant: 'duel',
                expansion: 'base',
            },
        });
    });

    it('未显式指定人数时，应默认落到最佳标准局人数，而不是被 2 人总体支持误吸到 duel', async () => {
        mockSearchParams = new URLSearchParams('seed=default-standard');
        const { LocalMatchRoom } = await import('../LocalMatchRoom');

        render(<LocalMatchRoom />);

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

    it('游戏运行时 adapter 可以覆盖本地开局人数和 setupData，页面层不需要写游戏名特例', async () => {
        mockSearchParams = new URLSearchParams('players=6&seed=adapter-seed');
        const resolveLocalSetup = vi.fn(() => ({
            numPlayers: 4,
            setupData: {
                adapterSetup: true,
                setupSelections: { scenario: 'adapter-owned' },
            },
        }));
        mockRuntimeAdapter = { resolveLocalSetup };
        const { LocalMatchRoom } = await import('../LocalMatchRoom');

        render(<LocalMatchRoom />);

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        expect(resolveLocalSetup).toHaveBeenCalledWith({ searchParams: mockSearchParams });
        const latestCall = localGameProviderSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(latestCall.numPlayers).toBe(4);
        expect(latestCall.setupData).toEqual({
            adapterSetup: true,
            setupSelections: { scenario: 'adapter-owned' },
        });
        expect(Object.keys(latestCall.seatControllers as Record<string, unknown>)).toEqual(['0', '1', '2', '3']);
    });

    it('游戏运行时 adapter 提供本地 setup gate 时，应先等待玩家确认，再用确认后的 setupData 开局', async () => {
        mockSearchParams = new URLSearchParams('seed=mage-selection-gate');
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
                data-testid="local-setup-gate-confirm"
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
        const { LocalMatchRoom } = await import('../LocalMatchRoom');

        render(<LocalMatchRoom />);

        expect(screen.getByTestId('local-setup-gate-confirm')).toBeInTheDocument();
        expect(screen.queryByTestId('local-game-provider-probe')).not.toBeInTheDocument();
        expect(localGameProviderSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('local-setup-gate-confirm'));

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        expect(resolveLocalSetup).toHaveBeenCalledWith({ searchParams: mockSearchParams });
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
        expect(Object.keys(latestCall.seatControllers as Record<string, unknown>)).toEqual(['0', '1']);
    });
});
