/** 女猎手卡牌定义。提示卡只作为规则真相源记录，不在这里创建运行时卡牌。 */

import type { CardPreviewRef } from '../../../../core';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityCard } from '../../types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { COMMON_CARDS, TREANT_NINJA_COMMON_ATLAS_INDEX, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS, LIEREN_DICE_FACE_IDS as FACE, STATUS_IDS } from '../../domain/ids';
import {
    BEAST_FORCE_2,
    BEAST_INSTINCT_2,
    BRUTAL_STRIKE_2,
    HUNT_AMBUSH_2,
    KINDRED_BOND_2,
    KINDRED_BOND_3,
    LIFE_REVIVAL_2,
    LIEREN_SFX_HEAVY,
    LIEREN_SFX_LIGHT,
    SAVAGE_FORCE_2,
    WILD_FORCE_2,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;
const LIEREN_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.LIEREN;

const atlasPreview = (index: number): CardPreviewRef => ({ type: 'atlas', atlasId: LIEREN_CARD_ATLAS_ID, index });

const lierenCardRef = (index: number) => ({
    previewRef: atlasPreview(index),
    sourceAtlasIndex: index,
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

const nyraEffect = (description: string, effect: 'heal' | 'grant-bond' | 'grant-bond-and-heal', amount = 0): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target: 'self',
        customActionId: 'lieren-nyra-effect',
        params: { effect, amount },
    },
    timing: 'immediate',
});

const primitiveRoarRoll = (cardId: string): AbilityEffect => ({
    description: cardText(cardId, 'description'),
    action: {
        type: 'rollDie',
        target: 'opponent',
        diceCount: 1,
        conditionalEffects: [
            { face: FACE.SABERTOOTH, companionHeal: 4, effectKey: 'bonusDie.effect.lieren.primitiveRoar.sabertooth' },
        ],
        defaultEffect: { drawCard: 1, effectKey: 'bonusDie.effect.lieren.primitiveRoar.default' },
    },
    timing: 'immediate',
});

const opportunisticStrikeRoll = (cardId: string): AbilityEffect => ({
    description: cardText(cardId, 'description'),
    action: {
        type: 'rollDie',
        target: 'opponent',
        diceCount: 1,
        conditionalEffects: [
            { face: FACE.SPEAR, bonusDamage: 1, effectKey: 'bonusDie.effect.lieren.opportunisticStrike.spear' },
            { face: FACE.CLAW, bonusDamage: 2, effectKey: 'bonusDie.effect.lieren.opportunisticStrike.claw' },
            { face: FACE.NYRAS_BOND, companionHeal: 1, effectKey: 'bonusDie.effect.lieren.opportunisticStrike.nyrasBond' },
            { face: FACE.SABERTOOTH, bonusDamage: 3, effectKey: 'bonusDie.effect.lieren.opportunisticStrike.sabertooth' },
        ],
        resolutionMode: 'attackBonus',
        attackBonusSourceCardId: cardId,
    },
    timing: 'immediate',
});

const pounceRoll = (cardId: string): AbilityEffect => ({
    description: cardText(cardId, 'description'),
    action: {
        type: 'rollDie',
        target: 'opponent',
        diceCount: 5,
        conditionalEffects: [
            { face: FACE.SPEAR, bonusDamage: 1, effectKey: 'bonusDie.effect.lieren.pounce.spear' },
            {
                face: FACE.CLAW,
                grantStatus: { statusId: STATUS_IDS.BLEED, value: 1, target: 'opponent' },
                effectKey: 'bonusDie.effect.lieren.pounce.claw',
            },
        ],
        resolutionMode: 'attackBonus',
        attackBonusSourceCardId: cardId,
    },
    timing: 'immediate',
});

