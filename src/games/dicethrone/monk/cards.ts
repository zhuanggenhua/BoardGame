/**
 * 僧侣英雄的手牌定义
 * 仅实现前15张中文手牌
 */

import type { AbilityCard } from '../types';
import type { RandomFn } from '../../../engine/types';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

/**
 * 卡牌时机颜色对应
 * - main (蓝色): 仅在 Main Phase 1/2 打出
 * - roll (橙色): 在掷骰阶段打出
 * - instant (红色): 任意时机打出
 */

/**
 * 僧侣手牌定义（前15张）
 * atlasIndex 对应 monk-ability-cards.png 图集中的位置
 */
export const MONK_CARDS: AbilityCard[] = [
    // === 升级卡 (蓝色/main) ===
    {
        id: 'card-upgrade-fist-2',
        name: cardText('card-upgrade-fist-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-upgrade-fist-2', 'description'),
        atlasIndex: 0,
    },
    {
        id: 'card-upgrade-fist-3',
        name: cardText('card-upgrade-fist-3', 'name'),
        type: 'upgrade',
        cpCost: 5,
        timing: 'main',
        description: cardText('card-upgrade-fist-3', 'description'),
        atlasIndex: 1,
    },
    {
        id: 'card-upgrade-harmony-2',
        name: cardText('card-upgrade-harmony-2', 'name'),
        type: 'upgrade',
        cpCost: 4,
        timing: 'main',
        description: cardText('card-upgrade-harmony-2', 'description'),
        atlasIndex: 2,
    },
    {
        id: 'card-upgrade-lotus-2',
        name: cardText('card-upgrade-lotus-2', 'name'),
        type: 'upgrade',
        cpCost: 4,
        timing: 'main',
        description: cardText('card-upgrade-lotus-2', 'description'),
        atlasIndex: 3,
    },

    // === 技能卡 (橙色/roll) ===
    {
        id: 'card-chi-burst',
        name: cardText('card-chi-burst', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-chi-burst', 'description'),
        atlasIndex: 4,
    },
    {
        id: 'card-reroll',
        name: cardText('card-reroll', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-reroll', 'description'),
        atlasIndex: 5,
    },
    {
        id: 'card-focus',
        name: cardText('card-focus', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-focus', 'description'),
        atlasIndex: 6,
    },
    {
        id: 'card-inner-peace',
        name: cardText('card-inner-peace', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('card-inner-peace', 'description'),
        atlasIndex: 7,
    },
    {
        id: 'card-swift-strike',
        name: cardText('card-swift-strike', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-swift-strike', 'description'),
        atlasIndex: 8,
    },

    // === 瞬发卡 (红色/instant) ===
    {
        id: 'card-dodge',
        name: cardText('card-dodge', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('card-dodge', 'description'),
        atlasIndex: 9,
    },
    {
        id: 'card-counterattack',
        name: cardText('card-counterattack', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: cardText('card-counterattack', 'description'),
        atlasIndex: 10,
    },
    {
        id: 'card-purify',
        name: cardText('card-purify', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-purify', 'description'),
        atlasIndex: 11,
    },
    {
        id: 'card-iron-will',
        name: cardText('card-iron-will', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'instant',
        description: cardText('card-iron-will', 'description'),
        atlasIndex: 12,
    },
    {
        id: 'card-meditation',
        name: cardText('card-meditation', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('card-meditation', 'description'),
        atlasIndex: 13,
    },
    {
        id: 'card-chi-shield',
        name: cardText('card-chi-shield', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: cardText('card-chi-shield', 'description'),
        atlasIndex: 14,
    },
];

/**
 * 获取僧侣初始牌库
 * 返回洗牌后的卡牌副本
 * @param random 引擎层随机数生成器（确保回放确定性）
 */
export const getMonkStartingDeck = (random: RandomFn): AbilityCard[] => {
    // 复制所有卡牌
    const deck = MONK_CARDS.map(card => ({ ...card }));
    // 使用引擎层的确定性洗牌
    return random.shuffle(deck);
};

/**
 * 根据 atlasIndex 获取图集裁切坐标
 * 图集单卡尺寸: 328×529
 */
export const getCardAtlasPosition = (atlasIndex: number): { x: number; y: number; width: number; height: number } => {
    const CARD_WIDTH = 328;
    const CARD_HEIGHT = 529;
    const CARDS_PER_ROW = 5; // 假设每行5张

    const col = atlasIndex % CARDS_PER_ROW;
    const row = Math.floor(atlasIndex / CARDS_PER_ROW);

    return {
        x: col * CARD_WIDTH,
        y: row * CARD_HEIGHT,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
    };
};
