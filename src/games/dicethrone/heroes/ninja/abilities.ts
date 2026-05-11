import { abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { NINJA_DICE_FACE_IDS, TOKEN_IDS } from '../../domain/ids';

const FACE = NINJA_DICE_FACE_IDS;

export const NINJA_SFX_SLASH = 'combat.general.forged_in_fury_vol_1.katana.katana_whoosh_type_a.dsgnwhsh_katana_whoosh_type_a_03_krst';
export const NINJA_SFX_POISON = 'magic.general.simple_magic_sound_fx_pack_vol.dark.dark_magic_cast';
export const NINJA_SFX_SMOKE = 'fantasy.medieval_fantasy_sound_fx_pack_vol.magic.poof';
export const NINJA_SFX_ULTIMATE = 'combat.general.forged_in_fury_vol_1.katana.double_katana_whoosh.dsgnwhsh_double_katana_whoosh_02_krst';

const damage = (value: number, description: string, opts?: { timing?: EffectTiming; unblockable?: boolean; damageScope?: 'attack' | 'direct' }): AbilityEffect => ({
    description,
    action: {
        type: 'damage',
        target: 'opponent',
        value,
        ...(opts?.unblockable ? { unblockable: true } : {}),
        ...(opts?.damageScope ? { damageScope: opts.damageScope } : {}),
    },
    timing: opts?.timing,
});

const grantToken = (target: 'self' | 'opponent', tokenId: string, value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target, tokenId, value },
    timing,
});

const SLASH: AbilityDef = {
    id: 'slash',
    name: abilityText('slash', 'name'),
    type: 'offensive',
    description: abilityText('slash', 'description'),
    sfxKey: NINJA_SFX_SLASH,
    variants: [
        { id: 'slash-3', trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3 } }, effects: [damage(5, '造成 5 点伤害。')], priority: 1 },
        { id: 'slash-4', trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 4 } }, effects: [damage(6, '造成 6 点伤害。')], priority: 2 },
        { id: 'slash-5', trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 5 } }, effects: [damage(7, '造成 7 点伤害。')], priority: 3 },
    ],
};

export const SLASH_2: AbilityDef = {
    ...SLASH,
    name: abilityText('slash-2', 'name'),
    description: abilityText('slash-2', 'description'),
    variants: [
        { id: 'slash-2-3', trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3 } }, effects: [damage(6, '造成 6 点伤害。')], priority: 1 },
        { id: 'slash-2-4', trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 4 } }, effects: [damage(7, '造成 7 点伤害。')], priority: 2 },
        { id: 'slash-2-5', trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 5 } }, effects: [damage(8, '造成 8 点伤害。')], priority: 3 },
    ],
};

const GOING_FORWARD: AbilityDef = {
    id: 'going-forward',
    name: abilityText('going-forward', 'name'),
    type: 'offensive',
    description: abilityText('going-forward', 'description'),
    sfxKey: NINJA_SFX_SLASH,
    trigger: { type: 'diceSet', faces: { [FACE.SHURIKEN]: 4 } },
    effects: [damage(7, '造成 7 点伤害。')],
};

export const GOING_FORWARD_2: AbilityDef = {
    ...GOING_FORWARD,
    name: abilityText('going-forward-2', 'name'),
    description: abilityText('going-forward-2', 'description'),
};

const POISON_BLADE: AbilityDef = {
    id: 'poison-blade',
    name: abilityText('poison-blade', 'name'),
    type: 'offensive',
    description: abilityText('poison-blade', 'description'),
    sfxKey: NINJA_SFX_POISON,
    trigger: { type: 'smallStraight' },
    effects: [
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 1, '对手获得 1 个慢性中毒。'),
        damage(5, '造成 5 点伤害。'),
    ],
};

export const POISON_BLADE_2: AbilityDef = {
    ...POISON_BLADE,
    name: abilityText('poison-blade-2', 'name'),
    description: abilityText('poison-blade-2', 'description'),
    tags: ['unblockable'],
    effects: [
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 1, '对手获得 1 个慢性中毒。'),
        damage(6, '造成 6 点不可防御伤害。', { unblockable: true }),
    ],
};

const SHADOW_STEP: AbilityDef = {
    id: 'shadow-step',
    name: abilityText('shadow-step', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('shadow-step', 'description'),
    sfxKey: NINJA_SFX_SMOKE,
    trigger: { type: 'diceSet', faces: { [FACE.MASK]: 4 } },
    effects: [
        grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, '获得 1 个烟雾弹。'),
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 1, '对手获得 1 个慢性中毒。'),
        damage(6, '造成 6 点不可防御伤害。', { unblockable: true }),
    ],
};

export const SHADOW_STEP_2: AbilityDef = {
    ...SHADOW_STEP,
    name: abilityText('shadow-step-2', 'name'),
    description: abilityText('shadow-step-2', 'description'),
    effects: [
        grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, '获得 1 个烟雾弹。'),
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 2, '对手获得 2 个慢性中毒。'),
        damage(7, '造成 7 点不可防御伤害。', { unblockable: true }),
    ],
};

