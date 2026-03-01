/**
 * 战斗技能系统类型定义
 * 
 * 适用于回合制战斗游戏（如 DiceThrone）。
 * 该模块不再与具体游戏耦合，但保留战斗类通用语义。
 */

import type { EffectAction } from '../tokenTypes';
import type { TriggerCondition, EffectCondition } from './conditions';

// ============================================================================
// 效果触发时机（战斗类游戏预设）
// ============================================================================

/**
 * 效果触发时机（战斗类游戏预设）
 * 适用于回合制战斗游戏（如 DiceThrone）
 * 
 * - immediate: 技能选定后立即触发（如纯增益技能）
 * - preDefense: 进入防御阶段前触发（非伤害效果默认）
 * - withDamage: 与伤害同时结算（伤害效果默认）
 * - postDamage: 伤害结算后触发（Then 语义）
 */
export type EffectTiming = 'immediate' | 'preDefense' | 'withDamage' | 'postDamage';

// ============================================================================
// 技能效果
// ============================================================================

/**
 * 技能效果定义
 * 可以是程序化执行的 EffectAction，或纯文本描述
 * 支持触发时机和条件
 */
export interface AbilityEffect {
    /** 效果描述（供 UI 展示） */
    description: string;
    /** 可选的音效 key（用于效果级别音效） */
    sfxKey?: string;
    /** 可选的程序化执行定义 */
    action?: EffectAction;
    /** 触发时机（默认：伤害效果为 withDamage，非伤害效果为 preDefense） */
    timing?: EffectTiming;
    /** 触发条件（默认：always） */
    condition?: EffectCondition;
}

// ============================================================================
// 技能定义
// ============================================================================

/**
 * 技能类型
 */
export type AbilityType = 'offensive' | 'defensive' | 'utility' | 'passive';

/**
 * 技能标签（用于终极不可响应等约束）
 */
export type AbilityTag =
    | 'ultimate'        // 终极技能
    | 'unblockable'     // 不可防御
    | 'uninterruptible' // 不可响应/中断
    | 'instant'         // 瞬发
    | 'defensive';      // 防御类

/**
 * 伤害修改器（用于太极增伤/减伤）
 */
export interface DamageModifier {
    id: string;
    /** 来源（如 'taiji'） */
    source: string;
    /** 修改类型 */
    type: 'increase' | 'decrease' | 'multiply';
    /** 修改值 */
    value: number;
    /** 消耗的资源/状态 */
    cost?: { type: 'status' | 'resource'; id: string; amount: number };
}

/**
 * 技能变体（同一技能的不同等级/触发条件）
 */
export interface AbilityVariantDef {
    id: string;
    /** 触发条件 */
    trigger: TriggerCondition;
    /** 效果列表 */
    effects: AbilityEffect[];
    /** 变体专属音效 key（优先级高于 AbilityDef） */
    sfxKey?: string;
    /** 优先级（用于自动选择最优变体） */
    priority?: number;
    /** 变体特有标签（如不可防御） */
    tags?: AbilityTag[];
}

/**
 * 技能定义
 */
export interface AbilityDef {
    /** 唯一标识 */
    id: string;
    /** 显示名称 */
    name: string;
    /** 技能类型 */
    type: AbilityType;
    /** 技能音效 key（技能激活时触发） */
    sfxKey?: string;
    /** 图标 */
    icon?: string;
    /** 描述 */
    description?: string;

    /** 技能标签（用于终极不可响应等约束） */
    tags?: AbilityTag[];

    /** 单一触发条件（简单技能） */
    trigger?: TriggerCondition;
    /** 单一效果列表 */
    effects?: AbilityEffect[];

    /** 技能变体（复杂技能，如拳术 3/4/5） */
    variants?: AbilityVariantDef[];

    /** 冷却回合数 */
    cooldown?: number;
    /** 资源消耗 */
    cost?: { resource: string; amount: number };

    /** 可用的伤害修改器 */
    modifiers?: DamageModifier[];
}

// ============================================================================
// 游戏上下文接口（战斗类游戏预设）
// ============================================================================

/**
 * 游戏上下文接口（战斗类游戏预设）
 * 适用于回合制战斗游戏（如 DiceThrone）
 * 
 * 游戏实现此接口以支持技能系统的通用效果执行
 * 非战斗类游戏可以定义自己的上下文接口
 */
export interface GameContext {
    /** 对目标造成伤害，返回实际造成的伤害量 */
    applyDamage(targetId: string, amount: number, sourceAbilityId?: string): number;
    /** 对目标治疗 */
    applyHeal(targetId: string, amount: number, sourceAbilityId?: string): void;
    /** 给目标添加状态效果 */
    grantStatus(targetId: string, statusId: string, stacks: number, sourceAbilityId?: string): void;
    /** 移除目标的状态效果 */
    removeStatus(targetId: string, statusId: string, stacks?: number, sourceAbilityId?: string): void;
    /** 获取目标当前生命值 */
    getHealth(targetId: string): number;
    /** 获取目标状态效果层数 */
    getStatusStacks(targetId: string, statusId: string): number;
    /** 执行自定义效果（游戏特定逻辑） */
    executeCustomAction?(actionId: string, attackerId: string, defenderId: string, sourceAbilityId?: string): void;
}

/**
 * 效果结算配置
 */
export interface EffectResolutionConfig {
    /** 额外伤害（如太极增伤） */
    bonusDamage?: number;
    /** 是否只应用首次伤害的 bonusDamage */
    bonusDamageOnce?: boolean;
}
