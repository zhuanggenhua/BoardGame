import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getFactionCards } from '../data/cards';
import { hasAbility } from '../domain/abilityRegistry';
import { getOngoingRuntimeRegistrationShape, getRegisteredOngoingEffectIds } from '../domain/ongoingEffects';
import { getOngoingPowerModifier } from '../domain/ongoingModifiers';
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
        factionId: SMASHUP_FACTION_IDS.SHARKS_POD,
        atlasId: SMASHUP_ATLAS_IDS.SHARKS_POD_CARDS,
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            sharks_blood_in_the_water_pod: 0,
            sharks_torn_apart_pod: 2,
            sharks_chum_pod: 3,
            sharks_feeding_frenzy_pod: 4,
            sharks_freakin_laser_beam_pod: 5,
            sharks_air_jaws_pod: 6,
            sharks_dangerous_waters_pod: 7,
            sharks_week_of_sharks_pod: 8,
            sharks_mako_pod: 10,
            sharks_hammerhead_pod: 14,
            sharks_great_white_pod: 17,
            sharks_megalodon_pod: 19,
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.ALL_STARS_POD,
        atlasId: SMASHUP_ATLAS_IDS.ALL_STARS_POD_CARDS,
        expectedCardCount: 20,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            all_stars_seeing_stars_pod: 0,
            all_stars_begin_the_summoning_pod: 1,
            all_stars_its_astounding_pod: 2,
            all_stars_full_moon_pod: 3,
            all_stars_non_infinite_loop_pod: 4,
            all_stars_friendship_power_pod: 5,
            all_stars_ghostly_arrival_pod: 6,
            all_stars_square_deal_pod: 7,
            all_stars_favor_of_dionysus_pod: 8,
            all_stars_prepare_for_battle_pod: 9,
            all_stars_servitor_of_cthulhu_pod: 10,
            all_stars_fan_pod: 11,
            all_stars_sprout_pod: 12,
            all_stars_ensign_pod: 13,
            all_stars_puck_pod: 14,
            all_stars_lab_assistant_pod: 15,
            all_stars_imperial_dragon_pod: 16,
            all_stars_gelf_pod: 17,
            all_stars_granny_pod: 18,
            all_stars_king_rex_pod: 19,
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.TORNADOS_POD,
        atlasId: SMASHUP_ATLAS_IDS.TORNADOS_POD_CARDS,
        expectedCardCount: 12,
        expectedDeckCopies: 20,
        expectedCardIndexes: {
            tornados_not_in_kansas_pod: 0,
            tornados_picked_up_pod: 1,
            tornados_ripped_off_pod: 2,
            tornados_over_the_rainbow_pod: 3,
            tornados_trade_winds_pod: 4,
            tornados_whirlwinds_pod: 6,
            tornados_gone_with_the_wind_pod: 7,
            tornados_carried_away_pod: 8,
            tornados_dust_devil_pod: 10,
            tornados_twister_pod: 14,
            tornados_cyclone_pod: 17,
            tornados_monster_tornado_pod: 19,
        },
    },
];

const ALL_STARS_ABILITY_EXPECTATIONS: Array<[string, AbilityTag]> = [
    ['all_stars_seeing_stars_pod', 'onPlay'],
    ['all_stars_begin_the_summoning_pod', 'onPlay'],
    ['all_stars_its_astounding_pod', 'onPlay'],
    ['all_stars_non_infinite_loop_pod', 'onPlay'],
    ['all_stars_friendship_power_pod', 'onPlay'],
    ['all_stars_ghostly_arrival_pod', 'onPlay'],
    ['all_stars_square_deal_pod', 'onPlay'],
    ['all_stars_favor_of_dionysus_pod', 'onPlay'],
    ['all_stars_prepare_for_battle_pod', 'onPlay'],
    ['all_stars_servitor_of_cthulhu_pod', 'talent'],
    ['all_stars_fan_pod', 'special'],
    ['all_stars_puck_pod', 'onPlay'],
    ['all_stars_lab_assistant_pod', 'onPlay'],
    ['all_stars_gelf_pod', 'talent'],
    ['all_stars_granny_pod', 'talent'],
];

function readSmashUpLocale(locale: 'en' | 'zh-CN') {
    return JSON.parse(
        readFileSync(resolve(__dirname, `../../../../public/locales/${locale}/game-smashup.json`), 'utf-8'),
    );
}

