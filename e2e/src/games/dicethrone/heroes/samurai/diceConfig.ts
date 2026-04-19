import type { DiceDefinition } from '../../../../engine/primitives';
import { SAMURAI_DICE_FACE_IDS } from '../../domain/ids';

export const SAMURAI_SYMBOLS = SAMURAI_DICE_FACE_IDS;

export const samuraiDiceDefinition: DiceDefinition = {
    id: 'samurai-dice',
    name: 'Samurai Dice',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [SAMURAI_DICE_FACE_IDS.KATANA] },
        { value: 2, symbols: [SAMURAI_DICE_FACE_IDS.KATANA] },
        { value: 3, symbols: [SAMURAI_DICE_FACE_IDS.KATANA] },
        { value: 4, symbols: [SAMURAI_DICE_FACE_IDS.HELM] },
        { value: 5, symbols: [SAMURAI_DICE_FACE_IDS.HELM] },
        { value: 6, symbols: [SAMURAI_DICE_FACE_IDS.RISING_SUN] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/samurai/dice',
    },
};

export type SamuraiDieFace = typeof SAMURAI_SYMBOLS[keyof typeof SAMURAI_SYMBOLS];
