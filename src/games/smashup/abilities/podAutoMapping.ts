/**
 * POD 版本能力自动映射
 * 
 * 核心原则：
 * 1. 基础版本正常注册能力/触发器
 * 2. POD 版本自动映射到基础版本（除非显式覆盖）
 * 3. 只有规则不同的 POD 卡牌才需要单独注册
 * 
 * 使用方式：
 * ```typescript
 * // 1. 正常注册基础版本
 * registerAbility('alien_scout', 'onPlay', alienScout);
 * // ongoing trigger 也会通过别名注册器自动映射
 * 
 * // 2. 在所有派系注册完成后，调用一次自动映射
 * autoMapPodAbilities();
 * 
 * // 3. 如果 POD 版本规则不同，显式注册会覆盖自动映射
 * registerAbility('dino_laser_triceratops_pod', 'onPlay', dinoLaserTriceratopsPod);
 * ```
 */

import { registerPodAbilityAliases } from '../domain/abilityRegistry';
import { registerPodOngoingAliases } from '../domain/ongoingEffects';

/**
 * 自动为所有 POD 版本创建能力映射
 * 
 * 规则：
 * - 如果 `xxx_pod` 已经注册，跳过（显式覆盖优先）
 * - 如果 `xxx` 存在，自动创建 `xxx_pod` → `xxx` 的映射
 * 
 * 支持的注册类型：
 * - registerAbility (onPlay/talent/special)
 * - registerTrigger (onTurnStart/afterScoring/...)
 * - registerRestriction (play_minion/play_action)
 * - registerProtection (destroy/move/affect/action)
 * - registerBaseAbilitySuppression
 */
export function autoMapPodAbilities(): void {
    registerPodAbilityAliases();
    registerPodOngoingAliases();
}

/**
 * 检查是否有 POD 卡牌缺失能力注册
 * 
 * 用于开发时验证：
 * - 所有 POD 卡牌都应该有对应的能力（自动映射或显式注册）
 * - 如果发现缺失，输出警告
 * 
 * @returns 缺失的 POD 卡牌列表
 */
export function validatePodAbilities(): string[] {
    const missing: string[] = [];
    
    // 获取所有 POD 卡牌的 defId
    // 注意：这需要从 cards.ts 中获取，暂时跳过
    // TODO: 实现完整的验证逻辑
    
    return missing;
}
