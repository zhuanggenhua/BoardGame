/* @vitest-environment happy-dom */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GameHUD } from '../GameHUD';

vi.mock('../../../../../contexts/UndoContext', () => ({
    useUndo: () => ({ canUndo: false, undo: vi.fn() }),
    useUndoStatus: () => ({ canUndo: false, undoAvailable: false }),
}));

vi.mock('../../../../../core', () => ({
    UI_Z_INDEX: { overlayRaised: 1000 },
    HudPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../../system/FabMenu', () => ({
    FabMenu: ({ items }: { items: Array<{ id: string; label: string }> }) => (
        <div data-testid="fab-menu-stub">
            {items.map((item) => (
                <span key={item.id} data-testid={`fab-action-${item.id}`}>
                    {item.label}
                </span>
            ))}
        </div>
    ),
}));

vi.mock('../../../../system/AboutModal', () => ({
    AboutModal: () => null,
}));

vi.mock('../../../../system/FeedbackModal', () => ({
    FeedbackModal: () => null,
}));

vi.mock('../../../../../contexts/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('../../../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: null }),
}));

vi.mock('../../../../../services/matchSocket', () => ({
    matchSocket: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        joinChat: vi.fn(),
        leaveChat: vi.fn(),
        subscribeChat: vi.fn(() => vi.fn()),
        subscribeChatHistory: vi.fn(() => vi.fn()),
        joinEmotes: vi.fn(),
        leaveEmotes: vi.fn(),
        subscribeEmote: vi.fn(() => vi.fn()),
    },
}));

vi.mock('../../../../../contexts/ModalStackContext', () => ({
    useModalStack: () => ({
        stack: [],
        topModalId: null,
        closeTop: vi.fn(),
        closeModal: vi.fn(),
    }),
}));

vi.mock('../../../../../contexts/SocialContext', () => ({
    useOptionalSocial: () => null,
}));

vi.mock('../../../utils/actionLogFormat', () => ({
    buildActionLogRows: () => [],
}));

vi.mock('../ActionLogSegments', () => ({
    ActionLogSegments: () => null,
}));

vi.mock('../../../registry/cardPreviewRegistry', () => ({
    getCardPreviewGetter: () => null,
    getCardPreviewMaxDim: () => 0,
}));

vi.mock('../../../../../lib/utils', () => ({
    generateId: () => 'id',
    copyToClipboard: vi.fn(),
}));

vi.mock('../../../../../lib/logger', () => ({
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    createScopedLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../../../../../lib/mobile/androidRuntime', () => ({
    isNativeAndroidRuntime: () => false,
}));

vi.mock('../../../../../games/gameHudRuntimeAdapter', () => ({
    GameHudRuntimeSettingsSection: () => null,
}));

vi.mock('../../../../common/media/OptimizedImage', () => ({
    OptimizedImage: () => null,
}));

vi.mock('../../../../social/FriendsChatModal', () => ({
    FriendsChatModal: () => null,
}));

vi.mock('../EmotePicker', () => ({
    EmotePicker: () => null,
}));

vi.mock('../SeatEmoteOverlay', () => ({
    SeatEmoteOverlay: () => null,
}));

vi.mock('../../../../../lib/feedback/gameFeedbackDiagnostics', () => ({
    buildGameFeedbackActionLog: () => [],
    buildGameFeedbackStateSnapshot: () => ({}),
}));

describe('GameHUD', () => {
    const renderHud = (node: React.ReactElement) => render(
        <MemoryRouter>
            {node}
        </MemoryRouter>,
    );

    it('联机正式进行阶段不再显示等待对手加入横幅', () => {
        renderHud(
            <GameHUD
                mode="online"
                matchId="match-1"
                gameId="fantasyrealms"
                myPlayerId="0"
                opponentName={null}
                opponentConnected={false}
                presenceReady={true}
                players={[
                    { id: 0, name: '玩家1', isConnected: true },
                    { id: 1, name: undefined, isConnected: false },
                ]}
                isPregameSetupPhase={false}
            />,
        );

        expect(screen.queryByTestId('opponent-offline-banner')).toBeNull();
    });

    it('联机赛前 setup 阶段仍显示等待对手加入横幅', () => {
        renderHud(
            <GameHUD
                mode="online"
                matchId="match-1"
                gameId="fantasyrealms"
                myPlayerId="0"
                opponentName={null}
                opponentConnected={false}
                presenceReady={true}
                players={[
                    { id: 0, name: '玩家1', isConnected: true },
                    { id: 1, name: undefined, isConnected: false },
                ]}
                isPregameSetupPhase={true}
            />,
        );

        expect(screen.getByTestId('opponent-offline-banner')).toBeInTheDocument();
    });

    it('联机赛前 setup 阶段仍显示强制结束 AI 阶段入口', () => {
        renderHud(
            <GameHUD
                mode="online"
                matchId="match-1"
                gameId="dicethrone"
                myPlayerId="0"
                isPregameSetupPhase={true}
                showForceEndAiPhase={true}
                onForceEndAiPhase={vi.fn()}
            />,
        );

        expect(screen.getByTestId('fab-action-force-actions')).toBeInTheDocument();
    });

    it('联机赛前 setup 阶段不因普通弹窗强关单独显示强制操作入口', () => {
        renderHud(
            <GameHUD
                mode="online"
                matchId="match-1"
                gameId="dicethrone"
                myPlayerId="0"
                isPregameSetupPhase={true}
                showForceDismissPopup={true}
            />,
        );

        expect(screen.queryByTestId('fab-action-force-actions')).toBeNull();
    });
});
