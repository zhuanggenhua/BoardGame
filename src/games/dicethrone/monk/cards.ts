/**
 * 僧侣英雄的手牌定义
 * 完整33张手牌配置
 */

import type { AbilityCard } from '../types';
import type { RandomFn } from '../../../engine/types';
import type { AbilityEffect, AbilityDef } from '../../../systems/AbilitySystem';

// 辅助函数：创建伤害效果
// 注意：不指定 timing，让系统使用默认的 withDamage 时机
const damage = (value: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'damage', target: 'opponent', value },
});

import type { EffectTiming, EffectCondition } from '../../../systems/AbilitySystem';


// 辅助函数：创建 Token 效果（给自己，用于太极、闪避、净化）
const grantToken = (
    tokenId: string,
    value: number,
    description: string,
    opts?: { timing?: EffectTiming; condition?: EffectCondition }
): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value },
    timing: opts?.timing,
    condition: opts?.condition,
});

// 辅助函数：抽卡效果
const drawCards = (count: number, description: string): AbilityEffect => ({
    description,
    action: { type: 'drawCard', target: 'self', drawCount: count },
    timing: 'immediate',
});

// 辅助函数：给对手施加状态效果（如倒地/眩晕）
const inflictStatus = (
    statusId: string,
    value: number,
    description: string,
    opts?: { timing?: EffectTiming; condition?: EffectCondition }
): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
    // 卡牌效果默认立即生效（否则会走 AbilitySystem 的默认时机并被过滤掉）
    timing: opts?.timing ?? 'immediate',
    condition: opts?.condition,
});

// 辅助函数：授予伤害护盾（下次受伤时消耗）
const grantDamageShield = (
    value: number,
    description: string,
    target: 'self' | 'opponent' = 'self'
): AbilityEffect => ({
    description,
    action: { type: 'grantDamageShield', target, shieldValue: value },
    timing: 'immediate',
});


// 辅助函数：创建 replaceAbility 效果
const replaceAbility = (
    targetAbilityId: string,
    newAbilityDef: AbilityDef,
    newAbilityLevel: number,
    description: string
): AbilityEffect => ({
    description,
    action: { type: 'replaceAbility', target: 'self', targetAbilityId, newAbilityDef, newAbilityLevel },
    timing: 'immediate',
});

// 文本辅助
const abilityText = (id: string, field: 'name' | 'description') => `abilities.${id}.${field}`;
const abilityEffectText = (id: string, field: string) => `abilities.${id}.effects.${field}`;

// ============================================
// 升级后的技能定义
// ============================================

// 拳法 II（升级自 fist-technique）
// 基于卡牌图片：7/8/9 伤害（与 III 级相同，但没有倒地效果）
const FIST_TECHNIQUE_2: AbilityDef = {
    id: 'fist-technique', // 保持原 ID 以维护 UI 槽位映射
    name: abilityText('fist-technique-2', 'name'),
    type: 'offensive',
    description: abilityText('fist-technique-2', 'description'),
    variants: [
        {
            id: 'fist-technique-2-3',
            trigger: { type: 'diceSet', faces: { fist: 3 } },
            effects: [damage(7, abilityEffectText('fist-technique-2-3', 'damage7'))],
            priority: 1,
        },
        {
            id: 'fist-technique-2-4',
            trigger: { type: 'diceSet', faces: { fist: 4 } },
            effects: [damage(8, abilityEffectText('fist-technique-2-4', 'damage8'))],
            priority: 2,
        },
        {
            id: 'fist-technique-2-5',
            trigger: { type: 'diceSet', faces: { fist: 5 } },
            effects: [damage(9, abilityEffectText('fist-technique-2-5', 'damage9'))],
            priority: 3,
        },
    ],
};

// 拳法 III（升级自 fist-technique-2）
// 基于卡牌图片：7/8/9 伤害，4个相同数字施加倒地
const FIST_TECHNIQUE_3: AbilityDef = {
    id: 'fist-technique',
    name: abilityText('fist-technique-3', 'name'),
    type: 'offensive',
    description: abilityText('fist-technique-3', 'description'),
    variants: [
        {
            id: 'fist-technique-3-3',
            trigger: { type: 'diceSet', faces: { fist: 3 } },
            effects: [damage(7, abilityEffectText('fist-technique-3-3', 'damage7'))],
            priority: 1,
        },
        {
            id: 'fist-technique-3-4',
            trigger: { type: 'diceSet', faces: { fist: 4 } },
            effects: [
                damage(8, abilityEffectText('fist-technique-3-4', 'damage8')),
                inflictStatus('stun', 1, abilityEffectText('fist-technique-3-4', 'inflictStun')),
            ],
            priority: 2,
        },
        {
            id: 'fist-technique-3-5',
            trigger: { type: 'diceSet', faces: { fist: 5 } },
            effects: [
                damage(9, abilityEffectText('fist-technique-3-5', 'damage9')),
                inflictStatus('stun', 1, abilityEffectText('fist-technique-3-5', 'inflictStun')),
            ],
            priority: 3,
        },
    ],
};

