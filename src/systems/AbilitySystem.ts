/**
 * 通用技能系统
 * 
 * 支持任意游戏的技能定义、触发条件判断、效果执行。
 * 设计原则：
 * - 技能定义与具体游戏解耦
 * - 支持多种触发条件类型
 * - 可程序化执行效果或保留文本描述
 */

import type { EffectAction } from './StatusEffectSystem';

// ============================================================================
// 技能触发条件类型
// ============================================================================

/**
 * 触发条件基础接口
 */
export interface TriggerConditionBase {
    type: string;
}

/**
 * 骰子组合触发条件（王权骰铸风格）
 */
export interface DiceSetTrigger extends TriggerConditionBase {
    type: 'diceSet';
    /** 骰面要求 { faceName: count } */
    faces: Record<string, number>;
}

/**
 * 骰子顺子触发条件
 */
export interface DiceStraightTrigger extends TriggerConditionBase {
    type: 'smallStraight' | 'largeStraight';
}

/**
 * 阶段触发条件
 */
export interface PhaseTrigger extends TriggerConditionBase {
    type: 'phase';
    phaseId: string;
    /** 是否需要特定骰子数 */
    diceCount?: number;
}

/**
 * 资源消耗触发条件
 */
export interface ResourceTrigger extends TriggerConditionBase {
    type: 'resource';
    resourceId: string;
    minAmount: number;
}

/**
 * 状态效果触发条件
 */
export interface StatusTrigger extends TriggerConditionBase {
    type: 'hasStatus';
    statusId: string;
    minStacks?: number;
}

/**
 * 组合触发条件（AND）
 */
export interface CompositeTrigger extends TriggerConditionBase {
    type: 'composite';
    conditions: TriggerCondition[];
    logic: 'and' | 'or';
}

/**
 * 所有触发条件类型联合
 */
export type TriggerCondition =
    | DiceSetTrigger
    | DiceStraightTrigger
    | PhaseTrigger
    | ResourceTrigger
    | StatusTrigger
    | CompositeTrigger;

// ============================================================================
// 效果触发时机与条件（条件系统核心）
// ============================================================================

/**
 * 效果触发时机
 * - immediate: 技能选定后立即触发（如纯增益技能）
 * - preDefense: 进入防御阶段前触发（非伤害效果默认）
 * - withDamage: 与伤害同时结算（伤害效果默认）
 * - postDamage: 伤害结算后触发（Then 语义）
 */
export type EffectTiming = 'immediate' | 'preDefense' | 'withDamage' | 'postDamage';

/**
 * 效果触发条件
 */
export type EffectCondition =
    | { type: 'always' }                              // 无条件触发
    | { type: 'onHit'; minDamage?: number }           // 造成伤害时触发（Then 语义）
    | { type: 'onMiss' }                              // 未命中时触发
    | { type: 'hasStatus'; statusId: string; minStacks?: number }  // 拥有状态时触发
    | { type: 'targetHasStatus'; statusId: string; minStacks?: number }; // 目标拥有状态时触发

// ============================================================================
// 技能效果类型
// ============================================================================

/**
 * 技能效果定义
 * 可以是程序化执行的 EffectAction，或纯文本描述
 * 支持触发时机和条件（条件系统）
 */
export interface AbilityEffect {
    /** 效果描述（供 UI 展示） */
    description: string;
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
    /** 优先级（用于自动选择最优变体） */
    priority?: number;
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
// 游戏上下文接口（抽象游戏状态操作）
// ============================================================================

/**
 * 游戏上下文接口
 * 游戏实现此接口以支持技能系统的通用效果执行
 * 这是技能系统与具体游戏解耦的核心抽象
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

// ============================================================================
// 技能管理器
// ============================================================================

/**
 * 技能上下文（用于触发条件判断）
 */
export interface AbilityContext {
    /** 当前阶段 */
    currentPhase: string;
    /** 骰子值列表 */
    diceValues?: number[];
    /** 骰面计数 { faceName: count } */
    faceCounts?: Record<string, number>;
    /** 玩家资源 { resourceId: amount } */
    resources?: Record<string, number>;
    /** 玩家状态效果 { statusId: stacks } */
    statusEffects?: Record<string, number>;
    /** 当前是否在终极触发期间（禁止响应） */
    isUltimateActive?: boolean;
    /** 被禁用的标签（如终极期间禁用 instant） */
    blockedTags?: AbilityTag[];
}

/**
 * 效果结算上下文（条件系统核心）
 * 用于在效果结算过程中传递状态，如已造成的伤害量
 */
export interface EffectResolutionContext {
    /** 攻击者 ID */
    attackerId: string;
    /** 防御者 ID */
    defenderId: string;
    /** 技能 ID */
    sourceAbilityId: string;
    /** 已造成的伤害量（用于 onHit 条件判断） */
    damageDealt: number;
    /** 攻击者状态效果 */
    attackerStatusEffects?: Record<string, number>;
    /** 防御者状态效果 */
    defenderStatusEffects?: Record<string, number>;
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

/**
 * 技能管理器
 */
export class AbilityManager {
    private definitions = new Map<string, AbilityDef>();

