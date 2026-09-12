/* @vitest-environment happy-dom */

import type { PropsWithChildren, ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastViewportMock = vi.hoisted(() => ({
    module: { ToastViewport: () => null } as Record<string, unknown>,
}));
const routerState = vi.hoisted(() => ({
    initialEntries: ['/play/fantasyrealms/local'],
}));
const routeGuardMocks = vi.hoisted(() => ({
    closeAll: vi.fn(),
    clearMatchCredentials: vi.fn(),
    clearOwnerActiveMatch: vi.fn(),
    getMatch: vi.fn(),
    suppressOwnerActiveMatch: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    toastWarning: vi.fn(),
}));

const PassThrough = ({ children }: PropsWithChildren) => <>{children}</>;
const NullComponent = () => null;

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'zh-CN',
            resolvedLanguage: 'zh-CN',
        },
    }),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    const MemoryRouter = actual.MemoryRouter;
    return {
        ...actual,
        BrowserRouter: ({ children }: { children: ReactNode }) => (
            <MemoryRouter initialEntries={routerState.initialEntries}>{children}</MemoryRouter>
        ),
    };
});

vi.mock('../../engine/testing', () => ({
    TestHarness: {
        init: vi.fn(),
    },
}));

vi.mock('../../hooks/useTokenRefresh', () => ({
    useTokenRefresh: () => undefined,
}));

vi.mock('../../lib/feedback/errorContext', () => ({
    installGlobalErrorContextCapture: () => undefined,
}));

vi.mock('../../services/matchApi', () => ({
    getMatch: routeGuardMocks.getMatch,
}));

vi.mock('../../hooks/match/useMatchStatus', () => ({
    clearMatchCredentials: routeGuardMocks.clearMatchCredentials,
    clearOwnerActiveMatch: routeGuardMocks.clearOwnerActiveMatch,
    isMatchNotFoundError: (error: unknown) => {
        if (typeof error === 'object' && error !== null && 'status' in error) {
            return (error as { status?: unknown }).status === 404;
        }
        return error instanceof Error && error.message.includes('404');
    },
    suppressOwnerActiveMatch: routeGuardMocks.suppressOwnerActiveMatch,
}));

vi.mock('../../lib/mobile/androidRuntime', () => ({
    isNativeAndroidRuntime: () => runtimeState.nativeAndroid,
}));

vi.mock('../../lib/mobile/mobileRuntime', () => ({
    isNativeMobileRuntime: () => runtimeState.nativeMobile,
}));

vi.mock('../../contexts/DebugContext', () => ({ DebugProvider: PassThrough }));
vi.mock('../../contexts/TutorialContext', () => ({ TutorialProvider: PassThrough }));
vi.mock('../../contexts/AuthContext', () => ({ AuthProvider: PassThrough }));
vi.mock('../../contexts/SocialContext', () => ({ SocialProvider: PassThrough }));
vi.mock('../../core/cursor/CursorPreferenceContext', () => ({ CursorPreferenceProvider: PassThrough }));
vi.mock('../../contexts/ModalStackContext', () => ({
    ModalStackProvider: PassThrough,
    useModalStack: () => ({ closeAll: routeGuardMocks.closeAll }),
}));
vi.mock('../../contexts/ToastContext', () => ({
    ToastProvider: PassThrough,
    useToast: () => ({
        warning: routeGuardMocks.toastWarning,
        error: routeGuardMocks.toastError,
        success: routeGuardMocks.toastSuccess,
    }),
}));
vi.mock('../../components/game/framework/InteractionGuard', () => ({ InteractionGuardProvider: PassThrough }));

vi.mock('../../components/system/EngineNotificationListener', () => ({ EngineNotificationListener: NullComponent }));
vi.mock('../../components/system/ViewportDebugProbe', () => ({ ViewportDebugProbe: NullComponent }));
vi.mock('../../components/system/GlobalErrorBoundary', () => ({ GlobalErrorBoundary: PassThrough }));
vi.mock('../../components/system/BrowserCompatibilityGate', () => ({ BrowserCompatibilityGate: PassThrough }));
vi.mock('../../components/system/MobileLiveUpdateManager', () => ({ MobileLiveUpdateManager: NullComponent }));
vi.mock('../../components/system/AndroidNativeUpdateManager', () => ({ AndroidNativeUpdateManager: NullComponent }));
vi.mock('../../components/system/AndroidBackNavigationBridge', () => ({
    AndroidBackNavigationBridge: () => <div data-testid="android-back-navigation-bridge" />,
}));
vi.mock('../../components/system/GamePageRescueGate', () => ({ GamePageRescueGate: NullComponent }));
vi.mock('../../components/system/LoadingScreen', () => ({
    LoadingScreen: () => <div data-testid="loading-screen">loading</div>,
}));
vi.mock('../../components/system/TextEntryAutoScrollAgent', () => ({ TextEntryAutoScrollAgent: NullComponent }));
vi.mock('../../components/system/MobileTextEntryProxyLayer', () => ({ MobileTextEntryProxyLayer: NullComponent }));
vi.mock('../../components/system/PcWebMascot', () => ({ PcWebMascot: NullComponent }));
vi.mock('../../components/common/MobileOrientationGuard', () => ({ MobileOrientationGuard: PassThrough }));
vi.mock('../../components/system/GlobalHUD', () => ({ GlobalHUD: NullComponent }));
vi.mock('../../components/system/ModalStackRoot', () => ({ ModalStackRoot: NullComponent }));
vi.mock('../../components/system/ToastViewport', () => toastViewportMock.module);

