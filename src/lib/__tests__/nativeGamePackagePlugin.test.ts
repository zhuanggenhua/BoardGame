import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    readInstalledAsset,
    logMobileRuntime,
    logMobileRuntimeCritical,
} = vi.hoisted(() => ({
    readInstalledAsset: vi.fn(),
    logMobileRuntime: vi.fn(),
    logMobileRuntimeCritical: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
    },
    registerPlugin: () => ({
        readInstalledAsset,
    }),
}));

vi.mock('../../lib/mobile/androidRuntime', () => ({
    isNativeAndroidRuntime: () => true,
}));

vi.mock('../../lib/mobile/mobileRuntimeDebug', () => ({
    logMobileRuntime,
    logMobileRuntimeCritical,
}));

describe('readInstalledGamePackageAssetBlobUrl', () => {
    beforeEach(() => {
        vi.resetModules();
        readInstalledAsset.mockReset();
        logMobileRuntime.mockReset();
        logMobileRuntimeCritical.mockReset();
        vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'));
        vi.stubGlobal('URL', Object.assign(URL, {
            createObjectURL: vi.fn(() => 'blob:test-audio'),
        }));
    });

    it('common-audio 读取失败时会兼容旧目录布局并去掉 common/audio 前缀重试', async () => {
        readInstalledAsset
            .mockRejectedValueOnce(new Error('未找到已安装素材文件'))
            .mockResolvedValueOnce({
                base64: Buffer.from('audio-bytes').toString('base64'),
                mimeType: 'audio/ogg',
                size: 11,
            });

        const { readInstalledGamePackageAssetBlobUrl } = await import('../../features/mobile-packages/nativeGamePackagePlugin');
        const result = await readInstalledGamePackageAssetBlobUrl(
            'common-audio',
            'common/audio/bgm/funk/theme.ogg',
        );

        expect(readInstalledAsset).toHaveBeenNthCalledWith(1, {
            gameId: 'common-audio',
            relativePath: 'common/audio/bgm/funk/theme.ogg',
        });
        expect(readInstalledAsset).toHaveBeenNthCalledWith(2, {
            gameId: 'common-audio',
            relativePath: 'bgm/funk/theme.ogg',
        });
        expect(result).toEqual({
            blobUrl: 'blob:test-audio',
            mimeType: 'audio/ogg',
            size: 11,
        });
    });

    it('非 shared audio 或已是短路径时不会追加兼容重试', async () => {
        readInstalledAsset.mockResolvedValue({
            base64: Buffer.from('audio-bytes').toString('base64'),
            mimeType: 'audio/ogg',
            size: 11,
        });

        const { readInstalledGamePackageAssetBlobUrl } = await import('../../features/mobile-packages/nativeGamePackagePlugin');
        await readInstalledGamePackageAssetBlobUrl('common-audio', 'bgm/funk/theme.ogg');
        await readInstalledGamePackageAssetBlobUrl('smashup', 'common/audio/bgm/funk/theme.ogg');

        expect(readInstalledAsset).toHaveBeenNthCalledWith(1, {
            gameId: 'common-audio',
            relativePath: 'bgm/funk/theme.ogg',
        });
        expect(readInstalledAsset).toHaveBeenNthCalledWith(2, {
            gameId: 'smashup',
            relativePath: 'common/audio/bgm/funk/theme.ogg',
        });
        expect(readInstalledAsset).toHaveBeenCalledTimes(2);
    });
});
