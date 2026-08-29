/** 吸血鬼领主卡牌定义。复杂机制未完全核准前保持实施中静态接入。 */

import type { CardPreviewRef } from '../../../../core';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityCard } from '../../types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import {
    COMMON_CARDS,
    TREANT_NINJA_COMMON_ATLAS_INDEX,
    injectCommonCardPreviewRefs,
    type CommonCardAtlasIndexMap,
} from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';
import {
    BLOOD_FEAST_2,
    BLOOD_MAGIC_2,
    BLOOD_POSSESSED_2,
    BLOOD_THIRST_2,
    BLOODTHIRSTY_CLAWS_2,
    BLOODTHIRSTY_CLAWS_3,
    MESMERIZE_POWER_2,
    REND_CLAWS_2,
    UNDYING_2,
    VAMPIRE_LORD_SFX_HEAVY,
    VAMPIRE_LORD_SFX_LIGHT,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;
const VAMPIRE_LORD_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.VAMPIRE_LORD;
const VAMPIRE_LORD_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = Object.fromEntries(
    Object.entries(TREANT_NINJA_COMMON_ATLAS_INDEX).filter(([cardId]) => cardId !== 'card-unexpected'),
);

const atlasPreview = (index: number): CardPreviewRef => ({ type: 'atlas', atlasId: VAMPIRE_LORD_CARD_ATLAS_ID, index });

const vampireLordCardRef = (index: number) => ({
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

const grantBloodPower = (value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.BLOOD_POWER, value },
    timing: 'immediate',
});

const grantMesmerize = (description: string): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.MESMERIZE, value: 1 },
    timing: 'immediate',
});

const grantBleed = (value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.BLEED, value },
    timing: 'immediate',
});

const addAttackBonus = (value: number, description: string): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target: 'self',
        customActionId: 'common-add-attack-bonus',
        params: { amount: value },
    },
    timing: 'immediate',
});

const drawCard = (count: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'drawCard', target: 'self', drawCount: count },
    timing: 'immediate',
});

