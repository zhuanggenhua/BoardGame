/** 女猎手角色板技能与升级定义 */

import { abilityEffectText, abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { LIEREN_DICE_FACE_IDS as FACE, STATUS_IDS } from '../../domain/ids';

export const LIEREN_SFX_LIGHT = 'fantasy.medieval_fantasy_sound_fx_pack_vol.creatures.creature_wolf_snarl_001';
export const LIEREN_SFX_HEAVY = 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_spear_attack_001';
export const LIEREN_SFX_ULTIMATE = 'fantasy.medieval_fantasy_sound_fx_pack_vol.creatures.creature_monster_roar_001';

const damage = (
    value: number,
    description: string,
    opts?: { timing?: EffectTiming; unblockable?: boolean; damageScope?: 'attack' | 'direct' },
): AbilityEffect => ({
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

const grantBleed = (value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.BLEED, value },
    timing,
});

const nyraEffect = (
    description: string,
    effect: 'heal' | 'grant-bond' | 'grant-bond-and-heal',
    amount = 0,
    timing: EffectTiming = 'preDefense',
): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target: 'self',
        customActionId: 'lieren-nyra-effect',
        params: { effect, amount },
    },
    timing,
});

const kindredBondEffect = (
    description: string,
    params?: { includeSabertooth?: boolean },
): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target: 'self',
        customActionId: 'lieren-kindred-bond',
        params,
    },
    timing: 'withDamage',
});

const replaceable = (
    id: string,
    nameId: string,
    descriptionId: string,
    trigger: AbilityDef['trigger'],
    effects: AbilityEffect[],
    opts?: Pick<AbilityDef, 'type' | 'tags' | 'sfxKey'>,
): AbilityDef => ({
    id,
    name: abilityText(nameId, 'name'),
    type: opts?.type ?? 'offensive',
    tags: opts?.tags,
    description: abilityText(descriptionId, 'description'),
    sfxKey: opts?.sfxKey ?? LIEREN_SFX_HEAVY,
    trigger,
    effects,
});

const savageForceRoll = (sourceId: string): AbilityEffect => ({
    description: abilityEffectText(sourceId, 'bonusDie'),
    action: {
        type: 'rollDie',
        target: 'opponent',
        diceCount: 1,
        conditionalEffects: [
            { face: FACE.SPEAR, bonusDamage: 1, effectKey: 'bonusDie.effect.lieren.savageForce.spear' },
            { face: FACE.CLAW, bonusDamage: 2, effectKey: 'bonusDie.effect.lieren.savageForce.claw' },
            {
                face: FACE.NYRAS_BOND,
                grantToken: { tokenId: 'nyras_bond', value: 1, target: 'self' },
                effectKey: 'bonusDie.effect.lieren.savageForce.nyrasBond',
            },
            {
                face: FACE.SABERTOOTH,
                grantStatus: { statusId: STATUS_IDS.BLEED, value: 1, target: 'opponent' },
                effectKey: 'bonusDie.effect.lieren.savageForce.sabertooth',
            },
        ],
        resolutionMode: 'attackBonus',
    },
    timing: 'postDamage',
});

export const WILD_FORCE_2: AbilityDef = {
    id: 'wild-force',
    name: abilityText('wild-force-2', 'name'),
    type: 'offensive',
    description: abilityText('wild-force-2', 'description'),
    sfxKey: LIEREN_SFX_HEAVY,
    variants: [
        {
            id: 'wild-force-2-3',
            trigger: { type: 'diceSet', faces: { [FACE.SPEAR]: 3 } },
            effects: [damage(4, abilityEffectText('wild-force-2', 'damage4'))],
            priority: 0,
        },
        {
            id: 'wild-force-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.SPEAR]: 4 } },
            effects: [
                grantBleed(1, abilityEffectText('wild-force-2', 'bleedIfFourKind')),
                damage(5, abilityEffectText('wild-force-2', 'damage5')),
            ],
            priority: 1,
        },
        {
            id: 'wild-force-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.SPEAR]: 5 } },
            effects: [
                grantBleed(1, abilityEffectText('wild-force-2', 'bleedIfFourKind')),
                damage(6, abilityEffectText('wild-force-2', 'damage6')),
            ],
            priority: 2,
        },
    ],
};

