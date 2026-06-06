import { abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { CURSED_PIRATE_DICE_FACE_IDS, STATUS_IDS } from '../../domain/ids';
import type { HeroState } from '../../domain/types';

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

const grantSelfStatus = (
    statusId: string,
    value: number,
    description: string,
    timing: EffectTiming = 'preDefense',
): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'self', statusId, value },
    timing,
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
            description: '投 4 骰；弯刀造成不可防御伤害，战利品抽牌，骷髅施加诅咒金币。',
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
        custom('cursed-pirate-cursed-upkeep-self-damage', '维持阶段受 4 点不可减少/防止伤害。', { timing: 'immediate' }),
        {
            description: '如果一名对手在其进攻投掷阶段未造成一次攻击，则对该对手施加火药桶。',
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
        custom('cursed-pirate-request-opponent-discard-one-card', '对手选择并弃 1 张手牌。', { target: 'opponent' }),
        grantStatus(STATUS_IDS.WITHER, '对手获得凋零。'),
        damage(8, '造成 8 点伤害。'),
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
        custom('cursed-pirate-still-wet-behind-ears-defense', '防御掷 5 骰：每个弯刀造成 1 伤害；每个战利品获得 1CP；每个骷髅防止 2 伤害；若投出弯刀和骷髅，施加诅咒金币。', { timing: 'withDamage' }),
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
        custom('cursed-pirate-merciless-curse-powder-keg-targets', '对至多两名对手施加火药桶。', { timing: 'preDefense' }),
    ],
};

export const CURSED_PIRATE_CURSED_ABILITIES: AbilityDef[] = [
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

const HUMAN_CUTLASS_STAB: AbilityDef = {
    id: 'cutlass-stab',
    name: '弯刀突刺',
    type: 'offensive',
    description: '3/4/5 个弯刀分别造成 5/6/7 点伤害；若投出 4 个相同数字，施加火药桶。',
    sfxKey: CURSED_PIRATE_SFX_SLASH,
    variants: [
        {
            id: 'cutlass-stab-3',
            trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 3 } },
            effects: [
                damage(5, '造成 5 点伤害。'),
                custom('cursed-pirate-human-powder-keg-if-four-kind', '若投出 4 个相同数字，施加火药桶。', { timing: 'postDamage', target: 'opponent' }),
            ],
            priority: 1,
        },
        {
            id: 'cutlass-stab-4',
            trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 4 } },
            effects: [
                damage(6, '造成 6 点伤害。'),
                custom('cursed-pirate-human-powder-keg-if-four-kind', '若投出 4 个相同数字，施加火药桶。', { timing: 'postDamage', target: 'opponent' }),
            ],
            priority: 2,
        },
        {
            id: 'cutlass-stab-5',
            trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 5 } },
            effects: [
                damage(7, '造成 7 点伤害。'),
                custom('cursed-pirate-human-powder-keg-if-four-kind', '若投出 4 个相同数字，施加火药桶。', { timing: 'postDamage', target: 'opponent' }),
            ],
            priority: 3,
        },
    ],
};

const HUMAN_MAKE_YOUR_MARK: AbilityDef = {
    id: 'make-your-mark',
    name: '做好标记',
    type: 'utility',
    description: '获得 1CP，然后投掷 3 颗骰子：每个弯刀造成 2 点不可防御伤害；每个战利品抽 1 张牌；每个骷髅获得 1 个诅咒金币。',
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    trigger: { type: 'diceSet', faces: { [FACE.LOOT]: 3 } },
    effects: [
        custom('gain-cp', '获得 1CP。', { timing: 'preDefense', params: { amount: 1 } }),
        {
            description: '投掷 3 颗骰子：弯刀造成 2 点不可防御伤害；战利品抽 1 张牌；骷髅获得 1 个诅咒金币。',
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 3,
                conditionalEffects: [
                    { face: FACE.CUTLASS, unblockableDamage: 2, effectKey: 'bonusDie.effect.cursedPirateHumanMakeYourMarkCutlass' },
                    { face: FACE.LOOT, drawCard: 1, effectKey: 'bonusDie.effect.cursedPirateHumanMakeYourMarkLoot' },
                    { face: FACE.SKULL, grantStatus: { statusId: STATUS_IDS.CURSED_COIN, value: 1, target: 'self' }, effectKey: 'bonusDie.effect.cursedPirateHumanMakeYourMarkSkull' },
                ],
            },
            timing: 'preDefense',
        },
    ],
};

const HUMAN_CURSED: AbilityDef = {
    id: 'human-cursed',
    name: '咒缚',
    type: 'passive',
    description: '在你的回合结束时，移除 1 个诅咒金币；若没有任何可供移除的诅咒金币，则将英雄面板翻到另一面，并在剩余游戏时间内保持在那一面。',
    trigger: { type: 'phaseEnd', phase: 'discard' },
    effects: [
        custom(
            'cursed-pirate-human-cursed-end-turn',
            '回合结束时，移除 1 个诅咒金币；若没有可移除的诅咒金币，则翻到另一面并保持在那里。',
            { timing: 'immediate' },
        ),
    ],
};

