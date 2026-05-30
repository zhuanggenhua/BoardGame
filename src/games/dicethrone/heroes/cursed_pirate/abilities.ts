import { abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { CURSED_PIRATE_DICE_FACE_IDS, STATUS_IDS } from '../../domain/ids';

const FACE = CURSED_PIRATE_DICE_FACE_IDS;

export const CURSED_PIRATE_SFX_SLASH = 'combat.general.forged_in_fury_vol_1.blade_impact.blade_impact_heavy';
export const CURSED_PIRATE_SFX_CURSE = 'magic.general.simple_magic_sound_fx_pack_vol.dark.dark_magic_cast';
export const CURSED_PIRATE_SFX_ULTIMATE = 'magic.general.simple_magic_sound_fx_pack_vol.dark.dark_magic_impact';

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

const grantStatus = (statusId: string, description: string): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value: 1 },
    timing: 'preDefense',
});

const custom = (
    customActionId: string,
    description: string,
    opts?: { timing?: EffectTiming; target?: 'self' | 'opponent'; params?: Record<string, unknown> },
): AbilityEffect => ({
    description,
    action: { type: 'custom', target: opts?.target ?? 'self', customActionId, ...(opts?.params ? { params: opts.params } : {}) },
    timing: opts?.timing ?? 'preDefense',
});

const SOUL_STAB: AbilityDef = {
    id: 'soul-stab',
    name: abilityText('soul-stab', 'name'),
    type: 'offensive',
    description: abilityText('soul-stab', 'description'),
    sfxKey: CURSED_PIRATE_SFX_SLASH,
    variants: [
        { id: 'soul-stab-3', trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 3 } }, effects: [damage(5, '造成 5 点伤害。'), custom('cursed-pirate-powder-keg-if-three-kind', '若投出 3 个相同数字，施加火药桶。', { timing: 'postDamage', target: 'opponent' })], priority: 1 },
        { id: 'soul-stab-4', trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 4 } }, effects: [damage(7, '造成 7 点伤害。'), custom('cursed-pirate-powder-keg-if-three-kind', '若投出 3 个相同数字，施加火药桶。', { timing: 'postDamage', target: 'opponent' })], priority: 2 },
        { id: 'soul-stab-5', trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 5 } }, effects: [damage(9, '造成 9 点伤害。'), custom('cursed-pirate-powder-keg-if-three-kind', '若投出 3 个相同数字，施加火药桶。', { timing: 'postDamage', target: 'opponent' })], priority: 3 },
    ],
};

const MARKED_FOR_DEATH: AbilityDef = {
    id: 'marked-for-death',
    name: abilityText('marked-for-death', 'name'),
    type: 'utility',
    description: abilityText('marked-for-death', 'description'),
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    trigger: { type: 'diceSet', faces: { [FACE.LOOT]: 3 } },
    effects: [
        custom('gain-cp', '获得 2CP。', { params: { amount: 2 } }),
        {
            description: '投 4 骰；弯刀造成不可防御伤害，战利品抽牌，骷髅施加诅咒金币。不可防御分支待机制收口。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 4,
                conditionalEffects: [
                    { face: FACE.CUTLASS, unblockableDamage: 2, effectKey: 'bonusDie.effect.cursedPirateMarkedCutlass' },
                    { face: FACE.LOOT, drawCard: 1, effectKey: 'bonusDie.effect.cursedPirateMarkedLoot' },
                    { face: FACE.SKULL, grantStatus: { statusId: STATUS_IDS.CURSED_COIN, value: 1, target: 'opponent' }, effectKey: 'bonusDie.effect.cursedPirateMarkedSkull' },
                ],
            },
            timing: 'preDefense',
        },
    ],
};

const CURSED: AbilityDef = {
    id: 'cursed',
    name: abilityText('cursed', 'name'),
    type: 'passive',
    description: abilityText('cursed', 'description'),
    trigger: { type: 'phaseStart', phase: 'upkeep' },
    effects: [
        {
            description: '维持阶段受 4 点不可减少/防止伤害；未造成攻击的对手获得火药桶。完整被动待机制收口。',
        },
    ],
};

