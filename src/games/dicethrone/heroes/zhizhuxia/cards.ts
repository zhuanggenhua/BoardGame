/** 蜘蛛侠专属卡牌与公共卡牌。卡图索引来自正式 5×7 物理卡图合同。 */

import type { CardPreviewRef } from '../../../../core';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityCard } from '../../types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { abilityEffectText } from '../../../../engine/primitives/ability';
import {
    COMMON_CARDS,
    injectCommonCardPreviewRefs,
    type CommonCardAtlasIndexMap,
} from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS, TOKEN_IDS, ZHIZHUXIA_DICE_FACE_IDS as FACE } from '../../domain/ids';
import {
    COMBO_STRIKE_2,
    HEAVY_PUNCH_2,
    TRAP_2,
    VENOM_PUNCH_2,
    ZHIZHUXIA_SFX_HEAVY,
    ZHIZHUXIA_SFX_LIGHT,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

const ZHIZHUXIA_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.ZHIZHUXIA;

export const ZHIZHUXIA_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
    'card-transfer-status': 0,
    'card-what-status': 1,
    'card-one-throw-fortune': 2,
    'card-get-away': 3,
    'card-super-double': 4,
    'card-double': 5,
    'card-bye-bye': 6,
    'card-flick': 7,
    'card-boss-generous': 8,
    'card-next-time': 9,
    'card-unexpected': 10,
    'card-worthy-of-me': 11,
    'card-surprise': 12,
    'card-me-too': 13,
    'card-i-can-again': 14,
    'card-give-hand': 15,
    'card-just-this': 16,
    'card-play-six': 17,
};

const atlasPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: ZHIZHUXIA_CARD_ATLAS_ID,
    index,
});

const zhizhuxiaCardRef = (index: number) => ({
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

const customAction = (
    customActionId: string,
    description: string,
    target: 'self' | 'opponent' = 'self',
    params?: Record<string, string | number | boolean>,
): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target,
        customActionId,
        ...(params ? { params } : {}),
    },
    timing: 'immediate',
});

const grantToken = (tokenId: string, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value: 1 },
    timing: 'immediate',
});

