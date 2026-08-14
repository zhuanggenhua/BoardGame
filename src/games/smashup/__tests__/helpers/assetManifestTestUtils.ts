import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { expect } from 'vitest';

type AssetManifest = {
    files: Record<string, {
        variants?: Record<string, {
            sha256?: string;
        }>;
    }>;
};

function sha256(path: string): string {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function expectLocalAssetHashIfPresent(path: string, expectedSha256: string): void {
    if (!existsSync(path)) return;
    expect(sha256(path)).toBe(expectedSha256);
}

export function expectManifestAssetHash(args: {
    rootManifest: AssetManifest;
    gameManifest: AssetManifest;
    rootKey: string;
    gameKey: string;
    variant: 'jpg' | 'png' | 'webp';
    localPath: string;
}): string {
    const rootSha256 = args.rootManifest.files[args.rootKey]?.variants?.[args.variant]?.sha256;
    expect(rootSha256, `${args.rootKey} ${args.variant} sha256`)
        .toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(args.gameManifest.files[args.gameKey]?.variants?.[args.variant]?.sha256)
        .toBe(rootSha256);
    expectLocalAssetHashIfPresent(args.localPath, rootSha256 as string);
    return rootSha256 as string;
}