    /**
     * 注册技能定义
     */
    registerAbility(def: AbilityDef): void {
        this.definitions.set(def.id, def);
    }

    /**
     * 批量注册
     */
    registerAbilities(defs: AbilityDef[]): void {
        defs.forEach(def => this.registerAbility(def));
    }

    /**
     * 获取技能定义
     */
    getDefinition(id: string): AbilityDef | undefined {
        return this.definitions.get(id);
    }

    /**
     * 检查触发条件是否满足
     */
    checkTrigger(trigger: TriggerCondition, context: AbilityContext): boolean {
        switch (trigger.type) {
            case 'diceSet':
                return this.checkDiceSet(trigger, context);
            case 'smallStraight':
                return this.checkSmallStraight(context);
            case 'largeStraight':
                return this.checkLargeStraight(context);
            case 'phase':
                return this.checkPhase(trigger, context);
            case 'resource':
                return this.checkResource(trigger, context);
            case 'hasStatus':
                return this.checkStatus(trigger, context);
            case 'composite':
                return this.checkComposite(trigger, context);
            default:
                return false;
        }
    }

    /**
     * 检查技能是否被标签阻塞
     */
    private isBlockedByTags(def: AbilityDef, blockedTags?: AbilityTag[]): boolean {
        if (!blockedTags || blockedTags.length === 0) return false;
        if (!def.tags || def.tags.length === 0) return false;
        return def.tags.some(tag => blockedTags.includes(tag));
    }

    /**
     * 检查技能是否有指定标签
     */
    hasTag(abilityId: string, tag: AbilityTag): boolean {
        const def = this.definitions.get(abilityId);
        return def?.tags?.includes(tag) ?? false;
    }

    /**
     * 获取当前可用的技能 ID 列表
     */
    getAvailableAbilities(
        abilityIds: string[],
        context: AbilityContext
    ): string[] {
        const available: string[] = [];

        for (const abilityId of abilityIds) {
            const def = this.definitions.get(abilityId);
            if (!def) continue;

            // 检查标签阻塞（如终极期间禁用响应）
            if (this.isBlockedByTags(def, context.blockedTags)) continue;

            // 检查变体
            if (def.variants?.length) {
                for (const variant of def.variants) {
                    if (this.checkTrigger(variant.trigger, context)) {
                        available.push(variant.id);
                    }
                }
                continue;
            }

            // 检查单一触发条件
            if (def.trigger && this.checkTrigger(def.trigger, context)) {
                available.push(def.id);
            }
        }

        return available;
    }

    // ========================================================================
    // 条件系统：效果过滤与条件检查
    // ========================================================================

    /**
     * 获取指定时机的效果列表
     */
    getEffectsByTiming(effects: AbilityEffect[], timing: EffectTiming): AbilityEffect[] {
        return effects.filter(effect => {
            const effectTiming = this.getEffectTiming(effect);
            return effectTiming === timing;
        });
    }

    /**
     * 获取效果的实际触发时机（应用默认值）
     */
    getEffectTiming(effect: AbilityEffect): EffectTiming {
        if (effect.timing) return effect.timing;
        // 默认时机：伤害效果为 withDamage，非伤害效果为 preDefense
        if (effect.action?.type === 'damage') return 'withDamage';
        return 'preDefense';
    }

    /**
     * 检查效果条件是否满足
     */
    checkEffectCondition(effect: AbilityEffect, resolutionCtx: EffectResolutionContext): boolean {
        const condition = effect.condition ?? { type: 'always' };
        switch (condition.type) {
            case 'always':
                return true;
            case 'onHit':
                return resolutionCtx.damageDealt >= (condition.minDamage ?? 1);
            case 'onMiss':
                return resolutionCtx.damageDealt === 0;
            case 'hasStatus':
                return (resolutionCtx.attackerStatusEffects?.[condition.statusId] ?? 0) >= (condition.minStacks ?? 1);
            case 'targetHasStatus':
                return (resolutionCtx.defenderStatusEffects?.[condition.statusId] ?? 0) >= (condition.minStacks ?? 1);
            default:
                return true;
        }
    }

    /**
     * 结算指定时机的所有效果（使用 GameContext）
     * 返回本次结算造成的总伤害
     */
    resolveEffects(
        effects: AbilityEffect[],
        timing: EffectTiming,
        resolutionCtx: EffectResolutionContext,
        gameCtx: GameContext,
        config?: EffectResolutionConfig
    ): number {
        let totalDamage = 0;
        let bonusApplied = false;
        const timedEffects = this.getEffectsByTiming(effects, timing);
        
        for (const effect of timedEffects) {
            if (!effect.action) continue;
            if (!this.checkEffectCondition(effect, resolutionCtx)) continue;
            
            const damage = this.executeEffect(
                effect.action,
                resolutionCtx,
                gameCtx,
                config && !bonusApplied ? config.bonusDamage : undefined
            );
            
            if (damage > 0 && config?.bonusDamageOnce) {
                bonusApplied = true;
            }
            
            totalDamage += damage;
            resolutionCtx.damageDealt += damage;
        }
        
        return totalDamage;
    }

