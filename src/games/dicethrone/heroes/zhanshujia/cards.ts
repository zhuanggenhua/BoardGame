import type { RandomFn } from '../../../../engine/types';
import type { CardPreviewRef } from '../../../../core';
import { COMMON_CARDS, injectCommonCardPreviewRefs, type CommonCardAtlasIndexMap } from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS, STATUS_IDS, TOKEN_IDS, ZHANSHUJIA_DICE_FACE_IDS } from '../../domain/ids';
import type { AbilityCard } from '../../types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { abilityEffectText } from '../../../../engine/primitives/ability';
import {
    CARPET_BOMBING_2,
    COUNTERMEASURES_2,
    COUNTERMEASURES_3,
    DRUM_MOVEMENT_2,
    EXPAND_BATTLEFIELD_2,
    FLANKING_2,
    SABRE_THRUST_2,
    STRATEGIC_SHIFT_2,
    WAR_MONGER_2,
    ZHANSHUJIA_SFX_COMMAND,
    ZHANSHUJIA_SFX_HEAVY,
    ZHANSHUJIA_SFX_LIGHT,
    ZHANSHUJIA_SFX_ULTIMATE,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

const ZHANSHUJIA_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.ZHANSHUJIA;

const atlasPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: ZHANSHUJIA_CARD_ATLAS_ID,
    index,
});

const replaceAbility = (
    targetAbilityId: string,
    newAbilityDef: AbilityDef,
    newAbilityLevel: number,
    description: string,
): AbilityEffect => ({
    description,
    action: { type: 'replaceAbility', target: 'self', targetAbilityId, newAbilityDef, newAbilityLevel },
    timing: 'immediate',
});

const ZHANSHUJIA_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
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

