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
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { BaseCardDef, CardDef } from '../domain/types';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { isFactionImplementationInProgress } from '../ui/factionMeta';

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

const NEW_FACTIONS: FactionIntakeCase[] = [
    {
        factionId: SMASHUP_FACTION_IDS.NEW_ROUND_TABLE_KNIGHTS,
        cardAtlasId: SMASHUP_ATLAS_IDS.NEW_ROUND_TABLE_KNIGHTS_CARDS,
        cardAtlasImage: 'smashup/cards/new_round_table_knights',
        baseAtlasId: SMASHUP_ATLAS_IDS.NEW_ROUND_TABLE_KNIGHTS_BASES,
        baseAtlasImage: 'smashup/base/new_round_table_knights_bases',
        expectedCardCount: 18,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            new_round_table_knights_king_arthur: 0,
            new_round_table_knights_galahad: 1,
            new_round_table_knights_gawain: 2,
            new_round_table_knights_guinevere: 3,
            new_round_table_knights_lancelot: 4,
            new_round_table_knights_merlin: 5,
            new_round_table_knights_percival: 6,
            new_round_table_knights_quest: 7,
            new_round_table_knights_sword_in_the_stone: 8,
            new_round_table_knights_do_good: 9,
            new_round_table_knights_merlins_library: 11,
            new_round_table_knights_steed: 12,
            new_round_table_knights_fisher_king: 14,
            new_round_table_knights_holy_grail: 15,
            new_round_table_knights_green_knight: 16,
            new_round_table_knights_lady_of_the_lake: 17,
            new_round_table_knights_mists_of_avalon: 18,
            new_round_table_knights_questing_beast: 19,
        },
        expectedBases: {
            base_arthurs_court: { index: 0, breakpoint: 22, vpAwards: [5, 3, 2] },
            base_round_table: { index: 1, breakpoint: 21, vpAwards: [4, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.NEW_GOBLINS,
        cardAtlasId: SMASHUP_ATLAS_IDS.NEW_GOBLINS_CARDS,
        cardAtlasImage: 'smashup/cards/new_goblins',
        baseAtlasId: SMASHUP_ATLAS_IDS.NEW_GOBLINS_BASES,
        baseAtlasImage: 'smashup/base/new_goblins_bases',
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            new_goblins_chaos_goblin: 0,
            new_goblins_oracle_goblin: 1,
            new_goblins_bomb_goblin: 3,
            new_goblins_goblin: 6,
            new_goblins_magic_helmet: 10,
            new_goblins_a_little_help: 11,
            new_goblins_ambush: 13,
            new_goblins_blast: 14,
            new_goblins_recruiters: 15,
            new_goblins_who_smelted_it: 16,
            new_goblins_make_your_own_luck: 17,
            new_goblins_speed_boost: 19,
        },
        expectedBases: {
            base_goblin_caves: { index: 0, breakpoint: 17, vpAwards: [3, 1, 1] },
            base_goblin_village: { index: 1, breakpoint: 21, vpAwards: [4, 2, 1] },
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

describe('SmashUp DIY 新圆桌骑士 / 新哥布林 intake 静态合同', () => {
    it('两个新图集的 grid 与运行时图片路径正确', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([
            {
                id: SMASHUP_ATLAS_IDS.NEW_ROUND_TABLE_KNIGHTS_CARDS,
                kind: 'card',
                image: 'smashup/cards/new_round_table_knights',
                grid: { rows: 4, cols: 5 },
            },
            {
                id: SMASHUP_ATLAS_IDS.NEW_ROUND_TABLE_KNIGHTS_BASES,
                kind: 'base',
                image: 'smashup/base/new_round_table_knights_bases',
                grid: { rows: 1, cols: 2 },
            },
            {
                id: SMASHUP_ATLAS_IDS.NEW_GOBLINS_CARDS,
                kind: 'card',
                image: 'smashup/cards/new_goblins',
                grid: { rows: 4, cols: 5 },
            },
            {
                id: SMASHUP_ATLAS_IDS.NEW_GOBLINS_BASES,
                kind: 'base',
                image: 'smashup/base/new_goblins_bases',
                grid: { rows: 1, cols: 2 },
            },
        ]));

        for (const fixture of NEW_FACTIONS) {
            expect(getSmashUpAtlasImageById(fixture.cardAtlasId)).toBe(fixture.cardAtlasImage);
            expect(getSmashUpAtlasImageById(fixture.baseAtlasId)).toBe(fixture.baseAtlasImage);
        }
    });

    it.each(NEW_FACTIONS)('$factionId 卡牌数量、拷贝数与 row-major 索引正确', (fixture) => {
        const defs = getFactionCards(fixture.factionId);

        expect(defs).toHaveLength(fixture.expectedCardCount);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(fixture.expectedDeckCopies);

        for (const [defId, expectedIndex] of Object.entries(fixture.expectedCardIndexes)) {
            const def = defs.find(card => card.id === defId);
            expect(def, `${defId} 应已注册`).toBeDefined();
            assertCardPreview(def as CardDef, fixture.cardAtlasId, expectedIndex);
        }
    });

    it.each(NEW_FACTIONS)('$factionId 只返回本派系两张基地', (fixture) => {
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
                '0': [SMASHUP_FACTION_IDS.NEW_ROUND_TABLE_KNIGHTS, SMASHUP_FACTION_IDS.NEW_GOBLINS],
                '1': [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS],
            }),
            undefined,
            '0',
        );

        expect(resolved.critical).toContain('smashup/cards/new_round_table_knights');
        expect(resolved.critical).toContain('smashup/base/new_round_table_knights_bases');
        expect(resolved.critical).toContain('smashup/cards/new_goblins');
        expect(resolved.critical).toContain('smashup/base/new_goblins_bases');
    });

    it('两个 DIY 派系当前显式标记为实施中', () => {
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.NEW_ROUND_TABLE_KNIGHTS)).toBe(true);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.NEW_GOBLINS)).toBe(true);
    });

    it('中英文 locale 覆盖所有新增派系、卡牌与基地 key', () => {
        const zhCN = loadLocale('zh-CN');
        const en = loadLocale('en');

        expect(zhCN.factions.new_round_table_knights?.name).toBe('新圆桌骑士');
        expect(zhCN.factions.new_goblins?.name).toBe('新哥布林');
        expect(en.factions.new_round_table_knights?.name).toBe('New Round Table Knights');
        expect(en.factions.new_goblins?.name).toBe('New Goblins');

        const expectedCardAndBaseIds = NEW_FACTIONS.flatMap(fixture => [
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
