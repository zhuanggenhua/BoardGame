/**
 * 僧侣英雄的技能定义
 * 使用通用 AbilitySystem
 */

import type { AbilityDef, AbilityEffect, EffectTiming, EffectCondition } from '../../../systems/AbilitySystem';

// 游戏特定条件注册已移至 ../conditions.ts，由 domain/index.ts 统一调用

const abilityText = (id: string, field: 'name' | 'description') => `abilities.${id}.${field}`;
const abilityEffectText = (id: string, field: string) => `abilities.${id}.effects.${field}`;

// 辅助函数：创建伤害效果
const damage = (value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'damage', target: 'opponent', value },
    timing: opts?.timing,
    condition: opts?.condition,
});


// 辅助函数：创建 Token 效果（用于太极、闪避、净化）
const grantToken = (tokenId: string, value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target: 'self', tokenId, value },
    timing: opts?.timing,
    condition: opts?.condition,
});

/**
 * 僧侣技能定义
 */
export const MONK_ABILITIES: AbilityDef[] = [
    {
        id: 'fist-technique',
        name: abilityText('fist-technique', 'name'),
        type: 'offensive',
        description: abilityText('fist-technique', 'description'),
        variants: [
            {
                id: 'fist-technique-3',
                trigger: { type: 'diceSet', faces: { fist: 3 } },
                effects: [damage(4, abilityEffectText('fist-technique-3', 'damage4'))],
                priority: 1,
            },
            {
                id: 'fist-technique-4',
                trigger: { type: 'diceSet', faces: { fist: 4 } },
                effects: [damage(6, abilityEffectText('fist-technique-4', 'damage6'))],
                priority: 2,
            },
            {
                id: 'fist-technique-5',
                trigger: { type: 'diceSet', faces: { fist: 5 } },
                effects: [damage(8, abilityEffectText('fist-technique-5', 'damage8'))],
                priority: 3,
            },
        ],
    },
    {
        id: 'zen-forget',
        name: abilityText('zen-forget', 'name'),
        type: 'offensive',
        description: abilityText('zen-forget', 'description'),
        trigger: { type: 'diceSet', faces: { taiji: 3 } },
        effects: [
            grantToken('taiji', 5, abilityEffectText('zen-forget', 'gainTaiji5')),
            // 选择效果：获得闪避或净化 Token
            {
                description: abilityEffectText('zen-forget', 'gainChoice'),
                action: {
                    type: 'choice',
                    target: 'self',
                    choiceTitleKey: 'choices.evasiveOrPurifyToken',
                    choiceOptions: [
                        { tokenId: 'evasive', value: 1 },
                        { tokenId: 'purify', value: 1 },
                    ],
                },
                timing: 'preDefense',
            },
        ],
    },
    {
        id: 'harmony',
        name: abilityText('harmony', 'name'),
        type: 'offensive',
        description: abilityText('harmony', 'description'),
        trigger: { type: 'smallStraight' },
        effects: [
            // 伤害效果：默认 withDamage 时机
            damage(5, abilityEffectText('harmony', 'damage5')),
            // 然后获得太极 Token：onHit 条件 + postDamage 时机
            grantToken('taiji', 2, abilityEffectText('harmony', 'gainTaiji2'), {
                timing: 'postDamage',
                condition: { type: 'onHit' },
            }),
        ],
    },
    {
        id: 'lotus-palm',
        name: abilityText('lotus-palm', 'name'),
        type: 'offensive',
        description: abilityText('lotus-palm', 'description'),
        trigger: { type: 'diceSet', faces: { lotus: 4 } },
        effects: [
            // 你可以花费2个太极标记令此次攻击不可防御（在进入防御阶段前选择）
            {
                description: abilityEffectText('lotus-palm', 'unblockable'),
                action: { type: 'custom', target: 'self', customActionId: 'lotus-palm-unblockable-choice' },
                timing: 'preDefense',
            },
            damage(5, abilityEffectText('lotus-palm', 'damage5')),
            // onHit：太极上限+1，并立即补满太极
            {
                description: abilityEffectText('lotus-palm', 'taijiCapMax'),
                action: { type: 'custom', target: 'self', customActionId: 'lotus-palm-taiji-cap-up-and-fill' },
                timing: 'postDamage',
                condition: { type: 'onHit' },
            },
        ],
    },
    {
        id: 'taiji-combo',
        name: abilityText('taiji-combo', 'name'),
        type: 'offensive',
        description: abilityText('taiji-combo', 'description'),
        trigger: { type: 'diceSet', faces: { fist: 3, palm: 1 } },
        effects: [
            // 投掷骰子效果：先投掷，根据结果累加 bonusDamage
            {
                description: abilityEffectText('taiji-combo', 'rollDie'),
                action: {
                    type: 'rollDie',
                    target: 'self',
                    diceCount: 1,
                    conditionalEffects: [
                        { face: 'fist', bonusDamage: 2 },
                        { face: 'palm', bonusDamage: 3 },
                        { face: 'taiji', grantToken: { tokenId: 'taiji', value: 2 } },
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
            // 基础伤害 6 + rollDie 累加的 bonusDamage
            damage(6, abilityEffectText('taiji-combo', 'damage6')),
        ],
    },
    {
        id: 'thunder-strike',
        name: abilityText('thunder-strike', 'name'),
        type: 'offensive',
        description: abilityText('thunder-strike', 'description'),
        trigger: { type: 'diceSet', faces: { palm: 3 } },
        effects: [
            damage(10, abilityEffectText('thunder-strike', 'roll3Damage')),
            { description: abilityEffectText('thunder-strike', 'rerollOne') },
        ],
    },
    {
        id: 'calm-water',
        name: abilityText('calm-water', 'name'),
        type: 'offensive',
        description: abilityText('calm-water', 'description'),
        trigger: { type: 'largeStraight' },
        effects: [
            damage(7, abilityEffectText('calm-water', 'damage7')),
            // 然后获得太极 Token：onHit 条件 + postDamage 时机
            grantToken('taiji', 2, abilityEffectText('calm-water', 'gainTaiji2'), {
                timing: 'postDamage',
                condition: { type: 'onHit' },
            }),
            // 然后获得闪避 Token：onHit 条件 + postDamage 时机
            grantToken('evasive', 1, abilityEffectText('calm-water', 'gainEvasive'), {
                timing: 'postDamage',
                condition: { type: 'onHit' },
            }),
        ],
    },
    {
        id: 'meditation',
        name: abilityText('meditation', 'name'),
        type: 'defensive',
        description: abilityText('meditation', 'description'),
        trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 4 },
        effects: [
            { description: abilityEffectText('meditation', 'taijiByResult'), action: { type: 'custom', target: 'self', customActionId: 'meditation-taiji' }, timing: 'withDamage' },
            { description: abilityEffectText('meditation', 'damageByFist'), action: { type: 'custom', target: 'opponent', customActionId: 'meditation-damage' }, timing: 'withDamage' },
        ],
    },
    {
        id: 'transcendence',
        name: abilityText('transcendence', 'name'),
        type: 'offensive',
        description: abilityText('transcendence', 'description'),
        tags: ['ultimate'],
        trigger: { type: 'diceSet', faces: { lotus: 5 } },
        effects: [
            // 造成10伤害，造成击倒
            damage(10, abilityEffectText('transcendence', 'damage10')),
            {
                description: abilityEffectText('transcendence', 'inflictKnockdown'),
                action: { type: 'grantStatus', target: 'opponent', statusId: 'knockdown', stacks: 1 },
                timing: 'postDamage',
                condition: { type: 'onHit' },
            },
            // 获得闪避和净化
            grantToken('evasive', 1, abilityEffectText('transcendence', 'gainEvasive'), { timing: 'preDefense' }),
            grantToken('purify', 1, abilityEffectText('transcendence', 'gainPurify'), { timing: 'preDefense' }),
            // 太极上限+1，并立即补满太极
            {
                description: abilityEffectText('transcendence', 'taijiCapMax'),
                action: { type: 'custom', target: 'self', customActionId: 'lotus-palm-taiji-cap-up-and-fill' },
                timing: 'postDamage',
                condition: { type: 'onHit' },
            },
        ],
    },
];
