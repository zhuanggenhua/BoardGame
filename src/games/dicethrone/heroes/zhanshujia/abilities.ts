import { abilityText, abilityEffectText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { STATUS_IDS, TOKEN_IDS, ZHANSHUJIA_DICE_FACE_IDS } from '../../domain/ids';

const FACE = ZHANSHUJIA_DICE_FACE_IDS;

export const ZHANSHUJIA_SFX_LIGHT = 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1';
export const ZHANSHUJIA_SFX_HEAVY = 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_01_krst';
export const ZHANSHUJIA_SFX_COMMAND = 'ui.fantasy_ui_sound_fx_pack_vol.signals.signal_positive_a_001';
export const ZHANSHUJIA_SFX_ULTIMATE = 'puzzle.24.bomb_explosion_01';

const damage = (
    value: number,
    description: string,
    opts?: { timing?: EffectTiming; unblockable?: boolean; target?: 'opponent' | 'allOpponents'; damageScope?: 'attack' | 'direct' },
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

const grantToken = (value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.TACTICAL_ADVANTAGE, value },
    timing: 'preDefense',
});

const grantStatus = (statusId: string, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value: 1 },
    timing: 'preDefense',
});

const custom = (
    customActionId: string,
    description: string,
    timing: EffectTiming = 'preDefense',
    target: 'self' | 'opponent' = 'self',
): AbilityEffect => ({
    description,
    action: { type: 'custom', target, customActionId },
    timing,
});

const drawCards = (value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'drawCard', target: 'self', drawCount: value },
    timing,
});

const SABRE_THRUST: AbilityDef = {
    id: 'sabre-thrust',
    name: abilityText('sabre-thrust', 'name'),
    type: 'offensive',
    description: abilityText('sabre-thrust', 'description'),
    sfxKey: ZHANSHUJIA_SFX_LIGHT,
    variants: [
        { id: 'sabre-thrust-3', trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 3 } }, effects: [damage(4, abilityEffectText('sabre-thrust', 'damage4'))], priority: 1 },
        { id: 'sabre-thrust-4', trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 4 } }, effects: [damage(5, abilityEffectText('sabre-thrust', 'damage5'))], priority: 2 },
        { id: 'sabre-thrust-5', trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 5 } }, effects: [damage(6, abilityEffectText('sabre-thrust', 'damage6'))], priority: 3 },
    ],
};

export const SABRE_THRUST_2: AbilityDef = {
    id: 'sabre-thrust',
    name: abilityText('sabre-thrust-2', 'name'),
    type: 'offensive',
    description: abilityText('sabre-thrust-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_LIGHT,
    variants: [
        {
            id: 'sabre-thrust-2-3',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 3 } },
            effects: [
                custom('zhanshujia-bind-if-three-kind', abilityEffectText('sabre-thrust-2', 'bindIfThreeKind'), 'preDefense', 'opponent'),
                damage(5, abilityEffectText('sabre-thrust-2', 'damage5')),
            ],
            priority: 1,
        },
        {
            id: 'sabre-thrust-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 4 } },
            effects: [
                custom('zhanshujia-bind-if-three-kind', abilityEffectText('sabre-thrust-2', 'bindIfThreeKind'), 'preDefense', 'opponent'),
                damage(6, abilityEffectText('sabre-thrust-2', 'damage6')),
            ],
            priority: 2,
        },
        {
            id: 'sabre-thrust-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 5 } },
            effects: [
                custom('zhanshujia-bind-if-three-kind', abilityEffectText('sabre-thrust-2', 'bindIfThreeKind'), 'preDefense', 'opponent'),
                damage(7, abilityEffectText('sabre-thrust-2', 'damage7')),
            ],
            priority: 3,
        },
    ],
};

const CARPET_BOMBING: AbilityDef = {
    id: 'carpet-bombing',
    name: abilityText('carpet-bombing', 'name'),
    type: 'utility',
    description: abilityText('carpet-bombing', 'description'),
    sfxKey: ZHANSHUJIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 2, [FACE.MEDAL]: 2 } },
    effects: [
        grantToken(1, abilityEffectText('carpet-bombing', 'gainTa1')),
        custom('zhanshujia-carpet-bombing-targets', abilityEffectText('carpet-bombing', 'targetTwoOpponents')),
    ],
};

