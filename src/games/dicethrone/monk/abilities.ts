/**
 * 僧侣英雄的技能定义
 * 使用通用 AbilitySystem
 */

import type { AbilityDef, AbilityEffect, EffectTiming, EffectCondition } from '../../../systems/AbilitySystem';

const abilityText = (id: string, field: 'name' | 'description') => `abilities.${id}.${field}`;
const abilityEffectText = (id: string, field: string) => `abilities.${id}.effects.${field}`;

// 辅助函数：创建伤害效果
const damage = (value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'damage', target: 'opponent', value },
    timing: opts?.timing,
    condition: opts?.condition,
});

// 辅助函数：创建状态效果
const grantStatus = (statusId: string, value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'self', statusId, value },
    timing: opts?.timing,
    condition: opts?.condition,
});

// 辅助函数：给对手施加状态
const inflictStatus = (statusId: string, value: number, description: string, opts?: { timing?: EffectTiming; condition?: EffectCondition }): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
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
            grantStatus('taiji', 5, abilityEffectText('zen-forget', 'gainTaiji5')),
            { description: abilityEffectText('zen-forget', 'gainChoice') },
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
            // 然后获得太极：onHit 条件 + postDamage 时机
            grantStatus('taiji', 2, abilityEffectText('harmony', 'gainTaiji2'), {
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
        tags: ['unblockable'], // 不可防御标签
        trigger: { type: 'diceSet', faces: { lotus: 4 } },
        effects: [
            damage(5, abilityEffectText('lotus-palm', 'damage5')),
            // 获得太极：onHit 条件 + postDamage 时机
            grantStatus('taiji', 5, abilityEffectText('lotus-palm', 'taijiCapMax'), {
                timing: 'postDamage',
                condition: { type: 'onHit' },
            }),
            { description: abilityEffectText('lotus-palm', 'unblockable') },
        ],
    },
    {
        id: 'taiji-combo',
        name: abilityText('taiji-combo', 'name'),
        type: 'offensive',
        description: abilityText('taiji-combo', 'description'),
        trigger: { type: 'diceSet', faces: { fist: 3, palm: 1 } },
        effects: [
            damage(6, abilityEffectText('taiji-combo', 'damage6')),
            inflictStatus('stun', 1, abilityEffectText('taiji-combo', 'inflictStun')),
            { description: abilityEffectText('taiji-combo', 'bonusFist') },
            { description: abilityEffectText('taiji-combo', 'bonusPalm') },
            { description: abilityEffectText('taiji-combo', 'gainTaiji2') },
            { description: abilityEffectText('taiji-combo', 'gainChoice') },
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
            // 然后获得太极：onHit 条件 + postDamage 时机
            grantStatus('taiji', 2, abilityEffectText('calm-water', 'gainTaiji2'), {
                timing: 'postDamage',
                condition: { type: 'onHit' },
            }),
            // 然后获得闪避：onHit 条件 + postDamage 时机
            grantStatus('evasive', 1, abilityEffectText('calm-water', 'gainEvasive'), {
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
            { description: abilityEffectText('meditation', 'taijiByResult'), action: { type: 'custom', target: 'self', customActionId: 'meditation-taiji' } },
            { description: abilityEffectText('meditation', 'damageByFist'), action: { type: 'custom', target: 'opponent', customActionId: 'meditation-damage' } },
        ],
    },
];
