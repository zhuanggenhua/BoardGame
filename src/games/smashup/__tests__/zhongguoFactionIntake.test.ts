import { describe, expect, it } from 'vitest';

import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
} from '../data/cards';
import { SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { BaseCardDef, CardDef } from '../domain/types';
import { isFactionImplementationInProgress } from '../ui/factionMeta';

type ZhongguoFactionCase = {
    factionId: string;
    expectedCardCount: number;
    expectedDeckCopies: number;
    expectedCardIndexes: Record<string, number>;
    expectedBases: Record<string, { index: number; breakpoint: number; vpAwards: [number, number, number] }>;
};

const ZHONGGUO_FACTIONS: ZhongguoFactionCase[] = [
    {
        factionId: SMASHUP_FACTION_IDS.KUNG_FU_FIGHTERS,
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            kung_fu_fighters_fast_as_lightning: 0,
            kung_fu_fighters_dragon_warrior: 1,
            kung_fu_fighters_cricket: 2,
            kung_fu_fighters_oh_hoh_hoh_hoah: 3,
            kung_fu_fighters_everybody_knew_their_part: 4,
            kung_fu_fighters_everybody_was_kung_fu_fighting: 5,
            kung_fu_fighters_expert_timing: 6,
            kung_fu_fighters_ancient_chinese_art: 7,
            kung_fu_fighters_a_little_bit_frightening: 8,
            kung_fu_fighters_drunken_master: 9,
            kung_fu_fighters_lady_whirlwind: 10,
            kung_fu_fighters_lets_get_it_on: 11,
        },
        expectedBases: {
            base_ancient_dojo: { index: 6, breakpoint: 25, vpAwards: [5, 4, 3] },
            base_tournament_site: { index: 7, breakpoint: 19, vpAwards: [2, 0, 0] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.VIGILANTES,
        expectedCardCount: 18,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            vigilantes_shrug_it_off: 12,
            vigilantes_scared_straight: 13,
            vigilantes_who_loves_ya_baby: 14,
            vigilantes_a_whole_lot_meaner: 15,
            vigilantes_death_wisher: 16,
            vigilantes_tough_it_out: 17,
            vigilantes_the_revenge: 18,
            vigilantes_brojak: 19,
            vigilantes_stoneford: 20,
            vigilantes_jacky_bill: 21,
            vigilantes_make_my_day: 22,
            vigilantes_street_justice: 23,
            vigilantes_shift: 24,
            vigilantes_dusty_henry: 25,
            vigilantes_knocked_into_next_week: 26,
            vigilantes_feeling_lucky: 27,
            vigilantes_lets_finish_this: 28,
            vigilantes_foxy_green: 29,
        },
        expectedBases: {
            base_hideout: { index: 4, breakpoint: 18, vpAwards: [3, 1, 1] },
            base_the_mean_streets: { index: 5, breakpoint: 25, vpAwards: [5, 3, 2] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.TRUCKERS,
        expectedCardCount: 13,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            truckers_fixin_to_fix_it: 30,
            truckers_dekotora: 31,
            truckers_high_speed_chase: 32,
            truckers_rubber_chicken: 33,
            truckers_hotwire: 34,
            truckers_skinny_minnie: 35,
            truckers_el_bandido: 36,
            truckers_rally: 37,
            truckers_good_buddy: 38,
            truckers_convoy: 39,
            truckers_cab_over_pete: 40,
            truckers_armored_truck: 41,
            truckers_turn_the_beat_around: 42,
        },
        expectedBases: {
            base_the_greasy_spoon: { index: 1, breakpoint: 20, vpAwards: [4, 2, 1] },
            base_truck_stop: { index: 2, breakpoint: 18, vpAwards: [3, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.DISCO_DANCERS,
        expectedCardCount: 13,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            disco_dancers_diva: 43,
            disco_dancers_get_down_tonight: 44,
            disco_dancers_ul_disco_lou: 45,
            disco_dancers_we_are_family: 46,
            disco_dancers_disco_inferno: 47,
            disco_dancers_roller: 48,
            disco_dancers_celebration: 49,
            disco_dancers_i_will_survive: 50,
            disco_dancers_its_raining_men: 51,
            disco_dancers_dancing_king: 52,
            disco_dancers_im_so_excited: 53,
            disco_dancers_last_dance: 54,
            disco_dancers_stayin_alive: 55,
        },
        expectedBases: {
            base_funky_town: { index: 0, breakpoint: 23, vpAwards: [4, 3, 2] },
            base_boogie_wonderland: { index: 3, breakpoint: 21, vpAwards: [4, 2, 1] },
        },
    },
];

function assertZhongguoCardPreview(def: CardDef, expectedIndex: number): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.CARDS13,
        index: expectedIndex,
    });
}

function assertZhongguoBasePreview(
    def: BaseCardDef,
    expected: { index: number; breakpoint: number; vpAwards: [number, number, number] },
): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.BASE10,
        index: expected.index,
    });
    expect(def.breakpoint).toBe(expected.breakpoint);
    expect(def.vpAwards).toEqual(expected.vpAwards);
}

