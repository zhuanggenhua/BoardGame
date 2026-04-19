/**
 * 战斗预设条件系统（可扩展框架）
 *
 * 提供战斗类技能的通用条件类型与注册表，支持游戏自定义条件。
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
// 游戏扩展条件类型（由游戏层注册）
// ============================================================================

/**
 * 骰子组合条件
 */
export interface DiceSetCondition extends BaseCondition {
    type: 'diceSet';
    faces: Record<string, number>;
}

/**
 * 骰子顺子条件
 */
export interface DiceStraightCondition extends BaseCondition {
    type: 'smallStraight' | 'largeStraight';
}

/**
 * 阶段条件
 */
export interface PhaseCondition extends BaseCondition {
    type: 'phase';
    phaseId: string;
    diceCount?: number;
}

/**
 * 阶段开始条件
 * 用于角色板被动等非战斗技能（如枪手 quick-draw）
 */
export interface PhaseStartCondition extends BaseCondition {
    type: 'phaseStart';
    phase: string;
}

/**
 * 阶段结束条件
 * 用于回合结束类被动（如武士 Bushido）
 */
export interface PhaseEndCondition extends BaseCondition {
    type: 'phaseEnd';
    phase: string;
}

/**
 * 所有符号都存在条件（用于"禅武归一"、"武僧之路"等）
 */
export interface AllSymbolsPresentCondition extends BaseCondition {
    type: 'allSymbolsPresent';
    /** 需要存在的符号列表 */
    symbols: string[];
}

/**
 * 骰子和点数相关条件（用于狂战士等英雄）
 */
export interface RollSumCondition extends BaseCondition {
    type: 'rollSumGreaterThan';
    threshold: number;
}

export interface DiceCountCondition extends BaseCondition {
    type: 'diceCountAtLeast';
    face: string;
    count: number;
}

export interface ThreeOfAKindCondition extends BaseCondition {
    type: 'threeOfAKind';
}

// ============================================================================
// 条件类型别名
// ============================================================================

/**
 * 所有条件类型（包含游戏扩展）
 */
export type Condition =
    | CoreCondition
    | DiceSetCondition
    | DiceStraightCondition
    | PhaseCondition
    | PhaseStartCondition
    | PhaseEndCondition
    | AllSymbolsPresentCondition
    | RollSumCondition
    | DiceCountCondition
    | ThreeOfAKindCondition;

/**
 * 技能触发条件
 */
export type TriggerCondition =
    | DiceSetCondition
    | DiceStraightCondition
    | PhaseCondition
    | PhaseStartCondition
    | PhaseEndCondition
    | ResourceCondition
    | HasStatusCondition
    | CompositeCondition
    | AllSymbolsPresentCondition;

/**
 * 效果触发条件
 */
export type EffectCondition =
    | AlwaysCondition
    | OnHitCondition
    | OnMissCondition
    | HasStatusCondition
    | TargetHasStatusCondition
    | RollSumCondition
    | DiceCountCondition
    | ThreeOfAKindCondition;

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
 */
export interface EffectResolutionContext {
    attackerId: string;
    defenderId: string;
    sourceAbilityId: string;
    damageDealt: number;
    attackerStatusEffects?: Record<string, number>;
    defenderStatusEffects?: Record<string, number>;
    /** 当前骰子点数（用于 rollSum/diceCount 条件） */
    diceValues?: number[];
    /** 当前骰面统计（用于 diceCount/threeOfAKind 条件） */
    faceCounts?: Record<string, number>;
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
// 游戏扩展条件评估器（由游戏层注册）
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
        if (!diceValues || diceValues.length < condition.diceCount) return false;
    }
    return true;
};

export const evaluatePhaseStart: ConditionEvaluator<PhaseStartCondition> = (condition, ctx) => {
    return ctx.currentPhase === condition.phase;
};

export const evaluatePhaseEnd: ConditionEvaluator<PhaseEndCondition> = (condition, ctx) => {
    return ctx.currentPhase === condition.phase;
};

/**
 * 判断所有指定符号是否都存在（每个至少1个）
 * 用于"禅武归一"（拳+掌+太极）、"武僧之路"（拳+掌+太极+莲花）等触发条件
 */
export const evaluateAllSymbolsPresent: ConditionEvaluator<AllSymbolsPresentCondition> = (condition, ctx) => {
    const faceCounts = ctx.faceCounts as Record<string, number> | undefined;
    if (!faceCounts) return false;
    return condition.symbols.every(symbol => (faceCounts[symbol] ?? 0) >= 1);
};

/**
 * 骰子点数总和大于阈值
 */
export const evaluateRollSumGreaterThan: ConditionEvaluator<RollSumCondition> = (condition, ctx) => {
    const diceValues = ctx.diceValues as number[] | undefined;
    if (!diceValues || diceValues.length === 0) return false;
    const sum = diceValues.reduce((acc, v) => acc + v, 0);
    return sum > condition.threshold;
};

/**
 * 指定骰面至少出现 count 次
 */
export const evaluateDiceCountAtLeast: ConditionEvaluator<DiceCountCondition> = (condition, ctx) => {
    const faceCounts = ctx.faceCounts as Record<string, number> | undefined;
    if (!faceCounts) return false;
    return (faceCounts[condition.face] ?? 0) >= condition.count;
};

/**
 * 三条（任意骰面 >= 3）
 */
export const evaluateThreeOfAKind: ConditionEvaluator<ThreeOfAKindCondition> = (_, ctx) => {
    const faceCounts = ctx.faceCounts as Record<string, number> | undefined;
    if (!faceCounts) return false;
    return Object.values(faceCounts).some(count => count >= 3);
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
    // conditionRegistry.register('diceSet', evaluateDiceSet)
    // conditionRegistry.register('smallStraight', evaluateSmallStraight)
    // conditionRegistry.register('largeStraight', evaluateLargeStraight)
    // conditionRegistry.register('phase', evaluatePhase)

    return registry;
}

/** 全局条件注册表实例 */
export const conditionRegistry = createConditionRegistry();

// ============================================================================
// 便捷评估函数
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
    const condCtx: ConditionContext = {
        damageDealt: ctx.damageDealt,
        statusEffects: ctx.attackerStatusEffects,
        targetStatusEffects: ctx.defenderStatusEffects,
        diceValues: ctx.diceValues,
        faceCounts: ctx.faceCounts,
    };
    return conditionRegistry.evaluate(condition, condCtx);
}
