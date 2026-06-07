import type { CardPreviewRef } from '../../../../core';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { COMMON_CARDS, TREANT_NINJA_COMMON_ATLAS_INDEX, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS } from '../../domain/ids';
import type { AbilityCard } from '../../types';
import {
    NATURE_TOUCH_2,
    ROOTED_2,
    SHATTERING_FIST_2,
    SHATTERING_FIST_3,
    TEND_CARE_2,
    TREANT_SFX_GROWTH,
    TREANT_SFX_HEAVY,
    TREANT_SFX_LIGHT,
    VENGEFUL_VINES_2,
    WILD_GROWTH_2,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;
const TREANT_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.TREANT;

const atlasPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: TREANT_CARD_ATLAS_ID,
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

const custom = (customActionId: string, description: string, params: Record<string, unknown> = {}): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId, ...params },
    timing: 'immediate',
});

const treantCardRef = (index: number) => ({
    previewRef: atlasPreview(index),
    sourceAtlasIndex: index,
});

export const TREANT_CARDS: AbilityCard[] = [
    {
        id: 'treant-card-trample',
        name: cardText('treant-card-trample', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('treant-card-trample', 'description'),
        sfxKey: TREANT_SFX_HEAVY,
        ...treantCardRef(17),
        isAttackModifier: true,
        effects: [custom('treant-card-trample-roll', cardText('treant-card-trample', 'description'))],
    },
    {
        id: 'upgrade-tend-care-2',
        name: cardText('upgrade-tend-care-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-tend-care-2', 'description'),
        sfxKey: TREANT_SFX_GROWTH,
        ...treantCardRef(18),
        effects: [replaceAbility('tend-care', TEND_CARE_2, 2, cardText('upgrade-tend-care-2', 'description'))],
    },
    {
        id: 'upgrade-rooted-2',
        name: cardText('upgrade-rooted-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-rooted-2', 'description'),
        sfxKey: TREANT_SFX_HEAVY,
        ...treantCardRef(19),
        effects: [replaceAbility('rooted', ROOTED_2, 2, cardText('upgrade-rooted-2', 'description'))],
    },
    {
        id: 'treant-card-drink-deep',
        name: cardText('treant-card-drink-deep', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('treant-card-drink-deep', 'description'),
        sfxKey: TREANT_SFX_GROWTH,
        ...treantCardRef(20),
        effects: [custom('treant-card-drink-deep', cardText('treant-card-drink-deep', 'description'))],
    },
    {
        id: 'upgrade-shattering-fist-3',
        name: cardText('upgrade-shattering-fist-3', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-shattering-fist-3', 'description'),
        sfxKey: TREANT_SFX_HEAVY,
        ...treantCardRef(21),
        effects: [replaceAbility('shattering-fist', SHATTERING_FIST_3, 3, cardText('upgrade-shattering-fist-3', 'description'))],
    },
    {
        id: 'treant-card-harvest',
        name: cardText('treant-card-harvest', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('treant-card-harvest', 'description'),
        sfxKey: TREANT_SFX_GROWTH,
        ...treantCardRef(22),
        effects: [custom('treant-card-harvest', cardText('treant-card-harvest', 'description'))],
    },
    {
        id: 'treant-card-cultivate',
        name: cardText('treant-card-cultivate', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'main',
        description: cardText('treant-card-cultivate', 'description'),
        sfxKey: TREANT_SFX_GROWTH,
        ...treantCardRef(23),
        effects: [custom('treant-card-cultivate', cardText('treant-card-cultivate', 'description'), { cultivateAmount: 3 })],
    },
    {
        id: 'treant-card-downpour',
        name: cardText('treant-card-downpour', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('treant-card-downpour', 'description'),
        sfxKey: TREANT_SFX_GROWTH,
        ...treantCardRef(24),
        effects: [custom('treant-card-downpour', cardText('treant-card-downpour', 'description'))],
    },
    {
        id: 'upgrade-nature-touch-2',
        name: cardText('upgrade-nature-touch-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-nature-touch-2', 'description'),
        sfxKey: TREANT_SFX_GROWTH,
        ...treantCardRef(25),
        effects: [replaceAbility('nature-touch', NATURE_TOUCH_2, 2, cardText('upgrade-nature-touch-2', 'description'))],
    },
    {
        id: 'treant-card-soulfire',
        name: cardText('treant-card-soulfire', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('treant-card-soulfire', 'description'),
        sfxKey: TREANT_SFX_LIGHT,
        ...treantCardRef(26),
        isAttackModifier: true,
        effects: [custom('treant-card-soulfire-roll', cardText('treant-card-soulfire', 'description'))],
    },
    {
        id: 'treant-card-mother-tree',
        name: cardText('treant-card-mother-tree', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('treant-card-mother-tree', 'description'),
        sfxKey: TREANT_SFX_GROWTH,
        ...treantCardRef(27),
        effects: [custom('treant-card-mother-tree-roll', cardText('treant-card-mother-tree', 'description'))],
    },
    {
        id: 'upgrade-vengeful-vines-2',
        name: cardText('upgrade-vengeful-vines-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-vengeful-vines-2', 'description'),
        sfxKey: TREANT_SFX_LIGHT,
        ...treantCardRef(28),
        effects: [replaceAbility('vengeful-vines', VENGEFUL_VINES_2, 2, cardText('upgrade-vengeful-vines-2', 'description'))],
    },
    {
        id: 'upgrade-wild-growth-2',
        name: cardText('upgrade-wild-growth-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-wild-growth-2', 'description'),
        sfxKey: TREANT_SFX_GROWTH,
        ...treantCardRef(29),
        effects: [replaceAbility('wild-growth', WILD_GROWTH_2, 2, cardText('upgrade-wild-growth-2', 'description'))],
    },
    {
        id: 'upgrade-shattering-fist-2',
        name: cardText('upgrade-shattering-fist-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-shattering-fist-2', 'description'),
        sfxKey: TREANT_SFX_HEAVY,
        ...treantCardRef(30),
        effects: [replaceAbility('shattering-fist', SHATTERING_FIST_2, 2, cardText('upgrade-shattering-fist-2', 'description'))],
    },
    {
        id: 'treant-card-planting',
        name: cardText('treant-card-planting', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('treant-card-planting', 'description'),
        sfxKey: TREANT_SFX_GROWTH,
        ...treantCardRef(31),
        effects: [custom('treant-card-cultivate', cardText('treant-card-planting', 'description'), { cultivateAmount: 3 })],
    },
    ...injectCommonCardPreviewRefs(
        COMMON_CARDS,
        DICETHRONE_CARD_ATLAS_IDS.TREANT,
        TREANT_NINJA_COMMON_ATLAS_INDEX,
    ),
];

export const getTreantStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck = TREANT_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
