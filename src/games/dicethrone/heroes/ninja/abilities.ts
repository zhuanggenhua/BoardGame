import { abilityText, abilityEffectText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { NINJA_DICE_FACE_IDS, TOKEN_IDS } from '../../domain/ids';

const FACE = NINJA_DICE_FACE_IDS;

export const NINJA_SFX_SLASH = 'combat.general.forged_in_fury_vol_1.katana.katana_whoosh_type_a.dsgnwhsh_katana_whoosh_type_a_03_krst';
export const NINJA_SFX_POISON = 'magic.poison.26.poison_spell_01';
export const NINJA_SFX_SMOKE = 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001';
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

const customEffect = (
    customActionId: string,
    target: 'self' | 'opponent',
    description: string,
    timing: EffectTiming = 'preDefense',
): AbilityEffect => ({
    description,
    action: { type: 'custom', target, customActionId },
    timing,
});

const SLASH: AbilityDef = {
    id: 'slash',
    name: abilityText('slash', 'name'),
    type: 'offensive',
    description: abilityText('slash', 'description'),
    sfxKey: NINJA_SFX_SLASH,
    variants: [
        { id: 'slash-3', trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3 } }, effects: [damage(5, abilityEffectText('slash', 'damage5'))], priority: 1 },
        { id: 'slash-4', trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 4 } }, effects: [damage(6, abilityEffectText('slash', 'damage6'))], priority: 2 },
        { id: 'slash-5', trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 5 } }, effects: [damage(7, abilityEffectText('slash', 'damage7'))], priority: 3 },
    ],
};

export const SLASH_2: AbilityDef = {
    ...SLASH,
    name: abilityText('slash-2', 'name'),
    description: abilityText('slash-2', 'description'),
    variants: [
        {
            id: 'slash-2-3',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3 } },
            effects: [
                damage(4, abilityEffectText('slash-2', 'damage4')),
                customEffect('ninja-slash-2-bonus', 'self', abilityEffectText('slash-2', 'gainNinjutsuOnThreeKind'), 'postDamage'),
            ],
            priority: 1,
        },
        {
            id: 'slash-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 4 } },
            effects: [
                damage(6, abilityEffectText('slash-2', 'damage6')),
                customEffect('ninja-slash-2-bonus', 'self', abilityEffectText('slash-2', 'gainNinjutsuOnThreeKind'), 'postDamage'),
            ],
            priority: 2,
        },
        {
            id: 'slash-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 5 } },
            effects: [
                damage(8, abilityEffectText('slash-2', 'damage8')),
                customEffect('ninja-slash-2-bonus', 'self', abilityEffectText('slash-2', 'gainNinjutsuOnThreeKind'), 'postDamage'),
            ],
            priority: 3,
        },
    ],
};

const GOING_FORWARD: AbilityDef = {
    id: 'going-forward',
    name: abilityText('going-forward', 'name'),
    type: 'offensive',
    description: abilityText('going-forward', 'description'),
    sfxKey: NINJA_SFX_SLASH,
    trigger: { type: 'diceSet', faces: { [FACE.SHURIKEN]: 4 } },
    effects: [
        customEffect('ninja-going-forward', 'opponent', abilityEffectText('going-forward', 'roll2DiceDamageTotal')),
        damage(0, abilityEffectText('going-forward', 'resolveRolledDamage'), { timing: 'withDamage' }),
    ],
};

export const GOING_FORWARD_2: AbilityDef = {
    ...GOING_FORWARD,
    name: abilityText('going-forward-2', 'name'),
    description: abilityText('going-forward-2', 'description'),
    variants: [
        {
            id: 'going-forward-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.SHURIKEN]: 4 } },
            effects: [
                customEffect('ninja-going-forward-2', 'opponent', abilityEffectText('going-forward-2', 'roll2DiceDamageTotalRerollUnblockable')),
                damage(0, abilityEffectText('going-forward-2', 'resolveRolledDamage'), { timing: 'withDamage' }),
            ],
            priority: 1,
        },
        {
            id: 'going-forward-2-bleed',
            trigger: { type: 'diceSet', faces: { [FACE.SHURIKEN]: 3 } },
            effects: [
                customEffect('ninja-going-forward-bleed', 'opponent', abilityEffectText('going-forward-2', 'bleedRollDirectDamage')),
            ],
            priority: 0,
        },
    ],
};

