/**
 * Pyromancer 英雄骰子定义
 */

import type { DiceDefinition } from '../../../../engine/primitives';
import { PYROMANCER_DICE_FACE_IDS } from '../../domain/ids';

/**
 * Pyromancer 骰子定义
 * 
 * 骰面映射：
 * - 1, 2, 3 → fire (火)
 * - 4 → magma (爆发)
 * - 5 → fiery_soul (焚魂)
 * - 6 → meteor (陨石)
 */
export const pyromancerDiceDefinition: DiceDefinition = {
    id: 'pyromancer-dice',
    name: 'config.dice.pyromancer.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [PYROMANCER_DICE_FACE_IDS.FIRE] },
        { value: 2, symbols: [PYROMANCER_DICE_FACE_IDS.FIRE] },
        { value: 3, symbols: [PYROMANCER_DICE_FACE_IDS.FIRE] },
        { value: 4, symbols: [PYROMANCER_DICE_FACE_IDS.MAGMA] },
        { value: 5, symbols: [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL] },
        { value: 6, symbols: [PYROMANCER_DICE_FACE_IDS.METEOR] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/pyromancer/dice',
    },
};