const runtimeState = {
    nativeAndroid: false,
    nativeMobile: false,
};

vi.mock('react-hot-toast', () => ({
    Toaster: NullComponent,
}));

vi.mock('../MatchRoomWithAudio', () => ({
    default: () => <div data-testid="online-match-room">online</div>,
}));

vi.mock('../LocalMatchRoomWithAudio', () => ({
    default: () => <div data-testid="local-match-room">local</div>,
}));

vi.mock('../TestMatchRoomWithAudio', () => ({
    default: () => <div data-testid="test-match-room">test</div>,
}));

vi.mock('../TutorialMatchRoomWithAudio', () => ({
    default: () => <div data-testid="tutorial-match-room">tutorial</div>,
}));

vi.mock('../HomeEntry', () => ({
    default: () => <div data-testid="home-entry">home</div>,
    HomeEntry: () => <div data-testid="home-entry">home</div>,
}));

vi.mock('../NotFound', () => ({
    NotFound: () => <div data-testid="not-found">404</div>,
}));

vi.mock('../Maintenance', () => ({
    MaintenancePage: () => <div data-testid="maintenance-page">maintenance</div>,
}));

vi.mock('../../components/auth/AdminGuard', () => ({
    default: PassThrough,
}));

vi.mock('../admin/components/AdminSkeletons', () => ({
    AdminShellSkeleton: () => <div data-testid="admin-shell-skeleton">admin loading</div>,
}));

describe('App local route', () => {
    beforeEach(() => {
        routerState.initialEntries = ['/play/fantasyrealms/local'];
        routeGuardMocks.getMatch.mockResolvedValue({
            matchID: 'existing-match',
            gameName: 'fantasyrealms',
            players: [],
        });
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        vi.useRealTimers();
        runtimeState.nativeAndroid = false;
        runtimeState.nativeMobile = false;
        routerState.initialEntries = ['/play/fantasyrealms/local'];
        toastViewportMock.module = { ToastViewport: NullComponent };
        vi.resetModules();
    });

    it('命中 /play/:gameId/local 时应渲染 LocalMatchRoom，而不是回退到 TestMatchRoom', async () => {
        const { default: App } = await import('../../App');

        render(<App />);

        await waitFor(() => {
            expect(screen.getByTestId('local-match-room')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('test-match-room')).toBeNull();
    });

    it('在线对局路由懒加载前确认房间不存在时应清理本地记录并返回大厅', async () => {
        routerState.initialEntries = ['/play/dicethrone/match/VN_Zn4ofCG2?playerID=0'];
        const notFoundError = Object.assign(new Error('404: Match VN_Zn4ofCG2 not found'), { status: 404 });
        routeGuardMocks.getMatch.mockRejectedValueOnce(notFoundError);

        const { default: App } = await import('../../App');

        render(<App />);

        await waitFor(() => {
            expect(routeGuardMocks.clearMatchCredentials).toHaveBeenCalledWith('VN_Zn4ofCG2');
        });
        expect(routeGuardMocks.clearOwnerActiveMatch).toHaveBeenCalledWith('VN_Zn4ofCG2');
        expect(routeGuardMocks.suppressOwnerActiveMatch).toHaveBeenCalledWith('VN_Zn4ofCG2');
        expect(routeGuardMocks.toastWarning).toHaveBeenCalledWith(
            { kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' },
            undefined,
            { dedupeKey: 'matchRoom.missing.VN_Zn4ofCG2' },
        );
        expect(routeGuardMocks.closeAll).toHaveBeenCalledWith({ skipOnClose: true });

        await waitFor(() => {
            expect(screen.getByTestId('home-entry')).toBeInTheDocument();
        });
    });

    it('旧 Android 壳桥接晚到时应刷新全局返回桥，而不是要求游戏单独接侧滑', async () => {
        const { default: App } = await import('../../App');

        render(<App />);

        expect(screen.queryByTestId('android-back-navigation-bridge')).toBeNull();

        runtimeState.nativeAndroid = true;
        runtimeState.nativeMobile = true;

        await waitFor(() => {
            expect(screen.getByTestId('android-back-navigation-bridge')).toBeInTheDocument();
        }, { timeout: 1000 });
    });

    it('ToastViewport 模块缺少导出时应降级为空组件，避免打断首页渲染', async () => {
        vi.resetModules();
        toastViewportMock.module = {};

        const { loadToastViewportModule } = await import('../../App');
        const LoadedToastViewport = (await loadToastViewportModule()).default;

        render(<LoadedToastViewport />);

        expect(document.body.textContent).toBe('');
    });
});
