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
