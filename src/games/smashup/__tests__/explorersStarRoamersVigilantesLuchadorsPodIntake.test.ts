import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getFactionCards } from '../data/cards';
import { hasAbility } from '../domain/abilityRegistry';
import { getRegisteredOngoingEffectIds } from '../domain/ongoingEffects';
import { getOngoingPowerModifier } from '../domain/ongoingModifiers';
import { getSmashUpVariantSurfaceRelation } from '../domain/variantBindings';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { AbilityTag } from '../domain/types';
import { isFactionImplementationInProgress } from '../ui/factionMeta';

type PodFactionCase = {
    factionId: string;
    atlasId: string;
    expectedCardCount: number;
    expectedDeckCopies: number;
    expectedCardIndexes: Record<string, number>;
};

const POD_FACTIONS: PodFactionCase[] = [
    {
        factionId: SMASHUP_FACTION_IDS.EXPLORERS_POD,
        atlasId: SMASHUP_ATLAS_IDS.EXPLORERS_POD_CARDS,
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            explorers_lost_city_pod: 0,
            explorers_forgotten_horrors_pod: 2,
            explorers_fortune_and_glory_pod: 3,
            explorers_it_belongs_in_a_museum_pod: 5,
            explorers_i_said_no_camels_pod: 6,
            explorers_x_never_marks_the_spot_pod: 7,
            explorers_dr_livingstone_i_presume_pod: 8,
            explorers_you_call_this_archaeology_pod: 9,
            explorers_glory_hound_pod: 10,
            explorers_crypt_looter_pod: 14,
            explorers_guide_pod: 17,
            explorers_idaho_smith_pod: 19,
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.STAR_ROAMERS_POD,
        atlasId: SMASHUP_ATLAS_IDS.STAR_ROAMERS_POD_CARDS,
        expectedCardCount: 13,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            star_roamers_hyperspeed_10_pod: 0,
            star_roamers_port_me_up_pod: 1,
            star_roamers_mass_teleport_pod: 3,
            star_roamers_teleport_error_pod: 5,
            star_roamers_protector_fields_pod: 6,
            star_roamers_weird_new_worlds_pod: 7,
            star_roamers_whiplash_maneuver_pod: 8,
            star_roamers_teleport_overflow_pod: 9,
            star_roamers_ensign_pod: 10,
            star_roamers_ships_engineer_pod: 14,
            star_roamers_medical_officer_pod: 17,
            star_roamers_science_officer_pod: 18,
            star_roamers_ships_captain_pod: 19,
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.VIGILANTES_POD,
        atlasId: SMASHUP_ATLAS_IDS.VIGILANTES_POD_CARDS,
        expectedCardCount: 18,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            vigilantes_make_my_day_pod: 0,
            vigilantes_tough_it_out_pod: 1,
            vigilantes_scared_straight_pod: 2,
            vigilantes_feeling_lucky_pod: 4,
            vigilantes_shrug_it_off_pod: 5,
            vigilantes_knocked_into_next_week_pod: 6,
            vigilantes_lets_finish_this_pod: 7,
            vigilantes_the_revenge_pod: 8,
            vigilantes_a_whole_lot_meaner_pod: 9,
            vigilantes_street_justice_pod: 10,
            vigilantes_who_loves_ya_baby_pod: 11,
            vigilantes_jacky_bill_pod: 13,
            vigilantes_death_wisher_pod: 14,
            vigilantes_shift_pod: 15,
            vigilantes_foxy_green_pod: 16,
            vigilantes_brojak_pod: 17,
            vigilantes_stoneford_pod: 18,
            vigilantes_dusty_henry_pod: 19,
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.LUCHADORS_POD,
        atlasId: SMASHUP_ATLAS_IDS.LUCHADORS_POD_CARDS,
        expectedCardCount: 13,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            luchadors_quick_set_up_pod: 0,
            luchadors_smart_set_up_pod: 1,
            luchadors_powerful_set_up_pod: 2,
            luchadors_pin_pod: 3,
            luchadors_out_for_the_count_pod: 5,
            luchadors_senor_muchoslam_vs_the_monsters_pod: 6,
            luchadors_reversal_pod: 7,
            luchadors_tag_team_pod: 8,
            luchadors_cheap_pop_pod: 9,
            luchadors_yellow_demon_pod: 10,
            luchadors_flor_loca_pod: 14,
            luchadors_capa_roja_pod: 17,
            luchadors_senor_muchoslam_pod: 19,
        },
    },
];

const SHARED_ABILITY_EXPECTATIONS: Array<[string, AbilityTag]> = [
    ['explorers_fortune_and_glory_pod', 'onPlay'],
    ['explorers_lost_city_pod', 'special'],
    ['star_roamers_hyperspeed_10_pod', 'onPlay'],
    ['star_roamers_science_officer_pod', 'talent'],
    ['luchadors_quick_set_up_pod', 'onPlay'],
    ['luchadors_reversal_pod', 'special'],
    ['luchadors_senor_muchoslam_pod', 'talent'],
];

const VIGILANTES_POD_EXPLICIT_ABILITY_EXPECTATIONS: Array<[string, AbilityTag]> = [
    ['vigilantes_make_my_day_pod', 'onPlay'],
    ['vigilantes_make_my_day_pod', 'special'],
    ['vigilantes_scared_straight_pod', 'onPlay'],
    ['vigilantes_who_loves_ya_baby_pod', 'onPlay'],
    ['vigilantes_a_whole_lot_meaner_pod', 'onPlay'],
    ['vigilantes_a_whole_lot_meaner_pod', 'special'],
    ['vigilantes_dusty_henry_pod', 'onPlay'],
];

