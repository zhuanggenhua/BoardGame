import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredGamePackageState } from '../../features/mobile-packages/types';

const packageServiceMocks = vi.hoisted(() => ({
    cancelGamePackageInstall: vi.fn(),
    refreshGamePackageStateFromNativeTask: vi.fn(),
    resetGamePackageState: vi.fn(),
    resetGamePackageStateForCleanRetry: vi.fn(),
    startGamePackageInstall: vi.fn(),
    subscribeGamePackageState: vi.fn(),
    syncGamePackageState: vi.fn(),
    uninstallGamePackage: vi.fn(),
    stateListener: undefined as ((state: StoredGamePackageState) => void) | undefined,
}));

const manifestClientMocks = vi.hoisted(() => ({
    resolveGamePackageManifest: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../../lib/mobile/mobileRuntimeDebug', () => ({
    logMobileRuntime: vi.fn(),
    logMobileRuntimeCritical: vi.fn(),
}));

vi.mock('../../lib/mobile/appVisibility', () => ({
    onAppVisible: vi.fn(() => () => {}),
}));

vi.mock('../../features/mobile-packages/nativeGamePackagePlugin', () => ({
    getNativeDownloadNotificationPermissionStatus: vi.fn(async () => null),
    openNativeDownloadNotificationSettings: vi.fn(async () => {}),
}));

vi.mock('../../features/mobile-packages/manifestClient', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../features/mobile-packages/manifestClient')>();
    return {
        ...actual,
        hasRemoteGamePackageManifestEndpoint: true,
        resolveGamePackageManifest: manifestClientMocks.resolveGamePackageManifest,
    };
});

vi.mock('../../features/mobile-packages/packageManagerService', () => ({
    cancelGamePackageInstall: packageServiceMocks.cancelGamePackageInstall,
    refreshGamePackageStateFromNativeTask: packageServiceMocks.refreshGamePackageStateFromNativeTask,
    resetGamePackageState: packageServiceMocks.resetGamePackageState,
    resetGamePackageStateForCleanRetry: packageServiceMocks.resetGamePackageStateForCleanRetry,
    startGamePackageInstall: packageServiceMocks.startGamePackageInstall,
    subscribeGamePackageState: packageServiceMocks.subscribeGamePackageState,
    syncGamePackageState: packageServiceMocks.syncGamePackageState,
    uninstallGamePackage: packageServiceMocks.uninstallGamePackage,
}));

const fallbackState: StoredGamePackageState = {
    gameId: 'dicethrone',
    runtimeChannel: 'stable',
    status: 'not-installed',
    modulePackId: 'dicethrone',
    assetPackId: 'dicethrone',
    updatedAt: 1,
};

const failedIncrementalState: StoredGamePackageState = {
    ...fallbackState,
    runtimeChannel: 'edge',
    status: 'failed',
    errorCode: 'checksum-mismatch',
    errorMessage: '增量文件校验失败: i18n/zh-CN/dicethrone/assets-manifest.json',
    updatedAt: 2,
};

const cleanedState: StoredGamePackageState = {
    ...fallbackState,
    status: 'not-installed',
    updatedAt: 3,
};

const edgeIncrementalManifest = {
    gameId: 'dicethrone',
    runtimeChannel: 'edge',
    assetPackId: 'dicethrone',
    assetPackVersion: '0.6.1-dicethrone-idx-e4e24d7fcacf',
    assetPackUrl: 'https://assets.example.test/mobile-packages/android/edge/bundles/dicethrone/0.6.1.zip',
    assetPackFileIndexUrl: 'https://assets.example.test/mobile-packages/android/edge/file-index/dicethrone/0.6.1.json',
    assetPackFileIndexChecksum: 'edge-index-checksum',
    assetPackDiffOnly: true,
    source: 'remote' as const,
};

const stableFullManifest = {
    gameId: 'dicethrone',
    runtimeChannel: 'stable',
    assetPackId: 'dicethrone',
    assetPackVersion: '0.6.12-dicethrone-pkg',
    assetPackUrl: 'https://assets.example.test/mobile-packages/android/stable/bundles/dicethrone/full.zip',
    assetPackChecksum: 'stable-full-checksum',
    assetPackFileIndexUrl: 'https://assets.example.test/mobile-packages/android/stable/file-index/dicethrone/index.json',
    assetPackFileIndexChecksum: 'stable-index-checksum',
    source: 'remote' as const,
};

describe('useGamePackageState clean retry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        packageServiceMocks.stateListener = undefined;
        packageServiceMocks.syncGamePackageState.mockReturnValue(fallbackState);
        packageServiceMocks.refreshGamePackageStateFromNativeTask.mockResolvedValue(fallbackState);
        packageServiceMocks.resetGamePackageStateForCleanRetry.mockResolvedValue(cleanedState);
        packageServiceMocks.startGamePackageInstall.mockResolvedValue({
            ...fallbackState,
            status: 'installed',
            installedVersion: stableFullManifest.assetPackVersion,
            localAssetBaseUrl: '/local/dicethrone/assets',
            updatedAt: 4,
        });
        packageServiceMocks.subscribeGamePackageState.mockImplementation((_gameId, listener) => {
            packageServiceMocks.stateListener = listener;
            return vi.fn();
        });
        manifestClientMocks.resolveGamePackageManifest
            .mockResolvedValueOnce(edgeIncrementalManifest)
            .mockResolvedValueOnce(stableFullManifest);
    });

    it('清理重下会丢弃旧 edge 增量待安装对象，改用当前 stable 完整包', async () => {
        const { useGamePackageState } = await import('../../features/mobile-packages/useGamePackageState');
        const { result } = renderHook(() => useGamePackageState({
            gameId: 'dicethrone',
            gameName: '王权骰铸',
            delivery: {
                mode: 'package-managed',
                runtimeChannel: 'stable',
                modulePackId: 'dicethrone',
                assetPackId: 'dicethrone',
            },
        }));

        await waitFor(() => {
            expect(result.current.cardState.previewResolved).toBe(true);
        });

        act(() => {
            result.current.requestInstall();
        });

        await waitFor(() => {
            expect(result.current.pendingInstall?.runtimeChannel).toBe('edge');
        });

        act(() => {
            packageServiceMocks.stateListener?.(failedIncrementalState);
        });

        await waitFor(() => {
            expect(result.current.cardState.status).toBe('failed');
        });

        act(() => {
            result.current.retryInstall();
        });

        await waitFor(() => {
            expect(packageServiceMocks.startGamePackageInstall).toHaveBeenCalledTimes(1);
        });

        expect(packageServiceMocks.resetGamePackageStateForCleanRetry).toHaveBeenCalledWith('dicethrone', expect.objectContaining({
            runtimeChannel: 'stable',
        }));
        expect(manifestClientMocks.resolveGamePackageManifest).toHaveBeenCalledTimes(2);
        expect(packageServiceMocks.startGamePackageInstall).toHaveBeenCalledWith(expect.objectContaining({
            gameId: 'dicethrone',
            gameName: '王权骰铸',
            runtimeChannel: 'stable',
            assetPackVersion: '0.6.12-dicethrone-pkg',
            assetPackUrl: 'https://assets.example.test/mobile-packages/android/stable/bundles/dicethrone/full.zip',
            assetPackFileIndexUrl: undefined,
            assetPackFileIndexChecksum: undefined,
            assetPackDiffOnly: undefined,
        }), 'packageManager.runtimeUnsupported');
    });
});
