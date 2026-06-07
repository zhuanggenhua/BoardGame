import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileOrientationGuard } from '../MobileOrientationGuard';

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
            isNativePlatform: vi.fn(() => value),
        },
    });
};

const renderGuard = () => render(
    <MemoryRouter initialEntries={["/play/smashup/room-1"]}>
        <MobileOrientationGuard>
            <div data-testid="game-content">game content</div>
        </MobileOrientationGuard>
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
        <MobileOrientationGuard>
            <div data-testid="home-content">home content</div>
        </MobileOrientationGuard>
    </MemoryRouter>,
);

describe('MobileOrientationGuard native orientation behavior', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        Reflect.deleteProperty(window, 'Capacitor');
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

    it('renders native game content once the target landscape viewport is ready', () => {
        vi.useFakeTimers();
        setViewport(936, 432);
        setNativeAppShell(true);

        renderGuardAndFlushViewport();

        expect(screen.getByTestId('game-content')).toBeTruthy();
        expect(screen.queryByText('正在切换横屏…')).toBeNull();
    });
});

describe('MobileOrientationGuard game orientation gate', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        Reflect.deleteProperty(window, 'Capacitor');
        document.body.innerHTML = '';
    });

    it('Web 端错方向进入 portrait 游戏时应渲染独立 gate，而不是继续渲染游戏主界面', () => {
        vi.useFakeTimers();
        setViewport(844, 390);

        render(
            <MemoryRouter initialEntries={['/play/tictactoe']}>
                <MobileOrientationGuard>
                    <div data-testid="game-content">game content</div>
                </MobileOrientationGuard>
            </MemoryRouter>,
        );
        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(screen.getByTestId('mobile-orientation-game-gate')).toBeTruthy();
        expect(screen.getByText('请切换到竖屏继续')).toBeTruthy();
        expect(screen.getByTestId('game-content')).toBeTruthy();
        expect(screen.queryByText('建议切换为竖屏以获得更佳体验')).toBeNull();
    });
});

describe('MobileOrientationGuard home orientation gate', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        Reflect.deleteProperty(window, 'Capacitor');
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
        expect(screen.getByText('建议切换为竖屏以获得更佳体验')).toBeTruthy();
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