export const SAVAGE_FORCE_2: AbilityDef = {
    ...replaceable('savage-force', 'savage-force-2', 'savage-force-2', { type: 'diceSet', faces: { [FACE.CLAW]: 3, [FACE.SABERTOOTH]: 1 } }, [
        damage(5, abilityEffectText('savage-force-2', 'damage5')),
        savageForceRoll('savage-force-2'),
    ]),
    variants: [
        {
            id: 'savage-force-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 3, [FACE.SABERTOOTH]: 1 } },
            effects: [
                damage(5, abilityEffectText('savage-force-2', 'damage5')),
                savageForceRoll('savage-force-2'),
            ],
            priority: 1,
        },
        {
            id: 'savage-force-2-hunting',
            name: abilityText('savage-force-2-hunting', 'name'),
            description: abilityText('savage-force-2-hunting', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 2, [FACE.SABERTOOTH]: 1 } },
            effects: [
                grantBleed(1, abilityEffectText('savage-force-2-hunting', 'bleed1')),
                damage(3, abilityEffectText('savage-force-2-hunting', 'damage3')),
            ],
            priority: 0,
        },
    ],
};

export const BRUTAL_STRIKE_2: AbilityDef = {
    ...replaceable('brutal-strike', 'brutal-strike-2', 'brutal-strike-2', { type: 'smallStraight' }, [
        grantBleed(1, abilityEffectText('brutal-strike-2', 'bleed1')),
        damage(5, abilityEffectText('brutal-strike-2', 'damage5')),
    ]),
    variants: [
        {
            id: 'brutal-strike-2-small',
            trigger: { type: 'smallStraight' },
            effects: [
                grantBleed(1, abilityEffectText('brutal-strike-2', 'bleed1')),
                damage(5, abilityEffectText('brutal-strike-2', 'damage5')),
            ],
            priority: 0,
        },
        {
            id: 'brutal-strike-2-large',
            trigger: { type: 'largeStraight' },
            effects: [
                grantBleed(2, abilityEffectText('brutal-strike-2', 'bleed2')),
                damage(8, abilityEffectText('brutal-strike-2', 'damage8')),
            ],
            priority: 1,
        },
    ],
};

export const BEAST_FORCE_2: AbilityDef = {
    ...replaceable('beast-force', 'beast-force-2', 'beast-force-2', { type: 'diceSet', faces: { [FACE.SABERTOOTH]: 4 } }, [
        nyraEffect(abilityEffectText('beast-force-2', 'healNyra1'), 'heal', 1),
        damage(6, abilityEffectText('beast-force-2', 'unblockable6'), { unblockable: true }),
    ]),
    variants: [
        {
            id: 'beast-force-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.SABERTOOTH]: 4 } },
            effects: [
                nyraEffect(abilityEffectText('beast-force-2', 'healNyra1'), 'heal', 1),
                damage(6, abilityEffectText('beast-force-2', 'unblockable6'), { unblockable: true }),
            ],
            priority: 1,
        },
        {
            id: 'beast-force-2-fierce-gaze',
            name: abilityText('beast-force-2-fierce-gaze', 'name'),
            description: abilityText('beast-force-2-fierce-gaze', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.SABERTOOTH]: 3 } },
            effects: [
                nyraEffect(abilityEffectText('beast-force-2-fierce-gaze', 'healNyra1'), 'heal', 1),
                grantBleed(2, abilityEffectText('beast-force-2-fierce-gaze', 'bleed2')),
            ],
            priority: 0,
        },
    ],
};

export const LIFE_REVIVAL_2: AbilityDef = replaceable('life-revival', 'life-revival-2', 'life-revival-2', { type: 'diceSet', faces: { [FACE.NYRAS_BOND]: 2 } }, [
    nyraEffect(abilityEffectText('life-revival-2', 'nyrasBondAndHeal'), 'grant-bond-and-heal', 2),
], { sfxKey: LIEREN_SFX_LIGHT });

