import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
} from '../data/cards';
import {
    INTERNATIONAL_INCIDENT_BASES,
    INTERNATIONAL_INCIDENT_CARDS,
} from '../data/factions/international_incident';
import { SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { expectManifestAssetHash } from './helpers/assetManifestTestUtils';

const CARD_PNG = 'public/assets/i18n/zh-CN/smashup/cards/international_incident.png';
const CARD_WEBP = 'public/assets/i18n/zh-CN/smashup/cards/compressed/international_incident.webp';
const BASE_PNG = 'public/assets/i18n/zh-CN/smashup/base/international_incident_bases.png';
const BASE_WEBP = 'public/assets/i18n/zh-CN/smashup/base/compressed/international_incident_bases.webp';

function physicalCardCount(cards: Array<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

describe('国际事件四派系资源与静态合同', () => {
    it('卡牌与基地 atlas 已登记为正式运行时入口', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([
            {
                id: SMASHUP_ATLAS_IDS.INTERNATIONAL_INCIDENT_CARDS,
                kind: 'card',
                image: 'smashup/cards/international_incident',
                grid: { rows: 7, cols: 8 },
            },
            {
                id: SMASHUP_ATLAS_IDS.INTERNATIONAL_INCIDENT_BASES,
                kind: 'base',
                image: 'smashup/base/international_incident_bases',
                grid: { rows: 4, cols: 4 },
            },
        ]));
    });

    it('正式 atlas 已进入根级与游戏级 manifest', () => {
        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/smashup/assets-manifest.json', 'utf8'));

        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/cards/international_incident',
            gameKey: 'cards/international_incident',
            variant: 'png',
            localPath: CARD_PNG,
        });
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/cards/compressed/international_incident',
            gameKey: 'cards/compressed/international_incident',
            variant: 'webp',
            localPath: CARD_WEBP,
        });
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/base/international_incident_bases',
            gameKey: 'base/international_incident_bases',
            variant: 'png',
            localPath: BASE_PNG,
        });
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/base/compressed/international_incident_bases',
            gameKey: 'base/compressed/international_incident_bases',
            variant: 'webp',
            localPath: BASE_WEBP,
        });
    });

    it('四个派系各自注册为 20 张实体牌并只消费 playable 槽位 0-50', () => {
        const cases = [
            [SMASHUP_FACTION_IDS.SUMO_WRESTLERS, 12, [0, 11]],
            [SMASHUP_FACTION_IDS.MUSKETEERS, 14, [12, 25]],
            [SMASHUP_FACTION_IDS.MOUNTIES, 12, [26, 37]],
            [SMASHUP_FACTION_IDS.LUCHADORS, 13, [38, 50]],
        ] as const;

        expect(INTERNATIONAL_INCIDENT_CARDS).toHaveLength(51);
        expect(physicalCardCount(INTERNATIONAL_INCIDENT_CARDS)).toBe(80);

        for (const [factionId, uniqueCount, [firstIndex, lastIndex]] of cases) {
            const cards = getFactionCards(factionId);
            const slots = cards.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.index : -1);

            expect(cards, `${factionId} unique cards`).toHaveLength(uniqueCount);
            expect(physicalCardCount(cards), `${factionId} physical cards`).toBe(20);
            expect(new Set(cards.map(card => card.id)).size, `${factionId} unique ids`).toBe(uniqueCount);
            expect(Math.min(...slots), `${factionId} first slot`).toBe(firstIndex);
            expect(Math.max(...slots), `${factionId} last slot`).toBe(lastIndex);
            expect(cards.every(card => card.previewRef?.type === 'atlas'
                && card.previewRef.atlasId === SMASHUP_ATLAS_IDS.INTERNATIONAL_INCIDENT_CARDS
                && card.previewRef.index >= firstIndex
                && card.previewRef.index <= lastIndex), `${factionId} preview refs`).toBe(true);
        }

        const allSlots = INTERNATIONAL_INCIDENT_CARDS.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.index : -1);
        expect(new Set(allSlots).size).toBe(51);
        expect(Math.max(...allSlots)).toBe(50);
        expect(allSlots).not.toEqual(expect.arrayContaining([51, 52, 53, 54, 55]));
    });

    it('8 张国际事件基地按派系返回，且槽位使用合同一致', () => {
        expect(INTERNATIONAL_INCIDENT_BASES).toHaveLength(8);

        const baseCases = [
            [SMASHUP_FACTION_IDS.SUMO_WRESTLERS, ['base_heya_training_stable', 'base_the_dohyo']],
            [SMASHUP_FACTION_IDS.MUSKETEERS, ['base_bastion_saint_gervais', 'base_the_golden_lily']],
            [SMASHUP_FACTION_IDS.MOUNTIES, ['base_great_white_north_eh', 'base_strategic_syrup_reserve']],
            [SMASHUP_FACTION_IDS.LUCHADORS, ['base_ringside', 'base_the_squared_circle']],
        ] as const;

        const previewSlots: Record<string, number> = {
            base_heya_training_stable: 12,
            base_the_dohyo: 15,
            base_bastion_saint_gervais: 13,
            base_the_golden_lily: 8,
            base_strategic_syrup_reserve: 9,
            base_great_white_north_eh: 10,
            base_ringside: 14,
            base_the_squared_circle: 11,
        };

        for (const [factionId, expectedBaseIds] of baseCases) {
            expect(getBaseDefIdsForFactions([factionId]).sort()).toEqual([...expectedBaseIds].sort());
        }

        for (const [baseId, expectedIndex] of Object.entries(previewSlots)) {
            expect(getBaseDef(baseId)?.previewRef).toEqual({
                type: 'atlas',
                atlasId: SMASHUP_ATLAS_IDS.INTERNATIONAL_INCIDENT_BASES,
                index: expectedIndex,
            });
        }
    });
});
