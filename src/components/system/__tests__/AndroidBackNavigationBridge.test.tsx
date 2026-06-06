import { render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appPlugin = {
    addListener: vi.fn(),
    getState: vi.fn(),
    getLaunchUrl: vi.fn(),
    exitApp: vi.fn(),
};

vi.mock('@capacitor/app', () => ({
    App: appPlugin,
}));

vi.mock('../../../contexts/ModalStackContext', () => ({
    useModalStack: () => ({
        stack: [],
        closeTop: vi.fn(),
    }),
}));

vi.mock('../../../lib/mobile/androidBackNavigation', () => ({
    resolveAndroidBackNavigationAction: () => ({ type: 'blocked' }),
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

describe('AndroidBackNavigationBridge', () => {
    beforeEach(() => {
        vi.resetModules();
        appPlugin.addListener.mockReset();
        appPlugin.getState.mockReset();
        appPlugin.getLaunchUrl.mockReset();
        appPlugin.exitApp.mockReset();
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
});
