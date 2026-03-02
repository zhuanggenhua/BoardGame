import { describe, it, expect, beforeAll } from 'vitest';
import { SmashUpDomain } from '../game';
import { initAllAbilities } from '../abilities';
import { resolveOnPlay } from '../domain/abilityRegistry';

beforeAll(() => {
    initAllAbilities();
});

describe('Dino Survival Debug', () => {
    it('能力是否注册', () => {
        const ability = resolveOnPlay('dino_survival_of_the_fittest');
        expect(ability).toBeDefined();
        console.log('Ability registered:', ability !== undefined);
    });

    it('setup 是否正常', () => {
        const state = SmashUpDomain.setup(['0', '1'], { shuffle: (arr) => arr });
        expect(state).toBeDefined();
        expect(state.players['0']).toBeDefined();
        console.log('Setup works:', state.players['0'] !== undefined);
    });
});
