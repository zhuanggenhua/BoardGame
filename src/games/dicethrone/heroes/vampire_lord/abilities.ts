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
    opts?: {
        timing?: EffectTiming;
        unblockable?: boolean;
        target?: 'opponent' | 'allOpponents';
        damageScope?: 'attack' | 'direct';
    },
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

const drawCard = (count: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'drawCard', target: 'self', drawCount: count },
    timing,
});

const bloodthirstyClawsBloodPowerIfKind = (threshold: 3 | 4, description: string): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target: 'self',
        customActionId: 'vampire-lord-bloodthirsty-claws-blood-power-if-kind',
        params: { threshold, amount: 1 },
    },
    timing: 'postDamage',
});

const bloodPossessedChoice = (description: string): AbilityEffect => ({
    description,
    action: {
        type: 'choice',
        target: 'self',
        choiceTitleKey: 'choices.vampireLordBloodPossessed.title',
        choiceOptions: [
            { customId: 'vampire-lord-blood-possessed-inflict-bleed', value: 1, labelKey: 'choices.vampireLordBloodPossessed.inflictBleed' },
            { customId: 'vampire-lord-blood-possessed-gain-mesmerize', value: 1, labelKey: 'choices.vampireLordBloodPossessed.gainMesmerize' },
        ],
    },
    timing: 'postDamage',
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
        { id: 'bloodthirsty-claws-2-3', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 3 } }, effects: [damage(3, abilityEffectText('bloodthirsty-claws-2', 'damage3')), bloodthirstyClawsBloodPowerIfKind(3, abilityEffectText('bloodthirsty-claws-2', 'gainBloodPowerIfThreeKind'))], priority: 0 },
        { id: 'bloodthirsty-claws-2-4', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 4 } }, effects: [damage(5, abilityEffectText('bloodthirsty-claws-2', 'damage5')), bloodthirstyClawsBloodPowerIfKind(3, abilityEffectText('bloodthirsty-claws-2', 'gainBloodPowerIfThreeKind'))], priority: 1 },
        { id: 'bloodthirsty-claws-2-5', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 5 } }, effects: [damage(7, abilityEffectText('bloodthirsty-claws-2', 'damage7')), bloodthirstyClawsBloodPowerIfKind(3, abilityEffectText('bloodthirsty-claws-2', 'gainBloodPowerIfThreeKind'))], priority: 2 },
    ],
};

export const BLOODTHIRSTY_CLAWS_3: AbilityDef = {
    id: 'bloodthirsty-claws',
    name: abilityText('bloodthirsty-claws-3', 'name'),
    type: 'offensive',
    description: abilityText('bloodthirsty-claws-3', 'description'),
    sfxKey: VAMPIRE_LORD_SFX_HEAVY,
    variants: [
        { id: 'bloodthirsty-claws-3-3', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 3 } }, effects: [damage(4, abilityEffectText('bloodthirsty-claws-3', 'damage4')), bloodthirstyClawsBloodPowerIfKind(3, abilityEffectText('bloodthirsty-claws-3', 'gainBloodPowerIfThreeKind'))], priority: 0 },
        { id: 'bloodthirsty-claws-3-4', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 4 } }, effects: [damage(6, abilityEffectText('bloodthirsty-claws-3', 'damage6')), bloodthirstyClawsBloodPowerIfKind(3, abilityEffectText('bloodthirsty-claws-3', 'gainBloodPowerIfThreeKind'))], priority: 1 },
        { id: 'bloodthirsty-claws-3-5', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 5 } }, effects: [damage(8, abilityEffectText('bloodthirsty-claws-3', 'damage8')), bloodthirstyClawsBloodPowerIfKind(3, abilityEffectText('bloodthirsty-claws-3', 'gainBloodPowerIfThreeKind'))], priority: 2 },
    ],
};

