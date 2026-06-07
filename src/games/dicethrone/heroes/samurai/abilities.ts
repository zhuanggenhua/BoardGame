import { abilityEffectText, abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { SAMURAI_DICE_FACE_IDS, TOKEN_IDS } from '../../domain/ids';

const FACE = SAMURAI_DICE_FACE_IDS;

export const SAMURAI_SFX_LIGHT = 'combat.general.forged_in_fury_vol_1.katana.katana_whoosh_type_a.dsgnwhsh_katana_whoosh_type_a_03_krst';
export const SAMURAI_SFX_HEAVY = 'combat.general.forged_in_fury_vol_1.katana.katana_only_hit_layer_with_metal.fghtimpt_katana_only_hit_layer_with_metal_03_krst';
export const SAMURAI_SFX_ULTIMATE = 'combat.general.forged_in_fury_vol_1.katana.double_katana_whoosh.dsgnwhsh_double_katana_whoosh_02_krst';
export const SAMURAI_SFX_DEFENSE = 'fantasy.medieval_fantasy_sound_fx_pack_vol.armor.shield_impact_a';

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
    sfxKey: SAMURAI_SFX_LIGHT,
    variants: [
        {
            id: 'katana-slice-3',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3 } },
            effects: [damage(5, abilityEffectText('katana-slice', 'damage5'))],
            priority: 1,
        },
        {
            id: 'katana-slice-4',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 4 } },
            effects: [damage(6, abilityEffectText('katana-slice', 'damage6'))],
            priority: 2,
        },
        {
            id: 'katana-slice-5',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 5 } },
            effects: [damage(7, abilityEffectText('katana-slice', 'damage7'))],
            priority: 3,
        },
    ],
};

export const KATANA_SLICE_2: AbilityDef = {
    id: 'katana-slice',
    name: abilityText('katana-slice-2', 'name'),
    type: 'offensive',
    description: abilityText('katana-slice-2', 'description'),
    sfxKey: SAMURAI_SFX_LIGHT,
    variants: [
        {
            id: 'katana-slice-2-3',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3 } },
            effects: [
                custom('samurai-katana-slice-threshold-4', abilityEffectText('katana-slice-2', 'inflictShameIfFourKind'), 'preDefense'),
                damage(6, abilityEffectText('katana-slice-2', 'damage6')),
            ],
            priority: 1,
        },
        {
            id: 'katana-slice-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 4 } },
            effects: [
                custom('samurai-katana-slice-threshold-4', abilityEffectText('katana-slice-2', 'inflictShameIfFourKind'), 'preDefense'),
                damage(7, abilityEffectText('katana-slice-2', 'damage7')),
            ],
            priority: 2,
        },
        {
            id: 'katana-slice-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 5 } },
            effects: [
                custom('samurai-katana-slice-threshold-4', abilityEffectText('katana-slice-2', 'inflictShameIfFourKind'), 'preDefense'),
                damage(8, abilityEffectText('katana-slice-2', 'damage8')),
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
    sfxKey: SAMURAI_SFX_LIGHT,
    variants: [
        {
            id: 'katana-slice-3-3',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 3 } },
            effects: [
                custom('samurai-katana-slice-threshold-3', abilityEffectText('katana-slice-3', 'inflictShameIfThreeKind'), 'preDefense'),
                damage(6, abilityEffectText('katana-slice-3', 'damage6')),
            ],
            priority: 1,
        },
        {
            id: 'katana-slice-3-4',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 4 } },
            effects: [
                custom('samurai-katana-slice-threshold-3', abilityEffectText('katana-slice-3', 'inflictShameIfThreeKind'), 'preDefense'),
                damage(7, abilityEffectText('katana-slice-3', 'damage7')),
            ],
            priority: 2,
        },
        {
            id: 'katana-slice-3-5',
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 5 } },
            effects: [
                custom('samurai-katana-slice-threshold-3', abilityEffectText('katana-slice-3', 'inflictShameIfThreeKind'), 'preDefense'),
                damage(8, abilityEffectText('katana-slice-3', 'damage8')),
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
    sfxKey: SAMURAI_SFX_LIGHT,
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.RISING_SUN]: 2 } },
    effects: [
        grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, abilityEffectText('wakizashi', 'gainBackStrike')),
        damage(3, abilityEffectText('wakizashi', 'damage3Unblockable'), { unblockable: true }),
    ],
};

export const WAKIZASHI_2: AbilityDef = {
    id: 'wakizashi',
    name: abilityText('wakizashi-2', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('wakizashi-2', 'description'),
    sfxKey: SAMURAI_SFX_LIGHT,
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.RISING_SUN]: 2 } },
    effects: [
        grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, abilityEffectText('wakizashi-2', 'gainBackStrike')),
        damage(4, abilityEffectText('wakizashi-2', 'damage4Unblockable'), { unblockable: true }),
    ],
};

