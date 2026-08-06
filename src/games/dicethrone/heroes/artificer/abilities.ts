import { abilityEffectText, abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { ARTIFICER_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';

const FACE = ARTIFICER_DICE_FACE_IDS;

export const ARTIFICER_SFX_METAL = 'system.computers_machinery_sound_fx_pack_vol.foley_and_impacts.foley.tools_metal_foley_001';
export const ARTIFICER_SFX_ELECTRIC = 'magic.general.simple_magic_sound_fx_pack_vol.shock.lightning_bolt_cast_a';
export const ARTIFICER_SFX_ULTIMATE = 'magic.general.simple_magic_sound_fx_pack_vol.shock.lightning_bolt_impact_a';

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

const gainCp = (value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId: 'gain-cp', params: { amount: value } },
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

const custom = (
    customActionId: string,
    description: string,
    opts?: {
        timing?: EffectTiming;
        target?: 'self' | 'opponent';
        params?: Record<string, unknown>;
    },
): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target: opts?.target ?? 'self',
        customActionId,
        ...(opts?.params ? { params: opts.params } : {}),
    },
    timing: opts?.timing,
});

const wrenchBranch = (description: string): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId: 'artificer-wrench-strike-branch' },
    timing: 'preDefense',
});

const buildFromScratch = (description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId: 'artificer-build-from-scratch-choice' },
    timing,
});

const activateBots = (
    description: string,
    maxActivations: number,
    timing: EffectTiming = 'preDefense',
): AbilityEffect => custom('artificer-activate-bots', description, {
    timing,
    params: { maxActivations },
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
                wrenchBranch(abilityEffectText('wrench-strike', 'bonusBranch')),
                damage(3, abilityEffectText('wrench-strike', 'damage3')),
            ],
            priority: 1,
        },
        {
            id: 'wrench-strike-4',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 4 } },
            effects: [
                wrenchBranch(abilityEffectText('wrench-strike', 'bonusBranch')),
                damage(4, abilityEffectText('wrench-strike', 'damage4')),
            ],
            priority: 2,
        },
        {
            id: 'wrench-strike-5',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 5 } },
            effects: [
                wrenchBranch(abilityEffectText('wrench-strike', 'bonusBranch')),
                damage(5, abilityEffectText('wrench-strike', 'damage5')),
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
                wrenchBranch(abilityEffectText('wrench-strike-2', 'bonusBranch')),
                damage(4, abilityEffectText('wrench-strike-2', 'damage4')),
            ],
            priority: 1,
        },
        {
            id: 'wrench-strike-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 4 } },
            effects: [
                wrenchBranch(abilityEffectText('wrench-strike-2', 'bonusBranch')),
                damage(5, abilityEffectText('wrench-strike-2', 'damage5')),
            ],
            priority: 2,
        },
        {
            id: 'wrench-strike-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 5 } },
            effects: [
                wrenchBranch(abilityEffectText('wrench-strike-2', 'bonusBranch')),
                damage(6, abilityEffectText('wrench-strike-2', 'damage6')),
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
        gainCp(2, abilityEffectText('schematics-2', 'gain2')),
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
        grantSynth(1, abilityEffectText('collect-parts', 'upkeepGainSynth'), 'immediate'),
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
        {
            description: abilityEffectText('collect-parts-2', 'upkeepRoll'),
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 1,
                conditionalEffects: [
                    {
                        face: FACE.WRENCH,
                        grantToken: { tokenId: TOKEN_IDS.SYNTH, value: 1 },
                        effectKey: 'bonusDie.effect.artificerCollectPartsWrench',
                    },
                    {
                        face: FACE.GEAR,
                        grantToken: { tokenId: TOKEN_IDS.SYNTH, value: 2 },
                        effectKey: 'bonusDie.effect.artificerCollectPartsGear',
                    },
                    {
                        face: FACE.ELECTRICITY,
                        grantToken: { tokenId: TOKEN_IDS.SYNTH, value: 2 },
                        effectKey: 'bonusDie.effect.artificerCollectPartsElectricity',
                    },
                ],
            },
            timing: 'immediate',
        },
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
    variants: [
        {
            id: 'eureka-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 2, [FACE.GEAR]: 3 } },
            effects: [
                grantSynth(3, abilityEffectText('eureka-2', 'gainSynth3')),
                damage(8, abilityEffectText('eureka-2', 'damage8')),
            ],
            priority: 2,
        },
        {
            id: 'eureka-2-build-from-scratch',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 2, [FACE.GEAR]: 2 } },
            effects: [
                buildFromScratch(abilityEffectText('eureka-2', 'buildFromScratch')),
            ],
            priority: 1,
        },
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
    variants: [
        {
            id: 'activate-bots-2-main',
            trigger: { type: 'smallStraight' },
            effects: [
                grantSynth(1, abilityEffectText('activate-bots-2', 'gainSynth1')),
                inflictNanobomb(2, abilityEffectText('activate-bots-2', 'inflictNanobomb2')),
                damage(7, abilityEffectText('activate-bots-2', 'damage7')),
            ],
            priority: 2,
        },
        {
            id: 'activate-bots-2-precision-fabrication',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 3, [FACE.ELECTRICITY]: 1 } },
            effects: [
                grantSynth(5, abilityEffectText('activate-bots-2', 'precisionFabricationGainSynth5')),
            ],
            priority: 1,
        },
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
        inflictNanobomb(1, abilityEffectText('overclock', 'inflictNanobomb')),
        damage(6, abilityEffectText('overclock', 'damage6Unblockable'), { unblockable: true }),
        activateBots(abilityEffectText('overclock', 'activateTwoBots'), 2),
    ],
};

