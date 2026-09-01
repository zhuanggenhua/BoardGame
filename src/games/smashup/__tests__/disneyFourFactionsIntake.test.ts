import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
} from '../data/cards';
import { SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { BaseCardDef, CardDef } from '../domain/types';
import { getVisibleFactionMetadata, isFactionImplementationInProgress } from '../ui/factionMeta';

type DisneyFactionCase = {
    factionId: string;
    expectedCardIndexes: Record<string, number>;
    expectedBases: Record<string, { index: number; breakpoint: number; vpAwards: [number, number, number] }>;
};

const DISNEY_FACTIONS: DisneyFactionCase[] = [
    {
        factionId: SMASHUP_FACTION_IDS.BIG_HERO_6,
        expectedCardIndexes: {
            big_hero_6_microbot_swarm: 0,
            big_hero_6_baymax: 1,
            big_hero_6_fred_frederickson_iv: 2,
            big_hero_6_go_go_tomago: 3,
            big_hero_6_hiro_hamada: 4,
            big_hero_6_honey_lemon: 5,
            big_hero_6_wasabi: 6,
            big_hero_6_control_mask: 7,
            big_hero_6_control_the_swarm: 8,
            big_hero_6_microbot_maker: 9,
            big_hero_6_new_student: 10,
            big_hero_6_team_effort: 11,
            big_hero_6_upgrades: 12,
            big_hero_6_version_2_0: 13,
            big_hero_6_yokai: 14,
        },
        expectedBases: {
            base_sfit_robotics_lab: { index: 10, breakpoint: 24, vpAwards: [4, 2, 1] },
            base_krei_tech: { index: 11, breakpoint: 20, vpAwards: [3, 1, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.FROZEN,
        expectedCardIndexes: {
            frozen_snowgie: 15,
            frozen_marshmallow: 16,
            frozen_olaf: 17,
            frozen_sven: 18,
            frozen_anna: 19,
            frozen_kristoff: 20,
            frozen_elsa: 21,
            frozen_act_of_true_love: 22,
            frozen_big_summer_blowout: 23,
            frozen_do_you_want_to_build_a_snowman: 24,
            frozen_frozen_port: 25,
            frozen_hans_westergaard: 26,
            frozen_let_it_go: 27,
            frozen_lock_the_gates: 28,
            frozen_reindeers_are_better_than_people: 29,
        },
        expectedBases: {
            base_ice_palace: { index: 8, breakpoint: 22, vpAwards: [4, 2, 1] },
            base_arendelle: { index: 9, breakpoint: 20, vpAwards: [3, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.LION_KING,
        expectedCardIndexes: {
            lion_king_lion_cub: 30,
            lion_king_rafiki: 31,
            lion_king_timon_and_pumbaa: 32,
            lion_king_zazu: 33,
            lion_king_nala: 34,
            lion_king_simba: 35,
            lion_king_mufasa: 36,
            lion_king_circle_of_life: 37,
            lion_king_hakuna_matata: 38,
            lion_king_he_lives_in_you: 39,
            lion_king_hyenas_den: 40,
            lion_king_just_cant_wait_to_be_king: 41,
            lion_king_scar: 42,
            lion_king_the_hyenas: 43,
            lion_king_wildebeest_stampede: 44,
        },
        expectedBases: {
            base_jungle_paradise: { index: 6, breakpoint: 22, vpAwards: [4, 3, 1] },
            base_pride_rock: { index: 7, breakpoint: 19, vpAwards: [3, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.MULAN,
        expectedCardIndexes: {
            mulan_cri_kee: 45,
            mulan_mushu: 46,
            mulan_chien_po: 47,
            mulan_ling: 48,
            mulan_yao: 49,
            mulan_li_shang: 50,
            mulan_mulan: 51,
            mulan_avalanche: 52,
            mulan_be_a_man: 53,
            mulan_call_up_new_recruits: 54,
            mulan_dragon_cannon: 55,
            mulan_family_sword: 56,
            mulan_group_training: 57,
            mulan_prepare_to_fight: 58,
            mulan_shan_yu: 59,
        },
        expectedBases: {
            base_training_camp: { index: 4, breakpoint: 25, vpAwards: [5, 3, 2] },
            base_forbidden_city: { index: 5, breakpoint: 19, vpAwards: [3, 3, 2] },
        },
    },
];

function readSmashUpLocale(locale: 'en' | 'zh-CN') {
    return JSON.parse(
        readFileSync(resolve(__dirname, `../../../../public/locales/${locale}/game-smashup.json`), 'utf-8'),
    );
}

function assertDisneyCardPreview(def: CardDef, expectedIndex: number): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_CARDS,
        index: expectedIndex,
    });
}

function assertDisneyBasePreview(
    def: BaseCardDef,
    expected: { index: number; breakpoint: number; vpAwards: [number, number, number] },
): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_BASES,
        index: expected.index,
    });
    expect(def.breakpoint).toBe(expected.breakpoint);
    expect(def.vpAwards).toEqual(expected.vpAwards);
}

describe('SmashUp Disney 四派系 intake 静态合同', () => {
    const en = readSmashUpLocale('en');
    const zhCN = readSmashUpLocale('zh-CN');

    it('Disney 卡牌与基地 atlas 网格正确', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([
            {
                id: SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_CARDS,
                kind: 'card',
                image: 'smashup/cards/disney_four_factions',
                grid: { rows: 6, cols: 10 },
            },
            {
                id: SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_BASES,
                kind: 'base',
                image: 'smashup/base/disney_four_faction_bases',
                grid: { rows: 4, cols: 4 },
            },
        ]));
    });

    it.each(DISNEY_FACTIONS)('$factionId 卡牌数量、拷贝数与 Disney 图集索引正确', (fixture) => {
        const defs = getFactionCards(fixture.factionId);

        expect(defs).toHaveLength(15);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(20);

        for (const [defId, index] of Object.entries(fixture.expectedCardIndexes)) {
            const def = defs.find(card => card.id === defId);
            expect(def, `${defId} 应已注册`).toBeDefined();
            assertDisneyCardPreview(def as CardDef, index);
        }
    });

    it.each(DISNEY_FACTIONS)('$factionId 基地数量、数值与 Disney base 图集索引正确', (fixture) => {
        const baseIds = getBaseDefIdsForFactions([fixture.factionId]).sort();
        const expectedBaseIds = Object.keys(fixture.expectedBases).sort();

        expect(baseIds).toEqual(expectedBaseIds);

        for (const [baseId, expected] of Object.entries(fixture.expectedBases)) {
            const def = getBaseDef(baseId);
            expect(def, `${baseId} 应已注册`).toBeDefined();
            expect(def?.faction).toBe(fixture.factionId);
            assertDisneyBasePreview(def as BaseCardDef, expected);
        }
    });

    it('四个 Disney 派系已进入可见派系列表，且冰雪对象级审计收口后不再标记实施中', () => {
        const visibleIds = new Set(getVisibleFactionMetadata('zh-CN').map(meta => meta.id));

        for (const fixture of DISNEY_FACTIONS) {
            expect(visibleIds.has(fixture.factionId), `${fixture.factionId} 应在 zh-CN 可见`).toBe(true);
            expect(isFactionImplementationInProgress(fixture.factionId)).toBe(false);
        }
    });

    it('四个 Disney 派系的中英文 locale key 均已落地', () => {
        for (const fixture of DISNEY_FACTIONS) {
            expect(en.factions?.[fixture.factionId]?.name, `en factions.${fixture.factionId}.name`).toBeTruthy();
            expect(zhCN.factions?.[fixture.factionId]?.name, `zh-CN factions.${fixture.factionId}.name`).toBeTruthy();

            for (const defId of Object.keys(fixture.expectedCardIndexes)) {
                const enCard = en.cards?.[defId];
                const zhCard = zhCN.cards?.[defId];
                const def = getFactionCards(fixture.factionId).find(card => card.id === defId);

                expect(enCard?.name, `en cards.${defId}.name`).toBeTruthy();
                expect(zhCard?.name, `zh-CN cards.${defId}.name`).toBeTruthy();

                const textKey = def?.type === 'action' ? 'effectText' : 'abilityText';
                expect(enCard?.[textKey], `en cards.${defId}.${textKey}`).toBeTruthy();
                expect(zhCard?.[textKey], `zh-CN cards.${defId}.${textKey}`).toBeTruthy();
            }

            for (const baseId of Object.keys(fixture.expectedBases)) {
                expect(en.cards?.[baseId]?.name, `en cards.${baseId}.name`).toBeTruthy();
                expect(zhCN.cards?.[baseId]?.name, `zh-CN cards.${baseId}.name`).toBeTruthy();
                expect(en.cards?.[baseId]?.abilityText, `en cards.${baseId}.abilityText`).toBeTruthy();
                expect(zhCN.cards?.[baseId]?.abilityText, `zh-CN cards.${baseId}.abilityText`).toBeTruthy();
            }
        }
    });
});
