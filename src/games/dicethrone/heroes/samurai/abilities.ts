import { abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { SAMURAI_DICE_FACE_IDS, TOKEN_IDS } from '../../domain/ids';

const FACE = SAMURAI_DICE_FACE_IDS;

const damage = (
    value: number,
    description: string,
    opts?: { timing?: EffectTiming; unblockable?: boolean },
): AbilityEffect => ({
    description,
    action: { type: 'damage', target: 'opponent', value, unblockable: opts?.unblockable },
    timing: opts?.timing,
});

const grantToken = (
    target: 'self' | 'opponent',
    tokenId: string,
    value: number,
    description: string,
    timing: EffectTiming = 'preDefense',
): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target, tokenId, value },
    timing,
});

const custom = (
    customActionId: string,
    description: string,
    timing: EffectTiming = 'withDamage',
    params?: Record<string, unknown>,
): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId, params },
    timing,
});

const KATANA_SLICE: AbilityDef = {
    id: 'katana-slice',
    name: abilityText('katana-slice', 'name'),
    type: 'offensive',
    description: abilityText('katana-slice', 'description'),
    variants: [
        {
            id: 'katana-slice-3',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3 } },
            effects: [damage(5, '造成 5 点伤害。')],
            priority: 1,
        },
        {
            id: 'katana-slice-4',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 4 } },
            effects: [damage(6, '造成 6 点伤害。')],
            priority: 2,
        },
        {
            id: 'katana-slice-5',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 5 } },
            effects: [damage(7, '造成 7 点伤害。')],
            priority: 3,
        },
    ],
};

export const KATANA_SLICE_2: AbilityDef = {
    id: 'katana-slice',
    name: abilityText('katana-slice-2', 'name'),
    type: 'offensive',
    description: abilityText('katana-slice-2', 'description'),
    variants: [
        {
            id: 'katana-slice-2-3',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3 } },
            effects: [
                custom('samurai-katana-slice-threshold-4', '若至少有 4 颗骰子的点数相同，则对手获得 1 层耻辱。', 'preDefense'),
                damage(6, '造成 6 点伤害。'),
            ],
            priority: 1,
        },
        {
            id: 'katana-slice-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 4 } },
            effects: [
                custom('samurai-katana-slice-threshold-4', '若至少有 4 颗骰子的点数相同，则对手获得 1 层耻辱。', 'preDefense'),
                damage(7, '造成 7 点伤害。'),
            ],
            priority: 2,
        },
        {
            id: 'katana-slice-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 5 } },
            effects: [
                custom('samurai-katana-slice-threshold-4', '若至少有 4 颗骰子的点数相同，则对手获得 1 层耻辱。', 'preDefense'),
                damage(8, '造成 8 点伤害。'),
            ],
            priority: 3,
        },
    ],
};

export const KATANA_SLICE_3: AbilityDef = {
    id: 'katana-slice',
    name: abilityText('katana-slice-3', 'name'),
    type: 'offensive',
    description: abilityText('katana-slice-3', 'description'),
    variants: [
        {
            id: 'katana-slice-3-3',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3 } },
            effects: [
                custom('samurai-katana-slice-threshold-3', '若至少有 3 颗骰子的点数相同，则对手获得 1 层耻辱。', 'preDefense'),
                damage(6, '造成 6 点伤害。'),
            ],
            priority: 1,
        },
        {
            id: 'katana-slice-3-4',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 4 } },
            effects: [
                custom('samurai-katana-slice-threshold-3', '若至少有 3 颗骰子的点数相同，则对手获得 1 层耻辱。', 'preDefense'),
                damage(7, '造成 7 点伤害。'),
            ],
            priority: 2,
        },
        {
            id: 'katana-slice-3-5',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 5 } },
            effects: [
                custom('samurai-katana-slice-threshold-3', '若至少有 3 颗骰子的点数相同，则对手获得 1 层耻辱。', 'preDefense'),
                damage(8, '造成 8 点伤害。'),
            ],
            priority: 3,
        },
    ],
};

