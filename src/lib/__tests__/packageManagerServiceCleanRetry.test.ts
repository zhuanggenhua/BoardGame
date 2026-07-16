import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    ResolvedGamePackageManifest,
    StoredGamePackageState,
} from '../../features/mobile-packages/types';
import {
    createDefaultGamePackageState,
} from '../../features/mobile-packages/types';

const nativeMocks = vi.hoisted(() => ({
    cancelNativeGamePackageInstall: vi.fn(async () => true),
    createNativeGamePackageInstallHandle: vi.fn(),
    ensureNativeDownloadNotificationPermission: vi.fn(async () => null),
    listInstalledNativeGamePackages: vi.fn(async () => []),
    readNativeGamePackageInstallState: vi.fn(async () => null),
    uninstallNativeGamePackage: vi.fn(async (gameId: string) => ({
        gameId,
        status: 'not-installed',
        updatedAt: 2,
    })),
}));

vi.mock('../../core', () => ({
    clearGameAssetBaseOverrides: vi.fn(),
    setCommonAudioAssetBaseOverride: vi.fn(),
    setGameAssetBaseOverride: vi.fn(),
}));

vi.mock('../../features/mobile-packages/nativeGamePackagePlugin', () => nativeMocks);

const createManifest = (): ResolvedGamePackageManifest => ({
    gameId: 'dicethrone',
    runtimeChannel: 'stable',
    assetPackId: 'dicethrone',
    assetPackVersion: '0.6.4-dicethrone-pkg',
    assetPackUrl: 'https://assets.example.test/mobile-packages/android/stable/bundles/dicethrone/full.zip',
    assetPackChecksum: 'full-checksum',
    assetPackFileIndexUrl: 'https://assets.example.test/mobile-packages/android/stable/file-index/dicethrone/index.json',
    assetPackFileIndexChecksum: 'index-checksum',
    source: 'remote',
});

const createFallbackState = () => createDefaultGamePackageState('dicethrone', {
    mode: 'package-managed',
    runtimeChannel: 'stable',
    modulePackId: 'dicethrone',
    assetPackId: 'dicethrone',
});

describe('packageManagerService clean retry', () => {
    beforeEach(async () => {
        window.localStorage.clear();
        vi.clearAllMocks();
        const service = await import('../../features/mobile-packages/packageManagerService');
        service.resetGamePackageManagerForTests();
        nativeMocks.createNativeGamePackageInstallHandle.mockImplementation(
            async (manifest: ResolvedGamePackageManifest, options: {
                onStateChange: (state: StoredGamePackageState) => void;
            }) => {
                const installedState: StoredGamePackageState = {
                    gameId: manifest.gameId,
                    runtimeChannel: manifest.runtimeChannel,
                    status: 'installed',
                    assetPackId: manifest.assetPackId,
                    installedVersion: manifest.assetPackVersion,
                    localAssetBaseUrl: '/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/dicethrone/current/assets',
                    updatedAt: 3,
                };
                options.onStateChange(installedState);
                return {
                    cancel: vi.fn(),
                    finished: Promise.resolve(installedState),
                };
            },
        );
    });

    it('校验失败重试会先清原生包，并让下一次安装跳过增量索引改走完整 ZIP', async () => {
        const service = await import('../../features/mobile-packages/packageManagerService');
        const fallbackState = createFallbackState();
        service.syncGamePackageState('dicethrone', fallbackState);

        await service.resetGamePackageStateForCleanRetry('dicethrone', fallbackState);
        const cleanedState = JSON.parse(window.localStorage.getItem('mobile-package-state:dicethrone') ?? '{}');

        expect(nativeMocks.uninstallNativeGamePackage).toHaveBeenCalledWith('dicethrone');
        expect(cleanedState).toEqual(expect.objectContaining({
            status: 'not-installed',
        }));
        expect(cleanedState).not.toHaveProperty('installedVersion');
        expect(cleanedState).not.toHaveProperty('localAssetBaseUrl');
        expect(cleanedState).not.toHaveProperty('errorCode');
        expect(cleanedState).not.toHaveProperty('errorMessage');

        await expect(service.startGamePackageInstall(
            createManifest(),
            'packageManager.runtimeUnsupported',
        )).resolves.toEqual(expect.objectContaining({
            status: 'installed',
            installedVersion: '0.6.4-dicethrone-pkg',
        }));

        expect(nativeMocks.createNativeGamePackageInstallHandle).toHaveBeenCalledTimes(1);
        expect(nativeMocks.createNativeGamePackageInstallHandle.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
            assetPackUrl: 'https://assets.example.test/mobile-packages/android/stable/bundles/dicethrone/full.zip',
            assetPackFileIndexUrl: undefined,
            assetPackFileIndexChecksum: undefined,
            assetPackDiffOnly: undefined,
        }));
    });

    it('清洁重试会等原生任务状态归零，避免立刻复用旧下载任务', async () => {
        const service = await import('../../features/mobile-packages/packageManagerService');
        const fallbackState = createFallbackState();
        service.syncGamePackageState('dicethrone', fallbackState);
        nativeMocks.readNativeGamePackageInstallState
            .mockResolvedValueOnce({
                exists: true,
                taskRunning: true,
                state: {
                    gameId: 'dicethrone',
                    runtimeChannel: 'stable',
                    status: 'failed',
                    updatedAt: 1,
                },
            })
            .mockResolvedValueOnce({
                exists: false,
                taskRunning: false,
                state: {
                    gameId: 'dicethrone',
                    runtimeChannel: 'stable',
                    status: 'not-installed',
                    updatedAt: 2,
                },
            });

        await service.resetGamePackageStateForCleanRetry('dicethrone', fallbackState);

        expect(nativeMocks.uninstallNativeGamePackage).toHaveBeenCalledWith('dicethrone');
        expect(nativeMocks.readNativeGamePackageInstallState).toHaveBeenCalledTimes(2);
    });
});
