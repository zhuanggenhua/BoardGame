import type { AbilityCard } from '../types';
import type { CardPreviewRef } from '../../../core';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

/**
 * 通用卡在英雄图集中的固定位置（所有英雄图集布局一致）
 * 专属卡占 index 0-14，通用卡从 index 15 开始
 */
const COMMON_ATLAS_INDEX: Record<string, number> = {
    'card-play-six': 15,
    'card-just-this': 16,
    'card-give-hand': 17,
    'card-i-can-again': 18,
    'card-me-too': 19,
    'card-surprise': 20,
    'card-worthy-of-me': 21,
    'card-unexpected': 22,
    'card-next-time': 23,
    'card-boss-generous': 24,
    'card-flick': 25,
    'card-bye-bye': 26,
    'card-double': 27,
    'card-super-double': 28,
    'card-get-away': 29,
    'card-one-throw-fortune': 30,
    'card-what-status': 31,
    'card-transfer-status': 32,
};

/**
 * 为通用卡注入 previewRef（指向指定英雄的图集）
 * 在各英雄 cards.ts 中 spread COMMON_CARDS 时调用
 */
export const injectCommonCardPreviewRefs = (cards: AbilityCard[], atlasId: string): AbilityCard[] =>
    cards.map(card => {
        const index = COMMON_ATLAS_INDEX[card.id];
        if (index === undefined) return card;
        const previewRef: CardPreviewRef = { type: 'atlas', atlasId, index };
        return { ...card, previewRef };
    });

/**
 * Dice Throne 所有英雄共用的通用卡牌定义
 */
export const COMMON_CARDS: AbilityCard[] = [
    {
        id: 'card-play-six',
        name: cardText('card-play-six', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-play-six', 'description'),
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: '将1颗骰子改为6', action: { type: 'custom', target: 'self', customActionId: 'modify-die-to-6' }, timing: 'immediate' }],
    },
    {
        id: 'card-just-this',
        name: cardText('card-just-this', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('card-just-this', 'description'),
        playCondition: { phase: 'defensiveRoll', requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: '重投至5颗骰子', action: { type: 'custom', target: 'self', customActionId: 'reroll-die-5' }, timing: 'immediate' }],
    },
    {
        id: 'card-give-hand',
        name: cardText('card-give-hand', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-give-hand', 'description'),
        playCondition: {
            requireIsNotRoller: true,
            requireRollConfirmed: true,
            requireHasRolled: true,
            requireOpponentDiceExists: true,
        },
        effects: [{ description: '强制对手重投1颗骰子', action: { type: 'custom', target: 'opponent', customActionId: 'reroll-opponent-die-1' }, timing: 'immediate' }],
    },
    {
        id: 'card-i-can-again',
        name: cardText('card-i-can-again', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-i-can-again', 'description'),
        playCondition: { phase: 'offensiveRoll', requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: '重掷至多5颗骰子', action: { type: 'custom', target: 'self', customActionId: 'reroll-die-5' }, timing: 'immediate' }],
    },
    {
        id: 'card-me-too',
        name: cardText('card-me-too', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-me-too', 'description'),
        playCondition: { requireDiceExists: true, requireHasRolled: true, requireMinDiceCount: 2 },
        effects: [{ description: '将1颗骰子改为另1颗的值', action: { type: 'custom', target: 'self', customActionId: 'modify-die-copy' }, timing: 'immediate' }],
    },
    {
        id: 'card-surprise',
        name: cardText('card-surprise', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-surprise', 'description'),
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: '改变任意1颗骰子的数值', action: { type: 'custom', target: 'select', customActionId: 'modify-die-any-1' }, timing: 'immediate' }],
    },
    {
        id: 'card-worthy-of-me',
        name: cardText('card-worthy-of-me', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-worthy-of-me', 'description'),
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: '重掷至多2颗骰子', action: { type: 'custom', target: 'self', customActionId: 'reroll-die-2' }, timing: 'immediate' }],
    },
    {
        id: 'card-unexpected',
        name: cardText('card-unexpected', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'roll',
        description: cardText('card-unexpected', 'description'),
        playCondition: { requireDiceExists: true, requireHasRolled: true, requireMinDiceCount: 2 },
        effects: [{ description: '改变任意2颗骰子的数值', action: { type: 'custom', target: 'select', customActionId: 'modify-die-any-2' }, timing: 'immediate' }],
    },
    {
        id: 'card-next-time',
        name: cardText('card-next-time', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-next-time', 'description'),
        effects: [{ description: '防止6伤害', action: { type: 'grantDamageShield', target: 'self', value: 6 }, timing: 'immediate' }],
    },
    {
        id: 'card-boss-generous',
        name: cardText('card-boss-generous', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('card-boss-generous', 'description'),
        effects: [{ description: '获得2CP', action: { type: 'custom', target: 'self', customActionId: 'grant-cp-2' }, timing: 'immediate' }],
    },
    {
        id: 'card-flick',
        name: cardText('card-flick', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-flick', 'description'),
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: '增加或减少1骰子数值', action: { type: 'custom', target: 'select', customActionId: 'modify-die-adjust-1' }, timing: 'immediate' }],
    },
    {
        id: 'card-bye-bye',
        name: cardText('card-bye-bye', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: cardText('card-bye-bye', 'description'),
        playCondition: { requireAnyStatusOnBoard: true },
        effects: [{ description: '移除1状态效果', action: { type: 'custom', target: 'self', customActionId: 'remove-status-1' }, timing: 'immediate' }],
    },
    {
        id: 'card-double',
        name: cardText('card-double', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-double', 'description'),
        effects: [{ description: '抽取2张牌', action: { type: 'drawCard', target: 'self', drawCount: 2 }, timing: 'immediate' }],
    },
    {
        id: 'card-super-double',
        name: cardText('card-super-double', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: cardText('card-super-double', 'description'),
        effects: [{ description: '抽取3张牌', action: { type: 'drawCard', target: 'self', drawCount: 3 }, timing: 'immediate' }],
    },
    {
        id: 'card-get-away',
        name: cardText('card-get-away', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-get-away', 'description'),
        playCondition: { requireAnyStatusOnBoard: true },
        effects: [{ description: '移出1名玩家身上1个状态', action: { type: 'custom', target: 'select', customActionId: 'remove-status-1' }, timing: 'immediate' }],
    },
    {
        id: 'card-one-throw-fortune',
        name: cardText('card-one-throw-fortune', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-one-throw-fortune', 'description'),
        effects: [{ description: '投掷1骰获得CP', action: { type: 'custom', target: 'self', customActionId: 'one-throw-fortune-cp' }, timing: 'immediate' }],
    },
    {
        id: 'card-what-status',
        name: cardText('card-what-status', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-what-status', 'description'),
        playCondition: { requireAnyStatusOnBoard: true },
        effects: [{ description: '移除1名玩家所有状态', action: { type: 'custom', target: 'self', customActionId: 'remove-all-status' }, timing: 'immediate' }],
    },
    {
        id: 'card-transfer-status',
        name: cardText('card-transfer-status', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-transfer-status', 'description'),
        playCondition: { requireAnyStatusOnBoard: true },
        effects: [{ description: '转移状态', action: { type: 'custom', target: 'self', customActionId: 'transfer-status' }, timing: 'immediate' }],
    },
];