const DEATH_BLOSSOM: AbilityDef = {
    id: 'death-blossom',
    name: abilityText('death-blossom', 'name'),
    type: 'offensive',
    description: abilityText('death-blossom', 'description'),
    sfxKey: NINJA_SFX_SLASH,
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3, [FACE.SHURIKEN]: 2 } },
    effects: [
        {
            description: '投掷 5 骰并按忍刀/手里剑累计伤害。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 5,
                conditionalEffects: [
                    { face: FACE.KATANA, bonusDamage: 1 },
                    { face: FACE.SHURIKEN, bonusDamage: 2 },
                    { face: FACE.MASK, grantToken: { tokenId: TOKEN_IDS.NINJUTSU, value: 1 } },
                ],
            },
            timing: 'withDamage',
        },
    ],
};

export const DEATH_BLOSSOM_2: AbilityDef = {
    ...DEATH_BLOSSOM,
    name: abilityText('death-blossom-2', 'name'),
    description: abilityText('death-blossom-2', 'description'),
};

const SMOKE_SCREEN: AbilityDef = {
    id: 'smoke-screen',
    name: abilityText('smoke-screen', 'name'),
    type: 'utility',
    description: abilityText('smoke-screen', 'description'),
    sfxKey: NINJA_SFX_SMOKE,
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 1, [FACE.SHURIKEN]: 2, [FACE.MASK]: 1 } },
    effects: [
        grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, '获得 1 个烟雾弹。'),
        grantToken('self', TOKEN_IDS.NINJUTSU, 2, '获得 2 个忍术。'),
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 1, '对手获得 1 个慢性中毒。'),
    ],
};

export const SMOKE_SCREEN_2: AbilityDef = {
    ...SMOKE_SCREEN,
    name: abilityText('smoke-screen-2', 'name'),
    description: abilityText('smoke-screen-2', 'description'),
    effects: [
        grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, '获得 1 个烟雾弹。'),
        grantToken('self', TOKEN_IDS.NINJUTSU, 3, '获得 3 个忍术。'),
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 1, '对手获得 1 个慢性中毒。'),
    ],
};

const SHADOW_FANG: AbilityDef = {
    id: 'shadow-fang',
    name: abilityText('shadow-fang', 'name'),
    type: 'offensive',
    description: abilityText('shadow-fang', 'description'),
    sfxKey: NINJA_SFX_SLASH,
    trigger: { type: 'largeStraight' },
    effects: [
        grantToken('self', TOKEN_IDS.NINJUTSU, 2, '获得 2 个忍术。'),
        damage(8, '造成 8 点伤害。'),
    ],
};

export const SHADOW_FANG_2: AbilityDef = {
    ...SHADOW_FANG,
    name: abilityText('shadow-fang-2', 'name'),
    description: abilityText('shadow-fang-2', 'description'),
    effects: [
        grantToken('self', TOKEN_IDS.NINJUTSU, 2, '获得 2 个忍术。'),
        damage(9, '造成 9 点伤害。'),
    ],
};

const BLINK: AbilityDef = {
    id: 'blink',
    name: abilityText('blink', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('blink', 'description'),
    sfxKey: NINJA_SFX_SMOKE,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 3 },
    effects: [
        {
            description: '防御掷 3 骰。忍刀/手里剑反击，面具获得烟雾弹。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 3,
                conditionalEffects: [
                    { face: FACE.KATANA, bonusDamage: 1 },
                    { face: FACE.SHURIKEN, bonusDamage: 2 },
                    { face: FACE.MASK, grantToken: { tokenId: TOKEN_IDS.SMOKE_BOMB, value: 1 } },
                ],
            },
            timing: 'immediate',
        },
    ],
};

export const BLINK_2: AbilityDef = {
    ...BLINK,
    name: abilityText('blink-2', 'name'),
    description: abilityText('blink-2', 'description'),
};

const NINJA_ASSASSINATE: AbilityDef = {
    id: 'ninja-assassinate',
    name: abilityText('ninja-assassinate', 'name'),
    type: 'offensive',
    tags: ['ultimate', 'uninterruptible'],
    description: abilityText('ninja-assassinate', 'description'),
    sfxKey: NINJA_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.MASK]: 5 } },
    effects: [
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 2, '对手获得 2 个慢性中毒。'),
        grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, '获得 1 个烟雾弹。'),
        damage(10, '造成 10 点伤害。'),
    ],
};

export const NINJA_ABILITIES: AbilityDef[] = [
    SLASH,
    GOING_FORWARD,
    POISON_BLADE,
    SHADOW_STEP,
    DEATH_BLOSSOM,
    SMOKE_SCREEN,
    SHADOW_FANG,
    BLINK,
    NINJA_ASSASSINATE,
];
