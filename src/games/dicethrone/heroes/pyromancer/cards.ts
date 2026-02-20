/**
 * Pyromancer 英雄的手牌定义
 * 基于详细面板截图
 */

import type { AbilityCard } from '../../types';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityEffect, AbilityDef } from '../../domain/combat';
import { STATUS_IDS, TOKEN_IDS, PYROMANCER_DICE_FACE_IDS, DICETHRONE_CARD_ATLAS_IDS } from '../../domain/ids';
import { COMMON_CARDS, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import { abilityEffectText } from '../../../../engine/primitives/ability';
import {
    FIREBALL_2,
    BURNING_SOUL_2,
    HOT_STREAK_2,
    METEOR_2,
    PYRO_BLAST_2, PYRO_BLAST_3,
    BURN_DOWN_2,
    IGNITE_2,
    MAGMA_ARMOR_2, MAGMA_ARMOR_3
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

// ============================================
// 辅助函数
// ============================================

const replaceAbility = (
    targetAbilityId: string,
    newAbilityDef: AbilityDef,
    newAbilityLevel: number,
    description: string
): AbilityEffect => ({
    description,
    action: { type: 'replaceAbility', target: 'self', targetAbilityId, newAbilityDef, newAbilityLevel },
    timing: 'immediate',
});

const grantToken = (tokenId: string, value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value },
    timing: 'immediate',
});

// ============================================================================
// 卡牌定义
// ============================================================================

export const PYROMANCER_CARDS: AbilityCard[] = [
    // ============================================
    // 专属行动卡 (Action Cards - Main Phase)
    // ============================================
    {
        id: 'card-turning-up-the-heat',
        name: cardText('card-turning-up-the-heat', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-turning-up-the-heat', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 1 }, // Placeholder index
        effects: [
            grantToken(TOKEN_IDS.FIRE_MASTERY, 1, abilityEffectText('card-turning-up-the-heat', 'gainFM1')),
            {
                description: abilityEffectText('card-turning-up-the-heat', 'spendCP'),
                action: { type: 'custom', target: 'self', customActionId: 'pyro-spend-cp-for-fm' },
                timing: 'immediate'
            }
        ],
    },
    {
        id: 'card-infernal-embrace',
        name: cardText('card-infernal-embrace', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-infernal-embrace', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 2 },
        effects: [
            {
                description: abilityEffectText('card-infernal-embrace', 'roll'),
                action: {
                    type: 'rollDie', target: 'self', diceCount: 1,
                    conditionalEffects: [
                        { face: PYROMANCER_DICE_FACE_IDS.FIRE, grantToken: { tokenId: TOKEN_IDS.FIRE_MASTERY, value: 2 }, effectKey: 'bonusDie.effect.infernalEmbrace.fire' },
                    ],
                    defaultEffect: { drawCard: 1, effectKey: 'bonusDie.effect.infernalEmbrace.1' },
                },
                timing: 'immediate'
            }
        ],
    },
    {
        id: 'card-fan-the-flames',
        name: cardText('card-fan-the-flames', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-fan-the-flames', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 12 },
        effects: [
            {
                description: abilityEffectText('card-fan-the-flames', 'increaseLimit'),
                action: { type: 'custom', target: 'self', customActionId: 'increase-fm-limit' },
                timing: 'immediate'
            },
            grantToken(TOKEN_IDS.FIRE_MASTERY, 2, abilityEffectText('card-fan-the-flames', 'gainFM2'))
        ],
    },

    // ============================================
    // 专属行动卡 (Action Cards - Roll Phase / Instant)
    // ============================================
    {
        id: 'card-red-hot',
        name: cardText('card-red-hot', 'name'),
        type: 'action', // Instant / Attack Mod
        cpCost: 1,
        timing: 'roll', // 'roll' timing usually covers Attack Modifiers in simplified model, or 'instant'
        description: cardText('card-red-hot', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 7 },
        isAttackModifier: true,
        effects: [
            {
                description: abilityEffectText('card-red-hot', 'dmgPerFM'),
                action: { type: 'custom', target: 'self', customActionId: 'pyro-details-dmg-per-fm' },
                timing: 'immediate'
            }
        ],
    },
    {
        id: 'card-get-fired-up',
        name: cardText('card-get-fired-up', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-get-fired-up', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 13 },
        isAttackModifier: true,
        effects: [
            {
                description: abilityEffectText('card-get-fired-up', 'roll'),
                action: { type: 'custom', target: 'self', customActionId: 'pyro-get-fired-up-roll' },
                timing: 'immediate'
            }
        ],
    },

    // ============================================
    // 升级卡 (Upgrade Cards)
    // ============================================

    // 防御升级
    {
        id: 'card-magma-armor-2',
        name: cardText('card-magma-armor-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-magma-armor-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 0 },
        effects: [
            replaceAbility('magma-armor', MAGMA_ARMOR_2, 2, '升级熔岩护甲至 II 级')
        ],
    },
    {
        id: 'card-magma-armor-3',
        name: cardText('card-magma-armor-3', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-magma-armor-3', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 11 },
        effects: [
            replaceAbility('magma-armor', MAGMA_ARMOR_3, 3, '升级熔岩护甲至 III 级')
        ],
    },

    // 进攻升级
    {
        id: 'card-fireball-2',
        name: cardText('card-fireball-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-fireball-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 6 },
        effects: [
            replaceAbility('fireball', FIREBALL_2, 2, '升级火球至 II 级')
        ],
    },
    {
        id: 'card-burning-soul-2',
        name: cardText('card-burning-soul-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-burning-soul-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 9 },
        effects: [
            replaceAbility('soul-burn', BURNING_SOUL_2, 2, '升级灵魂燃烧至 II 级')
        ],
    },
    {
        id: 'card-hot-streak-2',
        name: cardText('card-hot-streak-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-hot-streak-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 14 },
        effects: [
            replaceAbility('fiery-combo', HOT_STREAK_2, 2, '升级热浪/火热连击至 II 级')
        ],
    },
    {
        id: 'card-meteor-2',
        name: cardText('card-meteor-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-meteor-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 5 },
        effects: [
            replaceAbility('meteor', METEOR_2, 2, '升级陨石至 II 级')
        ],
    },
    {
        id: 'card-pyro-blast-2',
        name: cardText('card-pyro-blast-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-pyro-blast-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 3 },
        effects: [
            replaceAbility('pyro-blast', PYRO_BLAST_2, 2, '升级高温爆破至 II 级')
        ],
    },
    {
        id: 'card-pyro-blast-3',
        name: cardText('card-pyro-blast-3', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-pyro-blast-3', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 4 },
        effects: [
            replaceAbility('pyro-blast', PYRO_BLAST_3, 3, '升级高温爆破至 III 级')
        ],
    },
    {
        id: 'card-burn-down-2',
        name: cardText('card-burn-down-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-burn-down-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 8 },
        effects: [
            replaceAbility('burn-down', BURN_DOWN_2, 2, '升级烧毁至 II 级')
        ],
    },
    {
        id: 'card-ignite-2',
        name: cardText('card-ignite-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-ignite-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PYROMANCER, index: 10 },
        effects: [
            replaceAbility('ignite', IGNITE_2, 2, '升级点燃至 II 级')
        ],
    },

    // ============================================
    // 通用卡牌 (Common Cards) - 注入（带图集预览引用）
    // ============================================
    ...injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.PYROMANCER),
];

export const getPyromancerStartingDeck = (random: RandomFn): AbilityCard[] => {
    // 每张卡牌只放 1 份，共 33 张（规则标准）
    const deck = PYROMANCER_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};

export default PYROMANCER_CARDS;
