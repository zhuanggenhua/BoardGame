/**
 * 狂战士英雄的技能定义
 * 基于详细面板截图修正
 */

import { BARBARIAN_DICE_FACE_IDS, STATUS_IDS } from '../../domain/ids';
import type { AbilityDef, AbilityEffect, EffectTiming, EffectCondition } from '../../domain/combat';
import { abilityText, abilityEffectText } from '../../../../engine/primitives/ability';

const BARBARIAN_SFX_LIGHT = 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
const BARBARIAN_SFX_HEAVY = 'combat.general.fight_fury_vol_2.versatile_punch_hit_with_blood.fghtimpt_versatile_punch_hit_with_blood_06_krst';
const BARBARIAN_SFX_ULTIMATE = 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_02_krst';

// 辅助函数
const damage = (value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'damage', target: 'opponent', value },
    timing: opts?.timing,
    condition: opts?.condition,
});

const heal = (value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'heal', target: 'self', value },
    timing: opts?.timing,
    condition: opts?.condition,
});

const inflictStatus = (statusId: string, value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
    timing: opts?.timing,
    condition: opts?.condition,
});

const removeStatus = (description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId: 'remove-status-self' },
    timing: opts?.timing,
    condition: opts?.condition,
});

// ============================================
// Level 1 技能 (已验证)
// ============================================

export const BARBARIAN_ABILITIES: AbilityDef[] = [
    {
        id: 'slap',
        name: abilityText('slap', 'name'),
        type: 'offensive',
        description: abilityText('slap', 'description'),
        sfxKey: BARBARIAN_SFX_LIGHT,
        variants: [
            { id: 'slap-3', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 3 } }, effects: [damage(4, abilityEffectText('slap', 'damage4'))], priority: 1 },
            { id: 'slap-4', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 4 } }, effects: [damage(6, abilityEffectText('slap', 'damage6'))], priority: 2 },
            { id: 'slap-5', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 5 } }, effects: [damage(8, abilityEffectText('slap', 'damage8'))], priority: 3 },
        ],
    },
    {
        id: 'all-out-strike',
        name: abilityText('all-out-strike', 'name'),
        type: 'offensive',
        description: abilityText('all-out-strike', 'description'),
        sfxKey: BARBARIAN_SFX_LIGHT,
        trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 2, [BARBARIAN_DICE_FACE_IDS.STRENGTH]: 2 } },
        effects: [damage(4, abilityEffectText('all-out-strike', 'damage4Unblockable'))],
        tags: ['unblockable'],
    },
    {
        id: 'powerful-strike',
        name: abilityText('powerful-strike', 'name'),
        type: 'offensive',
        description: abilityText('powerful-strike', 'description'),
        sfxKey: BARBARIAN_SFX_HEAVY,
        trigger: { type: 'smallStraight' },
        effects: [damage(9, abilityEffectText('powerful-strike', 'damage9'))],
    },
    {
        id: 'violent-assault',
        name: abilityText('violent-assault', 'name'),
        type: 'offensive',
        description: abilityText('violent-assault', 'description'),
        sfxKey: BARBARIAN_SFX_HEAVY,
        trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.STRENGTH]: 4 } },
        effects: [inflictStatus(STATUS_IDS.DAZE, 1, abilityEffectText('violent-assault', 'inflictDaze')), damage(5, abilityEffectText('violent-assault', 'damage5Unblockable'))],
        tags: ['unblockable'],
    },
    {
        id: 'steadfast',
        name: abilityText('steadfast', 'name'),
        type: 'offensive',
        description: abilityText('steadfast', 'description'),
        sfxKey: BARBARIAN_SFX_LIGHT,
        variants: [
            { id: 'steadfast-3', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.HEART]: 3 } }, effects: [heal(4, abilityEffectText('steadfast', 'heal4'))], priority: 1 },
            { id: 'steadfast-4', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.HEART]: 4 } }, effects: [heal(5, abilityEffectText('steadfast', 'heal5'))], priority: 2 },
            { id: 'steadfast-5', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.HEART]: 5 } }, effects: [heal(6, abilityEffectText('steadfast', 'heal6'))], priority: 3 },
        ],
    },
    {
        id: 'suppress',
        name: abilityText('suppress', 'name'),
        type: 'offensive',
        description: abilityText('suppress', 'description'),
        sfxKey: BARBARIAN_SFX_LIGHT,
        trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 2, [BARBARIAN_DICE_FACE_IDS.STRENGTH]: 2 } },
        effects: [
            {
                description: abilityEffectText('suppress', 'roll3Damage'),
                action: { type: 'custom', target: 'self', customActionId: 'barbarian-suppress-roll' },
                timing: 'withDamage',
            },
        ],
    },
    {
        id: 'reckless-strike',
        name: abilityText('reckless-strike', 'name'),
        type: 'offensive',
        description: abilityText('reckless-strike', 'description'),
        tags: ['ultimate'],
        sfxKey: BARBARIAN_SFX_ULTIMATE,
        trigger: { type: 'largeStraight' },
        effects: [damage(15, abilityEffectText('reckless-strike', 'damage15')), { description: abilityEffectText('reckless-strike', 'selfDamage4'), action: { type: 'damage', target: 'self', value: 4 }, timing: 'postDamage', condition: { type: 'onHit' } }],
    },
    {
        id: 'thick-skin',
        name: abilityText('thick-skin', 'name'),
        type: 'defensive',
        description: abilityText('thick-skin', 'description'),
        trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 3 },
        effects: [{ description: abilityEffectText('thick-skin', 'healByHearts'), action: { type: 'custom', target: 'self', customActionId: 'barbarian-thick-skin' }, timing: 'withDamage' }],
    },
];