export const MESMERIZE_POWER_2: AbilityDef = replaceable('mesmerize-power', 'mesmerize-power-2', 'mesmerize-power-2', { type: 'diceSet', faces: { [FACE.MESMERIZE]: 3 } }, [
    grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('mesmerize-power-2', 'gainEvasive')),
    grantToken(TOKEN_IDS.MESMERIZE, 1, abilityEffectText('mesmerize-power-2', 'gainMesmerize')),
    damage(5, abilityEffectText('mesmerize-power-2', 'damage5Unblockable'), { unblockable: true }),
], { tags: ['unblockable'], sfxKey: VAMPIRE_LORD_SFX_LIGHT });

MESMERIZE_POWER_2.variants = [
    {
        id: 'mesmerize-power-2-main',
        trigger: { type: 'diceSet', faces: { [FACE.MESMERIZE]: 3 } },
        effects: MESMERIZE_POWER_2.effects ?? [],
        priority: 1,
        tags: ['unblockable'],
    },
    {
        id: 'mesmerize-power-2-soul-gaze',
        name: abilityText('mesmerize-power-2-soul-gaze', 'name'),
        description: abilityText('mesmerize-power-2-soul-gaze', 'description'),
        trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 1, [FACE.MESMERIZE]: 2 } },
        effects: [
            grantToken(TOKEN_IDS.MESMERIZE, 1, abilityEffectText('mesmerize-power-2-soul-gaze', 'gainMesmerize')),
            grantBleed(2, abilityEffectText('mesmerize-power-2-soul-gaze', 'bleed2')),
        ],
        priority: 0,
    },
];

export const BLOOD_FEAST_2: AbilityDef = replaceable('blood-feast', 'blood-feast-2', 'blood-feast-2', { type: 'diceSet', faces: { [FACE.MESMERIZE]: 3, [FACE.BLOOD_DROP]: 1 } }, [
    healSelf(3, abilityEffectText('blood-feast-2', 'heal3')),
    grantToken(TOKEN_IDS.BLOOD_POWER, 3, abilityEffectText('blood-feast-2', 'gainBloodPower')),
]);

BLOOD_FEAST_2.variants = [
    {
        id: 'blood-feast-2-main',
        trigger: { type: 'diceSet', faces: { [FACE.MESMERIZE]: 3, [FACE.BLOOD_DROP]: 1 } },
        effects: BLOOD_FEAST_2.effects ?? [],
        priority: 1,
    },
    {
        id: 'blood-feast-2-dressed-to-kill',
        name: abilityText('blood-feast-2-dressed-to-kill', 'name'),
        description: abilityText('blood-feast-2-dressed-to-kill', 'description'),
        trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 1, [FACE.MESMERIZE]: 1, [FACE.BLOOD_DROP]: 2 } },
        effects: [
            grantToken(TOKEN_IDS.BLOOD_POWER, 2, abilityEffectText('blood-feast-2-dressed-to-kill', 'gainBloodPower')),
            drawCard(1, abilityEffectText('blood-feast-2-dressed-to-kill', 'draw1')),
        ],
        priority: 0,
    },
];

export const REND_CLAWS_2: AbilityDef = replaceable('rend-claws', 'rend-claws-2', 'rend-claws-2', { type: 'smallStraight' }, [
    grantBleed(1, abilityEffectText('rend-claws-2', 'bleed1')),
    damage(6, abilityEffectText('rend-claws-2', 'damage6')),
]);

export const BLOOD_POSSESSED_2: AbilityDef = replaceable('blood-possessed', 'blood-possessed-2', 'blood-possessed-2', { type: 'smallStraight' }, [
    damage(8, abilityEffectText('blood-possessed-2', 'damage8')),
    bloodPossessedChoice(abilityEffectText('blood-possessed-2', 'choice')),
]);

BLOOD_POSSESSED_2.variants = [
    {
        id: 'blood-possessed-2-main',
        trigger: { type: 'smallStraight' },
        effects: BLOOD_POSSESSED_2.effects ?? [],
        priority: 1,
    },
    {
        id: 'blood-possessed-2-blood-addiction',
        name: abilityText('blood-possessed-2-blood-addiction', 'name'),
        description: abilityText('blood-possessed-2-blood-addiction', 'description'),
        trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 2, [FACE.BLOOD_DROP]: 1 } },
        effects: [grantToken(TOKEN_IDS.BLOOD_POWER, 2, abilityEffectText('blood-possessed-2-blood-addiction', 'gainBloodPower'))],
        priority: 0,
    },
];

