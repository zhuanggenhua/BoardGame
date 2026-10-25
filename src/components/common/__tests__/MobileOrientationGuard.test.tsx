// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { MobileOrientationGuard, type GameMobileEntry } from '../MobileOrientationGuard';

const mocks = vi.hoisted(() => ({
    webLock: vi.fn(), webUnlock: vi.fn(), nativeLock: vi.fn(), nativeUnlock: vi.fn(),
    viewport: { width: 390, height: 844 },
}));
vi.mock('../../../hooks/ui/useRuntimeViewport', () => ({ useRuntimeViewport: () => mocks.viewport }));
vi.mock('../../../lib/webFullscreen', () => ({
    tryLockScreenOrientation: mocks.webLock, unlockScreenOrientation: mocks.webUnlock, isStandaloneWebApp: () => false,
}));
vi.mock('@capacitor/screen-orientation', () => ({ ScreenOrientation: { lock: mocks.nativeLock, unlock: mocks.nativeUnlock } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key === 'mobileOrientation.banner.unlockPortrait' ? '请关闭竖屏锁定' : key }) }));

const entries: Record<string, GameMobileEntry> = {
    smashup: { mobileProfile: 'landscape-adapted', preferredOrientation: 'landscape' },
    tictactoe: { mobileProfile: 'portrait-adapted', preferredOrientation: 'portrait' },
    'the-gang': { mobileProfile: 'landscape-adapted', preferredOrientation: 'landscape' },
};
const resolveEntry = (id: string) => entries[id];
function BackHome() {
    const navigate = useNavigate();
    return <button onClick={() => navigate('/')}>返回首页</button>;
}
function scene(path = '/play/smashup/local', loadGameMobileEntry?: (id: string) => Promise<GameMobileEntry | undefined>) {
    return <MemoryRouter initialEntries={[path]}><BackHome /><MobileOrientationGuard resolveGameMobileEntry={resolveEntry} loadGameMobileEntry={loadGameMobileEntry}>
        <div data-testid="content">真实页面内容</div>
    </MobileOrientationGuard></MemoryRouter>;
}
beforeEach(() => {
    vi.clearAllMocks();
    mocks.viewport.width = 390; mocks.viewport.height = 844;
    mocks.webLock.mockResolvedValue(false); mocks.nativeLock.mockResolvedValue(undefined); mocks.nativeUnlock.mockResolvedValue(undefined);
    Object.defineProperty(window, 'Capacitor', { configurable: true, value: undefined });
    Reflect.deleteProperty(window, 'androidBridge');
    localStorage.clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('首页竖屏与游戏配置方向', () => {
    for (const native of [false, true]) it(`${native ? '原生' : '网页'}首页双风格均请求竖屏，锁定失败也不显示方向提示`, async () => {
        if (native) Object.defineProperty(window, 'Capacitor', { configurable: true, value: { isNativePlatform: () => true, getPlatform: () => 'android' } });
        mocks.nativeLock.mockRejectedValue(new Error('orientation denied'));
        for (const style of ['modern', 'classic']) for (const portrait of [true, false]) {
            localStorage.setItem('bg_home_entry_style', style);
            mocks.viewport.width = portrait ? 390 : 844; mocks.viewport.height = portrait ? 844 : 390;
            const view = render(scene('/'));
            await act(async () => {});
            expect(screen.queryByText('请关闭竖屏锁定')).toBeNull();
            expect(screen.queryByTestId('mobile-orientation-home-banner')).toBeNull();
            expect(screen.getByTestId('content')).toBeTruthy();
            await waitFor(() => expect(mocks.webLock).toHaveBeenLastCalledWith('portrait'));
            view.unmount();
        }
        if (native) expect(mocks.nativeLock).toHaveBeenLastCalledWith({ orientation: 'portrait' });
        else expect(mocks.nativeLock).not.toHaveBeenCalled();
    });

    it('网页进入横屏游戏先尝试，等待期间不提示；失败后显示指定文案并保留游戏', async () => {
        let complete!: (value: boolean) => void;
        mocks.webLock.mockReturnValue(new Promise<boolean>(resolve => { complete = resolve; }));
        render(scene());
        await waitFor(() => expect(mocks.webLock).toHaveBeenCalledWith('landscape'));
        expect(screen.queryByText('请关闭竖屏锁定')).toBeNull();
        await act(async () => complete(false));
        expect(screen.getByText('请关闭竖屏锁定')).toBeTruthy();
        expect(screen.getByTestId('content')).toBeTruthy();
    });
    it('请求成功且实际方向匹配时不提示', async () => {
        mocks.webLock.mockImplementation(async () => { mocks.viewport.width = 844; mocks.viewport.height = 390; return true; });
        render(scene());
        await waitFor(() => expect(mocks.webLock).toHaveBeenCalledWith('landscape'));
        await act(async () => {});
        expect(screen.queryByTestId('mobile-orientation-game-banner')).toBeNull();
    });
    it('平台接受请求却未实际旋转时，等待系统稳定后才提示', async () => {
        vi.useFakeTimers(); mocks.webLock.mockResolvedValue(true);
        render(scene()); await act(async () => {});
        expect(screen.queryByText('请关闭竖屏锁定')).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
        expect(screen.getByText('请关闭竖屏锁定')).toBeTruthy();
    });
    it('进入竖屏游戏按配置请求 portrait', async () => {
        mocks.viewport.width = 844; mocks.viewport.height = 390;
        render(scene('/play/tictactoe/local'));
        await waitFor(() => expect(mocks.webLock).toHaveBeenCalledWith('portrait'));
        expect(await screen.findByText('请关闭竖屏锁定')).toBeTruthy();
    });
    for (const legacy of [false, true]) it(`${legacy ? '旧androidBridge' : '原生插件'}游戏按配置锁方向，返回首页恢复竖屏`, async () => {
        if (legacy) Object.defineProperty(window, 'androidBridge', { configurable: true, value: {} });
        else Object.defineProperty(window, 'Capacitor', { configurable: true, value: { isNativePlatform: () => true, getPlatform: () => 'android' } });
        render(scene('/play/the-gang/local'));
        await waitFor(() => expect(mocks.nativeLock).toHaveBeenCalledWith({ orientation: 'landscape' }));
        expect(screen.queryByTestId('mobile-orientation-game-banner')).toBeNull();
        fireEvent.click(screen.getByText('返回首页'));
        await waitFor(() => expect(mocks.nativeUnlock).toHaveBeenCalled());
        await waitFor(() => expect(mocks.nativeLock).toHaveBeenLastCalledWith({ orientation: 'portrait' }));
        expect(screen.queryByTestId('mobile-orientation-home-banner')).toBeNull();
    });
    it('原生插件及网页请求均失败才显示方向提示', async () => {
        Object.defineProperty(window, 'Capacitor', { configurable: true, value: { isNativePlatform: () => true, getPlatform: () => 'android' } });
        mocks.nativeLock.mockRejectedValue(new Error('orientation denied'));
        render(scene());
        expect(await screen.findByText('请关闭竖屏锁定')).toBeTruthy();
        expect(mocks.webLock).toHaveBeenCalledWith('landscape');
    });
    it('等待游戏配置后才按真实方向请求，不提前猜方向', async () => {
        let complete!: (value: GameMobileEntry) => void;
        const loader = vi.fn(() => new Promise<GameMobileEntry>(resolve => { complete = resolve; }));
        render(scene('/play/dynamic/local', loader));
        expect(mocks.webLock).not.toHaveBeenCalled();
        await act(async () => complete(entries.smashup));
        await waitFor(() => expect(mocks.webLock).toHaveBeenCalledWith('landscape'));
    });
    it('手动转至正确方向后提示退场', async () => {
        const view = render(scene());
        expect(await screen.findByText('请关闭竖屏锁定')).toBeTruthy();
        mocks.viewport.width = 844; mocks.viewport.height = 390;
        view.rerender(scene());
        expect(screen.queryByTestId('mobile-orientation-game-banner')).toBeNull();
    });
    it('桌面游戏不请求手机方向锁', async () => {
        mocks.viewport.width = 1920; mocks.viewport.height = 1080;
        render(scene()); await act(async () => {});
        expect(mocks.webLock).not.toHaveBeenCalled();
        expect(screen.queryByTestId('mobile-orientation-game-banner')).toBeNull();
    });
});