// ============================================
// Level 2 升级
// ============================================

export const SLAP_2: AbilityDef = {
    id: 'slap',
    name: abilityText('slap-2', 'name'),
    type: 'offensive',
    description: abilityText('slap-2', 'description'),
    sfxKey: BARBARIAN_SFX_LIGHT,
    variants: [
        { id: 'slap-2-3', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 3 } }, effects: [damage(5, abilityEffectText('slap-2', 'damage5'))], priority: 1 },
        {
            id: 'slap-2-4',
            trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 4 } },
            effects: [damage(7, abilityEffectText('slap-2', 'damage7Unblockable'))],
            tags: ['unblockable'], // 变体支持 tags
            priority: 2
        },
        {
            id: 'slap-2-5',
            trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 5 } },
            effects: [damage(9, abilityEffectText('slap-2', 'damage9Unblockable'))],
            tags: ['unblockable'],
            priority: 3
        },
    ],
};

export const ALL_OUT_STRIKE_2: AbilityDef = {
    id: 'all-out-strike',
    name: abilityText('all-out-strike-2', 'name'),
    type: 'offensive',
    description: abilityText('all-out-strike-2', 'description'),
    sfxKey: BARBARIAN_SFX_LIGHT,
    trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 2, [BARBARIAN_DICE_FACE_IDS.STRENGTH]: 2 } },
    effects: [damage(5, abilityEffectText('all-out-strike-2', 'damage5Unblockable'))],
    tags: ['unblockable'],
};

export const POWERFUL_STRIKE_2: AbilityDef = {
    id: 'powerful-strike',
    name: abilityText('powerful-strike-2', 'name'),
    type: 'offensive',
    description: abilityText('powerful-strike-2', 'description'),
    sfxKey: BARBARIAN_SFX_HEAVY,
    trigger: { type: 'smallStraight' },
    effects: [damage(8, abilityEffectText('powerful-strike-2', 'damage8Unblockable'))],
    tags: ['unblockable'],
};

export const VIOLENT_ASSAULT_2: AbilityDef = {
    id: 'violent-assault',
    name: abilityText('violent-assault-2', 'name'),
    type: 'offensive',
    description: abilityText('violent-assault-2', 'description'),
    sfxKey: BARBARIAN_SFX_HEAVY,
    variants: [
        {
            id: 'violent-assault-2-crush',
            trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.STRENGTH]: 3 } },
            effects: [inflictStatus(STATUS_IDS.CONCUSSION, 1, abilityEffectText('violent-assault-2-crush', 'inflictConcussion')), damage(2, abilityEffectText('violent-assault-2-crush', 'damage2Unblockable'))],
            tags: ['unblockable'],
            priority: 1,
        },
        {
            id: 'violent-assault-2-shake',
            trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.STRENGTH]: 4 } },
            effects: [inflictStatus(STATUS_IDS.DAZE, 1, abilityEffectText('violent-assault-2-shake', 'inflictDaze')), damage(7, abilityEffectText('violent-assault-2-shake', 'damage7Unblockable'))],
            tags: ['unblockable'],
            priority: 2,
        },
    ],
};