// 清修 II（升级自 meditation）
const MEDITATION_2: AbilityDef = {
    id: 'meditation',
    name: abilityText('meditation-2', 'name'),
    type: 'defensive',
    description: abilityText('meditation-2', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        { description: abilityEffectText('meditation-2', 'taijiByResult'), action: { type: 'custom', target: 'self', customActionId: 'meditation-2-taiji' }, timing: 'withDamage' },
        { description: abilityEffectText('meditation-2', 'damageByFist'), action: { type: 'custom', target: 'opponent', customActionId: 'meditation-2-damage' }, timing: 'withDamage' },
    ],
};

// 清修 III（升级自 meditation-2）
const MEDITATION_3: AbilityDef = {
    id: 'meditation',
    name: abilityText('meditation-3', 'name'),
    type: 'defensive',
    description: abilityText('meditation-3', 'description'),
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 },
    effects: [
        { description: abilityEffectText('meditation-3', 'taijiByResult'), action: { type: 'custom', target: 'self', customActionId: 'meditation-3-taiji' }, timing: 'withDamage' },
        { description: abilityEffectText('meditation-3', 'damageByFist'), action: { type: 'custom', target: 'opponent', customActionId: 'meditation-3-damage' }, timing: 'withDamage' },
    ],
};

// 花开见佛 II（升级自 lotus-palm）
// 描述: 4莲花触发：造成6不可防御伤害，然后气的堆叠上限提升1，并获得6气
//       莲花之道（3莲花触发）：造成2不可防御伤害，然后获得闪避和2气
const LOTUS_PALM_2: AbilityDef = {
    id: 'lotus-palm',
    name: abilityText('lotus-palm-2', 'name'),
    type: 'offensive',
    description: abilityText('lotus-palm-2', 'description'),
    tags: ['unblockable'],
    variants: [
        // 莲花之道（3莲花触发）- 最低优先级
        {
            id: 'lotus-palm-2-3',
            trigger: { type: 'diceSet', faces: { lotus: 3 } },
            effects: [
                damage(2, abilityEffectText('lotus-palm-2-3', 'damage2')),
                grantToken('evasive', 1, abilityEffectText('lotus-palm-2-3', 'gainEvasive'), {
                    timing: 'postDamage',
                    condition: { type: 'onHit' },
                }),
                grantToken('taiji', 2, abilityEffectText('lotus-palm-2-3', 'gainTaiji2'), {
                    timing: 'postDamage',
                    condition: { type: 'onHit' },
                }),
            ],
            priority: 0,
        },
        // 4莲花触发 - 中优先级
        {
            id: 'lotus-palm-2-4',
            trigger: { type: 'diceSet', faces: { lotus: 4 } },
            effects: [
                damage(6, abilityEffectText('lotus-palm-2-4', 'damage6')),
                // 获得太极 Token：onHit 条件 + postDamage 时机，获得6气
                grantToken('taiji', 6, abilityEffectText('lotus-palm-2-4', 'taijiCapMax'), {
                    timing: 'postDamage',
                    condition: { type: 'onHit' },
                }),
            ],
            priority: 1,
        },
        // 5莲花触发 - 最高优先级
        {
            id: 'lotus-palm-2-5',
            trigger: { type: 'diceSet', faces: { lotus: 5 } },
            effects: [
                damage(10, abilityEffectText('lotus-palm-2-5', 'damage10')),
                grantToken('taiji', 6, abilityEffectText('lotus-palm-2-5', 'taijiCapMax'), {
                    timing: 'postDamage',
                    condition: { type: 'onHit' },
                }),
            ],
            priority: 2,
        },
    ],
};

// 太极连环拳 II（升级自 taiji-combo）
// 描述: 造成5伤害并投掷2骰。增加2×拳伤害，增加3×掌伤害。获得2×太极的气。每投出1个莲花，获得闪避或净化
const TAIJI_COMBO_2: AbilityDef = {
    id: 'taiji-combo',
    name: abilityText('taiji-combo-2', 'name'),
    type: 'offensive',
    description: abilityText('taiji-combo-2', 'description'),
    trigger: { type: 'diceSet', faces: { fist: 3, palm: 1 } },
    effects: [
        {
            description: abilityEffectText('taiji-combo-2', 'rollDie'),
            action: {
                type: 'rollDie',
                target: 'self',
                diceCount: 2, // 投掷2骰
                conditionalEffects: [
                    { face: 'fist', bonusDamage: 2 },  // 增加2×拳伤害
                    { face: 'palm', bonusDamage: 3 },  // 增加3×掌伤害
                    { face: 'taiji', grantToken: { tokenId: 'taiji', value: 2 } }, // 获得2×太极的气
                    {
                        face: 'lotus',
                        triggerChoice: {
                            titleKey: 'choices.evasiveOrPurifyToken',
                            options: [
                                { tokenId: 'evasive', value: 1 },
                                { tokenId: 'purify', value: 1 },
                            ],
                        },
                    },
                ],
            },
            timing: 'withDamage',
        },
        damage(5, abilityEffectText('taiji-combo-2', 'damage5')), // 造成5伤害
    ],
};

