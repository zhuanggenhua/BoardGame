import { abilityText, abilityEffectText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { CURSED_PIRATE_DICE_FACE_IDS, STATUS_IDS } from '../../domain/ids';
import type { HeroState } from '../../domain/types';

const FACE = CURSED_PIRATE_DICE_FACE_IDS;

export const CURSED_PIRATE_SFX_SLASH = 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1';
export const CURSED_PIRATE_SFX_CURSE = 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_blight_curse_001';
export const CURSED_PIRATE_SFX_ULTIMATE = 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001';
export const CURSED_PIRATE_SFX_EXPLOSION = 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.pot_explosion';

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

const grantStatus = (
    statusId: string,
    description: string,
    opts?: { timing?: EffectTiming; condition?: AbilityEffect['condition'] },
): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value: 1 },
    timing: opts?.timing ?? 'preDefense',
    condition: opts?.condition,
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
        { id: 'soul-stab-3', trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 3 } }, effects: [damage(5, abilityEffectText('soul-stab', 'damage5')), custom('cursed-pirate-powder-keg-if-three-kind', abilityEffectText('soul-stab', 'powderKegIfThreeKind'), { timing: 'postDamage', target: 'opponent' })], priority: 1 },
        { id: 'soul-stab-4', trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 4 } }, effects: [damage(7, abilityEffectText('soul-stab', 'damage7')), custom('cursed-pirate-powder-keg-if-three-kind', abilityEffectText('soul-stab', 'powderKegIfThreeKind'), { timing: 'postDamage', target: 'opponent' })], priority: 2 },
        { id: 'soul-stab-5', trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 5 } }, effects: [damage(9, abilityEffectText('soul-stab', 'damage9')), custom('cursed-pirate-powder-keg-if-three-kind', abilityEffectText('soul-stab', 'powderKegIfThreeKind'), { timing: 'postDamage', target: 'opponent' })], priority: 3 },
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
        custom('gain-cp', abilityEffectText('marked-for-death', 'gain2Cp'), { params: { amount: 2 } }),
        {
            description: abilityEffectText('marked-for-death', 'roll4'),
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
        custom('cursed-pirate-cursed-upkeep-self-damage', abilityEffectText('cursed', 'selfDamage4'), { timing: 'immediate' }),
        {
            description: abilityEffectText('cursed', 'powderKegToPassiveOpponents'),
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
        custom('cursed-pirate-steal-one-cp', abilityEffectText('deep-sea-dive', 'steal1Cp'), { target: 'opponent' }),
        custom('cursed-pirate-request-opponent-discard-one-card', abilityEffectText('deep-sea-dive', 'opponentDiscard1'), { target: 'opponent' }),
        grantStatus(STATUS_IDS.WITHER, abilityEffectText('deep-sea-dive', 'inflictWither')),
        damage(8, abilityEffectText('deep-sea-dive', 'damage8')),
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
            effects: [
                grantStatus(STATUS_IDS.WITHER, abilityEffectText('breath-of-death', 'smallInflictWither')),
                grantStatus(STATUS_IDS.POWDER_KEG, abilityEffectText('breath-of-death', 'smallInflictPowderKeg')),
                damage(7, abilityEffectText('breath-of-death', 'smallDamage7')),
            ],
            priority: 1,
        },
        {
            id: 'breath-of-death-large',
            trigger: { type: 'largeStraight' },
            effects: [
                grantStatus(STATUS_IDS.WITHER, abilityEffectText('breath-of-death', 'largeInflictWither')),
                grantStatus(STATUS_IDS.POWDER_KEG, abilityEffectText('breath-of-death', 'largeInflictPowderKeg')),
                damage(10, abilityEffectText('breath-of-death', 'largeDamage10')),
            ],
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
        grantStatus(STATUS_IDS.PARLEY, abilityEffectText('soul-command', 'inflictParley')),
        grantStatus(STATUS_IDS.POWDER_KEG, abilityEffectText('soul-command', 'inflictPowderKeg')),
        grantStatus(STATUS_IDS.WITHER, abilityEffectText('soul-command', 'inflictWither')),
        damage(8, abilityEffectText('soul-command', 'damage8'), { unblockable: true }),
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
        damage(8, abilityEffectText('undead-claw', 'damage8'), { unblockable: true }),
        custom('cursed-pirate-damage-by-cursed-coins', abilityEffectText('undead-claw', 'damageByCursedCoins'), { timing: 'postDamage' }),
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
        custom('cursed-pirate-still-wet-behind-ears-defense', abilityEffectText('still-wet-behind-ears', 'defense5'), { timing: 'withDamage' }),
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
        damage(13, abilityEffectText('merciless-curse', 'damage13')),
        grantStatus(STATUS_IDS.PARLEY, abilityEffectText('merciless-curse', 'inflictParley')),
        grantStatus(STATUS_IDS.CURSED_COIN, abilityEffectText('merciless-curse', 'inflictCursedCoin')),
        grantStatus(STATUS_IDS.WITHER, abilityEffectText('merciless-curse', 'inflictWither')),
        custom('cursed-pirate-merciless-curse-powder-keg-targets', abilityEffectText('merciless-curse', 'powderKegTargets'), { timing: 'preDefense' }),
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
    name: abilityText('cutlass-stab', 'name'),
    type: 'offensive',
    description: abilityText('cutlass-stab', 'description'),
    sfxKey: CURSED_PIRATE_SFX_SLASH,
    variants: [
        {
            id: 'cutlass-stab-3',
            trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 3 } },
            effects: [
                damage(5, abilityEffectText('cutlass-stab', 'damage5')),
                custom('cursed-pirate-human-powder-keg-if-four-kind', abilityEffectText('cutlass-stab', 'powderKegIfFourKind'), { timing: 'postDamage', target: 'opponent' }),
            ],
            priority: 1,
        },
        {
            id: 'cutlass-stab-4',
            trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 4 } },
            effects: [
                damage(6, abilityEffectText('cutlass-stab', 'damage6')),
                custom('cursed-pirate-human-powder-keg-if-four-kind', abilityEffectText('cutlass-stab', 'powderKegIfFourKind'), { timing: 'postDamage', target: 'opponent' }),
            ],
            priority: 2,
        },
        {
            id: 'cutlass-stab-5',
            trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 5 } },
            effects: [
                damage(7, abilityEffectText('cutlass-stab', 'damage7')),
                custom('cursed-pirate-human-powder-keg-if-four-kind', abilityEffectText('cutlass-stab', 'powderKegIfFourKind'), { timing: 'postDamage', target: 'opponent' }),
            ],
            priority: 3,
        },
    ],
};

