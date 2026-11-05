/** 蜘蛛侠角色板技能定义 */

import { abilityEffectText, abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { STATUS_IDS, TOKEN_IDS, ZHIZHUXIA_DICE_FACE_IDS as FACE } from '../../domain/ids';

export const ZHIZHUXIA_SFX_LIGHT = 'fantasy.medieval_fantasy_sound_fx_pack_vol.magic.magic_web_001';
export const ZHIZHUXIA_SFX_HEAVY = 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1';
export const ZHIZHUXIA_SFX_ULTIMATE = 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1';

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
    timing: opts?.timing ?? 'withDamage',
});

const applyWebbed = (description: string): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target: 'opponent',
        customActionId: 'zhizhuxia-apply-webbed',
    },
    timing: 'postDamage',
});

const drawCard = (description: string): AbilityEffect => ({
    description,
    action: { type: 'drawCard', target: 'self', drawCount: 1 },
    timing: 'postDamage',
});

const spiderReflex = (description: string): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target: 'opponent',
        customActionId: 'zhizhuxia-spider-reflex',
    },
    timing: 'preDefense',
});

const custom = (
    customActionId: string,
    description: string,
    timing: EffectTiming = 'preDefense',
    params?: Record<string, string | number | boolean>,
): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target: 'self',
        customActionId,
        ...(params ? { params } : {}),
    },
    timing,
});

export const HEAVY_PUNCH: AbilityDef = {
    id: 'heavy-punch',
    name: abilityText('heavy-punch', 'name'),
    type: 'offensive',
    description: abilityText('heavy-punch', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    variants: [
        { id: 'heavy-punch-3', trigger: { type: 'diceSet', faces: { [FACE.FIST]: 3 } }, effects: [damage(4, abilityEffectText('heavy-punch', 'damage4'))], priority: 0 },
        { id: 'heavy-punch-4', trigger: { type: 'diceSet', faces: { [FACE.FIST]: 4 } }, effects: [damage(5, abilityEffectText('heavy-punch', 'damage5'))], priority: 1 },
        { id: 'heavy-punch-5', trigger: { type: 'diceSet', faces: { [FACE.FIST]: 5 } }, effects: [damage(6, abilityEffectText('heavy-punch', 'damage6'))], priority: 2 },
    ],
};

export const HEAVY_PUNCH_2: AbilityDef = {
    id: 'heavy-punch',
    name: abilityText('heavy-punch-2', 'name'),
    type: 'offensive',
    description: abilityText('heavy-punch-2', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    variants: [
        { id: 'heavy-punch-2-3', trigger: { type: 'diceSet', faces: { [FACE.FIST]: 3 } }, effects: [damage(5, abilityEffectText('heavy-punch-2', 'damage5'))], priority: 0 },
        {
            id: 'heavy-punch-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.FIST]: 4 } },
            effects: [
                damage(6, abilityEffectText('heavy-punch-2', 'damage6')),
                custom('zhizhuxia-heavy-punch-2-combo', abilityEffectText('heavy-punch-2', 'gainComboIfFourOfAKind'), 'postDamage'),
            ],
            priority: 1,
        },
        {
            id: 'heavy-punch-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.FIST]: 5 } },
            effects: [
                damage(7, abilityEffectText('heavy-punch-2', 'damage7')),
                custom('zhizhuxia-heavy-punch-2-combo', abilityEffectText('heavy-punch-2', 'gainComboIfFourOfAKind'), 'postDamage'),
            ],
            priority: 2,
        },
    ],
};

export const COMBO_STRIKE: AbilityDef = {
    id: 'combo-strike',
    name: abilityText('combo-strike', 'name'),
    type: 'offensive',
    description: abilityText('combo-strike', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.FIST]: 2, [FACE.SPIDER]: 2 } },
    effects: [
        damage(5, abilityEffectText('combo-strike', 'damage5')),
        { description: abilityEffectText('combo-strike', 'gainCombo'), action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.COMBO, value: 1 }, timing: 'postDamage' },
    ],
};

export const COMBO_STRIKE_2: AbilityDef = {
    id: 'combo-strike',
    name: abilityText('combo-strike-2', 'name'),
    type: 'offensive',
    description: abilityText('combo-strike-2', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.WEB]: 2, [FACE.SPIDER]: 2 } },
    effects: [
        damage(6, abilityEffectText('combo-strike-2', 'damage6')),
        { description: abilityEffectText('combo-strike-2', 'gainCombo'), action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.COMBO, value: 1 }, timing: 'postDamage' },
    ],
};

