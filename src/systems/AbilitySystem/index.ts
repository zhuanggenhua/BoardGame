/**
 * 通用技能系统
 *
 * 支持任意游戏的技能定义、触发条件判断、效果执行。
 * 设计原则：
 * - 技能定义与具体游戏解耦
 * - 支持多种触发条件类型
 * - 可程序化执行效果或保留文本描述
 */

// 条件系统
export {
    // 基础接口
    type BaseCondition,
    type ConditionContext,
    type ConditionEvaluator,
    // 核心条件类型
    type CoreCondition,
    type AlwaysCondition,
    type ResourceCondition,
    type HasStatusCondition,
    type TargetHasStatusCondition,
    type OnHitCondition,
    type OnMissCondition,
    type CompositeCondition,
    // 游戏扩展条件类型（向后兼容）
    type Condition,
    type TriggerCondition,
    type EffectCondition,
    type DiceSetCondition,
    type DiceStraightCondition,
    type PhaseCondition,
    // 旧上下文类型（向后兼容）
    type AbilityContext,
    type EffectResolutionContext,
    // 条件注册表
    ConditionRegistry,
    createConditionRegistry,
    conditionRegistry,
    // 便捷评估函数
    evaluateTriggerCondition,
    evaluateEffectCondition,
    // 游戏扩展条件评估器（供游戏层注册使用）
    evaluateDiceSet,
    evaluateSmallStraight,
    evaluateLargeStraight,
    evaluatePhase,
} from './conditions';

// 类型定义
export {
    type EffectTiming,
    type AbilityEffect,
    type AbilityType,
    type AbilityTag,
    type DamageModifier,
    type AbilityVariantDef,
    type AbilityDef,
    type GameContext,
    type EffectResolutionConfig,
} from './types';

// 管理器
export { AbilityManager, abilityManager } from './manager';