const savageClawRoll = (cardId: string): AbilityEffect => ({
    description: cardText(cardId, 'description'),
    action: {
        type: 'rollDie',
        target: 'opponent',
        diceCount: 1,
        conditionalEffects: [
            {
                face: FACE.CLAW,
                grantStatus: { statusId: STATUS_IDS.BLEED, value: 2, target: 'opponent' },
                effectKey: 'bonusDie.effect.lieren.savageClaw.bigBleed',
            },
            {
                face: FACE.SABERTOOTH,
                grantStatus: { statusId: STATUS_IDS.BLEED, value: 2, target: 'opponent' },
                effectKey: 'bonusDie.effect.lieren.savageClaw.bigBleed',
            },
        ],
        defaultEffect: {
            grantStatus: { statusId: STATUS_IDS.BLEED, value: 1, target: 'opponent' },
            effectKey: 'bonusDie.effect.lieren.savageClaw.bleed',
        },
    },
    timing: 'immediate',
});

const bloodlineRoll = (cardId: string): AbilityEffect => ({
    description: cardText(cardId, 'description'),
    action: {
        type: 'rollDie',
        target: 'self',
        diceCount: 3,
        conditionalEffects: [
            { face: FACE.NYRAS_BOND, companionHeal: 1, effectKey: 'bonusDie.effect.lieren.bloodline.nyrasBond' },
            { face: FACE.SABERTOOTH, companionHeal: 2, effectKey: 'bonusDie.effect.lieren.bloodline.sabertooth' },
        ],
    },
    timing: 'immediate',
});

