import { abilityEffectText, abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { TREANT_DICE_FACE_IDS, TOKEN_IDS } from '../../domain/ids';

const FACE = TREANT_DICE_FACE_IDS;

export const TREANT_SFX_LIGHT = 'magic.general.simple_magic_sound_fx_pack_vol.earth.earthen_grasp';
export const TREANT_SFX_GROWTH = 'magic.general.simple_magic_sound_fx_pack_vol.nature.natural_healing';
export const TREANT_SFX_HEAVY = 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_01_krst';
export const TREANT_SFX_ULTIMATE = 'magic.general.simple_magic_sound_fx_pack_vol.earth.earthmeld';

const damage = (value: number, description: string, opts?: { timing?: EffectTiming; unblockable?: boolean; damageScope?: 'attack' | 'direct' }): AbilityEffect => ({
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

const grantToken = (target: 'self' | 'opponent', tokenId: string, value: number, description: string, timing: EffectTiming = 'preDefense'): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target, tokenId, value },
    timing,
});

const drawCard = (count: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'drawCard', target: 'self', drawCount: count },
    timing: 'preDefense',
});

const customEffect = (
    customActionId: string,
    target: 'self' | 'opponent',
    description: string,
    timing: EffectTiming = 'preDefense',
): AbilityEffect => ({
    description,
    action: { type: 'custom', target, customActionId },
    timing,
});

const natureTouchCultivate = (description: string): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId: 'treant-nature-touch-cultivate' },
    timing: 'preDefense',
});

const tendCareResolve = (cultivateAmount: number, description: string): AbilityEffect => ({
    description,
    action: {
        type: 'custom',
        target: 'self',
        customActionId: 'treant-tend-care-choice',
        cultivateAmount,
    },
    timing: 'preDefense',
});

const forestAwakensResolve = (description: string): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId: 'treant-forest-awakens-choice' },
    timing: 'preDefense',
});

const shatteringFistChoice = (description: string): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId: 'treant-shattering-fist-choice' },
    timing: 'preDefense',
});

const shatteringFistCultivate = (description: string): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId: 'treant-shattering-fist-3-cultivate' },
    timing: 'preDefense',
});

const quietCultivationResolve = (description: string): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId: 'treant-quiet-cultivation' },
    timing: 'immediate',
});

const SHATTERING_FIST: AbilityDef = {
    id: 'shattering-fist',
    name: abilityText('shattering-fist', 'name'),
    type: 'offensive',
    description: abilityText('shattering-fist', 'description'),
    sfxKey: TREANT_SFX_HEAVY,
    variants: [
        { id: 'shattering-fist-3', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 3 } }, effects: [shatteringFistChoice(abilityEffectText('shattering-fist', 'removeSpiritToInflictThorn')), damage(5, abilityEffectText('shattering-fist', 'damage5'))], priority: 1 },
        { id: 'shattering-fist-4', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 4 } }, effects: [shatteringFistChoice(abilityEffectText('shattering-fist', 'removeSpiritToInflictThorn')), damage(6, abilityEffectText('shattering-fist', 'damage6'))], priority: 2 },
        { id: 'shattering-fist-5', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 5 } }, effects: [shatteringFistChoice(abilityEffectText('shattering-fist', 'removeSpiritToInflictThorn')), damage(7, abilityEffectText('shattering-fist', 'damage7'))], priority: 3 },
    ],
};

export const SHATTERING_FIST_2: AbilityDef = {
    ...SHATTERING_FIST,
    name: abilityText('shattering-fist-2', 'name'),
    description: abilityText('shattering-fist-2', 'description'),
    variants: [
        { id: 'shattering-fist-2-3', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 3 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, abilityEffectText('shattering-fist-2', 'inflictThorn')), damage(5, abilityEffectText('shattering-fist-2', 'damage5'))], priority: 1 },
        { id: 'shattering-fist-2-4', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 4 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, abilityEffectText('shattering-fist-2', 'inflictThorn')), damage(6, abilityEffectText('shattering-fist-2', 'damage6'))], priority: 2 },
        { id: 'shattering-fist-2-5', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 5 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, abilityEffectText('shattering-fist-2', 'inflictThorn')), damage(7, abilityEffectText('shattering-fist-2', 'damage7'))], priority: 3 },
    ],
};

export const SHATTERING_FIST_3: AbilityDef = {
    ...SHATTERING_FIST,
    name: abilityText('shattering-fist-3', 'name'),
    description: abilityText('shattering-fist-3', 'description'),
    variants: [
        { id: 'shattering-fist-3-3', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 3 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, abilityEffectText('shattering-fist-3', 'inflictThorn')), shatteringFistCultivate(abilityEffectText('shattering-fist-3', 'cultivateIfThreeKind')), damage(5, abilityEffectText('shattering-fist-3', 'damage5'))], priority: 1 },
        { id: 'shattering-fist-3-4', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 4 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, abilityEffectText('shattering-fist-3', 'inflictThorn')), shatteringFistCultivate(abilityEffectText('shattering-fist-3', 'cultivateIfThreeKind')), damage(6, abilityEffectText('shattering-fist-3', 'damage6'))], priority: 2 },
        { id: 'shattering-fist-3-5', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 5 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, abilityEffectText('shattering-fist-3', 'inflictThorn')), shatteringFistCultivate(abilityEffectText('shattering-fist-3', 'cultivateIfThreeKind')), damage(7, abilityEffectText('shattering-fist-3', 'damage7'))], priority: 3 },
    ],
};

