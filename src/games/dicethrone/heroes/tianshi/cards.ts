/** 炽天使卡牌定义。每个专属物理槽只对应一张运行时卡牌。 */

import type { CardPreviewRef } from '../../../../core';
import type { RandomFn } from '../../../../engine/types';
import { abilityEffectText } from '../../../../engine/primitives/ability';
import type { AbilityCard } from '../../types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { COMMON_CARDS, injectCommonCardPreviewRefs, type CommonCardAtlasIndexMap } from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS } from '../../domain/ids';
import {
    ANGELIC_CLOAK_2, ANGELIC_CLOAK_3, ARCHANGEL_RESOLVE_2, DIVINE_PURIFICATION_2,
    DIVINE_PUNISHMENT_2, HOLY_BLADE_2, HOLY_BLADE_3, HOLY_RADIANCE_2,
    SUPREME_POWER_2, TRIUMPHANT_RETURN_2,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;
const TIANSHi_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.TIANSHI;

const atlasPreview = (index: number): CardPreviewRef => ({ type: 'atlas', atlasId: TIANSHi_CARD_ATLAS_ID, index });

const replaceAbility = (targetAbilityId: string, newAbilityDef: AbilityDef, newAbilityLevel: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'replaceAbility', target: 'self', targetAbilityId, newAbilityDef, newAbilityLevel },
    timing: 'immediate',
});

const custom = (customActionId: string, description: string, timing: AbilityEffect['timing'] = 'immediate'): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId },
    timing,
});

const TIANSHi_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
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

