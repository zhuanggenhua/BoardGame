import { describe, expect, it } from 'vitest';

import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
} from '../data/cards';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../domain/types';
import { isFactionImplementationInProgress } from '../ui/factionMeta';

type YuanhouFactionCase = {
    factionId: string;
    expectedCardCount: number;
    expectedDeckCopies: number;
    expectedCardIndexes: Record<string, number>;
    expectedBases: Record<string, { index: number; breakpoint: number; vpAwards: [number, number, number] }>;
};

const YUANHOU_FACTIONS: YuanhouFactionCase[] = [
    {
        factionId: SMASHUP_FACTION_IDS.SHAPESHIFTERS,
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            shapeshifters_bacta_the_future: 0,
            shapeshifters_shell_game: 1,
            shapeshifters_genetic_shift: 2,
            shapeshifters_transmogrify: 3,
            shapeshifters_really: 4,
            shapeshifters_mimic: 5,
            shapeshifters_cellular_bonding: 6,
            shapeshifters_copycat: 7,
            shapeshifters_splice_as_nice: 8,
            shapeshifters_gelf: 9,
            shapeshifters_mitosis: 10,
            shapeshifters_doppelganger: 11,
        },
        expectedBases: {
            base_the_vats: { index: 4, breakpoint: 15, vpAwards: [3, 1, 1] },
            base_faceless_city: { index: 5, breakpoint: 20, vpAwards: [4, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.CYBORG_APES,
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            cyborg_apes_monkey_on_your_back: 12,
            cyborg_apes_cyberevolution: 13,
            cyborg_apes_juiced_up: 14,
            cyborg_apes_flying_monkey: 15,
            cyborg_apes_shielding: 16,
            cyborg_apes_furious_george: 17,
            cyborg_apes_going_bananas: 18,
            cyborg_apes_baboom: 19,
            cyborg_apes_monkey_see_monkey_do: 20,
            cyborg_apes_clyde_2_0: 21,
            cyborg_apes_missing_uplink: 22,
            cyborg_apes_cyberback: 23,
        },
        expectedBases: {
            base_primate_park: { index: 6, breakpoint: 20, vpAwards: [3, 2, 1] },
            base_monkey_lab: { index: 7, breakpoint: 23, vpAwards: [4, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.SUPER_SPIES,
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            super_spies_live_and_let_chum: 24,
            super_spies_the_spy_who_ditched_me: 25,
            super_spies_permit_to_kill: 26,
            super_spies_for_my_eyes_only: 27,
            super_spies_the_base_is_not_enough: 28,
            super_spies_spy: 29,
            super_spies_mindraker: 30,
            super_spies_operative: 31,
            super_spies_from_q_with_love: 32,
            super_spies_mole: 33,
            super_spies_discards_are_forever: 34,
            super_spies_secret_agent: 35,
        },
        expectedBases: {
            base_isis_swingin_pad: { index: 2, breakpoint: 21, vpAwards: [4, 2, 1] },
            base_secret_volcano_headquarters: { index: 3, breakpoint: 18, vpAwards: [4, 3, 2] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.TIME_TRAVELERS,
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            time_travelers_its_astounding: 36,
            time_travelers_time_is_fleeting: 37,
            time_travelers_into_the_time_slip: 38,
            time_travelers_1_21_gigawatts: 39,
            time_travelers_do_over: 40,
            time_travelers_jumper: 41,
            time_travelers_stasis_field: 42,
            time_travelers_time_raider: 43,
            time_travelers_time_walk: 44,
            time_travelers_repeater_perfect: 45,
            time_travelers_wormhole: 46,
            time_travelers_doctor_when: 47,
        },
        expectedBases: {
            base_the_nexus: { index: 0, breakpoint: 19, vpAwards: [3, 3, 2] },
            base_portal_room: { index: 1, breakpoint: 22, vpAwards: [2, 3, 1] },
        },
    },
];

function assertYuanhouCardPreview(def: CardDef, expectedIndex: number): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.CARDS11,
        index: expectedIndex,
    });
}

function assertYuanhouBasePreview(
    def: BaseCardDef,
    expected: { index: number; breakpoint: number; vpAwards: [number, number, number] },
): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.BASE9,
        index: expected.index,
    });
    expect(def.breakpoint).toBe(expected.breakpoint);
    expect(def.vpAwards).toEqual(expected.vpAwards);
}

describe('SmashUp yuanhou 四派系 intake 静态合同', () => {
    it.each(YUANHOU_FACTIONS)('$factionId 卡牌数量、拷贝数与 cards11 图集索引正确', (fixture) => {
        const defs = getFactionCards(fixture.factionId);

        expect(defs).toHaveLength(fixture.expectedCardCount);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(fixture.expectedDeckCopies);

        for (const [defId, index] of Object.entries(fixture.expectedCardIndexes)) {
            const def = defs.find((card) => card.id === defId);
            expect(def, `${defId} 应已注册`).toBeDefined();
            assertYuanhouCardPreview(def as MinionCardDef | ActionCardDef, index);
        }
    });

    it.each(YUANHOU_FACTIONS)('$factionId 基地数量、数值与 base9 图集索引正确', (fixture) => {
        const baseIds = getBaseDefIdsForFactions([fixture.factionId]).sort();
        const expectedBaseIds = Object.keys(fixture.expectedBases).sort();

        expect(baseIds).toEqual(expectedBaseIds);

        for (const [baseId, expected] of Object.entries(fixture.expectedBases)) {
            const def = getBaseDef(baseId);
            expect(def, `${baseId} 应已注册`).toBeDefined();
            expect(def?.faction).toBe(fixture.factionId);
            assertYuanhouBasePreview(def as BaseCardDef, expected);
        }
    });

    it('四个 yuanhou 派系已不再标记为实施中', () => {
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.SHAPESHIFTERS)).toBe(false);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.CYBORG_APES)).toBe(false);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.SUPER_SPIES)).toBe(false);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.TIME_TRAVELERS)).toBe(false);
    });
});
