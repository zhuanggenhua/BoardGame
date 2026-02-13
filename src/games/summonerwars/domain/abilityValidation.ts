/**
 * 召唤师战争 - 技能验证通用函数
 * 
 * 提供数据驱动的技能验证，避免在 validate.ts 中硬编码 switch-case
 */

import type { ValidationResult } from '../../../engine/types';
import type { SummonerWarsCore, PlayerId, CellCoord, BoardUnit } from './types';
import type { AbilityDef, ValidationContext } from './abilities';
import { abilityRegistry } from './abilities';
import { getUnitAbilities } from './helpers';

/**
 * 验证技能是否可以激活
 * 
 * 这是通用的验证函数，根据 AbilityDef 中的 validation 规则自动验证。
 * 复杂的验证逻辑通过 customValidator 实现。
 */
export function validateAbilityActivation(
  core: SummonerWarsCore,
  playerId: PlayerId,
  payload: Record<string, unknown>
): ValidationResult {
  const abilityId = payload.abilityId as string;
  const sourceUnitId = payload.sourceUnitId as string;
  
  // 查找源单位
  let sourceUnit: BoardUnit | undefined;
  let sourcePosition: CellCoord | undefined;
  for (let row = 0; row < core.board.length; row++) {
    for (let col = 0; col < (core.board[0]?.length ?? 0); col++) {
      const unit = core.board[row]?.[col]?.unit;
      if (unit && unit.cardId === sourceUnitId) {
        sourceUnit = unit;
        sourcePosition = { row, col };
        break;
      }
    }
    if (sourceUnit) break;
  }
  
  if (!sourceUnit || !sourcePosition) {
    return { valid: false, error: '技能源单位未找到' };
  }
  
  if (sourceUnit.owner !== playerId) {
    return { valid: false, error: '只能发动自己单位的技能' };
  }
  
  // 检查单位是否拥有该技能
  const unitAbilities = getUnitAbilities(sourceUnit, core);
  if (!unitAbilities.includes(abilityId)) {
    return { valid: false, error: '该单位没有此技能' };
  }
  
  // 获取技能定义
  const ability = abilityRegistry.get(abilityId);
  if (!ability) {
    return { valid: false, error: '未知的技能' };
  }
  
  // 构建验证上下文
  const ctx: ValidationContext = {
    core,
    playerId,
    sourceUnit,
    sourcePosition,
    payload,
  };
  
  // 通用验证规则
  if (ability.validation) {
    // 阶段检查
    if (ability.validation.requiredPhase && core.phase !== ability.validation.requiredPhase) {
      const phaseNames = {
        summon: '召唤阶段',
        move: '移动阶段',
        attack: '攻击阶段',
        build: '建造阶段',
      };
      return {
        valid: false,
        error: `只能在${phaseNames[ability.validation.requiredPhase]}使用`,
      };
    }
    
    // 使用次数检查
    if (ability.usesPerTurn !== undefined) {
      const usageKey = `${sourceUnitId}:${abilityId}`;
      const usageCount = (core.abilityUsageCount ?? {})[usageKey] ?? 0;
      if (usageCount >= ability.usesPerTurn) {
        return {
          valid: false,
          error: '每回合只能使用一次',
        };
      }
    }
    
    // 自定义验证
    if (ability.validation.customValidator) {
      return ability.validation.customValidator(ctx);
    }
  }
  
  return { valid: true };
}

/**
 * 检查技能是否可用（用于 UI 按钮禁用）
 * 
 * 与 validateAbilityActivation 类似，但返回更详细的信息
 */
export function canUseAbility(
  ability: AbilityDef,
  ctx: ValidationContext
): { canUse: boolean; reason?: string } {
  // 阶段检查
  if (ability.validation?.requiredPhase && ctx.core.phase !== ability.validation.requiredPhase) {
    return { canUse: false, reason: '当前阶段不可用' };
  }
  
  // 使用次数检查
  if (ability.usesPerTurn !== undefined) {
    const usageKey = `${ctx.sourceUnit.cardId}:${ability.id}`;
    const usageCount = (ctx.core.abilityUsageCount ?? {})[usageKey] ?? 0;
    if (usageCount >= ability.usesPerTurn) {
      return { canUse: false, reason: '本回合已使用' };
    }
  }
  
  // 自定义验证
  if (ability.validation?.customValidator) {
    const result = ability.validation.customValidator(ctx);
    if (!result.valid) {
      return { canUse: false, reason: result.error };
    }
  }
  
  return { canUse: true };
}
