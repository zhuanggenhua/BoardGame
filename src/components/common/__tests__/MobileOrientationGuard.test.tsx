import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileOrientationGuard, type GameMobileEntry } from '../MobileOrientationGuard';

const lockOrientationMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@capacitor/screen-orientation', () => ({
    ScreenOrientation: {
        lock: lockOrientationMock,
    },
}));

const TEST_GAME_MOBILE_ENTRIES: Record<string, GameMobileEntry> = {
    smashup: {
        mobileProfile: 'landscape-adapted',
        preferredOrientation: 'landscape',
        mobileLayoutPreset: 'board-shell',
        shellTargets: ['pwa'],
        mobileDelivery: { mode: 'builtin' },
    },
    betrayal: {
        mobileProfile: 'landscape-adapted',
        preferredOrientation: 'landscape',
        mobileLayoutPreset: 'board-shell',
        shellTargets: ['pwa'],
        mobileDelivery: { mode: 'builtin' },
    },
    'the-gang': {
        mobileProfile: 'landscape-adapted',
        preferredOrientation: 'landscape',
        mobileLayoutPreset: 'board-shell',
        shellTargets: ['pwa'],
        mobileDelivery: { mode: 'builtin' },
    },
    tictactoe: {
        mobileProfile: 'portrait-adapted',
        preferredOrientation: 'portrait',
        mobileLayoutPreset: 'portrait-simple',
        shellTargets: ['pwa'],
        mobileDelivery: { mode: 'builtin' },
    },
};

const resolveTestGameMobileEntry = (gameId: string): GameMobileEntry | undefined => (
    TEST_GAME_MOBILE_ENTRIES[gameId]
);

const TestMobileOrientationGuard = ({ children }: { children: React.ReactNode }) => (
    <MobileOrientationGuard resolveGameMobileEntry={resolveTestGameMobileEntry}>
        {children}
    </MobileOrientationGuard>
);

const setViewport = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: width });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: height });
};

const setNativeAppShell = (value: boolean) => {
    Object.defineProperty(window, 'Capacitor', {
        configurable: true,
        value: {
            getPlatform: vi.fn(() => (value ? 'android' : 'web')),
            isNativePlatform: vi.fn(() => value),
        },
    });
};

const setAndroidBridgeShell = () => {
    Object.defineProperty(window, 'androidBridge', {
        configurable: true,
        value: {},
    });
};

const renderGuard = () => render(
    <MemoryRouter initialEntries={["/play/smashup/room-1"]}>
        <TestMobileOrientationGuard>
            <div data-testid="game-content">game content</div>
        </TestMobileOrientationGuard>
    </MemoryRouter>,
);

const renderBetrayalGuard = () => render(
    <MemoryRouter initialEntries={["/play/betrayal/tutorial/basic-setup-and-turn"]}>
        <TestMobileOrientationGuard>
            <div data-testid="game-content">game content</div>
        </TestMobileOrientationGuard>
    </MemoryRouter>,
);

const renderTheGangGuard = () => render(
    <MemoryRouter initialEntries={['/play/the-gang/local']}>
        <TestMobileOrientationGuard>
            <div data-testid="game-content">game content</div>
        </TestMobileOrientationGuard>
    </MemoryRouter>,
);

const renderGuardAndFlushViewport = () => {
    const result = renderGuard();
    act(() => {
        vi.runOnlyPendingTimers();
    });
    return result;
};

const renderHomeGuard = (entry = '/') => render(
    <MemoryRouter initialEntries={[entry]}>
        <TestMobileOrientationGuard>
            <div data-testid="home-content">home content</div>
        </TestMobileOrientationGuard>
    </MemoryRouter>,
);

describe('MobileOrientationGuard native orientation behavior', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        Reflect.deleteProperty(window, 'Capacitor');
        Reflect.deleteProperty(window, 'androidBridge');
        document.body.innerHTML = '';
    });

    it('keeps native game content mounted while a landscape game is still in portrait viewport', () => {
        vi.useFakeTimers();
        setViewport(390, 844);
        setNativeAppShell(true);

        renderGuardAndFlushViewport();

        expect(screen.getByTestId('game-content')).toBeTruthy();
        expect(screen.queryByText('正在切换横屏…')).toBeNull();
    });

    it('keeps betrayal tutorial mounted in native shell while requesting landscape orientation', () => {
        vi.useFakeTimers();
        setViewport(390, 844);
        setNativeAppShell(true);

        renderBetrayalGuard();
        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(screen.getByTestId('game-content')).toBeTruthy();
        expect(screen.queryByText('正在切换横屏…')).toBeNull();
    });

    it('纸牌帮路由必须通过已打包的原生插件请求横屏', async () => {
        vi.useFakeTimers();
        setViewport(390, 844);
        setNativeAppShell(true);

        renderTheGangGuard();
        act(() => {
            vi.runOnlyPendingTimers();
        });
        await vi.dynamicImportSettled();

        expect(lockOrientationMock).toHaveBeenCalledWith({ orientation: 'landscape' });
        expect(screen.getByTestId('game-content')).toBeTruthy();
    });

    it('legacy Android shell with only androidBridge is still handled by the global native shell path', () => {
        vi.useFakeTimers();
        setViewport(390, 844);
        setAndroidBridgeShell();

        renderBetrayalGuard();
        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(screen.getByTestId('game-content')).toBeTruthy();
        expect(screen.queryByTestId('mobile-orientation-game-banner')).toBeNull();
    });

    it('renders native game content once the target landscape viewport is ready', () => {
        vi.useFakeTimers();
        setViewport(936, 432);
        setNativeAppShell(true);

        renderGuardAndFlushViewport();

        expect(screen.getByTestId('game-content')).toBeTruthy();
        expect(screen.queryByText('正在切换横屏…')).toBeNull();
    });
});