const WAKIZASHI: AbilityDef = {
    id: 'wakizashi',
    name: abilityText('wakizashi', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('wakizashi', 'description'),
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.RISING_SUN]: 2 } },
    effects: [
        grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, '获得 1 个反击指示物。'),
        damage(3, '造成 3 点不可防御伤害。', { unblockable: true }),
    ],
};

export const WAKIZASHI_2: AbilityDef = {
    id: 'wakizashi',
    name: abilityText('wakizashi-2', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('wakizashi-2', 'description'),
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.RISING_SUN]: 2 } },
    effects: [
        grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, '获得 1 个反击指示物。'),
        damage(4, '造成 4 点不可防御伤害。', { unblockable: true }),
    ],
};

export const WAKIZASHI_3: AbilityDef = {
    id: 'wakizashi',
    name: abilityText('wakizashi-3', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('wakizashi-3', 'description'),
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.RISING_SUN]: 2 } },
    effects: [
        grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, '获得 1 个反击指示物。'),
        grantToken('opponent', TOKEN_IDS.SHAME, 1, '对手获得 1 层耻辱。'),
        damage(4, '造成 4 点不可防御伤害。', { unblockable: true }),
    ],
};

const BUSHIDO: AbilityDef = {
    id: 'bushido',
    name: abilityText('bushido', 'name'),
    type: 'passive',
    description: abilityText('bushido', 'description'),
    effects: [],
};

const SOLEMNITY: AbilityDef = {
    id: 'solemnity',
    name: abilityText('solemnity', 'name'),
    type: 'offensive',
    description: abilityText('solemnity', 'description'),
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.HELM]: 3 } },
    effects: [
        grantToken('opponent', TOKEN_IDS.SHAME, 1, '对手获得 1 层耻辱。'),
        damage(7, '造成 7 点伤害。'),
    ],
};

export const SOLEMNITY_2: AbilityDef = {
    id: 'solemnity',
    name: abilityText('solemnity-2', 'name'),
    type: 'offensive',
    description: abilityText('solemnity-2', 'description'),
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.HELM]: 3 } },
    effects: [
        grantToken('opponent', TOKEN_IDS.SHAME, 2, '对手获得 2 层耻辱。'),
        damage(8, '造成 8 点伤害。'),
    ],
};

const BUDO: AbilityDef = {
    id: 'budo',
    name: abilityText('budo', 'name'),
    type: 'offensive',
    description: abilityText('budo', 'description'),
    trigger: { type: 'smallStraight' },
    effects: [
        grantToken('self', TOKEN_IDS.HONOR, 1, '获得 1 个荣誉指示物。'),
        damage(6, '造成 6 点伤害。'),
    ],
};

export const BUDO_2: AbilityDef = {
    id: 'budo',
    name: abilityText('budo-2', 'name'),
    type: 'offensive',
    description: abilityText('budo-2', 'description'),
    trigger: { type: 'smallStraight' },
    effects: [
        grantToken('self', TOKEN_IDS.HONOR, 1, '获得 1 个荣誉指示物。'),
        damage(8, '造成 8 点伤害。'),
    ],
};

const SAMURAI_SLOT_06: AbilityDef = {
    id: 'samurai-slot-06',
    name: abilityText('samurai-slot-06', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('samurai-slot-06', 'description'),
    trigger: { type: 'diceSet', faces: { [FACE.RISING_SUN]: 4 } },
    effects: [
        grantToken('self', TOKEN_IDS.HONOR, 1, '获得 1 个荣誉指示物。'),
        grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, '获得 1 个反击指示物。'),
        grantToken('opponent', TOKEN_IDS.SHAME, 1, '对手获得 1 层耻辱。'),
        damage(5, '再造成 5 点不可防御伤害。', { unblockable: true }),
    ],
};