export const STEADFAST_2: AbilityDef = {
    id: 'steadfast',
    name: abilityText('steadfast-2', 'name'),
    type: 'offensive',
    description: abilityText('steadfast-2', 'description'),
    sfxKey: BARBARIAN_SFX_LIGHT,
    variants: [
        { id: 'steadfast-2-3', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.HEART]: 3 } }, effects: [heal(5, abilityEffectText('steadfast-2', 'heal5')), removeStatus(abilityEffectText('steadfast-2', 'removeStatus'))], priority: 1 },
        { id: 'steadfast-2-4', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.HEART]: 4 } }, effects: [heal(6, abilityEffectText('steadfast-2', 'heal6')), removeStatus(abilityEffectText('steadfast-2', 'removeStatus'))], priority: 2 },
        { id: 'steadfast-2-5', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.HEART]: 5 } }, effects: [heal(7, abilityEffectText('steadfast-2', 'heal7')), removeStatus(abilityEffectText('steadfast-2', 'removeStatus'))], priority: 3 },
    ],
};

export const SUPPRESS_2: AbilityDef = {
    id: 'suppress',
    name: abilityText('suppress-2', 'name'),
    type: 'offensive',
    description: abilityText('suppress-2', 'description'),
    sfxKey: BARBARIAN_SFX_LIGHT,
    variants: [
        {
            id: 'suppress-2-battle-cry',
            trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 2, [BARBARIAN_DICE_FACE_IDS.HEART]: 2 } },
            effects: [heal(2, abilityEffectText('suppress-2-battle-cry', 'heal2')), damage(2, abilityEffectText('suppress-2-battle-cry', 'damage2Unblockable'))],
            tags: ['unblockable'],
            priority: 1,
        },
        {
            id: 'suppress-2-mighty',
            trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 2, [BARBARIAN_DICE_FACE_IDS.STRENGTH]: 2 } },
            effects: [
                {
                    description: abilityEffectText('suppress-2-mighty', 'roll3Damage'),
                    action: { type: 'custom', target: 'self', customActionId: 'barbarian-suppress-2-roll' },
                    timing: 'withDamage',
                },
            ],
            priority: 2,
        },
    ],
};

export const RECKLESS_STRIKE_2: AbilityDef = {
    id: 'reckless-strike',
    name: abilityText('reckless-strike-2', 'name'),
    type: 'offensive',
    description: abilityText('reckless-strike-2', 'description'),
    tags: ['ultimate'],
    sfxKey: BARBARIAN_SFX_ULTIMATE,
    trigger: { type: 'largeStraight' },
    effects: [damage(20, abilityEffectText('reckless-strike-2', 'damage20')), { description: abilityEffectText('reckless-strike-2', 'selfDamage5'), action: { type: 'damage', target: 'self', value: 5 }, timing: 'postDamage', condition: { type: 'onHit' } }],
};

export const THICK_SKIN_2: AbilityDef = {
    id: 'thick-skin',
    name: abilityText('thick-skin-2', 'name'),
    type: 'defensive',
    description: abilityText('thick-skin-2', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 }, // 4 骰
    effects: [{ description: abilityEffectText('thick-skin-2', 'healAndPrevent'), action: { type: 'custom', target: 'self', customActionId: 'barbarian-thick-skin-2' }, timing: 'withDamage' }],
};

// ============================================
// Level 3 升级
// ============================================

export const SLAP_3: AbilityDef = {
    id: 'slap',
    name: abilityText('slap-3', 'name'),
    type: 'offensive',
    description: abilityText('slap-3', 'description'),
    sfxKey: BARBARIAN_SFX_LIGHT,
    variants: [
        { id: 'slap-3-3', trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 3 } }, effects: [damage(6, abilityEffectText('slap-3', 'damage6'))], priority: 1 },
        {
            id: 'slap-3-4',
            trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 4 } },
            effects: [damage(8, abilityEffectText('slap-3', 'damage8Unblockable'))],
            tags: ['unblockable'],
            priority: 2
        },
        {
            id: 'slap-3-5',
            trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 5 } },
            effects: [damage(10, abilityEffectText('slap-3', 'damage10Unblockable'))],
            tags: ['unblockable'],
            priority: 3
        },
    ],
};

export const ALL_OUT_STRIKE_3: AbilityDef = {
    id: 'all-out-strike',
    name: abilityText('all-out-strike-3', 'name'),
    type: 'offensive',
    description: abilityText('all-out-strike-3', 'description'),
    sfxKey: BARBARIAN_SFX_LIGHT,
    trigger: { type: 'diceSet', faces: { [BARBARIAN_DICE_FACE_IDS.SWORD]: 2, [BARBARIAN_DICE_FACE_IDS.STRENGTH]: 2 } },
    effects: [damage(6, abilityEffectText('all-out-strike-3', 'damage6Unblockable'))],
    tags: ['unblockable'],
};
