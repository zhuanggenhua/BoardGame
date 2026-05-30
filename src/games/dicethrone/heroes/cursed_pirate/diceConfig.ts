import type { DiceDefinition } from '../../../../engine/primitives';
import { CURSED_PIRATE_DICE_FACE_IDS } from '../../domain/ids';

export const CURSED_PIRATE_SYMBOLS = CURSED_PIRATE_DICE_FACE_IDS;

export const cursedPirateDiceDefinition: DiceDefinition = {
    id: 'cursed_pirate-dice',
    name: 'Cursed Pirate Dice',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [CURSED_PIRATE_DICE_FACE_IDS.CUTLASS] },
        { value: 2, symbols: [CURSED_PIRATE_DICE_FACE_IDS.CUTLASS] },
        { value: 3, symbols: [CURSED_PIRATE_DICE_FACE_IDS.CUTLASS] },
        { value: 4, symbols: [CURSED_PIRATE_DICE_FACE_IDS.LOOT] },
        { value: 5, symbols: [CURSED_PIRATE_DICE_FACE_IDS.LOOT] },
        { value: 6, symbols: [CURSED_PIRATE_DICE_FACE_IDS.SKULL] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/cursed/dice',
    },
};

export type CursedPirateDieFace = typeof CURSED_PIRATE_SYMBOLS[keyof typeof CURSED_PIRATE_SYMBOLS];
