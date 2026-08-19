/**
 * Paladin 圣骑士骰子定义
 */

import type { DiceDefinition } from '../../../../engine/primitives';
import { PALADIN_DICE_FACE_IDS } from '../../domain/ids';

/**
 * Paladin 骰子符号常量
 */
export const PALADIN_SYMBOLS = PALADIN_DICE_FACE_IDS;

/**
 * Paladin 骰子定义
 *
 * 骰面映射：
 * - 1, 2 → sword (剑)
 * - 3, 4 → helm (头盔)
 * - 5 → heart (心/恢复)
 * - 6 → pray (祈祷/圣光)
 */
export const paladinDiceDefinition: DiceDefinition = {
    id: 'paladin-dice',
    name: 'config.dice.paladin.name',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [PALADIN_DICE_FACE_IDS.SWORD] },
        { value: 2, symbols: [PALADIN_DICE_FACE_IDS.SWORD] },
        { value: 3, symbols: [PALADIN_DICE_FACE_IDS.HELM] },
        { value: 4, symbols: [PALADIN_DICE_FACE_IDS.HELM] },
        { value: 5, symbols: [PALADIN_DICE_FACE_IDS.HEART] },
        { value: 6, symbols: [PALADIN_DICE_FACE_IDS.PRAY] },
    ],
    assets: {
        spriteSheet: 'dicethrone/images/paladin/dice',
    },
};

/**
 * Paladin 骰面类型
 */
export type PaladinDieFace = typeof PALADIN_SYMBOLS[keyof typeof PALADIN_SYMBOLS];
