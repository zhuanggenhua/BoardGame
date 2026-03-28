import type { CardPreviewRef } from '../../../../core';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { COMMON_CARDS } from '../../domain/commonCards';
import { TOKEN_IDS } from '../../domain/ids';
import type { AbilityCard } from '../../types';
import {
    BUDO_2,
    KATANA_SLICE_2,
    KATANA_SLICE_3,
    MASAMUNE_2,
    SAMURAI_SLOT_06_2,
    SOLEMNITY_2,
    STAND_TALL_2,
    WAKIZASHI_2,
    WAKIZASHI_3,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

const SAMURAI_CARD_CROP_BASE = 'dicethrone/images/samurai/crops/ability-cards';

const cropPreview = (fileName: string): CardPreviewRef => ({
    type: 'image',
    src: `${SAMURAI_CARD_CROP_BASE}/${fileName}`,
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

const COMMON_CARD_CROP_FILES: Record<string, string> = {
    'card-transfer-status': 'slot-00.webp',
    'card-what-status': 'slot-01.webp',
    'card-one-throw-fortune': 'slot-02.webp',
    'card-get-away': 'slot-03.webp',
    'card-super-double': 'slot-04.webp',
    'card-double': 'slot-05.webp',
    'card-bye-bye': 'slot-06.webp',
    'card-flick': 'slot-07.webp',
    'card-boss-generous': 'slot-08.webp',
    'card-next-time': 'slot-09.webp',
    'card-unexpected': 'slot-10.webp',
    'card-worthy-of-me': 'slot-11.webp',
    'card-surprise': 'slot-12.webp',
    'card-me-too': 'slot-13.webp',
    'card-i-can-again': 'slot-14.webp',
    'card-give-hand': 'slot-15.webp',
    'card-just-this': 'slot-16.webp',
    'card-play-six': 'slot-17.webp',
};

const injectSamuraiCommonPreviewRefs = (cards: AbilityCard[]): AbilityCard[] =>
    cards.map(card => {
        const cropFile = COMMON_CARD_CROP_FILES[card.id];
        if (!cropFile) return card;
        return { ...card, previewRef: cropPreview(cropFile) };
    });

export const SAMURAI_CARDS: AbilityCard[] = [
    {
        id: 'upgrade-katana-slice-2',
        name: cardText('upgrade-katana-slice-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-katana-slice-2', 'description'),
        previewRef: cropPreview('slot-18.webp'),
        effects: [replaceAbility('katana-slice', KATANA_SLICE_2, 2, '升级太刀斩至 II 级。')],
    },
    {
        id: 'upgrade-katana-slice-3',
        name: cardText('upgrade-katana-slice-3', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-katana-slice-3', 'description'),
        previewRef: cropPreview('slot-19.webp'),
        effects: [replaceAbility('katana-slice', KATANA_SLICE_3, 3, '升级太刀斩至 III 级。')],
    },
    {
        id: 'upgrade-wakizashi-2',
        name: cardText('upgrade-wakizashi-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-wakizashi-2', 'description'),
        previewRef: cropPreview('slot-20.webp'),
        effects: [replaceAbility('wakizashi', WAKIZASHI_2, 2, '升级胁差至 II 级。')],
    },
    {
        id: 'upgrade-wakizashi-3',
        name: cardText('upgrade-wakizashi-3', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-wakizashi-3', 'description'),
        previewRef: cropPreview('slot-21.webp'),
        effects: [replaceAbility('wakizashi', WAKIZASHI_3, 3, '升级胁差至 III 级。')],
    },
    {
        id: 'upgrade-solemnity-2',
        name: cardText('upgrade-solemnity-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-solemnity-2', 'description'),
        previewRef: cropPreview('slot-22.webp'),
        effects: [replaceAbility('solemnity', SOLEMNITY_2, 2, '升级肃穆之仪至 II 级。')],
    },
    {
        id: 'upgrade-budo-2',
        name: cardText('upgrade-budo-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-budo-2', 'description'),
        previewRef: cropPreview('slot-23.webp'),
        effects: [replaceAbility('budo', BUDO_2, 2, '升级武道至 II 级。')],
    },
    {
        id: 'upgrade-masamune-2',
        name: cardText('upgrade-masamune-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-masamune-2', 'description'),
        previewRef: cropPreview('slot-24.webp'),
        effects: [replaceAbility('masamune', MASAMUNE_2, 2, '升级正宗至 II 级。')],
    },
    {
        id: 'upgrade-slot-06-2',
        name: cardText('upgrade-slot-06-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-slot-06-2', 'description'),
        previewRef: cropPreview('slot-25.webp'),
        effects: [replaceAbility('samurai-slot-06', SAMURAI_SLOT_06_2, 2, '升级叶隐之心至 II 级。')],
    },
    {
        id: 'upgrade-stand-tall-2',
        name: cardText('upgrade-stand-tall-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-stand-tall-2', 'description'),
        previewRef: cropPreview('slot-26.webp'),
        effects: [replaceAbility('stand-tall', STAND_TALL_2, 2, '升级昂首无畏至 II 级。')],
    },
    {
        id: 'card-samurai-honor',
        name: cardText('card-samurai-honor', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-samurai-honor', 'description'),
        previewRef: cropPreview('slot-27.webp'),
        effects: [grantToken('self', TOKEN_IDS.HONOR, 2, '获得 2 个荣誉指示物。')],
    },
    {
        id: 'card-you-should-be-ashamed',
        name: cardText('card-you-should-be-ashamed', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-you-should-be-ashamed', 'description'),
        previewRef: cropPreview('slot-28.webp'),
        effects: [grantToken('opponent', TOKEN_IDS.SHAME, 2, '对手获得 2 层耻辱。')],
    },
    {
        id: 'card-no-retreat',
        name: cardText('card-no-retreat', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-no-retreat', 'description'),
        previewRef: cropPreview('slot-29.webp'),
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
        previewRef: cropPreview('slot-30.webp'),
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
        previewRef: cropPreview('slot-31.webp'),
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
    ...injectSamuraiCommonPreviewRefs(COMMON_CARDS),
];

export const getSamuraiStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck = SAMURAI_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