const HUMAN_MAKE_YOUR_MARK: AbilityDef = {
    id: 'make-your-mark',
    name: abilityText('make-your-mark', 'name'),
    type: 'utility',
    description: abilityText('make-your-mark', 'description'),
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    trigger: { type: 'diceSet', faces: { [FACE.LOOT]: 3 } },
    effects: [
        custom('gain-cp', abilityEffectText('make-your-mark', 'gain1Cp'), { timing: 'preDefense', params: { amount: 1 } }),
        {
            description: abilityEffectText('make-your-mark', 'roll3'),
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
    name: abilityText('human-cursed', 'name'),
    type: 'passive',
    description: abilityText('human-cursed', 'description'),
    trigger: { type: 'phaseEnd', phase: 'discard' },
    effects: [
        custom(
            'cursed-pirate-human-cursed-end-turn',
            abilityEffectText('human-cursed', 'endTurnFlipCheck'),
            { timing: 'immediate' },
        ),
    ],
};

const HUMAN_WALK_THE_PLANK: AbilityDef = {
    id: 'walk-the-plank',
    name: abilityText('walk-the-plank', 'name'),
    type: 'offensive',
    description: abilityText('walk-the-plank', 'description'),
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 1, [FACE.LOOT]: 2, [FACE.SKULL]: 1 } },
    effects: [
        custom('cursed-pirate-human-walk-the-plank-choice', abilityEffectText('walk-the-plank', 'choice'), { target: 'opponent' }),
        damage(7, abilityEffectText('walk-the-plank', 'damage7')),
    ],
};

