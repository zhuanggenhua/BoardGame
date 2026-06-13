import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { getOngoingRuntimeRegistrationShape, hasRegisteredTrigger } from '../domain/ongoingEffects';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('Smash Up 变体绑定运行时回归', () => {
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

    it('显式分离的 POD 泰坦不会再继承经典泰坦的 talent 与打随从限制', () => {
        const abilityKeys = getRegisteredAbilityKeys();
        expect(abilityKeys.has('tricksters_big_funny_giant_pod::talent')).toBe(false);

        const ongoingShape = getOngoingRuntimeRegistrationShape('tricksters_big_funny_giant_pod');
        expect(ongoingShape.restrictionTypes.has('play_minion')).toBe(false);
    });
});