export const WAKIZASHI_3: AbilityDef = {
    id: 'wakizashi',
    name: abilityText('wakizashi-3', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('wakizashi-3', 'description'),
    sfxKey: SAMURAI_SFX_LIGHT,
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.RISING_SUN]: 2 } },
    effects: [
        grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, abilityEffectText('wakizashi-3', 'gainBackStrike')),
        grantToken('opponent', TOKEN_IDS.SHAME, 1, abilityEffectText('wakizashi-3', 'inflictShame')),
        damage(4, abilityEffectText('wakizashi-3', 'damage4Unblockable'), { unblockable: true }),
    ],
};

const BUSHIDO: AbilityDef = {
    id: 'bushido',
    name: abilityText('bushido', 'name'),
    type: 'passive',
    description: abilityText('bushido', 'description'),
    variants: [
        {
            id: 'bushido-start-turn',
            trigger: { type: 'phaseStart', phase: 'upkeep' },
            effects: [
                custom('samurai-bushido-start-turn', abilityEffectText('bushido', 'gainHonorIfStartingPlayer'), 'immediate'),
            ],
        },
        {
            id: 'bushido-end-turn',
            trigger: { type: 'phaseEnd', phase: 'discard' },
            effects: [
                custom('samurai-bushido-end-turn', abilityEffectText('bushido', 'gainHonorIfFewerThanThreeRolls'), 'immediate'),
            ],
        },
    ],
};

const SOLEMNITY: AbilityDef = {
    id: 'solemnity',
    name: abilityText('solemnity', 'name'),
    type: 'offensive',
    description: abilityText('solemnity', 'description'),
    sfxKey: SAMURAI_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.HELM]: 3 } },
    effects: [
        grantToken('opponent', TOKEN_IDS.SHAME, 1, abilityEffectText('solemnity', 'inflictShame')),
        damage(7, abilityEffectText('solemnity', 'damage7')),
    ],
};

export const SOLEMNITY_2: AbilityDef = {
    id: 'solemnity',
    name: abilityText('solemnity-2', 'name'),
    type: 'offensive',
    description: abilityText('solemnity-2', 'description'),
    sfxKey: SAMURAI_SFX_HEAVY,
    variants: [
        {
            id: 'solemnity-2-solemn',
            name: abilityText('solemnity-2-solemn', 'name'),
            description: abilityText('solemnity-2-solemn', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.HELM]: 3 } },
            effects: [
                grantToken('opponent', TOKEN_IDS.SHAME, 2, abilityEffectText('solemnity-2-solemn', 'inflictShame2')),
            ],
            priority: 0,
        },
        {
            id: 'solemnity-2-main',
            name: abilityText('solemnity-2', 'name'),
            description: abilityText('solemnity-2-main', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.KATANA]: 2, [FACE.HELM]: 3 } },
            effects: [
                grantToken('opponent', TOKEN_IDS.SHAME, 2, abilityEffectText('solemnity-2', 'inflictShame2')),
                damage(8, abilityEffectText('solemnity-2', 'damage8')),
            ],
            priority: 1,
        },
    ],
};

const BUDO: AbilityDef = {
    id: 'budo',
    name: abilityText('budo', 'name'),
    type: 'offensive',
    description: abilityText('budo', 'description'),
    sfxKey: SAMURAI_SFX_HEAVY,
    trigger: { type: 'smallStraight' },
    effects: [
        grantToken('self', TOKEN_IDS.HONOR, 1, abilityEffectText('budo', 'gainHonor')),
        damage(6, abilityEffectText('budo', 'damage6')),
    ],
};

export const BUDO_2: AbilityDef = {
    id: 'budo',
    name: abilityText('budo-2', 'name'),
    type: 'offensive',
    description: abilityText('budo-2', 'description'),
    sfxKey: SAMURAI_SFX_HEAVY,
    trigger: { type: 'smallStraight' },
    effects: [
        grantToken('self', TOKEN_IDS.HONOR, 1, abilityEffectText('budo-2', 'gainHonor')),
        damage(8, abilityEffectText('budo-2', 'damage8')),
    ],
};

const SAMURAI_SLOT_06: AbilityDef = {
    id: 'samurai-slot-06',
    name: abilityText('samurai-slot-06', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('samurai-slot-06', 'description'),
    sfxKey: SAMURAI_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.RISING_SUN]: 4 } },
    effects: [
        grantToken('self', TOKEN_IDS.HONOR, 1, abilityEffectText('samurai-slot-06', 'gainHonor')),
        grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, abilityEffectText('samurai-slot-06', 'gainBackStrike')),
        grantToken('opponent', TOKEN_IDS.SHAME, 1, abilityEffectText('samurai-slot-06', 'inflictShame')),
        damage(5, abilityEffectText('samurai-slot-06', 'damage5Unblockable'), { unblockable: true }),
    ],
};

