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
        vi.resetModules();
        vi.stubEnv('VITE_HOME_V2_DRAFT', '0');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('Android shell build 默认把根路由切到 Home V2', async () => {
        runtimeState.androidShellBuild = true;
        const { isHomeV2DraftEnabled } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams())).toBe(true);
    });

    it('原生 Android runtime 默认把根路由切到 Home V2', async () => {
        runtimeState.nativeAndroid = true;
        const { isHomeV2DraftEnabled } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams())).toBe(true);
    });

    it('普通网页根路由默认仍停留在 V1，除非显式带 homeV2Draft=1', async () => {
        const { isHomeV2DraftEnabled } = await import('../homeV2Routing');

        expect(isHomeV2DraftEnabled(new URLSearchParams())).toBe(false);
        expect(isHomeV2DraftEnabled(new URLSearchParams('homeV2Draft=1'))).toBe(true);
    });
});
