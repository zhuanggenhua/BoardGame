import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../abilities';
import { resolveSpecial } from '../domain/abilityRegistry';
import { hasRegisteredTrigger } from '../domain/ongoingEffects';

describe('afterScoring 卡牌注册', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('giant_ant_under_pressure 应该已注册为 special 能力', () => {
        const executor = resolveSpecial('giant_ant_under_pressure');
        expect(executor).toBeDefined();
        expect(typeof executor).toBe('function');
    });

    it('innsmouth_return_to_the_sea 应该走统一 afterScoring trigger', () => {
        const executor = resolveSpecial('innsmouth_return_to_the_sea');
        expect(executor).toBeDefined();
        expect(typeof executor).toBe('function');
        expect(hasRegisteredTrigger('innsmouth_return_to_the_sea', 'afterScoring')).toBe(true);
    });

    it('giant_ant_we_are_the_champions 应该走统一 afterScoring trigger', () => {
        const executor = resolveSpecial('giant_ant_we_are_the_champions');
        expect(executor).toBeDefined();
        expect(typeof executor).toBe('function');
        expect(hasRegisteredTrigger('giant_ant_we_are_the_champions', 'afterScoring')).toBe(true);
    });

    it('vampire_buffet 应该走统一 afterScoring trigger', () => {
        const executor = resolveSpecial('vampire_buffet');
        expect(executor).toBeDefined();
        expect(typeof executor).toBe('function');
        expect(hasRegisteredTrigger('vampire_buffet', 'afterScoring')).toBe(true);
    });
});