export const SAMURAI_SLOT_06_2: AbilityDef = {
    id: 'samurai-slot-06',
    name: abilityText('samurai-slot-06-2', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('samurai-slot-06-2', 'description'),
    sfxKey: SAMURAI_SFX_HEAVY,
    variants: [
        {
            id: 'samurai-slot-06-2-feather-blade-style',
            name: abilityText('samurai-slot-06-2-feather-blade-style', 'name'),
            description: abilityText('samurai-slot-06-2-feather-blade-style', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.RISING_SUN]: 3 } },
            effects: [
                grantToken('self', TOKEN_IDS.HONOR, 1, abilityEffectText('samurai-slot-06-2-feather-blade-style', 'gainHonor')),
                grantToken('opponent', TOKEN_IDS.SHAME, 2, abilityEffectText('samurai-slot-06-2-feather-blade-style', 'inflictShame2')),
                damage(2, abilityEffectText('samurai-slot-06-2-feather-blade-style', 'damage2Unblockable'), { unblockable: true }),
            ],
            tags: ['unblockable'],
            priority: 0,
        },
        {
            id: 'samurai-slot-06-2-main',
            name: abilityText('samurai-slot-06-2', 'name'),
            description: abilityText('samurai-slot-06-2-main', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.RISING_SUN]: 4 } },
            effects: [
                grantToken('self', TOKEN_IDS.HONOR, 1, abilityEffectText('samurai-slot-06-2-main', 'gainHonor')),
                grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, abilityEffectText('samurai-slot-06-2-main', 'gainBackStrike')),
                grantToken('opponent', TOKEN_IDS.SHAME, 2, abilityEffectText('samurai-slot-06-2-main', 'inflictShame2')),
                damage(7, abilityEffectText('samurai-slot-06-2-main', 'damage7Unblockable'), { unblockable: true }),
            ],
            tags: ['unblockable'],
            priority: 1,
        },
    ],
};

const MASAMUNE: AbilityDef = {
    id: 'masamune',
    name: abilityText('masamune', 'name'),
    type: 'offensive',
    description: abilityText('masamune', 'description'),
    sfxKey: SAMURAI_SFX_HEAVY,
    trigger: { type: 'largeStraight' },
    effects: [
        damage(7, abilityEffectText('masamune', 'damage7')),
        custom(
            'samurai-masamune',
            abilityEffectText('masamune', 'roll5'),
        ),
    ],
};

export const MASAMUNE_2: AbilityDef = {
    id: 'masamune',
    name: abilityText('masamune-2', 'name'),
    type: 'offensive',
    description: abilityText('masamune-2', 'description'),
    sfxKey: SAMURAI_SFX_HEAVY,
    variants: [
        {
            id: 'masamune-2-large-straight',
            name: abilityText('masamune-2', 'name'),
            description: abilityText('masamune-2-large-straight', 'description'),
            trigger: { type: 'largeStraight' },
            effects: [
                damage(7, abilityEffectText('masamune-2', 'damage7')),
                custom(
                    'samurai-masamune',
                    abilityEffectText('masamune-2', 'roll6'),
                    'withDamage',
                    { diceCount: 6 },
                ),
            ],
            priority: 2,
        },
        {
            id: 'masamune-2-power-up',
            name: abilityText('masamune-2-honor', 'name'),
            description: abilityText('masamune-2-honor', 'description'),
            trigger: { type: 'allSymbolsPresent', symbols: [FACE.KATANA, FACE.HELM, FACE.RISING_SUN] },
            effects: [
                grantToken('self', TOKEN_IDS.SAMURAI_RETRIBUTION, 1, abilityEffectText('masamune-2-honor', 'gainBackStrike'), 'preDefense'),
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
    sfxKey: SAMURAI_SFX_DEFENSE,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 3 },
    effects: [
        custom(
            'samurai-stand-tall',
            abilityEffectText('stand-tall', 'resolveDefense'),
        ),
    ],
};

export const STAND_TALL_2: AbilityDef = {
    id: 'stand-tall',
    name: abilityText('stand-tall-2', 'name'),
    type: 'defensive',
    description: abilityText('stand-tall-2', 'description'),
    sfxKey: SAMURAI_SFX_DEFENSE,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
    effects: [
        custom(
            'samurai-stand-tall-2',
            abilityEffectText('stand-tall-2', 'resolveDefense'),
        ),
    ],
};

const SAMURAI_ULTIMATE: AbilityDef = {
    id: 'samurai-ultimate',
    name: abilityText('samurai-ultimate', 'name'),
    type: 'offensive',
    tags: ['ultimate', 'unblockable'],
    description: abilityText('samurai-ultimate', 'description'),
    sfxKey: SAMURAI_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.RISING_SUN]: 5 } },
    effects: [
        grantToken('self', TOKEN_IDS.HONOR, 1, abilityEffectText('samurai-ultimate', 'gainHonor')),
        grantToken('opponent', TOKEN_IDS.SHAME, 2, abilityEffectText('samurai-ultimate', 'inflictShame2')),
        damage(13, abilityEffectText('samurai-ultimate', 'damage13Unblockable'), { unblockable: true }),
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
