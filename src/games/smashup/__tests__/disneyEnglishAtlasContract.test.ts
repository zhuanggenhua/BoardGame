import { describe, expect, it, beforeEach } from 'vitest';

import {
    __resetAssetLoaderCachesForTests,
    getLocalizedImageCandidateUrls,
    setAssetHashesForTesting,
    setAssetsBaseUrl,
    setLocalizedImageIndexForTesting,
} from '../../../core/AssetLoader';
import rootManifest from '../../../../public/assets/i18n/assets-manifest.json';

type VariantInfo = {
    sha256: string;
    bytes: number;
    mime: string;
};

type ManifestFile = {
    variants: Record<string, VariantInfo>;
};

const manifestFiles = rootManifest.files as Record<string, ManifestFile>;

const DISNEY_ENGLISH_ASSETS = [
    {
        key: 'en/smashup/cards/disney',
        ext: 'png',
        sha256: 'ab35ed10b863de226c3bdda0e391ddb5e4f9a01ed666a6867fd5280e67b0915d',
        bytes: 33283832,
        mime: 'image/png',
    },
    {
        key: 'en/smashup/cards/disney_four_factions',
        ext: 'png',
        sha256: 'daad522f77d5e4b256aad3f23fe22f76860ec0183cfa137f1f4305c03ae54406',
        bytes: 34764781,
        mime: 'image/png',
    },
    {
        key: 'en/smashup/cards/compressed/disney',
        ext: 'webp',
        sha256: '79f07743e43de2f380d1abc37ab202a436915ae247e8adaebfd02093216cffb8',
        bytes: 3992798,
        mime: 'image/webp',
    },
    {
        key: 'en/smashup/cards/compressed/disney_four_factions',
        ext: 'webp',
        sha256: '15fa5154e7b88c59a913aeb7277950475e55c288e835bd43e9ddc3c47de19f11',
        bytes: 3795192,
        mime: 'image/webp',
    },
    {
        key: 'en/smashup/base/disney_bases',
        ext: 'jpg',
        sha256: 'ef0b81fe9a25314903a5e22901f96639d3543cee9ff1c599f724326c16240572',
        bytes: 3224843,
        mime: 'image/jpeg',
    },
    {
        key: 'en/smashup/base/disney_four_faction_bases',
        ext: 'jpg',
        sha256: '00e533350eac1b5dfe81ba891aa6e188e86697bbf50212d4524cff9b8958730d',
        bytes: 3341993,
        mime: 'image/jpeg',
    },
    {
        key: 'en/smashup/base/compressed/disney_bases',
        ext: 'webp',
        sha256: 'f901157e1f01d33bf47024dc42c58b49974df40e988620510c9ba644b94dfeea',
        bytes: 1016654,
        mime: 'image/webp',
    },
    {
        key: 'en/smashup/base/compressed/disney_four_faction_bases',
        ext: 'webp',
        sha256: '0702bbada2cf35f45d46f55754a47a400ca57753bf3d00a4ecb6e311528367d4',
        bytes: 1064666,
        mime: 'image/webp',
    },
] as const;

const DISNEY_RUNTIME_ATLASES = [
    'smashup/cards/disney',
    'smashup/cards/disney_four_factions',
    'smashup/base/disney_bases',
    'smashup/base/disney_four_faction_bases',
] as const;

describe('SmashUp Disney 英文 POD 图集资源合同', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
        setAssetHashesForTesting({});
        setLocalizedImageIndexForTesting({});
        __resetAssetLoaderCachesForTests();
    });

    it('八个英文 Disney atlas 资源进入根级 manifest，并锁定生成物 hash/bytes/mime', () => {
        expect(rootManifest.basePrefix).toBe('official/i18n/');

        for (const asset of DISNEY_ENGLISH_ASSETS) {
            const manifestEntry = manifestFiles[asset.key];
            expect(manifestEntry, asset.key).toBeDefined();
            expect(manifestEntry.variants[asset.ext], asset.key).toEqual({
                sha256: asset.sha256,
                bytes: asset.bytes,
                mime: asset.mime,
            });
        }
    });

    it('英文界面优先使用 en compressed Disney atlas，不先回退 zh-CN 图集', () => {
        setLocalizedImageIndexForTesting(Object.fromEntries(
            DISNEY_RUNTIME_ATLASES.map((atlas) => [
                `i18n/en/${atlas.replace(/\/(?!.*\/)/, '/compressed/')}`,
                1,
            ]),
        ));

        for (const atlas of DISNEY_RUNTIME_ATLASES) {
            const compressedPath = atlas.replace(/\/(?!.*\/)/, '/compressed/');
            const candidates = getLocalizedImageCandidateUrls(atlas, 'en');

            expect(candidates[0], atlas).toBe(`/assets/i18n/en/${compressedPath}.webp`);
            expect(candidates, atlas).toContain(
                `https://assets.easyboardgame.top/official/i18n/en/${compressedPath}.webp`,
            );
            expect(candidates.some((candidate) => candidate.includes('/i18n/zh-CN/')), atlas).toBe(false);
        }
    });
});
