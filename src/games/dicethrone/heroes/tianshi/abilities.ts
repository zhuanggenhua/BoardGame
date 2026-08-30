/** 炽天使角色板技能与升级定义 */

import { abilityEffectText, abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { STATUS_IDS, TIANSHI_DICE_FACE_IDS as FACE, TOKEN_IDS } from '../../domain/ids';

export const TIANSHI_SFX_LIGHT = 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_grace_whisper_001';
export const TIANSHI_SFX_HEAVY = 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_hallowed_beam_001';
export const TIANSHI_SFX_ULTIMATE = 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_celestial_choir_001';

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

const grantToken = (tokenId: string, value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value },
    timing,
});

const grantStatus = (statusId: string, value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
    timing,
});

const custom = (customActionId: string, description: string, timing: EffectTiming = 'preDefense', params?: Record<string, unknown>): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId, ...(params ? { params } : {}) },
    timing,
});

const replaceable = (id: string, nameId: string, descriptionId: string, trigger: AbilityDef['trigger'], effects: AbilityEffect[], opts?: Pick<AbilityDef, 'type' | 'tags'>): AbilityDef => ({
    id,
    name: abilityText(nameId, 'name'),
    type: opts?.type ?? 'offensive',
    tags: opts?.tags,
    description: abilityText(descriptionId, 'description'),
    sfxKey: TIANSHI_SFX_HEAVY,
    trigger,
    effects,
});

export const HOLY_BLADE_2: AbilityDef = {
    ...replaceable('holy-blade', 'holy-blade-2', 'holy-blade-2', { type: 'diceSet', faces: { [FACE.BLADE]: 3 } }, [damage(6, abilityEffectText('holy-blade-2', 'damage6'))]),
    variants: [
        { id: 'holy-blade-2-3', trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 3 } }, effects: [damage(6, abilityEffectText('holy-blade-2', 'damage6'))], priority: 0 },
        { id: 'holy-blade-2-4', trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 4 } }, effects: [damage(7, abilityEffectText('holy-blade-2', 'damage7'))], priority: 1 },
        { id: 'holy-blade-2-5', trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 5 } }, effects: [damage(8, abilityEffectText('holy-blade-2', 'damage8'))], priority: 2 },
        {
            id: 'cherub',
            name: abilityText('cherub', 'name'),
            description: abilityText('cherub', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 3, [FACE.SHIELD]: 1 } },
            effects: [custom('tianshi-cherub-basic-card', abilityEffectText('upgrade-tianshi-holy-blade-2-cherub', 'secondary'))],
            priority: 3,
        },
    ],
};

export const HOLY_BLADE_3: AbilityDef = {
    ...HOLY_BLADE_2,
    name: abilityText('holy-blade-3', 'name'),
    description: abilityText('holy-blade-3', 'description'),
    variants: [
        {
            id: 'holy-blade-3-3',
            trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 3 } },
            effects: [
                damage(5, abilityEffectText('holy-blade-3', 'damage5')),
                custom('tianshi-holy-blade-3-four-kind-dazzle', abilityEffectText('holy-blade-3', 'dazzleIfFourKind')),
            ],
            priority: 0,
        },
        {
            id: 'holy-blade-3-4',
            trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 4 } },
            effects: [
                damage(7, abilityEffectText('holy-blade-3', 'damage7')),
                custom('tianshi-holy-blade-3-four-kind-dazzle', abilityEffectText('holy-blade-3', 'dazzleIfFourKind')),
            ],
            priority: 1,
        },
        {
            id: 'holy-blade-3-5',
            trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 5 } },
            effects: [
                damage(9, abilityEffectText('holy-blade-3', 'damage9')),
                custom('tianshi-holy-blade-3-four-kind-dazzle', abilityEffectText('holy-blade-3', 'dazzleIfFourKind')),
            ],
            priority: 2,
        },
        {
            id: 'cherub-2',
            name: abilityText('cherub-2', 'name'),
            description: abilityText('cherub-2', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 3, [FACE.SHIELD]: 1 } },
            effects: [custom('tianshi-cherub-card', abilityEffectText('upgrade-tianshi-holy-blade-3-cherub-2', 'secondary'))],
            priority: 3,
        },
    ],
};

