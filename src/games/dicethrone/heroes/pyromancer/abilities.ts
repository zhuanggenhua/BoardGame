import type { AbilityDef, AbilityEffect, EffectTiming, EffectCondition } from '../../domain/combat';
import { STATUS_IDS, TOKEN_IDS, PYROMANCER_DICE_FACE_IDS } from '../../domain/ids';
import { abilityText, abilityEffectText } from '../../../../engine/primitives/ability';

const PYROMANCER_SFX_FIREBALL = 'magic.general.simple_magic_sound_fx_pack_vol.fire.small_fireball_cast_a';
const PYROMANCER_SFX_SOUL_BURN = 'magic.general.simple_magic_sound_fx_pack_vol.fire.combustion';
const PYROMANCER_SFX_FIERY_COMBO = 'magic.general.simple_magic_sound_fx_pack_vol.fire.fire_whip';
const PYROMANCER_SFX_METEOR = 'magic.general.simple_magic_sound_fx_pack_vol.fire.large_fireball_impact_a';
const PYROMANCER_SFX_PYRO_BLAST = 'magic.general.simple_magic_sound_fx_pack_vol.fire.medium_fireball_cast_a';
const PYROMANCER_SFX_BURN_DOWN = 'magic.general.simple_magic_sound_fx_pack_vol.fire.flame_pillar';
const PYROMANCER_SFX_IGNITE = 'magic.general.simple_magic_sound_fx_pack_vol.fire.blazing_comet';
const PYROMANCER_SFX_ULTIMATE = 'magic.general.simple_magic_sound_fx_pack_vol.fire.phoenix_burst';

const damage = (value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition; target?: 'opponent' | 'self' | 'all' }): AbilityEffect => ({
    description,
    action: { type: 'damage', target: opts?.target ?? 'opponent', value },
    timing: opts?.timing,
    condition: opts?.condition,
});

const inflictStatus = (statusId: string, value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
    timing: opts?.timing,
    condition: opts?.condition,
});

const grantToken = (tokenId: string, value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value },
    timing: opts?.timing,
    condition: opts?.condition,
});

