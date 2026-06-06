/**
 * Treant 树精骰子定义
 */
import type { DiceDefinition } from '../../../../engine/primitives';
import { TREANT_DICE_FACE_IDS } from '../../domain/ids';

export const TREANT_SYMBOLS = TREANT_DICE_FACE_IDS;

export const treantDiceDefinition: DiceDefinition = {
    id: 'treant-dice',
    name: 'config.dice.treant.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [TREANT_DICE_FACE_IDS.BRANCH] },
        { value: 2, symbols: [TREANT_DICE_FACE_IDS.BRANCH] },
        { value: 3, symbols: [TREANT_DICE_FACE_IDS.BRANCH] },
        { value: 4, symbols: [TREANT_DICE_FACE_IDS.LEAF] },
        { value: 5, symbols: [TREANT_DICE_FACE_IDS.LEAF] },
        { value: 6, symbols: [TREANT_DICE_FACE_IDS.SPIRIT] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/treant/dice',
    },
};

export type TreantDieFace = typeof TREANT_SYMBOLS[keyof typeof TREANT_SYMBOLS];
