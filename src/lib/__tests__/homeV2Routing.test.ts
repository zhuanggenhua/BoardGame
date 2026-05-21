import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeState = {
    androidShellBuild: false,
    nativeAndroid: false,
};

vi.mock('../mobile/androidRuntime', () => ({
    isAndroidShellBuildMode: () => runtimeState.androidShellBuild,
    isNativeAndroidRuntime: () => runtimeState.nativeAndroid,
}));

describe('homeV2Routing', () => {
    beforeEach(() => {
        runtimeState.androidShellBuild = false;
        runtimeState.nativeAndroid = false;
        window.localStorage.clear();
        vi.resetModules();
        vi.stubEnv('VITE_HOME_V2_DRAFT', '0');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('Android shell build 默认把根路由切到 Home V2', async () => {
        runtimeState.androidShellBuild = true;
        const { isHomeV2DraftEnabled, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams())).toBe(true);
        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('book');
    });

    it('原生 Android runtime 默认把根路由切到 Home V2', async () => {
        runtimeState.nativeAndroid = true;
        const { isHomeV2DraftEnabled, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams())).toBe(true);
        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('book');
    });

    it('普通网页根路由默认使用书本主页', async () => {
        const { isHomeV2DraftEnabled, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('book');
        expect(isHomeV2DraftEnabled(new URLSearchParams())).toBe(false);
    });

    it('homeStyle=classic 查询参数优先切到经典主页', async () => {
        const { resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams('homeStyle=classic'))).toBe('classic');
    });

    it('已保存的主页偏好会覆盖默认书本主页', async () => {
        window.localStorage.setItem('bg_home_entry_style', 'classic');
        const { resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('classic');
    });

    it('legacy homeV2Draft=1 仍会强制走书本主页', async () => {
        window.localStorage.setItem('bg_home_entry_style', 'classic');
        const { isHomeV2DraftEnabled, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams('homeV2Draft=1'))).toBe(true);
        expect(resolveHomeEntryStyle(new URLSearchParams('homeV2Draft=1'))).toBe('book');
    });
});
