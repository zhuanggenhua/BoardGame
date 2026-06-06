import { abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { STATUS_IDS, TOKEN_IDS, ZHANSHUJIA_DICE_FACE_IDS } from '../../domain/ids';

const FACE = ZHANSHUJIA_DICE_FACE_IDS;

export const ZHANSHUJIA_SFX_LIGHT = 'combat.general.forged_in_fury_vol_1.blade_impact.blade_impact_light';
export const ZHANSHUJIA_SFX_HEAVY = 'combat.general.forged_in_fury_vol_1.blade_impact.blade_impact_heavy';
export const ZHANSHUJIA_SFX_COMMAND = 'ui.general.casual_mobile_sound_fx_pack_vol.interactions.notifications.success';
export const ZHANSHUJIA_SFX_ULTIMATE = 'combat.general.forged_in_fury_vol_1.explosion.explosion_heavy';

const damage = (
    value: number,
    description: string,
    opts?: { timing?: EffectTiming; unblockable?: boolean; target?: 'opponent' | 'allOpponents'; damageScope?: 'attack' | 'direct' },
): AbilityEffect => ({
    description,
    action: {
        type: 'damage',
        target: opts?.target ?? 'opponent',
        value,
        ...(opts?.unblockable ? { unblockable: true } : {}),
        ...(opts?.damageScope ? { damageScope: opts.damageScope } : {}),
    },
    timing: opts?.timing,
});

const grantToken = (value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, value },
    timing: 'preDefense',
});

const grantStatus = (statusId: string, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value: 1 },
    timing: 'preDefense',
});

const custom = (
    customActionId: string,
    description: string,
    timing: EffectTiming = 'preDefense',
    target: 'self' | 'opponent' = 'self',
): AbilityEffect => ({
    description,
    action: { type: 'custom', target, customActionId },
    timing,
});

const drawCards = (value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'drawCard', target: 'self', drawCount: value },
    timing,
});

const SABRE_THRUST: AbilityDef = {
    id: 'sabre-thrust',
    name: abilityText('sabre-thrust', 'name'),
    type: 'offensive',
    description: abilityText('sabre-thrust', 'description'),
    sfxKey: ZHANSHUJIA_SFX_LIGHT,
    variants: [
        { id: 'sabre-thrust-3', trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 3 } }, effects: [damage(4, '造成 4 点伤害。')], priority: 1 },
        { id: 'sabre-thrust-4', trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 4 } }, effects: [damage(5, '造成 5 点伤害。')], priority: 2 },
        { id: 'sabre-thrust-5', trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 5 } }, effects: [damage(6, '造成 6 点伤害。')], priority: 3 },
    ],
};

export const SABRE_THRUST_2: AbilityDef = {
    id: 'sabre-thrust',
    name: abilityText('sabre-thrust-2', 'name'),
    type: 'offensive',
    description: abilityText('sabre-thrust-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_LIGHT,
    variants: [
        {
            id: 'sabre-thrust-2-3',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 3 } },
            effects: [
                custom('zhanshujia-bind-if-three-kind', '若投出 3 个相同数字，则对手获得紧缚。', 'preDefense', 'opponent'),
                damage(5, '造成 5 点伤害。'),
            ],
            priority: 1,
        },
        {
            id: 'sabre-thrust-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 4 } },
            effects: [
                custom('zhanshujia-bind-if-three-kind', '若投出 3 个相同数字，则对手获得紧缚。', 'preDefense', 'opponent'),
                damage(6, '造成 6 点伤害。'),
            ],
            priority: 2,
        },
        {
            id: 'sabre-thrust-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 5 } },
            effects: [
                custom('zhanshujia-bind-if-three-kind', '若投出 3 个相同数字，则对手获得紧缚。', 'preDefense', 'opponent'),
                damage(7, '造成 7 点伤害。'),
            ],
            priority: 3,
        },
    ],
};

const CARPET_BOMBING: AbilityDef = {
    id: 'carpet-bombing',
    name: abilityText('carpet-bombing', 'name'),
    type: 'utility',
    description: abilityText('carpet-bombing', 'description'),
    sfxKey: ZHANSHUJIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 2, [FACE.MEDAL]: 2 } },
    effects: [
        grantToken(1, '获得 1 战术优势。'),
        custom('zhanshujia-carpet-bombing-targets', '对 2 名不同对手造成 2 点附属伤害。'),
    ],
};