function readSmashUpLocale(locale: 'en' | 'zh-CN') {
    return JSON.parse(
        readFileSync(resolve(__dirname, '../../../../public/locales/' + locale + '/game-smashup.json'), 'utf-8'),
    );
}

describe('SmashUp Explorers / Star Roamers / Vigilantes / Luchadors POD intake', () => {
    const en = readSmashUpLocale('en');
    const zhCN = readSmashUpLocale('zh-CN');

    beforeAll(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it.each(POD_FACTIONS)('$factionId 卡牌数量、拷贝数与 POD 图集索引正确', (fixture) => {
        const defs = getFactionCards(fixture.factionId);

        expect(defs).toHaveLength(fixture.expectedCardCount);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(fixture.expectedDeckCopies);

        for (const [defId, index] of Object.entries(fixture.expectedCardIndexes)) {
            const def = defs.find(card => card.id === defId);
            expect(def, defId + ' 应已注册').toBeDefined();
            expect(def?.previewRef).toEqual({
                type: 'atlas',
                atlasId: fixture.atlasId,
                index,
            });
        }
    });

    it('四套 POD 派系已进入可选派系列表，不再标记实施中', () => {
        for (const fixture of POD_FACTIONS) {
            expect(isFactionImplementationInProgress(fixture.factionId), fixture.factionId).toBe(false);
        }
    });

    it('四套 POD 的中英文悬浮翻译 key 均已落地', () => {
        for (const fixture of POD_FACTIONS) {
            expect(en.factions?.[fixture.factionId]?.name, 'en factions.' + fixture.factionId + '.name').toBeTruthy();
            expect(zhCN.factions?.[fixture.factionId]?.name, 'zh-CN factions.' + fixture.factionId + '.name').toBeTruthy();

            for (const defId of Object.keys(fixture.expectedCardIndexes)) {
                const enCard = en.cards?.[defId];
                const zhCard = zhCN.cards?.[defId];
                const def = getFactionCards(fixture.factionId).find(card => card.id === defId);
                expect(enCard?.name, 'en cards.' + defId + '.name').toBeTruthy();
                expect(zhCard?.name, 'zh-CN cards.' + defId + '.name').toBeTruthy();
                if (def?.type === 'action' || (def?.type === 'minion' && (def.abilityTags?.length ?? 0) > 0)) {
                    expect(enCard?.effectText ?? enCard?.abilityText, 'en cards.' + defId + ' text').toBeTruthy();
                    expect(zhCard?.effectText ?? zhCard?.abilityText, 'zh-CN cards.' + defId + ' text').toBeTruthy();
                }
            }
        }
    });

    it('探险家、星际旅者与摔角手 POD 走标准共享变体绑定并继承代表能力', () => {
        for (const factionId of [
            SMASHUP_FACTION_IDS.EXPLORERS_POD,
            SMASHUP_FACTION_IDS.STAR_ROAMERS_POD,
            SMASHUP_FACTION_IDS.LUCHADORS_POD,
        ]) {
            expect(getSmashUpVariantSurfaceRelation('ability', factionId, factionId)).toBe('shared');
            expect(getSmashUpVariantSurfaceRelation('basePool', factionId, factionId)).toBe('separate');
        }

        for (const [defId, tag] of SHARED_ABILITY_EXPECTATIONS) {
            expect(hasAbility(defId, tag), defId + '::' + tag).toBe(true);
        }
    });

    it('侠义义警 POD 差异卡不会误继承基础版，并注册代表性覆盖能力', () => {
        expect(getSmashUpVariantSurfaceRelation('ability', 'vigilantes_make_my_day', SMASHUP_FACTION_IDS.VIGILANTES_POD)).toBe('separate');
        expect(getSmashUpVariantSurfaceRelation('powerModifier', 'vigilantes_tough_it_out', SMASHUP_FACTION_IDS.VIGILANTES_POD)).toBe('separate');

        for (const [defId, tag] of VIGILANTES_POD_EXPLICIT_ABILITY_EXPECTATIONS) {
            expect(hasAbility(defId, tag), defId + '::' + tag).toBe(true);
        }

        const { protectionIds } = getRegisteredOngoingEffectIds();
        expect(protectionIds.has('vigilantes_tough_it_out_pod')).toBe(true);

        const attachedActions = [{ uid: 'tough', defId: 'vigilantes_tough_it_out_pod', ownerId: '0' }];
        const minion = {
            uid: 'target',
            defId: 'test_minion',
            owner: '0',
            controller: '0',
            basePower: 5,
            powerModifier: 0,
            tempPowerModifier: 0,
            talentUsed: false,
            attachedActions,
        };

        const powerDelta = getOngoingPowerModifier({
            players: {
                '0': { id: '0', deck: [], hand: [], discard: [], victoryPoints: 0 },
            },
            bases: [{
                defId: 'test_base',
                minions: [minion],
                ongoingActions: [],
            }],
            baseDeck: [],
            baseDiscard: [],
            currentPlayerIndex: 0,
            nextUid: 1,
            turnNumber: 1,
            turnOrder: ['0'],
        }, minion, 0);

        expect(powerDelta).toBe(-3);
    });
});