describe('SmashUp Sharks / All-Stars / Tornados POD intake', () => {
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
            expect(def, `${defId} 应已注册`).toBeDefined();
            expect(def?.previewRef).toEqual({
                type: 'atlas',
                atlasId: fixture.atlasId,
                index,
            });
        }
    });

    it('三套 POD 派系已进入可选派系列表，不再标记实施中', () => {
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.SHARKS_POD)).toBe(false);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.ALL_STARS_POD)).toBe(false);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.TORNADOS_POD)).toBe(false);
    });

    it('三套 POD 的中英文悬浮翻译 key 均已落地', () => {
        for (const fixture of POD_FACTIONS) {
            expect(en.factions?.[fixture.factionId]?.name, `en factions.${fixture.factionId}.name`).toBeTruthy();
            expect(zhCN.factions?.[fixture.factionId]?.name, `zh-CN factions.${fixture.factionId}.name`).toBeTruthy();

            for (const defId of Object.keys(fixture.expectedCardIndexes)) {
                const enCard = en.cards?.[defId];
                const zhCard = zhCN.cards?.[defId];
                const def = getFactionCards(fixture.factionId).find(card => card.id === defId);
                expect(enCard?.name, `en cards.${defId}.name`).toBeTruthy();
                expect(zhCard?.name, `zh-CN cards.${defId}.name`).toBeTruthy();
                if (def?.type === 'action' || (def?.type === 'minion' && (def.abilityTags?.length ?? 0) > 0)) {
                    expect(enCard?.effectText ?? enCard?.abilityText, `en cards.${defId} text`).toBeTruthy();
                    expect(zhCard?.effectText ?? zhCard?.abilityText, `zh-CN cards.${defId} text`).toBeTruthy();
                }
            }
        }
    });

    it('Sharks 与 Tornados POD 走标准 POD 变体绑定，核心运行时触发已继承', () => {
        const { triggerIds } = getRegisteredOngoingEffectIds();

        expect(hasAbility('sharks_torn_apart_pod', 'onPlay')).toBe(true);
        expect(hasAbility('sharks_air_jaws_pod', 'onPlay')).toBe(true);
        expect(hasAbility('sharks_great_white_pod', 'talent')).toBe(true);
        expect(triggerIds.get('sharks_hammerhead_pod')).toContain('onMinionDestroyed');
        expect(getOngoingRuntimeRegistrationShape('sharks_megalodon_pod').triggerTimings.has('beforeScoring')).toBe(true);

        expect(hasAbility('tornados_not_in_kansas_pod', 'onPlay')).toBe(true);
        expect(hasAbility('tornados_cyclone_pod', 'talent')).toBe(true);
        expect(hasAbility('tornados_picked_up_pod', 'special')).toBe(true);
        expect(hasAbility('tornados_gone_with_the_wind_pod', 'special')).toBe(true);
    });

    it('All-Stars POD 已显式注册跨派系重印能力与 ongoing 触发', () => {
        const { triggerIds } = getRegisteredOngoingEffectIds();

        for (const [defId, tag] of ALL_STARS_ABILITY_EXPECTATIONS) {
            expect(hasAbility(defId, tag), `${defId}::${tag}`).toBe(true);
        }

        expect(triggerIds.get('all_stars_sprout_pod')).toContain('onTurnStart');
        expect(triggerIds.get('all_stars_imperial_dragon_pod')).toEqual(
            expect.arrayContaining(['onMinionPlayed', 'onMinionMoved']),
        );
        expect(getOngoingPowerModifier({
            phase: 'play',
            turnNumber: 1,
            activePlayerId: '0',
            players: {
                '0': { id: '0', deck: [], hand: [], discard: [], victoryPoints: 0 },
            },
            bases: [{
                defId: 'test_base',
                minions: [{
                    uid: 'target',
                    defId: 'test_minion',
                    owner: '0',
                    controller: '0',
                    basePower: 2,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                }],
                ongoingActions: [{ uid: 'full-moon', defId: 'all_stars_full_moon_pod', ownerId: '0' }],
            }],
        }, {
            uid: 'target',
            defId: 'test_minion',
            owner: '0',
            controller: '0',
            basePower: 2,
            powerModifier: 0,
            tempPowerModifier: 0,
            talentUsed: false,
            attachedActions: [],
        }, 0)).toBe(1);
        expect(hasAbility('all_stars_ensign_pod', 'ongoing')).toBe(false);
        expect(hasAbility('all_stars_king_rex_pod', 'onPlay')).toBe(false);
    });
});
