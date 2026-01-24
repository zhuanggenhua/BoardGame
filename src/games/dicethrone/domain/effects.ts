/**
 * DiceThrone 效果解析器
 * 将 AbilityEffect 转换为 DiceThroneEvent（事件驱动）
 */

import type { PlayerId } from '../../../engine/types';
import type { EffectAction } from '../../../systems/StatusEffectSystem';
import type { AbilityEffect, EffectTiming, EffectResolutionContext } from '../../../systems/AbilitySystem';
import { abilityManager } from '../../../systems/AbilitySystem';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    DamageDealtEvent,
    HealAppliedEvent,
    StatusAppliedEvent,
    StatusRemovedEvent,
} from './types';

// ============================================================================
// 效果上下文
// ============================================================================

export interface EffectContext {
    attackerId: PlayerId;
    defenderId: PlayerId;
    sourceAbilityId: string;
    state: DiceThroneCore;
    damageDealt: number;
}

// ============================================================================
// 效果解析器
// ============================================================================

/**
 * 将单个效果动作转换为事件
 */
function resolveEffectAction(
    action: EffectAction,
    ctx: EffectContext,
    bonusDamage?: number
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const timestamp = Date.now();
    const { attackerId, defenderId, sourceAbilityId, state } = ctx;
    const targetId = action.target === 'self' ? attackerId : defenderId;

    switch (action.type) {
        case 'damage': {
            const totalValue = (action.value ?? 0) + (bonusDamage ?? 0);
            const target = state.players[targetId];
            const actualDamage = target ? Math.min(totalValue, target.health) : 0;
            
            const event: DamageDealtEvent = {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId,
                    amount: totalValue,
                    actualDamage,
                    sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            };
            events.push(event);
            ctx.damageDealt += actualDamage;
            break;
        }

        case 'heal': {
            const event: HealAppliedEvent = {
                type: 'HEAL_APPLIED',
                payload: {
                    targetId,
                    amount: action.value ?? 0,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'grantStatus': {
            if (!action.statusId) break;
            const target = state.players[targetId];
            const currentStacks = target?.statusEffects[action.statusId] ?? 0;
            const def = state.statusDefinitions.find(e => e.id === action.statusId);
            const maxStacks = def?.stackLimit || 99;
            const stacksToAdd = action.value ?? 1;
            const newTotal = Math.min(currentStacks + stacksToAdd, maxStacks);
            
            const event: StatusAppliedEvent = {
                type: 'STATUS_APPLIED',
                payload: {
                    targetId,
                    statusId: action.statusId,
                    stacks: stacksToAdd,
                    newTotal,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'removeStatus': {
            if (!action.statusId) break;
            const event: StatusRemovedEvent = {
                type: 'STATUS_REMOVED',
                payload: {
                    targetId,
                    statusId: action.statusId,
                    stacks: action.value ?? 1,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'custom': {
            // 自定义动作需要单独处理，这里生成通用事件
            // TODO: 根据 actionId 生成特定事件
            break;
        }
    }

    return events;
}

/**
 * 解析指定时机的所有效果，生成事件
 */
export function resolveEffectsToEvents(
    effects: AbilityEffect[],
    timing: EffectTiming,
    ctx: EffectContext,
    config?: { bonusDamage?: number; bonusDamageOnce?: boolean }
): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    let bonusApplied = false;

    // 构建 EffectResolutionContext 用于条件检查
    const resolutionCtx: EffectResolutionContext = {
        attackerId: ctx.attackerId,
        defenderId: ctx.defenderId,
        sourceAbilityId: ctx.sourceAbilityId,
        damageDealt: ctx.damageDealt,
        attackerStatusEffects: ctx.state.players[ctx.attackerId]?.statusEffects,
        defenderStatusEffects: ctx.state.players[ctx.defenderId]?.statusEffects,
    };

    const timedEffects = abilityManager.getEffectsByTiming(effects, timing);

    for (const effect of timedEffects) {
        if (!effect.action) continue;
        if (!abilityManager.checkEffectCondition(effect, resolutionCtx)) continue;

        const bonus = config && !bonusApplied ? config.bonusDamage : undefined;
        const effectEvents = resolveEffectAction(effect.action, ctx, bonus);
        events.push(...effectEvents);

        // 如果产生伤害且只允许一次加成
        if (effectEvents.some(e => e.type === 'DAMAGE_DEALT') && config?.bonusDamageOnce) {
            bonusApplied = true;
        }

        // 更新 resolutionCtx.damageDealt 用于后续条件检查
        resolutionCtx.damageDealt = ctx.damageDealt;
    }

    return events;
}

/**
 * 获取技能的所有效果
 */
export function getAbilityEffects(abilityId: string): AbilityEffect[] {
    const def = abilityManager.getDefinition(abilityId);
    if (!def) return [];

    // 检查是否是变体 ID
    if (def.variants) {
        const variant = def.variants.find(v => v.id === abilityId);
        if (variant?.effects) return variant.effects;
    }

    return def.effects ?? [];
}
