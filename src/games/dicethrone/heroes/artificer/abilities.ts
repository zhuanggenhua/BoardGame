import { abilityEffectText, abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { ARTIFICER_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';

const FACE = ARTIFICER_DICE_FACE_IDS;

export const ARTIFICER_SFX_METAL = 'combat.general.forged_in_fury_vol_1.blade_impact.blade_impact_light';
export const ARTIFICER_SFX_ELECTRIC = 'magic.general.simple_magic_sound_fx_pack_vol.electricity.electricity_zap';
export const ARTIFICER_SFX_ULTIMATE = 'magic.general.simple_magic_sound_fx_pack_vol.electricity.electricity_impact';

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

const heal = (value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'heal', target: 'self', value },
    timing,
});

const drawCards = (drawCount: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'drawCard', target: 'self', drawCount },
    timing,
});

const grantSynth = (value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.SYNTH, value },
    timing,
});

const inflictNanobomb = (value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.NANOBOMB, value },
    timing,
});

const textOnly = (description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    timing,
});

const WRENCH_STRIKE: AbilityDef = {
    id: 'wrench-strike',
    name: abilityText('wrench-strike', 'name'),
    type: 'offensive',
    description: abilityText('wrench-strike', 'description'),
    sfxKey: ARTIFICER_SFX_METAL,
    variants: [
        {
            id: 'wrench-strike-3',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 3 } },
            effects: [
                damage(3, abilityEffectText('wrench-strike', 'damage3')),
                textOnly(abilityEffectText('wrench-strike', 'bonusBranch'), 'postDamage'),
            ],
            priority: 1,
        },
        {
            id: 'wrench-strike-4',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 4 } },
            effects: [
                damage(4, abilityEffectText('wrench-strike', 'damage4')),
                textOnly(abilityEffectText('wrench-strike', 'bonusBranch'), 'postDamage'),
            ],
            priority: 2,
        },
        {
            id: 'wrench-strike-5',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 5 } },
            effects: [
                damage(5, abilityEffectText('wrench-strike', 'damage5')),
                textOnly(abilityEffectText('wrench-strike', 'bonusBranch'), 'postDamage'),
            ],
            priority: 3,
        },
    ],
};

export const WRENCH_STRIKE_2: AbilityDef = {
    id: 'wrench-strike',
    name: abilityText('wrench-strike-2', 'name'),
    type: 'offensive',
    description: abilityText('wrench-strike-2', 'description'),
    sfxKey: ARTIFICER_SFX_METAL,
    variants: [
        {
            id: 'wrench-strike-2-3',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 3 } },
            effects: [
                damage(4, abilityEffectText('wrench-strike-2', 'damage4')),
                textOnly(abilityEffectText('wrench-strike-2', 'bonusBranch'), 'postDamage'),
            ],
            priority: 1,
        },
        {
            id: 'wrench-strike-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 4 } },
            effects: [
                damage(5, abilityEffectText('wrench-strike-2', 'damage5')),
                textOnly(abilityEffectText('wrench-strike-2', 'bonusBranch'), 'postDamage'),
            ],
            priority: 2,
        },
        {
            id: 'wrench-strike-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 5 } },
            effects: [
                damage(6, abilityEffectText('wrench-strike-2', 'damage6')),
                textOnly(abilityEffectText('wrench-strike-2', 'bonusBranch'), 'postDamage'),
            ],
            priority: 3,
        },
    ],
};

const SCHEMATICS: AbilityDef = {
    id: 'schematics',
    name: abilityText('schematics', 'name'),
    type: 'utility',
    description: abilityText('schematics', 'description'),
    sfxKey: ARTIFICER_SFX_METAL,
    trigger: { type: 'diceSet', faces: { [FACE.GEAR]: 3, [FACE.ELECTRICITY]: 1 } },
    effects: [
        drawCards(2, abilityEffectText('schematics', 'draw2')),
        heal(2, abilityEffectText('schematics', 'heal2')),
        grantSynth(4, abilityEffectText('schematics', 'gainSynth4')),
    ],
};

