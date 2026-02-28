/**
 * Moon Elf 英雄的技能定义
 */
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { MOON_ELF_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';
import { abilityText, abilityEffectText } from '../../../../engine/primitives/ability';

const FACE = MOON_ELF_DICE_FACE_IDS;

export const MOON_ELF_SFX_SHOT = 'combat.general.mini_games_sound_effects_and_music_pack.bow.sfx_weapon_bow_shoot_1';
export const MOON_ELF_SFX_HIT = 'combat.general.mini_games_sound_effects_and_music_pack.bow.sfx_weapon_bow_hit_2';
export const MOON_ELF_SFX_ULTIMATE = 'fantasy.shooting_thunder_arrow_noreverb_01';

// 辅助函数
const damage = (value: number | string, description: string): AbilityEffect => ({
    description,
    action: { type: 'damage', target: 'opponent', value: typeof value === 'number' ? value : 0 },
});

const inflictStatus = (statusId: string, value: number, description: string, opts?: { timing?: EffectTiming }): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
    timing: opts?.timing,
});

const grantToken = (tokenId: string, value: number, description: string, opts?: { timing?: EffectTiming }): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value },
    timing: opts?.timing ?? 'postDamage',
});

// Base Abilities (Level 1)
export const MOON_ELF_ABILITIES: AbilityDef[] = [
    // Longbow I
    {
        id: 'longbow',
        name: abilityText('longbow', 'name'),
        type: 'offensive',
        description: abilityText('longbow', 'description'),
        sfxKey: MOON_ELF_SFX_SHOT,
        variants: [
            { id: 'longbow-3-1', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 3 } }, effects: [damage(3, abilityEffectText('longbow-3', 'damage3'))], priority: 1 },
            { id: 'longbow-4-1', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 4 } }, effects: [damage(5, abilityEffectText('longbow-4', 'damage5'))], priority: 2 },
            { id: 'longbow-5-1', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 5 } }, effects: [damage(7, abilityEffectText('longbow-5', 'damage7'))], priority: 3 },
        ],
    },
    // Covert Fire I
    {
        id: 'covert-fire',
        name: abilityText('covert-fire', 'name'),
        type: 'offensive',
        description: abilityText('covert-fire', 'description'),
        sfxKey: MOON_ELF_SFX_SHOT,
        trigger: { type: 'diceSet', faces: { [FACE.BOW]: 3, [FACE.MOON]: 3 } },
        effects: [
            inflictStatus(STATUS_IDS.TARGETED, 1, abilityEffectText('covert-fire', 'inflictTargeted')),
            damage(4, abilityEffectText('covert-fire', 'damage4')),
        ],
    },
    // Covering Fire I
    {
        id: 'covering-fire',
        name: abilityText('covering-fire', 'name'),
        type: 'offensive',
        description: abilityText('covering-fire', 'description'),
        sfxKey: MOON_ELF_SFX_SHOT,
        trigger: { type: 'diceSet', faces: { [FACE.BOW]: 2, [FACE.FOOT]: 3 } },
        effects: [
            grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('covering-fire', 'gainEvasive'), { timing: 'preDefense' }),
            damage(7, abilityEffectText('covering-fire', 'damage7')),
        ],
    },
    // Exploding Arrow I
    {
        id: 'exploding-arrow',
        name: abilityText('exploding-arrow', 'name'),
        type: 'offensive',
        description: abilityText('exploding-arrow', 'description'),
        sfxKey: MOON_ELF_SFX_HIT,
        trigger: { type: 'diceSet', faces: { [FACE.BOW]: 1, [FACE.MOON]: 3 } },
        effects: [{ description: abilityEffectText('exploding-arrow', 'rollAndResolve'), action: { type: 'custom', target: 'opponent', customActionId: 'moon_elf-exploding-arrow-resolve-1' }, timing: 'withDamage' }],
    },
    // Entangling Shot I
    {
        id: 'entangling-shot',
        name: abilityText('entangling-shot', 'name'),
        type: 'offensive',
        description: abilityText('entangling-shot', 'description'),
        sfxKey: MOON_ELF_SFX_HIT,
        trigger: { type: 'smallStraight' },
        effects: [
            inflictStatus(STATUS_IDS.ENTANGLE, 1, abilityEffectText('entangling-shot', 'inflictEntangle'), { timing: 'withDamage' }),
            damage(7, abilityEffectText('entangling-shot', 'damage7')),
        ],
    },
    // Eclipse I
    {
        id: 'eclipse',
        name: abilityText('eclipse', 'name'),
        type: 'offensive',
        description: abilityText('eclipse', 'description'),
        sfxKey: MOON_ELF_SFX_HIT,
        trigger: { type: 'diceSet', faces: { [FACE.MOON]: 4 } },
        effects: [
            inflictStatus(STATUS_IDS.TARGETED, 1, abilityEffectText('eclipse', 'inflictTargeted')),
            inflictStatus(STATUS_IDS.ENTANGLE, 1, abilityEffectText('eclipse', 'inflictEntangle')),
            inflictStatus(STATUS_IDS.BLINDED, 1, abilityEffectText('eclipse', 'inflictBlinded')),
            damage(7, abilityEffectText('eclipse', 'damage7')),
        ],
    },
    // Blinding Shot I
    {
        id: 'blinding-shot',
        name: abilityText('blinding-shot', 'name'),
        type: 'offensive',
        description: abilityText('blinding-shot', 'description'),
        sfxKey: MOON_ELF_SFX_HIT,
        trigger: { type: 'largeStraight' },
        effects: [
            inflictStatus(STATUS_IDS.BLINDED, 1, abilityEffectText('blinding-shot', 'inflictBlinded')),
            grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('blinding-shot', 'gainEvasive'), { timing: 'preDefense' }),
            damage(8, abilityEffectText('blinding-shot', 'damage8')),
        ],
    },
    // Lunar Eclipse (Ultimate)
    {
        id: 'lunar-eclipse',
        name: abilityText('lunar-eclipse', 'name'),
        type: 'offensive',
        description: abilityText('lunar-eclipse', 'description'),
        sfxKey: MOON_ELF_SFX_ULTIMATE,
        tags: ['ultimate'],
        trigger: { type: 'diceSet', faces: { [FACE.MOON]: 5 } },
        effects: [
            grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('lunar-eclipse', 'gainEvasive'), { timing: 'preDefense' }),
            inflictStatus(STATUS_IDS.BLINDED, 1, abilityEffectText('lunar-eclipse', 'inflictBlinded')),
            inflictStatus(STATUS_IDS.ENTANGLE, 1, abilityEffectText('lunar-eclipse', 'inflictEntangle')),
            inflictStatus(STATUS_IDS.TARGETED, 1, abilityEffectText('lunar-eclipse', 'inflictTargeted')),
            damage(13, abilityEffectText('lunar-eclipse', 'damage13')),
        ],
    },
    // Elusive Step I
    {
        id: 'elusive-step',
        name: abilityText('elusive-step', 'name'),
        type: 'defensive',
        description: abilityText('elusive-step', 'description'),
        trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
        effects: [
            { description: abilityEffectText('elusive-step', 'resolveDefense'), action: { type: 'custom', target: 'self', customActionId: 'moon_elf-elusive-step-resolve-1' }, timing: 'withDamage' },
        ],
    },
];