export const PYROMANCER_ABILITIES: AbilityDef[] = [
    {
        id: 'fireball',
        name: abilityText('fireball', 'name'),
        type: 'offensive',
        description: abilityText('fireball', 'description'),
        sfxKey: PYROMANCER_SFX_FIREBALL,
        variants: [
            {
                id: 'fireball-3',
                trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 3 } },
                effects: [
                    damage(4, abilityEffectText('fireball-3', 'damage4')),
                    grantToken(TOKEN_IDS.FIRE_MASTERY, 1, abilityEffectText('fireball', 'gainFM1')),
                ],
                priority: 1,
            },
            {
                id: 'fireball-4',
                trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 4 } },
                effects: [
                    damage(6, abilityEffectText('fireball-4', 'damage6')),
                    grantToken(TOKEN_IDS.FIRE_MASTERY, 1, abilityEffectText('fireball', 'gainFM1')),
                ],
                priority: 2,
            },
            {
                id: 'fireball-5',
                trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 5 } },
                effects: [
                    damage(8, abilityEffectText('fireball-5', 'damage8')),
                    grantToken(TOKEN_IDS.FIRE_MASTERY, 1, abilityEffectText('fireball', 'gainFM1')),
                ],
                priority: 3,
            }
        ],
    },
    {
        id: 'soul-burn',
        name: abilityText('soul-burn', 'name'),
        type: 'offensive',
        description: abilityText('soul-burn', 'description'),
        sfxKey: PYROMANCER_SFX_SOUL_BURN,
        trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 2 } },
        effects: [
            {
                description: abilityEffectText('soul-burn', 'main'),
                action: { type: 'custom', target: 'self', customActionId: 'soul-burn-resolve' }
            }
        ]
    },
    {
        id: 'fiery-combo',
        name: abilityText('fiery-combo', 'name'),
        type: 'offensive',
        description: abilityText('fiery-combo', 'description'),
        sfxKey: PYROMANCER_SFX_FIERY_COMBO,
        trigger: { type: 'smallStraight' },
        effects: [
            {
                description: abilityEffectText('fiery-combo', 'main'),
                action: { type: 'custom', target: 'self', customActionId: 'fiery-combo-resolve' }
            }
        ]
    },
    {
        id: 'meteor',
        name: abilityText('meteor', 'name'),
        type: 'offensive',
        description: abilityText('meteor', 'description'),
        sfxKey: PYROMANCER_SFX_METEOR,
        trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.METEOR]: 4 } },
        tags: ['unblockable'],
        effects: [
            inflictStatus(STATUS_IDS.STUN, 1, abilityEffectText('meteor', 'inflictStun')),
            {
                description: abilityEffectText('meteor', 'unblockable'),
                action: { type: 'custom', target: 'self', customActionId: 'meteor-resolve' }
            },
            damage(2, abilityEffectText('meteor', 'collateral'), { target: 'all' })
        ]
    },
    {
        id: 'pyro-blast',
        name: abilityText('pyro-blast', 'name'),
        type: 'offensive',
        description: abilityText('pyro-blast', 'description'),
        sfxKey: PYROMANCER_SFX_PYRO_BLAST,
        trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 3, [PYROMANCER_DICE_FACE_IDS.METEOR]: 1 } },
        effects: [
            damage(6, abilityEffectText('pyro-blast', 'damage6')),
            {
                description: abilityEffectText('pyro-blast', 'bonusRoll'),
                action: {
                    type: 'rollDie',
                    target: 'self',
                    diceCount: 1,
                    conditionalEffects: [
                        { face: PYROMANCER_DICE_FACE_IDS.FIRE, bonusDamage: 3 },
                        { face: PYROMANCER_DICE_FACE_IDS.MAGMA, grantStatus: { statusId: STATUS_IDS.BURN, value: 1 } },
                        { face: PYROMANCER_DICE_FACE_IDS.FIERY_SOUL, grantToken: { tokenId: TOKEN_IDS.FIRE_MASTERY, value: 2 } },
                        { face: PYROMANCER_DICE_FACE_IDS.METEOR, grantStatus: { statusId: STATUS_IDS.KNOCKDOWN, value: 1 } },
                    ]
                },
                timing: 'withDamage'
            }
        ]
    },
    {
        id: 'burn-down',
        name: abilityText('burn-down', 'name'),
        type: 'offensive',
        description: abilityText('burn-down', 'description'),
        sfxKey: PYROMANCER_SFX_BURN_DOWN,
        trigger: {
            type: 'diceSet',
            faces: {
                [PYROMANCER_DICE_FACE_IDS.FIRE]: 1,
                [PYROMANCER_DICE_FACE_IDS.MAGMA]: 1,
                [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 1,
                [PYROMANCER_DICE_FACE_IDS.METEOR]: 1
            }
        },
        tags: ['unblockable'],
        effects: [
            {
                description: abilityEffectText('burn-down', 'main'),
                action: { type: 'custom', target: 'self', customActionId: 'burn-down-resolve' }
            }
        ]
    },
    {
        id: 'ignite',
        name: abilityText('ignite', 'name'),
        type: 'offensive',
        description: abilityText('ignite', 'description'),
        sfxKey: PYROMANCER_SFX_IGNITE,
        trigger: { type: 'largeStraight' },
        effects: [
            {
                description: abilityEffectText('ignite', 'main'),
                action: { type: 'custom', target: 'self', customActionId: 'ignite-resolve' }
            }
        ]
    },
    {
        id: 'magma-armor',
        name: abilityText('magma-armor', 'name'),
        type: 'defensive',
        description: abilityText('magma-armor', 'description'),
        trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
        effects: [
            {
                description: abilityEffectText('magma-armor', 'main'),
                action: { type: 'custom', target: 'self', customActionId: 'magma-armor-resolve' }
            }
        ]
    },
    {
        id: 'ultimate-inferno',
        name: abilityText('ultimate-inferno', 'name'),
        type: 'offensive',
        tags: ['ultimate'],
        description: abilityText('ultimate-inferno', 'description'),
        sfxKey: PYROMANCER_SFX_ULTIMATE,
        trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.METEOR]: 5 } },
        effects: [
            inflictStatus(STATUS_IDS.KNOCKDOWN, 1, abilityEffectText('ultimate-inferno', 'inflictKnockdown')),
            inflictStatus(STATUS_IDS.BURN, 1, abilityEffectText('ultimate-inferno', 'inflictBurn')),
            grantToken(TOKEN_IDS.FIRE_MASTERY, 3, abilityEffectText('ultimate-inferno', 'gainFM3')),
            damage(12, abilityEffectText('ultimate-inferno', 'damage12')),
            damage(2, abilityEffectText('ultimate-inferno', 'collateral'), { target: 'all' })
        ]
    }
];

// ============================================
// Level 2 & 3 Upgrades
// ============================================

