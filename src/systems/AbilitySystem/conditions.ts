/**
 * 条件子模块（可扩展框架）
 *
 * 提供通用条件类型和可扩展的条件注册表，支持游戏自定义条件。
 * 设计原则：
 * - 核心条件类型（always, composite, resource, status）由框架提供
 * - 游戏特定条件（如骰子组合）通过注册表扩展
 * - 支持 UGC 自定义条件
 */

// ============================================================================
// 基础条件接口
// ============================================================================

/**
 * 条件基础接口 - 所有条件必须实现
 */
export interface BaseCondition {
    type: string;
}

// ============================================================================
// 核心条件类型（框架内置）
// ============================================================================

/**
 * 无条件（始终为真）
 */
export interface AlwaysCondition extends BaseCondition {
    type: 'always';
}

/**
 * 资源条件
 */
export interface ResourceCondition extends BaseCondition {
    type: 'resource';
    resourceId: string;
    minAmount?: number;
    maxAmount?: number;
}

/**
 * 状态效果条件（自身）
 */
export interface HasStatusCondition extends BaseCondition {
    type: 'hasStatus';
    statusId: string;
    minStacks?: number;
}

/**
 * 状态效果条件（目标）
 */
export interface TargetHasStatusCondition extends BaseCondition {
    type: 'targetHasStatus';
    statusId: string;
    minStacks?: number;
}

/**
 * 伤害条件（用于 Then 语义）
 */
export interface OnHitCondition extends BaseCondition {
    type: 'onHit';
    minDamage?: number;
}

/**
 * 未命中条件
 */
export interface OnMissCondition extends BaseCondition {
    type: 'onMiss';
}

/**
 * 复合条件
 */
export interface CompositeCondition extends BaseCondition {
    type: 'composite';
    conditions: BaseCondition[];
    logic: 'and' | 'or';
}

/**
 * 核心条件类型联合
 */
export type CoreCondition =
    | AlwaysCondition
    | ResourceCondition
    | HasStatusCondition
    | TargetHasStatusCondition
    | OnHitCondition
    | OnMissCondition
    | CompositeCondition;

// ============================================================================
// 游戏扩展条件类型（向后兼容，将迁移到游戏层）
// ============================================================================

/**
 * 骰子组合条件
 * @deprecated 将迁移到游戏层
 */
export interface DiceSetCondition extends BaseCondition {
    type: 'diceSet';
    faces: Record<string, number>;
}

/**
 * 骰子顺子条件
 * @deprecated 将迁移到游戏层
 */
export interface DiceStraightCondition extends BaseCondition {
    type: 'smallStraight' | 'largeStraight';
}

/**
 * 阶段条件
 * @deprecated 将迁移到游戏层
 */
export interface PhaseCondition extends BaseCondition {
    type: 'phase';
    phaseId: string;
    diceCount?: number;
}

// ============================================================================
// 条件类型别名（向后兼容）
// ============================================================================

/**
 * 所有条件类型（包含游戏扩展）
 */
export type Condition =
    | CoreCondition
    | DiceSetCondition
    | DiceStraightCondition
    | PhaseCondition;

/**
 * 技能触发条件（向后兼容别名）
 */
export type TriggerCondition =
    | DiceSetCondition
    | DiceStraightCondition
    | PhaseCondition
    | ResourceCondition
    | HasStatusCondition
    | CompositeCondition;

/**
 * 效果触发条件（向后兼容别名）
 */
export type EffectCondition =
    | AlwaysCondition
    | OnHitCondition
    | OnMissCondition
    | HasStatusCondition
    | TargetHasStatusCondition;

// ============================================================================
// 条件上下文
// ============================================================================

/**
 * 通用条件上下文（可扩展）
 */
export interface ConditionContext {
    /** 当前阶段 */
    currentPhase?: string;
    /** 玩家资源 { resourceId: amount } */
    resources?: Record<string, number>;
    /** 自身状态效果 { statusId: stacks } */
    statusEffects?: Record<string, number>;
    /** 目标状态效果 { statusId: stacks } */
    targetStatusEffects?: Record<string, number>;
    /** 已造成的伤害量 */
    damageDealt?: number;
    /** 游戏特定扩展数据 */
    [key: string]: unknown;
}

/**
 * 技能上下文（用于触发条件判断）
 * @deprecated 使用 ConditionContext
 */
export interface AbilityContext extends ConditionContext {
    currentPhase: string;
    diceValues?: number[];
    faceCounts?: Record<string, number>;
    isUltimateActive?: boolean;
    blockedTags?: string[];
}

/**
 * 效果结算上下文
 * @deprecated 使用 ConditionContext
 */
export interface EffectResolutionContext {
    attackerId: string;
    defenderId: string;
    sourceAbilityId: string;
    damageDealt: number;
    attackerStatusEffects?: Record<string, number>;
    defenderStatusEffects?: Record<string, number>;
}

// ============================================================================
// 条件评估器注册表
// ============================================================================

/**
 * 条件评估器函数类型
 */
export type ConditionEvaluator<T extends BaseCondition = BaseCondition> = (
    condition: T,
    context: ConditionContext
) => boolean;

/**
 * 条件注册表 - 支持游戏扩展自定义条件
 */
export class ConditionRegistry {
    private evaluators = new Map<string, ConditionEvaluator>();

    /**
     * 注册条件评估器
     */
    register<T extends BaseCondition>(type: string, evaluator: ConditionEvaluator<T>): void {
        this.evaluators.set(type, evaluator as ConditionEvaluator);
    }

