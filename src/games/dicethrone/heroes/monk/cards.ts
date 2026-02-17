/**
 * 僧侣英雄的手牌定义
 */

import type { AbilityCard } from '../../types';
import { DICE_FACE_IDS, TOKEN_IDS, STATUS_IDS, DICETHRONE_CARD_ATLAS_IDS } from '../../domain/ids';
import { COMMON_CARDS, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import type { RandomFn } from '../../../../engine/types';
import type { AbilityEffect, AbilityDef, EffectTiming, EffectCondition } from '../../domain/combat';
import { abilityText, abilityEffectText } from '../../../../engine/primitives/ability';
import {
    MONK_SFX_PUNCH_1,
    MONK_SFX_PUNCH_2,
    MONK_SFX_PUNCH_3,
    MONK_SFX_KICK_1,
    MONK_SFX_KICK_2,
    MONK_SFX_THUNDER,
    MONK_SFX_ZEN,
} from './abilities';

/** 卡牌文本 i18n key 生成 */
const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

// 辅助函数
const damage = (value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'damage', target: 'opponent', value },
});

const grantToken = (
    tokenId: string,
    value: number,
    description: string,
    opts?: { timing?: EffectTiming; condition?: EffectCondition }
): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value },
    timing: opts?.timing,
    condition: opts?.condition,
});

const inflictStatus = (
    statusId: string,
    value: number,
    description: string,
    opts?: { timing?: EffectTiming; condition?: EffectCondition }
): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
    timing: opts?.timing ?? 'immediate',
    condition: opts?.condition,
});

const replaceAbility = (
    targetAbilityId: string,
    newAbilityDef: AbilityDef,
    newAbilityLevel: number,
    description: string
): AbilityEffect => ({
    description,
    action: { type: 'replaceAbility', target: 'self', targetAbilityId, newAbilityDef, newAbilityLevel },
    timing: 'immediate',
});

// ============================================
// 升级后的技能定义
// ============================================

const FIST_TECHNIQUE_2: AbilityDef = {
    id: 'fist-technique',
    name: abilityText('fist-technique-2', 'name'),
    type: 'offensive',
    description: abilityText('fist-technique-2', 'description'),
    sfxKey: MONK_SFX_PUNCH_1,
    variants: [
        { id: 'fist-technique-2-3', trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 3 } }, effects: [damage(7, abilityEffectText('fist-technique-2-3', 'damage7'))], priority: 1 },
        { id: 'fist-technique-2-4', trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 4 } }, effects: [damage(8, abilityEffectText('fist-technique-2-4', 'damage8'))], priority: 2 },
        { id: 'fist-technique-2-5', trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 5 } }, effects: [damage(9, abilityEffectText('fist-technique-2-5', 'damage9'))], priority: 3 },
    ],
};

const FIST_TECHNIQUE_3: AbilityDef = {
    id: 'fist-technique',
    name: abilityText('fist-technique-3', 'name'),
    type: 'offensive',
    description: abilityText('fist-technique-3', 'description'),
    sfxKey: MONK_SFX_PUNCH_1,
    variants: [
        { id: 'fist-technique-3-3', trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 3 } }, effects: [damage(7, abilityEffectText('fist-technique-3-3', 'damage7'))], priority: 1 },
        { id: 'fist-technique-3-4', trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 4 } }, effects: [damage(8, abilityEffectText('fist-technique-3-4', 'damage8')), inflictStatus(STATUS_IDS.KNOCKDOWN, 1, abilityEffectText('fist-technique-3-4', 'inflictKnockdown'))], priority: 2 },
        { id: 'fist-technique-3-5', trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 5 } }, effects: [damage(9, abilityEffectText('fist-technique-3-5', 'damage9')), inflictStatus(STATUS_IDS.KNOCKDOWN, 1, abilityEffectText('fist-technique-3-5', 'inflictKnockdown'))], priority: 3 },
    ],
};

const MEDITATION_2: AbilityDef = {
    id: 'meditation',
    name: abilityText('meditation-2', 'name'),
    type: 'defensive',
    description: abilityText('meditation-2', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        { description: abilityEffectText('meditation-2', 'taijiByResult'), action: { type: 'custom', target: 'self', customActionId: 'meditation-2-taiji' }, timing: 'withDamage' },
        { description: abilityEffectText('meditation-2', 'damageByFist'), action: { type: 'custom', target: 'opponent', customActionId: 'meditation-2-damage' }, timing: 'withDamage' },
    ],
};

