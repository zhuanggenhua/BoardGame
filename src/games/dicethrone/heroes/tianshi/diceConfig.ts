/** 炽天使骰子定义 */

import type { DiceDefinition } from '../../../../engine/primitives';
import { TIANSHI_DICE_FACE_IDS } from '../../domain/ids';

export const TIANSHI_SYMBOLS = TIANSHI_DICE_FACE_IDS;

export const tianshiDiceDefinition: DiceDefinition = {
    id: 'tianshi-dice',
    name: 'config.dice.tianshi.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [TIANSHI_DICE_FACE_IDS.BLADE] },
        { value: 2, symbols: [TIANSHI_DICE_FACE_IDS.BLADE] },
        { value: 3, symbols: [TIANSHI_DICE_FACE_IDS.BLADE] },
        { value: 4, symbols: [TIANSHI_DICE_FACE_IDS.WING] },
        { value: 5, symbols: [TIANSHI_DICE_FACE_IDS.CROSS] },
        { value: 6, symbols: [TIANSHI_DICE_FACE_IDS.SHIELD] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/tianshi/dice',
    },
};

export type TianshiDieFace = typeof TIANSHI_SYMBOLS[keyof typeof TIANSHI_SYMBOLS];