// Upgrades
export const LONGBOW_2: AbilityDef = {
    id: 'longbow',
    name: abilityText('longbow-2', 'name'),
    type: 'offensive',
    description: abilityText('longbow-2', 'description'),
    sfxKey: MOON_ELF_SFX_SHOT,
    variants: [
        { id: 'longbow-3-2', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 3 } }, effects: [damage(4, abilityEffectText('longbow-2', 'damage4')), { description: '若投出4个相同数字，施加缠绕', action: { type: 'custom', target: 'opponent', customActionId: 'moon_elf-longbow-bonus-check-4' }, timing: 'postDamage' }], priority: 1 },
        { id: 'longbow-4-2', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 4 } }, effects: [damage(6, abilityEffectText('longbow-2', 'damage6')), { description: '若投出4个相同数字，施加缠绕', action: { type: 'custom', target: 'opponent', customActionId: 'moon_elf-longbow-bonus-check-4' }, timing: 'postDamage' }], priority: 2 },
        { id: 'longbow-5-2', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 5 } }, effects: [damage(8, abilityEffectText('longbow-2', 'damage8')), { description: '若投出4个相同数字，施加缠绕', action: { type: 'custom', target: 'opponent', customActionId: 'moon_elf-longbow-bonus-check-4' }, timing: 'postDamage' }], priority: 3 },
    ],
};

