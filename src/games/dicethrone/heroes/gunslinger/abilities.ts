import { abilityEffectText, abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { GUNSLINGER_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';

const FACE = GUNSLINGER_DICE_FACE_IDS;

export const GUNSLINGER_SFX_SHOT = 'combat.guns_sound_fx_pack.38_spl_revolver.gunshots.38_spl_revolver_gunshot_a_001';
export const GUNSLINGER_SFX_HEAVY = 'combat.guns_sound_fx_pack.30_30_lever_action_rifle.gunshots.30_30_lever_action_rifle_gunshot_a_001';
export const GUNSLINGER_SFX_ULTIMATE = 'combat.guns_sound_fx_pack.12ga_pump_shotgun.gunshots.12ga_pump_shotgun_gunshot_b_003';
export const GUNSLINGER_SFX_DRAW = 'combat.guns_sound_fx_pack.misc_ammo_boxes_holsters_etc.leather_unholster_001';
export const GUNSLINGER_SFX_LOADED = 'combat.guns_sound_fx_pack.misc_ammo_boxes_holsters_etc.ammo_pickup_001';
export const GUNSLINGER_SFX_BOUNTY = 'coins.decks_and_cards_sound_fx_pack.gold_pouch_handle_001';

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

const grantToken = (
    target: 'self' | 'opponent',
    tokenId: string,
    value: number,
    description: string,
    timing: EffectTiming = 'immediate',
): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target, tokenId, value },
    timing,
});

const inflictStatus = (
    statusId: string,
    value: number,
    description: string,
    timing: EffectTiming = 'immediate',
): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
    timing,
});

const custom = (
    customActionId: string,
    description: string,
    timing: EffectTiming,
    params?: Record<string, unknown>,
): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId, params },
    timing,
});

const REVOLVER: AbilityDef = {
    id: 'revolver',
    name: abilityText('revolver', 'name'),
    type: 'offensive',
    description: abilityText('revolver', 'description'),
    sfxKey: GUNSLINGER_SFX_SHOT,
    variants: [
        {
            id: 'revolver-3',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 3 } },
            effects: [damage(3, abilityEffectText('revolver', 'damage3'))],
            priority: 1,
        },
        {
            id: 'revolver-4',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 4 } },
            effects: [damage(4, abilityEffectText('revolver', 'damage4'))],
            priority: 2,
        },
        {
            id: 'revolver-5',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 5 } },
            effects: [damage(5, abilityEffectText('revolver', 'damage5'))],
            priority: 3,
        },
    ],
};

export const REVOLVER_2: AbilityDef = {
    id: 'revolver',
    name: abilityText('revolver-2', 'name'),
    type: 'offensive',
    description: abilityText('revolver-2', 'description'),
    sfxKey: GUNSLINGER_SFX_SHOT,
    variants: [
        {
            id: 'revolver-2-3',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 3 } },
            effects: [
                damage(4, abilityEffectText('revolver-2', 'damage4')),
                custom('gunslinger-revolver-2-four-kind', abilityEffectText('revolver-2', 'knockdownIfFourKind'), 'preDefense'),
            ],
            priority: 1,
        },
        {
            id: 'revolver-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 4 } },
            effects: [
                damage(5, abilityEffectText('revolver-2', 'damage5')),
                custom('gunslinger-revolver-2-four-kind', abilityEffectText('revolver-2', 'knockdownIfFourKind'), 'preDefense'),
            ],
            priority: 2,
        },
        {
            id: 'revolver-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 5 } },
            effects: [
                damage(6, abilityEffectText('revolver-2', 'damage6')),
                custom('gunslinger-revolver-2-four-kind', abilityEffectText('revolver-2', 'knockdownIfFourKind'), 'preDefense'),
            ],
            priority: 3,
        },
    ],
};

