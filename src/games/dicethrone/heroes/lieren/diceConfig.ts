/** 女猎手骰子定义 */

import type { DiceDefinition } from '../../../../engine/primitives';
import { LIEREN_DICE_FACE_IDS } from '../../domain/ids';

export const LIEREN_SYMBOLS = LIEREN_DICE_FACE_IDS;

export const lierenDiceDefinition: DiceDefinition = {
    id: 'lieren-dice',
    name: 'config.dice.lieren.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [LIEREN_DICE_FACE_IDS.SPEAR] },
        { value: 2, symbols: [LIEREN_DICE_FACE_IDS.SPEAR] },
        { value: 3, symbols: [LIEREN_DICE_FACE_IDS.CLAW] },
        { value: 4, symbols: [LIEREN_DICE_FACE_IDS.CLAW] },
        { value: 5, symbols: [LIEREN_DICE_FACE_IDS.NYRAS_BOND] },
        { value: 6, symbols: [LIEREN_DICE_FACE_IDS.SABERTOOTH] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/lieren/dice',
    },
};

export type LierenDieFace = typeof LIEREN_SYMBOLS[keyof typeof LIEREN_SYMBOLS];