    /**
     * 评估条件
     */
    evaluate(condition: BaseCondition, context: ConditionContext): boolean {
        const evaluator = this.evaluators.get(condition.type);
        if (!evaluator) {
            console.warn(`Unknown condition type: ${condition.type}`);
            return false;
        }
        return evaluator(condition, context);
    }

    /**
     * 检查条件类型是否已注册
     */
    has(type: string): boolean {
        return this.evaluators.has(type);
    }
}

// ============================================================================
// 核心条件评估器
// ============================================================================

const evaluateAlways: ConditionEvaluator<AlwaysCondition> = () => true;

const evaluateResource: ConditionEvaluator<ResourceCondition> = (condition, ctx) => {
    const amount = ctx.resources?.[condition.resourceId] ?? 0;
    if (condition.minAmount !== undefined && amount < condition.minAmount) return false;
    if (condition.maxAmount !== undefined && amount > condition.maxAmount) return false;
    return true;
};

const evaluateHasStatus: ConditionEvaluator<HasStatusCondition> = (condition, ctx) => {
    return (ctx.statusEffects?.[condition.statusId] ?? 0) >= (condition.minStacks ?? 1);
};

const evaluateTargetHasStatus: ConditionEvaluator<TargetHasStatusCondition> = (condition, ctx) => {
    return (ctx.targetStatusEffects?.[condition.statusId] ?? 0) >= (condition.minStacks ?? 1);
};

const evaluateOnHit: ConditionEvaluator<OnHitCondition> = (condition, ctx) => {
    return (ctx.damageDealt ?? 0) >= (condition.minDamage ?? 1);
};

const evaluateOnMiss: ConditionEvaluator<OnMissCondition> = (_, ctx) => {
    return (ctx.damageDealt ?? 0) === 0;
};

/**
 * 创建复合条件评估器（需要注册表引用）
 */
function createCompositeEvaluator(registry: ConditionRegistry): ConditionEvaluator<CompositeCondition> {
    return (condition, ctx) => {
        if (condition.logic === 'and') {
            return condition.conditions.every(c => registry.evaluate(c, ctx));
        }
        return condition.conditions.some(c => registry.evaluate(c, ctx));
    };
}

// ============================================================================
// 游戏扩展条件评估器（向后兼容，将迁移）
// ============================================================================

export const evaluateDiceSet: ConditionEvaluator<DiceSetCondition> = (condition, ctx) => {
    const faceCounts = ctx.faceCounts as Record<string, number> | undefined;
    if (!faceCounts) return false;
    return Object.entries(condition.faces).every(([face, required]) => {
        return (faceCounts[face] ?? 0) >= required;
    });
};

export const evaluateSmallStraight: ConditionEvaluator<DiceStraightCondition> = (_, ctx) => {
    const diceValues = ctx.diceValues as number[] | undefined;
    if (!diceValues) return false;
    const unique = Array.from(new Set(diceValues));
    const sequences = [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]];
    return sequences.some(seq => seq.every(v => unique.includes(v)));
};

export const evaluateLargeStraight: ConditionEvaluator<DiceStraightCondition> = (_, ctx) => {
    const diceValues = ctx.diceValues as number[] | undefined;
    if (!diceValues) return false;
    const unique = Array.from(new Set(diceValues));
    const sequences = [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]];
    return sequences.some(seq => seq.every(v => unique.includes(v)));
};

export const evaluatePhase: ConditionEvaluator<PhaseCondition> = (condition, ctx) => {
    if (ctx.currentPhase !== condition.phaseId) return false;
    if (condition.diceCount !== undefined) {
        const diceValues = ctx.diceValues as number[] | undefined;
        if (diceValues && diceValues.length < condition.diceCount) return false;
    }
    return true;
};

// ============================================================================
// 默认注册表实例
// ============================================================================

/**
 * 创建并初始化条件注册表（含核心条件）
 */
export function createConditionRegistry(): ConditionRegistry {
    const registry = new ConditionRegistry();

    // 注册核心条件
    registry.register('always', evaluateAlways);
    registry.register('resource', evaluateResource);
    registry.register('hasStatus', evaluateHasStatus);
    registry.register('targetHasStatus', evaluateTargetHasStatus);
    registry.register('onHit', evaluateOnHit);
    registry.register('onMiss', evaluateOnMiss);
    registry.register('composite', createCompositeEvaluator(registry));

    // 游戏扩展条件不默认注册，改由游戏层显式注册（避免框架耦合）
    // 兼容旧代码：若需要在框架层默认启用，请在游戏入口调用：
    //   conditionRegistry.register('diceSet', evaluateDiceSet)
    //   conditionRegistry.register('smallStraight', evaluateSmallStraight)
    //   conditionRegistry.register('largeStraight', evaluateLargeStraight)
    //   conditionRegistry.register('phase', evaluatePhase)

    return registry;
}

/** 全局条件注册表实例 */
export const conditionRegistry = createConditionRegistry();

// ============================================================================
// 便捷评估函数（向后兼容）
// ============================================================================

/**
 * 评估触发条件
 */
export function evaluateTriggerCondition(
    condition: TriggerCondition,
    ctx: AbilityContext
): boolean {
    return conditionRegistry.evaluate(condition, ctx as ConditionContext);
}

/**
 * 评估效果条件
 */
export function evaluateEffectCondition(
    condition: EffectCondition,
    ctx: EffectResolutionContext
): boolean {
    // 转换为通用上下文
    const condCtx: ConditionContext = {
        damageDealt: ctx.damageDealt,
        statusEffects: ctx.attackerStatusEffects,
        targetStatusEffects: ctx.defenderStatusEffects,
    };
    return conditionRegistry.evaluate(condition, condCtx);
}
