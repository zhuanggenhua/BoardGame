/** 吸血鬼领主角色板技能与升级定义 */

import { abilityEffectText, abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { STATUS_IDS, TOKEN_IDS, VAMPIRE_LORD_DICE_FACE_IDS as FACE } from '../../domain/ids';

export const VAMPIRE_LORD_SFX_LIGHT = 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_001';
export const VAMPIRE_LORD_SFX_HEAVY = 'combat.general.fight_fury_vol_2.medium_blood_and_bones.goreooze_medium_blood_and_bones_01_krst';
export const VAMPIRE_LORD_SFX_ULTIMATE = 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001';

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

const grantToken = (
    tokenId: string,
    value: number,
    description: string,
    timing: EffectTiming = 'preDefense',
): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value },
    timing,
});

const healSelf = (value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'heal', target: 'self', value },
    timing,
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
    sfxKey: opts?.sfxKey ?? VAMPIRE_LORD_SFX_HEAVY,
    trigger,
    effects,
});

export const BLOODTHIRSTY_CLAWS_2: AbilityDef = {
    id: 'bloodthirsty-claws',
    name: abilityText('bloodthirsty-claws-2', 'name'),
    type: 'offensive',
    description: abilityText('bloodthirsty-claws-2', 'description'),
    sfxKey: VAMPIRE_LORD_SFX_HEAVY,
    variants: [
        { id: 'bloodthirsty-claws-2-3', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 3 } }, effects: [damage(4, abilityEffectText('bloodthirsty-claws-2', 'damage4'))], priority: 0 },
        { id: 'bloodthirsty-claws-2-4', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 4 } }, effects: [damage(5, abilityEffectText('bloodthirsty-claws-2', 'damage5'))], priority: 1 },
        { id: 'bloodthirsty-claws-2-5', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 5 } }, effects: [damage(6, abilityEffectText('bloodthirsty-claws-2', 'damage6'))], priority: 2 },
    ],
};

export const BLOODTHIRSTY_CLAWS_3: AbilityDef = {
    id: 'bloodthirsty-claws',
    name: abilityText('bloodthirsty-claws-3', 'name'),
    type: 'offensive',
    description: abilityText('bloodthirsty-claws-3', 'description'),
    sfxKey: VAMPIRE_LORD_SFX_HEAVY,
    variants: [
        { id: 'bloodthirsty-claws-3-3', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 3 } }, effects: [damage(4, abilityEffectText('bloodthirsty-claws-3', 'damage4'))], priority: 0 },
        { id: 'bloodthirsty-claws-3-4', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 4 } }, effects: [damage(6, abilityEffectText('bloodthirsty-claws-3', 'damage6'))], priority: 1 },
        { id: 'bloodthirsty-claws-3-5', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 5 } }, effects: [damage(8, abilityEffectText('bloodthirsty-claws-3', 'damage8'))], priority: 2 },
    ],
};

export const MESMERIZE_POWER_2: AbilityDef = replaceable('mesmerize-power', 'mesmerize-power-2', 'mesmerize-power-2', { type: 'diceSet', faces: { [FACE.MESMERIZE]: 3 } }, [
    grantToken(TOKEN_IDS.MESMERIZE, 1, abilityEffectText('mesmerize-power-2', 'gainMesmerize')),
    damage(5, abilityEffectText('mesmerize-power-2', 'damage5')),
], { sfxKey: VAMPIRE_LORD_SFX_LIGHT });

export const BLOOD_FEAST_2: AbilityDef = replaceable('blood-feast', 'blood-feast-2', 'blood-feast-2', { type: 'diceSet', faces: { [FACE.BLOOD_DROP]: 3 } }, [
    healSelf(2, abilityEffectText('blood-feast-2', 'heal2')),
    grantToken(TOKEN_IDS.BLOOD_POWER, 3, abilityEffectText('blood-feast-2', 'gainBloodPower')),
    damage(7, abilityEffectText('blood-feast-2', 'damage7')),
]);

export const REND_CLAWS_2: AbilityDef = replaceable('rend-claws', 'rend-claws-2', 'rend-claws-2', { type: 'smallStraight' }, [
    grantBleed(1, abilityEffectText('rend-claws-2', 'bleed1')),
    damage(6, abilityEffectText('rend-claws-2', 'damage6')),
]);

export const BLOOD_POSSESSED_2: AbilityDef = replaceable('blood-possessed', 'blood-possessed-2', 'blood-possessed-2', { type: 'largeStraight' }, [
    grantToken(TOKEN_IDS.BLOOD_POWER, 2, abilityEffectText('blood-possessed-2', 'gainBloodPower')),
    damage(8, abilityEffectText('blood-possessed-2', 'damage8')),
]);

export const BLOOD_THIRST_2: AbilityDef = replaceable('blood-thirst', 'blood-thirst-2', 'blood-thirst-2', { type: 'largeStraight' }, [
    grantBleed(2, abilityEffectText('blood-thirst-2', 'bleed2')),
    damage(6, abilityEffectText('blood-thirst-2', 'damage6')),
]);

