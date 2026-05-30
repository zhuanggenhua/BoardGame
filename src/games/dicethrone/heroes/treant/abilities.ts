import { abilityText } from '../../../../engine/primitives/ability';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { TREANT_DICE_FACE_IDS, TOKEN_IDS } from '../../domain/ids';

const FACE = TREANT_DICE_FACE_IDS;

export const TREANT_SFX_LIGHT = 'magic.general.simple_magic_sound_fx_pack_vol.earth.earth_magic_impact';
export const TREANT_SFX_GROWTH = 'magic.general.simple_magic_sound_fx_pack_vol.nature.heal_nature';
export const TREANT_SFX_HEAVY = 'combat.general.forged_in_fury_vol_1.body_impact.body_impact_heavy';
export const TREANT_SFX_ULTIMATE = 'magic.general.simple_magic_sound_fx_pack_vol.earth.earth_magic_cast';

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
        { id: 'shattering-fist-3', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 3 } }, effects: [shatteringFistChoice('可弃掉 1 树灵施加刺藤。'), damage(5, '造成 5 点伤害。')], priority: 1 },
        { id: 'shattering-fist-4', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 4 } }, effects: [shatteringFistChoice('可弃掉 1 树灵施加刺藤。'), damage(6, '造成 6 点伤害。')], priority: 2 },
        { id: 'shattering-fist-5', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 5 } }, effects: [shatteringFistChoice('可弃掉 1 树灵施加刺藤。'), damage(7, '造成 7 点伤害。')], priority: 3 },
    ],
};

export const SHATTERING_FIST_2: AbilityDef = {
    ...SHATTERING_FIST,
    name: abilityText('shattering-fist-2', 'name'),
    description: abilityText('shattering-fist-2', 'description'),
    variants: [
        { id: 'shattering-fist-2-3', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 3 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, '对手获得 1 个刺藤。'), damage(5, '造成 5 点伤害。')], priority: 1 },
        { id: 'shattering-fist-2-4', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 4 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, '对手获得 1 个刺藤。'), damage(6, '造成 6 点伤害。')], priority: 2 },
        { id: 'shattering-fist-2-5', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 5 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, '对手获得 1 个刺藤。'), damage(7, '造成 7 点伤害。')], priority: 3 },
    ],
};

export const SHATTERING_FIST_3: AbilityDef = {
    ...SHATTERING_FIST,
    name: abilityText('shattering-fist-3', 'name'),
    description: abilityText('shattering-fist-3', 'description'),
    variants: [
        { id: 'shattering-fist-3-3', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 3 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, '对手获得 1 个刺藤。'), shatteringFistCultivate('若投出 3 个相同数字，养成 1 树灵。'), damage(5, '造成 5 点伤害。')], priority: 1 },
        { id: 'shattering-fist-3-4', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 4 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, '对手获得 1 个刺藤。'), shatteringFistCultivate('若投出 3 个相同数字，养成 1 树灵。'), damage(6, '造成 6 点伤害。')], priority: 2 },
        { id: 'shattering-fist-3-5', trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 5 } }, effects: [grantToken('opponent', TOKEN_IDS.THORN, 1, '对手获得 1 个刺藤。'), shatteringFistCultivate('若投出 3 个相同数字，养成 1 树灵。'), damage(7, '造成 7 点伤害。')], priority: 3 },
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
        drawCard(1, '抽 1 张牌。'),
        tendCareResolve(3, '养成 3 树灵；选择 1 名玩家获得生命源泉；选择 1 名对手施加刺藤。'),
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
                drawCard(1, '抽 1 张牌。'),
                tendCareResolve(4, '养成 4 树灵；选择 1 名玩家获得生命源泉；选择 1 名对手施加刺藤。'),
            ],
            priority: 1,
        },
        {
            id: 'tend-care-2-cultivate',
            trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 2, [FACE.SPIRIT]: 2 } },
            effects: [
                customEffect('treant-tend-care-2-cultivate', 'self', '养成 6 树灵。'),
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
        grantToken('opponent', TOKEN_IDS.THORN, 1, '对手获得 1 个刺藤。'),
        damage(7, '造成 7 点伤害。'),
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
                grantToken('opponent', TOKEN_IDS.THORN, 1, '对手获得 1 个刺藤。'),
                damage(8, '造成 8 点伤害。'),
            ],
            priority: 1,
        },
        {
            id: 'vengeful-vines-2-pain',
            trigger: { type: 'diceSet', faces: { [FACE.LEAF]: 3 } },
            effects: [
                customEffect('treant-vengeful-vines-2-pain', 'opponent', '每有 1 个树灵，造成 1 点真实伤害。'),
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
        natureTouchCultivate('养成 2 树灵，并按养成后的树灵数量增加伤害。'),
        damage(5, '造成 5 点不可防御伤害。', { unblockable: true }),
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
                natureTouchCultivate('养成 2 树灵，并按养成后的树灵数量增加伤害。'),
                damage(6, '造成 6 点不可防御伤害。', { unblockable: true }),
            ],
            priority: 1,
        },
        {
            id: 'nature-touch-2-mercy',
            trigger: { type: 'diceSet', faces: { [FACE.SPIRIT]: 3 } },
            effects: [
                customEffect('treant-nature-touch-2-mercy', 'self', '治疗 1；获得 1 CP；抽 1 张牌；养成 1 树灵。'),
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
    effects: [quietCultivationResolve('维持阶段养成 1 树灵。')],
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
            description: '可移除至多 2 树灵加伤，并可弃生命源泉使攻击不可防御。',
            action: { type: 'custom', target: 'self', customActionId: 'treant-wild-growth-choice' },
            timing: 'preDefense',
        },
        damage(2, '造成 2 点伤害。'),
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
            trigger: { type: 'largeStraight' },
            effects: [
                customEffect('treant-wild-growth-2-main', 'opponent', '造成 8 点伤害并投掷 5 骰；每个树枝 +1 伤害；若投出树叶，获得生命源泉；每个螺旋养成 1 次树灵。'),
                damage(8, '造成 8 点伤害。'),
            ],
            priority: 1,
        },
        {
            id: 'wild-growth-2-dazzle',
            trigger: { type: 'diceSet', faces: { [FACE.BRANCH]: 2, [FACE.SPIRIT]: 2 } },
            tags: ['unblockable'],
            effects: [
                grantToken('opponent', TOKEN_IDS.THORN, 1, '对手获得 1 个刺藤。'),
                damage(4, '造成 4 点不可防御伤害。', { unblockable: true }),
            ],
            priority: 0,
        },
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
            description: '防御掷骰：树枝与树灵防止伤害；双树叶养成；双树灵选择玩家获得生命源泉。',
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
            description: '防御掷 4 骰：树枝与树灵防止伤害；双树叶养成；双树灵选择玩家获得生命源泉。',
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
        forestAwakensResolve('你和 1 名队友获得生命源泉；养成 5 树灵；施加刺藤。'),
        damage(10, '造成 10 点伤害。'),
    ],
};

export const TREANT_ABILITIES: AbilityDef[] = [
    SHATTERING_FIST,
    TEND_CARE,
    VENGEFUL_VINES,
    NATURE_TOUCH,
    QUIET_CULTIVATION,
    WILD_GROWTH,
    ROOTED,
    FOREST_AWAKENS,
];
