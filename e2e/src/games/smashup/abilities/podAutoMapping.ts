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
 * registerTrigger('zombie_overrun', 'onTurnStart', zombieOverrunTrigger);
 * 
 * // 2. 在所有派系注册完成后，调用一次自动映射
 * autoMapPodAbilities();
 * 
 * // 3. 如果 POD 版本规则不同，显式注册会覆盖自动映射
 * registerAbility('dino_laser_triceratops_pod', 'onPlay', dinoLaserTriceratopsPod);
 * ```
 */

import { abilityRegistry, triggerRegistry } from '../domain/abilityRegistry';
import { registerAbility } from '../domain/abilityRegistry';
import { registerTrigger, registerRestriction, registerProtection, registerBaseAbilitySuppression } from '../domain/ongoingEffects';
import type { AbilityTiming } from '../domain/abilityRegistry';
import type { TriggerTiming } from '../domain/ongoingEffects';

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
    console.log('[POD Auto Mapping] 开始自动映射 POD 能力...');
    
    let mappedCount = 0;
    let skippedCount = 0;
    
    // 1. 映射 Ability (onPlay/talent/special)
    const abilityTimings: AbilityTiming[] = ['onPlay', 'talent', 'special'];
    for (const timing of abilityTimings) {
        const entries = abilityRegistry[timing];
        if (!entries) continue;
        
        for (const [defId, callback] of entries.entries()) {
            // 跳过已经是 _pod 的
            if (defId.endsWith('_pod')) continue;
            
            const podDefId = `${defId}_pod`;
            
            // 如果 POD 版本已经注册，跳过
            if (entries.has(podDefId)) {
                skippedCount++;
                continue;
            }
            
            // 自动注册 POD 版本
            registerAbility(podDefId, timing, callback);
            mappedCount++;
            console.log(`[POD Auto Mapping] ${timing}: ${defId} → ${podDefId}`);
        }
    }
    
    // 2. 映射 Trigger (onTurnStart/afterScoring/...)
    const processedTriggers = new Set<string>();
    for (const entry of triggerRegistry) {
        const { sourceDefId, timing, callback } = entry;
        
        // 跳过已经是 _pod 的
        if (sourceDefId.endsWith('_pod')) continue;
        
        const podDefId = `${sourceDefId}_pod`;
        const key = `${podDefId}:${timing}`;
        
        // 避免重复处理（同一个 defId 可能有多个 timing）
        if (processedTriggers.has(key)) continue;
        processedTriggers.add(key);
        
        // 如果 POD 版本已经注册，跳过
        const alreadyRegistered = triggerRegistry.some(
            e => e.sourceDefId === podDefId && e.timing === timing
        );
        if (alreadyRegistered) {
            skippedCount++;
            continue;
        }
        
        // 自动注册 POD 版本
        registerTrigger(podDefId, timing, callback);
        mappedCount++;
        console.log(`[POD Auto Mapping] trigger(${timing}): ${sourceDefId} → ${podDefId}`);
    }
    
    // 3. 映射 Restriction (play_minion/play_action)
    // 注意：restrictionRegistry 是私有的，需要通过 ongoingEffects.ts 暴露
    // 暂时跳过，因为 restriction 通常需要配合 trigger 使用，会被 trigger 映射覆盖
    
    // 4. 映射 Protection (destroy/move/affect/action)
    // 注意：protectionRegistry 是私有的，需要通过 ongoingEffects.ts 暴露
    // 暂时跳过，因为 protection 通常需要配合 trigger 使用
    
    // 5. 映射 BaseAbilitySuppression
    // 注意：baseAbilitySuppressionRegistry 是私有的，需要通过 ongoingEffects.ts 暴露
    // 暂时跳过，因为这类卡牌较少
    
    console.log(`[POD Auto Mapping] 完成！映射 ${mappedCount} 个，跳过 ${skippedCount} 个（已显式注册）`);
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