export const SCHEMATICS_2: AbilityDef = {
    id: 'schematics',
    name: abilityText('schematics-2', 'name'),
    type: 'utility',
    description: abilityText('schematics-2', 'description'),
    sfxKey: ARTIFICER_SFX_METAL,
    trigger: { type: 'diceSet', faces: { [FACE.GEAR]: 3, [FACE.ELECTRICITY]: 1 } },
    effects: [
        textOnly(abilityEffectText('schematics-2', 'gain2')),
        drawCards(2, abilityEffectText('schematics-2', 'draw2')),
        heal(2, abilityEffectText('schematics-2', 'heal2')),
        grantSynth(4, abilityEffectText('schematics-2', 'gainSynth4')),
    ],
};

const COLLECT_PARTS: AbilityDef = {
    id: 'collect-parts',
    name: abilityText('collect-parts', 'name'),
    type: 'passive',
    description: abilityText('collect-parts', 'description'),
    trigger: { type: 'phaseStart', phase: 'upkeep' },
    effects: [
        textOnly(abilityEffectText('collect-parts', 'upkeepGainSynth'), 'immediate'),
        textOnly(abilityEffectText('collect-parts', 'spendSynthForNanobomb'), 'immediate'),
    ],
};

export const COLLECT_PARTS_2: AbilityDef = {
    id: 'collect-parts',
    name: abilityText('collect-parts-2', 'name'),
    type: 'passive',
    description: abilityText('collect-parts-2', 'description'),
    trigger: { type: 'phaseStart', phase: 'upkeep' },
    effects: [
        textOnly(abilityEffectText('collect-parts-2', 'upkeepGainSynth'), 'immediate'),
        textOnly(abilityEffectText('collect-parts-2', 'spendSynthForNanobomb'), 'immediate'),
    ],
};

const EUREKA: AbilityDef = {
    id: 'eureka',
    name: abilityText('eureka', 'name'),
    type: 'offensive',
    description: abilityText('eureka', 'description'),
    sfxKey: ARTIFICER_SFX_METAL,
    trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 2, [FACE.GEAR]: 3 } },
    effects: [
        grantSynth(3, abilityEffectText('eureka', 'gainSynth3')),
        damage(7, abilityEffectText('eureka', 'damage7')),
    ],
};

export const EUREKA_2: AbilityDef = {
    id: 'eureka',
    name: abilityText('eureka-2', 'name'),
    type: 'offensive',
    description: abilityText('eureka-2', 'description'),
    sfxKey: ARTIFICER_SFX_METAL,
    trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 2, [FACE.GEAR]: 3 } },
    effects: [
        grantSynth(3, abilityEffectText('eureka-2', 'gainSynth3')),
        damage(8, abilityEffectText('eureka-2', 'damage8')),
        textOnly(abilityEffectText('eureka-2', 'buildFromScratch'), 'postDamage'),
    ],
};

const ACTIVATE_BOTS: AbilityDef = {
    id: 'activate-bots',
    name: abilityText('activate-bots', 'name'),
    type: 'offensive',
    description: abilityText('activate-bots', 'description'),
    sfxKey: ARTIFICER_SFX_METAL,
    trigger: { type: 'smallStraight' },
    effects: [
        grantSynth(1, abilityEffectText('activate-bots', 'gainSynth1')),
        inflictNanobomb(1, abilityEffectText('activate-bots', 'inflictNanobomb')),
        damage(7, abilityEffectText('activate-bots', 'damage7')),
    ],
};

export const ACTIVATE_BOTS_2: AbilityDef = {
    id: 'activate-bots',
    name: abilityText('activate-bots-2', 'name'),
    type: 'offensive',
    description: abilityText('activate-bots-2', 'description'),
    sfxKey: ARTIFICER_SFX_METAL,
    trigger: { type: 'smallStraight' },
    effects: [
        grantSynth(1, abilityEffectText('activate-bots-2', 'gainSynth1')),
        inflictNanobomb(2, abilityEffectText('activate-bots-2', 'inflictNanobomb2')),
        damage(7, abilityEffectText('activate-bots-2', 'damage7')),
        textOnly(abilityEffectText('activate-bots-2', 'botSwarm'), 'postDamage'),
    ],
};

