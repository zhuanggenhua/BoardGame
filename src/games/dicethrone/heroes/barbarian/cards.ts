/**
 * 狂战士英雄的手牌定义
 * 基于原版 Dice Throne 狂战士卡组
 */

import type { AbilityCard } from '../types';
import type { RandomFn } from '../../../engine/types';
import type { AbilityEffect, EffectTiming, EffectCondition, AbilityDef } from '../../../systems/presets/combat';
import { STATUS_IDS, DICETHRONE_CARD_ATLAS_IDS } from '../domain/ids';
import { COMMON_CARDS } from '../domain/commonCards';
import {
    SLAP_2, SLAP_3,
    ALL_OUT_STRIKE_2, ALL_OUT_STRIKE_3,
    POWERFUL_STRIKE_2,
    SUPPRESS_2,
    VIOLENT_ASSAULT_2,
    RECKLESS_STRIKE_2,
    STEADFAST_2,
    THICK_SKIN_2
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

// ============================================
// 辅助函数
// ============================================

// 施加状态
const inflictStatus = (
    statusId: string,
    value: number,
    description: string,
    opts?: { timing?: EffectTiming; condition?: EffectCondition }
): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
    timing: opts?.timing ?? 'immediate',
    condition: opts?.condition,
});

// 替换技能
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

// ============================================================================
// 卡牌定义
// ============================================================================

export const BARBARIAN_CARDS: AbilityCard[] = [
    // ============================================
    // 专属行动卡 (Action Cards - Main Phase)
    // ============================================
    {
        id: 'card-energetic',
        name: cardText('card-energetic', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-energetic', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.BARBARIAN, index: 0 },
        effects: [
            {
                description: '投掷1骰：⭐→治疗2+脑震荡；否则抽1牌',
                action: { type: 'custom', target: 'self', customActionId: 'energetic-roll' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-dizzy',
        name: cardText('card-dizzy', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-dizzy', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.BARBARIAN, index: 3 },
        playCondition: {
            requireDiceExists: false, // 占位
        },
        effects: [
            inflictStatus(STATUS_IDS.CONCUSSION, 1, '施加脑震荡'),
        ],
    },
    {
        id: 'card-head-blow',
        name: cardText('card-head-blow', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-head-blow', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.BARBARIAN, index: 4 },
        effects: [
            inflictStatus(STATUS_IDS.CONCUSSION, 1, '施加脑震荡'),
        ],
    },

    // ============================================
    // 专属行动卡 (Action Cards - Roll Phase)
    // ============================================
    {
        id: 'card-lucky',
        name: cardText('card-lucky', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('card-lucky', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.BARBARIAN, index: 1 },
        effects: [
            {
                description: '投掷3骰：治疗1+2x心',
                action: { type: 'custom', target: 'self', customActionId: 'lucky-roll-heal' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-more-please',
        name: cardText('card-more-please', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-more-please', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.BARBARIAN, index: 2 },
        effects: [
            {
                description: '投掷5骰：增加 1x剑 伤害；施加脑震荡',
                action: { type: 'custom', target: 'self', customActionId: 'more-please-roll-damage' },
                timing: 'immediate',
            },
        ],
    },

    // ============================================
    // 升级卡 (Upgrade Cards)
    // ============================================

    // 防御升级
    {
        id: 'card-thick-skin-2',
        name: cardText('card-thick-skin-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-thick-skin-2', 'description'),
        effects: [
            replaceAbility('thick-skin', THICK_SKIN_2, 2, '升级厚皮至 II 级'),
        ],
    },

    // 进攻升级
    {
        id: 'card-slap-2',
        name: cardText('card-slap-2', 'name'), // 重击 II
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-slap-2', 'description'),
        effects: [replaceAbility('slap', SLAP_2, 2, '升级拍击至 II 级')],
    },
    {
        id: 'card-slap-3',
        name: cardText('card-slap-3', 'name'), // 重击 III
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-slap-3', 'description'),
        effects: [replaceAbility('slap', SLAP_3, 3, '升级拍击至 III 级')],
    },

    {
        id: 'card-all-out-strike-2',
        name: cardText('card-all-out-strike-2', 'name'), // 坚毅重击 II
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-all-out-strike-2', 'description'),
        effects: [replaceAbility('all-out-strike', ALL_OUT_STRIKE_2, 2, '升级全力一击至 II 级')],
    },
    {
        id: 'card-all-out-strike-3',
        name: cardText('card-all-out-strike-3', 'name'), // 坚毅重击 III
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-all-out-strike-3', 'description'),
        effects: [replaceAbility('all-out-strike', ALL_OUT_STRIKE_3, 3, '升级全力一击至 III 级')],
    },

    {
        id: 'card-powerful-strike-2',
        name: cardText('card-powerful-strike-2', 'name'), // 神力重击 II
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-powerful-strike-2', 'description'),
        effects: [replaceAbility('powerful-strike', POWERFUL_STRIKE_2, 2, '升级强力一击至 II 级')],
    },

    {
        id: 'card-reckless-strike-2',
        name: cardText('card-reckless-strike-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-reckless-strike-2', 'description'),
        effects: [
            replaceAbility('reckless-strike', RECKLESS_STRIKE_2, 2, '升级鲁莽一击至 II 级'),
        ],
    },

    {
        id: 'card-suppress-2',
        name: cardText('card-suppress-2', 'name'), // 力大无穷 II
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-suppress-2', 'description'),
        effects: [
            replaceAbility('suppress', SUPPRESS_2, 2, '升级压制至 II 级'),
        ],
    },

    {
        id: 'card-steadfast-2',
        name: cardText('card-steadfast-2', 'name'), // 百折不挠 II
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-steadfast-2', 'description'),
        effects: [
            replaceAbility('steadfast', STEADFAST_2, 2, '升级坚韧不拔至 II 级'),
        ],
    },

    {
        id: 'card-violent-assault-2',
        name: cardText('card-violent-assault-2', 'name'), // 撼地重击 II
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-violent-assault-2', 'description'),
        effects: [
            replaceAbility('violent-assault', VIOLENT_ASSAULT_2, 2, '升级暴力猛击至 II 级'),
        ],
    },

    // ============================================
    // 通用卡牌 (Common Cards) - 注入
    // ============================================
    ...COMMON_CARDS,
];

export const getBarbarianStartingDeck = (random: RandomFn): AbilityCard[] => {
    // 构造初始牌库
    const deck: AbilityCard[] = [];

    BARBARIAN_CARDS.forEach(card => {
        if (card.type === 'upgrade') {
            deck.push({ ...card });
        } else {
            // Acton x2
            deck.push({ ...card });
            deck.push({ ...card });
        }
    });

    return random.shuffle(deck);
};

export default BARBARIAN_CARDS;
