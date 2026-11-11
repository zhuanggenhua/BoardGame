import { describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../engine/types';
import { rollMageWarsAttackDice, summarizeMageWarsAttackDice } from '../domain/attackDice';
import { createMageWarsObjectArmorDamageModifiers } from '../domain/damageRules';

describe('法师战争攻击骰', () => {
    it('六个面分别包含两个空白及普通、致命的一点和两点', () => {
        let face = 0;
        const random = { d: () => ++face } as RandomFn;
        const dice = rollMageWarsAttackDice(random, 6);
        expect(dice).toEqual([
            { value: 0, critical: false }, { value: 0, critical: false },
            { value: 1, critical: false }, { value: 1, critical: true },
            { value: 2, critical: false }, { value: 2, critical: true },
        ]);
        expect(summarizeMageWarsAttackDice(dice)).toMatchObject({ total: 6, normal: 3 });
    });

    it('护甲只抵消普通伤害，不抵消致命伤害', () => {
        const dice = summarizeMageWarsAttackDice([
            { value: 1, critical: false }, { value: 2, critical: true },
        ]);
        const armor = createMageWarsObjectArmorDamageModifiers(
            { targetObjectId: 'target', armor: 3 }, { normalDamage: dice.normal },
        );
        expect(dice.total + Number(armor[0].value)).toBe(2);
    });
});