const VAMPIRE_LORD_HERO_CARDS: AbilityCard[] = [
    {
        id: 'card-vampire-lord-blood-surge',
        name: cardText('card-vampire-lord-blood-surge', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-vampire-lord-blood-surge', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_LIGHT,
        ...vampireLordCardRef(17),
        effects: [grantBloodPower(1, cardText('card-vampire-lord-blood-surge', 'description'))],
    },
    {
        id: 'card-vampire-lord-blood-from-above',
        name: cardText('card-vampire-lord-blood-from-above', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-vampire-lord-blood-from-above', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_HEAVY,
        ...vampireLordCardRef(18),
        effects: [grantBloodPower(1, cardText('card-vampire-lord-blood-from-above', 'description'))],
    },
    {
        id: 'card-vampire-lord-total-demise',
        name: cardText('card-vampire-lord-total-demise', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-vampire-lord-total-demise', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_HEAVY,
        ...vampireLordCardRef(19),
        isAttackModifier: true,
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [addAttackBonus(1, cardText('card-vampire-lord-total-demise', 'description'))],
    },
    {
        id: 'card-vampire-lord-boiling-blood',
        name: cardText('card-vampire-lord-boiling-blood', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('card-vampire-lord-boiling-blood', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_HEAVY,
        ...vampireLordCardRef(20),
        isAttackModifier: true,
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [addAttackBonus(1, cardText('card-vampire-lord-boiling-blood', 'description'))],
    },
    {
        id: 'card-vampire-lord-gushing-blood',
        name: cardText('card-vampire-lord-gushing-blood', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-vampire-lord-gushing-blood', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_LIGHT,
        ...vampireLordCardRef(21),
        effects: [
            grantBloodPower(1, cardText('card-vampire-lord-gushing-blood', 'description')),
            grantMesmerize(cardText('card-vampire-lord-gushing-blood', 'description')),
        ],
    },
    {
        id: 'upgrade-vampire-lord-undying-2',
        name: cardText('upgrade-vampire-lord-undying-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-vampire-lord-undying-2', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_LIGHT,
        ...vampireLordCardRef(22),
        effects: [replaceAbility('undying', UNDYING_2, 2, cardText('upgrade-vampire-lord-undying-2', 'description'))],
    },
    {
        id: 'upgrade-vampire-lord-blood-thirst-2-blood-river',
        name: cardText('upgrade-vampire-lord-blood-thirst-2-blood-river', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-vampire-lord-blood-thirst-2-blood-river', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_HEAVY,
        ...vampireLordCardRef(23),
        effects: [replaceAbility('blood-thirst', BLOOD_THIRST_2, 2, cardText('upgrade-vampire-lord-blood-thirst-2-blood-river', 'description'))],
    },
    {
        id: 'upgrade-vampire-lord-blood-magic-2-flayed',
        name: cardText('upgrade-vampire-lord-blood-magic-2-flayed', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-vampire-lord-blood-magic-2-flayed', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_LIGHT,
        ...vampireLordCardRef(24),
        effects: [replaceAbility('blood-magic', BLOOD_MAGIC_2, 2, cardText('upgrade-vampire-lord-blood-magic-2-flayed', 'description'))],
    },
    {
        id: 'upgrade-vampire-lord-blood-possessed-2-blood-addiction',
        name: cardText('upgrade-vampire-lord-blood-possessed-2-blood-addiction', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-vampire-lord-blood-possessed-2-blood-addiction', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_HEAVY,
        ...vampireLordCardRef(25),
        effects: [replaceAbility('blood-possessed', BLOOD_POSSESSED_2, 2, cardText('upgrade-vampire-lord-blood-possessed-2-blood-addiction', 'description'))],
    },
    {
        id: 'upgrade-vampire-lord-rend-claws-2',
        name: cardText('upgrade-vampire-lord-rend-claws-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-vampire-lord-rend-claws-2', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_HEAVY,
        ...vampireLordCardRef(26),
        effects: [replaceAbility('rend-claws', REND_CLAWS_2, 2, cardText('upgrade-vampire-lord-rend-claws-2', 'description'))],
    },
    {
        id: 'upgrade-vampire-lord-blood-feast-2-dressed-to-kill',
        name: cardText('upgrade-vampire-lord-blood-feast-2-dressed-to-kill', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-vampire-lord-blood-feast-2-dressed-to-kill', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_HEAVY,
        ...vampireLordCardRef(27),
        effects: [replaceAbility('blood-feast', BLOOD_FEAST_2, 2, cardText('upgrade-vampire-lord-blood-feast-2-dressed-to-kill', 'description'))],
    },
    {
        id: 'upgrade-vampire-lord-mesmerize-power-2-soul-gaze',
        name: cardText('upgrade-vampire-lord-mesmerize-power-2-soul-gaze', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-vampire-lord-mesmerize-power-2-soul-gaze', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_LIGHT,
        ...vampireLordCardRef(28),
        effects: [replaceAbility('mesmerize-power', MESMERIZE_POWER_2, 2, cardText('upgrade-vampire-lord-mesmerize-power-2-soul-gaze', 'description'))],
    },
    {
        id: 'upgrade-vampire-lord-bloodthirsty-claws-3',
        name: cardText('upgrade-vampire-lord-bloodthirsty-claws-3', 'name'),
        type: 'upgrade',
        cpCost: 4,
        timing: 'main',
        description: cardText('upgrade-vampire-lord-bloodthirsty-claws-3', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_HEAVY,
        ...vampireLordCardRef(29),
        effects: [replaceAbility('bloodthirsty-claws', BLOODTHIRSTY_CLAWS_3, 3, cardText('upgrade-vampire-lord-bloodthirsty-claws-3', 'description'))],
    },
    {
        id: 'upgrade-vampire-lord-bloodthirsty-claws-2',
        name: cardText('upgrade-vampire-lord-bloodthirsty-claws-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-vampire-lord-bloodthirsty-claws-2', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_HEAVY,
        ...vampireLordCardRef(30),
        effects: [replaceAbility('bloodthirsty-claws', BLOODTHIRSTY_CLAWS_2, 2, cardText('upgrade-vampire-lord-bloodthirsty-claws-2', 'description'))],
    },
    {
        id: 'card-vampire-lord-drink-up',
        name: cardText('card-vampire-lord-drink-up', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-vampire-lord-drink-up', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_LIGHT,
        ...vampireLordCardRef(31),
        effects: [grantBloodPower(2, cardText('card-vampire-lord-drink-up', 'description'))],
    },
    {
        id: 'card-vampire-lord-bloodstone',
        name: cardText('card-vampire-lord-bloodstone', 'name'),
        type: 'action',
        cpCost: 4,
        timing: 'main',
        description: cardText('card-vampire-lord-bloodstone', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_LIGHT,
        ...vampireLordCardRef(32),
        effects: [
            grantMesmerize(cardText('card-vampire-lord-bloodstone', 'description')),
            grantBloodPower(2, cardText('card-vampire-lord-bloodstone', 'description')),
            grantBleed(1, cardText('card-vampire-lord-bloodstone', 'description')),
            drawCard(1, cardText('card-vampire-lord-bloodstone', 'description')),
        ],
    },
];

export const VAMPIRE_LORD_CARDS: AbilityCard[] = [
    ...VAMPIRE_LORD_HERO_CARDS,
    ...injectCommonCardPreviewRefs(COMMON_CARDS, VAMPIRE_LORD_CARD_ATLAS_ID, VAMPIRE_LORD_COMMON_ATLAS_INDEX),
];

export const getVampireLordStartingDeck = (random: RandomFn): AbilityCard[] => random.shuffle(
    VAMPIRE_LORD_CARDS.map(card => ({ ...card })),
);

export default VAMPIRE_LORD_CARDS;
