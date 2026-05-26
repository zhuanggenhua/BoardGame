import { describe, expect, it } from 'vitest';

import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
} from '../data/cards';
import { SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../domain/types';
import { isFactionImplementationInProgress } from '../ui/factionMeta';

type BaokemengFactionCase = {
    factionId: string;
    expectedCardCount: number;
    expectedDeckCopies: number;
    expectedCardIndexes: Record<string, number>;
    expectedBases: Record<string, { index: number; breakpoint: number; vpAwards: [number, number, number] }>;
};

const BAOKEMENG_FACTIONS: BaokemengFactionCase[] = [
    {
        factionId: SMASHUP_FACTION_IDS.ITTY_CRITTERS,
        expectedCardCount: 16,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            itty_critters_i_select_you: 0,
            itty_critters_recall_critter: 1,
            itty_critters_evolution: 2,
            itty_critters_gotta_get_em_all: 3,
            itty_critters_critter_cube: 4,
            itty_critters_super_effective: 5,
            itty_critters_ittypedia: 6,
            itty_critters_coach_combat: 7,
            itty_critters_leafaroo: 8,
            itty_critters_flooffairy: 9,
            itty_critters_calicoin: 10,
            itty_critters_tadpour: 11,
            itty_critters_krakatoad: 12,
            itty_critters_critter_coach: 13,
            itty_critters_shellshock: 14,
            itty_critters_critter_champion: 15,
        },
        expectedBases: {
            base_critter_combat_club: { index: 4, breakpoint: 23, vpAwards: [4, 3, 1] },
            base_itty_city: { index: 5, breakpoint: 20, vpAwards: [3, 1, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.MEGA_TROOPERS,
        expectedCardCount: 15,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            mega_troopers_lightning_rescue: 16,
            mega_troopers_blitzing_sword_attack: 17,
            mega_troopers_power_pose: 18,
            mega_troopers_form_megabot: 19,
            mega_troopers_lightning_crystal: 20,
            mega_troopers_its_blitzin_time: 21,
            mega_troopers_mega_attack: 22,
            mega_troopers_plan_for_more: 23,
            mega_troopers_black_trooper: 24,
            mega_troopers_beta_6: 25,
            mega_troopers_blue_trooper: 26,
            mega_troopers_green_trooper: 27,
            mega_troopers_yellow_trooper: 28,
            mega_troopers_pink_trooper: 29,
            mega_troopers_red_trooper: 30,
        },
        expectedBases: {
            base_moon_dumpster: { index: 6, breakpoint: 24, vpAwards: [4, 2, 2] },
            base_juice_bar: { index: 7, breakpoint: 20, vpAwards: [3, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.MAGICAL_GIRLS,
        expectedCardCount: 17,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            magical_girls_coronet_attack: 31,
            magical_girls_lunar_healing_love_spell: 32,
            magical_girls_magical_staff: 33,
            magical_girls_kiss_the_sky_spell: 34,
            magical_girls_purge_the_demon: 35,
            magical_girls_celestial_teleport: 36,
            magical_girls_coordination: 37,
            magical_girls_lunar_captain: 38,
            magical_girls_technomagical_lass: 39,
            magical_girls_bewitching_gal: 40,
            magical_girls_sakura_warrior: 41,
            magical_girls_rainbow_girl: 42,
            magical_girls_fancy_suit_lad: 43,
            magical_girls_white_magicat: 44,
            magical_girls_power_maid: 45,
            magical_girls_black_magicat: 46,
            magical_girls_silver_shard: 47,
        },
        expectedBases: {
            base_akihabara_high: { index: 0, breakpoint: 20, vpAwards: [3, 2, 1] },
            base_q_point: { index: 1, breakpoint: 25, vpAwards: [5, 4, 3] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.KAIJU,
        expectedCardCount: 14,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            kaiju_there_goes_tokyo: 48,
            kaiju_kaiju_conflict: 49,
            kaiju_kaiju_alliance: 50,
            kaiju_pick_up_a_bus: 51,
            kaiju_they_say_hes_got_to_go: 52,
            kaiju_oh_no: 53,
            kaiju_johnny: 54,
            kaiju_radioactive_breath: 55,
            kaiju_the_folly_of_men: 56,
            kaiju_tail_smash: 57,
            kaiju_stomp: 58,
            kaiju_wade_through_the_buildings: 59,
            kaiju_tiny_priestesses: 60,
            kaiju_kaijookey: 61,
        },
        expectedBases: {
            base_tokyo: { index: 2, breakpoint: 25, vpAwards: [5, 3, 2] },
            base_kaiju_island: { index: 3, breakpoint: 22, vpAwards: [4, 2, 1] },
        },
    },
];

function assertBaokemengCardPreview(def: CardDef, expectedIndex: number): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.CARDS10,
        index: expectedIndex,
    });
}

function assertBaokemengBasePreview(
    def: BaseCardDef,
    expected: { index: number; breakpoint: number; vpAwards: [number, number, number] },
): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.BASE8,
        index: expected.index,
    });
    expect(def.breakpoint).toBe(expected.breakpoint);
    expect(def.vpAwards).toEqual(expected.vpAwards);
}

describe('SmashUp baokemeng 四派系 intake 静态合同', () => {
    it('baokemeng 卡牌与基地 atlas 网格正确', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([
            {
                id: SMASHUP_ATLAS_IDS.CARDS10,
                kind: 'card',
                image: 'smashup/cards/baokemeng',
                grid: { rows: 7, cols: 9 },
            },
            {
                id: SMASHUP_ATLAS_IDS.BASE8,
                kind: 'base',
                image: 'smashup/base/baokemeng',
                grid: { rows: 2, cols: 4 },
            },
        ]));
    });

    it.each(BAOKEMENG_FACTIONS)('$factionId 卡牌数量、拷贝数与 cards10 图集索引正确', (fixture) => {
        const defs = getFactionCards(fixture.factionId);

        expect(defs).toHaveLength(fixture.expectedCardCount);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(fixture.expectedDeckCopies);

        for (const [defId, index] of Object.entries(fixture.expectedCardIndexes)) {
            const def = defs.find((card) => card.id === defId);
            expect(def, `${defId} 应已注册`).toBeDefined();
            assertBaokemengCardPreview(def as MinionCardDef | ActionCardDef, index);
        }
    });

    it('Kaiju 重复图块 slot-62 不绑定运行时卡牌对象', () => {
        const kaijuDefs = getFactionCards(SMASHUP_FACTION_IDS.KAIJU);
        expect(kaijuDefs.some((def) => def.previewRef?.type === 'atlas' && def.previewRef.index === 62)).toBe(false);
    });

    it.each(BAOKEMENG_FACTIONS)('$factionId 基地数量、数值与 base8 图集索引正确', (fixture) => {
        const baseIds = getBaseDefIdsForFactions([fixture.factionId]).sort();
        const expectedBaseIds = Object.keys(fixture.expectedBases).sort();

        expect(baseIds).toEqual(expectedBaseIds);

        for (const [baseId, expected] of Object.entries(fixture.expectedBases)) {
            const def = getBaseDef(baseId);
            expect(def, `${baseId} 应已注册`).toBeDefined();
            expect(def?.faction).toBe(fixture.factionId);
            assertBaokemengBasePreview(def as BaseCardDef, expected);
        }
    });

    it('四个 baokemeng 新派系在派系选择页标记为实施中', () => {
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.ITTY_CRITTERS)).toBe(true);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.KAIJU)).toBe(true);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.MAGICAL_GIRLS)).toBe(true);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.MEGA_TROOPERS)).toBe(true);
    });
});
