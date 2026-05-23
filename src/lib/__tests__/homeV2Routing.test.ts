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

    it('Android shell build 默认回到经典主页', async () => {
        runtimeState.androidShellBuild = true;
        const { isHomeV2DraftEnabled, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams())).toBe(false);
        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('classic');
    });

    it('原生 Android runtime 默认回到经典主页', async () => {
        runtimeState.nativeAndroid = true;
        const { isHomeV2DraftEnabled, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams())).toBe(false);
        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('classic');
    });

    it('普通网页根路由默认使用经典主页', async () => {
        const { isHomeV2DraftEnabled, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('classic');
        expect(isHomeV2DraftEnabled(new URLSearchParams())).toBe(false);
    });

    it('homeStyle=classic 查询参数优先切到经典主页', async () => {
        const { resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams('homeStyle=classic'))).toBe('classic');
    });

    it('旧的书本偏好会在本次迁移时被重置成经典主页', async () => {
        runtimeState.nativeAndroid = true;
        window.localStorage.setItem('bg_home_entry_style', 'book');
        const { resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(resolveHomeEntryStyle(new URLSearchParams())).toBe('classic');
        expect(window.localStorage.getItem('bg_home_entry_style')).toBe('classic');
    });

    it('App 里仍可通过带版本标记的显式查询参数进入书本主页', async () => {
        runtimeState.nativeAndroid = true;
        const { isHomeV2DraftEnabled, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams('homeStyle=book&homeStyleVersion=classic-default-v1'))).toBe(true);
        expect(resolveHomeEntryStyle(new URLSearchParams('homeStyle=book&homeStyleVersion=classic-default-v1'))).toBe('book');
    });

    it('App 会忽略没有版本标记的旧书本查询参数', async () => {
        runtimeState.nativeAndroid = true;
        const { isHomeV2DraftEnabled, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams('homeStyle=book'))).toBe(false);
        expect(resolveHomeEntryStyle(new URLSearchParams('homeStyle=book'))).toBe('classic');
    });

    it('普通网页会忽略旧的书本主页偏好和查询参数', async () => {
        window.localStorage.setItem('bg_home_entry_style', 'book');
        const { isHomeV2DraftEnabled, resolveHomeEntryStyle } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams('homeV2Draft=1'))).toBe(false);
        expect(resolveHomeEntryStyle(new URLSearchParams('homeStyle=book&homeV2Draft=1'))).toBe('classic');
    });
});
