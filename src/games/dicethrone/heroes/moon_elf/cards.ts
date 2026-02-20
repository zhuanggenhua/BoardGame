/**
 * Moon Elf 英雄的手牌定义
 */
import type { AbilityCard } from '../../types';
import { DICETHRONE_CARD_ATLAS_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';
import { COMMON_CARDS, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityEffect, AbilityDef } from '../../domain/combat';
import {
    LONGBOW_2, LONGBOW_3, COVERT_FIRE_2, COVERING_FIRE_2,
    EXPLODING_ARROW_2, EXPLODING_ARROW_3, ENTANGLING_SHOT_2,
    ECLIPSE_2, BLINDING_SHOT_2, ELUSIVE_STEP_2
} from './abilities';

// Helper for card text
const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

const grantToken = (tokenId: string, value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value },
    timing: 'immediate'
});

const inflictStatus = (statusId: string, value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
    timing: 'immediate'
});

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

// ==========================================================
// Card Definitions
// ==========================================================

export const MOON_ELF_CARDS: AbilityCard[] = [
    // Action Cards (0-4)
    {
        id: 'moon-shadow-strike',
        name: cardText('moon-shadow-strike', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('moon-shadow-strike', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 0 },
        effects: [{ description: 'Effect', action: { type: 'custom', target: 'opponent', customActionId: 'moon_elf-action-moon-shadow-strike' }, timing: 'immediate' }]
    },
    {
        id: 'dodge',
        name: cardText('dodge', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('dodge', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 1 },
        effects: [{ description: 'Gain Evasive', action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.EVASIVE, value: 1 }, timing: 'immediate' }]
    },
    {
        id: 'volley',
        name: cardText('volley', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('volley', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 2 },
        isAttackModifier: true,
        effects: [{ description: 'Effect', action: { type: 'custom', target: 'self', customActionId: 'moon_elf-action-volley' }, timing: 'immediate' }]
    },
    {
        id: 'watch-out',
        name: cardText('watch-out', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('watch-out', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 3 },
        isAttackModifier: true,
        effects: [{ description: 'Effect', action: { type: 'custom', target: 'self', customActionId: 'moon_elf-action-watch-out' }, timing: 'immediate' }]
    },
    {
        id: 'moonlight-magic',
        name: cardText('moonlight-magic', 'name'),
        type: 'action',
        cpCost: 4,
        timing: 'main',
        description: cardText('moonlight-magic', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 4 },
        effects: [
            grantToken(TOKEN_IDS.EVASIVE, 1, 'Gain Evasive'),
            inflictStatus(STATUS_IDS.BLINDED, 1, 'Inflict Blinded'),
            inflictStatus(STATUS_IDS.ENTANGLE, 1, 'Inflict Entangle'),
            inflictStatus(STATUS_IDS.TARGETED, 1, 'Inflict Targeted'),
        ]
    },

    // Upgrade Cards (5-14)
    {
        id: 'upgrade-elusive-step-2',
        name: cardText('upgrade-elusive-step-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-elusive-step-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 5 },
        effects: [replaceAbility('elusive-step', ELUSIVE_STEP_2, 2, 'Upgrade Elusive Step to II')],
    },
    {
        id: 'upgrade-eclipse-2',
        name: cardText('upgrade-eclipse-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-eclipse-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 6 },
        effects: [replaceAbility('eclipse', ECLIPSE_2, 2, 'Upgrade Eclipse to II')],
    },
    {
        id: 'upgrade-blinding-shot-2',
        name: cardText('upgrade-blinding-shot-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-blinding-shot-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 7 },
        effects: [replaceAbility('blinding-shot', BLINDING_SHOT_2, 2, 'Upgrade Blinding Shot to II')],
    },
    {
        id: 'upgrade-entangling-shot-2',
        name: cardText('upgrade-entangling-shot-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-entangling-shot-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 8 },
        effects: [replaceAbility('entangling-shot', ENTANGLING_SHOT_2, 2, 'Upgrade Entangling Shot to II')],
    },
    {
        id: 'upgrade-exploding-arrow-3',
        name: cardText('upgrade-exploding-arrow-3', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-exploding-arrow-3', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 9 },
        effects: [replaceAbility('exploding-arrow', EXPLODING_ARROW_3, 3, 'Upgrade Exploding Arrow to III')],
    },
    {
        id: 'upgrade-exploding-arrow-2',
        name: cardText('upgrade-exploding-arrow-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-exploding-arrow-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 10 },
        effects: [replaceAbility('exploding-arrow', EXPLODING_ARROW_2, 2, 'Upgrade Exploding Arrow to II')],
    },
    {
        id: 'upgrade-covering-fire-2',
        name: cardText('upgrade-covering-fire-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-covering-fire-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 11 },
        effects: [replaceAbility('covering-fire', COVERING_FIRE_2, 2, 'Upgrade Covering Fire to II')],
    },
    {
        id: 'upgrade-deadeye-shot-2',
        name: cardText('upgrade-deadeye-shot-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-deadeye-shot-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 12 },
        effects: [replaceAbility('covert-fire', COVERT_FIRE_2, 2, 'Upgrade Covert Fire to II')],
    },
    {
        id: 'upgrade-longbow-3',
        name: cardText('upgrade-longbow-3', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-longbow-3', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 13 },
        effects: [replaceAbility('longbow', LONGBOW_3, 3, 'Upgrade Longbow to III')],
    },
    {
        id: 'upgrade-longbow-2',
        name: cardText('upgrade-longbow-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-longbow-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 14 },
        effects: [replaceAbility('longbow', LONGBOW_2, 2, 'Upgrade Longbow to II')],
    },

    // 注入通用卡牌
    ...injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.MOON_ELF),
];

export const getMoonElfStartingDeck = (random: RandomFn): AbilityCard[] => {
    // 每张卡牌只放 1 份，共 33 张（规则标准）
    const deck = MOON_ELF_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
