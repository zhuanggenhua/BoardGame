/**
 * DiceThrone 技能查询工具
 * 
 * 注意：升级卡会在运行时替换玩家的技能定义（player.abilities），
 * 因此所有与技能相关的判定（可用技能/技能效果/不可防御标签等）
 * 都必须以 player.abilities 为准，而不是全局注册表。
 */

import type { PlayerId } from '../../../engine/types';
import type { AbilityDef, AbilityEffect, AbilityTag, AbilityVariantDef } from './combat';
import type { DiceThroneCore } from './types';
import { getCustomActionMeta } from './effects';

export type PlayerAbilityMatch = { ability: AbilityDef; variant?: AbilityVariantDef };

/**
 * 在玩家技能列表中查找技能（支持变体 ID）
 */
export function findPlayerAbility(
    state: DiceThroneCore,
    playerId: PlayerId,
    abilityId: string
): PlayerAbilityMatch | null {
    const player = state.players[playerId];
    if (!player) return null;

    for (const ability of player.abilities) {
        if (ability.variants?.length) {
            const variant = ability.variants.find(v => v.id === abilityId);
            if (variant) return { ability, variant };
        }

        if (ability.id === abilityId) {
            return { ability };
        }
    }

    return null;
}

/**
 * 获取技能效果列表（若是变体 ID，返回变体 effects）
 */
export function getPlayerAbilityEffects(
    state: DiceThroneCore,
    playerId: PlayerId,
    abilityId: string
): AbilityEffect[] {
    const match = findPlayerAbility(state, playerId, abilityId);
    if (!match) return [];
    return match.variant?.effects ?? match.ability.effects ?? [];
}

/**
 * 判断该技能是否包含伤害效果（用于是否进入防御投掷阶段）
 *
 * 检查范围：
 * - 显式 damage action（value > 0）
 * - rollDie action 的 conditionalEffects 中包含 bonusDamage
 * - custom action 的 categories 包含 'damage'
 *
 * 只有纯 buff/token/heal/cp 技能才返回 false
 * 
 * 修复历史：
 * - 之前只要有 rollDie 就返回 true，导致纯 buff/heal 技能（如圣骑士圣光）也触发防御阶段
 * - 现在精确检查 rollDie 的 conditionalEffects 是否包含 bonusDamage
 * - 支持 variants：如果技能有 variants，检查所有 variants 是否有伤害
 */
export function playerAbilityHasDamage(
    state: DiceThroneCore,
    playerId: PlayerId,
    abilityId: string
): boolean {
    const match = findPlayerAbility(state, playerId, abilityId);
    if (!match) return false;

    // 如果是 variant ID，检查该 variant 的 effects
    if (match.variant) {
        return hasEffectDamage(match.variant.effects ?? []);
    }

    // 如果是父 ability ID 且有 variants，检查所有 variants
    if (match.ability.variants?.length) {
        return match.ability.variants.some(v => hasEffectDamage(v.effects ?? []));
    }

    // 否则检查 ability 的 effects
    return hasEffectDamage(match.ability.effects ?? []);
}

/**
 * 检查 effects 数组是否包含伤害效果
 */
function hasEffectDamage(effects: AbilityEffect[]): boolean {
    return effects.some(e => {
        if (!e.action) return false;
        
        // 1. 显式伤害
        if (e.action.type === 'damage' && (e.action.value ?? 0) > 0) {
            return true;
        }
        
        // 2. rollDie：只有 conditionalEffects 包含 bonusDamage 才算有伤害
        if (e.action.type === 'rollDie') {
            const conditionalEffects = e.action.conditionalEffects ?? [];
            return conditionalEffects.some(ce => (ce.bonusDamage ?? 0) > 0);
        }
        
        // 3. custom action：通过注册的 categories 判断是否包含伤害
        // 严格依赖 categories 声明，不再使用 target=opponent 的保守判定
        // 根据官方规则：只有"造成至少 1 点伤害"的能力才算"攻击"，才会触发防御阶段
        // 偷窃 CP 等资源转移效果不造成伤害，不应触发防御阶段
        if (e.action.type === 'custom' && e.action.customActionId) {
            const meta = getCustomActionMeta(e.action.customActionId);
            return meta?.categories.includes('damage') ?? false;
        }
        
        return false;
    });
}

/**
 * 计算技能的预期基础伤害（用于暴击门控判断）
 * 只计算显式 damage action 的 value，不包括 rollDie/custom action 的动态伤害
 * 
 * 注意：这是一个保守估计，实际伤害可能更高（如 rollDie 的 bonusDamage）
 */
export function getPlayerAbilityBaseDamage(
    state: DiceThroneCore,
    playerId: PlayerId,
    abilityId: string
): number {
    const effects = getPlayerAbilityEffects(state, playerId, abilityId);
    let totalDamage = 0;
    
    for (const effect of effects) {
        if (!effect.action) continue;
        // 只计算显式 damage action
        if (effect.action.type === 'damage' && typeof effect.action.value === 'number') {
            totalDamage += effect.action.value;
        }
    }
    
    return totalDamage;
}

/**
 * 判断该技能（所属的 AbilityDef）是否包含指定标签
 * 注意：标签目前定义在 AbilityDef 上，而不是 Variant 上。
 */
export function playerAbilityHasTag(
    state: DiceThroneCore,
    playerId: PlayerId,
    abilityId: string,
    tag: AbilityTag
): boolean {
    const match = findPlayerAbility(state, playerId, abilityId);
    return match?.ability.tags?.includes(tag) ?? false;
}
