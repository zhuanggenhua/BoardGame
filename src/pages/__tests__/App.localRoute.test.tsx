/* @vitest-environment happy-dom */

import type { PropsWithChildren, ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toastViewportMock = vi.hoisted(() => ({
    module: { ToastViewport: () => null } as Record<string, unknown>,
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
            <MemoryRouter initialEntries={['/play/fantasyrealms/local']}>{children}</MemoryRouter>
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
vi.mock('../../contexts/ModalStackContext', () => ({ ModalStackProvider: PassThrough }));
vi.mock('../../contexts/ToastContext', () => ({
    ToastProvider: PassThrough,
    useToast: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn() }),
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
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        vi.useRealTimers();
        runtimeState.nativeAndroid = false;
        runtimeState.nativeMobile = false;
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
