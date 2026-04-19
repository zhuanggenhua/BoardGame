/**
 * 战斗类游戏预设
 * 
 * 提供回合制战斗游戏的技能系统预设：
 * - 效果时机（EffectTiming）
 * - 伤害修改器（DamageModifier）
 * - 战斗技能定义和管理
 * - 战斗游戏上下文
 * 
 * 适用于 DiceThrone、战棋等回合制战斗游戏。
 */

// 类型导出
export type {
  EffectTiming,
  DamageModifier,
  AbilityEffect,
  AbilityType,
  AbilityTag,
  AbilityVariantDef,
  AbilityDef,
  GameContext,
  EffectResolutionConfig,
} from './types';

// 管理器
export {
  type CombatAbilityContext,
  CombatAbilityManager,
  createCombatAbilityManager,
} from './CombatAbilityManager';

// 条件系统
export {
  type BaseCondition,
  type CoreCondition,
  type Condition,
  type TriggerCondition,
  type EffectCondition,
  type AbilityContext,
  type EffectResolutionContext,
  type ConditionContext,
  type ConditionEvaluator,
  ConditionRegistry,
  createConditionRegistry,
  conditionRegistry,
  evaluateTriggerCondition,
  evaluateEffectCondition,
  evaluateDiceSet,
  evaluateSmallStraight,
  evaluateLargeStraight,
  evaluatePhase,
  evaluateAllSymbolsPresent,
  evaluateRollSumGreaterThan,
  evaluateDiceCountAtLeast,
  evaluateThreeOfAKind,
  evaluatePhaseStart,
  evaluatePhaseEnd,
} from './conditions';
