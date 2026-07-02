import type { RandomFn } from '../../../../engine/types';
import type { CardPreviewRef } from '../../../../core';
import { abilityEffectText } from '../../../../engine/primitives/ability';
import { COMMON_CARDS, injectCommonCardPreviewRefs, type CommonCardAtlasIndexMap } from '../../domain/commonCards';
import { ARTIFICER_DICE_FACE_IDS, DICETHRONE_CARD_ATLAS_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';
import type { AbilityCard } from '../../types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import {
    ACTIVATE_BOTS_2,
    COLLECT_PARTS_2,
    EUREKA_2,
    OVERCLOCK_2,
    SCHEMATICS_2,
    SHOCK_BOT_3,
    TINKER_2,
    WRENCH_STRIKE_2,
    ARTIFICER_SFX_ELECTRIC,
    ARTIFICER_SFX_METAL,
    ARTIFICER_SFX_ULTIMATE,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

const ARTIFICER_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.ARTIFICER;

const atlasPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: ARTIFICER_CARD_ATLAS_ID,
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

const ARTIFICER_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
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

const ARTIFICER_HERO_CARDS: AbilityCard[] = [
    {
        id: 'card-artificer-masterpiece',
        name: cardText('card-artificer-masterpiece', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-artificer-masterpiece', 'description'),
        sfxKey: ARTIFICER_SFX_ELECTRIC,
        previewRef: atlasPreview(17),
        sourceAtlasIndex: 17,
        effects: [{
            description: abilityEffectText('card-artificer-masterpiece', 'roll'),
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 1,
                conditionalEffects: [{
                    face: ARTIFICER_DICE_FACE_IDS.ELECTRICITY,
                    grantToken: { tokenId: TOKEN_IDS.SYNTH, value: 5 },
                    effectKey: 'bonusDie.effect.artificerMasterpieceElectricity',
                }],
                defaultEffect: { drawCard: 1, effectKey: 'bonusDie.effect.artificerMasterpieceOther' },
            },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-artificer-mechanical-strike',
        name: cardText('card-artificer-mechanical-strike', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-artificer-mechanical-strike', 'description'),
        sfxKey: ARTIFICER_SFX_METAL,
        previewRef: atlasPreview(18),
        sourceAtlasIndex: 18,
        playCondition: {
            pendingDamage: {
                role: 'target',
                responseType: 'beforeDamageReceived',
            },
        },
        effects: [
            {
                description: abilityEffectText('card-artificer-mechanical-strike', 'prevent2'),
                action: { type: 'grantDamageShield', target: 'self', value: 2 },
                timing: 'immediate',
            },
            {
                description: abilityEffectText('card-artificer-mechanical-strike', 'inflictNanobomb'),
                action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.NANOBOMB, value: 1 },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'upgrade-artificer-shock-bot-2',
        name: cardText('upgrade-artificer-shock-bot-2', 'name'),
        type: 'upgrade',
        cpCost: 0,
        timing: 'instant',
        description: cardText('upgrade-artificer-shock-bot-2', 'description'),
        sfxKey: ARTIFICER_SFX_ELECTRIC,
        previewRef: atlasPreview(19),
        sourceAtlasIndex: 19,
        playCondition: {
            pendingDamage: {
                role: 'target',
                responseType: 'beforeDamageReceived',
            },
        },
        effects: [{
            description: abilityEffectText('upgrade-artificer-shock-bot-2', 'activate'),
            action: { type: 'custom', target: 'self', customActionId: 'artificer-arc-shield' },
            timing: 'immediate',
        }],
    },
    {
        id: 'upgrade-artificer-tinker-2',
        name: cardText('upgrade-artificer-tinker-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-artificer-tinker-2', 'description'),
        sfxKey: ARTIFICER_SFX_METAL,
        previewRef: atlasPreview(20),
        sourceAtlasIndex: 20,
        effects: [replaceAbility('tinker', TINKER_2, 2, abilityEffectText('upgrade-artificer-tinker-2', 'upgrade'))],
    },
    {
        id: 'upgrade-artificer-overclock-2',
        name: cardText('upgrade-artificer-overclock-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-artificer-overclock-2', 'description'),
        sfxKey: ARTIFICER_SFX_ELECTRIC,
        previewRef: atlasPreview(21),
        sourceAtlasIndex: 21,
        effects: [replaceAbility('overclock', OVERCLOCK_2, 2, abilityEffectText('upgrade-artificer-overclock-2', 'upgrade'))],
    },
    {
        id: 'upgrade-artificer-shock-bot-3',
        name: cardText('upgrade-artificer-shock-bot-3', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-artificer-shock-bot-3', 'description'),
        sfxKey: ARTIFICER_SFX_ELECTRIC,
        previewRef: atlasPreview(22),
        sourceAtlasIndex: 22,
        effects: [replaceAbility('shock-bot', SHOCK_BOT_3, 3, abilityEffectText('upgrade-artificer-shock-bot-3', 'upgrade'))],
    },
    {
        id: 'upgrade-artificer-activate-bots-2',
        name: cardText('upgrade-artificer-activate-bots-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-artificer-activate-bots-2', 'description'),
        sfxKey: ARTIFICER_SFX_METAL,
        previewRef: atlasPreview(23),
        sourceAtlasIndex: 23,
        effects: [replaceAbility('activate-bots', ACTIVATE_BOTS_2, 2, abilityEffectText('upgrade-artificer-activate-bots-2', 'upgrade'))],
    },
    {
        id: 'upgrade-artificer-eureka-2',
        name: cardText('upgrade-artificer-eureka-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-artificer-eureka-2', 'description'),
        sfxKey: ARTIFICER_SFX_METAL,
        previewRef: atlasPreview(24),
        sourceAtlasIndex: 24,
        effects: [replaceAbility('eureka', EUREKA_2, 2, abilityEffectText('upgrade-artificer-eureka-2', 'upgrade'))],
    },
    {
        id: 'upgrade-artificer-schematics-2',
        name: cardText('upgrade-artificer-schematics-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-artificer-schematics-2', 'description'),
        sfxKey: ARTIFICER_SFX_METAL,
        previewRef: atlasPreview(25),
        sourceAtlasIndex: 25,
        effects: [replaceAbility('schematics', SCHEMATICS_2, 2, abilityEffectText('upgrade-artificer-schematics-2', 'upgrade'))],
    },
    {
        id: 'upgrade-artificer-wrench-strike-2',
        name: cardText('upgrade-artificer-wrench-strike-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-artificer-wrench-strike-2', 'description'),
        sfxKey: ARTIFICER_SFX_METAL,
        previewRef: atlasPreview(26),
        sourceAtlasIndex: 26,
        effects: [replaceAbility('wrench-strike', WRENCH_STRIKE_2, 2, abilityEffectText('upgrade-artificer-wrench-strike-2', 'upgrade'))],
    },
    {
        id: 'upgrade-artificer-collect-parts-2',
        name: cardText('upgrade-artificer-collect-parts-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-artificer-collect-parts-2', 'description'),
        sfxKey: ARTIFICER_SFX_METAL,
        previewRef: atlasPreview(27),
        sourceAtlasIndex: 27,
        effects: [replaceAbility('collect-parts', COLLECT_PARTS_2, 2, abilityEffectText('upgrade-artificer-collect-parts-2', 'upgrade'))],
    },
    {
        id: 'card-artificer-voltage',
        name: cardText('card-artificer-voltage', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-artificer-voltage', 'description'),
        sfxKey: ARTIFICER_SFX_ELECTRIC,
        previewRef: atlasPreview(28),
        sourceAtlasIndex: 28,
        effects: [{
            description: abilityEffectText('card-artificer-voltage', 'gainSynth2'),
            action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.SYNTH, value: 2 },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-artificer-nano-attack',
        name: cardText('card-artificer-nano-attack', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-artificer-nano-attack', 'description'),
        sfxKey: ARTIFICER_SFX_ELECTRIC,
        previewRef: atlasPreview(29),
        sourceAtlasIndex: 29,
        effects: [{
            description: abilityEffectText('card-artificer-nano-attack', 'inflictNanobomb'),
            action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.NANOBOMB, value: 1 },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-artificer-overdrive',
        name: cardText('card-artificer-overdrive', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-artificer-overdrive', 'description'),
        sfxKey: ARTIFICER_SFX_ELECTRIC,
        previewRef: atlasPreview(30),
        sourceAtlasIndex: 30,
        effects: [{
            description: abilityEffectText('card-artificer-overdrive', 'roll'),
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 1,
                conditionalEffects: [
                    {
                        face: ARTIFICER_DICE_FACE_IDS.WRENCH,
                        heal: 2,
                        effectKey: 'bonusDie.effect.artificerOverdriveWrench',
                    },
                    {
                        face: ARTIFICER_DICE_FACE_IDS.GEAR,
                        grantToken: { tokenId: TOKEN_IDS.SYNTH, value: 1 },
                        effectKey: 'bonusDie.effect.artificerOverdriveGear',
                    },
                    {
                        face: ARTIFICER_DICE_FACE_IDS.ELECTRICITY,
                        grantStatus: { statusId: STATUS_IDS.NANOBOMB, value: 1, target: 'opponent' },
                        effectKey: 'bonusDie.effect.artificerOverdriveElectricity',
                    },
                ],
            },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-artificer-perfectly-calibrated',
        name: cardText('card-artificer-perfectly-calibrated', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-artificer-perfectly-calibrated', 'description'),
        sfxKey: ARTIFICER_SFX_ULTIMATE,
        previewRef: atlasPreview(31),
        sourceAtlasIndex: 31,
        effects: [{
            description: abilityEffectText('card-artificer-perfectly-calibrated', 'roll'),
            action: { type: 'custom', target: 'self', customActionId: 'artificer-perfectly-calibrated-roll' },
            timing: 'immediate',
        }],
    },
];

export const ARTIFICER_CARDS: AbilityCard[] = [
    ...ARTIFICER_HERO_CARDS,
    ...injectCommonCardPreviewRefs(
        COMMON_CARDS,
        DICETHRONE_CARD_ATLAS_IDS.ARTIFICER,
        ARTIFICER_COMMON_ATLAS_INDEX,
    ),
];

export const getArtificerStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck = ARTIFICER_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
