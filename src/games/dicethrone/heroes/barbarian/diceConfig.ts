/**
 * Barbarian 狂战士骰子定义
 */

import type { DiceDefinition } from '../../../systems/DiceSystem/types';
import { BARBARIAN_DICE_FACE_IDS } from '../domain/ids';

/**
 * Barbarian 骰子符号常量
 */
export const BARBARIAN_SYMBOLS = BARBARIAN_DICE_FACE_IDS;

/**
 * Barbarian 骰子定义
 * 
 * 骰面映射：
 * - 1, 2, 3 → sword (剑)
 * - 4, 5 → heart (恢复/心)
 * - 6 → strength (力量/星)
 */
export const barbarianDiceDefinition: DiceDefinition = {
    id: 'barbarian-dice',
    name: 'Barbarian Dice',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [BARBARIAN_DICE_FACE_IDS.SWORD] },
        { value: 2, symbols: [BARBARIAN_DICE_FACE_IDS.SWORD] },
        { value: 3, symbols: [BARBARIAN_DICE_FACE_IDS.SWORD] },
        { value: 4, symbols: [BARBARIAN_DICE_FACE_IDS.HEART] },
        { value: 5, symbols: [BARBARIAN_DICE_FACE_IDS.HEART] },
        { value: 6, symbols: [BARBARIAN_DICE_FACE_IDS.STRENGTH] },
    ],
    assets: {
        spriteSheet: '/game-data/dicethrone/barbarian/dice-sprite.png',
    },
};

/**
 * Barbarian 骰面类型
 */
export type BarbarianDieFace = typeof BARBARIAN_SYMBOLS[keyof typeof BARBARIAN_SYMBOLS];
