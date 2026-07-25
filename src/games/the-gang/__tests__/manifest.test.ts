import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test } from 'vitest';
import {
    clearGameAssetBaseOverrides,
    getLocalizedImageCandidateUrls,
    setAssetHashesForTesting,
    setAssetsBaseUrl,
    setLocalizedImageIndexForTesting,
} from '../../../core/AssetLoader';
import { THE_GANG_MANIFEST } from '../manifest';
import { audioConfig, engineConfig } from '../game';
import { THE_GANG_AUDIO_CONFIG } from '../audio.config';
import { THE_GANG_CHALLENGES } from '../domain/expansions';

const readAssetManifest = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as {
    files?: Record<string, unknown>;
};

describe('The Gang manifest', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
        setAssetHashesForTesting({});
        setLocalizedImageIndexForTesting({});
        clearGameAssetBaseOverrides();
    });

    test('声明注册表必需字段', () => {
        expect(THE_GANG_MANIFEST.id).toBe('the-gang');
        expect(THE_GANG_MANIFEST.enabled).toBe(true);
        expect(THE_GANG_MANIFEST.thumbnailPath).toBe('the-gang/thumbnails/the-gang-vault-heist-thumbnail');
        expect(THE_GANG_MANIFEST.mobileProfile).toBe('landscape-adapted');
        expect(THE_GANG_MANIFEST.preferredOrientation).toBe('landscape');
        expect(THE_GANG_MANIFEST.mobileLayoutPreset).toBe('board-shell');
        expect(THE_GANG_MANIFEST.shellTargets).toContain('pwa');
        expect(THE_GANG_MANIFEST.ai).toEqual({
            capture: true,
            localAi: true,
            remoteAi: false,
            defaultLocalAiSeats: 'all-opponents',
        });
        expect(engineConfig.gameId).toBe('the-gang');
        expect(audioConfig).toBe(THE_GANG_AUDIO_CONFIG);
    });

    test('大厅缩略图同时进入游戏清单和根级语言资源索引', () => {
        const thumbnailKey = 'thumbnails/the-gang-vault-heist-thumbnail';
        const compressedThumbnailKey = 'thumbnails/compressed/the-gang-vault-heist-thumbnail';
        const rootThumbnailKey = `zh-CN/the-gang/${thumbnailKey}`;
        const rootCompressedThumbnailKey = `zh-CN/the-gang/${compressedThumbnailKey}`;

        const gameAssetManifest = readAssetManifest('public/assets/i18n/zh-CN/the-gang/assets-manifest.json');
        const rootAssetManifest = readAssetManifest('public/assets/i18n/assets-manifest.json');

        expect(gameAssetManifest.files?.[thumbnailKey]).toBeDefined();
        expect(gameAssetManifest.files?.[compressedThumbnailKey]).toBeDefined();
        expect(gameAssetManifest.files?.['chips/exit-chip']).toBeDefined();
        expect(gameAssetManifest.files?.['chips/compressed/exit-chip']).toBeDefined();
        expect(rootAssetManifest.files?.[rootThumbnailKey]).toBeDefined();
        expect(rootAssetManifest.files?.[rootCompressedThumbnailKey]).toBeDefined();
        expect(rootAssetManifest.files?.['zh-CN/the-gang/chips/exit-chip']).toBeDefined();
        expect(rootAssetManifest.files?.['zh-CN/the-gang/chips/compressed/exit-chip']).toBeDefined();
    });

    test('TTS 扩展规则、工具牌和专家牌素材进入正式资源清单', () => {
        const gameAssetManifest = readAssetManifest('public/assets/i18n/zh-CN/the-gang/assets-manifest.json');
        const rootAssetManifest = readAssetManifest('public/assets/i18n/assets-manifest.json');

        for (const challengeId of Object.keys(THE_GANG_CHALLENGES)) {
            expect(gameAssetManifest.files?.[`rule-assets/challenges/compressed/${challengeId}`]).toBeDefined();
        }
        expect(gameAssetManifest.files?.['rule-assets/tools/compressed/burner-phone']).toBeDefined();
        expect(gameAssetManifest.files?.['rule-assets/tools/compressed/flashlight']).toBeDefined();
        expect(gameAssetManifest.files?.['rule-assets/specialists/compressed/mastermind']).toBeDefined();
        expect(gameAssetManifest.files?.['rule-assets/surfaces/compressed/challenge-zone']).toBeDefined();

        for (const challengeId of Object.keys(THE_GANG_CHALLENGES)) {
            expect(rootAssetManifest.files?.[`zh-CN/the-gang/rule-assets/challenges/compressed/${challengeId}`]).toBeDefined();
        }
        expect(rootAssetManifest.files?.['zh-CN/the-gang/rule-assets/tools/compressed/burner-phone']).toBeDefined();
        expect(rootAssetManifest.files?.['zh-CN/the-gang/rule-assets/specialists/compressed/mastermind']).toBeDefined();
    });

    test('大厅缩略图会生成移动端可回退到官方资源域名的新压缩图片候选地址', () => {
        setLocalizedImageIndexForTesting({
            'i18n/zh-CN/the-gang/thumbnails/compressed/the-gang-vault-heist-thumbnail': 1,
        });

        const candidates = getLocalizedImageCandidateUrls(THE_GANG_MANIFEST.thumbnailPath ?? '', 'zh-CN');

        expect(candidates).toContain('/assets/i18n/zh-CN/the-gang/thumbnails/compressed/the-gang-vault-heist-thumbnail.webp');
        expect(candidates).toContain('https://assets.easyboardgame.top/official/i18n/zh-CN/the-gang/thumbnails/compressed/the-gang-vault-heist-thumbnail.webp');
        expect(candidates.some((candidate) => candidate.includes('/the-gang/thumbnails/compressed/cover.webp'))).toBe(false);
    });
});