const BOUNTY_HUNTER: AbilityDef = {
    id: 'bounty-hunter',
    name: abilityText('bounty-hunter', 'name'),
    type: 'offensive',
    description: abilityText('bounty-hunter', 'description'),
    sfxKey: GUNSLINGER_SFX_SHOT,
    tags: ['unblockable'],
    trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 2, [FACE.BULLSEYE]: 2 } },
    effects: [
        grantToken('opponent', TOKEN_IDS.BOUNTY, 1, abilityEffectText('bounty-hunter', 'inflictBounty'), 'preDefense'),
        damage(1, abilityEffectText('bounty-hunter', 'damage1Unblockable'), { unblockable: true }),
    ],
};

export const BOUNTY_HUNTER_2: AbilityDef = {
    id: 'bounty-hunter',
    name: abilityText('bounty-hunter-2', 'name'),
    type: 'offensive',
    description: abilityText('bounty-hunter-2', 'description'),
    sfxKey: GUNSLINGER_SFX_SHOT,
    tags: ['unblockable'],
    trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 2, [FACE.BULLSEYE]: 2 } },
    effects: [
        grantToken('opponent', TOKEN_IDS.BOUNTY, 1, abilityEffectText('bounty-hunter-2', 'inflictBounty'), 'preDefense'),
        damage(2, abilityEffectText('bounty-hunter-2', 'damage2Unblockable'), { unblockable: true }),
    ],
};

const QUICK_DRAW: AbilityDef = {
    id: 'quick-draw',
    name: abilityText('quick-draw', 'name'),
    type: 'passive',
    description: abilityText('quick-draw', 'description'),
    trigger: { type: 'phaseStart', phase: 'upkeep' },
    effects: [
        grantToken('self', TOKEN_IDS.LOADED, 1, abilityEffectText('quick-draw', 'gainLoaded')),
    ],
};

export const QUICK_DRAW_UPGRADED: AbilityDef = {
    id: 'quick-draw',
    name: abilityText('quick-draw-2', 'name'),
    type: 'passive',
    description: abilityText('quick-draw-2', 'description'),
    tokenBonusDieReroll: { tokenId: TOKEN_IDS.LOADED, maxRerollCount: 1, scope: 'allTokenUses' },
    trigger: { type: 'phaseStart', phase: 'upkeep' },
    effects: [
        grantToken('self', TOKEN_IDS.LOADED, 1, abilityEffectText('quick-draw-2', 'gainLoaded')),
    ],
};

const TAKE_COVER: AbilityDef = {
    id: 'take-cover',
    name: abilityText('take-cover', 'name'),
    type: 'offensive',
    description: abilityText('take-cover', 'description'),
    sfxKey: GUNSLINGER_SFX_SHOT,
    trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 2, [FACE.DASH]: 3 } },
    effects: [
        grantToken('self', TOKEN_IDS.EVASIVE, 1, abilityEffectText('take-cover', 'gainEvasive'), 'preDefense'),
        damage(5, abilityEffectText('take-cover', 'damage5')),
    ],
};

export const TAKE_COVER_2: AbilityDef = {
    id: 'take-cover',
    name: abilityText('take-cover-2', 'name'),
    type: 'offensive',
    description: abilityText('take-cover-2', 'description'),
    sfxKey: GUNSLINGER_SFX_SHOT,
    variants: [
        {
            id: 'mark-the-target',
            name: abilityText('mark-the-target', 'name'),
            description: abilityText('mark-the-target', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.DASH]: 3 } },
            effects: [
                grantToken('self', TOKEN_IDS.EVASIVE, 2, abilityEffectText('mark-the-target', 'gainEvasive2'), 'preDefense'),
                custom('gunslinger-card-mark-the-target', abilityEffectText('mark-the-target', 'chooseTargetGainBounty'), 'preDefense'),
            ],
            priority: 0,
        },
        {
            id: 'take-cover-2-main',
            name: abilityText('take-cover-2-main', 'name'),
            description: abilityText('take-cover-2-main', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 2, [FACE.DASH]: 3 } },
            effects: [
                grantToken('self', TOKEN_IDS.EVASIVE, 1, abilityEffectText('take-cover-2-main', 'gainEvasive'), 'preDefense'),
                damage(6, abilityEffectText('take-cover-2-main', 'damage6')),
            ],
            priority: 1,
        },
    ],
};