const POISON_BLADE: AbilityDef = {
    id: 'poison-blade',
    name: abilityText('poison-blade', 'name'),
    type: 'offensive',
    description: abilityText('poison-blade', 'description'),
    sfxKey: NINJA_SFX_POISON,
    trigger: { type: 'smallStraight' },
    effects: [
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 1, abilityEffectText('poison-blade', 'inflictDelayedPoison')),
        damage(5, abilityEffectText('poison-blade', 'damage5')),
    ],
};

export const POISON_BLADE_2: AbilityDef = {
    ...POISON_BLADE,
    name: abilityText('poison-blade-2', 'name'),
    description: abilityText('poison-blade-2', 'description'),
    effects: [
        customEffect('ninja-poison-blade-2', 'opponent', abilityEffectText('poison-blade-2', 'roll1DieApplyPoison')),
        damage(9, abilityEffectText('poison-blade-2', 'damage9')),
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
        grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, abilityEffectText('shadow-step', 'gainSmokeBomb')),
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 1, abilityEffectText('shadow-step', 'inflictDelayedPoison')),
        damage(6, abilityEffectText('shadow-step', 'damage6Unblockable'), { unblockable: true }),
    ],
};

export const SHADOW_STEP_2: AbilityDef = {
    ...SHADOW_STEP,
    name: abilityText('shadow-step-2', 'name'),
    description: abilityText('shadow-step-2', 'description'),
    variants: [
        {
            id: 'shadow-step-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.MASK]: 4 } },
            tags: ['unblockable'],
            effects: [
                grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, abilityEffectText('shadow-step-2', 'gainSmokeBomb')),
                grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 2, abilityEffectText('shadow-step-2', 'inflictDelayedPoison2')),
                damage(5, abilityEffectText('shadow-step-2', 'damage5Unblockable'), { unblockable: true }),
            ],
            priority: 1,
        },
        {
            id: 'shadow-step-2-strangle',
            trigger: { type: 'diceSet', faces: { [FACE.MASK]: 3 } },
            effects: [
                grantToken('self', TOKEN_IDS.NINJUTSU, 3, abilityEffectText('shadow-step-2-strangle', 'gainNinjutsu3')),
                grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 2, abilityEffectText('shadow-step-2-strangle', 'inflictDelayedPoison2')),
                customEffect('ninja-nonattack-closeout', 'self', abilityEffectText('shadow-step-2-strangle', 'nonAttackCloseout')),
            ],
            priority: 0,
        },
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
        customEffect('ninja-death-blossom', 'opponent', abilityEffectText('death-blossom', 'roll5DiceResolveDamage')),
        damage(0, abilityEffectText('death-blossom', 'roll5DiceResolveDamage'), { timing: 'withDamage' }),
    ],
};

export const DEATH_BLOSSOM_2: AbilityDef = {
    ...DEATH_BLOSSOM,
    name: abilityText('death-blossom-2', 'name'),
    description: abilityText('death-blossom-2', 'description'),
    effects: [
        customEffect('ninja-death-blossom-2', 'opponent', abilityEffectText('death-blossom-2', 'roll5DiceDamageMaskBonusesReroll2')),
        damage(0, abilityEffectText('death-blossom-2', 'resolveRolledDamage'), { timing: 'withDamage' }),
    ],
};

const SMOKE_SCREEN: AbilityDef = {
    id: 'smoke-screen',
    name: abilityText('smoke-screen', 'name'),
    type: 'utility',
    description: abilityText('smoke-screen', 'description'),
    sfxKey: NINJA_SFX_SMOKE,
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 1, [FACE.SHURIKEN]: 2, [FACE.MASK]: 1 } },
    effects: [
        grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, abilityEffectText('smoke-screen', 'gainSmokeBomb')),
        grantToken('self', TOKEN_IDS.NINJUTSU, 2, abilityEffectText('smoke-screen', 'gainNinjutsu2')),
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 1, abilityEffectText('smoke-screen', 'inflictDelayedPoison')),
    ],
};