export const HOLY_RADIANCE_2: AbilityDef = {
    ...replaceable('holy-radiance', 'holy-radiance-2', 'holy-radiance-2', { type: 'diceSet', faces: { [FACE.BLADE]: 3, [FACE.WING]: 1 } }, [
        grantToken(TOKEN_IDS.FLIGHT, 1, abilityEffectText('holy-radiance-2', 'gainFlight')),
        damage(7, abilityEffectText('holy-radiance-2', 'damage7')),
    ]),
    variants: [
        {
            id: 'holy-radiance-2-main',
            name: abilityText('holy-radiance-2', 'name'),
            description: abilityText('holy-radiance-2', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 3, [FACE.WING]: 1 } },
            effects: [
                grantToken(TOKEN_IDS.FLIGHT, 1, abilityEffectText('holy-radiance-2', 'gainFlight')),
                damage(7, abilityEffectText('holy-radiance-2', 'damage7')),
            ],
            priority: 1,
        },
        {
            id: 'takeoff',
            name: abilityText('takeoff', 'name'),
            description: abilityText('takeoff', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 1, [FACE.WING]: 2 } },
            effects: [custom('tianshi-takeoff-card', abilityEffectText('upgrade-tianshi-holy-radiance-2-takeoff', 'secondary'))],
            tags: ['unblockable'],
            priority: 0,
        },
    ],
};

export const DIVINE_PURIFICATION_2: AbilityDef = {
    ...replaceable('divine-purification', 'divine-purification-2', 'divine-purification-2', { type: 'diceSet', faces: { [FACE.CROSS]: 2, [FACE.SHIELD]: 1 } }, [custom('tianshi-divine-purification', abilityEffectText('divine-purification-2', 'resolve'), 'preDefense', { damage: 6, heal: 5 })]),
};

export const DIVINE_PUNISHMENT_2: AbilityDef = {
    ...replaceable('divine-punishment', 'divine-punishment-2', 'divine-punishment-2', { type: 'allSymbolsPresent', symbols: [FACE.BLADE, FACE.WING, FACE.CROSS, FACE.SHIELD] }, [custom('tianshi-divine-punishment', abilityEffectText('divine-punishment-2', 'resolve'), 'preDefense', { damagePerBlade: 2 })]),
    variants: [
        {
            id: 'divine-punishment-2-main',
            name: abilityText('divine-punishment-2', 'name'),
            description: abilityText('divine-punishment-2', 'description'),
            trigger: { type: 'allSymbolsPresent', symbols: [FACE.BLADE, FACE.WING, FACE.CROSS, FACE.SHIELD] },
            effects: [custom('tianshi-divine-punishment', abilityEffectText('divine-punishment-2', 'resolve'), 'preDefense', { damagePerBlade: 2 })],
            priority: 1,
        },
        {
            id: 'divine-command',
            name: abilityText('divine-command', 'name'),
            description: abilityText('divine-command', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 3, [FACE.CROSS]: 1 } },
            effects: [custom('tianshi-divine-command-card', abilityEffectText('upgrade-tianshi-divine-punishment-2-divine-command', 'secondary'))],
            tags: ['unblockable'],
            priority: 0,
        },
    ],
};

export const TRIUMPHANT_RETURN_2: AbilityDef = {
    ...replaceable('triumphant-return', 'triumphant-return-2', 'triumphant-return-2', { type: 'smallStraight' }, [
        damage(8, abilityEffectText('triumphant-return-2', 'damage8')),
        custom('tianshi-triumphant-return-roll', abilityEffectText('triumphant-return-2', 'roll'), 'preDefense'),
    ]),
};

