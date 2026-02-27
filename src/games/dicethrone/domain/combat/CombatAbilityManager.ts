/**
 * 战斗技能管理器
 * 
 * 适用于回合制战斗游戏，提供技能注册、触发检查、效果结算等功能。
 */

import type {
  AbilityDef,
  AbilityEffect,
  AbilityTag,
  DamageModifier,
  EffectTiming,
  GameContext,
  EffectResolutionConfig,
} from './types';
import { getCustomActionMeta } from '../effects';
import type {
  AbilityContext,
  EffectCondition,
  EffectResolutionContext,
  TriggerCondition,
} from './conditions';
import { evaluateEffectCondition, evaluateTriggerCondition } from './conditions';

// ============================================================================
// 条件上下文
// ============================================================================

/**
 * 技能触发上下文
 */
export type CombatAbilityContext = AbilityContext;

// ============================================================================
// 战斗技能管理器
// ============================================================================

export class CombatAbilityManager {
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
   * 检查触发条件
   */
  checkTrigger(trigger: TriggerCondition, context: CombatAbilityContext): boolean {
    return evaluateTriggerCondition(trigger, context);
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
   * 
   * 注意：此方法从全局注册表获取技能定义，不适用于 DiceThrone 的升级机制。
   * DiceThrone 应该直接从 player.abilities 匹配，因为升级卡会替换技能定义。
   */
  getAvailableAbilities(
    abilityIds: string[],
    context: CombatAbilityContext
  ): string[] {
    const available: string[] = [];

    for (const abilityId of abilityIds) {
      const def = this.definitions.get(abilityId);
      if (!def) continue;

      // 检查标签阻塞
      if (context.blockedTags?.some(tag => def.tags?.includes(tag as AbilityTag))) continue;

      // 检查变体：按 priority 降序排列
      if (def.variants?.length) {
        const matched: { id: string; priority: number }[] = [];
        for (const variant of def.variants) {
          if (this.checkTrigger(variant.trigger, context)) {
            matched.push({ id: variant.id, priority: variant.priority ?? 0 });
          }
        }
        matched.sort((a, b) => b.priority - a.priority);
        for (const m of matched) {
          available.push(m.id);
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

  // --------------------------------------------------------------------------
  // 效果结算
  // --------------------------------------------------------------------------

  /**
   * 纯非伤害分类集合 — 只包含这些分类的 custom action 可以在 preDefense 结算
   */
  private static readonly PRE_DEFENSE_CATEGORIES = new Set(['resource', 'status', 'token', 'choice']);

  /**
   * 获取效果的实际触发时机
   * 
   * 规则：preDefense 只结算非伤害效果，包含伤害的效果必须在 withDamage 结算。
   * 对于 custom action，通过注册时的 categories 元数据自动推断：
   * - categories 全部为纯非伤害类（resource/status/token/choice）→ preDefense
   * - 包含 damage/dice/other/defense/card 等可能产生伤害的分类 → withDamage
   */
  getEffectTiming(effect: AbilityEffect): EffectTiming {
    if (effect.timing) return effect.timing;
    if (effect.action?.type === 'damage') return 'withDamage';
    // rollDie 效果需要 random，必须在 withDamage 时机执行（preDefense 不传 random）
    if (effect.action?.type === 'rollDie') return 'withDamage';
    // drawCard 效果需要 random（洗牌），必须在 withDamage 时机执行
    if (effect.action?.type === 'drawCard') return 'withDamage';
    // custom action：根据注册的 categories 自动推断时机
    if (effect.action?.type === 'custom' && effect.action.customActionId) {
      const meta = getCustomActionMeta(effect.action.customActionId);
      if (meta) {
        const allPreDefense = meta.categories.every(c => CombatAbilityManager.PRE_DEFENSE_CATEGORIES.has(c));
        return allPreDefense ? 'preDefense' : 'withDamage';
      }
      // 未注册的 custom action 保守处理，走 withDamage
      return 'withDamage';
    }
    return 'preDefense';
  }

  /**
   * 获取指定时机的效果列表
   */
  getEffectsByTiming(effects: AbilityEffect[], timing: EffectTiming): AbilityEffect[] {
    return effects.filter(effect => this.getEffectTiming(effect) === timing);
  }

  /**
   * 检查效果条件
   */
  checkEffectCondition(effect: AbilityEffect, ctx: EffectResolutionContext): boolean {
    const condition: EffectCondition = effect.condition ?? { type: 'always' };
    return evaluateEffectCondition(condition, ctx);
  }

  /**
   * 结算指定时机的所有效果
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
        effect,
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

  private executeEffect(
    effect: AbilityEffect,
    ctx: EffectResolutionContext,
    gameCtx: GameContext,
    bonusDamage?: number
  ): number {
    const action = effect.action;
    if (!action) return 0;

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

  // --------------------------------------------------------------------------
  // 伤害修改器
  // --------------------------------------------------------------------------

  /**
   * 应用伤害修改器
   */
  applyDamageModifiers(
    baseDamage: number,
    modifiers: DamageModifier[],
    availableResources: Record<string, number>
  ): { finalDamage: number; consumedResources: Record<string, number> } {
    let damage = baseDamage;
    const consumed: Record<string, number> = {};

    for (const mod of modifiers) {
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
}

/**
 * 创建战斗技能管理器
 */
export function createCombatAbilityManager(): CombatAbilityManager {
  return new CombatAbilityManager();
}
