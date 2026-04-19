import type { CardPreviewRef } from '../../../../core';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import {
    COMMON_CARDS,
    SAMURAI_COMMON_ATLAS_INDEX,
    injectCommonCardPreviewRefs,
} from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS, TOKEN_IDS } from '../../domain/ids';
import type { AbilityCard } from '../../types';
import {
    BUDO_2,
    KATANA_SLICE_2,
    KATANA_SLICE_3,
    MASAMUNE_2,
    SAMURAI_SFX_DEFENSE,
    SAMURAI_SFX_HEAVY,
    SAMURAI_SFX_LIGHT,
    SAMURAI_SFX_ULTIMATE,
    SAMURAI_SLOT_06_2,
    SOLEMNITY_2,
    STAND_TALL_2,
    WAKIZASHI_2,
    WAKIZASHI_3,
} from './abilities';
import {
    SAMURAI_TOKEN_SFX_HONOR,
    SAMURAI_TOKEN_SFX_RETRIBUTION,
    SAMURAI_TOKEN_SFX_SHAME,
} from './tokens';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

const SAMURAI_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.SAMURAI;

const atlasPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: SAMURAI_CARD_ATLAS_ID,
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

const grantToken = (
    target: 'self' | 'opponent',
    tokenId: string,
    value: number,
    description: string,
): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target, tokenId, value },
    timing: 'immediate',
});

export const SAMURAI_CARDS: AbilityCard[] = [
    {
        id: 'upgrade-katana-slice-2',
        name: cardText('upgrade-katana-slice-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-katana-slice-2', 'description'),
        sfxKey: SAMURAI_SFX_LIGHT,
        previewRef: atlasPreview(18),
        effects: [replaceAbility('katana-slice', KATANA_SLICE_2, 2, '升级太刀斩至 II 级。')],
    },
    {
        id: 'upgrade-katana-slice-3',
        name: cardText('upgrade-katana-slice-3', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-katana-slice-3', 'description'),
        sfxKey: SAMURAI_SFX_LIGHT,
        previewRef: atlasPreview(19),
        effects: [replaceAbility('katana-slice', KATANA_SLICE_3, 3, '升级太刀斩至 III 级。')],
    },
    {
        id: 'upgrade-wakizashi-2',
        name: cardText('upgrade-wakizashi-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-wakizashi-2', 'description'),
        sfxKey: SAMURAI_SFX_LIGHT,
        previewRef: atlasPreview(20),
        effects: [replaceAbility('wakizashi', WAKIZASHI_2, 2, '升级胁差至 II 级。')],
    },
    {
        id: 'upgrade-wakizashi-3',
        name: cardText('upgrade-wakizashi-3', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-wakizashi-3', 'description'),
        sfxKey: SAMURAI_SFX_LIGHT,
        previewRef: atlasPreview(21),
        effects: [replaceAbility('wakizashi', WAKIZASHI_3, 3, '升级胁差至 III 级。')],
    },
    {
        id: 'upgrade-solemnity-2',
        name: cardText('upgrade-solemnity-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-solemnity-2', 'description'),
        sfxKey: SAMURAI_SFX_HEAVY,
        previewRef: atlasPreview(22),
        effects: [replaceAbility('solemnity', SOLEMNITY_2, 2, '升级肃穆之仪至 II 级。')],
    },
    {
        id: 'upgrade-budo-2',
        name: cardText('upgrade-budo-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-budo-2', 'description'),
        sfxKey: SAMURAI_SFX_HEAVY,
        previewRef: atlasPreview(23),
        effects: [replaceAbility('budo', BUDO_2, 2, '升级武道至 II 级。')],
    },
    {
        id: 'upgrade-masamune-2',
        name: cardText('upgrade-masamune-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-masamune-2', 'description'),
        sfxKey: SAMURAI_SFX_HEAVY,
        previewRef: atlasPreview(24),
        effects: [replaceAbility('masamune', MASAMUNE_2, 2, '升级正宗至 II 级。')],
    },
    {
        id: 'upgrade-slot-06-2',
        name: cardText('upgrade-slot-06-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-slot-06-2', 'description'),
        sfxKey: SAMURAI_SFX_HEAVY,
        previewRef: atlasPreview(25),
        effects: [replaceAbility('samurai-slot-06', SAMURAI_SLOT_06_2, 2, '升级叶隐之心至 II 级。')],
    },
    {
        id: 'upgrade-stand-tall-2',
        name: cardText('upgrade-stand-tall-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-stand-tall-2', 'description'),
        sfxKey: SAMURAI_SFX_DEFENSE,
        previewRef: atlasPreview(26),
        effects: [replaceAbility('stand-tall', STAND_TALL_2, 2, '升级昂首无畏至 II 级。')],
    },
    {
        id: 'card-samurai-honor',
        name: cardText('card-samurai-honor', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-samurai-honor', 'description'),
        sfxKey: SAMURAI_TOKEN_SFX_HONOR,
        previewRef: atlasPreview(27),
        effects: [grantToken('self', TOKEN_IDS.HONOR, 2, '获得 2 个荣誉指示物。')],
    },
    {
        id: 'card-you-should-be-ashamed',
        name: cardText('card-you-should-be-ashamed', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-you-should-be-ashamed', 'description'),
        sfxKey: SAMURAI_TOKEN_SFX_SHAME,
        previewRef: atlasPreview(28),
        effects: [{
            description: '选择 1 位敌方玩家，使其获得 2 层耻辱。',
            action: { type: 'custom', target: 'self', customActionId: 'samurai-card-you-should-be-ashamed' },
            timing: 'immediate',
        }],
    },
    {
        id: 'card-no-retreat',
        name: cardText('card-no-retreat', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-no-retreat', 'description'),
        sfxKey: SAMURAI_TOKEN_SFX_RETRIBUTION,
        previewRef: atlasPreview(29),
        effects: [grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, '获得 1 个反击指示物。')],
    },
    {
        id: 'card-righteousness',
        name: cardText('card-righteousness', 'name'),
        type: 'action',
        // 费用来自 slot-30 左上费用区边缘模板比对，当前证据整体更偏向 2CP。
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-righteousness', 'description'),
        sfxKey: SAMURAI_SFX_HEAVY,
        previewRef: atlasPreview(30),
        isAttackModifier: true,
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [
            {
                description: '掷 1 颗骰子并获得该骰面的效果。',
                action: { type: 'custom', target: 'self', customActionId: 'samurai-card-righteousness' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-zanshin',
        name: cardText('card-zanshin', 'name'),
        type: 'action',
        // 费用来自 slot-31 右上角费用区模板比对，当前证据指向 2CP。
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-zanshin', 'description'),
        sfxKey: SAMURAI_SFX_ULTIMATE,
        previewRef: atlasPreview(31),
        isAttackModifier: true,
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [
            {
                description: '额外掷 5 颗骰子；每个武士刀 +1 伤害、每个头盔 +1 耻辱、每个旭日 +1 反击。',
                action: { type: 'custom', target: 'self', customActionId: 'samurai-masamune' },
                timing: 'immediate',
            },
        ],
    },
    ...injectCommonCardPreviewRefs(
        COMMON_CARDS,
        DICETHRONE_CARD_ATLAS_IDS.SAMURAI,
        SAMURAI_COMMON_ATLAS_INDEX,
    ),
];

export const getSamuraiStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck = SAMURAI_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