const DEEP_SEA_DIVE: AbilityDef = {
    id: 'deep-sea-dive',
    name: abilityText('deep-sea-dive', 'name'),
    type: 'offensive',
    description: abilityText('deep-sea-dive', 'description'),
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 1, [FACE.LOOT]: 2, [FACE.SKULL]: 1 } },
    effects: [
        custom('cursed-pirate-steal-one-cp', '偷取 1CP。', { target: 'opponent' }),
        grantStatus(STATUS_IDS.WITHER, '对手获得凋零。'),
        damage(8, '造成 8 点伤害。对手弃牌交互待机制收口。'),
    ],
};

const BREATH_OF_DEATH: AbilityDef = {
    id: 'breath-of-death',
    name: abilityText('breath-of-death', 'name'),
    type: 'offensive',
    description: abilityText('breath-of-death', 'description'),
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    variants: [
        {
            id: 'breath-of-death-small',
            trigger: { type: 'smallStraight' },
            effects: [grantStatus(STATUS_IDS.WITHER, '对手获得凋零。'), grantStatus(STATUS_IDS.POWDER_KEG, '对手获得火药桶。'), damage(7, '造成 7 点伤害。')],
            priority: 1,
        },
        {
            id: 'breath-of-death-large',
            trigger: { type: 'largeStraight' },
            effects: [grantStatus(STATUS_IDS.WITHER, '对手获得凋零。'), grantStatus(STATUS_IDS.POWDER_KEG, '对手获得火药桶。'), damage(10, '造成 10 点伤害。')],
            priority: 2,
        },
    ],
};

const SOUL_COMMAND: AbilityDef = {
    id: 'soul-command',
    name: abilityText('soul-command', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('soul-command', 'description'),
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    trigger: { type: 'diceSet', faces: { [FACE.SKULL]: 4 } },
    effects: [
        grantStatus(STATUS_IDS.PARLEY, '对手获得休战。'),
        grantStatus(STATUS_IDS.POWDER_KEG, '对手获得火药桶。'),
        grantStatus(STATUS_IDS.WITHER, '对手获得凋零。'),
        damage(8, '造成 8 点不可防御伤害。', { unblockable: true }),
    ],
};

const UNDEAD_CLAW: AbilityDef = {
    id: 'undead-claw',
    name: abilityText('undead-claw', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('undead-claw', 'description'),
    sfxKey: CURSED_PIRATE_SFX_SLASH,
    trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 1, [FACE.SKULL]: 3 } },
    effects: [
        damage(8, '造成 8 点不可防御伤害。', { unblockable: true }),
        custom('cursed-pirate-damage-by-cursed-coins', '所有对手每有 1 个诅咒金币而受 1 点伤害。', { timing: 'postDamage' }),
    ],
};

const STILL_WET_BEHIND_EARS: AbilityDef = {
    id: 'still-wet-behind-ears',
    name: abilityText('still-wet-behind-ears', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('still-wet-behind-ears', 'description'),
    sfxKey: CURSED_PIRATE_SFX_SLASH,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        {
            description: '防御掷 5 骰：弯刀反击、战利品获得、骷髅防止伤害；弯刀+骷髅施加诅咒金币。精确防御结算待机制收口。',
            timing: 'withDamage',
        },
    ],
};

const MERCILESS_CURSE: AbilityDef = {
    id: 'merciless-curse',
    name: abilityText('merciless-curse', 'name'),
    type: 'offensive',
    tags: ['ultimate', 'uninterruptible'],
    description: abilityText('merciless-curse', 'description'),
    sfxKey: CURSED_PIRATE_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.SKULL]: 5 } },
    effects: [
        damage(13, '造成 13 点伤害。'),
        grantStatus(STATUS_IDS.PARLEY, '对手获得休战。'),
        grantStatus(STATUS_IDS.CURSED_COIN, '对手获得诅咒金币。'),
        grantStatus(STATUS_IDS.WITHER, '对手获得凋零。'),
        grantStatus(STATUS_IDS.POWDER_KEG, '对至多两名对手施加火药桶；当前先对主要对手施加，2v2 额外目标待机制收口。'),
    ],
};

export const CURSED_PIRATE_ABILITIES: AbilityDef[] = [
    SOUL_STAB,
    MARKED_FOR_DEATH,
    CURSED,
    DEEP_SEA_DIVE,
    BREATH_OF_DEATH,
    SOUL_COMMAND,
    UNDEAD_CLAW,
    STILL_WET_BEHIND_EARS,
    MERCILESS_CURSE,
];