const ZHIZHUXIA_HERO_CARDS: AbilityCard[] = [
    {
        id: 'upgrade-zhizhuxia-heavy-punch-2',
        name: cardText('upgrade-zhizhuxia-heavy-punch-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-zhizhuxia-heavy-punch-2', 'description'),
        sfxKey: ZHIZHUXIA_SFX_HEAVY,
        ...zhizhuxiaCardRef(18),
        effects: [replaceAbility('heavy-punch', HEAVY_PUNCH_2, 2, cardText('upgrade-zhizhuxia-heavy-punch-2', 'description'))],
    },
    {
        id: 'upgrade-zhizhuxia-combo-strike-2',
        name: cardText('upgrade-zhizhuxia-combo-strike-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-zhizhuxia-combo-strike-2', 'description'),
        sfxKey: ZHIZHUXIA_SFX_HEAVY,
        ...zhizhuxiaCardRef(19),
        effects: [replaceAbility('combo-strike', COMBO_STRIKE_2, 2, cardText('upgrade-zhizhuxia-combo-strike-2', 'description'))],
    },
    {
        id: 'upgrade-zhizhuxia-trap-2',
        name: cardText('upgrade-zhizhuxia-trap-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-zhizhuxia-trap-2', 'description'),
        sfxKey: ZHIZHUXIA_SFX_HEAVY,
        ...zhizhuxiaCardRef(20),
        effects: [replaceAbility('trap', TRAP_2, 2, cardText('upgrade-zhizhuxia-trap-2', 'description'))],
    },
    {
        id: 'upgrade-zhizhuxia-venom-punch-2',
        name: cardText('upgrade-zhizhuxia-venom-punch-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-zhizhuxia-venom-punch-2', 'description'),
        sfxKey: ZHIZHUXIA_SFX_HEAVY,
        ...zhizhuxiaCardRef(21),
        effects: [replaceAbility('venom-punch', VENOM_PUNCH_2, 2, cardText('upgrade-zhizhuxia-venom-punch-2', 'description'))],
    },
    {
        id: 'card-zhizhuxia-milkshake',
        name: cardText('card-zhizhuxia-milkshake', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-zhizhuxia-milkshake', 'description'),
        sfxKey: ZHIZHUXIA_SFX_LIGHT,
        ...zhizhuxiaCardRef(22),
        effects: [{ description: abilityEffectText('card-zhizhuxia-milkshake', 'heal3'), action: { type: 'heal', target: 'self', value: 3 }, timing: 'immediate' }],
    },
    {
        id: 'card-zhizhuxia-wallet-arrival',
        name: cardText('card-zhizhuxia-wallet-arrival', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-zhizhuxia-wallet-arrival', 'description'),
        sfxKey: ZHIZHUXIA_SFX_LIGHT,
        ...zhizhuxiaCardRef(23),
        effects: [customAction('gain-cp', abilityEffectText('card-zhizhuxia-wallet-arrival', 'gain2CP'), 'self', { amount: 2 })],
    },
    {
        id: 'card-zhizhuxia-spider-launcher',
        name: cardText('card-zhizhuxia-spider-launcher', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-zhizhuxia-spider-launcher', 'description'),
        sfxKey: ZHIZHUXIA_SFX_HEAVY,
        ...zhizhuxiaCardRef(24),
        effects: [customAction('zhizhuxia-apply-webbed', abilityEffectText('card-zhizhuxia-spider-launcher', 'applyWebbed'), 'opponent')],
    },
    {
        id: 'card-zhizhuxia-praise',
        name: cardText('card-zhizhuxia-praise', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-zhizhuxia-praise', 'description'),
        sfxKey: ZHIZHUXIA_SFX_LIGHT,
        ...zhizhuxiaCardRef(25),
        effects: [customAction('zhizhuxia-praise-roll', abilityEffectText('card-zhizhuxia-praise', 'roll1'), 'opponent')],
    },
    {
        id: 'card-zhizhuxia-flying-escape',
        name: cardText('card-zhizhuxia-flying-escape', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-zhizhuxia-flying-escape', 'description'),
        sfxKey: ZHIZHUXIA_SFX_LIGHT,
        ...zhizhuxiaCardRef(26),
        playCondition: { phase: 'defensiveRoll', requireIsRoller: true, requireHasRolled: true, requireDiceExists: true },
        effects: [customAction('zhizhuxia-flying-escape', abilityEffectText('card-zhizhuxia-flying-escape', 'acceptWeb'), 'self')],
    },
    {
        id: 'card-zhizhuxia-ambush',
        name: cardText('card-zhizhuxia-ambush', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('card-zhizhuxia-ambush', 'description'),
        sfxKey: ZHIZHUXIA_SFX_HEAVY,
        ...zhizhuxiaCardRef(27),
        isAttackModifier: true,
        playCondition: { phase: 'offensiveRoll', requireIsRoller: true, requireHasRolled: true, requireDiceExists: true, requireTokenStacks: { tokenId: TOKEN_IDS.INVISIBLE, min: 1 } },
        effects: [customAction('zhizhuxia-ambush', abilityEffectText('card-zhizhuxia-ambush', 'discardInvisibleAndAdd3'), 'self')],
    },
    {
        id: 'card-zhizhuxia-invisible-punch',
        name: cardText('card-zhizhuxia-invisible-punch', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-zhizhuxia-invisible-punch', 'description'),
        sfxKey: ZHIZHUXIA_SFX_HEAVY,
        ...zhizhuxiaCardRef(28),
        playCondition: { pendingDamage: { role: 'target', responseType: 'beforeDamageReceived' } },
        effects: [customAction('zhizhuxia-invisible-punch', abilityEffectText('card-zhizhuxia-invisible-punch', 'counter3'), 'opponent')],
    },
    {
        id: 'card-zhizhuxia-wishful-thinking',
        name: cardText('card-zhizhuxia-wishful-thinking', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('card-zhizhuxia-wishful-thinking', 'description'),
        sfxKey: ZHIZHUXIA_SFX_LIGHT,
        ...zhizhuxiaCardRef(29),
        playCondition: { pendingDamage: { role: 'target', responseType: 'beforeDamageReceived' }, requireTokenStacks: { tokenId: TOKEN_IDS.INVISIBLE, min: 1 } },
        effects: [customAction('zhizhuxia-wishful-thinking', abilityEffectText('card-zhizhuxia-wishful-thinking', 'prevent3'), 'self')],
    },
    {
        id: 'card-zhizhuxia-oh-no',
        name: cardText('card-zhizhuxia-oh-no', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-zhizhuxia-oh-no', 'description'),
        sfxKey: ZHIZHUXIA_SFX_LIGHT,
        ...zhizhuxiaCardRef(30),
        effects: [grantToken(TOKEN_IDS.INVISIBLE, abilityEffectText('card-zhizhuxia-oh-no', 'gainInvisible'))],
    },
    {
        id: 'card-zhizhuxia-radioactive-blood',
        name: cardText('card-zhizhuxia-radioactive-blood', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'instant',
        description: cardText('card-zhizhuxia-radioactive-blood', 'description'),
        sfxKey: ZHIZHUXIA_SFX_HEAVY,
        ...zhizhuxiaCardRef(31),
        effects: [grantToken(TOKEN_IDS.COMBO, abilityEffectText('card-zhizhuxia-radioactive-blood', 'gainCombo'))],
    },
    {
        id: 'card-zhizhuxia-head-tingle',
        name: cardText('card-zhizhuxia-head-tingle', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-zhizhuxia-head-tingle', 'description'),
        sfxKey: ZHIZHUXIA_SFX_LIGHT,
        ...zhizhuxiaCardRef(32),
        effects: [{
            description: abilityEffectText('card-zhizhuxia-head-tingle', 'roll1'),
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 1,
                conditionalEffects: [{
                    face: FACE.SPIDER,
                    grantTokens: [
                        { tokenId: TOKEN_IDS.COMBO, value: 1, target: 'self' },
                        { tokenId: TOKEN_IDS.INVISIBLE, value: 1, target: 'self' },
                    ],
                    effectKey: 'bonusDie.effect.zhizhuxia.headTingle.spider',
                }],
                defaultEffect: { drawCard: 1, effectKey: 'bonusDie.effect.zhizhuxia.headTingle.other' },
                resolutionMode: 'none',
            },
            timing: 'immediate',
        }],
    },
];

export const ZHIZHUXIA_CARDS: AbilityCard[] = [
    ...ZHIZHUXIA_HERO_CARDS,
    ...injectCommonCardPreviewRefs(COMMON_CARDS, ZHIZHUXIA_CARD_ATLAS_ID, ZHIZHUXIA_COMMON_ATLAS_INDEX),
];

export const getZhizhuxiaStartingDeck = (random: RandomFn): AbilityCard[] => random.shuffle(
    ZHIZHUXIA_CARDS.map(card => ({ ...card })),
);

export default ZHIZHUXIA_CARDS;