export const LONGBOW_3: AbilityDef = {
    id: 'longbow',
    name: abilityText('longbow-3', 'name'),
    type: 'offensive',
    description: abilityText('longbow-3', 'description'),
    sfxKey: MOON_ELF_SFX_SHOT,
    variants: [
        { id: 'longbow-3-3', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 3 } }, effects: [damage(5, abilityEffectText('longbow-3', 'damage5')), { description: '若投出3个相同数字，施加缠绕', action: { type: 'custom', target: 'opponent', customActionId: 'moon_elf-longbow-bonus-check-3' }, timing: 'postDamage' }], priority: 1 },
        { id: 'longbow-4-3', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 4 } }, effects: [damage(7, abilityEffectText('longbow-3', 'damage7')), { description: '若投出3个相同数字，施加缠绕', action: { type: 'custom', target: 'opponent', customActionId: 'moon_elf-longbow-bonus-check-3' }, timing: 'postDamage' }], priority: 2 },
        { id: 'longbow-5-3', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 5 } }, effects: [damage(9, abilityEffectText('longbow-3', 'damage9')), { description: '若投出3个相同数字，施加缠绕', action: { type: 'custom', target: 'opponent', customActionId: 'moon_elf-longbow-bonus-check-3' }, timing: 'postDamage' }], priority: 3 },
    ],
};

export const COVERT_FIRE_2: AbilityDef = {
    id: 'covert-fire',
    name: abilityText('covert-fire-2', 'name'),
    type: 'offensive',
    description: abilityText('covert-fire-2', 'description'),
    sfxKey: MOON_ELF_SFX_SHOT,
    variants: [
        { id: 'deadeye-shot-2', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 3, [FACE.MOON]: 2 } }, effects: [inflictStatus(STATUS_IDS.TARGETED, 1, abilityEffectText('deadeye-shot', 'inflictTargeted')), damage(6, abilityEffectText('deadeye-shot', 'damage6'))], priority: 1 },
        { id: 'focus', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 2, [FACE.MOON]: 1 } }, effects: [inflictStatus(STATUS_IDS.TARGETED, 1, abilityEffectText('focus', 'inflictTargeted')), inflictStatus(STATUS_IDS.ENTANGLE, 1, abilityEffectText('focus', 'inflictEntangle'))], priority: 0 },
    ],
};

export const COVERING_FIRE_2: AbilityDef = {
    id: 'covering-fire',
    name: abilityText('covering-fire-2', 'name'),
    type: 'offensive',
    description: abilityText('covering-fire-2', 'description'),
    sfxKey: MOON_ELF_SFX_SHOT,
    variants: [
        { id: 'covering-fire-2', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 2, [FACE.FOOT]: 3 } }, effects: [grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('covering-fire-2', 'gainEvasive'), { timing: 'preDefense' }), damage(9, abilityEffectText('covering-fire-2', 'damage9'))], priority: 1 },
        { id: 'silencing-trace', trigger: { type: 'diceSet', faces: { [FACE.FOOT]: 3 } }, effects: [grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('silencing-trace', 'gainEvasive'), { timing: 'preDefense' }), { description: '造成 2 不可防御伤害', action: { type: 'damage', target: 'opponent', value: 2, isUndefendable: true } }], priority: 0 },
    ],
};

export const EXPLODING_ARROW_2: AbilityDef = {
    id: 'exploding-arrow',
    name: abilityText('exploding-arrow-2', 'name'),
    type: 'offensive',
    description: abilityText('exploding-arrow-2', 'description'),
    sfxKey: MOON_ELF_SFX_HIT,
    trigger: { type: 'diceSet', faces: { [FACE.BOW]: 1, [FACE.MOON]: 3 } },
    effects: [{ description: abilityEffectText('exploding-arrow', 'rollAndResolve'), action: { type: 'custom', target: 'opponent', customActionId: 'moon_elf-exploding-arrow-resolve-2' }, timing: 'withDamage' }],
};

