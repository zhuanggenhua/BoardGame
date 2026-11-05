/** 索尔能力。规则原文与图面语义见 rule/雷神录入核对.md。 */
import { abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { THOR_DICE_FACE_IDS as FACE } from '../../domain/ids';

export const THOR_SFX = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_astral_flare_001';

const custom = (customActionId: string, params?: Record<string, string | number | boolean>, target: 'self' | 'opponent' = 'self'): AbilityEffect => ({
    description: 'abilities.thor-effects.description',
    action: { type: 'custom', target, customActionId, params },
    timing: 'preDefense',
});
const damage = (value: number): AbilityEffect => ({
    description: 'abilities.thor-effects.description',
    action: { type: 'damage', target: 'opponent', value }, timing: 'withDamage',
});
const named = (id: string, fields: Omit<AbilityDef, 'id' | 'name' | 'description' | 'sfxKey'>): AbilityDef => ({
    id, name: abilityText(id, 'name'), description: abilityText(id, 'description'), sfxKey: THOR_SFX, ...fields,
});
const diceSet = (hammer: number, worthy: number, thunder: number) => ({
    type: 'diceSet' as const,
    faces: { ...(hammer ? { [FACE.HAMMER]: hammer } : {}), ...(worthy ? { [FACE.WORTHY]: worthy } : {}), ...(thunder ? { [FACE.THUNDER]: thunder } : {}) },
});

export const THOR_HAMMER = named('thor-hammer', {
    type: 'offensive',
    variants: [4, 5, 7].map((value, i) => ({
        id: `thor-hammer-${i + 3}`, trigger: diceSet(i + 3, 0, 0), priority: i,
        effects: [custom('thor-hammer-moves', { count: 1, throwOnly: true }), damage(value)],
    })),
});
export const THOR_MIGHTY_SUMMON = named('thor-mighty-summon', {
    type: 'offensive', trigger: diceSet(1, 2, 1), effects: [custom('thor-mighty-summon')],
});
export const THOR_ODINFORCE = named('thor-odinforce', {
    type: 'offensive', trigger: diceSet(2, 3, 0),
    effects: [custom('thor-odinforce-roll', { count: 5 }), damage(5)],
});
export const THOR_CHAIN_LIGHTNING = named('thor-chain-lightning', {
    type: 'offensive', trigger: diceSet(3, 0, 2),
    effects: [custom('thor-chain-roll', { count: 3, selectCount: 2 }, 'opponent'), damage(0)],
});
export const THOR_THUNDER_STRIKE = named('thor-thunder-strike', {
    type: 'offensive', trigger: { type: 'smallStraight' },
    effects: [custom('thor-thunder-strike'), damage(7)],
});
export const THOR_BOTTLED_LIGHTNING = named('thor-bottled-lightning', {
    type: 'offensive', trigger: diceSet(0, 0, 4),
    effects: [custom('thor-hammer-moves', { count: 2, optional: true, guardBreak: 2, electrokinesisDamage: true }), damage(7)],
});
export const THOR_POWER_OF_THUNDER = named('thor-power-of-thunder', {
    type: 'offensive', trigger: { type: 'largeStraight' },
    effects: [custom('thor-hammer-moves', { count: 1, electrokinesis: 2 }), damage(10)],
});
export const THOR_THUNDER_WHEEL = named('thor-thunder-wheel', {
    type: 'defensive', trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 3 },
    effects: [{ ...custom('thor-thunder-wheel'), timing: 'withDamage' }],
});
export const THOR_ULTIMATE = named('thor-for-asgard', {
    type: 'offensive', trigger: diceSet(0, 0, 5), tags: ['ultimate', 'unblockable'],
    effects: [custom('thor-grant-guard-break', { amount: 1 }), custom('thor-hammer-moves', { count: 4, optional: true }), damage(14)],
});

export const THOR_ABILITIES: AbilityDef[] = [
    THOR_HAMMER, THOR_MIGHTY_SUMMON, THOR_ODINFORCE, THOR_CHAIN_LIGHTNING,
    THOR_THUNDER_STRIKE, THOR_BOTTLED_LIGHTNING, THOR_POWER_OF_THUNDER,
    THOR_THUNDER_WHEEL, THOR_ULTIMATE,
];