export const OVERCLOCK_2: AbilityDef = {
    id: 'overclock',
    name: abilityText('overclock-2', 'name'),
    type: 'offensive',
    description: abilityText('overclock-2', 'description'),
    sfxKey: ARTIFICER_SFX_ELECTRIC,
    variants: [
        {
            id: 'overclock-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.ELECTRICITY]: 4 } },
            effects: [
                inflictNanobomb(1, abilityEffectText('overclock-2', 'inflictNanobomb')),
                damage(6, abilityEffectText('overclock-2', 'damage6Unblockable'), { unblockable: true }),
                activateBots(abilityEffectText('overclock-2', 'activateTwoBots'), 2),
            ],
            priority: 2,
            tags: ['unblockable'],
        },
        {
            id: 'overclock-2-energy-boost',
            trigger: { type: 'diceSet', faces: { [FACE.ELECTRICITY]: 3 } },
            effects: [
                inflictNanobomb(3, abilityEffectText('overclock-2', 'energyBoostInflictNanobomb3')),
            ],
            priority: 1,
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
        activateBots(abilityEffectText('shock-bot', 'activateOneBot'), 1),
    ],
};

export const SHOCK_BOT_3: AbilityDef = {
    id: 'shock-bot',
    name: abilityText('shock-bot-3', 'name'),
    type: 'offensive',
    description: abilityText('shock-bot-3', 'description'),
    sfxKey: ARTIFICER_SFX_ELECTRIC,
    variants: [
        {
            id: 'shock-bot-3-main',
            trigger: { type: 'largeStraight' },
            effects: [
                grantSynth(2, abilityEffectText('shock-bot-3', 'gainSynth2')),
                inflictNanobomb(1, abilityEffectText('shock-bot-3', 'inflictNanobomb')),
                damage(9, abilityEffectText('shock-bot-3', 'damage9')),
                activateBots(abilityEffectText('shock-bot-3', 'activateOneBot'), 1),
            ],
            priority: 2,
        },
        {
            id: 'shock-bot-3-mechanical-army',
            trigger: { type: 'diceSet', faces: { [FACE.WRENCH]: 1, [FACE.GEAR]: 2, [FACE.ELECTRICITY]: 1 } },
            effects: [
                custom('artificer-mechanical-army', abilityEffectText('shock-bot-3', 'mechanicalArmy'), {
                    target: 'opponent',
                    timing: 'withDamage',
                }),
            ],
            priority: 1,
        },
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
        custom('artificer-tinker-defense', abilityEffectText('tinker', 'defense4'), {
            timing: 'withDamage',
        }),
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
        custom('artificer-tinker-2-defense', abilityEffectText('tinker-2', 'defense5'), {
            timing: 'withDamage',
        }),
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
        activateBots(abilityEffectText('maximum-power', 'activateTwoBots'), 2),
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
