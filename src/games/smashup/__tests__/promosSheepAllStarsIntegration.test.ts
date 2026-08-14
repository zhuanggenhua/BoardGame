import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
} from '../data/cards';
import { ALL_STARS_CARDS } from '../data/factions/all_stars';
import { SHEEP_CARDS } from '../data/factions/sheep';
import { SMASHUP_ATLAS_DEFINITIONS, getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { FACTION_METADATA } from '../ui/factionMeta';
import { expectManifestAssetHash } from './helpers/assetManifestTestUtils';

function physicalCardCount(cards: Array<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

const CARD_PNG = 'public/assets/i18n/zh-CN/smashup/cards/promos_sheep_all_stars.png';
const CARD_WEBP = 'public/assets/i18n/zh-CN/smashup/cards/compressed/promos_sheep_all_stars.webp';


describe('Promo 绵羊与全明星接入', () => {
    it('两派系注册为正确实体牌数量且定义 ID 唯一', () => {
        expect(SHEEP_CARDS).toHaveLength(12);
        expect(physicalCardCount(SHEEP_CARDS)).toBe(20);
        expect(new Set(SHEEP_CARDS.map(card => card.id)).size).toBe(12);

        expect(ALL_STARS_CARDS).toHaveLength(20);
        expect(physicalCardCount(ALL_STARS_CARDS)).toBe(20);
        expect(new Set(ALL_STARS_CARDS.map(card => card.id)).size).toBe(20);

        expect(getFactionCards(SMASHUP_FACTION_IDS.SHEEP).map(card => card.id)).toEqual(
            SHEEP_CARDS.map(card => card.id),
        );
        expect(getFactionCards(SMASHUP_FACTION_IDS.ALL_STARS).map(card => card.id)).toEqual(
            ALL_STARS_CARDS.map(card => card.id),
        );
    });

    it('共享 6 x 6 卡图 atlas，只注册 playable 槽位 0-31', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([{
            id: SMASHUP_ATLAS_IDS.PROMOS_SHEEP_ALL_STARS_CARDS,
            kind: 'card',
            image: 'smashup/cards/promos_sheep_all_stars',
            grid: { rows: 6, cols: 6 },
        }]));
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.PROMOS_SHEEP_ALL_STARS_CARDS))
            .toBe('smashup/cards/promos_sheep_all_stars');

        const sheepSlots = SHEEP_CARDS.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.index : -1);
        const allStarsSlots = ALL_STARS_CARDS.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.index : -1);

        expect(sheepSlots.sort((left, right) => left - right)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(allStarsSlots.sort((left, right) => left - right)).toEqual([
            12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
            22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        ]);
        expect([...sheepSlots, ...allStarsSlots]).not.toEqual(expect.arrayContaining([32, 33, 34, 35]));
    });

    it('正式卡图 atlas 已进入根级与游戏级 manifest', () => {
        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/smashup/assets-manifest.json', 'utf8'));
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/cards/promos_sheep_all_stars',
            gameKey: 'cards/promos_sheep_all_stars',
            variant: 'png',
            localPath: CARD_PNG,
        });
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/cards/compressed/promos_sheep_all_stars',
            gameKey: 'cards/compressed/promos_sheep_all_stars',
            variant: 'webp',
            localPath: CARD_WEBP,
        });
    });

    it('复用 BASE4 槽位 8-11 注册绵羊与全明星基地', () => {
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.SHEEP]).sort()).toEqual([
            'base_sheep_shrine',
            'base_the_pasture',
        ]);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.ALL_STARS]).sort()).toEqual([
            'base_locker_room',
            'base_stadium',
        ]);

        expect(getBaseDef('base_the_pasture')).toMatchObject({
            breakpoint: 25,
            vpAwards: [5, 3, 2],
            faction: SMASHUP_FACTION_IDS.SHEEP,
            previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 8 },
        });
        expect(getBaseDef('base_sheep_shrine')).toMatchObject({
            breakpoint: 19,
            vpAwards: [4, 2, 1],
            faction: SMASHUP_FACTION_IDS.SHEEP,
            previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 9 },
            replaceOnSetup: true,
        });
        expect(getBaseDef('base_locker_room')).toMatchObject({
            breakpoint: 23,
            vpAwards: [3, 2, 2],
            faction: SMASHUP_FACTION_IDS.ALL_STARS,
            previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 10 },
        });
        expect(getBaseDef('base_stadium')).toMatchObject({
            breakpoint: 17,
            vpAwards: [3, 2, 1],
            faction: SMASHUP_FACTION_IDS.ALL_STARS,
            previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 11 },
        });
    });

    it('两派系进入派系选择元数据', () => {
        const byId = new Map(FACTION_METADATA.map(meta => [meta.id, meta]));
        expect(byId.get(SMASHUP_FACTION_IDS.SHEEP)?.nameKey).toBe('factions.sheep.name');
        expect(byId.get(SMASHUP_FACTION_IDS.ALL_STARS)?.nameKey).toBe('factions.all_stars.name');
    });
});
