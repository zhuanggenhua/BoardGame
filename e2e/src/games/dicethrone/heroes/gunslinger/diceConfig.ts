/**
 * Gunslinger 枪手骰子定义
 */

import type { DiceDefinition } from '../../../../engine/primitives';
import { GUNSLINGER_DICE_FACE_IDS } from '../../domain/ids';

/**
 * Gunslinger 骰子符号常量
 */
export const GUNSLINGER_SYMBOLS = GUNSLINGER_DICE_FACE_IDS;

/**
 * Gunslinger 骰子定义
 * 
 * 骰面映射：
 * - 1, 2, 3 → bullet (子弹)
 * - 4, 5 → dash (冲刺)
 * - 6 → bullseye (准心)
 */
export const gunslingerDiceDefinition: DiceDefinition = {
    id: 'gunslinger-dice',
    name: 'Gunslinger Dice',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [GUNSLINGER_DICE_FACE_IDS.BULLET] },
        { value: 2, symbols: [GUNSLINGER_DICE_FACE_IDS.BULLET] },
        { value: 3, symbols: [GUNSLINGER_DICE_FACE_IDS.BULLET] },
        { value: 4, symbols: [GUNSLINGER_DICE_FACE_IDS.DASH] },
        { value: 5, symbols: [GUNSLINGER_DICE_FACE_IDS.DASH] },
        { value: 6, symbols: [GUNSLINGER_DICE_FACE_IDS.BULLSEYE] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/gunslinger/dice',
    },
};

export type GunslingerDieFace = typeof GUNSLINGER_SYMBOLS[keyof typeof GUNSLINGER_SYMBOLS];
