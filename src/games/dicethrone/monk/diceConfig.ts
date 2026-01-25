/**
 * Monk 英雄骰子定义
 */

import type { DiceDefinition } from '../../../systems/DiceSystem/types';

/**
 * Monk 骰子符号常量
 */
export const MONK_SYMBOLS = {
    FIST: 'fist',
    PALM: 'palm',
    TAIJI: 'taiji',
    LOTUS: 'lotus',
} as const;

/**
 * Monk 骰子定义
 * 
 * 骰面映射：
 * - 1, 2 → fist (拳)
 * - 3 → palm (掌)
 * - 4, 5 → taiji (太极)
 * - 6 → lotus (莲花)
 */
export const monkDiceDefinition: DiceDefinition = {
    id: 'monk-dice',
    name: 'Monk Dice',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [MONK_SYMBOLS.FIST] },
        { value: 2, symbols: [MONK_SYMBOLS.FIST] },
        { value: 3, symbols: [MONK_SYMBOLS.PALM] },
        { value: 4, symbols: [MONK_SYMBOLS.TAIJI] },
        { value: 5, symbols: [MONK_SYMBOLS.TAIJI] },
        { value: 6, symbols: [MONK_SYMBOLS.LOTUS] },
    ],
    assets: {
        spriteSheet: '/game-data/dicethrone/monk/dice-sprite.png',
    },
};

/**
 * Monk 骰面类型（兼容旧代码）
 */
export type MonkDieFace = typeof MONK_SYMBOLS[keyof typeof MONK_SYMBOLS];
