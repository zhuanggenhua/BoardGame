import type { CardPreviewRef } from '../../../../core';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { COMMON_CARDS, TREANT_NINJA_COMMON_ATLAS_INDEX, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS, TOKEN_IDS, TREANT_DICE_FACE_IDS } from '../../domain/ids';
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

const grantToken = (target: 'self' | 'opponent', tokenId: string, value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target, tokenId, value },
    timing: 'immediate',
});

const drawCard = (count: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'drawCard', target: 'self', drawCount: count },
    timing: 'immediate',
});

const heal = (value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'heal', target: 'self', value },
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
        effects: [{
            description: '投掷 5 骰；每个树枝使本次攻击 +1，若掷出树灵则施加刺藤。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 5,
                resolutionMode: 'attackBonus',
                attackBonusSourceCardId: 'treant-card-trample',
                conditionalEffects: [
                    { face: TREANT_DICE_FACE_IDS.BRANCH, bonusDamage: 1 },
                    { face: TREANT_DICE_FACE_IDS.SPIRIT, grantToken: { tokenId: TOKEN_IDS.THORN, value: 1, target: 'opponent' } },
                ],
            },
            timing: 'immediate',
        }],
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
        effects: [replaceAbility('tend-care', TEND_CARE_2, 2, '升级细心呵护至 II 级。')],
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
        effects: [replaceAbility('rooted', ROOTED_2, 2, '升级扎根至 II 级。')],
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
        effects: [grantToken('self', TOKEN_IDS.LIFE_SAP, 1, '获得 1 个生命源泉。')],
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
        effects: [replaceAbility('shattering-fist', SHATTERING_FIST_3, 3, '升级破碎之拳至 III 级。')],
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
        effects: [drawCard(1, '抽 1 张牌。'), grantToken('self', TOKEN_IDS.TREANT_SEEDLING, 1, '养成 1 树灵。')],
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
        effects: [grantToken('self', TOKEN_IDS.TREANT_SEEDLING, 3, '养成 3 树灵。')],
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
        effects: [heal(2, '治疗 2 点。'), grantToken('self', TOKEN_IDS.TREANT_SEEDLING, 1, '养成 1 树灵。')],
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
        effects: [replaceAbility('nature-touch', NATURE_TOUCH_2, 2, '升级自然之触至 II 级。')],
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
        effects: [{
            description: '投掷 3 骰；按结果追加树灵、生命源泉或养成。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 3,
                resolutionMode: 'attackBonus',
                attackBonusSourceCardId: 'treant-card-soulfire',
                conditionalEffects: [
                    { face: TREANT_DICE_FACE_IDS.BRANCH, bonusDamage: 1 },
                    { face: TREANT_DICE_FACE_IDS.LEAF, grantToken: { tokenId: TOKEN_IDS.LIFE_SAP, value: 1 } },
                    { face: TREANT_DICE_FACE_IDS.SPIRIT, grantToken: { tokenId: TOKEN_IDS.TREANT_SEEDLING, value: 1 } },
                ],
            },
            timing: 'immediate',
        }],
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
        effects: [{
            description: '投掷 1 骰；树灵结果养成，否则抽牌。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 1,
                conditionalEffects: [{ face: TREANT_DICE_FACE_IDS.SPIRIT, grantToken: { tokenId: TOKEN_IDS.TREANT_SEEDLING, value: 4 } }],
                defaultEffect: { drawCard: 1 },
            },
            timing: 'immediate',
        }],
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
        effects: [replaceAbility('vengeful-vines', VENGEFUL_VINES_2, 2, '升级复仇枝蔓至 II 级。')],
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
        effects: [replaceAbility('wild-growth', WILD_GROWTH_2, 2, '升级野蛮生长至 II 级。')],
    },
    {
        id: 'upgrade-shattering-fist-2',
        name: cardText('upgrade-shattering-fist-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-shattering-fist-2', 'description'),
        sfxKey: TREANT_SFX_HEAVY,
        ...treantCardRef(35),
        effects: [replaceAbility('shattering-fist', SHATTERING_FIST_2, 2, '升级破碎之拳至 II 级。')],
    },
    {
        id: 'treant-card-planting',
        name: cardText('treant-card-planting', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('treant-card-planting', 'description'),
        sfxKey: TREANT_SFX_GROWTH,
        ...treantCardRef(36),
        effects: [grantToken('self', TOKEN_IDS.TREANT_SEEDLING, 4, '养成 4 树灵。')],
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
