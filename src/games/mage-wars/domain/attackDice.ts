import type { RandomFn } from '../../../engine/types';

/** 真实攻击骰：两个空白面，普通和致命各有一面 1 点、一面 2 点。 */
export interface MageWarsAttackDieResult {
    value: 0 | 1 | 2;
    critical: boolean;
}

const ATTACK_DIE_FACES: readonly MageWarsAttackDieResult[] = [
    { value: 0, critical: false }, { value: 0, critical: false },
    { value: 1, critical: false }, { value: 1, critical: true },
    { value: 2, critical: false }, { value: 2, critical: true },
];

export function rollMageWarsAttackDice(random: RandomFn, count: number): MageWarsAttackDieResult[] {
    return Array.from({ length: count }, () => ATTACK_DIE_FACES[random.d(6) - 1]);
}

export function summarizeMageWarsAttackDice(dice: readonly MageWarsAttackDieResult[]) {
    const values = dice.map(die => die.value);
    const critical = dice.map(die => die.critical);
    return {
        values,
        critical,
        total: dice.reduce((sum, die) => sum + die.value, 0),
        normal: dice.reduce((sum, die) => sum + (die.critical ? 0 : die.value), 0),
    };
}