export const CARPET_BOMBING_2: AbilityDef = {
    id: 'carpet-bombing',
    name: abilityText('carpet-bombing-2', 'name'),
    type: 'utility',
    description: abilityText('carpet-bombing-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_HEAVY,
    variants: [
        {
            id: 'carpet-bombing-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 2, [FACE.MEDAL]: 2 } },
            effects: [
                grantToken(2, abilityEffectText('carpet-bombing-2', 'mainGainTa2')),
                custom('zhanshujia-carpet-bombing-targets', abilityEffectText('carpet-bombing-2', 'mainTargetTwoOpponents')),
            ],
            priority: 2,
        },
        {
            id: 'carpet-bombing-2-strategy',
            trigger: { type: 'diceSet', faces: { [FACE.BANNER]: 4 } },
            effects: [
                grantToken(3, abilityEffectText('carpet-bombing-2', 'strategyGainTa3')),
                drawCards(2, abilityEffectText('carpet-bombing-2', 'strategyDraw2')),
            ],
            priority: 1,
        },
    ],
};

const WAR_MONGER: AbilityDef = {
    id: 'war-monger',
    name: abilityText('war-monger', 'name'),
    type: 'utility',
    description: abilityText('war-monger', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 1, [FACE.BANNER]: 3 } },
    effects: [
        grantToken(1, abilityEffectText('war-monger', 'gainTa1')),
        custom('zhanshujia-war-monger-roll', abilityEffectText('war-monger', 'bonusRoll'), 'preDefense', 'opponent'),
        custom('zhanshujia-war-monger-attack-damage', abilityEffectText('war-monger', 'resolveSabreDamage'), 'withDamage', 'opponent'),
    ],
};

export const WAR_MONGER_2: AbilityDef = {
    id: 'war-monger',
    name: abilityText('war-monger-2', 'name'),
    type: 'utility',
    description: abilityText('war-monger-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 1, [FACE.BANNER]: 3 } },
    effects: [
        grantToken(2, abilityEffectText('war-monger-2', 'gainTa2')),
        custom('zhanshujia-war-monger-2-roll', abilityEffectText('war-monger-2', 'bonusRoll'), 'preDefense', 'opponent'),
        custom('zhanshujia-war-monger-attack-damage', abilityEffectText('war-monger-2', 'resolveSabreDamage'), 'withDamage', 'opponent'),
    ],
};

const DRUM_MOVEMENT: AbilityDef = {
    id: 'drum-movement',
    name: abilityText('drum-movement', 'name'),
    type: 'offensive',
    description: abilityText('drum-movement', 'description'),
    sfxKey: ZHANSHUJIA_SFX_HEAVY,
    trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 3, [FACE.MEDAL]: 2 } },
    effects: [grantStatus(STATUS_IDS.BIND, abilityEffectText('drum-movement', 'inflictBind')), damage(7, abilityEffectText('drum-movement', 'damage7'))],
};

export const DRUM_MOVEMENT_2: AbilityDef = {
    id: 'drum-movement',
    name: abilityText('drum-movement-2', 'name'),
    type: 'offensive',
    description: abilityText('drum-movement-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_HEAVY,
    variants: [
        {
            id: 'drum-movement-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 3, [FACE.MEDAL]: 2 } },
            effects: [
                grantToken(1, abilityEffectText('drum-movement-2', 'mainGainTa1')),
                grantStatus(STATUS_IDS.BIND, abilityEffectText('drum-movement-2', 'mainInflictBind')),
                damage(7, abilityEffectText('drum-movement-2', 'mainDamage7')),
            ],
            priority: 2,
        },
        {
            id: 'drum-movement-2-indirect',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 3, [FACE.BANNER]: 1 } },
            effects: [
                grantToken(2, abilityEffectText('drum-movement-2', 'indirectGainTa2')),
                damage(2, abilityEffectText('drum-movement-2', 'indirectDamage2'), { unblockable: true }),
            ],
            priority: 1,
            tags: ['unblockable'],
        },
    ],
};

const FLANKING: AbilityDef = {
    id: 'flanking',
    name: abilityText('flanking', 'name'),
    type: 'offensive',
    description: abilityText('flanking', 'description'),
    sfxKey: ZHANSHUJIA_SFX_LIGHT,
    trigger: { type: 'smallStraight' },
    effects: [grantToken(1, abilityEffectText('flanking', 'gainTa1')), damage(6, abilityEffectText('flanking', 'damage6'))],
};