export const CARPET_BOMBING_2: AbilityDef = {
    id: 'carpet-bombing',
    name: abilityText('carpet-bombing-2', 'name'),
    type: 'utility',
    description: abilityText('carpet-bombing-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_HEAVY,
    variants: [
        {
            id: 'carpet-bombing-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 2, [FACE.MEDAL]: 2 } },
            effects: [
                grantToken(2, '获得 2 战术优势。'),
                custom('zhanshujia-carpet-bombing-targets', '对 2 名不同对手造成 2 点附属伤害。'),
            ],
            priority: 2,
        },
        {
            id: 'carpet-bombing-2-strategy',
            trigger: { type: 'diceSet', faces: { [FACE.BANNER]: 4 } },
            effects: [
                grantToken(3, '获得 3 战术优势。'),
                drawCards(2, '抽 2 张牌。'),
            ],
            priority: 1,
        },
    ],
};

const WAR_MONGER: AbilityDef = {
    id: 'war-monger',
    name: abilityText('war-monger', 'name'),
    type: 'utility',
    description: abilityText('war-monger', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 1, [FACE.BANNER]: 3 } },
    effects: [
        grantToken(1, '获得 1 战术优势。'),
        {
            description: '投 1 骰：军刀造成 5；旗帜获得 4 战术优势；勋章抽 1。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 1,
                conditionalEffects: [
                    { face: FACE.SABRE, bonusDamage: 5, effectKey: 'bonusDie.effect.zhanshujiaWarMongerSabre' },
                    { face: FACE.BANNER, grantToken: { tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, value: 4 }, effectKey: 'bonusDie.effect.zhanshujiaWarMongerBanner' },
                    { face: FACE.MEDAL, drawCard: 1, effectKey: 'bonusDie.effect.zhanshujiaWarMongerMedal' },
                ],
            },
            timing: 'preDefense',
        },
        custom('zhanshujia-war-monger-extra-offensive-roll', '立即进入额外进攻投掷阶段。', 'postDamage'),
    ],
};

export const WAR_MONGER_2: AbilityDef = {
    id: 'war-monger',
    name: abilityText('war-monger-2', 'name'),
    type: 'utility',
    description: abilityText('war-monger-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 1, [FACE.BANNER]: 3 } },
    effects: [
        grantToken(2, '获得 2 战术优势。'),
        custom('zhanshujia-war-monger-2-roll', '投 1 骰：军刀造成 6；旗帜获得 3 战术优势；勋章抽 1 并立即进入额外进攻投掷阶段。', 'preDefense', 'opponent'),
    ],
};

const DRUM_MOVEMENT: AbilityDef = {
    id: 'drum-movement',
    name: abilityText('drum-movement', 'name'),
    type: 'offensive',
    description: abilityText('drum-movement', 'description'),
    sfxKey: ZHANSHUJIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 3, [FACE.MEDAL]: 2 } },
    effects: [grantStatus(STATUS_IDS.BIND, '对手获得紧缚。'), damage(7, '造成 7 点伤害。')],
};

export const DRUM_MOVEMENT_2: AbilityDef = {
    id: 'drum-movement',
    name: abilityText('drum-movement-2', 'name'),
    type: 'offensive',
    description: abilityText('drum-movement-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_HEAVY,
    variants: [
        {
            id: 'drum-movement-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 3, [FACE.MEDAL]: 2 } },
            effects: [
                grantToken(1, '获得 1 战术优势。'),
                grantStatus(STATUS_IDS.BIND, '对手获得紧缚。'),
                damage(7, '造成 7 点伤害。'),
            ],
            priority: 2,
        },
        {
            id: 'drum-movement-2-indirect',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 3, [FACE.BANNER]: 1 } },
            effects: [
                grantToken(2, '获得 2 战术优势。'),
                damage(2, '造成 2 点不可防御伤害。', { unblockable: true }),
            ],
            priority: 1,
            tags: ['unblockable'],
        },
    ],
};

const FLANKING: AbilityDef = {
    id: 'flanking',
    name: abilityText('flanking', 'name'),
    type: 'offensive',
    description: abilityText('flanking', 'description'),
    sfxKey: ZHANSHUJIA_SFX_LIGHT,
    trigger: { type: 'smallStraight' },
    effects: [grantToken(1, '获得 1 战术优势。'), damage(6, '造成 6 点伤害。')],
};