export const BLOOD_MAGIC_2: AbilityDef = replaceable('blood-magic', 'blood-magic-2', 'blood-magic-2', { type: 'smallStraight' }, [
    grantToken(TOKEN_IDS.BLOOD_POWER, 2, abilityEffectText('blood-magic-2', 'gainBloodPower')),
    damage(8, abilityEffectText('blood-magic-2', 'damage8')),
]);

export const UNDYING_2: AbilityDef = replaceable('undying', 'undying-2', 'undying-2', { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 }, [
    damage(1, abilityEffectText('undying-2', 'counter1'), { timing: 'withDamage', damageScope: 'direct' }),
    healSelf(1, abilityEffectText('undying-2', 'heal1'), 'postDamage'),
], { type: 'defensive', tags: ['defensive'], sfxKey: VAMPIRE_LORD_SFX_LIGHT });

export const VAMPIRE_LORD_ABILITIES: AbilityDef[] = [
    {
        id: 'bloodthirsty-claws',
        name: abilityText('bloodthirsty-claws', 'name'),
        type: 'offensive',
        description: abilityText('bloodthirsty-claws', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_HEAVY,
        variants: [
            { id: 'bloodthirsty-claws-3', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 3 } }, effects: [damage(3, abilityEffectText('bloodthirsty-claws', 'damage3'))], priority: 0 },
            { id: 'bloodthirsty-claws-4', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 4 } }, effects: [damage(4, abilityEffectText('bloodthirsty-claws', 'damage4'))], priority: 1 },
            { id: 'bloodthirsty-claws-5', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 5 } }, effects: [damage(5, abilityEffectText('bloodthirsty-claws', 'damage5'))], priority: 2 },
        ],
    },
    replaceable('mesmerize-power', 'mesmerize-power', 'mesmerize-power', { type: 'diceSet', faces: { [FACE.MESMERIZE]: 3 } }, [
        grantToken(TOKEN_IDS.MESMERIZE, 1, abilityEffectText('mesmerize-power', 'gainMesmerize')),
        damage(4, abilityEffectText('mesmerize-power', 'damage4')),
    ], { sfxKey: VAMPIRE_LORD_SFX_LIGHT }),
    replaceable('blood-feast', 'blood-feast', 'blood-feast', { type: 'diceSet', faces: { [FACE.BLOOD_DROP]: 3 } }, [
        healSelf(2, abilityEffectText('blood-feast', 'heal2')),
        grantToken(TOKEN_IDS.BLOOD_POWER, 3, abilityEffectText('blood-feast', 'gainBloodPower')),
    ]),
    replaceable('rend-claws', 'rend-claws', 'rend-claws', { type: 'smallStraight' }, [
        grantBleed(1, abilityEffectText('rend-claws', 'bleed1')),
        damage(6, abilityEffectText('rend-claws', 'damage6')),
    ]),
    replaceable('blood-possessed', 'blood-possessed', 'blood-possessed', { type: 'largeStraight' }, [
        grantToken(TOKEN_IDS.BLOOD_POWER, 2, abilityEffectText('blood-possessed', 'gainBloodPower')),
        damage(6, abilityEffectText('blood-possessed', 'damage6')),
    ]),
    replaceable('blood-thirst', 'blood-thirst', 'blood-thirst', { type: 'diceSet', faces: { [FACE.BLOOD_DROP]: 2 } }, [
        grantBleed(1, abilityEffectText('blood-thirst', 'bleed1')),
        damage(4, abilityEffectText('blood-thirst', 'damage4')),
    ]),
    replaceable('blood-magic', 'blood-magic', 'blood-magic', { type: 'smallStraight' }, [
        grantToken(TOKEN_IDS.BLOOD_POWER, 2, abilityEffectText('blood-magic', 'gainBloodPower')),
        damage(7, abilityEffectText('blood-magic', 'damage7')),
    ], { sfxKey: VAMPIRE_LORD_SFX_LIGHT }),
    replaceable('undying', 'undying', 'undying', { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 }, [
        damage(1, abilityEffectText('undying', 'counter1'), { timing: 'withDamage', damageScope: 'direct' }),
        healSelf(1, abilityEffectText('undying', 'heal1'), 'postDamage'),
    ], { type: 'defensive', tags: ['defensive'], sfxKey: VAMPIRE_LORD_SFX_LIGHT }),
    {
        id: 'bloody-slaughter',
        name: abilityText('bloody-slaughter', 'name'),
        type: 'offensive',
        description: abilityText('bloody-slaughter', 'description'),
        sfxKey: VAMPIRE_LORD_SFX_ULTIMATE,
        tags: ['ultimate', 'uninterruptible'],
        trigger: { type: 'diceSet', faces: { [FACE.BLOOD_DROP]: 5 } },
        effects: [
            grantToken(TOKEN_IDS.BLOOD_POWER, 2, abilityEffectText('bloody-slaughter', 'gainBloodPower')),
            grantBleed(2, abilityEffectText('bloody-slaughter', 'bleed2')),
            damage(12, abilityEffectText('bloody-slaughter', 'damage12')),
        ],
    },
];
