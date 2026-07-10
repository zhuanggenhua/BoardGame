import type { AbilityCard } from '../types';
import type { CardPreviewRef } from '../../../core';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;
const cardEffectText = (id: string, effectKey: string) => `cards.${id}.effects.${effectKey}`;

export type CommonCardAtlasIndexMap = Record<string, number>;

/**
 * 通用卡默认图集位置（旧角色沿用的 atlas 顺序）
 */
export const DEFAULT_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
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
 * 武士通用卡顺序与枪手相同，按 `ability-cards.webp` 前两行真实顺序反向映射。
 */
export const SAMURAI_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
    'card-play-six': 17,
    'card-just-this': 16,
    'card-give-hand': 15,
    'card-i-can-again': 14,
    'card-me-too': 13,
    'card-surprise': 12,
    'card-worthy-of-me': 11,
    'card-unexpected': 10,
    'card-next-time': 9,
    'card-boss-generous': 8,
    'card-flick': 7,
    'card-bye-bye': 6,
    'card-double': 5,
    'card-super-double': 4,
    'card-get-away': 3,
    'card-one-throw-fortune': 2,
    'card-what-status': 1,
    'card-transfer-status': 0,
};

/**
 * 枪手通用卡顺序和旧角色不同，且与 COMMON_CARDS 定义顺序完全相反。
 */
export const GUNSLINGER_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
    'card-play-six': 17,
    'card-just-this': 16,
    'card-give-hand': 15,
    'card-i-can-again': 14,
    'card-me-too': 13,
    'card-surprise': 12,
    'card-worthy-of-me': 11,
    'card-unexpected': 10,
    'card-next-time': 9,
    'card-boss-generous': 8,
    'card-flick': 7,
    'card-bye-bye': 6,
    'card-double': 5,
    'card-super-double': 4,
    'card-get-away': 3,
    'card-one-throw-fortune': 2,
    'card-what-status': 1,
    'card-transfer-status': 0,
};

/**
 * 树精 / 忍者新规格图集：通用卡分布在前 17 格与末行 slot-32。
 * 该顺序来自 900x2048 正式运行时图集逐格核对；不能套旧角色默认映射。
 */
export const TREANT_NINJA_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
    'card-next-time': 0,
    'card-i-can-again': 1,
    'card-me-too': 2,
    'card-what-status': 3,
    'card-give-hand': 4,
    'card-transfer-status': 5,
    'card-worthy-of-me': 6,
    'card-one-throw-fortune': 7,
    'card-play-six': 8,
    'card-just-this': 9,
    'card-surprise': 10,
    'card-get-away': 11,
    'card-boss-generous': 12,
    'card-double': 13,
    'card-bye-bye': 14,
    'card-flick': 15,
    'card-super-double': 16,
    'card-unexpected': 32,
};

/**
 * 为通用卡注入 previewRef（指向指定英雄的图集）
 * 在各英雄 cards.ts 中 spread COMMON_CARDS 时调用
 */
