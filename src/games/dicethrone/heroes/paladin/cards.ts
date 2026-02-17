/**
 * 圣骑士英雄的手牌定义
 */

import type { AbilityCard } from '../../types';
import type { AbilityEffect } from '../../domain/combat';
import { DICETHRONE_CARD_ATLAS_IDS, TOKEN_IDS, PALADIN_DICE_FACE_IDS as PALADIN_FACES } from '../../domain/ids';
import { COMMON_CARDS, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import type { RandomFn } from '../../../../engine/types';
import {
    HOLY_DEFENSE_2, HOLY_DEFENSE_3,
    HOLY_LIGHT_2,
    RIGHTEOUS_COMBAT_2, RIGHTEOUS_COMBAT_3,
    BLESSING_OF_MIGHT_2,
    VENGEANCE_2,
    RIGHTEOUS_PRAYER_2,
    HOLY_STRIKE_2
} from './abilities';
import type { AbilityDef } from '../../domain/combat';

// 文本辅助
const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

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

// Custom card actions
const grantToken = (
    tokenId: string,
    value: number,
    description: string,
    opts?: { target?: 'self' | 'opponent' }
): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: opts?.target ?? 'self', tokenId, value },
    timing: 'immediate',
});

export const PALADIN_CARDS: AbilityCard[] = [
    // Action Cards
    {
        id: 'card-might',
        name: cardText('card-might', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-might', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 1 },
        effects: [grantToken(TOKEN_IDS.CRIT, 1, '1名玩家获得暴击')]
    },
    {
        id: 'card-consecrate',
        name: cardText('card-consecrate', 'name'),
        type: 'action',
        cpCost: 4,
        timing: 'main',
        description: cardText('card-consecrate', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 2 },
        effects: [{
            description: '选择1名玩家获得守护、弹反、暴击和精准',
            action: { type: 'custom', target: 'self', customActionId: 'paladin-consecrate' },
            timing: 'immediate'
        }]
    },
    {
        id: 'card-divine-favor',
        name: cardText('card-divine-favor', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-divine-favor', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 3 },
        effects: [{
            description: '投掷1骰：剑-抽2; 头盔-治愈3; 心-治愈4; 祈祷-3CP',
            action: {
                type: 'rollDie', target: 'self', diceCount: 1,
                conditionalEffects: [
                    { face: PALADIN_FACES.SWORD, drawCard: 2, effectKey: 'bonusDie.effect.divineFavor.sword' },
                    { face: PALADIN_FACES.HELM, heal: 3, effectKey: 'bonusDie.effect.divineFavor.helm' },
                    { face: PALADIN_FACES.HEART, heal: 4, effectKey: 'bonusDie.effect.divineFavor.heart' },
                    { face: PALADIN_FACES.PRAY, cp: 3, effectKey: 'bonusDie.effect.divineFavor.pray' },
                ],
            },
            timing: 'immediate'
        }]
    },
    {
        id: 'card-absolution',
        name: cardText('card-absolution', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-absolution', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 4 },
        effects: [{
            description: '被攻击后投掷1骰防御',
            action: {
                type: 'rollDie', target: 'self', diceCount: 1,
                conditionalEffects: [
                    { face: PALADIN_FACES.SWORD, bonusDamage: 3, effectKey: 'bonusDie.effect.absolution.sword' },
                    { face: PALADIN_FACES.HELM, grantDamageShield: { value: 3 }, effectKey: 'bonusDie.effect.absolution.helm' },
                    { face: PALADIN_FACES.HEART, grantDamageShield: { value: 5 }, effectKey: 'bonusDie.effect.absolution.heart' },
                    { face: PALADIN_FACES.PRAY, grantDamageShield: { value: 2 }, cp: 2, effectKey: 'bonusDie.effect.absolution.pray' },
                ],
            },
            timing: 'immediate'
        }]
    },
    // Promo: God's Grace
    {
        id: 'card-gods-grace',
        name: cardText('card-gods-grace', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-gods-grace', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 11 },
        effects: [{
            description: '投掷1骰：祈祷-4CP; 否则-抽1',
            action: {
                type: 'rollDie', target: 'self', diceCount: 1,
                conditionalEffects: [
                    { face: PALADIN_FACES.PRAY, cp: 4, effectKey: 'bonusDie.effect.godsGrace.pray' },
                ],
                defaultEffect: { drawCard: 1 },
            },
            timing: 'immediate'
        }]
    },

    // Upgrade Cards
    {
        id: 'card-holy-defense-3',
        name: cardText('card-holy-defense-3', 'name'),
        type: 'upgrade',
        cpCost: 4,
        timing: 'main',
        description: cardText('card-holy-defense-3', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 0 },
        effects: [replaceAbility('holy-defense', HOLY_DEFENSE_3, 3, '升级神圣防御至 III 级')]
    },
    {
        id: 'card-holy-defense-2',
        name: cardText('card-holy-defense-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-holy-defense-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 5 },
        effects: [replaceAbility('holy-defense', HOLY_DEFENSE_2, 2, '升级神圣防御至 II 级')]
    },
    {
        id: 'card-holy-light-2',
        name: cardText('card-holy-light-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-holy-light-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 7 },
        effects: [replaceAbility('holy-light', HOLY_LIGHT_2, 2, '升级圣光至 II 级')]
    },
    {
        id: 'card-righteous-combat-3',
        name: cardText('card-righteous-combat-3', 'name'),
        type: 'upgrade',
        cpCost: 4,
        timing: 'main',
        description: cardText('card-righteous-combat-3', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 8 },
        effects: [replaceAbility('righteous-combat', RIGHTEOUS_COMBAT_3, 3, '升级正义战法至 III 级')]
    },
    {
        id: 'card-righteous-combat-2',
        name: cardText('card-righteous-combat-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-righteous-combat-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 10 },
        effects: [replaceAbility('righteous-combat', RIGHTEOUS_COMBAT_2, 2, '升级正义战法至 II 级')]
    },
    {
        id: 'card-blessing-of-might-2',
        name: cardText('card-blessing-of-might-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-blessing-of-might-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 9 },
        effects: [replaceAbility('blessing-of-might', BLESSING_OF_MIGHT_2, 2, '升级力量祝福至 II 级')]
    },
    {
        id: 'card-holy-strike-2',
        name: cardText('card-holy-strike-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-holy-strike-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 13 },
        effects: [replaceAbility('holy-strike', HOLY_STRIKE_2, 2, '升级神圣攻击至 II 级')]
    },
    {
        id: 'card-vengeance-2',
        name: cardText('card-vengeance-2', 'name'),
        type: 'upgrade',
        cpCost: 1, // Cheap upgrade
        timing: 'main',
        description: cardText('card-vengeance-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 12 },
        effects: [replaceAbility('vengeance', VENGEANCE_2, 2, '升级复仇至 II 级')]
    },
    {
        id: 'card-righteous-prayer-2',
        name: cardText('card-righteous-prayer-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-righteous-prayer-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 14 },
        effects: [replaceAbility('righteous-prayer', RIGHTEOUS_PRAYER_2, 2, '升级正义祷告至 II 级')]
    },
    {
        id: 'card-tithes-2',
        name: cardText('card-tithes-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-tithes-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.PALADIN, index: 6 },
        effects: [{
            description: '升级教会税',
            action: { type: 'custom', target: 'self', customActionId: 'paladin-upgrade-tithes' },
            timing: 'immediate'
        }]
    },

    // 注入通用卡牌
    ...injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.PALADIN),
];

export const getPaladinStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck: AbilityCard[] = [];
    PALADIN_CARDS.forEach(card => {
        if (card.type === 'upgrade') {
            deck.push({ ...card });
        } else {
            deck.push({ ...card });
            deck.push({ ...card });
        }
    });
    return random.shuffle(deck);
};

export default PALADIN_CARDS;