const OVERCLOCK: AbilityDef = {
    id: 'overclock',
    name: abilityText('overclock', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('overclock', 'description'),
    sfxKey: ARTIFICER_SFX_ELECTRIC,
    trigger: { type: 'diceSet', faces: { [FACE.ELECTRICITY]: 4 } },
    effects: [
        damage(6, abilityEffectText('overclock', 'damage6Unblockable'), { unblockable: true }),
        textOnly(abilityEffectText('overclock', 'activateTwoBots'), 'postDamage'),
    ],
};

export const OVERCLOCK_2: AbilityDef = {
    id: 'overclock',
    name: abilityText('overclock-2', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('overclock-2', 'description'),
    sfxKey: ARTIFICER_SFX_ELECTRIC,
    variants: [
        {
            id: 'overclock-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.ELECTRICITY]: 4 } },
            effects: [
                damage(6, abilityEffectText('overclock-2', 'damage6Unblockable'), { unblockable: true }),
                textOnly(abilityEffectText('overclock-2', 'activateTwoBots'), 'postDamage'),
            ],
            priority: 2,
            tags: ['unblockable'],
        },
        {
            id: 'overclock-2-energy-boost',
            trigger: { type: 'diceSet', faces: { [FACE.GEAR]: 2, [FACE.ELECTRICITY]: 2 } },
            effects: [
                grantSynth(2, abilityEffectText('overclock-2', 'energyBoostGainSynth2')),
                damage(4, abilityEffectText('overclock-2', 'energyBoostDamage4'), { unblockable: true }),
            ],
            priority: 1,
            tags: ['unblockable'],
        },
    ],
};

const SHOCK_BOT: AbilityDef = {
    id: 'shock-bot',
    name: abilityText('shock-bot', 'name'),
    type: 'offensive',
    description: abilityText('shock-bot', 'description'),
    sfxKey: ARTIFICER_SFX_ELECTRIC,
    trigger: { type: 'largeStraight' },
    effects: [
        inflictNanobomb(1, abilityEffectText('shock-bot', 'inflictNanobomb')),
        damage(9, abilityEffectText('shock-bot', 'damage9')),
        textOnly(abilityEffectText('shock-bot', 'activateOneBot'), 'postDamage'),
    ],
};

export const SHOCK_BOT_3: AbilityDef = {
    id: 'shock-bot',
    name: abilityText('shock-bot-3', 'name'),
    type: 'offensive',
    description: abilityText('shock-bot-3', 'description'),
    sfxKey: ARTIFICER_SFX_ELECTRIC,
    trigger: { type: 'largeStraight' },
    effects: [
        grantSynth(2, abilityEffectText('shock-bot-3', 'gainSynth2')),
        inflictNanobomb(1, abilityEffectText('shock-bot-3', 'inflictNanobomb')),
        damage(9, abilityEffectText('shock-bot-3', 'damage9')),
        textOnly(abilityEffectText('shock-bot-3', 'activateOneBot'), 'postDamage'),
    ],
};

const TINKER: AbilityDef = {
    id: 'tinker',
    name: abilityText('tinker', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('tinker', 'description'),
    sfxKey: ARTIFICER_SFX_METAL,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
    effects: [
        textOnly(abilityEffectText('tinker', 'defense4'), 'withDamage'),
    ],
};

export const TINKER_2: AbilityDef = {
    id: 'tinker',
    name: abilityText('tinker-2', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('tinker-2', 'description'),
    sfxKey: ARTIFICER_SFX_METAL,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        textOnly(abilityEffectText('tinker-2', 'defense5'), 'withDamage'),
    ],
};

const MAXIMUM_POWER: AbilityDef = {
    id: 'maximum-power',
    name: abilityText('maximum-power', 'name'),
    type: 'offensive',
    tags: ['ultimate', 'uninterruptible'],
    description: abilityText('maximum-power', 'description'),
    sfxKey: ARTIFICER_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.ELECTRICITY]: 5 } },
    effects: [
        grantSynth(2, abilityEffectText('maximum-power', 'gainSynth2')),
        inflictNanobomb(1, abilityEffectText('maximum-power', 'inflictNanobomb')),
        damage(10, abilityEffectText('maximum-power', 'damage10')),
        textOnly(abilityEffectText('maximum-power', 'activateTwoBots'), 'postDamage'),
    ],
};

export const ARTIFICER_ABILITIES: AbilityDef[] = [
    WRENCH_STRIKE,
    SCHEMATICS,
    COLLECT_PARTS,
    EUREKA,
    ACTIVATE_BOTS,
    OVERCLOCK,
    SHOCK_BOT,
    TINKER,
    MAXIMUM_POWER,
];