const SHOWDOWN: AbilityDef = {
    id: 'showdown',
    name: abilityText('showdown', 'name'),
    type: 'offensive',
    description: abilityText('showdown', 'description'),
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'smallStraight' },
    effects: [
        custom(
            'gunslinger-showdown-bonus',
            abilityEffectText('showdown', 'bonusRollWin2'),
            'preDefense',
            { bonusDamageOnWin: 2 },
        ),
        damage(5, abilityEffectText('showdown', 'damage5')),
    ],
};

export const SHOWDOWN_2: AbilityDef = {
    id: 'showdown',
    name: abilityText('showdown-2', 'name'),
    type: 'offensive',
    description: abilityText('showdown-2', 'description'),
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'smallStraight' },
    effects: [
        custom(
            'gunslinger-showdown-bonus',
            abilityEffectText('showdown-2', 'bonusRollWin2'),
            'preDefense',
            { bonusDamageOnWin: 2 },
        ),
        damage(6, abilityEffectText('showdown-2', 'damage6')),
    ],
};

export const SHOWDOWN_3: AbilityDef = {
    id: 'showdown',
    name: abilityText('showdown-3', 'name'),
    type: 'offensive',
    description: abilityText('showdown-3', 'description'),
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'smallStraight' },
    effects: [
        custom(
            'gunslinger-showdown-bonus',
            abilityEffectText('showdown-3', 'bonusRollWin3'),
            'preDefense',
            { bonusDamageOnWin: 3 },
        ),
        damage(6, abilityEffectText('showdown-3', 'damage6')),
    ],
};

const DEADEYE: AbilityDef = {
    id: 'deadeye',
    name: abilityText('deadeye', 'name'),
    type: 'offensive',
    description: abilityText('deadeye', 'description'),
    sfxKey: GUNSLINGER_SFX_HEAVY,
    tags: ['unblockable'],
    trigger: { type: 'diceSet', faces: { [FACE.BULLSEYE]: 4 } },
    effects: [
        inflictStatus(STATUS_IDS.KNOCKDOWN, 1, abilityEffectText('deadeye', 'inflictKnockdown'), 'preDefense'),
        damage(6, abilityEffectText('deadeye', 'damage6Unblockable')),
    ],
};

export const DEADEYE_2: AbilityDef = {
    id: 'deadeye',
    name: abilityText('deadeye-2', 'name'),
    type: 'offensive',
    description: abilityText('deadeye-2', 'description'),
    sfxKey: GUNSLINGER_SFX_HEAVY,
    variants: [
        {
            id: 'the-law',
            name: abilityText('the-law', 'name'),
            description: abilityText('the-law', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.BULLSEYE]: 3 } },
            effects: [
                grantToken('self', TOKEN_IDS.EVASIVE, 1, abilityEffectText('the-law', 'gainEvasive'), 'preDefense'),
                custom('gunslinger-card-the-law', abilityEffectText('the-law', 'chooseUpToTwoTargetsGainBountyKnockdown'), 'preDefense'),
            ],
            priority: 0,
        },
        {
            id: 'deadeye-2-main',
            name: abilityText('deadeye-2-main', 'name'),
            description: abilityText('deadeye-2-main', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.BULLSEYE]: 4 } },
            effects: [
                inflictStatus(STATUS_IDS.KNOCKDOWN, 1, abilityEffectText('deadeye-2-main', 'inflictKnockdown'), 'preDefense'),
                damage(8, abilityEffectText('deadeye-2-main', 'damage8Unblockable'), { unblockable: true }),
            ],
            tags: ['unblockable'],
            priority: 1,
        },
    ],
};

const FAN_THE_HAMMER: AbilityDef = {
    id: 'fan-the-hammer',
    name: abilityText('fan-the-hammer', 'name'),
    type: 'offensive',
    description: abilityText('fan-the-hammer', 'description'),
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'largeStraight' },
    effects: [
        grantToken('self', TOKEN_IDS.EVASIVE, 2, abilityEffectText('fan-the-hammer', 'gainEvasive2'), 'preDefense'),
        damage(7, abilityEffectText('fan-the-hammer', 'damage7')),
    ],
};