export const BEAST_INSTINCT_2: AbilityDef = {
    ...replaceable('beast-instinct', 'beast-instinct-2', 'beast-instinct-2', { type: 'diceSet', faces: { [FACE.SPEAR]: 3, [FACE.NYRAS_BOND]: 1 } }, [
    nyraEffect(abilityEffectText('beast-instinct-2', 'gainNyrasBond'), 'grant-bond'),
        damage(3, abilityEffectText('beast-instinct-2', 'unblockable3'), { unblockable: true }),
    ]),
    variants: [
        {
            id: 'beast-instinct-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.SPEAR]: 3, [FACE.NYRAS_BOND]: 1 } },
            effects: [
                nyraEffect(abilityEffectText('beast-instinct-2', 'gainNyrasBond'), 'grant-bond'),
                damage(3, abilityEffectText('beast-instinct-2', 'unblockable3'), { unblockable: true }),
            ],
            priority: 1,
        },
        {
            id: 'beast-instinct-2-swipe',
            name: abilityText('beast-instinct-2-swipe', 'name'),
            description: abilityText('beast-instinct-2-swipe', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 3 } },
            effects: [grantBleed(1, abilityEffectText('beast-instinct-2-swipe', 'bleed1'))],
            priority: 0,
        },
    ],
};

export const HUNT_AMBUSH_2: AbilityDef = {
    ...replaceable('hunt-ambush', 'hunt-ambush-2', 'hunt-ambush-2', { type: 'diceSet', faces: { [FACE.SPEAR]: 2, [FACE.CLAW]: 2, [FACE.NYRAS_BOND]: 1 } }, [
    nyraEffect(abilityEffectText('hunt-ambush-2', 'healNyra1'), 'heal', 1),
        damage(6, abilityEffectText('hunt-ambush-2', 'damage6')),
    ]),
    variants: [
        {
            id: 'hunt-ambush-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.SPEAR]: 2, [FACE.CLAW]: 2, [FACE.NYRAS_BOND]: 1 } },
            effects: [
                nyraEffect(abilityEffectText('hunt-ambush-2', 'healNyra1'), 'heal', 1),
                damage(6, abilityEffectText('hunt-ambush-2', 'damage6')),
            ],
            priority: 1,
        },
        {
            id: 'hunt-ambush-2-cutthroat',
            name: abilityText('hunt-ambush-2-cutthroat', 'name'),
            description: abilityText('hunt-ambush-2-cutthroat', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.SPEAR]: 1, [FACE.CLAW]: 1, [FACE.SABERTOOTH]: 1 } },
            effects: [grantBleed(2, abilityEffectText('hunt-ambush-2-cutthroat', 'bleed2'))],
            priority: 0,
        },
    ],
};

export const KINDRED_BOND_2: AbilityDef = replaceable('kindred-bond', 'kindred-bond-2', 'kindred-bond-2', { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 }, [
    kindredBondEffect(abilityEffectText('kindred-bond-2', 'blockedDefense')),
], { type: 'defensive', tags: ['defensive'], sfxKey: LIEREN_SFX_LIGHT });

export const KINDRED_BOND_3: AbilityDef = replaceable('kindred-bond', 'kindred-bond-3', 'kindred-bond-3', { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 }, [
    kindredBondEffect(abilityEffectText('kindred-bond-3', 'blockedDefense'), { includeSabertooth: true }),
], { type: 'defensive', tags: ['defensive'], sfxKey: LIEREN_SFX_LIGHT });