    /**
     * 执行单个效果（内部方法）
     * 通过 GameContext 接口调用游戏特定操作
     */
    private executeEffect(
        action: EffectAction,
        ctx: EffectResolutionContext,
        gameCtx: GameContext,
        bonusDamage?: number
    ): number {
        const { attackerId, defenderId, sourceAbilityId } = ctx;
        const targetId = action.target === 'self' ? attackerId : defenderId;
        
        switch (action.type) {
            case 'damage': {
                const totalValue = (action.value ?? 0) + (bonusDamage ?? 0);
                return gameCtx.applyDamage(targetId, totalValue, sourceAbilityId);
            }
            case 'heal': {
                gameCtx.applyHeal(targetId, action.value ?? 0, sourceAbilityId);
                return 0;
            }
            case 'grantStatus': {
                if (action.statusId) {
                    gameCtx.grantStatus(targetId, action.statusId, action.value ?? 1, sourceAbilityId);
                }
                return 0;
            }
            case 'removeStatus': {
                if (action.statusId) {
                    gameCtx.removeStatus(targetId, action.statusId, action.value, sourceAbilityId);
                }
                return 0;
            }
            case 'custom': {
                if (action.customActionId && gameCtx.executeCustomAction) {
                    gameCtx.executeCustomAction(action.customActionId, attackerId, defenderId, sourceAbilityId);
                }
                return 0;
            }
            default:
                return 0;
        }
    }

    /**
     * 计算伤害修改后的最终值
     */
    applyDamageModifiers(
        baseDamage: number,
        modifiers: DamageModifier[],
        availableResources: Record<string, number>
    ): { finalDamage: number; consumedResources: Record<string, number> } {
        let damage = baseDamage;
        const consumed: Record<string, number> = {};

        for (const mod of modifiers) {
            // 检查是否有足够资源支付
            if (mod.cost) {
                const available = availableResources[mod.cost.id] ?? 0;
                if (available < mod.cost.amount) continue;
                consumed[mod.cost.id] = (consumed[mod.cost.id] ?? 0) + mod.cost.amount;
            }

            switch (mod.type) {
                case 'increase':
                    damage += mod.value;
                    break;
                case 'decrease':
                    damage = Math.max(0, damage - mod.value);
                    break;
                case 'multiply':
                    damage = Math.floor(damage * mod.value);
                    break;
            }
        }

        return { finalDamage: damage, consumedResources: consumed };
    }

    // ========================================================================
    // 私有方法：触发条件检查
    // ========================================================================

    private checkDiceSet(trigger: DiceSetTrigger, context: AbilityContext): boolean {
        if (!context.faceCounts) return false;
        return Object.entries(trigger.faces).every(([face, required]) => {
            return (context.faceCounts?.[face] ?? 0) >= required;
        });
    }

    private checkSmallStraight(context: AbilityContext): boolean {
        if (!context.diceValues) return false;
        const unique = Array.from(new Set(context.diceValues));
        const sequences = [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]];
        return sequences.some(seq => seq.every(v => unique.includes(v)));
    }

    private checkLargeStraight(context: AbilityContext): boolean {
        if (!context.diceValues) return false;
        const unique = Array.from(new Set(context.diceValues));
        const sequences = [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]];
        return sequences.some(seq => seq.every(v => unique.includes(v)));
    }

    private checkPhase(trigger: PhaseTrigger, context: AbilityContext): boolean {
        if (context.currentPhase !== trigger.phaseId) return false;
        if (trigger.diceCount !== undefined && context.diceValues) {
            return context.diceValues.length >= trigger.diceCount;
        }
        return true;
    }

    private checkResource(trigger: ResourceTrigger, context: AbilityContext): boolean {
        const amount = context.resources?.[trigger.resourceId] ?? 0;
        return amount >= trigger.minAmount;
    }

    private checkStatus(trigger: StatusTrigger, context: AbilityContext): boolean {
        const stacks = context.statusEffects?.[trigger.statusId] ?? 0;
        return stacks >= (trigger.minStacks ?? 1);
    }

    private checkComposite(trigger: CompositeTrigger, context: AbilityContext): boolean {
        if (trigger.logic === 'and') {
            return trigger.conditions.every(c => this.checkTrigger(c, context));
        }
        return trigger.conditions.some(c => this.checkTrigger(c, context));
    }
}

// ============================================================================
// 单例导出
// ============================================================================

/** 全局技能管理器实例 */
export const abilityManager = new AbilityManager();
