import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getRegisteredModifierIds } from '../domain/ongoingModifiers';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('POD power modifier registration', () => {
    it('should register killer_plant_weed_eater_pod power modifier during init', () => {
        const { powerModifierIds } = getRegisteredModifierIds();
        expect(powerModifierIds.has('killer_plant_weed_eater_pod')).toBe(true);
    });
});

