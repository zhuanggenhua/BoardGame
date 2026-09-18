import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import rootAssetManifest from '../../../../public/assets/i18n/assets-manifest.json';
import smashUpAssetManifest from '../../../../public/assets/i18n/zh-CN/smashup/assets-manifest.json';
import { ANCIENT_INCAS_CARDS } from '../data/factions/ancient_incas';
import { KUNG_FU_FIGHTERS_CARDS } from '../data/factions/zhongguo';
import { getSmashUpAtlasImageById, SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS } from '../domain/ids';
import { expectManifestAssetHash } from './helpers/assetManifestTestUtils';

function physicalCardCount(cards: Array<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

function assertPodResource(args: {
    rootKey: string;
    gameKey: string;
    variant: 'png' | 'webp';
    localPath: string;
}): void {
    expectManifestAssetHash({
        rootManifest: rootAssetManifest,
        gameManifest: smashUpAssetManifest,
        ...args,
    });
}

function parseJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('功夫斗士与古代印加人 POD 卡图资源合同', () => {
    it('两个原派系使用独立 POD atlas，且不拆分新的玩法身份', () => {
        expect(physicalCardCount(KUNG_FU_FIGHTERS_CARDS)).toBe(20);
        expect(physicalCardCount(ANCIENT_INCAS_CARDS)).toBe(20);
        expect(new Set(KUNG_FU_FIGHTERS_CARDS.map(card => (
            card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null
        )))).toEqual(new Set([SMASHUP_ATLAS_IDS.KUNG_FU_FIGHTERS_POD_CARDS]));
        expect(new Set(ANCIENT_INCAS_CARDS.map(card => (
            card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null
        )))).toEqual(new Set([SMASHUP_ATLAS_IDS.ANCIENT_INCAS_POD_CARDS]));

        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([
            {
                id: SMASHUP_ATLAS_IDS.KUNG_FU_FIGHTERS_POD_CARDS,
                kind: 'card',
                image: 'smashup/cards/kung_fu_fighters_pod',
                grid: { rows: 4, cols: 5 },
            },
            {
                id: SMASHUP_ATLAS_IDS.ANCIENT_INCAS_POD_CARDS,
                kind: 'card',
                image: 'smashup/cards/ancient_incas_pod',
                grid: { rows: 4, cols: 5 },
            },
        ]));
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.KUNG_FU_FIGHTERS_POD_CARDS)).toBe('smashup/cards/kung_fu_fighters_pod');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.ANCIENT_INCAS_POD_CARDS)).toBe('smashup/cards/ancient_incas_pod');
    });

    it('源 PNG 和运行时 webp 都写入根级与游戏级资源清单', () => {
        assertPodResource({
            rootKey: 'zh-CN/smashup/cards/kung_fu_fighters_pod',
            gameKey: 'cards/kung_fu_fighters_pod',
            variant: 'png',
            localPath: 'public/assets/i18n/zh-CN/smashup/cards/kung_fu_fighters_pod.png',
        });
        assertPodResource({
            rootKey: 'zh-CN/smashup/cards/compressed/kung_fu_fighters_pod',
            gameKey: 'cards/compressed/kung_fu_fighters_pod',
            variant: 'webp',
            localPath: 'public/assets/i18n/zh-CN/smashup/cards/compressed/kung_fu_fighters_pod.webp',
        });
        assertPodResource({
            rootKey: 'zh-CN/smashup/cards/ancient_incas_pod',
            gameKey: 'cards/ancient_incas_pod',
            variant: 'png',
            localPath: 'public/assets/i18n/zh-CN/smashup/cards/ancient_incas_pod.png',
        });
        assertPodResource({
            rootKey: 'zh-CN/smashup/cards/compressed/ancient_incas_pod',
            gameKey: 'cards/compressed/ancient_incas_pod',
            variant: 'webp',
            localPath: 'public/assets/i18n/zh-CN/smashup/cards/compressed/ancient_incas_pod.webp',
        });

        const rootManifest = parseJson<{ basePrefix?: string }>('public/assets/i18n/assets-manifest.json');
        const gameManifest = parseJson<{ basePrefix?: string }>('public/assets/i18n/zh-CN/smashup/assets-manifest.json');
        expect(rootManifest.basePrefix).toBe('official/i18n/');
        expect(gameManifest.basePrefix).toBe('official/i18n/zh-CN/smashup/');
    });
});
