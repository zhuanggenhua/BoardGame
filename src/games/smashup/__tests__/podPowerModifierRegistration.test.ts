import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import {
    clearPowerModifierRegistry,
    getBasePowerModifiers,
    getEffectiveBreakpoint,
    getEffectivePower,
    getRegisteredModifierIds,
    registerBasePowerModifiers,
    registerBreakpointModifiers,
    registerOngoingPowerModifiers,
    registerBasePowerModifier,
    registerBreakpointModifier,
    registerPodPowerModifierAliases,
    registerPowerModifiers,
    registerPowerModifier,
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

    it('POD power modifier alias 在未显式覆写时，仍应继承基础版 modifier', () => {
        registerPowerModifier('alias_power_card', (ctx) => (
            ctx.minion.defId === 'alias_power_card' || ctx.minion.defId === 'alias_power_card_pod' ? 3 : 0
        ));
        registerPodPowerModifierAliases();

        const podMinion = makeMinion('m0', 'alias_power_card_pod', '0', 4, { powerModifier: 0 });
        const state = makeStateWithBases([makeBase('base_the_jungle', [podMinion])]);

        expect(getEffectivePower(state, podMinion, 0)).toBe(7);
    });

    it('POD power modifier 在显式覆写时，应覆盖基础版而不是补充', () => {
        registerPowerModifier('alias_power_card', (ctx) => (
            ctx.minion.defId === 'alias_power_card' || ctx.minion.defId === 'alias_power_card_pod' ? 3 : 0
        ));
        registerPowerModifier('alias_power_card_pod', (ctx) => (
            ctx.minion.defId === 'alias_power_card_pod' ? 7 : 0
        ));
        registerPodPowerModifierAliases();

        const podMinion = makeMinion('m0', 'alias_power_card_pod', '0', 4, { powerModifier: 0 });
        const state = makeStateWithBases([makeBase('base_the_jungle', [podMinion])]);

        expect(getEffectivePower(state, podMinion, 0)).toBe(11);
    });

    it('baseOnly power modifier 不应自动生成 POD alias 或影响 POD 版本', () => {
        registerPowerModifier('alias_power_card', (ctx) => (
            ctx.minion.defId === 'alias_power_card' ? 3 : 0
        ), { podStrategy: 'baseOnly' });
        registerPodPowerModifierAliases();

        const baseMinion = makeMinion('m-base', 'alias_power_card', '0', 4, { powerModifier: 0 });
        const podMinion = makeMinion('m-pod', 'alias_power_card_pod', '0', 4, { powerModifier: 0 });
        const state = makeStateWithBases([makeBase('base_the_jungle', [baseMinion, podMinion])]);
        const { powerModifierIds } = getRegisteredModifierIds();

        expect(getEffectivePower(state, baseMinion, 0)).toBe(7);
        expect(getEffectivePower(state, podMinion, 0)).toBe(4);
        expect(powerModifierIds.has('alias_power_card_pod')).toBe(false);
    });

    it('结构化 power modifier 定义也应保留 baseOnly 语义', () => {
        registerPowerModifiers([
            {
                sourceDefId: 'bulk_power_card',
                podStrategy: 'baseOnly',
                modifier: (ctx) => (ctx.minion.defId === 'bulk_power_card' ? 3 : 0),
            },
        ]);
        registerPodPowerModifierAliases();

        const baseMinion = makeMinion('m-base', 'bulk_power_card', '0', 4, { powerModifier: 0 });
        const podMinion = makeMinion('m-pod', 'bulk_power_card_pod', '0', 4, { powerModifier: 0 });
        const state = makeStateWithBases([makeBase('base_the_jungle', [baseMinion, podMinion])]);

        expect(getEffectivePower(state, baseMinion, 0)).toBe(7);
        expect(getEffectivePower(state, podMinion, 0)).toBe(4);
    });

    it('结构化 ongoing modifier 定义应让 POD 附着牌沿同一规则生效且不双算', () => {
        registerOngoingPowerModifiers([
            {
                defId: 'bulk_attached_buff',
                location: 'minion',
                target: 'self',
                delta: 2,
            },
        ]);
        registerPodPowerModifierAliases();

        const podMinion = makeMinion('m-pod', 'target_minion_pod', '0', 4, {
            powerModifier: 0,
            attachedActions: [{ uid: 'oa-pod', defId: 'bulk_attached_buff_pod', ownerId: '0' }],
        });
        const state = makeStateWithBases([makeBase('base_the_jungle', [podMinion])]);

        expect(getEffectivePower(state, podMinion, 0)).toBe(6);
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

    it('结构化 base power / breakpoint 定义也应与现有 alias 语义一致', () => {
        registerBasePowerModifiers([
            {
                defId: 'bulk_base_power_card',
                modifier: (ctx) => (ctx.ongoing?.defId === 'bulk_base_power_card' && ctx.ongoing.ownerId === ctx.playerId ? 5 : 0),
            },
        ]);
        registerBreakpointModifiers([
            {
                sourceDefId: 'bulk_breakpoint_card',
                modifier: (ctx) => (
                    ctx.base.ongoingActions.some((action) => action.defId === 'bulk_breakpoint_card') ? 3 : 0
                ),
            },
        ]);
        registerPodPowerModifierAliases();

        const base = makeBase('base_the_jungle', [makeMinion('m0', 'test_minion', '0', 3)]);
        base.ongoingActions = [
            { uid: 'oa-pod-power', defId: 'bulk_base_power_card_pod', ownerId: '0' },
            { uid: 'oa-pod-breakpoint', defId: 'bulk_breakpoint_card_pod', ownerId: '0' },
        ];
        const state = makeStateWithBases([base]);
        const baseBreakpoint = getEffectiveBreakpoint(makeStateWithBases([makeBase('base_the_jungle')]), 0);

        expect(getBasePowerModifiers(state, 0, '0')).toBe(5);
        expect(getEffectiveBreakpoint(state, 0)).toBe(baseBreakpoint + 3);
    });
});