export const FIREBALL_2: AbilityDef = {
    id: 'fireball',
    name: abilityText('fireball-2', 'name'),
    type: 'offensive',
    description: abilityText('fireball-2', 'description'),
    sfxKey: PYROMANCER_SFX_FIREBALL,
    variants: [
        { id: 'fireball-2-3', trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 3 } }, effects: [damage(4, abilityEffectText('fireball-2-3', 'damage4')), grantToken(TOKEN_IDS.FIRE_MASTERY, 2, abilityEffectText('fireball-2', 'gainFM2'))], priority: 1 },
        { id: 'fireball-2-4', trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 4 } }, effects: [damage(6, abilityEffectText('fireball-2-4', 'damage6')), grantToken(TOKEN_IDS.FIRE_MASTERY, 2, abilityEffectText('fireball-2', 'gainFM2'))], priority: 2 },
        { id: 'fireball-2-5', trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 5 } }, effects: [damage(8, abilityEffectText('fireball-2-5', 'damage8')), grantToken(TOKEN_IDS.FIRE_MASTERY, 2, abilityEffectText('fireball-2', 'gainFM2'))], priority: 3 },
    ],
};

export const BURNING_SOUL_2: AbilityDef = {
    id: 'soul-burn',
    name: abilityText('soul-burn-2', 'name'),
    type: 'offensive',
    description: abilityText('soul-burn-2', 'description'),
    sfxKey: PYROMANCER_SFX_SOUL_BURN,
    variants: [
        {
            id: 'soul-burn-4',
            trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 4 } },
            effects: [
                {
                    description: abilityEffectText('soul-burn-4', 'main'),
                    action: { type: 'custom', target: 'self', customActionId: 'soul-burn-4-resolve' }
                },
                inflictStatus(STATUS_IDS.KNOCKDOWN, 1, abilityEffectText('soul-burn-4', 'knockdown'))
            ],
            priority: 3
        },
        {
            id: 'soul-burn-2',
            trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 2 } },
            effects: [inflictStatus(STATUS_IDS.BURN, 1, abilityEffectText('soul-burn-2', 'inflictBurn'))],
            priority: 1
        },
        {
            id: 'soul-burn-3',
            trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 3 } },
            effects: [
                {
                    description: abilityEffectText('soul-burn-3', 'increaseLimit'),
                    action: { type: 'custom', target: 'self', customActionId: 'increase-fm-limit' }
                },
                {
                    description: abilityEffectText('soul-burn-3', 'main'),
                    action: { type: 'custom', target: 'self', customActionId: 'soul-burn-resolve' }
                }
            ],
            priority: 2,
            tags: ['unblockable']
        }
    ]
};

export const HOT_STREAK_2: AbilityDef = {
    id: 'fiery-combo',
    name: abilityText('fiery-combo-2', 'name'),
    type: 'offensive',
    description: abilityText('fiery-combo-2', 'description'),
    sfxKey: PYROMANCER_SFX_FIERY_COMBO,
    variants: [
        {
            id: 'fiery-combo-2',
            trigger: { type: 'smallStraight' },
            effects: [
                grantToken(TOKEN_IDS.FIRE_MASTERY, 2, abilityEffectText('fiery-combo-2', 'gainFM2')),
                {
                    description: abilityEffectText('fiery-combo-2', 'main'),
                    action: { type: 'custom', target: 'self', customActionId: 'fiery-combo-2-resolve' },
                    timing: 'withDamage'
                }
            ],
            priority: 1
        },
        {
            id: 'incinerate',
            trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 2, [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 2 } },
            effects: [
                grantToken(TOKEN_IDS.FIRE_MASTERY, 2, abilityEffectText('incinerate', 'gainFM2')),
                inflictStatus(STATUS_IDS.BURN, 1, abilityEffectText('incinerate', 'inflictBurn')),
                damage(6, abilityEffectText('incinerate', 'damage6'))
            ],
            priority: 2
        }
    ]
};

export const METEOR_2: AbilityDef = {
    id: 'meteor',
    name: abilityText('meteor-2', 'name'),
    type: 'offensive',
    description: abilityText('meteor-2', 'description'),
    sfxKey: PYROMANCER_SFX_METEOR,
    variants: [
        {
            id: 'meteor-shower',
            trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.METEOR]: 3 } },
            effects: [
                inflictStatus(STATUS_IDS.KNOCKDOWN, 1, abilityEffectText('meteor-shower', 'inflictKnockdown')),
                inflictStatus(STATUS_IDS.BURN, 1, abilityEffectText('meteor-shower', 'inflictBurn')),
                inflictStatus(STATUS_IDS.STUN, 1, abilityEffectText('meteor-shower', 'inflictStun')),
            ],
            priority: 1
        },
        {
            id: 'meteor-2',
            trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.METEOR]: 4 } },
            effects: [
                // FM 获得由 meteor-resolve 内部处理（先获得FM再基于FM算伤害）
                inflictStatus(STATUS_IDS.STUN, 1, abilityEffectText('meteor-2', 'inflictStun')),
                {
                    description: abilityEffectText('meteor-2', 'unblockable'),
                    action: { type: 'custom', target: 'self', customActionId: 'meteor-resolve' }
                },
                damage(3, abilityEffectText('meteor-2', 'collateral'), { target: 'all' })
            ],
            priority: 2,
            tags: ['unblockable']
        }
    ]
};

