/**
 * Ninja 忍者骰子定义
 */
import type { DiceDefinition } from '../../../../engine/primitives';
import { NINJA_DICE_FACE_IDS } from '../../domain/ids';

export const NINJA_SYMBOLS = NINJA_DICE_FACE_IDS;

export const ninjaDiceDefinition: DiceDefinition = {
    id: 'ninja-dice',
    name: 'config.dice.ninja.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [NINJA_DICE_FACE_IDS.KATANA] },
        { value: 2, symbols: [NINJA_DICE_FACE_IDS.KATANA] },
        { value: 3, symbols: [NINJA_DICE_FACE_IDS.KATANA] },
        { value: 4, symbols: [NINJA_DICE_FACE_IDS.SHURIKEN] },
        { value: 5, symbols: [NINJA_DICE_FACE_IDS.SHURIKEN] },
        { value: 6, symbols: [NINJA_DICE_FACE_IDS.MASK] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/ninja/dice',
    },
};

export type NinjaDieFace = typeof NINJA_SYMBOLS[keyof typeof NINJA_SYMBOLS];