export const FAN_THE_HAMMER_2: AbilityDef = {
    id: 'fan-the-hammer',
    name: abilityText('fan-the-hammer-2', 'name'),
    type: 'offensive',
    description: abilityText('fan-the-hammer-2', 'description'),
    sfxKey: GUNSLINGER_SFX_HEAVY,
    variants: [
        {
            id: 'pistol-whip',
            name: abilityText('pistol-whip', 'name'),
            description: abilityText('pistol-whip', 'description'),
            trigger: { type: 'diceSet', faces: { [FACE.DASH]: 2, [FACE.BULLSEYE]: 1 } },
            tags: ['unblockable'],
            effects: [
                grantToken('self', TOKEN_IDS.EVASIVE, 1, abilityEffectText('pistol-whip', 'gainEvasive'), 'preDefense'),
                inflictStatus(STATUS_IDS.KNOCKDOWN, 1, abilityEffectText('pistol-whip', 'inflictKnockdown'), 'preDefense'),
                damage(1, abilityEffectText('pistol-whip', 'damage1Unblockable'), { unblockable: true, damageScope: 'direct' }),
            ],
            priority: 0,
        },
        {
            id: 'fan-the-hammer-2-main',
            name: abilityText('fan-the-hammer-2-main', 'name'),
            description: abilityText('fan-the-hammer-2-main', 'description'),
            trigger: { type: 'largeStraight' },
            effects: [
                grantToken('self', TOKEN_IDS.EVASIVE, 2, abilityEffectText('fan-the-hammer-2-main', 'gainEvasive2'), 'preDefense'),
                damage(8, abilityEffectText('fan-the-hammer-2-main', 'damage8')),
            ],
            priority: 1,
        },
    ],
};

const DUEL: AbilityDef = {
    id: 'duel',
    name: abilityText('duel', 'name'),
    type: 'defensive',
    description: abilityText('duel', 'description'),
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 1 },
    effects: [
        custom(
            'gunslinger-duel-resolve',
            abilityEffectText('duel', 'resolveDefense'),
            'withDamage',
            { winOnTie: false },
        ),
    ],
};

export const DUEL_2: AbilityDef = {
    id: 'duel',
    name: abilityText('duel-2', 'name'),
    type: 'defensive',
    description: abilityText('duel-2', 'description'),
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 1 },
    effects: [
        custom(
            'gunslinger-duel-resolve',
            abilityEffectText('duel-2', 'resolveDefense'),
            'withDamage',
            { winOnTie: true },
        ),
    ],
};

const FILL_EM_WITH_LEAD: AbilityDef = {
    id: 'fill-em-with-lead',
    name: abilityText('fill-em-with-lead', 'name'),
    type: 'offensive',
    tags: ['ultimate'],
    description: abilityText('fill-em-with-lead', 'description'),
    tokenBonusDieReroll: { tokenId: TOKEN_IDS.LOADED, maxRerollCount: 1 },
    sfxKey: GUNSLINGER_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.BULLSEYE]: 5 } },
    effects: [
        grantToken('self', TOKEN_IDS.EVASIVE, 1, abilityEffectText('fill-em-with-lead', 'gainEvasive'), 'preDefense'),
        grantToken('opponent', TOKEN_IDS.BOUNTY, 1, abilityEffectText('fill-em-with-lead', 'inflictBounty'), 'preDefense'),
        inflictStatus(STATUS_IDS.KNOCKDOWN, 1, abilityEffectText('fill-em-with-lead', 'inflictKnockdown'), 'preDefense'),
        damage(10, abilityEffectText('fill-em-with-lead', 'damage10Unblockable')),
    ],
};

export const GUNSLINGER_ABILITIES: AbilityDef[] = [
    REVOLVER,
    BOUNTY_HUNTER,
    QUICK_DRAW,
    TAKE_COVER,
    SHOWDOWN,
    DEADEYE,
    FAN_THE_HAMMER,
    DUEL,
    FILL_EM_WITH_LEAD,
];
