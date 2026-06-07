import type { RandomFn } from '../../../../engine/types';
import type { CardPreviewRef } from '../../../../core';
import { COMMON_CARDS, injectCommonCardPreviewRefs, type CommonCardAtlasIndexMap } from '../../domain/commonCards';
import { CURSED_PIRATE_DICE_FACE_IDS, DICETHRONE_CARD_ATLAS_IDS, STATUS_IDS } from '../../domain/ids';
import type { AbilityCard } from '../../types';
import { abilityEffectText } from '../../../../engine/primitives/ability';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

const CURSED_PIRATE_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.CURSED_PIRATE;

const atlasPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: CURSED_PIRATE_CARD_ATLAS_ID,
    index,
});

const CURSED_PIRATE_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
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
    'card-unexpected': 33,
};

const CURSED_PIRATE_HERO_CARDS: AbilityCard[] = [
    {
        id: 'card-cursed-pirate-weigh-anchor',
        name: cardText('card-cursed-pirate-weigh-anchor', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-cursed-pirate-weigh-anchor', 'description'),
        previewRef: atlasPreview(17),
        sourceAtlasIndex: 17,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-weigh-anchor', 'roll'),
            action: {
                type: 'rollDie',
                target: 'opponent',
                diceCount: 1,
                conditionalEffects: [{
                    face: CURSED_PIRATE_DICE_FACE_IDS.SKULL,
                    grantStatus: { statusId: STATUS_IDS.PARLEY, value: 1, target: 'opponent' },
                    effectKey: 'bonusDie.effect.cursedPirateWeighAnchorSkull',
                }],
                defaultEffect: { drawCard: 1, effectKey: 'bonusDie.effect.cursedPirateWeighAnchorOther' },
            },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-curse-card',
        name: cardText('card-cursed-pirate-curse-card', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('card-cursed-pirate-curse-card', 'description'),
        previewRef: atlasPreview(18),
        sourceAtlasIndex: 18,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-curse-card', 'choice'),
            action: { type: 'custom', target: 'self', customActionId: 'cursed-pirate-curse-card-choice' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-batten-down',
        name: cardText('card-cursed-pirate-batten-down', 'name'),
        type: 'action',
        cpCost: 4,
        timing: 'instant',
        description: cardText('card-cursed-pirate-batten-down', 'description'),
        previewRef: atlasPreview(19),
        sourceAtlasIndex: 19,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-batten-down', 'discardHandDraw4'),
            action: { type: 'custom', target: 'self', customActionId: 'cursed-pirate-batten-down' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-shark-bait',
        name: cardText('card-cursed-pirate-shark-bait', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-cursed-pirate-shark-bait', 'description'),
        previewRef: atlasPreview(20),
        sourceAtlasIndex: 20,
        isAttackModifier: true,
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [{
            description: abilityEffectText('card-cursed-pirate-shark-bait', 'attackDamagePlus2'),
            action: { type: 'damage', target: 'opponent', value: 2, damageScope: 'attack' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-flay',
        name: cardText('card-cursed-pirate-flay', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-cursed-pirate-flay', 'description'),
        previewRef: atlasPreview(21),
        sourceAtlasIndex: 21,
        isAttackModifier: true,
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [{
            description: abilityEffectText('card-cursed-pirate-flay', 'roll5'),
            action: { type: 'custom', target: 'opponent', customActionId: 'cursed-pirate-flay-roll' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-ransom',
        name: cardText('card-cursed-pirate-ransom', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-cursed-pirate-ransom', 'description'),
        previewRef: atlasPreview(22),
        sourceAtlasIndex: 22,
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [{
            description: abilityEffectText('card-cursed-pirate-ransom', 'chooseDieOrPay2'),
            action: { type: 'custom', target: 'opponent', customActionId: 'cursed-pirate-ransom-die-choice' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-bluster',
        name: cardText('card-cursed-pirate-bluster', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-cursed-pirate-bluster', 'description'),
        previewRef: atlasPreview(23),
        sourceAtlasIndex: 23,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-bluster', 'roll'),
            action: {
                type: 'rollDie',
                target: 'opponent',
                diceCount: 1,
                conditionalEffects: [
                    { face: CURSED_PIRATE_DICE_FACE_IDS.CUTLASS, bonusDamage: 2, effectKey: 'bonusDie.effect.cursedPirateBlusterCutlass' },
                    { face: CURSED_PIRATE_DICE_FACE_IDS.LOOT, drawCard: 2, effectKey: 'bonusDie.effect.cursedPirateBlusterLoot' },
                    { face: CURSED_PIRATE_DICE_FACE_IDS.SKULL, grantStatus: { statusId: STATUS_IDS.POWDER_KEG, value: 1, target: 'opponent' }, effectKey: 'bonusDie.effect.cursedPirateBlusterSkull' },
                ],
            },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-scurvy',
        name: cardText('card-cursed-pirate-scurvy', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-cursed-pirate-scurvy', 'description'),
        previewRef: atlasPreview(24),
        sourceAtlasIndex: 24,
        effects: [
            { description: abilityEffectText('card-cursed-pirate-scurvy', 'selfDamage1'), action: { type: 'damage', target: 'self', value: 1, damageScope: 'direct', unblockable: true }, timing: 'immediate' },
            { description: abilityEffectText('card-cursed-pirate-scurvy', 'inflictWither'), action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.WITHER, value: 1 }, timing: 'immediate' },
        ],
    },
    {
        id: 'card-cursed-pirate-pillage',
        name: cardText('card-cursed-pirate-pillage', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-cursed-pirate-pillage', 'description'),
        previewRef: atlasPreview(25),
        sourceAtlasIndex: 25,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-pillage', 'steal1Cp'),
            action: { type: 'custom', target: 'opponent', customActionId: 'cursed-pirate-steal-one-cp' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-parley',
        name: cardText('card-cursed-pirate-parley', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-cursed-pirate-parley', 'description'),
        previewRef: atlasPreview(26),
        sourceAtlasIndex: 26,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-parley', 'inflictParley'),
            action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.PARLEY, value: 1 },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-crows-nest',
        name: cardText('card-cursed-pirate-crows-nest', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-cursed-pirate-crows-nest', 'description'),
        previewRef: atlasPreview(27),
        sourceAtlasIndex: 27,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-crows-nest', 'roll'),
            action: { type: 'custom', target: 'opponent', customActionId: 'cursed-pirate-crows-nest-roll' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-hefty',
        name: cardText('card-cursed-pirate-hefty', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-cursed-pirate-hefty', 'description'),
        previewRef: atlasPreview(28),
        sourceAtlasIndex: 28,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-hefty', 'roll2'),
            action: { type: 'custom', target: 'self', customActionId: 'cursed-pirate-hefty-roll' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-pirates-life',
        name: cardText('card-cursed-pirate-pirates-life', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-cursed-pirate-pirates-life', 'description'),
        previewRef: atlasPreview(29),
        sourceAtlasIndex: 29,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-pirates-life', 'faceDependent'),
            action: { type: 'custom', target: 'self', customActionId: 'cursed-pirate-pirates-life' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-go-fish',
        name: cardText('card-cursed-pirate-go-fish', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-cursed-pirate-go-fish', 'description'),
        previewRef: atlasPreview(30),
        sourceAtlasIndex: 30,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-go-fish', 'powderKegTargets'),
            action: { type: 'custom', target: 'self', customActionId: 'cursed-pirate-go-fish-powder-keg-targets' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-cursed-pirate-give-me-some',
        name: cardText('card-cursed-pirate-give-me-some', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-cursed-pirate-give-me-some', 'description'),
        previewRef: atlasPreview(31),
        sourceAtlasIndex: 31,
        effects: [{ description: abilityEffectText('card-cursed-pirate-give-me-some', 'inflictPowderKeg'), action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.POWDER_KEG, value: 1 }, timing: 'immediate' }],
    },
    {
        id: 'card-cursed-pirate-sip',
        name: cardText('card-cursed-pirate-sip', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-cursed-pirate-sip', 'description'),
        previewRef: atlasPreview(32),
        sourceAtlasIndex: 32,
        effects: [{
            description: abilityEffectText('card-cursed-pirate-sip', 'choice'),
            action: { type: 'custom', target: 'opponent', customActionId: 'cursed-pirate-sip-choice' },
            timing: 'immediate',
        }],
    },
];

export const CURSED_PIRATE_CARDS: AbilityCard[] = [
    ...CURSED_PIRATE_HERO_CARDS,
    ...injectCommonCardPreviewRefs(
        COMMON_CARDS,
        DICETHRONE_CARD_ATLAS_IDS.CURSED_PIRATE,
        CURSED_PIRATE_COMMON_ATLAS_INDEX,
    ),
];

export const getCursedPirateStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck = CURSED_PIRATE_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
