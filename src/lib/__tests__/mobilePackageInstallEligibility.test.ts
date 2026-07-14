import { describe, expect, it } from 'vitest';
import {
    canInstallResolvedAssetPack,
    type ResolvedGamePackageManifest,
} from '../../features/mobile-packages/types';

const createManifest = (
    override: Partial<ResolvedGamePackageManifest>,
): ResolvedGamePackageManifest => ({
    gameId: 'qidahen',
    source: 'remote',
    assetPackId: 'qidahen',
    assetPackVersion: 'test-version',
    ...override,
});

describe('mobile package install eligibility', () => {
    it('allows a diff-index-only asset package to enter the install flow', () => {
        expect(canInstallResolvedAssetPack(createManifest({
            assetPackDiffOnly: true,
            assetPackFileIndexUrl: 'https://assets.example.test/file-index/qidahen.json',
        }))).toBe(true);
    });

    it('blocks install when neither a full asset pack URL nor a diff index is available', () => {
        expect(canInstallResolvedAssetPack(createManifest({}))).toBe(false);
    });
});