const MEDITATION_3: AbilityDef = {
    id: 'meditation',
    name: abilityText('meditation-3', 'name'),
    type: 'defensive',
    description: abilityText('meditation-3', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        { description: abilityEffectText('meditation-3', 'taijiByResult'), action: { type: 'custom', target: 'self', customActionId: 'meditation-3-taiji' }, timing: 'withDamage' },
        { description: abilityEffectText('meditation-3', 'damageByFist'), action: { type: 'custom', target: 'opponent', customActionId: 'meditation-3-damage' }, timing: 'withDamage' },
    ],
};

const LOTUS_PALM_2: AbilityDef = {
    id: 'lotus-palm',
    name: abilityText('lotus-palm-2', 'name'),
    type: 'offensive',
    description: abilityText('lotus-palm-2', 'description'),
    tags: ['unblockable'],
    sfxKey: MONK_SFX_KICK_2,
    variants: [
        { id: 'lotus-palm-2-3', trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.LOTUS]: 3 } }, effects: [damage(2, abilityEffectText('lotus-palm-2-3', 'damage2')), grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('lotus-palm-2-3', 'gainEvasive'), { timing: 'postDamage', condition: { type: 'onHit' } }), grantToken(TOKEN_IDS.TAIJI, 2, abilityEffectText('lotus-palm-2-3', 'gainTaiji2'), { timing: 'postDamage', condition: { type: 'onHit' } })], priority: 0 },
        { id: 'lotus-palm-2-4', trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.LOTUS]: 4 } }, effects: [damage(6, abilityEffectText('lotus-palm-2-4', 'damage6')), { description: abilityEffectText('lotus-palm-2-4', 'taijiCapUp'), action: { type: 'custom', target: 'self', customActionId: 'lotus-palm-taiji-cap-up-and-fill' }, timing: 'postDamage', condition: { type: 'onHit' } }], priority: 1 },
        { id: 'lotus-palm-2-5', trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.LOTUS]: 5 } }, effects: [damage(10, abilityEffectText('lotus-palm-2-5', 'damage10')), grantToken(TOKEN_IDS.TAIJI, 6, abilityEffectText('lotus-palm-2-5', 'taijiCapMax'), { timing: 'postDamage', condition: { type: 'onHit' } })], priority: 2 },
    ],
};

const TAIJI_COMBO_2: AbilityDef = {
    id: 'taiji-combo',
    name: abilityText('taiji-combo-2', 'name'),
    type: 'offensive',
    description: abilityText('taiji-combo-2', 'description'),
    sfxKey: MONK_SFX_KICK_1,
    trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 3, [DICE_FACE_IDS.PALM]: 1 } },
    effects: [
        { description: abilityEffectText('taiji-combo-2', 'rollDie'), action: { type: 'rollDie', target: 'self', diceCount: 2, conditionalEffects: [{ face: DICE_FACE_IDS.FIST, bonusDamage: 2 }, { face: DICE_FACE_IDS.PALM, bonusDamage: 3 }, { face: DICE_FACE_IDS.TAIJI, grantToken: { tokenId: TOKEN_IDS.TAIJI, value: 2 } }, { face: DICE_FACE_IDS.LOTUS, triggerChoice: { titleKey: 'choices.evasiveOrPurifyToken', options: [{ tokenId: TOKEN_IDS.EVASIVE, value: 1 }, { tokenId: TOKEN_IDS.PURIFY, value: 1 }] } }] }, timing: 'withDamage' },
        damage(5, abilityEffectText('taiji-combo-2', 'damage5')),
    ],
};

const THUNDER_STRIKE_2: AbilityDef = {
    id: 'thunder-strike',
    name: abilityText('thunder-strike-2', 'name'),
    type: 'offensive',
    description: abilityText('thunder-strike-2', 'description'),
    sfxKey: MONK_SFX_THUNDER,
    trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.PALM]: 3 } },
    effects: [
        { description: abilityEffectText('thunder-strike-2', 'roll3Damage'), action: { type: 'custom', target: 'opponent', customActionId: 'thunder-strike-2-roll-damage' }, timing: 'withDamage' },
        { description: abilityEffectText('thunder-strike-2', 'rerollOne') },
    ],
};