export const BLOOD_THIRST_2: AbilityDef = replaceable('blood-thirst', 'blood-thirst-2', 'blood-thirst-2', { type: 'diceSet', faces: { [FACE.BLOOD_DROP]: 4 } }, [
    grantToken(TOKEN_IDS.BLOOD_POWER, 3, abilityEffectText('blood-thirst-2', 'gainBloodPower')),
    damage(6, abilityEffectText('blood-thirst-2', 'damage6Unblockable'), { unblockable: true }),
], { tags: ['unblockable'] });

BLOOD_THIRST_2.variants = [
    {
        id: 'blood-thirst-2-main',
        trigger: { type: 'diceSet', faces: { [FACE.BLOOD_DROP]: 4 } },
        effects: BLOOD_THIRST_2.effects ?? [],
        priority: 1,
        tags: ['unblockable'],
    },
    {
        id: 'blood-thirst-2-blood-river',
        name: abilityText('blood-thirst-2-blood-river', 'name'),
        description: abilityText('blood-thirst-2-blood-river', 'description'),
        trigger: { type: 'diceSet', faces: { [FACE.BLOOD_DROP]: 3 } },
        effects: [
            grantBleed(2, abilityEffectText('blood-thirst-2-blood-river', 'bleed2')),
            damage(2, abilityEffectText('blood-thirst-2-blood-river', 'collateral2'), { target: 'allOpponents', damageScope: 'direct' }),
        ],
        priority: 0,
        tags: ['unblockable'],
    },
];

export const BLOOD_MAGIC_2: AbilityDef = replaceable('blood-magic', 'blood-magic-2', 'blood-magic-2', { type: 'largeStraight' }, [
    grantToken(TOKEN_IDS.BLOOD_POWER, 2, abilityEffectText('blood-magic-2', 'gainBloodPower')),
    grantBleed(1, abilityEffectText('blood-magic-2', 'bleed1')),
    damage(8, abilityEffectText('blood-magic-2', 'damage8Unblockable'), { unblockable: true }),
], { tags: ['unblockable'], sfxKey: VAMPIRE_LORD_SFX_LIGHT });

BLOOD_MAGIC_2.variants = [
    {
        id: 'blood-magic-2-main',
        trigger: { type: 'largeStraight' },
        effects: BLOOD_MAGIC_2.effects ?? [],
        priority: 1,
        tags: ['unblockable'],
    },
    {
        id: 'blood-magic-2-flayed',
        name: abilityText('blood-magic-2-flayed', 'name'),
        description: abilityText('blood-magic-2-flayed', 'description'),
        trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 2, [FACE.BLOOD_DROP]: 2 } },
        effects: [damage(5, abilityEffectText('blood-magic-2-flayed', 'damage5Unblockable'), { unblockable: true })],
        priority: 0,
        tags: ['unblockable'],
    },
];

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
            { id: 'bloodthirsty-claws-3', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 3 } }, effects: [damage(3, abilityEffectText('bloodthirsty-claws', 'damage3')), bloodthirstyClawsBloodPowerIfKind(4, abilityEffectText('bloodthirsty-claws', 'gainBloodPowerIfFourKind'))], priority: 0 },
            { id: 'bloodthirsty-claws-4', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 4 } }, effects: [damage(5, abilityEffectText('bloodthirsty-claws', 'damage5')), bloodthirstyClawsBloodPowerIfKind(4, abilityEffectText('bloodthirsty-claws', 'gainBloodPowerIfFourKind'))], priority: 1 },
            { id: 'bloodthirsty-claws-5', trigger: { type: 'diceSet', faces: { [FACE.CLAW]: 5 } }, effects: [damage(7, abilityEffectText('bloodthirsty-claws', 'damage7')), bloodthirstyClawsBloodPowerIfKind(4, abilityEffectText('bloodthirsty-claws', 'gainBloodPowerIfFourKind'))], priority: 2 },
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