// 雷霆一击 II（升级自 thunder-strike）
// 描述: 投掷3骰，造成等同于投掷结果总和的伤害。可花费1个气重掷其中一颗。如果投掷结果>=12，施加倒地
const THUNDER_STRIKE_2: AbilityDef = {
    id: 'thunder-strike',
    name: abilityText('thunder-strike-2', 'name'),
    type: 'offensive',
    description: abilityText('thunder-strike-2', 'description'),
    trigger: { type: 'diceSet', faces: { palm: 3 } },
    effects: [
        {
            description: abilityEffectText('thunder-strike-2', 'roll3Damage'),
            action: { type: 'custom', target: 'opponent', customActionId: 'thunder-strike-2-roll-damage' },
            timing: 'withDamage',
        },
        { description: abilityEffectText('thunder-strike-2', 'rerollOne') },
    ],
};

// 定水神拳 II（升级自 calm-water）
const CALM_WATER_2: AbilityDef = {
    id: 'calm-water',
    name: abilityText('calm-water-2', 'name'),
    type: 'offensive',
    description: abilityText('calm-water-2', 'description'),
    trigger: { type: 'largeStraight' },
    effects: [
        damage(9, abilityEffectText('calm-water-2', 'damage9')),
        // 获得太极 Token：onHit 条件 + postDamage 时机
        grantToken('taiji', 3, abilityEffectText('calm-water-2', 'gainTaiji3'), {
            timing: 'postDamage',
            condition: { type: 'onHit' },
        }),
        grantToken('evasive', 1, abilityEffectText('calm-water-2', 'gainEvasive'), {
            timing: 'postDamage',
            condition: { type: 'onHit' },
        }),
    ],
};

// 和谐之力 II（升级自 harmony）
// 描述: 小顺子触发：造成6伤害，然后获得3气
const HARMONY_2: AbilityDef = {
    id: 'harmony',
    name: abilityText('harmony-2', 'name'),
    type: 'offensive',
    description: abilityText('harmony-2', 'description'),
    trigger: { type: 'smallStraight' },
    effects: [
        damage(6, abilityEffectText('harmony-2', 'damage6')), // 造成6伤害
        // 获得太极 Token：onHit 条件 + postDamage 时机
        grantToken('taiji', 3, abilityEffectText('harmony-2', 'gainTaiji3'), {
            timing: 'postDamage',
            condition: { type: 'onHit' },
        }),
    ],
};

// 禅忘 II（升级自 zen-forget）
// 描述: 3太极触发：获得6气，获得闪避和净化
const ZEN_FORGET_2: AbilityDef = {
    id: 'zen-forget',
    name: abilityText('zen-forget-2', 'name'),
    type: 'offensive',
    description: abilityText('zen-forget-2', 'description'),
    trigger: { type: 'diceSet', faces: { taiji: 3 } },
    effects: [
        grantToken('taiji', 6, abilityEffectText('zen-forget-2', 'gainTaiji6')), // 获得6气
        grantToken('evasive', 1, abilityEffectText('zen-forget-2', 'gainEvasive')),
        grantToken('purify', 1, abilityEffectText('zen-forget-2', 'gainPurify')),
    ],
};

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

/**
 * 卡牌时机颜色对应
 * - main (蓝色): 仅在 Main Phase 1/2 打出
 * - roll (橙色): 在掷骰阶段打出
 * - instant (红色): 任意时机打出
 * 
 * 卡牌类型
 * - action: 行动卡（打出后进入弃牌堆）
 * - upgrade: 升级卡（永久升级英雄能力）
 */

/**
 * 僧侣手牌定义
 * atlasIndex 对应 monk-ability-cards.png 图集中的位置（从左到右、从上到下，0起始）
 */