const LIEREN_HERO_CARDS: AbilityCard[] = [
    {
        id: 'card-lieren-primitive-roar',
        name: cardText('card-lieren-primitive-roar', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-lieren-primitive-roar', 'description'),
        sfxKey: LIEREN_SFX_LIGHT,
        ...lierenCardRef(17),
        effects: [primitiveRoarRoll('card-lieren-primitive-roar')],
    },
    {
        id: 'card-lieren-regroup',
        name: cardText('card-lieren-regroup', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-lieren-regroup', 'description'),
        sfxKey: LIEREN_SFX_LIGHT,
        ...lierenCardRef(18),
        effects: [nyraEffect(cardText('card-lieren-regroup', 'description'), 'grant-bond')],
    },
    {
        id: 'card-lieren-opportunistic-strike',
        name: cardText('card-lieren-opportunistic-strike', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('card-lieren-opportunistic-strike', 'description'),
        sfxKey: LIEREN_SFX_HEAVY,
        ...lierenCardRef(19),
        isAttackModifier: true,
        effects: [opportunisticStrikeRoll('card-lieren-opportunistic-strike')],
    },
    {
        id: 'card-lieren-pounce',
        name: cardText('card-lieren-pounce', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('card-lieren-pounce', 'description'),
        sfxKey: LIEREN_SFX_HEAVY,
        ...lierenCardRef(20),
        isAttackModifier: true,
        effects: [pounceRoll('card-lieren-pounce')],
    },
    {
        id: 'card-lieren-savage-claw',
        name: cardText('card-lieren-savage-claw', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-lieren-savage-claw', 'description'),
        sfxKey: LIEREN_SFX_HEAVY,
        ...lierenCardRef(21),
        effects: [savageClawRoll('card-lieren-savage-claw')],
    },
    {
        id: 'card-lieren-bloodline',
        name: cardText('card-lieren-bloodline', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-lieren-bloodline', 'description'),
        sfxKey: LIEREN_SFX_LIGHT,
        ...lierenCardRef(22),
        effects: [
            nyraEffect(cardText('card-lieren-bloodline', 'description'), 'heal', 1),
            bloodlineRoll('card-lieren-bloodline'),
        ],
    },
    {
        id: 'upgrade-lieren-kindred-bond-3',
        name: cardText('upgrade-lieren-kindred-bond-3', 'name'),
        type: 'upgrade',
        cpCost: 4,
        timing: 'main',
        description: cardText('upgrade-lieren-kindred-bond-3', 'description'),
        sfxKey: LIEREN_SFX_LIGHT,
        ...lierenCardRef(23),
        effects: [replaceAbility('kindred-bond', KINDRED_BOND_3, 3, cardText('upgrade-lieren-kindred-bond-3', 'description'))],
    },
    {
        id: 'upgrade-lieren-kindred-bond-2',
        name: cardText('upgrade-lieren-kindred-bond-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-lieren-kindred-bond-2', 'description'),
        sfxKey: LIEREN_SFX_LIGHT,
        ...lierenCardRef(24),
        effects: [replaceAbility('kindred-bond', KINDRED_BOND_2, 2, cardText('upgrade-lieren-kindred-bond-2', 'description'))],
    },
    {
        id: 'upgrade-lieren-beast-force-2',
        name: cardText('upgrade-lieren-beast-force-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-lieren-beast-force-2', 'description'),
        sfxKey: LIEREN_SFX_HEAVY,
        ...lierenCardRef(25),
        effects: [replaceAbility('beast-force', BEAST_FORCE_2, 2, cardText('upgrade-lieren-beast-force-2', 'description'))],
    },
    {
        id: 'upgrade-lieren-brutal-strike-2',
        name: cardText('upgrade-lieren-brutal-strike-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-lieren-brutal-strike-2', 'description'),
        sfxKey: LIEREN_SFX_HEAVY,
        ...lierenCardRef(26),
        effects: [replaceAbility('brutal-strike', BRUTAL_STRIKE_2, 2, cardText('upgrade-lieren-brutal-strike-2', 'description'))],
    },
    {
        id: 'upgrade-lieren-hunt-ambush-2',
        name: cardText('upgrade-lieren-hunt-ambush-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-lieren-hunt-ambush-2', 'description'),
        sfxKey: LIEREN_SFX_HEAVY,
        ...lierenCardRef(27),
        effects: [replaceAbility('hunt-ambush', HUNT_AMBUSH_2, 2, cardText('upgrade-lieren-hunt-ambush-2', 'description'))],
    },
    {
        id: 'upgrade-lieren-beast-instinct-2',
        name: cardText('upgrade-lieren-beast-instinct-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-lieren-beast-instinct-2', 'description'),
        sfxKey: LIEREN_SFX_HEAVY,
        ...lierenCardRef(28),
        effects: [replaceAbility('beast-instinct', BEAST_INSTINCT_2, 2, cardText('upgrade-lieren-beast-instinct-2', 'description'))],
    },
    {
        id: 'upgrade-lieren-life-revival-2',
        name: cardText('upgrade-lieren-life-revival-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-lieren-life-revival-2', 'description'),
        sfxKey: LIEREN_SFX_LIGHT,
        ...lierenCardRef(29),
        effects: [replaceAbility('life-revival', LIFE_REVIVAL_2, 2, cardText('upgrade-lieren-life-revival-2', 'description'))],
    },
    {
        id: 'upgrade-lieren-savage-force-2',
        name: cardText('upgrade-lieren-savage-force-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-lieren-savage-force-2', 'description'),
        sfxKey: LIEREN_SFX_HEAVY,
        ...lierenCardRef(30),
        effects: [replaceAbility('savage-force', SAVAGE_FORCE_2, 2, cardText('upgrade-lieren-savage-force-2', 'description'))],
    },
    {
        id: 'upgrade-lieren-wild-force-2',
        name: cardText('upgrade-lieren-wild-force-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-lieren-wild-force-2', 'description'),
        sfxKey: LIEREN_SFX_HEAVY,
        ...lierenCardRef(31),
        effects: [replaceAbility('wild-force', WILD_FORCE_2, 2, cardText('upgrade-lieren-wild-force-2', 'description'))],
    },
];

export const LIEREN_CARDS: AbilityCard[] = [
    ...LIEREN_HERO_CARDS,
    ...injectCommonCardPreviewRefs(COMMON_CARDS, LIEREN_CARD_ATLAS_ID, TREANT_NINJA_COMMON_ATLAS_INDEX),
];

export const getLierenStartingDeck = (random: RandomFn): AbilityCard[] => random.shuffle(
    LIEREN_CARDS.map(card => ({ ...card })),
);

export default LIEREN_CARDS;
