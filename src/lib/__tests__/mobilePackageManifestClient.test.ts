import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/AssetLoader', () => ({
    resolveAssetsBaseUrlFromEnv: () => 'https://assets.example.test/official',
}));

vi.mock('../mobile/mobileRuntime', () => ({
    getNativeMobileRuntimeDiagnostics: () => ({ nativeIos: false }),
}));

vi.mock('../mobile/mobileRuntimeDebug', () => ({
    logMobileRuntime: vi.fn(),
    logMobileRuntimeCritical: vi.fn(),
}));

vi.mock('../../features/mobile-packages/nativeGamePackagePlugin', () => ({
    fetchRemoteJsonThroughNativePlugin: vi.fn(),
}));

const packageManagedDelivery = {
    mode: 'package-managed' as const,
    runtimeChannel: 'stable',
    assetPackId: 'dicethrone',
    assetPackVersion: '0.6.1-dicethrone-local',
    assetPackUrl: 'https://assets.example.test/official/mobile-packages/android/stable/bundles/dicethrone/local.zip',
    assetPackChecksum: 'local-checksum',
    assetPackBytes: 123456,
};

describe('resolveGamePackageManifest', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it('远端 diff-only 素材包不应从本地配置补回旧完整 ZIP', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
                gameId: 'dicethrone',
                runtimeChannel: 'stable',
                assetPack: {
                    id: 'dicethrone',
                    version: '0.6.1-dicethrone-idx-abc123',
                    fileIndexUrl: 'https://assets.example.test/official/mobile-packages/android/stable/file-index/dicethrone/0.6.1-dicethrone-idx-abc123.json',
                    fileIndexChecksum: 'remote-file-index-checksum',
                    fileCount: 209,
                    diffOnly: true,
                    fallbackUrl: 'https://assets.example.test/official/mobile-packages/android/stable/bundles/dicethrone/previous.zip',
                    fallbackChecksum: 'previous-checksum',
                    fallbackBytes: 22616359,
                },
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const { resolveGamePackageManifest } = await import('../../features/mobile-packages/manifestClient');
        const manifest = await resolveGamePackageManifest('dicethrone', packageManagedDelivery);

        expect(manifest.assetPackDiffOnly).toBe(true);
        expect(manifest.assetPackVersion).toBe('0.6.1-dicethrone-idx-abc123');
        expect(manifest.assetPackFileIndexUrl).toContain('/file-index/dicethrone/');
        expect(manifest.assetPackUrl).toBeUndefined();
        expect(manifest.assetPackChecksum).toBeUndefined();
        expect(manifest.assetPackBytes).toBe(22616359);
    });
});