const CALM_WATER_2: AbilityDef = {
    id: 'calm-water',
    name: abilityText('calm-water-2', 'name'),
    type: 'offensive',
    description: abilityText('calm-water-2', 'description'),
    sfxKey: MONK_SFX_PUNCH_3,
    variants: [
        { id: 'calm-water-2-way-of-monk', trigger: { type: 'allSymbolsPresent', symbols: [DICE_FACE_IDS.FIST, DICE_FACE_IDS.PALM, DICE_FACE_IDS.TAIJI, DICE_FACE_IDS.LOTUS] }, effects: [grantToken(TOKEN_IDS.EVASIVE, 2, abilityEffectText('calm-water-2-way-of-monk', 'gainEvasive2')), damage(3, abilityEffectText('calm-water-2-way-of-monk', 'damage3'))], priority: 0, tags: ['unblockable'] },
        { id: 'calm-water-2-large-straight', trigger: { type: 'largeStraight' }, effects: [damage(9, abilityEffectText('calm-water-2', 'damage9')), grantToken(TOKEN_IDS.TAIJI, 3, abilityEffectText('calm-water-2', 'gainTaiji3'), { timing: 'postDamage', condition: { type: 'onHit' } }), grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('calm-water-2', 'gainEvasive'), { timing: 'postDamage', condition: { type: 'onHit' } }), inflictStatus(STATUS_IDS.KNOCKDOWN, 1, abilityEffectText('calm-water-2', 'inflictKnockdown'), { timing: 'postDamage', condition: { type: 'onHit' } })], priority: 1 },
    ],
};

const HARMONY_2: AbilityDef = {
    id: 'harmony',
    name: abilityText('harmony-2', 'name'),
    type: 'offensive',
    description: abilityText('harmony-2', 'description'),
    sfxKey: MONK_SFX_PUNCH_2,
    trigger: { type: 'smallStraight' },
    effects: [damage(6, abilityEffectText('harmony-2', 'damage6')), grantToken(TOKEN_IDS.TAIJI, 3, abilityEffectText('harmony-2', 'gainTaiji3'), { timing: 'postDamage', condition: { type: 'onHit' } })],
};

const ZEN_FORGET_2: AbilityDef = {
    id: 'zen-forget',
    name: abilityText('zen-forget-2', 'name'),
    type: 'offensive',
    description: abilityText('zen-forget-2', 'description'),
    sfxKey: MONK_SFX_ZEN,
    variants: [
        { id: 'zen-forget-2-zen-combat', trigger: { type: 'allSymbolsPresent', symbols: [DICE_FACE_IDS.FIST, DICE_FACE_IDS.PALM, DICE_FACE_IDS.TAIJI] }, effects: [damage(6, abilityEffectText('zen-forget-2-zen-combat', 'damage6')), grantToken(TOKEN_IDS.TAIJI, 2, abilityEffectText('zen-forget-2-zen-combat', 'gainTaiji2'), { timing: 'postDamage', condition: { type: 'onHit' } })], priority: 0 },
        { id: 'zen-forget-2-3', trigger: { type: 'diceSet', faces: { [DICE_FACE_IDS.TAIJI]: 3 } }, effects: [grantToken(TOKEN_IDS.TAIJI, 6, abilityEffectText('zen-forget-2', 'gainTaiji6')), grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('zen-forget-2', 'gainEvasive')), grantToken(TOKEN_IDS.PURIFY, 1, abilityEffectText('zen-forget-2', 'gainPurify'))], priority: 1 },
    ],
};

// ============================================
// 手牌定义
// ============================================

