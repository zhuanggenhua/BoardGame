import type { CardPreviewRef } from '../../../../core';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { COMMON_CARDS, TREANT_NINJA_COMMON_ATLAS_INDEX, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS, NINJA_DICE_FACE_IDS, TOKEN_IDS } from '../../domain/ids';
import type { AbilityCard } from '../../types';
import {
    BLINK_2,
    DEATH_BLOSSOM_2,
    GOING_FORWARD_2,
    NINJA_SFX_POISON,
    NINJA_SFX_SLASH,
    NINJA_SFX_SMOKE,
    POISON_BLADE_2,
    SHADOW_FANG_2,
    SHADOW_STEP_2,
    SLASH_2,
    SMOKE_SCREEN_2,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;
const NINJA_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.NINJA;

const atlasPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: NINJA_CARD_ATLAS_ID,
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

const ninjaCardRef = (index: number) => ({
    previewRef: atlasPreview(index),
    sourceAtlasIndex: index,
});

export const NINJA_CARDS: AbilityCard[] = [
    {
        id: 'ninja-card-training',
        name: cardText('ninja-card-training', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('ninja-card-training', 'description'),
        sfxKey: NINJA_SFX_SMOKE,
        ...ninjaCardRef(17),
        effects: [grantToken('self', TOKEN_IDS.NINJUTSU, 1, '获得 1 个忍术。')],
    },
    {
        id: 'upgrade-blink-2',
        name: cardText('upgrade-blink-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-blink-2', 'description'),
        sfxKey: NINJA_SFX_SMOKE,
        ...ninjaCardRef(18),
        effects: [replaceAbility('blink', BLINK_2, 2, '升级瞬身至 II 级。')],
    },
    {
        id: 'upgrade-going-forward-2',
        name: cardText('upgrade-going-forward-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-going-forward-2', 'description'),
        sfxKey: NINJA_SFX_SLASH,
        ...ninjaCardRef(19),
        effects: [replaceAbility('going-forward', GOING_FORWARD_2, 2, '升级一往无前至 II 级。')],
    },
    {
        id: 'upgrade-slash-2',
        name: cardText('upgrade-slash-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-slash-2', 'description'),
        sfxKey: NINJA_SFX_SLASH,
        ...ninjaCardRef(20),
        effects: [replaceAbility('slash', SLASH_2, 2, '升级斩击至 II 级。')],
    },
    {
        id: 'upgrade-shadow-step-2',
        name: cardText('upgrade-shadow-step-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-shadow-step-2', 'description'),
        sfxKey: NINJA_SFX_SMOKE,
        ...ninjaCardRef(21),
        effects: [replaceAbility('shadow-step', SHADOW_STEP_2, 2, '升级暗影步至 II 级。')],
    },
    {
        id: 'ninja-card-shuriken',
        name: cardText('ninja-card-shuriken', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('ninja-card-shuriken', 'description'),
        sfxKey: NINJA_SFX_SLASH,
        ...ninjaCardRef(22),
        isAttackModifier: true,
        effects: [{
            description: '投掷 5 骰；每个忍刀令本次攻击 +1。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 5,
                resolutionMode: 'attackBonus',
                attackBonusSourceCardId: 'ninja-card-shuriken',
                conditionalEffects: [{ face: NINJA_DICE_FACE_IDS.KATANA, bonusDamage: 1 }],
            },
            timing: 'immediate',
        }],
    },
    {
        id: 'ninja-card-escape',
        name: cardText('ninja-card-escape', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('ninja-card-escape', 'description'),
        sfxKey: NINJA_SFX_SMOKE,
        ...ninjaCardRef(23),
        playCondition: {
            pendingDamage: {
                role: 'target',
                responseType: 'beforeDamageReceived',
            },
        },
        effects: [{
            description: '只能在被攻击后打出：按骰面减伤或获得烟雾弹。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 1,
                conditionalEffects: [
                    { face: NINJA_DICE_FACE_IDS.KATANA, grantDamageShield: { value: 1 } },
                    { face: NINJA_DICE_FACE_IDS.SHURIKEN, grantDamageShield: { value: 2 } },
                    { face: NINJA_DICE_FACE_IDS.MASK, grantToken: { tokenId: TOKEN_IDS.SMOKE_BOMB, value: 1 } },
                ],
            },
            timing: 'immediate',
        }],
    },
    {
        id: 'ninja-card-poison-dart',
        name: cardText('ninja-card-poison-dart', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('ninja-card-poison-dart', 'description'),
        sfxKey: NINJA_SFX_POISON,
        ...ninjaCardRef(24),
        effects: [grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 2, '对手获得 2 个慢性中毒。')],
    },
    {
        id: 'ninja-card-knife-fan',
        name: cardText('ninja-card-knife-fan', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('ninja-card-knife-fan', 'description'),
        sfxKey: NINJA_SFX_SLASH,
        ...ninjaCardRef(25),
        effects: [{
            description: '对目标造成 1 点不可防御伤害。',
            action: { type: 'damage', target: 'opponent', value: 1, unblockable: true, damageScope: 'direct' },
            timing: 'immediate',
        }],
    },
    {
        id: 'upgrade-smoke-screen-2',
        name: cardText('upgrade-smoke-screen-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-smoke-screen-2', 'description'),
        sfxKey: NINJA_SFX_SMOKE,
        ...ninjaCardRef(26),
        effects: [replaceAbility('smoke-screen', SMOKE_SCREEN_2, 2, '升级烟雾阵至 II 级。')],
    },
    {
        id: 'upgrade-shadow-fang-2',
        name: cardText('upgrade-shadow-fang-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-shadow-fang-2', 'description'),
        sfxKey: NINJA_SFX_SLASH,
        ...ninjaCardRef(27),
        effects: [replaceAbility('shadow-fang', SHADOW_FANG_2, 2, '升级影牙至 II 级。')],
    },
    {
        id: 'upgrade-poison-blade-2',
        name: cardText('upgrade-poison-blade-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-poison-blade-2', 'description'),
        sfxKey: NINJA_SFX_POISON,
        ...ninjaCardRef(28),
        effects: [replaceAbility('poison-blade', POISON_BLADE_2, 2, '升级毒刃至 II 级。')],
    },
    {
        id: 'upgrade-death-blossom-2',
        name: cardText('upgrade-death-blossom-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-death-blossom-2', 'description'),
        sfxKey: NINJA_SFX_SLASH,
        ...ninjaCardRef(29),
        effects: [replaceAbility('death-blossom', DEATH_BLOSSOM_2, 2, '升级死亡盛放至 II 级。')],
    },
    {
        id: 'ninja-card-vanish',
        name: cardText('ninja-card-vanish', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('ninja-card-vanish', 'description'),
        sfxKey: NINJA_SFX_SMOKE,
        ...ninjaCardRef(35),
        effects: [grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, '获得 1 个烟雾弹。')],
    },
    {
        id: 'ninja-card-dojo',
        name: cardText('ninja-card-dojo', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('ninja-card-dojo', 'description'),
        sfxKey: NINJA_SFX_SMOKE,
        ...ninjaCardRef(36),
        effects: [{
            description: '投掷 1 骰；若投出面具，获得烟雾弹与 2 忍术，否则抽 1。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 1,
                conditionalEffects: [{
                    face: NINJA_DICE_FACE_IDS.MASK,
                    grantTokens: [
                        { tokenId: TOKEN_IDS.SMOKE_BOMB, value: 1 },
                        { tokenId: TOKEN_IDS.NINJUTSU, value: 2 },
                    ],
                    effectKey: 'bonusDie.effect.ninjaDojoMask',
                }],
                defaultEffect: {
                    drawCard: 1,
                    effectKey: 'bonusDie.effect.ninjaDojoOther',
                },
            },
            timing: 'immediate',
        }],
    },
    ...injectCommonCardPreviewRefs(
        COMMON_CARDS,
        DICETHRONE_CARD_ATLAS_IDS.NINJA,
        TREANT_NINJA_COMMON_ATLAS_INDEX,
    ),
];

export const getNinjaStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck = NINJA_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
