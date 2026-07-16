import { describe, expect, it } from 'vitest';
import {
    buildSharedAudioDependencyState,
    resolveManifestForPackageInstallAttempt,
} from '../../features/mobile-packages/packageManagerService';
import type { ResolvedGamePackageManifest, StoredGamePackageState } from '../../features/mobile-packages/types';

const createBaseState = (): StoredGamePackageState => ({
    gameId: 'dicethrone',
    runtimeChannel: 'stable',
    status: 'queued',
    modulePackId: 'dicethrone',
    assetPackId: 'dicethrone',
    updatedAt: 1,
});

describe('buildSharedAudioDependencyState', () => {
    it('公共音频包下载中时透传真实百分比到当前游戏卡片', () => {
        const merged = buildSharedAudioDependencyState(createBaseState(), {
            gameId: 'common-audio',
            runtimeChannel: 'stable',
            status: 'downloading',
            progressMode: 'determinate',
            progressPercent: 100,
            updatedAt: 2,
        });

        expect(merged.status).toBe('downloading');
        expect(merged.progressMode).toBe('determinate');
        expect(merged.progressPercent).toBe(100);
    });

    it('公共音频包失败时仍保留真实失败信息', () => {
        const merged = buildSharedAudioDependencyState(createBaseState(), {
            gameId: 'common-audio',
            runtimeChannel: 'stable',
            status: 'failed',
            progressMode: 'determinate',
            progressPercent: 42,
            errorCode: 'network-timeout',
            errorMessage: '网络超时',
            updatedAt: 2,
        });

        expect(merged.status).toBe('failed');
        expect(merged.progressMode).toBe('determinate');
        expect(merged.progressPercent).toBe(42);
        expect(merged.errorCode).toBe('network-timeout');
        expect(merged.errorMessage).toContain('公共音频包安装失败');
    });
});

describe('resolveManifestForPackageInstallAttempt', () => {
    const createManifest = (override: Partial<ResolvedGamePackageManifest> = {}): ResolvedGamePackageManifest => ({
        gameId: 'dicethrone',
        runtimeChannel: 'stable',
        assetPackId: 'dicethrone',
        assetPackVersion: '0.6.4-dicethrone-pkg',
        assetPackUrl: 'https://assets.example.test/mobile-packages/android/stable/bundles/dicethrone/full.zip',
        assetPackChecksum: 'full-checksum',
        assetPackFileIndexUrl: 'https://assets.example.test/mobile-packages/android/stable/file-index/dicethrone/index.json',
        assetPackFileIndexChecksum: 'index-checksum',
        source: 'remote',
        ...override,
    });

    it('上次增量校验失败且完整包存在时，下一次安装改走完整 ZIP', () => {
        const manifest = resolveManifestForPackageInstallAttempt(createManifest(), {
            status: 'failed',
            errorCode: 'checksum-mismatch',
        });

        expect(manifest.assetPackUrl).toContain('/bundles/dicethrone/full.zip');
        expect(manifest.assetPackFileIndexUrl).toBeUndefined();
        expect(manifest.assetPackFileIndexChecksum).toBeUndefined();
        expect(manifest.assetPackDiffOnly).toBeUndefined();
    });

    it('只有本地临时文件校验失败文字时，下一次安装也改走完整 ZIP', () => {
        const manifest = resolveManifestForPackageInstallAttempt(createManifest(), {
            status: 'failed',
            errorCode: undefined,
            errorMessage: '本地临时文件校验失败',
        });

        expect(manifest.assetPackUrl).toContain('/bundles/dicethrone/full.zip');
        expect(manifest.assetPackFileIndexUrl).toBeUndefined();
        expect(manifest.assetPackFileIndexChecksum).toBeUndefined();
        expect(manifest.assetPackDiffOnly).toBeUndefined();
    });

    it('只有拒绝增量续传文字时，下一次安装也改走完整 ZIP', () => {
        const manifest = resolveManifestForPackageInstallAttempt(createManifest(), {
            status: 'failed',
            errorCode: undefined,
            errorMessage: '服务端拒绝增量续传，本地临时文件校验失败',
        });

        expect(manifest.assetPackUrl).toContain('/bundles/dicethrone/full.zip');
        expect(manifest.assetPackFileIndexUrl).toBeUndefined();
        expect(manifest.assetPackFileIndexChecksum).toBeUndefined();
        expect(manifest.assetPackDiffOnly).toBeUndefined();
    });

    it('diff-only 索引包不能降级成旧完整包', () => {
        const original = createManifest({ assetPackDiffOnly: true });
        const manifest = resolveManifestForPackageInstallAttempt(original, {
            status: 'failed',
            errorCode: 'checksum-mismatch',
        });

        expect(manifest).toBe(original);
        expect(manifest.assetPackFileIndexUrl).toContain('/file-index/dicethrone/index.json');
        expect(manifest.assetPackDiffOnly).toBe(true);
    });

    it('非校验失败不改变增量安装入口', () => {
        const original = createManifest();
        const manifest = resolveManifestForPackageInstallAttempt(original, {
            status: 'failed',
            errorCode: 'network-timeout',
        });

        expect(manifest).toBe(original);
    });
});
