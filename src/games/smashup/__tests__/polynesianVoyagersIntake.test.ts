import { describe, expect, it } from 'vitest';

import i18nManifest from '../../../../public/assets/i18n/assets-manifest.json';
import smashupManifest from '../../../../public/assets/i18n/zh-CN/smashup/assets-manifest.json';
import enLocale from '../../../../public/locales/en/game-smashup.json';
import zhLocale from '../../../../public/locales/zh-CN/game-smashup.json';
import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
} from '../data/cards';
import { smashUpRuntimeCriticalImageResolver } from '../runtimeCriticalImageResolver';
import { FACTION_DISPLAY_NAMES, SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { BaseCardDef, CardDef } from '../domain/types';
import { isFactionImplementationInProgress } from '../ui/factionMeta';

const FACTION = SMASHUP_FACTION_IDS.POLYNESIAN_VOYAGERS;
const CARD_IDS = [
    'polynesian_voyagers_growth_of_the_tribes',
    'polynesian_voyagers_knowledge_of_the_tribes',
    'polynesian_voyagers_moai',
    'polynesian_voyagers_tiki',
    'polynesian_voyagers_wayfinder',
    'polynesian_voyagers_maui',
    'polynesian_voyagers_ocean_tattoo',
    'polynesian_voyagers_tattoo_artist',
    'polynesian_voyagers_unity_of_the_tribes',
    'polynesian_voyagers_volcanic_uprising',
    'polynesian_voyagers_shark_tattoo',
    'polynesian_voyagers_sun_tattoo',
] as const;

const BASES: Record<string, { index: number; breakpoint: number; vpAwards: [number, number, number] }> = {
    base_island_chain: { index: 8, breakpoint: 17, vpAwards: [3, 1, 1] },
    base_island_peak: { index: 9, breakpoint: 23, vpAwards: [4, 2, 1] },
    base_tropical_paradise: { index: 10, breakpoint: 20, vpAwards: [3, 2, 1] },
};

function expectAtlasPreview(def: CardDef, index: number): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_CARDS,
        index,
    });
}

describe('SmashUp 波利尼西亚航海者 intake 静态合同', () => {
    it('卡牌数量、拷贝数与卡图索引正确', () => {
        const cards = getFactionCards(FACTION);

        expect(cards).toHaveLength(12);
        expect(cards.reduce((sum, card) => sum + card.count, 0)).toBe(20);

        CARD_IDS.forEach((cardId, index) => {
            const def = cards.find(card => card.id === cardId);
            expect(def, `${cardId} 应已注册`).toBeDefined();
            expectAtlasPreview(def as CardDef, index);
        });
    });

    it('基地数量、数值与既有 base atlas 索引正确', () => {
        expect(getBaseDefIdsForFactions([FACTION]).sort()).toEqual(Object.keys(BASES).sort());

        for (const [baseId, expected] of Object.entries(BASES)) {
            const def = getBaseDef(baseId) as BaseCardDef | undefined;
            expect(def, `${baseId} 应已注册`).toBeDefined();
            expect(def?.faction).toBe(FACTION);
            expect(def?.breakpoint).toBe(expected.breakpoint);
            expect(def?.vpAwards).toEqual(expected.vpAwards);
            expect(def?.previewRef).toEqual({
                type: 'atlas',
                atlasId: SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_BASES,
                index: expected.index,
            });
        }
    });

    it('双语 locale、显示名和图集 manifest 已闭合', () => {
        expect(FACTION_DISPLAY_NAMES[FACTION]).toBe('波利尼西亚航海者');
        expect(isFactionImplementationInProgress(FACTION)).toBe(false);
        expect(zhLocale.factions.polynesian_voyagers.name).toBe('波利尼西亚航海者');
        expect(enLocale.factions.polynesian_voyagers.name).toBe('Polynesian Voyagers');

        for (const cardId of CARD_IDS) {
            expect(zhLocale.cards[cardId]?.name, `${cardId} 应有中文 locale`).toBeTruthy();
            expect(enLocale.cards[cardId]?.name, `${cardId} 应有英文 locale`).toBeTruthy();
        }
        for (const baseId of Object.keys(BASES)) {
            expect(zhLocale.cards[baseId]?.name, `${baseId} 应有中文 locale`).toBeTruthy();
            expect(enLocale.cards[baseId]?.name, `${baseId} 应有英文 locale`).toBeTruthy();
        }

        expect(smashupManifest.files['cards/polynesian_voyagers']).toBeDefined();
        expect(smashupManifest.files['cards/compressed/polynesian_voyagers']).toBeDefined();
        expect(i18nManifest.files['zh-CN/smashup/cards/polynesian_voyagers']).toBeDefined();
        expect(i18nManifest.files['zh-CN/smashup/cards/compressed/polynesian_voyagers']).toBeDefined();
    });

    it('预加载解析器会为选中的派系返回卡牌和基地图集', () => {
        const resolved = smashUpRuntimeCriticalImageResolver({
            core: {
                players: {
                    p1: { factions: [FACTION] },
                },
            },
            sys: { phase: 'playCards' },
        }, 'zh-CN', 'p1');

        expect(resolved.critical).toContain('smashup/cards/polynesian_voyagers');
        expect(resolved.critical).toContain('smashup/base/polynesian_voyagers/atlas');
    });
});