export const SMOKE_SCREEN_2: AbilityDef = {
    ...SMOKE_SCREEN,
    name: abilityText('smoke-screen-2', 'name'),
    description: abilityText('smoke-screen-2', 'description'),
    variants: [
        {
            id: 'smoke-screen-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 1, [FACE.SHURIKEN]: 2, [FACE.MASK]: 1 } },
            effects: [
                customEffect('ninja-smoke-screen-2', 'self', abilityEffectText('smoke-screen-2', 'grantSmokeBombNinjutsu3Poison')),
            ],
            priority: 1,
        },
        {
            id: 'smoke-screen-2-kuji-kiri',
            trigger: { type: 'diceSet', faces: { [FACE.SHURIKEN]: 3, [FACE.MASK]: 2 } },
            effects: [
                customEffect('ninja-smoke-screen-kuji-kiri', 'self', abilityEffectText('smoke-screen-2-kuji-kiri', 'deal4DirectDamageToTwoTargets')),
            ],
            priority: 0,
        },
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
        grantToken('self', TOKEN_IDS.NINJUTSU, 2, abilityEffectText('shadow-fang', 'gainNinjutsu2')),
        damage(8, abilityEffectText('shadow-fang', 'damage8')),
    ],
};

export const SHADOW_FANG_2: AbilityDef = {
    ...SHADOW_FANG,
    name: abilityText('shadow-fang-2', 'name'),
    description: abilityText('shadow-fang-2', 'description'),
    variants: [
        {
            id: 'shadow-fang-2-main',
            trigger: { type: 'largeStraight' },
            effects: [
                grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, abilityEffectText('shadow-fang-2', 'gainSmokeBomb')),
                grantToken('self', TOKEN_IDS.NINJUTSU, 2, abilityEffectText('shadow-fang-2', 'gainNinjutsu2')),
                damage(8, abilityEffectText('shadow-fang-2', 'damage8')),
            ],
            priority: 1,
        },
        {
            id: 'shadow-fang-2-deceive',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.MASK]: 2 } },
            tags: ['unblockable'],
            effects: [
                grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, abilityEffectText('shadow-fang-2-deceive', 'gainSmokeBomb')),
                damage(2, abilityEffectText('shadow-fang-2-deceive', 'damage2Unblockable'), { unblockable: true }),
            ],
            priority: 0,
        },
    ],
};

const BLINK: AbilityDef = {
    id: 'blink',
    name: abilityText('blink', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('blink', 'description'),
    sfxKey: NINJA_SFX_SMOKE,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 3, rollLimit: 2, rerollDieLimit: 1 },
    effects: [
        {
            description: abilityEffectText('blink', 'resolveDefense'),
            action: { type: 'custom', target: 'self', customActionId: 'ninja-blink' },
            timing: 'withDamage',
        },
    ],
};

export const BLINK_2: AbilityDef = {
    ...BLINK,
    name: abilityText('blink-2', 'name'),
    description: abilityText('blink-2', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 3, rollLimit: 2, rerollDieLimit: 2 },
    effects: [
        {
            description: abilityEffectText('blink-2', 'resolveDefense'),
            action: { type: 'custom', target: 'self', customActionId: 'ninja-blink-2' },
            timing: 'withDamage',
        },
    ],
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
        grantToken('opponent', TOKEN_IDS.DELAYED_POISON, 2, abilityEffectText('ninja-assassinate', 'inflictDelayedPoison2')),
        grantToken('self', TOKEN_IDS.SMOKE_BOMB, 1, abilityEffectText('ninja-assassinate', 'gainSmokeBomb')),
        damage(10, abilityEffectText('ninja-assassinate', 'damage10')),
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