export const LIEREN_ABILITIES: AbilityDef[] = [
    {
        id: 'wild-force',
        name: abilityText('wild-force', 'name'),
        type: 'offensive',
        description: abilityText('wild-force', 'description'),
        sfxKey: LIEREN_SFX_HEAVY,
        variants: [
            { id: 'wild-force-3', trigger: { type: 'diceSet', faces: { [FACE.SPEAR]: 3 } }, effects: [damage(3, abilityEffectText('wild-force', 'damage3'))], priority: 0 },
            { id: 'wild-force-4', trigger: { type: 'diceSet', faces: { [FACE.SPEAR]: 4 } }, effects: [damage(4, abilityEffectText('wild-force', 'damage4'))], priority: 1 },
            { id: 'wild-force-5', trigger: { type: 'diceSet', faces: { [FACE.SPEAR]: 5 } }, effects: [damage(5, abilityEffectText('wild-force', 'damage5'))], priority: 2 },
        ],
    },
    replaceable('savage-force', 'savage-force', 'savage-force', { type: 'diceSet', faces: { [FACE.CLAW]: 3, [FACE.SABERTOOTH]: 1 } }, [
        damage(4, abilityEffectText('savage-force', 'damage4')),
        savageForceRoll('savage-force'),
    ]),
    {
        ...replaceable('brutal-strike', 'brutal-strike', 'brutal-strike', { type: 'smallStraight' }, [
            grantBleed(1, abilityEffectText('brutal-strike', 'bleed1')),
            damage(4, abilityEffectText('brutal-strike', 'damage4')),
        ]),
        variants: [
            {
                id: 'brutal-strike-small',
                trigger: { type: 'smallStraight' },
                effects: [
                    grantBleed(1, abilityEffectText('brutal-strike', 'bleed1')),
                    damage(4, abilityEffectText('brutal-strike', 'damage4')),
                ],
                priority: 0,
            },
            {
                id: 'brutal-strike-large',
                trigger: { type: 'largeStraight' },
                effects: [
                    grantBleed(2, abilityEffectText('brutal-strike', 'bleed2')),
                    damage(7, abilityEffectText('brutal-strike', 'damage7')),
                ],
                priority: 1,
            },
        ],
    },
    replaceable('beast-force', 'beast-force', 'beast-force', { type: 'diceSet', faces: { [FACE.SABERTOOTH]: 4 } }, [
        nyraEffect(abilityEffectText('beast-force', 'healNyra1'), 'heal', 1),
        damage(5, abilityEffectText('beast-force', 'unblockable5'), { unblockable: true }),
    ]),
    replaceable('life-revival', 'life-revival', 'life-revival', { type: 'diceSet', faces: { [FACE.NYRAS_BOND]: 2 } }, [
        nyraEffect(abilityEffectText('life-revival', 'nyrasBondAndHeal'), 'grant-bond-and-heal', 3),
    ], { sfxKey: LIEREN_SFX_LIGHT }),
    replaceable('beast-instinct', 'beast-instinct', 'beast-instinct', { type: 'diceSet', faces: { [FACE.SPEAR]: 3, [FACE.NYRAS_BOND]: 1 } }, [
        nyraEffect(abilityEffectText('beast-instinct', 'gainNyrasBond'), 'grant-bond'),
        damage(2, abilityEffectText('beast-instinct', 'unblockable2'), { unblockable: true }),
    ]),
    replaceable('hunt-ambush', 'hunt-ambush', 'hunt-ambush', { type: 'diceSet', faces: { [FACE.SPEAR]: 2, [FACE.CLAW]: 2, [FACE.NYRAS_BOND]: 1 } }, [
        nyraEffect(abilityEffectText('hunt-ambush', 'healNyra1'), 'heal', 1),
        damage(5, abilityEffectText('hunt-ambush', 'damage5')),
    ]),
    replaceable('kindred-bond', 'kindred-bond', 'kindred-bond', { type: 'phase', phaseId: 'defensiveRoll', diceCount: 3 }, [
        kindredBondEffect(abilityEffectText('kindred-bond', 'blockedDefense')),
    ], { type: 'defensive', tags: ['defensive'], sfxKey: LIEREN_SFX_LIGHT }),
    {
        id: 'jungle-fury',
        name: abilityText('jungle-fury', 'name'),
        type: 'offensive',
        description: abilityText('jungle-fury', 'description'),
        sfxKey: LIEREN_SFX_ULTIMATE,
        tags: ['ultimate', 'uninterruptible'],
        trigger: { type: 'diceSet', faces: { [FACE.SABERTOOTH]: 5 } },
        effects: [
            nyraEffect(abilityEffectText('jungle-fury', 'gainNyrasBond'), 'grant-bond'),
            grantBleed(2, abilityEffectText('jungle-fury', 'bleed2')),
            damage(12, abilityEffectText('jungle-fury', 'damage12')),
        ],
    },
];
