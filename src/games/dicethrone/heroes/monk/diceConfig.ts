/**
 * Monk 英雄骰子定义
 */

import type { DiceDefinition } from '../../../systems/DiceSystem/types';
import { DICE_FACE_IDS } from '../domain/ids';

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
        { value: 1, symbols: [DICE_FACE_IDS.FIST] },
        { value: 2, symbols: [DICE_FACE_IDS.FIST] },
        { value: 3, symbols: [DICE_FACE_IDS.PALM] },
        { value: 4, symbols: [DICE_FACE_IDS.TAIJI] },
        { value: 5, symbols: [DICE_FACE_IDS.TAIJI] },
        { value: 6, symbols: [DICE_FACE_IDS.LOTUS] },
    ],
    assets: {
        spriteSheet: '/game-data/dicethrone/monk/dice-sprite.png',
    },
};

