/**
 * Shadow Thief 英雄骰子定义
 *
 * 1, 2: Dagger (匕首)
 * 3, 4: Bag (背包)
 * 5: Card (卡牌)
 * 6: Shadow (暗影)
 */
import type { DiceDefinition } from '../../../../engine/primitives';
import { versionedPublicFileUrl } from '../../../../lib/publicFileUrl';
import { SHADOW_THIEF_DICE_FACE_IDS } from '../../domain/ids';

export const shadowThiefDiceDefinition: DiceDefinition = {
    id: 'shadow_thief-dice',
    name: 'Shadow Thief Dice',
    sides: 6,
    category: 'hero',
    faces: [
        { value: 1, symbols: [SHADOW_THIEF_DICE_FACE_IDS.DAGGER] },
        { value: 2, symbols: [SHADOW_THIEF_DICE_FACE_IDS.DAGGER] },
        { value: 3, symbols: [SHADOW_THIEF_DICE_FACE_IDS.BAG] },
        { value: 4, symbols: [SHADOW_THIEF_DICE_FACE_IDS.BAG] },
        { value: 5, symbols: [SHADOW_THIEF_DICE_FACE_IDS.CARD] },
        { value: 6, symbols: [SHADOW_THIEF_DICE_FACE_IDS.SHADOW] },
    ],
    assets: {
        spriteSheet: versionedPublicFileUrl('/game-data/dicethrone/shadow_thief/dice-sprite.png'),
    },
};

/** 旧格式配置（保留兼容） */
export const SHADOW_THIEF_DICE_CONFIG = {
    [SHADOW_THIEF_DICE_FACE_IDS.DAGGER]: { symbol: 'dagger', label: '匕首', value: [1, 2] },
    [SHADOW_THIEF_DICE_FACE_IDS.BAG]: { symbol: 'bag', label: '背包', value: [3, 4] },
    [SHADOW_THIEF_DICE_FACE_IDS.CARD]: { symbol: 'card', label: '卡牌', value: [5] },
    [SHADOW_THIEF_DICE_FACE_IDS.SHADOW]: { symbol: 'shadow', label: '暗影', value: [6] },
};

export const SHADOW_THIEF_DICE_SPRITE_SHEET = 'dicethrone:shadow_thief-dice';