export const PYRO_BLAST_2: AbilityDef = {
    id: 'pyro-blast',
    name: abilityText('pyro-blast-2', 'name'),
    type: 'offensive',
    description: abilityText('pyro-blast-2', 'description'),
    sfxKey: PYROMANCER_SFX_PYRO_BLAST,
    trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 3, [PYROMANCER_DICE_FACE_IDS.METEOR]: 1 } },
    effects: [
        damage(6, abilityEffectText('pyro-blast-2', 'damage6')),
        {
            description: abilityEffectText('pyro-blast-2', 'bonusRoll'),
            action: {
                type: 'custom',
                target: 'self',
                customActionId: 'pyro-blast-2-roll'
            },
            timing: 'withDamage'
        }
    ]
};

export const PYRO_BLAST_3: AbilityDef = {
    id: 'pyro-blast',
    name: abilityText('pyro-blast-3', 'name'),
    type: 'offensive',
    description: abilityText('pyro-blast-3', 'description'),
    sfxKey: PYROMANCER_SFX_PYRO_BLAST,
    trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 3, [PYROMANCER_DICE_FACE_IDS.METEOR]: 1 } },
    effects: [
        damage(6, abilityEffectText('pyro-blast-3', 'damage6')),
        {
            description: abilityEffectText('pyro-blast-3', 'bonusRoll'),
            action: {
                type: 'custom',
                target: 'self',
                customActionId: 'pyro-blast-3-roll'
            },
            timing: 'withDamage'
        }
    ]
};

export const BURN_DOWN_2: AbilityDef = {
    id: 'burn-down',
    name: abilityText('burn-down-2', 'name'),
    type: 'offensive',
    description: abilityText('burn-down-2', 'description'),
    sfxKey: PYROMANCER_SFX_BURN_DOWN,
    trigger: {
        type: 'diceSet',
        faces: {
            [PYROMANCER_DICE_FACE_IDS.FIRE]: 1,
            [PYROMANCER_DICE_FACE_IDS.MAGMA]: 1,
            [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 1,
            [PYROMANCER_DICE_FACE_IDS.METEOR]: 1
        }
    },
    tags: ['unblockable'],
    effects: [
        // FM 获得由 burn-down-2-resolve 内部处理（先获得FM再消耗FM算伤害）
        {
            description: abilityEffectText('burn-down-2', 'main'),
            action: { type: 'custom', target: 'self', customActionId: 'burn-down-2-resolve' }
        }
    ]
};

export const IGNITE_2: AbilityDef = {
    id: 'ignite',
    name: abilityText('ignite-2', 'name'),
    type: 'offensive',
    description: abilityText('ignite-2', 'description'),
    sfxKey: PYROMANCER_SFX_IGNITE,
    trigger: { type: 'largeStraight' },
    effects: [
        // FM 获得由 ignite-2-resolve 内部处理（先获得FM再基于FM算伤害）
        inflictStatus(STATUS_IDS.BURN, 1, abilityEffectText('ignite-2', 'inflictBurn')),
        {
            description: abilityEffectText('ignite-2', 'main'),
            action: { type: 'custom', target: 'self', customActionId: 'ignite-2-resolve' }
        }
    ]
};

export const MAGMA_ARMOR_2: AbilityDef = {
    id: 'magma-armor',
    name: abilityText('magma-armor-2', 'name'),
    type: 'defensive',
    description: abilityText('magma-armor-2', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        {
            description: abilityEffectText('magma-armor-2', 'main'),
            action: { type: 'custom', target: 'self', customActionId: 'magma-armor-2-resolve' }
        }
    ]
};

export const MAGMA_ARMOR_3: AbilityDef = {
    id: 'magma-armor',
    name: abilityText('magma-armor-3', 'name'),
    type: 'defensive',
    description: abilityText('magma-armor-3', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        {
            description: abilityEffectText('magma-armor-3', 'main'),
            action: { type: 'custom', target: 'self', customActionId: 'magma-armor-3-resolve' }
        }
    ]
};
