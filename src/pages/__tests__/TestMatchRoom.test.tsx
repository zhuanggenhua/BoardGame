/* @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockSearchParams = new URLSearchParams();
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
    })),
}));

vi.mock('../../config/games.config', () => ({
    getGameById: vi.fn(() => ({
        id: 'fantasyrealms',
        title: '幻想国度',
        playerOptions: [2, 3, 4, 5, 6],
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

vi.mock('../../games/mobileSupport', () => ({
    getGamePageDataAttributes: () => ({}),
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

describe('TestMatchRoom', () => {
    beforeEach(() => {
        mockSearchParams = new URLSearchParams();
        localGameProviderSpy.mockClear();
    });

    afterEach(() => {
        cleanup();
    });

    it('应把 players、playerID 与 seatControllers 透传给 LocalGameProvider', async () => {
        mockSearchParams = new URLSearchParams('players=2&numPlayers=6&playerID=1&seat1=local-ai&seat1Difficulty=hard');
        const { TestMatchRoom } = await import('../TestMatchRoom');

        render(<TestMatchRoom />);

        await waitFor(() => {
            expect(screen.getByTestId('local-game-provider-probe')).toBeInTheDocument();
        });

        const latestCall = localGameProviderSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(latestCall.numPlayers).toBe(2);
        expect(latestCall.playerId).toBe('1');
        expect(latestCall.followCurrentTurnPlayer).toBe(false);
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
        expect(latestCall.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': expect.objectContaining({ type: 'local-ai' }),
        });
    });
});