export const SAMURAI_SLOT_06_2: AbilityDef = {
    id: 'samurai-slot-06',
    name: abilityText('samurai-slot-06-2', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('samurai-slot-06-2', 'description'),
    trigger: { type: 'diceSet', faces: { [FACE.RISING_SUN]: 4 } },
    effects: [
        grantToken('self', TOKEN_IDS.HONOR, 1, '获得 1 个荣誉指示物。'),
        grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, '获得 1 个反击指示物。'),
        grantToken('opponent', TOKEN_IDS.SHAME, 2, '对手获得 2 层耻辱。'),
        damage(7, '再造成 7 点不可防御伤害。', { unblockable: true }),
    ],
};

const MASAMUNE: AbilityDef = {
    id: 'masamune',
    name: abilityText('masamune', 'name'),
    type: 'offensive',
    description: abilityText('masamune', 'description'),
    trigger: { type: 'largeStraight' },
    effects: [
        damage(7, '造成 7 点伤害。'),
        custom(
            'samurai-masamune',
            '掷 5 颗骰子：每个武士刀造成 1 点伤害；每个头盔造成 1 层耻辱；每个旭日获得 1 个反击指示物。',
        ),
    ],
};

export const MASAMUNE_2: AbilityDef = {
    id: 'masamune',
    name: abilityText('masamune-2', 'name'),
    type: 'offensive',
    description: abilityText('masamune-2', 'description'),
    variants: [
        {
            id: 'masamune-2-large-straight',
            trigger: { type: 'largeStraight' },
            effects: [
                damage(7, '造成 7 点伤害。'),
                custom(
                    'samurai-masamune',
                    '掷 6 颗骰子：每个武士刀造成 1 点伤害；每个头盔造成 1 层耻辱；每个旭日获得 1 个反击指示物。',
                    'withDamage',
                    { diceCount: 6 },
                ),
            ],
            priority: 2,
        },
        {
            id: 'masamune-2-power-up',
            trigger: { type: 'allSymbolsPresent', symbols: [FACE.KATANA, FACE.HELM, FACE.RISING_SUN] },
            effects: [
                grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, '获得 1 个反击指示物。', 'preDefense'),
            ],
            priority: 1,
        },
    ],
};

const STAND_TALL: AbilityDef = {
    id: 'stand-tall',
    name: abilityText('stand-tall', 'name'),
    type: 'defensive',
    description: abilityText('stand-tall', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 3 },
    effects: [
        custom(
            'samurai-stand-tall',
            '每个武士刀造成 1 点不可防御伤害；每个头盔抵抗 1 点伤害；每个旭日抵抗 2 点伤害；若没有头盔或旭日，则自己获得 1 层耻辱。',
        ),
    ],
};

export const STAND_TALL_2: AbilityDef = {
    id: 'stand-tall',
    name: abilityText('stand-tall-2', 'name'),
    type: 'defensive',
    description: abilityText('stand-tall-2', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
    effects: [
        custom(
            'samurai-stand-tall-2',
            '每个武士刀造成 1 点不可防御伤害；每个头盔抵抗 1 点伤害；每个旭日抵抗 2 点伤害。',
        ),
    ],
};

const SAMURAI_ULTIMATE: AbilityDef = {
    id: 'samurai-ultimate',
    name: abilityText('samurai-ultimate', 'name'),
    type: 'offensive',
    tags: ['ultimate', 'unblockable'],
    description: abilityText('samurai-ultimate', 'description'),
    trigger: { type: 'diceSet', faces: { [FACE.RISING_SUN]: 5 } },
    effects: [
        grantToken('self', TOKEN_IDS.HONOR, 1, '获得 1 个荣誉指示物。'),
        grantToken('opponent', TOKEN_IDS.SHAME, 2, '对手获得 2 层耻辱。'),
        damage(13, '再造成 13 点不可防御伤害。', { unblockable: true }),
    ],
};

export const SAMURAI_ABILITIES: AbilityDef[] = [
    KATANA_SLICE,
    WAKIZASHI,
    BUSHIDO,
    SOLEMNITY,
    BUDO,
    SAMURAI_SLOT_06,
    MASAMUNE,
    STAND_TALL,
    SAMURAI_ULTIMATE,
];
