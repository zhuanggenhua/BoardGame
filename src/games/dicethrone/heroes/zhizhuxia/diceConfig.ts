/** 蜘蛛侠骰子定义 */

import type { DiceDefinition } from '../../../../engine/primitives';
import { ZHIZHUXIA_DICE_FACE_IDS } from '../../domain/ids';

export const ZHIZHUXIA_SYMBOLS = ZHIZHUXIA_DICE_FACE_IDS;

export const zhizhuxiaDiceDefinition: DiceDefinition = {
    id: 'zhizhuxia-dice',
    name: 'config.dice.zhizhuxia.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [ZHIZHUXIA_DICE_FACE_IDS.FIST] },
        { value: 2, symbols: [ZHIZHUXIA_DICE_FACE_IDS.FIST] },
        { value: 3, symbols: [ZHIZHUXIA_DICE_FACE_IDS.FIST] },
        { value: 4, symbols: [ZHIZHUXIA_DICE_FACE_IDS.WEB] },
        { value: 5, symbols: [ZHIZHUXIA_DICE_FACE_IDS.WEB] },
        { value: 6, symbols: [ZHIZHUXIA_DICE_FACE_IDS.SPIDER] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/zhizhuxia/dice',
    },
};

export type ZhizhuxiaDieFace = typeof ZHIZHUXIA_SYMBOLS[keyof typeof ZHIZHUXIA_SYMBOLS];