export const MONK_CARDS: AbilityCard[] = [
    // 专属行动卡
    { id: 'card-enlightenment', name: cardText('card-enlightenment', 'name'), type: 'action', cpCost: 0, timing: 'main', description: cardText('card-enlightenment', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 0 }, effects: [{
        description: '投掷1骰：莲花→获得2气+闪避+净化；否则抽1牌',
        action: {
            type: 'rollDie', target: 'self', diceCount: 1,
            conditionalEffects: [
                { face: DICE_FACE_IDS.LOTUS, grantTokens: [
                    { tokenId: TOKEN_IDS.TAIJI, value: 2 },
                    { tokenId: TOKEN_IDS.EVASIVE, value: 1 },
                    { tokenId: TOKEN_IDS.PURIFY, value: 1 },
                ], effectKey: 'bonusDie.effect.enlightenmentLotus' },
            ],
            defaultEffect: { drawCard: 1 },
        },
        timing: 'immediate',
    }] },
    { id: 'card-inner-peace', name: cardText('card-inner-peace', 'name'), type: 'action', cpCost: 0, timing: 'instant', description: cardText('card-inner-peace', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 1 }, effects: [grantToken(TOKEN_IDS.TAIJI, 2, '获得2太极', { timing: 'immediate' })] },
    { id: 'card-deep-thought', name: cardText('card-deep-thought', 'name'), type: 'action', cpCost: 3, timing: 'instant', description: cardText('card-deep-thought', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 2 }, effects: [grantToken(TOKEN_IDS.TAIJI, 5, '获得5太极', { timing: 'immediate' })] },
    { id: 'card-buddha-light', name: cardText('card-buddha-light', 'name'), type: 'action', cpCost: 3, timing: 'main', description: cardText('card-buddha-light', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 3 }, effects: [grantToken(TOKEN_IDS.TAIJI, 1, '获得1太极', { timing: 'immediate' }), grantToken(TOKEN_IDS.EVASIVE, 1, '获得1闪避', { timing: 'immediate' }), grantToken(TOKEN_IDS.PURIFY, 1, '获得1净化', { timing: 'immediate' }), inflictStatus(STATUS_IDS.KNOCKDOWN, 1, '对手倒地')] },
    { id: 'card-palm-strike', name: cardText('card-palm-strike', 'name'), type: 'action', cpCost: 0, timing: 'main', description: cardText('card-palm-strike', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 4 }, effects: [inflictStatus(STATUS_IDS.KNOCKDOWN, 1, '对手倒地')] },

    // 升级卡
    { id: 'card-meditation-3', name: cardText('card-meditation-3', 'name'), type: 'upgrade', cpCost: 3, timing: 'main', description: cardText('card-meditation-3', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 5 }, effects: [replaceAbility('meditation', MEDITATION_3, 3, '升级清修至 III 级')] },
    { id: 'card-meditation-2', name: cardText('card-meditation-2', 'name'), type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('card-meditation-2', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 6 }, effects: [replaceAbility('meditation', MEDITATION_2, 2, '升级清修至 II 级')] },
    { id: 'card-zen-fist-2', name: cardText('card-zen-fist-2', 'name'), type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('card-zen-fist-2', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 7 }, effects: [replaceAbility('calm-water', CALM_WATER_2, 2, '升级定水神拳至 II 级')] },
    { id: 'card-storm-assault-2', name: cardText('card-storm-assault-2', 'name'), type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('card-storm-assault-2', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 8 }, effects: [replaceAbility('thunder-strike', THUNDER_STRIKE_2, 2, '升级雷霆一击至 II 级')] },
    { id: 'card-combo-punch-2', name: cardText('card-combo-punch-2', 'name'), type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('card-combo-punch-2', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 9 }, effects: [replaceAbility('taiji-combo', TAIJI_COMBO_2, 2, '升级太极连环拳至 II 级')] },
    { id: 'card-lotus-bloom-2', name: cardText('card-lotus-bloom-2', 'name'), type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('card-lotus-bloom-2', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 10 }, effects: [replaceAbility('lotus-palm', LOTUS_PALM_2, 2, '升级花开见佛至 II 级')] },
    { id: 'card-mahayana-2', name: cardText('card-mahayana-2', 'name'), type: 'upgrade', cpCost: 1, timing: 'main', description: cardText('card-mahayana-2', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 11 }, effects: [replaceAbility('harmony', HARMONY_2, 2, '升级和谐之力至 II 级')] },
    { id: 'card-thrust-punch-2', name: cardText('card-thrust-punch-2', 'name'), type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('card-thrust-punch-2', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 12 }, effects: [replaceAbility('fist-technique', FIST_TECHNIQUE_2, 2, '升级拳法至 II 级')] },
    { id: 'card-thrust-punch-3', name: cardText('card-thrust-punch-3', 'name'), type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('card-thrust-punch-3', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 13 }, effects: [replaceAbility('fist-technique', FIST_TECHNIQUE_3, 3, '升级拳法至 III 级')] },
    { id: 'card-contemplation-2', name: cardText('card-contemplation-2', 'name'), type: 'upgrade', cpCost: 2, timing: 'main', description: cardText('card-contemplation-2', 'description'), previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 14 }, effects: [replaceAbility('zen-forget', ZEN_FORGET_2, 2, '升级禅忘至 II 级')] },

    // 注入通用卡牌（带图集预览引用）
    ...injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.MONK),
];

export const getMonkStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck: AbilityCard[] = [];
    MONK_CARDS.forEach(card => {
        if (card.type === 'upgrade') {
            deck.push({ ...card });
        } else {
            deck.push({ ...card });
            deck.push({ ...card });
        }
    });
    return random.shuffle(deck);
};

export default MONK_CARDS;
