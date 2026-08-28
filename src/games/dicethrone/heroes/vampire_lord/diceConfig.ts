/** 吸血鬼领主骰子定义 */

import type { DiceDefinition } from '../../../../engine/primitives';
import { VAMPIRE_LORD_DICE_FACE_IDS } from '../../domain/ids';

export const VAMPIRE_LORD_SYMBOLS = VAMPIRE_LORD_DICE_FACE_IDS;

export const vampireLordDiceDefinition: DiceDefinition = {
    id: 'vampire_lord-dice',
    name: 'config.dice.vampire_lord.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [VAMPIRE_LORD_DICE_FACE_IDS.CLAW] },
        { value: 2, symbols: [VAMPIRE_LORD_DICE_FACE_IDS.CLAW] },
        { value: 3, symbols: [VAMPIRE_LORD_DICE_FACE_IDS.CLAW] },
        { value: 4, symbols: [VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE] },
        { value: 5, symbols: [VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE] },
        { value: 6, symbols: [VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/xixuegui/dice',
    },
};

export type VampireLordDieFace = typeof VAMPIRE_LORD_SYMBOLS[keyof typeof VAMPIRE_LORD_SYMBOLS];