export const THOR_HAMMER_2 = named('thor-hammer', {
    type: 'offensive', variants: [5, 6, 7].map((value, i) => ({
        id: `thor-hammer-2-${i + 3}`, trigger: diceSet(i + 3, 0, 0), priority: i,
        effects: [custom('thor-hammer-moves', { count: 1, duplicateThreshold: 4 }), damage(value)],
    })),
});
export const THOR_HAMMER_3 = named('thor-hammer', {
    type: 'offensive', variants: [5, 6, 8].map((value, i) => ({
        id: `thor-hammer-3-${i + 3}`, trigger: diceSet(i + 3, 0, 0), priority: i,
        effects: [custom('thor-hammer-moves', { count: 1, duplicateThreshold: 3 }), damage(value)],
    })),
});
export const THOR_MIGHTY_SUMMON_2 = named('thor-mighty-summon', {
    type: 'offensive', variants: [
        { id: 'thor-mighty-summon-2', name: abilityText('thor-mighty-summon-primary', 'name'), description: abilityText('thor-mighty-summon-primary', 'description'), trigger: diceSet(1, 2, 1), effects: [custom('thor-mighty-summon', { heal: 3, collateral: 4 })] },
        { id: 'thor-flash-and-thunder', name: abilityText('thor-flash-and-thunder', 'name'), trigger: diceSet(2, 0, 2), effects: [custom('thor-grant-electrokinesis', { amount: 2 }), damage(6)] },
    ],
});
export const THOR_CHAIN_LIGHTNING_2 = named('thor-chain-lightning', {
    type: 'offensive', trigger: diceSet(3, 0, 2), effects: [custom('thor-chain-roll', { count: 4, selectCount: 2, collateral: 3 }, 'opponent'), damage(0)],
});
export const THOR_ODINFORCE_2 = named('thor-odinforce', {
    type: 'offensive', trigger: diceSet(2, 3, 0), effects: [custom('thor-odinforce-roll', { count: 5, groupReroll: true }), damage(6)],
});
export const THOR_THUNDER_STRIKE_2 = named('thor-thunder-strike', {
    type: 'offensive', trigger: { type: 'smallStraight' }, effects: [custom('thor-hammer-moves', { count: 1, electrokinesis: 1 }), damage(9)],
});
export const THOR_POWER_OF_THUNDER_2 = named('thor-power-of-thunder', {
    type: 'offensive', variants: [
        { id: 'thor-power-of-thunder-2', name: abilityText('thor-power-of-thunder-primary', 'name'), description: abilityText('thor-power-of-thunder-primary', 'description'), trigger: { type: 'largeStraight' }, effects: [custom('thor-hammer-moves', { count: 1, electrokinesis: 2 }), damage(12)] },
        { id: 'thor-asgardian-might', name: abilityText('thor-asgardian-might', 'name'), trigger: diceSet(0, 3, 0), effects: [{ description: 'abilities.thor-asgardian-might.description', action: { type: 'heal', target: 'self', value: 4 }, timing: 'preDefense' }] },
    ],
});
export const THOR_BOTTLED_LIGHTNING_2 = named('thor-bottled-lightning', {
    type: 'offensive', variants: [
        { id: 'thor-bottled-lightning-2', name: abilityText('thor-bottled-lightning-primary', 'name'), description: abilityText('thor-bottled-lightning-primary', 'description'), trigger: diceSet(0, 0, 4), effects: [custom('thor-hammer-moves', { count: 3, optional: true, guardBreak: 2, electrokinesisDamage: true }), damage(8)] },
        { id: 'thor-hammer-chain', name: abilityText('thor-hammer-chain', 'name'), trigger: diceSet(0, 0, 3), effects: [custom('thor-hammer-moves', { count: 6, optional: true })] },
    ],
});
export const THOR_THUNDER_WHEEL_2 = named('thor-thunder-wheel', {
    type: 'defensive', trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
    effects: [{ ...custom('thor-thunder-wheel', { upgraded: true }), timing: 'withDamage' }],
});