describe('MobileOrientationGuard game orientation banner', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        Reflect.deleteProperty(window, 'Capacitor');
        Reflect.deleteProperty(window, 'androidBridge');
        document.body.innerHTML = '';
    });

    it('Web 端错方向进入 portrait 游戏时只显示可关闭提示条，不再整屏遮挡游戏主界面', () => {
        vi.useFakeTimers();
        setViewport(844, 390);

        render(
            <MemoryRouter initialEntries={['/play/tictactoe']}>
                <TestMobileOrientationGuard>
                    <div data-testid="game-content">game content</div>
                </TestMobileOrientationGuard>
            </MemoryRouter>,
        );
        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(screen.queryByTestId('mobile-orientation-game-gate')).toBeNull();
        expect(screen.getByTestId('mobile-orientation-game-banner')).toBeTruthy();
        expect(screen.getByText('mobileOrientation.banner.rotateToPortrait')).toBeTruthy();
        expect(screen.getByTestId('game-content')).toBeTruthy();
        expect(document.documentElement.style.getPropertyValue('--mobile-orientation-banner-offset')).toBe('calc(env(safe-area-inset-top) + 3.75rem)');
    });

    it('Web 端横屏游戏在竖屏视口下只提示旋转但保留真实游戏主界面', () => {
        vi.useFakeTimers();
        setViewport(390, 844);

        renderGuard();
        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(screen.queryByTestId('mobile-orientation-game-gate')).toBeNull();
        expect(screen.getByTestId('mobile-orientation-game-banner')).toBeTruthy();
        expect(screen.getByText('mobileOrientation.banner.rotateToLandscape')).toBeTruthy();
        expect(screen.getByTestId('game-content')).toBeTruthy();
    });

    it('首页方向提示条点击关闭后应立即消失并清空顶部让位变量', () => {
        vi.useFakeTimers();
        setViewport(844, 390);

        render(
            <MemoryRouter initialEntries={['/']}>
                <TestMobileOrientationGuard>
                    <div data-testid="home-content">home content</div>
                </TestMobileOrientationGuard>
            </MemoryRouter>,
        );
        act(() => {
            vi.runOnlyPendingTimers();
        });

        const closeButton = screen.getByRole('button', { name: 'mobileOrientation.closeHint' });
        act(() => {
            closeButton.click();
        });

        expect(screen.queryByTestId('mobile-orientation-home-banner')).toBeNull();
        expect(screen.getByTestId('home-content')).toBeTruthy();
        expect(document.documentElement.style.getPropertyValue('--mobile-orientation-banner-offset')).toBe('0px');
    });
});

describe('MobileOrientationGuard home orientation gate', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        Reflect.deleteProperty(window, 'Capacitor');
        Reflect.deleteProperty(window, 'androidBridge');
        window.localStorage.clear();
        document.body.innerHTML = '';
    });

    it('在竖屏下也不显示强制横屏 gate，保留首页可操作', () => {
        vi.useFakeTimers();
        setViewport(390, 844);

        renderHomeGuard('/');
        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(screen.getByTestId('home-content')).toBeTruthy();
        expect(screen.queryByTestId('mobile-orientation-home-gate')).toBeNull();
    });

    it('在横屏下为经典主页只显示竖屏建议 banner，不强制遮挡首页操作', () => {
        vi.useFakeTimers();
        setViewport(844, 390);
        window.localStorage.setItem('bg_home_entry_style', 'classic');

        renderHomeGuard('/');
        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(screen.getByTestId('home-content')).toBeTruthy();
        expect(screen.queryByTestId('mobile-orientation-home-gate')).toBeNull();
        expect(screen.getByText('mobileOrientation.banner.rotateToPortrait')).toBeTruthy();
        expect(document.documentElement.style.getPropertyValue('--mobile-orientation-banner-offset')).toBe('calc(env(safe-area-inset-top) + 3.75rem)');
    });

    it('方向建议 banner 卸载后应清空顶部让位变量，避免后续页面继续保留旧 inset', () => {
        vi.useFakeTimers();
        setViewport(844, 390);
        window.localStorage.setItem('bg_home_entry_style', 'classic');

        const rendered = renderHomeGuard('/');
        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(document.documentElement.style.getPropertyValue('--mobile-orientation-banner-offset')).toBe('calc(env(safe-area-inset-top) + 3.75rem)');

        rendered.unmount();

        expect(document.documentElement.style.getPropertyValue('--mobile-orientation-banner-offset')).toBe('0px');
    });

    it('原生壳中的书本主页不会显示横屏 gate，而是继续保留首页内容并交给原生锁屏', () => {
        vi.useFakeTimers();
        setViewport(390, 844);
        setNativeAppShell(true);

        renderHomeGuard('/');
        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(screen.getByTestId('home-content')).toBeTruthy();
        expect(screen.queryByTestId('mobile-orientation-home-gate')).toBeNull();
    });

    it('原生壳中的经典主页不会显示竖屏 gate，而是继续保留首页内容并交给原生锁屏', () => {
        vi.useFakeTimers();
        setViewport(844, 390);
        setNativeAppShell(true);
        window.localStorage.setItem('bg_home_entry_style', 'classic');

        renderHomeGuard('/');
        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(screen.getByTestId('home-content')).toBeTruthy();
        expect(screen.queryByTestId('mobile-orientation-home-gate')).toBeNull();
    });
});