const TEND_CARE: AbilityDef = {
    id: 'tend-care',
    name: abilityText('tend-care', 'name'),
    type: 'utility',
    description: abilityText('tend-care', 'description'),
    sfxKey: TREANT_SFX_GROWTH,
    trigger: { type: 'diceSet', faces: { [FACE.LEAF]: 2, [FACE.SPIRIT]: 2 } },
    effects: [
        drawCard(1, abilityEffectText('tend-care', 'draw1')),
        tendCareResolve(3, abilityEffectText('tend-care', 'cultivate3ChooseLifeSapAndThorn')),
    ],
};

export const TEND_CARE_2: AbilityDef = {
    ...TEND_CARE,
    name: abilityText('tend-care-2', 'name'),
    description: abilityText('tend-care-2', 'description'),
    variants: [
        {
            id: 'tend-care-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.LEAF]: 2, [FACE.SPIRIT]: 2 } },
            effects: [
                drawCard(1, abilityEffectText('tend-care-2', 'draw1')),
                tendCareResolve(4, abilityEffectText('tend-care-2', 'cultivate4ChooseLifeSapAndThorn')),
            ],
            priority: 1,
        },
        {
            id: 'tend-care-2-cultivate',
            trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 2, [FACE.SPIRIT]: 2 } },
            effects: [
                customEffect('treant-tend-care-2-cultivate', 'self', abilityEffectText('tend-care-2', 'cultivate6')),
            ],
            priority: 0,
        },
    ],
};

const VENGEFUL_VINES: AbilityDef = {
    id: 'vengeful-vines',
    name: abilityText('vengeful-vines', 'name'),
    type: 'offensive',
    description: abilityText('vengeful-vines', 'description'),
    sfxKey: TREANT_SFX_LIGHT,
    trigger: { type: 'smallStraight' },
    effects: [
        grantToken('opponent', TOKEN_IDS.THORN, 1, abilityEffectText('vengeful-vines', 'inflictThorn')),
        damage(7, abilityEffectText('vengeful-vines', 'damage7')),
    ],
};

export const VENGEFUL_VINES_2: AbilityDef = {
    ...VENGEFUL_VINES,
    name: abilityText('vengeful-vines-2', 'name'),
    description: abilityText('vengeful-vines-2', 'description'),
    variants: [
        {
            id: 'vengeful-vines-2-main',
            trigger: { type: 'smallStraight' },
            effects: [
                grantToken('opponent', TOKEN_IDS.THORN, 1, abilityEffectText('vengeful-vines-2', 'inflictThorn')),
                damage(8, abilityEffectText('vengeful-vines-2', 'damage8')),
            ],
            priority: 1,
        },
        {
            id: 'vengeful-vines-2-pain',
            trigger: { type: 'diceSet', faces: { [FACE.LEAF]: 3 } },
            effects: [
                customEffect('treant-vengeful-vines-2-pain', 'opponent', abilityEffectText('vengeful-vines-2', 'dealDamagePerSpirit')),
            ],
            priority: 0,
        },
    ],
};

const NATURE_TOUCH: AbilityDef = {
    id: 'nature-touch',
    name: abilityText('nature-touch', 'name'),
    type: 'offensive',
    tags: ['unblockable'],
    description: abilityText('nature-touch', 'description'),
    sfxKey: TREANT_SFX_GROWTH,
    trigger: { type: 'diceSet', faces: { [FACE.SPIRIT]: 4 } },
    effects: [
        natureTouchCultivate(abilityEffectText('nature-touch', 'cultivate2ThenBonusDamage')),
        damage(5, abilityEffectText('nature-touch', 'damage5Unblockable'), { unblockable: true }),
    ],
};

export const NATURE_TOUCH_2: AbilityDef = {
    ...NATURE_TOUCH,
    name: abilityText('nature-touch-2', 'name'),
    description: abilityText('nature-touch-2', 'description'),
    variants: [
        {
            id: 'nature-touch-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.SPIRIT]: 4 } },
            tags: ['unblockable'],
            effects: [
                natureTouchCultivate(abilityEffectText('nature-touch-2', 'cultivate2ThenBonusDamage')),
                damage(6, abilityEffectText('nature-touch-2', 'damage6Unblockable'), { unblockable: true }),
            ],
            priority: 1,
        },
        {
            id: 'nature-touch-2-mercy',
            trigger: { type: 'diceSet', faces: { [FACE.SPIRIT]: 3 } },
            effects: [
                customEffect('treant-nature-touch-2-mercy', 'self', abilityEffectText('nature-touch-2', 'heal1Gain1CpDraw1Cultivate1')),
            ],
            priority: 0,
        },
    ],
};