export const SUPREME_POWER_2: AbilityDef = {
    ...replaceable('supreme-power', 'supreme-power-2', 'supreme-power-2', { type: 'diceSet', faces: { [FACE.SHIELD]: 4 } }, [
        grantToken(TOKEN_IDS.FLIGHT, 1, abilityEffectText('supreme-power-2', 'gainFlight')),
        grantToken(TOKEN_IDS.DIVINE_ARRIVAL, 1, abilityEffectText('supreme-power-2', 'gainDivineArrival')),
        grantStatus(STATUS_IDS.DAZZLE, 1, abilityEffectText('supreme-power-2', 'dazzle')),
        damage(10, abilityEffectText('supreme-power-2', 'damage10')),
    ]),
    variants: [
        {
            id: 'supreme-power-2-main',
            name: abilityText('supreme-power-2', 'name'),
            description: abilityText('supreme-power-2', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.SHIELD]: 4 } },
            effects: [
                grantToken(TOKEN_IDS.FLIGHT, 1, abilityEffectText('supreme-power-2', 'gainFlight')),
                grantToken(TOKEN_IDS.DIVINE_ARRIVAL, 1, abilityEffectText('supreme-power-2', 'gainDivineArrival')),
                grantStatus(STATUS_IDS.DAZZLE, 1, abilityEffectText('supreme-power-2', 'dazzle')),
                damage(10, abilityEffectText('supreme-power-2', 'damage10')),
            ],
            priority: 1,
        },
        {
            id: 'gospel-arrival',
            name: abilityText('gospel-arrival', 'name'),
            description: abilityText('gospel-arrival', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.SHIELD]: 3 } },
            effects: [custom('tianshi-gospel-arrival-card', abilityEffectText('upgrade-tianshi-supreme-power-2-gospel-arrival', 'secondary'))],
            priority: 0,
        },
    ],
};

export const ARCHANGEL_RESOLVE_2: AbilityDef = {
    ...replaceable('archangel-resolve', 'archangel-resolve-2', 'archangel-resolve-2', { type: 'largeStraight' }, [
        grantToken(TOKEN_IDS.FLIGHT, 1, abilityEffectText('archangel-resolve-2', 'gainFlight')),
        grantStatus(STATUS_IDS.DAZZLE, 1, abilityEffectText('archangel-resolve-2', 'dazzle')),
        damage(9, abilityEffectText('archangel-resolve-2', 'damage9')),
    ]),
    variants: [
        {
            id: 'archangel-resolve-2-main',
            name: abilityText('archangel-resolve-2', 'name'),
            description: abilityText('archangel-resolve-2', 'description'),
            trigger: { type: 'largeStraight' },
            effects: [
                grantToken(TOKEN_IDS.FLIGHT, 1, abilityEffectText('archangel-resolve-2', 'gainFlight')),
                grantStatus(STATUS_IDS.DAZZLE, 1, abilityEffectText('archangel-resolve-2', 'dazzle')),
                damage(9, abilityEffectText('archangel-resolve-2', 'damage9')),
            ],
            priority: 1,
        },
        {
            id: 'divine-protection',
            name: abilityText('divine-protection', 'name'),
            description: abilityText('divine-protection', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 1, [FACE.CROSS]: 2 } },
            effects: [custom('tianshi-divine-protection-card', abilityEffectText('upgrade-tianshi-archangel-resolve-2-divine-protection', 'secondary'))],
            priority: 0,
        },
    ],
};

export const ANGELIC_CLOAK_2: AbilityDef = {
    ...replaceable('angelic-cloak', 'angelic-cloak-2', 'angelic-cloak-2', { type: 'phase', phaseId: 'defensiveRoll', diceCount: 1, rollLimit: 2, rerollDieLimit: 1 }, [custom('tianshi-angelic-cloak', abilityEffectText('angelic-cloak-2', 'resolve'), 'withDamage', { blade: 2, wing: 1, cross: 2, shield: 3 })], { type: 'defensive', tags: ['defensive'] }),
};

export const ANGELIC_CLOAK_3: AbilityDef = {
    ...replaceable('angelic-cloak', 'angelic-cloak-3', 'angelic-cloak-3', { type: 'phase', phaseId: 'defensiveRoll', diceCount: 1, rollLimit: 2, rerollDieLimit: 1 }, [custom('tianshi-angelic-cloak', abilityEffectText('angelic-cloak-3', 'resolve'), 'withDamage', { blade: 3, wing: 2, cross: 3, shield: 4 })], { type: 'defensive', tags: ['defensive'] }),
};