describe('SmashUp zhongguo 四派系 intake 静态合同', () => {
    it('zhongguo 卡牌与基地 atlas 网格正确', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([
            {
                id: SMASHUP_ATLAS_IDS.CARDS13,
                kind: 'card',
                image: 'smashup/cards/zhongguo',
                grid: { rows: 7, cols: 8 },
            },
            {
                id: SMASHUP_ATLAS_IDS.BASE10,
                kind: 'base',
                image: 'smashup/base/zhongguo',
                grid: { rows: 4, cols: 4 },
            },
        ]));
    });

    it.each(ZHONGGUO_FACTIONS)('$factionId 卡牌数量、拷贝数与 cards13 图集索引正确', (fixture) => {
        const defs = getFactionCards(fixture.factionId);

        expect(defs).toHaveLength(fixture.expectedCardCount);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(fixture.expectedDeckCopies);

        for (const [defId, index] of Object.entries(fixture.expectedCardIndexes)) {
            const def = defs.find((card) => card.id === defId);
            expect(def, `${defId} 应已注册`).toBeDefined();
            assertZhongguoCardPreview(def as CardDef, index);
        }
    });

    it.each(ZHONGGUO_FACTIONS)('$factionId 只返回已确认归属的两张 zhongguo 基地', (fixture) => {
        const baseIds = getBaseDefIdsForFactions([fixture.factionId]).sort();
        const expectedBaseIds = Object.keys(fixture.expectedBases).sort();

        expect(baseIds).toEqual(expectedBaseIds);

        for (const [baseId, expected] of Object.entries(fixture.expectedBases)) {
            const def = getBaseDef(baseId);
            expect(def, `${baseId} 应已注册`).toBeDefined();
            expect(def?.faction).toBe(fixture.factionId);
            assertZhongguoBasePreview(def as BaseCardDef, expected);
        }
    });

    it('后 8 格其它派系基地暂不污染四个新增派系基地池', () => {
        expect(getBaseDefIdsForFactions(SMASHUP_FACTION_IDS.KUNG_FU_FIGHTERS)).not.toContain('base_the_golden_lily');
        expect(getBaseDefIdsForFactions(SMASHUP_FACTION_IDS.VIGILANTES)).not.toContain('base_the_squared_circle');
        expect(getBaseDefIdsForFactions(SMASHUP_FACTION_IDS.TRUCKERS)).not.toContain('base_the_dohyo');

        expect(getBaseDef('base_the_golden_lily')?.faction).toBe(SMASHUP_FACTION_IDS.MUSKETEERS);
        expect(getBaseDef('base_the_squared_circle')?.faction).toBe(SMASHUP_FACTION_IDS.LUCHADORS);
        expect(getBaseDef('base_the_dohyo')?.faction).toBe(SMASHUP_FACTION_IDS.SUMO_WRESTLERS);
    });

    it('四个 zhongguo 派系当前标记为实施中', () => {
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.KUNG_FU_FIGHTERS)).toBe(true);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.VIGILANTES)).toBe(true);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.TRUCKERS)).toBe(true);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.DISCO_DANCERS)).toBe(true);
    });
});
