/**
 * Moon Elf 英雄骰子定义
 * 
 * 1-3: Bow (弓)
 * 4-5: Foot (足)
 * 6: Moon (月)
 */
import type { DiceDefinition } from '../../../../engine/primitives';
import { MOON_ELF_DICE_FACE_IDS } from '../../domain/ids';

export const moonElfDiceDefinition: DiceDefinition = {
    id: 'moon_elf-dice',
    name: 'config.dice.moonElf.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [MOON_ELF_DICE_FACE_IDS.BOW] },
        { value: 2, symbols: [MOON_ELF_DICE_FACE_IDS.BOW] },
        { value: 3, symbols: [MOON_ELF_DICE_FACE_IDS.BOW] },
        { value: 4, symbols: [MOON_ELF_DICE_FACE_IDS.FOOT] },
        { value: 5, symbols: [MOON_ELF_DICE_FACE_IDS.FOOT] },
        { value: 6, symbols: [MOON_ELF_DICE_FACE_IDS.MOON] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/moon_elf/dice',
    },
};