export const TIANSHI_ABILITIES: AbilityDef[] = [
    {
        id: 'holy-blade',
        name: abilityText('holy-blade', 'name'),
        type: 'offensive',
        description: abilityText('holy-blade', 'description'),
        sfxKey: TIANSHI_SFX_HEAVY,
        variants: [
            { id: 'holy-blade-3', trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 3 } }, effects: [damage(5, abilityEffectText('holy-blade', 'damage5'))], priority: 0 },
            { id: 'holy-blade-4', trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 4 } }, effects: [damage(6, abilityEffectText('holy-blade', 'damage6'))], priority: 1 },
            { id: 'holy-blade-5', trigger: { type: 'diceSet', faces: { [FACE.BLADE]: 5 } }, effects: [damage(7, abilityEffectText('holy-blade', 'damage7'))], priority: 2 },
        ],
    },
    replaceable('holy-radiance', 'holy-radiance', 'holy-radiance', { type: 'diceSet', faces: { [FACE.BLADE]: 3, [FACE.WING]: 1 } }, [
        grantToken(TOKEN_IDS.FLIGHT, 1, abilityEffectText('holy-radiance', 'gainFlight')),
        damage(6, abilityEffectText('holy-radiance', 'damage6')),
    ]),
    replaceable('divine-purification', 'divine-purification', 'divine-purification', { type: 'diceSet', faces: { [FACE.CROSS]: 2, [FACE.SHIELD]: 1 } }, [custom('tianshi-divine-purification', abilityEffectText('divine-purification', 'resolve'), 'preDefense', { damage: 5, heal: 4 })]),
    replaceable('divine-punishment', 'divine-punishment', 'divine-punishment', { type: 'allSymbolsPresent', symbols: [FACE.BLADE, FACE.WING, FACE.CROSS, FACE.SHIELD] }, [custom('tianshi-divine-punishment', abilityEffectText('divine-punishment', 'resolve'), 'preDefense', { damagePerBlade: 2 })]),
    replaceable('triumphant-return', 'triumphant-return', 'triumphant-return', { type: 'smallStraight' }, [
        damage(6, abilityEffectText('triumphant-return', 'damage6')),
        custom('tianshi-triumphant-return-roll', abilityEffectText('triumphant-return', 'roll'), 'preDefense'),
    ]),
    replaceable('supreme-power', 'supreme-power', 'supreme-power', { type: 'diceSet', faces: { [FACE.SHIELD]: 4 } }, [
        grantToken(TOKEN_IDS.FLIGHT, 1, abilityEffectText('supreme-power', 'gainFlight')),
        grantToken(TOKEN_IDS.DIVINE_ARRIVAL, 1, abilityEffectText('supreme-power', 'gainDivineArrival')),
        grantStatus(STATUS_IDS.DAZZLE, 1, abilityEffectText('supreme-power', 'dazzle')),
        damage(8, abilityEffectText('supreme-power', 'damage8')),
    ]),
    replaceable('archangel-resolve', 'archangel-resolve', 'archangel-resolve', { type: 'largeStraight' }, [
        grantToken(TOKEN_IDS.FLIGHT, 1, abilityEffectText('archangel-resolve', 'gainFlight')),
        grantStatus(STATUS_IDS.DAZZLE, 1, abilityEffectText('archangel-resolve', 'dazzle')),
        damage(8, abilityEffectText('archangel-resolve', 'damage8')),
    ]),
    replaceable('angelic-cloak', 'angelic-cloak', 'angelic-cloak', { type: 'phase', phaseId: 'defensiveRoll', diceCount: 1 }, [custom('tianshi-angelic-cloak', abilityEffectText('angelic-cloak', 'resolve'), 'withDamage', { blade: 2, wing: 1, cross: 2, shield: 3 })], { type: 'defensive', tags: ['defensive'] }),
    {
        id: 'heavenly-severing',
        name: abilityText('heavenly-severing', 'name'),
        type: 'offensive',
        description: abilityText('heavenly-severing', 'description'),
        sfxKey: TIANSHI_SFX_ULTIMATE,
        tags: ['ultimate', 'uninterruptible'],
        trigger: { type: 'diceSet', faces: { [FACE.SHIELD]: 5 } },
        effects: [
            grantToken(TOKEN_IDS.FLIGHT, 1, abilityEffectText('heavenly-severing', 'gainFlight')),
            grantToken(TOKEN_IDS.DIVINE_ARRIVAL, 1, abilityEffectText('heavenly-severing', 'gainDivineArrival')),
            grantToken(TOKEN_IDS.BLESSING_OF_DIVINITY, 1, abilityEffectText('heavenly-severing', 'gainBlessing')),
            damage(13, abilityEffectText('heavenly-severing', 'damage13')),
        ],
    },
];