export const FLANKING_2: AbilityDef = {
    id: 'flanking',
    name: abilityText('flanking-2', 'name'),
    type: 'offensive',
    description: abilityText('flanking-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_LIGHT,
    trigger: { type: 'smallStraight' },
    effects: [grantToken(2, abilityEffectText('flanking-2', 'gainTa2')), damage(6, abilityEffectText('flanking-2', 'damage6'))],
};

const EXPAND_BATTLEFIELD: AbilityDef = {
    id: 'expand-battlefield',
    name: abilityText('expand-battlefield', 'name'),
    type: 'offensive',
    description: abilityText('expand-battlefield', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'largeStraight' },
    effects: [
        grantToken(2, abilityEffectText('expand-battlefield', 'gainTa2')),
        grantStatus(STATUS_IDS.BIND, abilityEffectText('expand-battlefield', 'inflictBind')),
        damage(9, abilityEffectText('expand-battlefield', 'damage9')),
    ],
};

export const EXPAND_BATTLEFIELD_2: AbilityDef = {
    id: 'expand-battlefield',
    name: abilityText('expand-battlefield-2', 'name'),
    type: 'offensive',
    description: abilityText('expand-battlefield-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    variants: [
        {
            id: 'expand-battlefield-2-large-straight',
            trigger: { type: 'largeStraight' },
            effects: [
                grantToken(3, abilityEffectText('expand-battlefield-2', 'mainGainTa3')),
                grantStatus(STATUS_IDS.BIND, abilityEffectText('expand-battlefield-2', 'mainInflictBind')),
                damage(9, abilityEffectText('expand-battlefield-2', 'mainDamage9')),
            ],
            priority: 2,
        },
        {
            id: 'expand-battlefield-2-lockdown',
            trigger: { type: 'diceSet', faces: { [FACE.SABRE]: 1, [FACE.BANNER]: 2, [FACE.MEDAL]: 1 } },
            effects: [
                drawCards(2, abilityEffectText('expand-battlefield-2', 'lockdownDraw2')),
                grantStatus(STATUS_IDS.BIND, abilityEffectText('expand-battlefield-2', 'lockdownInflictBind')),
            ],
            priority: 1,
        },
    ],
};

const STRATEGIC_SHIFT: AbilityDef = {
    id: 'strategic-shift',
    name: abilityText('strategic-shift', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('strategic-shift', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'diceSet', faces: { [FACE.MEDAL]: 4 } },
    effects: [
        grantToken(5, abilityEffectText('strategic-shift', 'gainTa5')),
        damage(5, abilityEffectText('strategic-shift', 'damage5'), { unblockable: true }),
    ],
};

export const STRATEGIC_SHIFT_2: AbilityDef = {
    id: 'strategic-shift',
    name: abilityText('strategic-shift-2', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('strategic-shift-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    variants: [
        {
            id: 'strategic-shift-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.MEDAL]: 4 } },
            effects: [
                grantToken(5, abilityEffectText('strategic-shift-2', 'mainGainTa5')),
                grantStatus(STATUS_IDS.BIND, abilityEffectText('strategic-shift-2', 'mainInflictBind')),
                damage(5, abilityEffectText('strategic-shift-2', 'mainDamage5'), { unblockable: true }),
            ],
            priority: 2,
            tags: ['unblockable'],
        },
        {
            id: 'strategic-shift-2-recon',
            trigger: { type: 'diceSet', faces: { [FACE.MEDAL]: 3 } },
            effects: [grantToken(5, abilityEffectText('strategic-shift-2', 'reconGainTa5'))],
            priority: 1,
        },
    ],
};

const COUNTERMEASURES: AbilityDef = {
    id: 'countermeasures',
    name: abilityText('countermeasures', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('countermeasures', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
    effects: [
        custom('zhanshujia-countermeasures-defense', abilityEffectText('countermeasures', 'defense4'), 'withDamage'),
    ],
};

export const COUNTERMEASURES_2: AbilityDef = {
    id: 'countermeasures',
    name: abilityText('countermeasures-2', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('countermeasures-2', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        {
            description: abilityEffectText('countermeasures-2', 'defense5'),
            action: { type: 'custom', target: 'self', customActionId: 'zhanshujia-countermeasures-defense', params: { sabrePairDamage: 1 } },
            timing: 'withDamage',
        },
    ],
};

export const COUNTERMEASURES_3: AbilityDef = {
    id: 'countermeasures',
    name: abilityText('countermeasures-3', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('countermeasures-3', 'description'),
    sfxKey: ZHANSHUJIA_SFX_COMMAND,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        {
            description: abilityEffectText('countermeasures-3', 'defense5Heavy'),
            action: { type: 'custom', target: 'self', customActionId: 'zhanshujia-countermeasures-defense', params: { sabrePairDamage: 2 } },
            timing: 'withDamage',
        },
    ],
};

const HIGH_GROUND: AbilityDef = {
    id: 'high-ground',
    name: abilityText('high-ground', 'name'),
    type: 'offensive',
    tags: ['ultimate', 'uninterruptible'],
    description: abilityText('high-ground', 'description'),
    sfxKey: ZHANSHUJIA_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.MEDAL]: 5 } },
    effects: [
        grantStatus(STATUS_IDS.TARGETED, abilityEffectText('high-ground', 'inflictTargeted')),
        grantStatus(STATUS_IDS.BIND, abilityEffectText('high-ground', 'inflictBind')),
        custom('zhanshujia-high-ground-cap-up-and-fill', abilityEffectText('high-ground', 'capUpAndFill')),
        damage(12, abilityEffectText('high-ground', 'damage12')),
    ],
};

export const ZHANSHUJIA_ABILITIES: AbilityDef[] = [
    SABRE_THRUST,
    CARPET_BOMBING,
    WAR_MONGER,
    DRUM_MOVEMENT,
    FLANKING,
    EXPAND_BATTLEFIELD,
    STRATEGIC_SHIFT,
    COUNTERMEASURES,
    HIGH_GROUND,
];