const TIANSHi_HERO_CARDS: AbilityCard[] = [
    {
        id: 'card-tianshi-holy-strike',
        name: cardText('card-tianshi-holy-strike', 'name'),
        type: 'action', cpCost: 1, timing: 'roll', description: cardText('card-tianshi-holy-strike', 'description'),
        previewRef: atlasPreview(17), sourceAtlasIndex: 17,
        isAttackModifier: true,
        effects: [custom('tianshi-holy-strike-card', abilityEffectText('card-tianshi-holy-strike', 'resolve'))],
    },
    {
        id: 'card-tianshi-angelic-tactics',
        name: cardText('card-tianshi-angelic-tactics', 'name'),
        type: 'action', cpCost: 1, timing: 'roll', description: cardText('card-tianshi-angelic-tactics', 'description'),
        previewRef: atlasPreview(18), sourceAtlasIndex: 18,
        isAttackModifier: true,
        effects: [custom('tianshi-angelic-tactics-card', abilityEffectText('card-tianshi-angelic-tactics', 'resolve'))],
    },
    {
        id: 'upgrade-tianshi-supreme-power-2-gospel-arrival',
        name: cardText('upgrade-tianshi-supreme-power-2-gospel-arrival', 'name'),
        type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('upgrade-tianshi-supreme-power-2-gospel-arrival', 'description'),
        previewRef: atlasPreview(19), sourceAtlasIndex: 19,
        effects: [replaceAbility('supreme-power', SUPREME_POWER_2, 2, abilityEffectText('upgrade-tianshi-supreme-power-2-gospel-arrival', 'upgrade')), custom('tianshi-gospel-arrival-card', abilityEffectText('upgrade-tianshi-supreme-power-2-gospel-arrival', 'secondary'))],
    },
    {
        id: 'upgrade-tianshi-divine-punishment-2-divine-command',
        name: cardText('upgrade-tianshi-divine-punishment-2-divine-command', 'name'),
        type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('upgrade-tianshi-divine-punishment-2-divine-command', 'description'),
        previewRef: atlasPreview(20), sourceAtlasIndex: 20,
        effects: [replaceAbility('divine-punishment', DIVINE_PUNISHMENT_2, 2, abilityEffectText('upgrade-tianshi-divine-punishment-2-divine-command', 'upgrade')), custom('tianshi-divine-command-card', abilityEffectText('upgrade-tianshi-divine-punishment-2-divine-command', 'secondary'))],
    },
    {
        id: 'upgrade-tianshi-divine-purification-2',
        name: cardText('upgrade-tianshi-divine-purification-2', 'name'),
        type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('upgrade-tianshi-divine-purification-2', 'description'),
        previewRef: atlasPreview(21), sourceAtlasIndex: 21,
        effects: [replaceAbility('divine-purification', DIVINE_PURIFICATION_2, 2, abilityEffectText('upgrade-tianshi-divine-purification-2', 'upgrade'))],
    },
    {
        id: 'upgrade-tianshi-archangel-resolve-2-divine-protection',
        name: cardText('upgrade-tianshi-archangel-resolve-2-divine-protection', 'name'),
        type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('upgrade-tianshi-archangel-resolve-2-divine-protection', 'description'),
        previewRef: atlasPreview(22), sourceAtlasIndex: 22,
        effects: [replaceAbility('archangel-resolve', ARCHANGEL_RESOLVE_2, 2, abilityEffectText('upgrade-tianshi-archangel-resolve-2-divine-protection', 'upgrade')), custom('tianshi-divine-protection-card', abilityEffectText('upgrade-tianshi-archangel-resolve-2-divine-protection', 'secondary'))],
    },
    {
        id: 'upgrade-tianshi-angelic-cloak-3',
        name: cardText('upgrade-tianshi-angelic-cloak-3', 'name'),
        type: 'upgrade', cpCost: 3, timing: 'main', description: cardText('upgrade-tianshi-angelic-cloak-3', 'description'),
        previewRef: atlasPreview(23), sourceAtlasIndex: 23,
        effects: [replaceAbility('angelic-cloak', ANGELIC_CLOAK_3, 3, abilityEffectText('upgrade-tianshi-angelic-cloak-3', 'upgrade'))],
    },
    {
        id: 'upgrade-tianshi-angelic-cloak-2',
        name: cardText('upgrade-tianshi-angelic-cloak-2', 'name'),
        type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('upgrade-tianshi-angelic-cloak-2', 'description'),
        previewRef: atlasPreview(24), sourceAtlasIndex: 24,
        effects: [replaceAbility('angelic-cloak', ANGELIC_CLOAK_2, 2, abilityEffectText('upgrade-tianshi-angelic-cloak-2', 'upgrade'))],
    },
    {
        id: 'upgrade-tianshi-triumphant-return-2',
        name: cardText('upgrade-tianshi-triumphant-return-2', 'name'),
        type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('upgrade-tianshi-triumphant-return-2', 'description'),
        previewRef: atlasPreview(25), sourceAtlasIndex: 25,
        effects: [replaceAbility('triumphant-return', TRIUMPHANT_RETURN_2, 2, abilityEffectText('upgrade-tianshi-triumphant-return-2', 'upgrade'))],
    },
    {
        id: 'upgrade-tianshi-holy-radiance-2-takeoff',
        name: cardText('upgrade-tianshi-holy-radiance-2-takeoff', 'name'),
        type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('upgrade-tianshi-holy-radiance-2-takeoff', 'description'),
        previewRef: atlasPreview(26), sourceAtlasIndex: 26,
        effects: [replaceAbility('holy-radiance', HOLY_RADIANCE_2, 2, abilityEffectText('upgrade-tianshi-holy-radiance-2-takeoff', 'upgrade')), custom('tianshi-takeoff-card', abilityEffectText('upgrade-tianshi-holy-radiance-2-takeoff', 'secondary'))],
    },
    {
        id: 'upgrade-tianshi-holy-blade-3-cherub-2',
        name: cardText('upgrade-tianshi-holy-blade-3-cherub-2', 'name'),
        type: 'upgrade', cpCost: 4, timing: 'main', description: cardText('upgrade-tianshi-holy-blade-3-cherub-2', 'description'),
        previewRef: atlasPreview(27), sourceAtlasIndex: 27,
        effects: [replaceAbility('holy-blade', HOLY_BLADE_3, 3, abilityEffectText('upgrade-tianshi-holy-blade-3-cherub-2', 'upgrade')), custom('tianshi-cherub-card', abilityEffectText('upgrade-tianshi-holy-blade-3-cherub-2', 'secondary'))],
    },
    {
        id: 'card-tianshi-divine-arbitration',
        name: cardText('card-tianshi-divine-arbitration', 'name'),
        type: 'action', cpCost: 4, timing: 'main', description: cardText('card-tianshi-divine-arbitration', 'description'),
        previewRef: atlasPreview(28), sourceAtlasIndex: 28,
        effects: [custom('tianshi-divine-arbitration-card', abilityEffectText('card-tianshi-divine-arbitration', 'resolve'))],
    },
    {
        id: 'card-tianshi-supreme-holiness',
        name: cardText('card-tianshi-supreme-holiness', 'name'),
        type: 'action', cpCost: 0, timing: 'instant', description: cardText('card-tianshi-supreme-holiness', 'description'),
        previewRef: atlasPreview(29), sourceAtlasIndex: 29,
        effects: [custom('tianshi-supreme-holiness-card', abilityEffectText('card-tianshi-supreme-holiness', 'resolve'))],
    },
    {
        id: 'card-tianshi-ascension',
        name: cardText('card-tianshi-ascension', 'name'),
        type: 'action', cpCost: 1, timing: 'instant', description: cardText('card-tianshi-ascension', 'description'),
        previewRef: atlasPreview(30), sourceAtlasIndex: 30,
        effects: [custom('tianshi-ascension-card', abilityEffectText('card-tianshi-ascension', 'resolve'))],
    },
    {
        id: 'upgrade-tianshi-holy-blade-2-cherub',
        name: cardText('upgrade-tianshi-holy-blade-2-cherub', 'name'),
        type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('upgrade-tianshi-holy-blade-2-cherub', 'description'),
        previewRef: atlasPreview(31), sourceAtlasIndex: 31,
        effects: [replaceAbility('holy-blade', HOLY_BLADE_2, 2, abilityEffectText('upgrade-tianshi-holy-blade-2-cherub', 'upgrade')), custom('tianshi-cherub-basic-card', abilityEffectText('upgrade-tianshi-holy-blade-2-cherub', 'secondary'))],
    },
];

export const TIANSHI_CARDS: AbilityCard[] = [
    ...TIANSHi_HERO_CARDS,
    ...injectCommonCardPreviewRefs(COMMON_CARDS, TIANSHi_CARD_ATLAS_ID, TIANSHi_COMMON_ATLAS_INDEX),
];

export const getTianshiStartingDeck = (random: RandomFn): AbilityCard[] => random.shuffle(
    TIANSHI_CARDS.map(card => ({ ...card })),
);

export default TIANSHI_CARDS;