const HUMAN_LIGHT_THE_FUSE: AbilityDef = {
    id: 'light-the-fuse',
    name: abilityText('light-the-fuse', 'name'),
    type: 'offensive',
    description: abilityText('light-the-fuse', 'description'),
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    variants: [
        {
            id: 'light-the-fuse-small',
            trigger: { type: 'smallStraight' },
            effects: [
                grantStatus(
                    STATUS_IDS.POWDER_KEG,
                    abilityEffectText('light-the-fuse', 'smallInflictPowderKeg'),
                    { timing: 'postDamage', condition: { type: 'onHit' } },
                ),
                damage(7, abilityEffectText('light-the-fuse', 'smallDamage7'), { timing: 'preDefense' }),
            ],
            priority: 1,
        },
        {
            id: 'light-the-fuse-large',
            trigger: { type: 'largeStraight' },
            effects: [
                grantStatus(
                    STATUS_IDS.POWDER_KEG,
                    abilityEffectText('light-the-fuse', 'largeInflictPowderKeg'),
                    { timing: 'postDamage', condition: { type: 'onHit' } },
                ),
                damage(9, abilityEffectText('light-the-fuse', 'largeDamage9'), { timing: 'preDefense' }),
            ],
            priority: 2,
        },
    ],
};

const HUMAN_VERDICT_COMMAND: AbilityDef = {
    id: 'verdict-command',
    name: abilityText('verdict-command', 'name'),
    type: 'offensive',
    description: abilityText('verdict-command', 'description'),
    sfxKey: CURSED_PIRATE_SFX_CURSE,
    trigger: { type: 'diceSet', faces: { [FACE.SKULL]: 4 } },
    effects: [
        custom(
            'cursed-pirate-human-verdict-command',
            abilityEffectText('verdict-command', 'coinChoiceThenContinue'),
            { target: 'self' },
        ),
    ],
};

const HUMAN_ASTONISHING: AbilityDef = {
    id: 'astonishing',
    name: abilityText('astonishing', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('astonishing', 'description'),
    sfxKey: CURSED_PIRATE_SFX_SLASH,
    trigger: { type: 'diceSet', faces: { [FACE.CUTLASS]: 1, [FACE.SKULL]: 3 } },
    effects: [
        damage(7, abilityEffectText('astonishing', 'damage7'), { unblockable: true }),
        custom('cursed-pirate-human-remove-cursed-coins-choice', abilityEffectText('astonishing', 'removeAnyCursedCoins'), { timing: 'postDamage' }),
    ],
};

const HUMAN_STILL_WET_BEHIND_EARS: AbilityDef = {
    id: 'human-still-wet-behind-ears',
    name: abilityText('human-still-wet-behind-ears', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('human-still-wet-behind-ears', 'description'),
    sfxKey: CURSED_PIRATE_SFX_SLASH,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
    effects: [
        custom('cursed-pirate-human-defense', abilityEffectText('human-still-wet-behind-ears', 'defense4'), { timing: 'withDamage' }),
    ],
};

const HUMAN_MERCILESS_PLUNDER: AbilityDef = {
    id: 'merciless-plunder',
    name: abilityText('merciless-plunder', 'name'),
    type: 'offensive',
    tags: ['ultimate', 'uninterruptible'],
    description: abilityText('merciless-plunder', 'description'),
    sfxKey: CURSED_PIRATE_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.SKULL]: 5 } },
    effects: [
        damage(12, abilityEffectText('merciless-plunder', 'damage12')),
        custom(
            'cursed-pirate-human-merciless-plunder',
            abilityEffectText('merciless-plunder', 'coinChoiceThenContinue'),
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