export const MONK_CARDS: AbilityCard[] = [
    // ============================================
    // 第一行 (atlasIndex 0-10)
    // ============================================

    // --- 行动卡 - main (蓝色) ---
    {
        id: 'card-enlightenment',
        name: cardText('card-enlightenment', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-enlightenment', 'description'),
        atlasIndex: 0,
        i18n: {
            'zh-CN': { name: '顿悟！', description: '投掷1骰：如果投出莲花，获得2气、闪避和净化；否则抽取1张牌。' },
            'en': { name: 'Enlightenment!', description: 'Roll 1 die: if Lotus, gain 2 Chi, Evasive and Purify; otherwise draw 1 card.' },
        },
        effects: [
            {
                description: '投掷1骰：莲花→获得2气+闪避+净化；否则抽1牌',
                action: { type: 'custom', target: 'self', customActionId: 'enlightenment-roll' },
                timing: 'immediate',
            },
        ],
    },
    // --- 行动卡 - instant (红色) ---
    {
        id: 'card-inner-peace',
        name: cardText('card-inner-peace', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('card-inner-peace', 'description'),
        atlasIndex: 1,
        i18n: {
            'zh-CN': { name: '静心！', description: '获得2气。' },
            'en': { name: 'Inner Peace!', description: 'Gain 2 Chi.' },
        },
        effects: [
            grantToken('taiji', 2, '获得2太极', { timing: 'immediate' }),
        ],
    },
    {
        id: 'card-deep-thought',
        name: cardText('card-deep-thought', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'instant',
        description: cardText('card-deep-thought', 'description'),
        atlasIndex: 2,
        i18n: {
            'zh-CN': { name: '沉思！', description: '获得5气。' },
            'en': { name: 'Deep Thought!', description: 'Gain 5 Chi.' },
        },
        effects: [
            grantToken('taiji', 5, '获得5太极', { timing: 'immediate' }),
        ],
    },
    // --- 行动卡 - main (蓝色) ---
    {
        id: 'card-buddha-light',
        name: cardText('card-buddha-light', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-buddha-light', 'description'),
        atlasIndex: 3,
        i18n: {
            'zh-CN': { name: '佛光普照！', description: '获得1气、闪避和净化；对1名对手施加倒地。' },
            'en': { name: 'Buddha Light!', description: 'Gain 1 Chi, Evasive and Purify; inflict Stun on 1 opponent.' },
        },
        effects: [
            grantToken('taiji', 1, '获得1太极', { timing: 'immediate' }),
            grantToken('evasive', 1, '获得1闪避', { timing: 'immediate' }),
            grantToken('purify', 1, '获得1净化', { timing: 'immediate' }),
            inflictStatus('stun', 1, '对手倒地'),
        ],
    },
    {
        id: 'card-palm-strike',
        name: cardText('card-palm-strike', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-palm-strike', 'description'),
        atlasIndex: 4,
        i18n: {
            'zh-CN': { name: '掌击！', description: '对1名对手施加倒地。' },
            'en': { name: 'Palm Strike!', description: 'Inflict Stun on 1 opponent.' },
        },
        effects: [
            inflictStatus('stun', 1, '对手倒地'),
        ],
    },
    // --- 升级卡 (绿色) ---
    {
        id: 'card-meditation-3',
        name: cardText('card-meditation-3', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('card-meditation-3', 'description'),
        atlasIndex: 5,
        i18n: {
            'zh-CN': { name: '清修 III', description: '防御投掷5骰。获得1×气数值的气，造成1×拳伤害。如果投出2个太极，获得闪避 -或- 净化。' },
            'en': { name: 'Meditation III', description: 'Defensive roll 5 dice. Gain Chi equal to Taiji faces; deal damage equal to Fist faces. If 2+ Taiji, gain Evasive -or- Purify.' },
        },
        effects: [
            replaceAbility('meditation', MEDITATION_3, 3, '升级清修至 III 级'),
        ],
    },
    // --- 行动卡 - roll (橙色) ---
    {
        id: 'card-play-six',
        name: cardText('card-play-six', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-play-six', 'description'),
        atlasIndex: 15,
        i18n: {
            'zh-CN': { name: '玩得六啊！', description: '将你1颗骰子的数值改至6。' },
            'en': { name: 'Play Six!', description: 'Set 1 of your dice to 6.' },
        },
        // 需要本阶段已投掷过且有骰子结果才能操作
        playCondition: {
            requireDiceExists: true,
            requireHasRolled: true,
        },
        effects: [
            {
                description: '将1颗骰子的数值改至6',
                action: { type: 'custom', target: 'self', customActionId: 'modify-die-to-6' },
                timing: 'immediate',
            },
        ],
    },
    // --- 升级卡 (绿色) ---
    {
        id: 'card-meditation-2',
        name: cardText('card-meditation-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-meditation-2', 'description'),
        atlasIndex: 6,
        i18n: {
            'zh-CN': { name: '清修 II', description: '防御投掷5骰。获得1×气数值的气，造成1×拳伤害。' },
            'en': { name: 'Meditation II', description: 'Defensive roll 5 dice. Gain Chi equal to Taiji faces; deal damage equal to Fist faces.' },
        },
        effects: [
            replaceAbility('meditation', MEDITATION_2, 2, '升级清修至 II 级'),
        ],
    },
    {
        id: 'card-zen-fist-2',
        name: cardText('card-zen-fist-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-zen-fist-2', 'description'),
        atlasIndex: 7,
        i18n: {
            'zh-CN': { name: '止禅拳法 II', description: '大顺子触发：造成7伤害，然后获得闪避和3气，施加倒地。武僧之路（拳掌太极莲花触发）：获得2闪避，造成3不可防御伤害。' },
            'en': { name: 'Zen Fist II', description: 'Large Straight: Deal 7 damage, gain Evasive and 3 Chi, inflict Stun. Way of the Monk (Fist+Palm+Taiji+Lotus): Gain 2 Evasive, deal 3 undefendable damage.' },
        },
        effects: [
            replaceAbility('calm-water', CALM_WATER_2, 2, '升级定水神拳至 II 级'),
        ],
    },
    {
        id: 'card-storm-assault-2',
        name: cardText('card-storm-assault-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-storm-assault-2', 'description'),
        atlasIndex: 8,
        i18n: {
            'zh-CN': { name: '风暴突袭 II', description: '投掷3骰，造成等同于投掷结果总和的伤害。你可以花费1个气以重掷以上三颗中的任何一颗骰子。如果投掷结果大于等于12，则施加倒地。' },
            'en': { name: 'Storm Assault II', description: 'Roll 3 dice; deal damage equal to sum. Spend 1 Chi to reroll any die. If sum ≥12, inflict Stun.' },
        },
        effects: [
            replaceAbility('thunder-strike', THUNDER_STRIKE_2, 2, '升级雷霆一击至 II 级'),
        ],
    },
    {
        id: 'card-combo-punch-2',
        name: cardText('card-combo-punch-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-combo-punch-2', 'description'),
        atlasIndex: 9,
        i18n: {
            'zh-CN': { name: '连段冲拳 II', description: '造成5伤害并投掷2骰。增加2×拳伤害，增加3×掌伤害。获得2×太极的气。每投出1个莲花，获得闪避 -或- 净化。' },
            'en': { name: 'Combo Punch II', description: 'Deal 5 damage and roll 2 dice. +2 damage per Fist, +3 per Palm. Gain 2 Chi per Taiji. Gain Evasive -or- Purify per Lotus.' },
        },
        effects: [
            replaceAbility('taiji-combo', TAIJI_COMBO_2, 2, '升级太极连环拳至 II 级'),
        ],
    },

    // ============================================
    // 第二行 (atlasIndex 11-20)
    // ============================================

    // --- 升级卡 ---
    {
        id: 'card-lotus-bloom-2',
        name: cardText('card-lotus-bloom-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-lotus-bloom-2', 'description'),
        atlasIndex: 10,
        i18n: {
            'zh-CN': { name: '花开贝佛 II', description: '4莲花触发：造成6不可防御伤害，然后气的堆叠上限提升1，并获得6气。莲花之道（3莲花触发）：造成2不可防御伤害，然后获得闪避和2气。' },
            'en': { name: 'Lotus Bloom II', description: '4 Lotus: Deal 6 undefendable damage, Chi cap +1, gain 6 Chi. 3 Lotus: Deal 2 undefendable damage, gain Evasive and 2 Chi.' },
        },
        effects: [
            replaceAbility('lotus-palm', LOTUS_PALM_2, 2, '升级花开见佛至 II 级'),
        ],
    },
    {
        id: 'card-mahayana-2',
        name: cardText('card-mahayana-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-mahayana-2', 'description'),
        atlasIndex: 11,
        i18n: {
            'zh-CN': { name: '大乘拳法 II', description: '小顺子触发：造成6伤害，然后获得3气。' },
            'en': { name: 'Mahayana II', description: 'Small Straight: Deal 6 damage, then gain 3 Chi.' },
        },
        effects: [
            replaceAbility('harmony', HARMONY_2, 2, '升级和谐之力至 II 级'),
        ],
    },
    {
        id: 'card-thrust-punch-2',
        name: cardText('card-thrust-punch-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-thrust-punch-2', 'description'),
        atlasIndex: 12,
        i18n: {
            'zh-CN': { name: '冲拳 II', description: '拳拳造成7伤害 / 拳拳掌造成8伤害 / 拳拳掌掌造成9伤害。' },
            'en': { name: 'Thrust Punch II', description: '2 Fist: 7 damage / 3 Fist: 8 damage / 4 Fist: 9 damage.' },
        },
        effects: [
            replaceAbility('fist-technique', FIST_TECHNIQUE_2, 2, '升级拳法至 II 级'),
        ],
    },
    {
        id: 'card-thrust-punch-3',
        name: cardText('card-thrust-punch-3', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-thrust-punch-3', 'description'),
        atlasIndex: 13,
        i18n: {
            'zh-CN': { name: '冲拳 III', description: '拳拳造成7伤害 / 拳拳掌造成8伤害 / 拳拳掌掌造成9伤害。如果投出4个相同数字，施加倒地。' },
            'en': { name: 'Thrust Punch III', description: '2 Fist: 7 damage / 3 Fist: 8 damage / 4 Fist: 9 damage. If 4 of a kind, inflict Stun.' },
        },
        effects: [
            replaceAbility('fist-technique', FIST_TECHNIQUE_3, 3, '升级拳法至 III 级'),
        ],
    },
    {
        id: 'card-contemplation-2',
        name: cardText('card-contemplation-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-contemplation-2', 'description'),
        atlasIndex: 14,
        i18n: {
            'zh-CN': { name: '冥想 II', description: '3太极触发：获得6气，获得闪避和净化。禅武归一（拳掌太极触发）：造成6伤害，然后获得2气。' },
            'en': { name: 'Contemplation II', description: '3 Taiji: Gain 6 Chi, Evasive and Purify. Zen Combat (Fist+Palm+Taiji): Deal 6 damage, gain 2 Chi.' },
        },
        effects: [
            replaceAbility('zen-forget', ZEN_FORGET_2, 2, '升级禅忘至 II 级'),
        ],
    },
    // --- 行动卡 - roll (橙色) ---
    {
        id: 'card-just-this',
        name: cardText('card-just-this', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'roll',
        description: cardText('card-just-this', 'description'),
        atlasIndex: 16,
        i18n: {
            'zh-CN': { name: '就这？', description: '1名玩家可以在其防御投掷阶段，对至5颗骰子进行1次额外的投掷尝试。' },
            'en': { name: 'Just This?', description: '1 player may make 1 extra roll attempt with up to 5 dice during their defensive roll phase.' },
        },
        // 只能在防御投掷阶段，由防御方（当前投掷方）使用
        // 注意：不限制 requireOwnTurn，因为防御方不是 activePlayer
        playCondition: {
            phase: 'defensiveRoll',
            requireIsRoller: true, // 必须是当前投掷方（防御方）
            requireHasRolled: true,
            requireDiceExists: true,
        },
        effects: [
            {
                description: '重投至5颗骰子',
                action: { type: 'custom', target: 'self', customActionId: 'reroll-die-5' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-give-hand',
        name: cardText('card-give-hand', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-give-hand', 'description'),
        atlasIndex: 17,
        i18n: {
            'zh-CN': { name: '抬一手！', description: '选择对手的1颗骰子，强制他重投该骰子。' },
            'en': { name: 'Give a Hand!', description: 'Select 1 opponent\'s die and force them to reroll it.' },
        },
        // 只能在对手确认骰面后的响应窗口中使用
        // - 进攻阶段：防御方在进攻方确认骰面后，强制进攻方重投
        // - 防御阶段：进攻方在防御方确认骰面后，强制防御方重投
        playCondition: {
            requireIsNotRoller: true, // 必须不是当前投掷方（只能响应对手的骰面）
            requireRollConfirmed: true, // 必须骰面已确认（在响应窗口中使用）
            requireHasRolled: true, // 对手已经投掷过
            requireOpponentDiceExists: true, // 对手有骰子可重投
        },
        effects: [
            {
                description: '强制对手重投1颗骰子',
                action: { type: 'custom', target: 'opponent', customActionId: 'reroll-opponent-die-1' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-i-can-again',
        name: cardText('card-i-can-again', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-i-can-again', 'description'),
        atlasIndex: 18,
        i18n: {
            'zh-CN': { name: '我又行了！', description: '1名玩家可以在其进攻投掷阶段，对至多5颗骰子进行1次额外的投掷尝试。' },
            'en': { name: 'I Can Again!', description: '1 player may make 1 extra roll attempt with up to 5 dice during their offensive roll phase.' },
        },
        // 只能在自己的进攻投掷阶段 + 已经投掷过才能打出
        playCondition: {
            phase: 'offensiveRoll',
            requireOwnTurn: true,
            requireHasRolled: true,
            requireDiceExists: true,
        },
        effects: [
            {
                description: '重掷至多5颗骰子',
                action: { type: 'custom', target: 'self', customActionId: 'reroll-die-5' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-me-too',
        name: cardText('card-me-too', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-me-too', 'description'),
        atlasIndex: 19,
        i18n: {
            'zh-CN': { name: '俺也一样！', description: '将你1颗骰子的数值变为和你另一颗骰子的数值一样（同一阶段使用且目的相同）。' },
            'en': { name: 'Me Too!', description: 'Set 1 of your dice to match another of your dice (same phase and purpose).' },
        },
        // 修改自己骰子，必须是当前投掷方（骰子主人）
        playCondition: {
            requireIsRoller: true,
            requireMinDiceCount: 2,
            requireHasRolled: true,
        },
        effects: [
            {
                description: '将1颗骰子改为另1颗的值',
                action: { type: 'custom', target: 'self', customActionId: 'modify-die-copy' },
                timing: 'immediate',
            },
        ],
    },

    // ============================================
    // 第三行 (atlasIndex 20-29)
    // ============================================

    // --- 行动卡 - roll (橙色) ---
    {
        id: 'card-surprise',
        name: cardText('card-surprise', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-surprise', 'description'),
        atlasIndex: 20,
        i18n: {
            'zh-CN': { name: '惊不惊喜？！', description: '改变任意1颗骰子的数值。' },
            'en': { name: 'Surprise!', description: 'Change any 1 die to any value.' },
        },
        // 可修改任意骰子（自己或对手），需要有骰子存在
        playCondition: {
            requireDiceExists: true,
            requireHasRolled: true,
        },
        effects: [
            {
                description: '改变任意1颗骰子的数值',
                action: { type: 'custom', target: 'any', customActionId: 'modify-die-any-1' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-worthy-of-me',
        name: cardText('card-worthy-of-me', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-worthy-of-me', 'description'),
        atlasIndex: 21,
        i18n: {
            'zh-CN': { name: '不愧是我！', description: '你或1名队友可以重掷至多2颗骰子（可以是同一颗骰子重掷2次或两颗骰子各重掷1次）。' },
            'en': { name: 'Worthy of Me!', description: 'You or 1 teammate may reroll up to 2 dice (same die twice or 2 different dice once each).' },
        },
        // 修改自己骰子，必须是当前投掷方（骰子主人）
        playCondition: {
            requireIsRoller: true,
            requireDiceExists: true,
            requireHasRolled: true,
        },
        effects: [
            {
                description: '重掷至多2颗骰子',
                action: { type: 'custom', target: 'self', customActionId: 'reroll-die-2' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-unexpected',
        name: cardText('card-unexpected', 'name'),
        type: 'action',
        cpCost: 3,
        timing: 'roll',
        description: cardText('card-unexpected', 'description'),
        atlasIndex: 22,
        i18n: {
            'zh-CN': { name: '意不意外？！', description: '改变任意2颗骰子的数值。' },
            'en': { name: 'Unexpected!', description: 'Change any 2 dice to any values.' },
        },
        // 可修改任意骰子（自己或对手），需要有骰子存在
        playCondition: {
            requireDiceExists: true,
            requireHasRolled: true,
        },
        effects: [
            {
                description: '改变任意2颗骰子的数值',
                action: { type: 'custom', target: 'any', customActionId: 'modify-die-any-2' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-next-time',
        name: cardText('card-next-time', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-next-time', 'description'),
        atlasIndex: 23,
        i18n: {
            'zh-CN': { name: '下次一定！', description: '一名玩家防止6点即将受到的伤害。' },
            'en': { name: 'Next Time!', description: 'One player prevents 6 points of incoming damage.' },
        },
        effects: [
            // 防止6点即将受到的伤害（下次受伤时消耗）
            grantDamageShield(6, '防止6点伤害'),
        ],
    },
    {
        id: 'card-boss-generous',
        name: cardText('card-boss-generous', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('card-boss-generous', 'description'),
        atlasIndex: 24,
        i18n: {
            'zh-CN': { name: '老板大气！', description: '获得2CP。' },
            'en': { name: 'Boss Generous!', description: 'Gain 2 CP.' },
        },
        effects: [
            {
                description: '获得2CP',
                action: { type: 'custom', target: 'self', customActionId: 'grant-cp-2' },
                timing: 'immediate',
            },
        ],
    },
    // --- 红色 instant ---
    {
        id: 'card-flick',
        name: cardText('card-flick', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-flick', 'description'),
        atlasIndex: 25,
        i18n: {
            'zh-CN': { name: '弹一手！', description: '增加或减少任意1颗骰子的数值1点（数值1无法再减少，数值6无法再增加）。' },
            'en': { name: 'Flick!', description: 'Increase or decrease any 1 die by 1 (1 cannot go lower, 6 cannot go higher).' },
        },
        // 可修改任意骰子（自己或对手），需要有骰子存在
        playCondition: {
            requireDiceExists: true,
            requireHasRolled: true,
        },
        effects: [
            {
                description: '增/减1颗骰子数值1点',
                action: { type: 'custom', target: 'any', customActionId: 'modify-die-adjust-1' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-bye-bye',
        name: cardText('card-bye-bye', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: cardText('card-bye-bye', 'description'),
        atlasIndex: 26,
        i18n: {
            'zh-CN': { name: '拜拜了您内！', description: '从1名玩家身上移除1个状态效果。' },
            'en': { name: 'Bye Bye!', description: 'Remove 1 status effect from 1 player.' },
        },
        effects: [
            {
                description: '移除1名玩家1个状态效果',
                action: { type: 'custom', target: 'select', customActionId: 'remove-status-1' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-double',
        name: cardText('card-double', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'instant',
        description: cardText('card-double', 'description'),
        atlasIndex: 27,
        i18n: {
            'zh-CN': { name: '加倍！', description: '抽取2张牌。' },
            'en': { name: 'Double!', description: 'Draw 2 cards.' },
        },
        effects: [
            drawCards(2, '抽2张牌'),
        ],
    },
    {
        id: 'card-super-double',
        name: cardText('card-super-double', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: cardText('card-super-double', 'description'),
        atlasIndex: 28,
        i18n: {
            'zh-CN': { name: '超级加倍！', description: '抽取3张牌。' },
            'en': { name: 'Super Double!', description: 'Draw 3 cards.' },
        },
        effects: [
            drawCards(3, '抽3张牌'),
        ],
    },
    // --- 蓝色 main ---
    {
        id: 'card-get-away',
        name: cardText('card-get-away', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-get-away', 'description'),
        atlasIndex: 29,
        i18n: {
            'zh-CN': { name: '起开！', description: '从1名玩家身上移除1个状态效果。' },
            'en': { name: 'Get Away!', description: 'Remove 1 status effect from 1 player.' },
        },
        effects: [
            {
                description: '移除1名玩家1个状态效果',
                action: { type: 'custom', target: 'select', customActionId: 'remove-status-1' },
                timing: 'immediate',
            },
        ],
    },

    // ============================================
    // 第四行 (atlasIndex 30-32)
    // ============================================

    // --- 行动卡 - main (蓝色) ---
    {
        id: 'card-one-throw-fortune',
        name: cardText('card-one-throw-fortune', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-one-throw-fortune', 'description'),
        atlasIndex: 30,
        i18n: {
            'zh-CN': { name: '一掷千金！', description: '投掷1骰：获得½数值的CP（向上取整）。' },
            'en': { name: 'One Throw Fortune!', description: 'Roll 1 die: gain CP equal to half the value (rounded up).' },
        },
        effects: [
            {
                description: '投掷1骰子，获得½数值的CP（向上取整）',
                action: { type: 'custom', target: 'self', customActionId: 'one-throw-fortune-cp' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-what-status',
        name: cardText('card-what-status', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-what-status', 'description'),
        atlasIndex: 31,
        i18n: {
            'zh-CN': { name: '状什么态？', description: '移除1名玩家的所有状态效果。' },
            'en': { name: 'What Status?', description: 'Remove all status effects from 1 player.' },
        },
        effects: [
            {
                description: '移除1名玩家所有状态效果',
                action: { type: 'custom', target: 'select', customActionId: 'remove-all-status' },
                timing: 'immediate',
            },
        ],
    },
    {
        id: 'card-transfer-status',
        name: cardText('card-transfer-status', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-transfer-status', 'description'),
        atlasIndex: 32,
        i18n: {
            'zh-CN': { name: '乾坤大挪移！', description: '将1名玩家身上的1个状态效果转移至另1名玩家。' },
            'en': { name: 'Transfer Status!', description: 'Transfer 1 status effect from 1 player to another player.' },
        },
        effects: [
            {
                description: '转移1个状态效果到另一玩家',
                action: { type: 'custom', target: 'select', customActionId: 'transfer-status' },
                timing: 'immediate',
            },
        ],
    },
];

/**
 * 获取僧侣初始牌库
 * 返回洗牌后的卡牌副本
 * @param random 引擎层随机数生成器（确保回放确定性）
 */
export const getMonkStartingDeck = (random: RandomFn): AbilityCard[] => {
    // 复制所有卡牌
    const deck = MONK_CARDS.map(card => ({ ...card }));
    // 使用引擎层的确定性洗牌
    return random.shuffle(deck);
};

/**
 * 根据 atlasIndex 获取图集裁切坐标
 * 图集单卡尺寸: 328×529
 */
export const getCardAtlasPosition = (atlasIndex: number): { x: number; y: number; width: number; height: number } => {
    const CARD_WIDTH = 328;
    const CARD_HEIGHT = 529;
    const CARDS_PER_ROW = 5; // 假设每行5张

    const col = atlasIndex % CARDS_PER_ROW;
    const row = Math.floor(atlasIndex / CARDS_PER_ROW);

    return {
        x: col * CARD_WIDTH,
        y: row * CARD_HEIGHT,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
    };
};
