import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { getFactionCards } from '../data/cards';
import { SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { expectManifestAssetHash } from './helpers/assetManifestTestUtils';

const MARVEL_VILLAINS_CARD_PNG = 'public/assets/i18n/zh-CN/smashup/cards/marvel_villains.png';
const MARVEL_VILLAINS_CARD_WEBP = 'public/assets/i18n/zh-CN/smashup/cards/compressed/marvel_villains.webp';


describe('SmashUp 漫威反派四派系资源合同', () => {
    it('marvel_villains 卡图 atlas 已登记为 9 x 6 共享运行时入口', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([{
            id: SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_CARDS,
            kind: 'card',
            image: 'smashup/cards/marvel_villains',
            grid: { rows: 6, cols: 9 },
        }]));
    });

    it('cards/marvel_villains 已进入根级与游戏级 manifest', () => {
        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/smashup/assets-manifest.json', 'utf8'));
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/cards/marvel_villains',
            gameKey: 'cards/marvel_villains',
            variant: 'png',
            localPath: MARVEL_VILLAINS_CARD_PNG,
        });
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/cards/compressed/marvel_villains',
            gameKey: 'cards/compressed/marvel_villains',
            variant: 'webp',
            localPath: MARVEL_VILLAINS_CARD_WEBP,
        });
    });

    it('四个漫威反派派系都使用共享 atlas，且各自实体牌数量为 20', () => {
        const cases = [
            [SMASHUP_FACTION_IDS.HYDRA, 11, [0, 10]],
            [SMASHUP_FACTION_IDS.KREE, 12, [11, 22]],
            [SMASHUP_FACTION_IDS.MASTERS_OF_EVIL, 12, [23, 34]],
            [SMASHUP_FACTION_IDS.SINISTER_SIX, 14, [35, 48]],
        ] as const;

        for (const [factionId, uniqueCount, [firstIndex, lastIndex]] of cases) {
            const cards = getFactionCards(factionId);
            expect(cards, `${factionId} unique cards`).toHaveLength(uniqueCount);
            expect(cards.reduce((sum, card) => sum + card.count, 0), `${factionId} deck count`).toBe(20);
            expect(cards[0]?.previewRef).toEqual({
                type: 'atlas',
                atlasId: SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_CARDS,
                index: firstIndex,
            });
            expect(cards.at(-1)?.previewRef).toEqual({
                type: 'atlas',
                atlasId: SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_CARDS,
                index: lastIndex,
            });
            expect(cards.every(card => card.previewRef?.type === 'atlas'
                && card.previewRef.atlasId === SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_CARDS
                && card.previewRef.index >= 0
                && card.previewRef.index <= 48), `${factionId} preview refs`).toBe(true);
        }
    });
});