import { describe, expect, it } from 'vitest';

import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
} from '../data/cards';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../domain/types';
import { isFactionImplementationInProgress } from '../ui/factionMeta';

type ShayuFactionCase = {
    factionId: string;
    expectedCardCount: number;
    expectedDeckCopies: number;
    expectedCardIndexes: Record<string, number>;
    expectedBases: Record<string, { index: number; breakpoint: number; vpAwards: [number, number, number] }>;
};

const SHAYU_FACTIONS: ShayuFactionCase[] = [
    {
        factionId: SMASHUP_FACTION_IDS.SHARKS,
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            sharks_megalodon: 0,
            sharks_great_white: 1,
            sharks_hammerhead: 2,
            sharks_mako: 3,
            sharks_blood_in_the_water: 4,
            sharks_week_of_sharks: 5,
            sharks_torn_apart: 6,
            sharks_chum: 7,
            sharks_dangerous_waters: 8,
            sharks_feeding_frenzy: 9,
            sharks_air_jaws: 10,
            sharks_freakin_laser_beam: 11,
        },
        expectedBases: {
            base_shark_reef: { index: 2, breakpoint: 20, vpAwards: [4, 2, 1] },
            base_the_deep: { index: 9, breakpoint: 16, vpAwards: [3, 2, 2] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.TORNADOS,
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            tornados_monster_tornado: 12,
            tornados_cyclone: 13,
            tornados_twister: 14,
            tornados_dust_devil: 15,
            tornados_trade_winds: 16,
            tornados_carried_away: 17,
            tornados_whirlwinds: 18,
            tornados_gone_with_the_wind: 19,
            tornados_ripped_off: 20,
            tornados_picked_up: 21,
            tornados_not_in_kansas: 22,
            tornados_over_the_rainbow: 23,
        },
        expectedBases: {
            base_trailer_park: { index: 6, breakpoint: 20, vpAwards: [4, 2, 1] },
            base_tornado_alley: { index: 11, breakpoint: 25, vpAwards: [4, 3, 2] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.MYTHIC_GREEKS,
        expectedCardCount: 15,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            mythic_greeks_odysseus: 24,
            mythic_greeks_argonaut: 25,
            mythic_greeks_jason: 26,
            mythic_greeks_favor_of_hades: 27,
            mythic_greeks_heracles: 28,
            mythic_greeks_favor_of_ares: 29,
            mythic_greeks_spartan: 30,
            mythic_greeks_favor_of_aphrodite: 31,
            mythic_greeks_favor_of_dionysus: 32,
            mythic_greeks_favor_of_hera: 33,
            mythic_greeks_favor_of_athena: 34,
            mythic_greeks_favor_of_apollo: 35,
            mythic_greeks_favor_of_hermes: 36,
            mythic_greeks_favor_of_poseidon: 37,
            mythic_greeks_favor_of_zeus: 38,
        },
        expectedBases: {
            base_oracle_at_delphi: { index: 5, breakpoint: 18, vpAwards: [4, 2, 1] },
            base_wooden_horse: { index: 8, breakpoint: 21, vpAwards: [3, 2, 1] },
        },
    },
];

function assertShayuCardPreview(def: CardDef, expectedIndex: number): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.CARDS9,
        index: expectedIndex,
    });
}

function assertShayuBasePreview(
    def: BaseCardDef,
    expected: { index: number; breakpoint: number; vpAwards: [number, number, number] },
): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.BASE7,
        index: expected.index,
    });
    expect(def.breakpoint).toBe(expected.breakpoint);
    expect(def.vpAwards).toEqual(expected.vpAwards);
}

describe('SmashUp shayu 三派系 intake 静态合同', () => {
    it.each(SHAYU_FACTIONS)('$factionId 卡牌数量、拷贝数与 cards9 图集索引正确', (fixture) => {
        const defs = getFactionCards(fixture.factionId);

        expect(defs).toHaveLength(fixture.expectedCardCount);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(fixture.expectedDeckCopies);

        for (const [defId, index] of Object.entries(fixture.expectedCardIndexes)) {
            const def = defs.find((card) => card.id === defId);
            expect(def, `${defId} 应已注册`).toBeDefined();
            assertShayuCardPreview(def as MinionCardDef | ActionCardDef, index);
        }

        expect(defs.some((def) => def.previewRef?.type === 'atlas' && def.previewRef.index === 39)).toBe(false);
    });

    it.each(SHAYU_FACTIONS)('$factionId 基地数量、数值与 base7 图集索引正确', (fixture) => {
        const baseIds = getBaseDefIdsForFactions([fixture.factionId]).sort();
        const expectedBaseIds = Object.keys(fixture.expectedBases).sort();

        expect(baseIds).toEqual(expectedBaseIds);

        for (const [baseId, expected] of Object.entries(fixture.expectedBases)) {
            const def = getBaseDef(baseId);
            expect(def, `${baseId} 应已注册`).toBeDefined();
            expect(def?.faction).toBe(fixture.factionId);
            assertShayuBasePreview(def as BaseCardDef, expected);
        }
    });

    it('三个 shayu 新派系在派系选择页标记为实施中', () => {
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.SHARKS)).toBe(true);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.TORNADOS)).toBe(true);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.MYTHIC_GREEKS)).toBe(true);
    });
});
