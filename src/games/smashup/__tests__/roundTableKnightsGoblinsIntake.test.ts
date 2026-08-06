import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
} from '../data/cards';
import {
    getSmashUpAtlasImageById,
    SMASHUP_ATLAS_DEFINITIONS,
} from '../domain/atlasCatalog';
import { isSmashUpDiyFaction, SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { BaseCardDef, CardDef } from '../domain/types';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { getVisibleFactionMetadata, isFactionImplementationInProgress } from '../ui/factionMeta';

type FactionIntakeCase = {
    factionId: string;
    cardAtlasId: string;
    cardAtlasImage: string;
    baseAtlasId: string;
    baseAtlasImage: string;
    expectedCardCount: number;
    expectedDeckCopies: number;
    expectedCardIndexes: Record<string, number>;
    expectedBases: Record<string, { index: number; breakpoint: number; vpAwards: [number, number, number] }>;
};

const FACTIONS: FactionIntakeCase[] = [
    {
        factionId: SMASHUP_FACTION_IDS.ROUND_TABLE_KNIGHTS,
        cardAtlasId: SMASHUP_ATLAS_IDS.ROUND_TABLE_KNIGHTS_CARDS,
        cardAtlasImage: 'smashup/cards/round_table_knights',
        baseAtlasId: SMASHUP_ATLAS_IDS.ROUND_TABLE_KNIGHTS_BASES,
        baseAtlasImage: 'smashup/base/round_table_knights_bases',
        expectedCardCount: 18,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            round_table_knights_king_arthur: 0,
            round_table_knights_galahad: 1,
            round_table_knights_gawain: 2,
            round_table_knights_guinevere: 3,
            round_table_knights_lancelot: 4,
            round_table_knights_merlin: 5,
            round_table_knights_percival: 6,
            round_table_knights_a_questing: 7,
            round_table_knights_excalibur: 8,
            round_table_knights_good_deed: 9,
            round_table_knights_merlins_library: 11,
            round_table_knights_noble_steed: 12,
            round_table_knights_the_fisher_king: 14,
            round_table_knights_the_grail: 15,
            round_table_knights_the_green_knight: 16,
            round_table_knights_the_lady_of_the_lake: 17,
            round_table_knights_the_mists_of_avalon: 18,
            round_table_knights_the_questing_beast: 19,
        },
        expectedBases: {
            base_camelot: { index: 0, breakpoint: 22, vpAwards: [5, 3, 2] },
            base_round_table: { index: 1, breakpoint: 21, vpAwards: [4, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.GOBLINS,
        cardAtlasId: SMASHUP_ATLAS_IDS.GOBLINS_CARDS,
        cardAtlasImage: 'smashup/cards/goblins',
        baseAtlasId: SMASHUP_ATLAS_IDS.GOBLINS_BASES,
        baseAtlasImage: 'smashup/base/goblins_bases',
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            goblins_chaos_lord: 0,
            goblins_diviner: 1,
            goblins_blaster: 3,
            goblins_gobbo: 6,
            goblins_magic_helmet: 10,
            goblins_a_little_help: 11,
            goblins_bushwhacking: 13,
            goblins_demolition: 14,
            goblins_recruiters: 15,
            goblins_he_who_smelt_it: 16,
            goblins_make_your_own_luck: 17,
            goblins_revving_up: 19,
        },
        expectedBases: {
            base_goblin_caves: { index: 0, breakpoint: 17, vpAwards: [3, 1, 1] },
            base_goblin_town: { index: 1, breakpoint: 21, vpAwards: [4, 2, 1] },
        },
    },
];

function makePlayingState(factions: Record<string, [string, string]>) {
    return {
        sys: { phase: 'playCards' },
        core: {
            players: Object.fromEntries(
                Object.entries(factions).map(([pid, picked]) => [pid, { factions: picked }]),
            ),
        },
    };
}

function assertCardPreview(def: CardDef, atlasId: string, expectedIndex: number): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId,
        index: expectedIndex,
    });
}

function assertBasePreview(
    def: BaseCardDef,
    atlasId: string,
    expected: { index: number; breakpoint: number; vpAwards: [number, number, number] },
): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId,
        index: expected.index,
    });
    expect(def.breakpoint).toBe(expected.breakpoint);
    expect(def.vpAwards).toEqual(expected.vpAwards);
}

function loadLocale(locale: 'zh-CN' | 'en') {
    return JSON.parse(readFileSync(`public/locales/${locale}/game-smashup.json`, 'utf8')) as {
        factions: Record<string, { name?: string; description?: string }>;
        cards: Record<string, { name?: string; abilityText?: string; effectText?: string }>;
    };
}