const HUMAN_WALK_THE_PLANK: AbilityDef = {
    id: 'walk-the-plank',
    name: '走跳板',
    type: 'offensive',
    description: '选择以下其一：偷取 1CP，或对手选择弃掉自己的 1 张牌，然后造成 7 点伤害。',
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 1, [FACE.LOOT]: 2, [FACE.SKULL]: 1 } },
    effects: [
        custom('cursed-pirate-human-walk-the-plank-choice', '选择偷取 1CP，或令对手弃掉 1 张牌。', { target: 'opponent' }),
        damage(7, '造成 7 点伤害。'),
    ],
};

const HUMAN_LIGHT_THE_FUSE: AbilityDef = {
    id: 'light-the-fuse',
    name: '点燃炸药',
    type: 'offensive',
    description: '小顺子：施加火药桶，然后造成 7 点伤害。大顺子：施加火药桶，然后造成 9 点伤害。',
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    variants: [
        {
            id: 'light-the-fuse-small',
            trigger: { type: 'smallStraight' },
            effects: [grantStatus(STATUS_IDS.POWDER_KEG, '施加火药桶。'), damage(7, '造成 7 点伤害。', { timing: 'preDefense' })],
            priority: 1,
        },
        {
            id: 'light-the-fuse-large',
            trigger: { type: 'largeStraight' },
            effects: [grantStatus(STATUS_IDS.POWDER_KEG, '施加火药桶。'), damage(9, '造成 9 点伤害。', { timing: 'preDefense' })],
            priority: 2,
        },
    ],
};

const HUMAN_VERDICT_COMMAND: AbilityDef = {
    id: 'verdict-command',
    name: '判决指令',
    type: 'offensive',
    description: '获得 1 个诅咒金币，施加休战，然后造成 7 点不可防御伤害。',
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    trigger: { type: 'diceSet', faces: { [FACE.SKULL]: 4 } },
    effects: [
        custom(
            'cursed-pirate-human-verdict-command',
            '获得 1 个诅咒金币；选择完成后继续施加休战并造成 7 点不可防御伤害。',
            { target: 'self' },
        ),
    ],
};

const HUMAN_ASTONISHING: AbilityDef = {
    id: 'astonishing',
    name: '惊魂动魄',
    type: 'offensive',
    tags: ['unblockable'],
    description: '造成 7 点不可防御伤害。你可以移除任意数量的诅咒金币。',
    sfxKey: CURSED_PIRATE_SFX_SLASH,
    trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 1, [FACE.SKULL]: 3 } },
    effects: [
        damage(7, '造成 7 点不可防御伤害。', { unblockable: true }),
        custom('cursed-pirate-human-remove-cursed-coins-choice', '你可以移除任意数量的诅咒金币。', { timing: 'postDamage' }),
    ],
};

const HUMAN_STILL_WET_BEHIND_EARS: AbilityDef = {
    id: 'human-still-wet-behind-ears',
    name: '嘿，老兄',
    type: 'defensive',
    tags: ['defensive'],
    description: '防御投掷 4 颗骰子：每个弯刀造成 1 点伤害；每个战利品获得 1CP；每个骷髅防止 2 点伤害；若投出 2 个弯刀和 1 个骷髅，则获得 1 个诅咒金币。',
    sfxKey: CURSED_PIRATE_SFX_SLASH,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
    effects: [
        custom('cursed-pirate-human-defense', '防御掷 4 颗骰子：弯刀反击、战利品得 CP、骷髅防伤，且 2 弯刀 + 1 骷髅时获得诅咒金币。', { timing: 'withDamage' }),
    ],
};

const HUMAN_MERCILESS_PLUNDER: AbilityDef = {
    id: 'merciless-plunder',
    name: '无情劫掠！',
    type: 'offensive',
    tags: ['ultimate', 'uninterruptible'],
    description: '造成 12 点伤害。获得 2 个诅咒金币。施加休战和火药桶。',
    sfxKey: CURSED_PIRATE_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.SKULL]: 5 } },
    effects: [
        damage(12, '造成 12 点伤害。'),
        custom(
            'cursed-pirate-human-merciless-plunder',
            '获得 2 个诅咒金币；选择完成后继续施加休战和火药桶。',
            { timing: 'postDamage', target: 'self' },
        ),
    ],
};

export const CURSED_PIRATE_HUMAN_ABILITIES: AbilityDef[] = [
    HUMAN_CUTLASS_STAB,
    HUMAN_MAKE_YOUR_MARK,
    HUMAN_CURSED,
    HUMAN_WALK_THE_PLANK,
    HUMAN_LIGHT_THE_FUSE,
    HUMAN_VERDICT_COMMAND,
    HUMAN_ASTONISHING,
    HUMAN_STILL_WET_BEHIND_EARS,
    HUMAN_MERCILESS_PLUNDER,
];

export const CURSED_PIRATE_ABILITIES: AbilityDef[] = CURSED_PIRATE_CURSED_ABILITIES;

export function getCursedPirateAbilitiesForFace(playerBoardFace?: HeroState['playerBoardFace']): AbilityDef[] {
    return playerBoardFace === 'normal'
        ? CURSED_PIRATE_HUMAN_ABILITIES
        : CURSED_PIRATE_CURSED_ABILITIES;
}
