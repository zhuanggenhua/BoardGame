import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { getFactionCards } from '../data/cards';
import { SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { expectManifestAssetHash } from './helpers/assetManifestTestUtils';

const MARVEL_CARD_PNG = 'public/assets/i18n/zh-CN/smashup/cards/marvel_wave_one.png';
const MARVEL_CARD_WEBP = 'public/assets/i18n/zh-CN/smashup/cards/compressed/marvel_wave_one.webp';

describe('SmashUp 漫威四派系资源合同', () => {
    it('marvel_wave_one 卡图 atlas 已登记为 9 x 6 共享运行时入口', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([{
            id: SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_CARDS,
            kind: 'card',
            image: 'smashup/cards/marvel_wave_one',
            grid: { rows: 6, cols: 9 },
        }]));
    });

    it('cards/marvel_wave_one 已进入根级与游戏级 manifest', () => {
        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/smashup/assets-manifest.json', 'utf8'));

        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/cards/marvel_wave_one',
            gameKey: 'cards/marvel_wave_one',
            variant: 'png',
            localPath: MARVEL_CARD_PNG,
        });
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/cards/compressed/marvel_wave_one',
            gameKey: 'cards/compressed/marvel_wave_one',
            variant: 'webp',
            localPath: MARVEL_CARD_WEBP,
        });
    });

    it('四个漫威派系都使用共享 atlas，且各自实体牌数量为 20', () => {
        const cases = [
            [SMASHUP_FACTION_IDS.AVENGERS, 18, [0, 17]],
            [SMASHUP_FACTION_IDS.SHIELD, 12, [18, 29]],
            [SMASHUP_FACTION_IDS.SPIDER_VERSE, 12, [30, 41]],
            [SMASHUP_FACTION_IDS.ULTIMATES, 12, [42, 53]],
        ] as const;

        for (const [factionId, uniqueCount, [firstIndex, lastIndex]] of cases) {
            const cards = getFactionCards(factionId);
            expect(cards, `${factionId} unique cards`).toHaveLength(uniqueCount);
            expect(cards.reduce((sum, card) => sum + card.count, 0), `${factionId} deck count`).toBe(20);
            expect(cards[0]?.previewRef).toEqual({
                type: 'atlas',
                atlasId: SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_CARDS,
                index: firstIndex,
            });
            expect(cards.at(-1)?.previewRef).toEqual({
                type: 'atlas',
                atlasId: SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_CARDS,
                index: lastIndex,
            });
        }
    });
});