export const TRAP: AbilityDef = {
    id: 'trap',
    name: abilityText('trap', 'name'),
    type: 'offensive',
    description: abilityText('trap', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    variants: [
        {
            id: 'trap-small',
            trigger: { type: 'smallStraight' },
            effects: [damage(5, abilityEffectText('trap', 'damage5')), applyWebbed(abilityEffectText('trap', 'applyWebbed'))],
            priority: 0,
        },
        {
            id: 'trap-large',
            trigger: { type: 'largeStraight' },
            effects: [drawCard(abilityEffectText('trap', 'draw1')), damage(8, abilityEffectText('trap', 'damage8')), applyWebbed(abilityEffectText('trap', 'applyWebbed'))],
            priority: 1,
        },
    ],
};

export const TRAP_2: AbilityDef = {
    id: 'trap',
    name: abilityText('trap-2', 'name'),
    type: 'offensive',
    description: abilityText('trap-2', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    variants: [
        {
            id: 'trap-2-small',
            trigger: { type: 'smallStraight' },
            effects: [damage(6, abilityEffectText('trap-2', 'damage6')), applyWebbed(abilityEffectText('trap-2', 'applyWebbed'))],
            priority: 0,
        },
        {
            id: 'trap-2-large',
            trigger: { type: 'largeStraight' },
            effects: [drawCard(abilityEffectText('trap-2', 'draw1')), damage(9, abilityEffectText('trap-2', 'damage9')), applyWebbed(abilityEffectText('trap-2', 'applyWebbed'))],
            priority: 1,
        },
    ],
};

export const VENOM_PUNCH: AbilityDef = {
    id: 'venom-punch',
    name: abilityText('venom-punch', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('venom-punch', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.SPIDER]: 4 } },
    effects: [
        { description: abilityEffectText('venom-punch', 'gainInvisible'), action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.INVISIBLE, value: 1 }, timing: 'preDefense' },
        damage(7, abilityEffectText('venom-punch', 'damage7Unblockable'), { unblockable: true }),
    ],
};

export const VENOM_PUNCH_2: AbilityDef = {
    id: 'venom-punch',
    name: abilityText('venom-punch-2', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('venom-punch-2', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.SPIDER]: 4 } },
    effects: [
        { description: abilityEffectText('venom-punch-2', 'gainInvisible'), action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.INVISIBLE, value: 1 }, timing: 'preDefense' },
        damage(8, abilityEffectText('venom-punch-2', 'damage8Unblockable'), { unblockable: true }),
    ],
};

export const WALL_CRAWL: AbilityDef = {
    id: 'wall-crawl',
    name: abilityText('wall-crawl', 'name'),
    type: 'offensive',
    description: abilityText('wall-crawl', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.FIST]: 1, [FACE.WEB]: 3 } },
    effects: [
        { description: abilityEffectText('wall-crawl', 'gainInvisible'), action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.INVISIBLE, value: 1 }, timing: 'preDefense' },
        damage(7, abilityEffectText('wall-crawl', 'damage7')),
    ],
};

export const SPIDER_REFLEX: AbilityDef = {
    id: 'spider-reflex',
    name: abilityText('spider-reflex', 'name'),
    type: 'offensive',
    description: abilityText('spider-reflex', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.FIST]: 1, [FACE.WEB]: 2, [FACE.SPIDER]: 1 } },
    effects: [spiderReflex(abilityEffectText('spider-reflex', 'roll2AndDealSum'))],
};

export const COUNTER: AbilityDef = {
    id: 'counter',
    name: abilityText('counter', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('counter', 'description'),
    sfxKey: ZHIZHUXIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.FIST]: 3 } },
    effects: [damage(3, abilityEffectText('counter', 'damage3'), { damageScope: 'direct' })],
};

export const SPIDER_SENSE: AbilityDef = {
    id: 'spider-sense',
    name: abilityText('spider-sense', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('spider-sense', 'description'),
    sfxKey: ZHIZHUXIA_SFX_LIGHT,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 2 },
    effects: [{ description: abilityEffectText('spider-sense', 'preventHalfOnSpider'), action: { type: 'custom', target: 'self', customActionId: 'zhizhuxia-spider-sense' }, timing: 'withDamage' }],
};

export const ULTIMATE_SPIDER: AbilityDef = {
    id: 'ultimate-spider',
    name: abilityText('ultimate-spider', 'name'),
    type: 'offensive',
    tags: ['ultimate', 'unblockable'],
    description: abilityText('ultimate-spider', 'description'),
    sfxKey: ZHIZHUXIA_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.SPIDER]: 5 } },
    effects: [
        { description: abilityEffectText('ultimate-spider', 'gainInvisible'), action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.INVISIBLE, value: 1 }, timing: 'preDefense' },
        applyWebbed(abilityEffectText('ultimate-spider', 'applyWebbed')),
        damage(13, abilityEffectText('ultimate-spider', 'damage13')),
    ],
};

export const ZHIZHUXIA_ABILITIES: AbilityDef[] = [
    HEAVY_PUNCH,
    COMBO_STRIKE,
    TRAP,
    VENOM_PUNCH,
    WALL_CRAWL,
    SPIDER_REFLEX,
    COUNTER,
    SPIDER_SENSE,
    ULTIMATE_SPIDER,
];