export const EXPLODING_ARROW_3: AbilityDef = {
    id: 'exploding-arrow',
    name: abilityText('exploding-arrow-3', 'name'),
    type: 'offensive',
    description: abilityText('exploding-arrow-3', 'description'),
    sfxKey: MOON_ELF_SFX_HIT,
    trigger: { type: 'diceSet', faces: { [FACE.BOW]: 1, [FACE.MOON]: 3 } },
    effects: [{ description: abilityEffectText('exploding-arrow', 'rollAndResolve'), action: { type: 'custom', target: 'opponent', customActionId: 'moon_elf-exploding-arrow-resolve-3' }, timing: 'withDamage' }],
};

export const ENTANGLING_SHOT_2: AbilityDef = {
    id: 'entangling-shot',
    name: abilityText('entangling-shot-2', 'name'),
    type: 'offensive',
    description: abilityText('entangling-shot-2', 'description'),
    sfxKey: MOON_ELF_SFX_HIT,
    trigger: { type: 'smallStraight' },
    effects: [inflictStatus(STATUS_IDS.ENTANGLE, 1, abilityEffectText('entangling-shot-2', 'inflictEntangle'), { timing: 'withDamage' }), damage(9, abilityEffectText('entangling-shot-2', 'damage9'))],
};

export const BLINDING_SHOT_2: AbilityDef = {
    id: 'blinding-shot',
    name: abilityText('blinding-shot-2', 'name'),
    type: 'offensive',
    description: abilityText('blinding-shot-2', 'description'),
    sfxKey: MOON_ELF_SFX_HIT,
    variants: [
        { id: 'blinding-shot-2', trigger: { type: 'largeStraight' }, effects: [inflictStatus(STATUS_IDS.BLINDED, 1, abilityEffectText('blinding-shot-2', 'inflictBlinded')), grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('blinding-shot-2', 'gainEvasive'), { timing: 'preDefense' }), damage(10, abilityEffectText('blinding-shot-2', 'damage10'))], priority: 1 },
        { id: 'moons-blessing', trigger: { type: 'diceSet', faces: { [FACE.BOW]: 1, [FACE.FOOT]: 2, [FACE.MOON]: 1 } }, effects: [grantToken(TOKEN_IDS.EVASIVE, 3, abilityEffectText('moons-blessing', 'gainEvasive3'), { timing: 'preDefense' }), inflictStatus(STATUS_IDS.ENTANGLE, 1, abilityEffectText('moons-blessing', 'inflictEntangle'))], priority: 0 },
    ],
};

export const ECLIPSE_2: AbilityDef = {
    id: 'eclipse',
    name: abilityText('eclipse-2', 'name'),
    type: 'offensive',
    description: abilityText('eclipse-2', 'description'),
    sfxKey: MOON_ELF_SFX_HIT,
    variants: [
        { id: 'eclipse-2', trigger: { type: 'diceSet', faces: { [FACE.MOON]: 4 } }, effects: [inflictStatus(STATUS_IDS.BLINDED, 1, abilityEffectText('eclipse-2', 'inflictBlinded')), inflictStatus(STATUS_IDS.ENTANGLE, 1, abilityEffectText('eclipse-2', 'inflictEntangle')), inflictStatus(STATUS_IDS.TARGETED, 1, abilityEffectText('eclipse-2', 'inflictTargeted')), damage(9, abilityEffectText('eclipse-2', 'damage9'))], priority: 1 },
        { id: 'dark-moon', trigger: { type: 'diceSet', faces: { [FACE.MOON]: 3 } }, effects: [grantToken(TOKEN_IDS.EVASIVE, 1, abilityEffectText('dark-moon', 'gainEvasive'), { timing: 'preDefense' }), inflictStatus(STATUS_IDS.BLINDED, 1, abilityEffectText('dark-moon', 'inflictBlinded')), inflictStatus(STATUS_IDS.ENTANGLE, 1, abilityEffectText('dark-moon', 'inflictEntangle')), inflictStatus(STATUS_IDS.TARGETED, 1, abilityEffectText('dark-moon', 'inflictTargeted'))], priority: 0 },
    ],
};

export const ELUSIVE_STEP_2: AbilityDef = {
    id: 'elusive-step',
    name: abilityText('elusive-step-2', 'name'),
    type: 'defensive',
    description: abilityText('elusive-step-2', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [{ description: abilityEffectText('elusive-step-2', 'resolveDefense'), action: { type: 'custom', target: 'self', customActionId: 'moon_elf-elusive-step-resolve-2' }, timing: 'withDamage' }],
};
