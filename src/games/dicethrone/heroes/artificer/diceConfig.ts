import type { DiceDefinition } from '../../../../engine/primitives';
import { ARTIFICER_DICE_FACE_IDS } from '../../domain/ids';

export const ARTIFICER_SYMBOLS = ARTIFICER_DICE_FACE_IDS;

export const artificerDiceDefinition: DiceDefinition = {
    id: 'artificer-dice',
    name: 'config.dice.artificer.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [ARTIFICER_DICE_FACE_IDS.WRENCH] },
        { value: 2, symbols: [ARTIFICER_DICE_FACE_IDS.WRENCH] },
        { value: 3, symbols: [ARTIFICER_DICE_FACE_IDS.WRENCH] },
        { value: 4, symbols: [ARTIFICER_DICE_FACE_IDS.GEAR] },
        { value: 5, symbols: [ARTIFICER_DICE_FACE_IDS.GEAR] },
        { value: 6, symbols: [ARTIFICER_DICE_FACE_IDS.ELECTRICITY] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/artificial/dice',
    },
};

export type ArtificerDieFace = typeof ARTIFICER_SYMBOLS[keyof typeof ARTIFICER_SYMBOLS];