export const FLANKING_2: AbilityDef = {
    id: 'flanking',
    name: abilityText('flanking-2', 'name'),
    type: 'offensive',
    description: abilityText('flanking-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_LIGHT,
    trigger: { type: 'smallStraight' },
    effects: [grantToken(2, '获得 2 战术优势。'), damage(6, '造成 6 点伤害。')],
};

const EXPAND_BATTLEFIELD: AbilityDef = {
    id: 'expand-battlefield',
    name: abilityText('expand-battlefield', 'name'),
    type: 'offensive',
    description: abilityText('expand-battlefield', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'largeStraight' },
    effects: [grantToken(2, '获得 2 战术优势。'), grantStatus(STATUS_IDS.BIND, '对手获得紧缚。'), damage(9, '造成 9 点伤害。')],
};

export const EXPAND_BATTLEFIELD_2: AbilityDef = {
    id: 'expand-battlefield',
    name: abilityText('expand-battlefield-2', 'name'),
    type: 'offensive',
    description: abilityText('expand-battlefield-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    variants: [
        {
            id: 'expand-battlefield-2-large-straight',
            trigger: { type: 'largeStraight' },
            effects: [grantToken(3, '获得 3 战术优势。'), grantStatus(STATUS_IDS.BIND, '对手获得紧缚。'), damage(9, '造成 9 点伤害。')],
            priority: 2,
        },
        {
            id: 'expand-battlefield-2-lockdown',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 1, [FACE.BANNER]: 2, [FACE.MEDAL]: 1 } },
            effects: [drawCards(2, '抽 2 张牌。'), grantStatus(STATUS_IDS.BIND, '对手获得紧缚。')],
            priority: 1,
        },
    ],
};

const STRATEGIC_SHIFT: AbilityDef = {
    id: 'strategic-shift',
    name: abilityText('strategic-shift', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('strategic-shift', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'diceSet', faces: { [FACE.MEDAL]: 4 } },
    effects: [grantToken(5, '获得 5 战术优势。'), damage(5, '造成 5 点不可防御伤害。', { unblockable: true })],
};

export const STRATEGIC_SHIFT_2: AbilityDef = {
    id: 'strategic-shift',
    name: abilityText('strategic-shift-2', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('strategic-shift-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    variants: [
        {
            id: 'strategic-shift-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.MEDAL]: 4 } },
            effects: [grantToken(5, '获得 5 战术优势。'), grantStatus(STATUS_IDS.BIND, '对手获得紧缚。'), damage(5, '造成 5 点不可防御伤害。', { unblockable: true })],
            priority: 2,
            tags: ['unblockable'],
        },
        {
            id: 'strategic-shift-2-recon',
            trigger: { type: 'diceSet', faces: { [FACE.MEDAL]: 3 } },
            effects: [grantToken(5, '获得 5 战术优势。')],
            priority: 1,
        },
    ],
};

const COUNTERMEASURES: AbilityDef = {
    id: 'countermeasures',
    name: abilityText('countermeasures', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('countermeasures', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
    effects: [
        custom('zhanshujia-countermeasures-defense', '防御掷 4 骰：每组 2 军刀造成 1 伤害；每个旗帜防止 1 伤害；每个勋章获得 1 战术优势。', 'withDamage'),
    ],
};

export const COUNTERMEASURES_2: AbilityDef = {
    id: 'countermeasures',
    name: abilityText('countermeasures-2', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('countermeasures-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        {
            description: '防御掷 5 骰：每组 2 军刀造成 1 伤害；每个旗帜防止 1 伤害；每个勋章获得 1 战术优势。',
            action: { type: 'custom', target: 'self', customActionId: 'zhanshujia-countermeasures-defense', params: { sabrePairDamage: 1 } },
            timing: 'withDamage',
        },
    ],
};

export const COUNTERMEASURES_3: AbilityDef = {
    id: 'countermeasures',
    name: abilityText('countermeasures-3', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('countermeasures-3', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        {
            description: '防御掷 5 骰：每组 2 军刀造成 2 伤害；每个旗帜防止 1 伤害；每个勋章获得 1 战术优势。',
            action: { type: 'custom', target: 'self', customActionId: 'zhanshujia-countermeasures-defense', params: { sabrePairDamage: 2 } },
            timing: 'withDamage',
        },
    ],
};

const HIGH_GROUND: AbilityDef = {
    id: 'high-ground',
    name: abilityText('high-ground', 'name'),
    type: 'offensive',
    tags: ['ultimate', 'uninterruptible'],
    description: abilityText('high-ground', 'description'),
    sfxKey: ZHANSHUJIA_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.MEDAL]: 5 } },
    effects: [
        grantStatus(STATUS_IDS.TARGETED, '对手获得锁定。'),
        grantStatus(STATUS_IDS.BIND, '对手获得紧缚。'),
        custom('zhanshujia-high-ground-cap-up-and-fill', '战术优势上限提升 1，并获得战术优势至当前上限。'),
        damage(12, '造成 12 点伤害。'),
    ],
};

export const ZHANSHUJIA_ABILITIES: AbilityDef[] = [
    SABRE_THRUST,
    CARPET_BOMBING,
    WAR_MONGER,
    DRUM_MOVEMENT,
    FLANKING,
    EXPAND_BATTLEFIELD,
    STRATEGIC_SHIFT,
    COUNTERMEASURES,
    HIGH_GROUND,
];
