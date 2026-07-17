import { act, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appPlugin = {
    addListener: vi.fn(),
    getState: vi.fn(),
    getLaunchUrl: vi.fn(),
    exitApp: vi.fn(),
};
const resolveAndroidBackNavigationActionMock = vi.fn(() => ({ type: 'blocked' }));
const modalStackState = {
    stack: [] as Array<{
        closeOnEsc?: boolean;
        allowPointerThrough?: boolean;
        allowSystemBackNavigation?: boolean;
    }>,
    closeTop: vi.fn(),
};

vi.mock('@capacitor/app', () => ({
    App: appPlugin,
}));

vi.mock('../../../contexts/ModalStackContext', () => ({
    useModalStack: () => ({
        stack: modalStackState.stack,
        closeTop: modalStackState.closeTop,
    }),
}));

vi.mock('../../../lib/mobile/androidBackNavigation', () => ({
    resolveAndroidBackNavigationAction: (...args: unknown[]) => resolveAndroidBackNavigationActionMock(...args),
}));

vi.mock('../../../lib/mobile/appUrlRouting', () => ({
    resolveInAppUrlPath: () => null,
}));

vi.mock('../../../lib/mobile/appVisibility', () => ({
    dispatchAppVisibilityChange: vi.fn(),
}));

vi.mock('../../../lib/mobile/androidRuntime', () => ({
    isNativeAndroidRuntime: () => true,
}));

vi.mock('../../../lib/textEntry', () => ({
    isTextEntrySessionElement: () => false,
}));

const LocationProbe = () => {
    const location = useLocation();
    return createElement('div', { 'data-testid': 'current-path' }, location.pathname);
};

describe('AndroidBackNavigationBridge', () => {
    beforeEach(() => {
        vi.resetModules();
        appPlugin.addListener.mockReset();
        appPlugin.getState.mockReset();
        appPlugin.getLaunchUrl.mockReset();
        appPlugin.exitApp.mockReset();
        modalStackState.stack = [];
        modalStackState.closeTop.mockReset();
        resolveAndroidBackNavigationActionMock.mockReset();
        resolveAndroidBackNavigationActionMock.mockReturnValue({ type: 'blocked' });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('旧 Android 壳缺少 App 插件时，挂载桥接组件不会抛出未处理拒绝', async () => {
        appPlugin.getState.mockResolvedValue({ isActive: true });
        appPlugin.getLaunchUrl.mockResolvedValue({});
        appPlugin.addListener.mockRejectedValue(
            new Error('"App" plugin is not implemented on android'),
        );

        const { AndroidBackNavigationBridge } = await import('../AndroidBackNavigationBridge');

        render(
            createElement(
                MemoryRouter,
                {
                    initialEntries: ['/play/smashup/match/test-match'],
                },
                createElement(AndroidBackNavigationBridge),
            ),
        );

        await waitFor(() => {
            expect(appPlugin.addListener).toHaveBeenCalledTimes(1);
        });

        expect(appPlugin.getState).toHaveBeenCalledTimes(1);
        expect(appPlugin.getLaunchUrl).toHaveBeenCalledTimes(1);
        expect(appPlugin.addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function));
    });

    it('Android 壳内边缘侧滑由全局返回桥接统一返回大厅，不要求每个游戏单独接入', async () => {
        appPlugin.getState.mockResolvedValue({ isActive: true });
        appPlugin.getLaunchUrl.mockResolvedValue({});
        appPlugin.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
        resolveAndroidBackNavigationActionMock.mockReturnValue({ type: 'fallback-route', path: '/' });

        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 900,
        });

        const { AndroidBackNavigationBridge } = await import('../AndroidBackNavigationBridge');

        render(
            createElement(
                MemoryRouter,
                {
                    initialEntries: ['/play/betrayal/tutorial/basic-setup-and-turn'],
                },
                createElement(AndroidBackNavigationBridge),
                createElement(LocationProbe),
            ),
        );

        await waitFor(() => {
            expect(appPlugin.addListener).toHaveBeenCalled();
        });

        await act(async () => {
            document.dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 1,
                pointerType: 'touch',
                clientX: 8,
                clientY: 220,
            }));
            document.dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                pointerType: 'touch',
                clientX: 82,
                clientY: 224,
            }));
        });

        await waitFor(() => {
            expect(screen.getByTestId('current-path').textContent).toBe('/');
        });
        expect(resolveAndroidBackNavigationActionMock).toHaveBeenCalled();
    });

    it('教程不可关闭弹窗允许边缘侧滑继续回大厅', async () => {
        modalStackState.stack = [{
            closeOnEsc: false,
            allowSystemBackNavigation: true,
        }];
        appPlugin.getState.mockResolvedValue({ isActive: true });
        appPlugin.getLaunchUrl.mockResolvedValue({});
        appPlugin.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
        resolveAndroidBackNavigationActionMock.mockReturnValue({ type: 'fallback-route', path: '/' });

        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 900,
        });

        const { AndroidBackNavigationBridge } = await import('../AndroidBackNavigationBridge');

        render(
            createElement(
                MemoryRouter,
                {
                    initialEntries: ['/play/betrayal/tutorial/basic-setup-and-turn'],
                },
                createElement(AndroidBackNavigationBridge),
                createElement(LocationProbe),
            ),
        );

        await waitFor(() => {
            expect(appPlugin.addListener).toHaveBeenCalled();
        });

        await act(async () => {
            document.dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 1,
                pointerType: 'touch',
                clientX: 8,
                clientY: 220,
            }));
            document.dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                pointerType: 'touch',
                clientX: 82,
                clientY: 224,
            }));
        });

        await waitFor(() => {
            expect(screen.getByTestId('current-path').textContent).toBe('/');
        });
        expect(resolveAndroidBackNavigationActionMock).toHaveBeenCalledWith(expect.objectContaining({
            modalStackDepth: 1,
            isTopModalClosable: false,
            isTopModalBackNavigationAllowed: true,
        }));
    });

    it('旧 Android 壳没有 App 插件时，边缘侧滑仍走全局路由返回', async () => {
        appPlugin.getState.mockResolvedValue({ isActive: true });
        appPlugin.getLaunchUrl.mockResolvedValue({});
        appPlugin.addListener.mockRejectedValue(
            new Error('"App" plugin is not implemented on android'),
        );
        resolveAndroidBackNavigationActionMock.mockReturnValue({ type: 'fallback-route', path: '/' });

        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 900,
        });

        const { AndroidBackNavigationBridge } = await import('../AndroidBackNavigationBridge');

        render(
            createElement(
                MemoryRouter,
                {
                    initialEntries: ['/play/betrayal/tutorial/basic-setup-and-turn'],
                },
                createElement(AndroidBackNavigationBridge),
                createElement(LocationProbe),
            ),
        );

        await waitFor(() => {
            expect(appPlugin.addListener).toHaveBeenCalled();
        });

        await act(async () => {
            document.dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 1,
                pointerType: 'touch',
                clientX: 8,
                clientY: 220,
            }));
            document.dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                pointerType: 'touch',
                clientX: 82,
                clientY: 224,
            }));
        });

        await waitFor(() => {
            expect(screen.getByTestId('current-path').textContent).toBe('/');
        });
        expect(resolveAndroidBackNavigationActionMock).toHaveBeenCalled();
    });
});
