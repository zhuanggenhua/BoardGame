import type { DiceDefinition } from '../../../../engine/primitives';
import { ZHANSHUJIA_DICE_FACE_IDS } from '../../domain/ids';

export const ZHANSHUJIA_SYMBOLS = ZHANSHUJIA_DICE_FACE_IDS;

export const zhanshujiaDiceDefinition: DiceDefinition = {
    id: 'zhanshujia-dice',
    name: 'Tactician Dice',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [ZHANSHUJIA_DICE_FACE_IDS.SABRE] },
        { value: 2, symbols: [ZHANSHUJIA_DICE_FACE_IDS.SABRE] },
        { value: 3, symbols: [ZHANSHUJIA_DICE_FACE_IDS.SABRE] },
        { value: 4, symbols: [ZHANSHUJIA_DICE_FACE_IDS.BANNER] },
        { value: 5, symbols: [ZHANSHUJIA_DICE_FACE_IDS.BANNER] },
        { value: 6, symbols: [ZHANSHUJIA_DICE_FACE_IDS.MEDAL] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/zhanshujia/dice',
    },
};

export type ZhanshujiaDieFace = typeof ZHANSHUJIA_SYMBOLS[keyof typeof ZHANSHUJIA_SYMBOLS];