describe('SmashUp 圆桌骑士 / 哥布林 intake 静态合同', () => {
    it('图集 grid 与运行时图片路径使用去 new 后命名', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([
            {
                id: SMASHUP_ATLAS_IDS.ROUND_TABLE_KNIGHTS_CARDS,
                kind: 'card',
                image: 'smashup/cards/round_table_knights',
                grid: { rows: 4, cols: 5 },
            },
            {
                id: SMASHUP_ATLAS_IDS.ROUND_TABLE_KNIGHTS_BASES,
                kind: 'base',
                image: 'smashup/base/round_table_knights_bases',
                grid: { rows: 1, cols: 2 },
            },
            {
                id: SMASHUP_ATLAS_IDS.GOBLINS_CARDS,
                kind: 'card',
                image: 'smashup/cards/goblins',
                grid: { rows: 4, cols: 5 },
            },
            {
                id: SMASHUP_ATLAS_IDS.GOBLINS_BASES,
                kind: 'base',
                image: 'smashup/base/goblins_bases',
                grid: { rows: 1, cols: 2 },
            },
        ]));

        for (const fixture of FACTIONS) {
            expect(getSmashUpAtlasImageById(fixture.cardAtlasId)).toBe(fixture.cardAtlasImage);
            expect(getSmashUpAtlasImageById(fixture.baseAtlasId)).toBe(fixture.baseAtlasImage);
        }
    });

    it.each(FACTIONS)('$factionId 卡牌数量、拷贝数与 row-major 索引正确', (fixture) => {
        const defs = getFactionCards(fixture.factionId);

        expect(defs).toHaveLength(fixture.expectedCardCount);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(fixture.expectedDeckCopies);

        for (const [defId, expectedIndex] of Object.entries(fixture.expectedCardIndexes)) {
            const def = defs.find(card => card.id === defId);
            expect(def, `${defId} 应已注册`).toBeDefined();
            assertCardPreview(def as CardDef, fixture.cardAtlasId, expectedIndex);
        }
    });

    it.each(FACTIONS)('$factionId 只返回本派系两张基地', (fixture) => {
        const baseIds = getBaseDefIdsForFactions([fixture.factionId]).sort();
        const expectedBaseIds = Object.keys(fixture.expectedBases).sort();

        expect(baseIds).toEqual(expectedBaseIds);

        for (const [baseId, expected] of Object.entries(fixture.expectedBases)) {
            const def = getBaseDef(baseId);
            expect(def, `${baseId} 应已注册`).toBeDefined();
            expect(def?.faction).toBe(fixture.factionId);
            assertBasePreview(def as BaseCardDef, fixture.baseAtlasId, expected);
        }
    });

    it('关键图片预加载会命中新卡图与基地图集', () => {
        const resolved = smashUpCriticalImageResolver(
            makePlayingState({
                '0': [SMASHUP_FACTION_IDS.ROUND_TABLE_KNIGHTS, SMASHUP_FACTION_IDS.GOBLINS],
                '1': [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS],
            }),
            undefined,
            '0',
        );

        expect(resolved.critical).toContain('smashup/cards/round_table_knights');
        expect(resolved.critical).toContain('smashup/base/round_table_knights_bases');
        expect(resolved.critical).toContain('smashup/cards/goblins');
        expect(resolved.critical).toContain('smashup/base/goblins_bases');
    });

    it('两个正统派系不归入 DIY，并且不再标记为实施中', () => {
        expect(isSmashUpDiyFaction(SMASHUP_FACTION_IDS.ROUND_TABLE_KNIGHTS)).toBe(false);
        expect(isSmashUpDiyFaction(SMASHUP_FACTION_IDS.GOBLINS)).toBe(false);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.ROUND_TABLE_KNIGHTS)).toBe(false);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.GOBLINS)).toBe(false);

        const visibleWithoutDiy = getVisibleFactionMetadata('zh-CN', ['titans'])
            .map(meta => meta.id);
        expect(visibleWithoutDiy).toContain(SMASHUP_FACTION_IDS.ROUND_TABLE_KNIGHTS);
        expect(visibleWithoutDiy).toContain(SMASHUP_FACTION_IDS.GOBLINS);
    });

    it('中英文 locale 覆盖所有派系、卡牌与基地 key', () => {
        const zhCN = loadLocale('zh-CN');
        const en = loadLocale('en');

        expect(zhCN.factions.round_table_knights?.name).toBe('圆桌骑士');
        expect(zhCN.factions.goblins?.name).toBe('哥布林');
        expect(en.factions.round_table_knights?.name).toBe('Round Table Knights');
        expect(en.factions.goblins?.name).toBe('Goblins');

        const expectedCardAndBaseIds = FACTIONS.flatMap(fixture => [
            ...Object.keys(fixture.expectedCardIndexes),
            ...Object.keys(fixture.expectedBases),
        ]);

        for (const id of expectedCardAndBaseIds) {
            for (const locale of [zhCN, en]) {
                const entry = locale.cards[id];
                expect(entry, `${id} 应有 locale 录入`).toBeDefined();
                expect(entry.name, `${id} 应有 name`).toBeTruthy();
                expect(entry.abilityText ?? entry.effectText, `${id} 应有规则文本`).toBeTruthy();
            }
        }
    });
});
