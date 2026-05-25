import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import {
    clearPowerModifierRegistry,
    getBasePowerModifiers,
    getEffectiveBreakpoint,
    getRegisteredModifierIds,
    registerBasePowerModifier,
    registerBreakpointModifier,
    registerPodPowerModifierAliases,
} from '../domain/ongoingModifiers';
import { makeBase, makeMinion, makeStateWithBases } from './helpers';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('POD power modifier registration', () => {
    it('should register killer_plant_weed_eater_pod power modifier during init', () => {
        const { powerModifierIds } = getRegisteredModifierIds();
        expect(powerModifierIds.has('killer_plant_weed_eater_pod')).toBe(true);
    });

    it('should not expose phantom or non-ongoing _pod modifier ids in audit registry', () => {
        const { powerModifierIds } = getRegisteredModifierIds();
        expect(powerModifierIds.has('ghost_haunting_pod')).toBe(true);
        expect(powerModifierIds.has('killer_plant_weed_eater_pod')).toBe(true);
        expect(powerModifierIds.has('bear_cavalry_polar_commando_pod')).toBe(false);
        expect(powerModifierIds.has('base_monkey_lab_pod')).toBe(false);
        expect(powerModifierIds.has('fairies_daisy_chain_pod')).toBe(false);
        expect(powerModifierIds.has('fairies_enchantment_pod')).toBe(false);
        expect(powerModifierIds.has('mermaids_temptress_pod')).toBe(false);
        expect(powerModifierIds.has('base_minionPowerBonus_pod')).toBe(false);
        expect(powerModifierIds.has('shapeshifters_copycat_copied_power_pod')).toBe(false);
        expect(powerModifierIds.has('shapeshifters_cellular_bonding_copied_power_pod')).toBe(false);
    });
});

describe('registerPodPowerModifierAliases completion audit', () => {
    beforeEach(() => {
        clearPowerModifierRegistry();
    });

    afterEach(() => {
        clearPowerModifierRegistry();
    });

    it('POD breakpoint alias 在未显式覆写时，仍应继承基础版 modifier', () => {
        registerBreakpointModifier('alias_breakpoint_card', (ctx) => (
            ctx.base.ongoingActions.some((action) => action.defId === 'alias_breakpoint_card') ? 3 : 0
        ));
        registerPodPowerModifierAliases();

        const state = makeStateWithBases([makeBase('base_the_jungle', [
            makeMinion('m0', 'test_minion', '0', 3),
        ])]);
        state.bases[0].ongoingActions = [{ uid: 'oa-pod', defId: 'alias_breakpoint_card_pod', ownerId: '0' }];

        const baseBreakpoint = getEffectiveBreakpoint(makeStateWithBases([makeBase('base_the_jungle')]), 0);
        expect(getEffectiveBreakpoint(state, 0)).toBe(baseBreakpoint + 3);
    });

    it('POD breakpoint alias 在已显式覆写时，不应被基础版 alias 覆盖', () => {
        registerBreakpointModifier('alias_breakpoint_card', (ctx) => (
            ctx.base.ongoingActions.some((action) => action.defId === 'alias_breakpoint_card') ? 3 : 0
        ));
        registerBreakpointModifier('alias_breakpoint_card_pod', (ctx) => (
            ctx.base.ongoingActions.some((action) => action.defId === 'alias_breakpoint_card_pod') ? 7 : 0
        ));
        registerPodPowerModifierAliases();

        const state = makeStateWithBases([makeBase('base_the_jungle', [
            makeMinion('m0', 'test_minion', '0', 3),
        ])]);
        state.bases[0].ongoingActions = [{ uid: 'oa-pod', defId: 'alias_breakpoint_card_pod', ownerId: '0' }];

        const baseBreakpoint = getEffectiveBreakpoint(makeStateWithBases([makeBase('base_the_jungle')]), 0);
        expect(getEffectiveBreakpoint(state, 0)).toBe(baseBreakpoint + 7);
    });

    it('POD base power alias 在未显式覆写时，仍应继承基础版 modifier', () => {
        registerBasePowerModifier('alias_base_power_card', (ctx) => (
            ctx.ongoing?.defId === 'alias_base_power_card' && ctx.ongoing.ownerId === ctx.playerId ? 5 : 0
        ));
        registerPodPowerModifierAliases();

        const base = makeBase('base_the_jungle', [makeMinion('m0', 'test_minion', '0', 3)]);
        base.ongoingActions = [{ uid: 'oa-pod', defId: 'alias_base_power_card_pod', ownerId: '0' }];
        const state = makeStateWithBases([base]);

        expect(getBasePowerModifiers(state, 0, '0')).toBe(5);
        expect(getBasePowerModifiers(state, 0, '1')).toBe(0);
    });

    it('POD base power alias 在已显式覆写时，不应被基础版 alias 覆盖', () => {
        registerBasePowerModifier('alias_base_power_card', (ctx) => (
            ctx.ongoing?.defId === 'alias_base_power_card' && ctx.ongoing.ownerId === ctx.playerId ? 5 : 0
        ));
        registerBasePowerModifier('alias_base_power_card_pod', (ctx) => (
            ctx.ongoing?.defId === 'alias_base_power_card_pod' && ctx.ongoing.ownerId === ctx.playerId ? 9 : 0
        ));
        registerPodPowerModifierAliases();

        const base = makeBase('base_the_jungle', [makeMinion('m0', 'test_minion', '0', 3)]);
        base.ongoingActions = [{ uid: 'oa-pod', defId: 'alias_base_power_card_pod', ownerId: '0' }];
        const state = makeStateWithBases([base]);

        expect(getBasePowerModifiers(state, 0, '0')).toBe(9);
    });
});