const QUIET_CULTIVATION: AbilityDef = {
    id: 'quiet-cultivation',
    name: abilityText('quiet-cultivation', 'name'),
    type: 'passive',
    description: abilityText('quiet-cultivation', 'description'),
    trigger: { type: 'phaseStart', phase: 'upkeep' },
    effects: [quietCultivationResolve(abilityEffectText('quiet-cultivation', 'upkeepCultivate1'))],
};

const WILD_GROWTH: AbilityDef = {
    id: 'wild-growth',
    name: abilityText('wild-growth', 'name'),
    type: 'offensive',
    description: abilityText('wild-growth', 'description'),
    sfxKey: TREANT_SFX_GROWTH,
    trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 2, [FACE.LEAF]: 3 } },
    effects: [
        {
            description: abilityEffectText('wild-growth', 'removeUpTo2SpiritsForDamageAndSpendLifeSap'),
            action: { type: 'custom', target: 'self', customActionId: 'treant-wild-growth-choice' },
            timing: 'preDefense',
        },
        damage(2, abilityEffectText('wild-growth', 'damage2')),
    ],
};

export const WILD_GROWTH_2: AbilityDef = {
    id: 'wild-growth',
    name: abilityText('wild-growth-2', 'name'),
    type: 'offensive',
    description: abilityText('wild-growth-2', 'description'),
    sfxKey: TREANT_SFX_GROWTH,
    variants: [
        {
            id: 'wild-growth-2-main',
            trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 2, [FACE.LEAF]: 3 } },
            effects: [
                customEffect('treant-wild-growth-2-main', 'opponent', abilityEffectText('wild-growth-2', 'roll5BranchLeafSpirit')),
                damage(4, abilityEffectText('wild-growth-2', 'damage4')),
            ],
            priority: 1,
        },
        {
            id: 'wild-growth-2-dazzle',
            trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 2, [FACE.SPIRIT]: 2 } },
            tags: ['unblockable'],
            effects: [
                grantToken('opponent', TOKEN_IDS.THORN, 1, abilityEffectText('wild-growth-2-dazzle', 'inflictThorn')),
                damage(4, abilityEffectText('wild-growth-2-dazzle', 'damage4Unblockable'), { unblockable: true }),
            ],
            priority: 0,
        },
    ],
};

const WILD_ROAR: AbilityDef = {
    id: 'wild-roar',
    name: abilityText('wild-roar', 'name'),
    type: 'offensive',
    description: abilityText('wild-roar', 'description'),
    sfxKey: TREANT_SFX_GROWTH,
    trigger: { type: 'largeStraight' },
    effects: [
        customEffect('treant-wild-growth-2-main', 'opponent', abilityEffectText('wild-roar', 'roll5BranchLeafSpirit')),
        damage(6, abilityEffectText('wild-roar', 'damage6')),
    ],
};

export const WILD_ROAR_2: AbilityDef = {
    ...WILD_ROAR,
    name: abilityText('wild-roar-2', 'name'),
    description: abilityText('wild-roar-2', 'description'),
    effects: [
        customEffect('treant-wild-growth-2-main', 'opponent', abilityEffectText('wild-roar-2', 'roll5BranchLeafSpirit')),
        damage(8, abilityEffectText('wild-roar-2', 'damage8')),
    ],
};

const ROOTED: AbilityDef = {
    id: 'rooted',
    name: abilityText('rooted', 'name'),
    type: 'defensive',
    tags: ['defensive'],
    description: abilityText('rooted', 'description'),
    sfxKey: TREANT_SFX_HEAVY,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 3 },
    effects: [
        {
            description: abilityEffectText('rooted', 'resolveDefense'),
            action: {
                type: 'custom',
                target: 'self',
                diceCount: 3,
                customActionId: 'treant-rooted-defense',
            },
            timing: 'withDamage',
        },
    ],
};

export const ROOTED_2: AbilityDef = {
    ...ROOTED,
    name: abilityText('rooted-2', 'name'),
    description: abilityText('rooted-2', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
    effects: [
        {
            description: abilityEffectText('rooted-2', 'resolveDefense'),
            action: {
                type: 'custom',
                target: 'self',
                diceCount: 4,
                customActionId: 'treant-rooted-defense',
            },
            timing: 'withDamage',
        },
    ],
};

const FOREST_AWAKENS: AbilityDef = {
    id: 'forest-awakens',
    name: abilityText('forest-awakens', 'name'),
    type: 'offensive',
    tags: ['ultimate', 'uninterruptible'],
    description: abilityText('forest-awakens', 'description'),
    sfxKey: TREANT_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.SPIRIT]: 5 } },
    effects: [
        forestAwakensResolve(abilityEffectText('forest-awakens', 'choosePlayersCultivateAndThorn')),
        damage(10, abilityEffectText('forest-awakens', 'damage10')),
    ],
};

export const TREANT_ABILITIES: AbilityDef[] = [
    SHATTERING_FIST,
    TEND_CARE,
    VENGEFUL_VINES,
    NATURE_TOUCH,
    QUIET_CULTIVATION,
    WILD_GROWTH,
    WILD_ROAR,
    ROOTED,
    FOREST_AWAKENS,
];