export const injectCommonCardPreviewRefs = (
    cards: AbilityCard[],
    atlasId: string,
    indexMap: CommonCardAtlasIndexMap = DEFAULT_COMMON_ATLAS_INDEX,
): AbilityCard[] =>
    cards.map(card => {
        const index = indexMap[card.id];
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
        playCondition: { requireIsRoller: true, requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: cardEffectText('card-play-six', 'modifyDieTo6'), action: { type: 'custom', target: 'self', customActionId: 'modify-die-to-6' }, timing: 'immediate' }],
    },
    {
        id: 'card-just-this',
        name: cardText('card-just-this', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('card-just-this', 'description'),
        playCondition: { phase: 'defensiveRoll', requireIsRoller: true, requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: cardEffectText('card-just-this', 'rerollUpTo5Dice'), action: { type: 'custom', target: 'self', customActionId: 'reroll-die-5' }, timing: 'immediate' }],
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
        effects: [{ description: cardEffectText('card-give-hand', 'forceOpponentReroll1Die'), action: { type: 'custom', target: 'opponent', customActionId: 'reroll-opponent-die-1' }, timing: 'immediate' }],
    },
    {
        id: 'card-i-can-again',
        name: cardText('card-i-can-again', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-i-can-again', 'description'),
        playCondition: { requireIsRoller: true, requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: cardEffectText('card-i-can-again', 'rerollUpTo5Dice'), action: { type: 'custom', target: 'self', customActionId: 'reroll-die-5' }, timing: 'immediate' }],
    },
    {
        id: 'card-me-too',
        name: cardText('card-me-too', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-me-too', 'description'),
        playCondition: { requireIsRoller: true, requireDiceExists: true, requireHasRolled: true, requireMinDiceCount: 2 },
        effects: [{ description: cardEffectText('card-me-too', 'copyOneDieValue'), action: { type: 'custom', target: 'self', customActionId: 'modify-die-copy' }, timing: 'immediate' }],
    },
    {
        id: 'card-surprise',
        name: cardText('card-surprise', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-surprise', 'description'),
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: cardEffectText('card-surprise', 'modifyAny1Die'), action: { type: 'custom', target: 'select', customActionId: 'modify-die-any-1' }, timing: 'immediate' }],
    },
    {
        id: 'card-worthy-of-me',
        name: cardText('card-worthy-of-me', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-worthy-of-me', 'description'),
        playCondition: { requireIsRoller: true, requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: cardEffectText('card-worthy-of-me', 'rerollUpTo2Dice'), action: { type: 'custom', target: 'self', customActionId: 'reroll-die-2' }, timing: 'immediate' }],
    },
    {
        id: 'card-unexpected',
        name: cardText('card-unexpected', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'roll',
        description: cardText('card-unexpected', 'description'),
        playCondition: { requireDiceExists: true, requireHasRolled: true, requireMinDiceCount: 2 },
        effects: [{ description: cardEffectText('card-unexpected', 'modifyAny2Dice'), action: { type: 'custom', target: 'select', customActionId: 'modify-die-any-2' }, timing: 'immediate' }],
    },
    {
        id: 'card-next-time',
        name: cardText('card-next-time', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-next-time', 'description'),
        playCondition: {
            pendingDamage: {
                role: 'target',
                responseType: 'beforeDamageReceived',
            },
        },
        effects: [{ description: cardEffectText('card-next-time', 'prevent6Damage'), action: { type: 'grantDamageShield', target: 'self', value: 6 }, timing: 'immediate' }],
    },
    {
        id: 'card-boss-generous',
        name: cardText('card-boss-generous', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('card-boss-generous', 'description'),
        effects: [{ description: cardEffectText('card-boss-generous', 'gain2CP'), action: { type: 'custom', target: 'self', customActionId: 'grant-cp-2' }, timing: 'immediate' }],
    },
    {
        id: 'card-flick',
        name: cardText('card-flick', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-flick', 'description'),
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: cardEffectText('card-flick', 'adjust1DieBy1'), action: { type: 'custom', target: 'select', customActionId: 'modify-die-adjust-1' }, timing: 'immediate' }],
    },
    {
        id: 'card-bye-bye',
        name: cardText('card-bye-bye', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: cardText('card-bye-bye', 'description'),
        playCondition: { requireAnyStatusOnBoard: true },
        effects: [{ description: cardEffectText('card-bye-bye', 'remove1Status'), action: { type: 'custom', target: 'self', customActionId: 'remove-status-1' }, timing: 'immediate' }],
    },
    {
        id: 'card-double',
        name: cardText('card-double', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-double', 'description'),
        effects: [{ description: cardEffectText('card-double', 'draw2Cards'), action: { type: 'drawCard', target: 'self', drawCount: 2 }, timing: 'immediate' }],
    },
    {
        id: 'card-super-double',
        name: cardText('card-super-double', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: cardText('card-super-double', 'description'),
        effects: [{ description: cardEffectText('card-super-double', 'draw3Cards'), action: { type: 'drawCard', target: 'self', drawCount: 3 }, timing: 'immediate' }],
    },
    {
        id: 'card-get-away',
        name: cardText('card-get-away', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-get-away', 'description'),
        playCondition: { requireAnyStatusOnBoard: true },
        effects: [{ description: cardEffectText('card-get-away', 'remove1StatusFromAPlayer'), action: { type: 'custom', target: 'select', customActionId: 'remove-status-1' }, timing: 'immediate' }],
    },
    {
        id: 'card-one-throw-fortune',
        name: cardText('card-one-throw-fortune', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-one-throw-fortune', 'description'),
        effects: [{ description: cardEffectText('card-one-throw-fortune', 'roll1DieGainCP'), action: { type: 'custom', target: 'self', customActionId: 'one-throw-fortune-cp' }, timing: 'immediate' }],
    },
    {
        id: 'card-what-status',
        name: cardText('card-what-status', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-what-status', 'description'),
        playCondition: { requireAnyStatusOnBoard: true },
        effects: [{ description: cardEffectText('card-what-status', 'removeAllStatusesFrom1Player'), action: { type: 'custom', target: 'self', customActionId: 'remove-all-status' }, timing: 'immediate' }],
    },
    {
        id: 'card-transfer-status',
        name: cardText('card-transfer-status', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-transfer-status', 'description'),
        playCondition: { requireAnyStatusOnBoard: true },
        effects: [{ description: cardEffectText('card-transfer-status', 'transferStatuses'), action: { type: 'custom', target: 'self', customActionId: 'transfer-status' }, timing: 'immediate' }],
    },
];