const ZHANSHUJIA_HERO_CARDS: AbilityCard[] = [
    {
        id: 'card-zhanshujia-gain-the-upper-hand',
        name: cardText('card-zhanshujia-gain-the-upper-hand', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-zhanshujia-gain-the-upper-hand', 'description'),
        sfxKey: ZHANSHUJIA_SFX_COMMAND,
        previewRef: atlasPreview(17),
        sourceAtlasIndex: 17,
        effects: [{
            description: abilityEffectText('card-zhanshujia-gain-the-upper-hand', 'roll'),
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 1,
                conditionalEffects: [{
                    face: ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
                    grantToken: { tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, value: 4 },
                    effectKey: 'bonusDie.effect.zhanshujiaGainUpperHandMedal',
                }],
                defaultEffect: { drawCard: 1, effectKey: 'bonusDie.effect.zhanshujiaGainUpperHandOther' },
            },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-zhanshujia-ambush',
        name: cardText('card-zhanshujia-ambush', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-zhanshujia-ambush', 'description'),
        sfxKey: ZHANSHUJIA_SFX_LIGHT,
        previewRef: atlasPreview(18),
        sourceAtlasIndex: 18,
        effects: [{
            description: abilityEffectText('card-zhanshujia-ambush', 'gainTa2'),
            action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, value: 2 },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-zhanshujia-disengage',
        name: cardText('card-zhanshujia-disengage', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('card-zhanshujia-disengage', 'description'),
        sfxKey: ZHANSHUJIA_SFX_COMMAND,
        previewRef: atlasPreview(19),
        sourceAtlasIndex: 19,
        playCondition: { phase: 'defensiveRoll', requireIsRoller: true },
        effects: [{
            description: abilityEffectText('card-zhanshujia-disengage', 'roll'),
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 1,
                conditionalEffects: [
                    { face: ZHANSHUJIA_DICE_FACE_IDS.SABRE, bonusDamage: 2, effectKey: 'bonusDie.effect.zhanshujiaDisengageSabre' },
                    { face: ZHANSHUJIA_DICE_FACE_IDS.BANNER, grantDamageShield: { value: 3 }, effectKey: 'bonusDie.effect.zhanshujiaDisengageBanner' },
                    { face: ZHANSHUJIA_DICE_FACE_IDS.MEDAL, grantToken: { tokenId: TOKEN_IDS.PROTECT, value: 1 }, effectKey: 'bonusDie.effect.zhanshujiaDisengageMedal' },
                ],
            },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-zhanshujia-tactical-retreat',
        name: cardText('card-zhanshujia-tactical-retreat', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: cardText('card-zhanshujia-tactical-retreat', 'description'),
        sfxKey: ZHANSHUJIA_SFX_COMMAND,
        previewRef: atlasPreview(20),
        sourceAtlasIndex: 20,
        playCondition: { phase: 'defensiveRoll', requireIsRoller: true },
        effects: [
            {
                description: abilityEffectText('card-zhanshujia-tactical-retreat', 'inflictBind'),
                action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.BIND, value: 1 },
                timing: 'immediate',
            },
            {
                description: abilityEffectText('card-zhanshujia-tactical-retreat', 'prevent3'),
                action: { type: 'grantDamageShield', target: 'self', shieldValue: 3 },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-zhanshujia-war-room',
        name: cardText('card-zhanshujia-war-room', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-zhanshujia-war-room', 'description'),
        sfxKey: ZHANSHUJIA_SFX_COMMAND,
        previewRef: atlasPreview(21),
        sourceAtlasIndex: 21,
        effects: [{
            description: abilityEffectText('card-zhanshujia-war-room', 'roll'),
            action: { type: 'custom', target: 'self', customActionId: 'zhanshujia-war-room-roll' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-zhanshujia-strategic-defense',
        name: cardText('card-zhanshujia-strategic-defense', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-zhanshujia-strategic-defense', 'description'),
        sfxKey: ZHANSHUJIA_SFX_HEAVY,
        previewRef: atlasPreview(22),
        sourceAtlasIndex: 22,
        effects: [{
            description: abilityEffectText('card-zhanshujia-strategic-defense', 'choosePlayer'),
            action: { type: 'custom', target: 'self', customActionId: 'zhanshujia-strategic-defense-select-player' },
            timing: 'immediate',
        }],
    },
    {
        id: 'upgrade-zhanshujia-countermeasures-3',
        name: cardText('upgrade-zhanshujia-countermeasures-3', 'name'),
        type: 'upgrade',
        cpCost: 5,
        timing: 'main',
        description: cardText('upgrade-zhanshujia-countermeasures-3', 'description'),
        sfxKey: ZHANSHUJIA_SFX_COMMAND,
        previewRef: atlasPreview(23),
        sourceAtlasIndex: 23,
        effects: [replaceAbility('countermeasures', COUNTERMEASURES_3, 3, abilityEffectText('upgrade-zhanshujia-countermeasures-3', 'upgrade'))],
    },
    {
        id: 'upgrade-zhanshujia-countermeasures-2',
        name: cardText('upgrade-zhanshujia-countermeasures-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-zhanshujia-countermeasures-2', 'description'),
        sfxKey: ZHANSHUJIA_SFX_COMMAND,
        previewRef: atlasPreview(24),
        sourceAtlasIndex: 24,
        effects: [replaceAbility('countermeasures', COUNTERMEASURES_2, 2, abilityEffectText('upgrade-zhanshujia-countermeasures-2', 'upgrade'))],
    },
    {
        id: 'upgrade-zhanshujia-strategic-shift-2',
        name: cardText('upgrade-zhanshujia-strategic-shift-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-zhanshujia-strategic-shift-2', 'description'),
        sfxKey: ZHANSHUJIA_SFX_COMMAND,
        previewRef: atlasPreview(25),
        sourceAtlasIndex: 25,
        effects: [replaceAbility('strategic-shift', STRATEGIC_SHIFT_2, 2, abilityEffectText('upgrade-zhanshujia-strategic-shift-2', 'upgrade'))],
    },
    {
        id: 'upgrade-zhanshujia-expand-battlefield-2',
        name: cardText('upgrade-zhanshujia-expand-battlefield-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-zhanshujia-expand-battlefield-2', 'description'),
        sfxKey: ZHANSHUJIA_SFX_COMMAND,
        previewRef: atlasPreview(26),
        sourceAtlasIndex: 26,
        effects: [replaceAbility('expand-battlefield', EXPAND_BATTLEFIELD_2, 2, abilityEffectText('upgrade-zhanshujia-expand-battlefield-2', 'upgrade'))],
    },
    {
        id: 'upgrade-zhanshujia-flanking-2',
        name: cardText('upgrade-zhanshujia-flanking-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-zhanshujia-flanking-2', 'description'),
        sfxKey: ZHANSHUJIA_SFX_LIGHT,
        previewRef: atlasPreview(27),
        sourceAtlasIndex: 27,
        effects: [replaceAbility('flanking', FLANKING_2, 2, abilityEffectText('upgrade-zhanshujia-flanking-2', 'upgrade'))],
    },
    {
        id: 'upgrade-zhanshujia-drum-movement-2',
        name: cardText('upgrade-zhanshujia-drum-movement-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-zhanshujia-drum-movement-2', 'description'),
        sfxKey: ZHANSHUJIA_SFX_HEAVY,
        previewRef: atlasPreview(28),
        sourceAtlasIndex: 28,
        effects: [replaceAbility('drum-movement', DRUM_MOVEMENT_2, 2, abilityEffectText('upgrade-zhanshujia-drum-movement-2', 'upgrade'))],
    },
    {
        id: 'upgrade-zhanshujia-carpet-bombing-2',
        name: cardText('upgrade-zhanshujia-carpet-bombing-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-zhanshujia-carpet-bombing-2', 'description'),
        sfxKey: ZHANSHUJIA_SFX_ULTIMATE,
        previewRef: atlasPreview(29),
        sourceAtlasIndex: 29,
        effects: [replaceAbility('carpet-bombing', CARPET_BOMBING_2, 2, abilityEffectText('upgrade-zhanshujia-carpet-bombing-2', 'upgrade'))],
    },
    {
        id: 'upgrade-zhanshujia-war-monger-2',
        name: cardText('upgrade-zhanshujia-war-monger-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-zhanshujia-war-monger-2', 'description'),
        previewRef: atlasPreview(30),
        sourceAtlasIndex: 30,
        effects: [replaceAbility('war-monger', WAR_MONGER_2, 2, abilityEffectText('upgrade-zhanshujia-war-monger-2', 'upgrade'))],
    },
    {
        id: 'upgrade-zhanshujia-sabre-thrust-2',
        name: cardText('upgrade-zhanshujia-sabre-thrust-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-zhanshujia-sabre-thrust-2', 'description'),
        previewRef: atlasPreview(31),
        sourceAtlasIndex: 31,
        effects: [replaceAbility('sabre-thrust', SABRE_THRUST_2, 2, abilityEffectText('upgrade-zhanshujia-sabre-thrust-2', 'upgrade'))],
    },
];

export const ZHANSHUJIA_CARDS: AbilityCard[] = [
    ...ZHANSHUJIA_HERO_CARDS,
    ...injectCommonCardPreviewRefs(
        COMMON_CARDS,
        DICETHRONE_CARD_ATLAS_IDS.ZHANSHUJIA,
        ZHANSHUJIA_COMMON_ATLAS_INDEX,
    ),
];

export const getZhanshujiaStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck = ZHANSHUJIA_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
