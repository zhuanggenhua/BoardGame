import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { getBaseDefIdsForFactions } from '../data/cards';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { getOngoingRuntimeRegistrationShape, hasRegisteredTrigger } from '../domain/ongoingEffects';
import {
    collectMissingSmashUpPodVariantProfileFactionIds,
    collectSmashUpVariantBindingErrors,
} from '../domain/variantBindingValidation';
import { getAllSmashUpVariantProfiles } from '../domain/variantBindings';
import {
    resolveSmashUpVariantRelationForSourceId,
    shouldGenerateSmashUpPodAlias,
} from '../domain/variantBindingRuntime';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('Smash Up 变体绑定运行时回归', () => {
    it('力量修正 POD 策略由统一 metadata 决定', () => {
        expect(resolveSmashUpVariantRelationForSourceId('powerModifier', 'all_stars_full_moon')).toBe('separate');
        expect(shouldGenerateSmashUpPodAlias('powerModifier', 'all_stars_full_moon')).toBe(false);
        expect(resolveSmashUpVariantRelationForSourceId('powerModifier', 'bear_cavalry_polar_commando')).toBe('baseOnly');
        expect(shouldGenerateSmashUpPodAlias('powerModifier', 'bear_cavalry_polar_commando')).toBe(false);
        expect(resolveSmashUpVariantRelationForSourceId('powerModifier', 'sinister_six_electro')).toBe('baseOnly');
        expect(shouldGenerateSmashUpPodAlias('powerModifier', 'sinister_six_electro')).toBe(false);
    });

    it('baseOnly / podOnly surface 都不会自动生成反向 alias', () => {
        expect(shouldGenerateSmashUpPodAlias('powerModifier', 'bear_cavalry_polar_commando')).toBe(false);
        expect(resolveSmashUpVariantRelationForSourceId('ongoing', 'mega_troopers_omega_protocol')).toBe('podOnly');
        expect(shouldGenerateSmashUpPodAlias('ongoing', 'mega_troopers_omega_protocol')).toBe(false);
    });

    it('非法 same 语义已收口为合法 shared relation', () => {
        expect(resolveSmashUpVariantRelationForSourceId('ability', 'mega_troopers_mega_attack')).toBe('shared');
        expect(resolveSmashUpVariantRelationForSourceId('interaction', 'mega_troopers_mega_attack')).toBe('shared');
        expect(shouldGenerateSmashUpPodAlias('ability', 'mega_troopers_mega_attack')).toBe(true);
        expect(shouldGenerateSmashUpPodAlias('interaction', 'mega_troopers_mega_attack')).toBe(true);
    });

    it('差异 POD 牌不会继续继承经典 ongoing surface', () => {
        expect(resolveSmashUpVariantRelationForSourceId('ability', 'bear_cavalry_polar_commando')).toBe('separate');
        expect(resolveSmashUpVariantRelationForSourceId('ongoing', 'bear_cavalry_polar_commando')).toBe('separate');
        expect(shouldGenerateSmashUpPodAlias('ongoing', 'bear_cavalry_polar_commando')).toBe(false);
    });

    it('共享的 POD 持续触发仍会注册到运行时', () => {
        expect(hasRegisteredTrigger('alien_scout_pod', 'afterScoring')).toBe(true);
        expect(hasRegisteredTrigger('pirate_king_pod', 'beforeScoring')).toBe(true);
        expect(hasRegisteredTrigger('pirate_first_mate_pod', 'afterScoring')).toBe(true);
        expect(hasRegisteredTrigger('pirate_buccaneer_pod', 'onMinionDestroyed')).toBe(true);
        expect(hasRegisteredTrigger('cthulhu_chosen_pod', 'beforeScoring')).toBe(true);
        expect(hasRegisteredTrigger('innsmouth_return_to_the_sea_pod', 'afterScoring')).toBe(true);
        expect(hasRegisteredTrigger('cowboys_sheriff_pod', 'beforeScoring')).toBe(true);
        expect(hasRegisteredTrigger('cowboys_dynamite_surprise_pod', 'onDeckInspected')).toBe(true);
    });

    it('显式分离的 POD 牌不会再继承经典持续触发', () => {
        expect(hasRegisteredTrigger('wizard_archmage_pod', 'onMinionPlayed')).toBe(false);
        expect(hasRegisteredTrigger('ninja_infiltrate_pod', 'onTurnStart')).toBe(false);
    });

    it('经典版 id 不得绑定 POD-only 或 separate-only surface', () => {
        expect(hasRegisteredTrigger('mega_troopers_omega_protocol', 'onTurnStart')).toBe(false);
        expect(getRegisteredAbilityKeys().has('fairies_titania_pod::onPlay')).toBe(true);
        expect(shouldGenerateSmashUpPodAlias('ability', 'fairies_titania')).toBe(false);
    });

    it('POD 基地池不会回退到经典版基地 id', () => {
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.FAIRIES_POD]).every((baseId) => baseId.endsWith('_pod'))).toBe(true);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.PRINCESSES_POD]).every((baseId) => baseId.endsWith('_pod'))).toBe(true);
    });

    it('实际 POD faction 数据都必须有变体 profile', () => {
        expect(collectSmashUpVariantBindingErrors()).not.toContainEqual(
            expect.stringContaining('缺少变体绑定 profile'),
        );
    });

    it('校验 helper 能发现有 POD faction 数据但缺 profile 的家族', () => {
        expect(collectMissingSmashUpPodVariantProfileFactionIds(
            [
                { id: 'known_card_pod', faction: 'known_pod' },
                { id: 'missing_card_pod', faction: 'missing_pod' },
                { id: 'classic_card', faction: 'classic' },
            ],
            [
                { podFactionId: 'known_pod' },
            ],
        )).toEqual(['missing_pod']);
        expect(collectMissingSmashUpPodVariantProfileFactionIds(
            [
                { id: 'fairies_probe', faction: SMASHUP_FACTION_IDS.FAIRIES_POD },
            ],
            getAllSmashUpVariantProfiles(),
        )).toEqual([]);
    });

    it('显式分离的 POD 泰坦不会再继承经典泰坦的 talent 与打随从限制', () => {
        const abilityKeys = getRegisteredAbilityKeys();
        expect(abilityKeys.has('tricksters_big_funny_giant_pod::talent')).toBe(false);

        const ongoingShape = getOngoingRuntimeRegistrationShape('tricksters_big_funny_giant_pod');
        expect(ongoingShape.restrictionTypes.has('play_minion')).toBe(false);
    });
});
