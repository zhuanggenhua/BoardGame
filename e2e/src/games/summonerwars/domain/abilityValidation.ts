/**
 * 召唤师战争 - 技能验证通用函数
 * 
 * 提供数据驱动的技能验证，避免在 validate.ts 中硬编码 switch-case
 */

import type { ValidationResult } from '../../../engine/types';
import type { SummonerWarsCore, PlayerId, CellCoord, BoardUnit } from './types';
import type { AbilityDef, ValidationContext } from './abilities';
import { abilityRegistry } from './abilities';
import { getUnitAbilities, getUnitAt, manhattanDistance, isValidCoord, isCellEmpty, MAX_MOVES_PER_TURN, MAX_ATTACKS_PER_TURN } from './helpers';
import { CARD_IDS, getBaseCardId } from './ids';
import { buildUsageKey } from './utils';

const ACTIVATION_ABILITY_ALIASES: Record<string, readonly string[]> = {
  // mind_capture_resolve 是“心灵捕获”交互确认分支，不会直接挂在卡面 abilities 上
  mind_capture_resolve: ['mind_capture'],
};

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

  // 寒冰冲撞：事件卡持续效果，不走单位技能验证
  if (abilityId === 'ice_ram') {
    const hasIceRam = core.players[playerId]?.activeEvents.some(ev =>
      getBaseCardId(ev.id) === CARD_IDS.FROST_ICE_RAM
    );
    if (!hasIceRam) return { valid: false, error: '没有寒冰冲撞主动事件' };
    const targetPos = payload.targetPosition as CellCoord | undefined;
    const structurePos = payload.structurePosition as CellCoord | undefined;
    if (!targetPos || !structurePos) return { valid: false, error: '缺少目标或建筑位置' };
    if (manhattanDistance(targetPos, structurePos) !== 1) return { valid: false, error: '目标必须与建筑相邻' };
    const targetUnit = getUnitAt(core, targetPos);
    if (!targetUnit) return { valid: false, error: '目标位置没有单位' };
    const pushNewPos = payload.pushNewPosition as CellCoord | undefined;
    if (pushNewPos) {
      if (!isValidCoord(pushNewPos)) return { valid: false, error: '推拉目标位置无效' };
      if (manhattanDistance(targetPos, pushNewPos) !== 1) return { valid: false, error: '推拉距离必须为1格' };
      if (!isCellEmpty(core, pushNewPos)) return { valid: false, error: '推拉目标位置不为空' };
    }
    return { valid: true };
  }
  
  // 查找源单位（sourceUnitId 为 instanceId）
  let sourceUnit: BoardUnit | undefined;
  let sourcePosition: CellCoord | undefined;
  for (let row = 0; row < core.board.length; row++) {
    for (let col = 0; col < (core.board[0]?.length ?? 0); col++) {
      const unit = core.board[row]?.[col]?.unit;
      if (unit && unit.instanceId === sourceUnitId) {
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
  const aliasAbilities = ACTIVATION_ABILITY_ALIASES[abilityId] ?? [];
  const hasAbility = unitAbilities.includes(abilityId)
    || aliasAbilities.some(aliasAbility => unitAbilities.includes(aliasAbility));
  if (!hasAbility) {
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
      const usageKey = buildUsageKey(sourceUnit.instanceId, abilityId);
      const usageCount = (core.abilityUsageCount ?? {})[usageKey] ?? 0;
      if (usageCount >= ability.usesPerTurn) {
        return {
          valid: false,
          error: '每回合只能使用一次',
        };
      }
    }

    // ========================================================================
    // 临时方案（标记为过时）：手动检查 costsMoveAction / costsAttackAction
    // 
    // @deprecated 推荐使用引擎层的通用约束系统（engine/primitives/abilityConstraints）
    // 
    // 迁移指南：
    // 旧代码：
    //   costsMoveAction: true,
    //   validation: { customValidator: (ctx) => { if (ctx.sourceUnit.hasMoved) ... } }
    // 
    // 新代码：
    //   constraints: {
    //     actionCost: { type: 'move', count: 1 },
    //     entityState: { notMoved: true },
    //   }
    // 
    // 然后在验证层调用：
    //   checkAbilityConstraints(ability.constraints, constraintContext)
    // 
    // 优点：
    // - 数据驱动，无需手写验证逻辑
    // - 可组合，支持多种约束类型
    // - 可扩展，支持自定义约束处理器
    // ========================================================================

    // costsMoveAction：消耗移动行动的技能，移动次数用完时不可用
    if (ability.costsMoveAction) {
      const player = core.players[playerId];
      if (player.moveCount >= MAX_MOVES_PER_TURN) {
        return { valid: false, error: '本回合移动次数已用完' };
      }
    }

    // costsAttackAction：消耗攻击行动的技能，攻击次数用完时不可用
    if (ability.costsAttackAction) {
      const player = core.players[playerId];
      if (player.attackCount >= MAX_ATTACKS_PER_TURN) {
        return { valid: false, error: '本回合攻击次数已用完' };
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
    const usageKey = buildUsageKey(ctx.sourceUnit.instanceId, ability.id);
    const usageCount = (ctx.core.abilityUsageCount ?? {})[usageKey] ?? 0;
    if (usageCount >= ability.usesPerTurn) {
      return { canUse: false, reason: '本回合已使用' };
    }
  }

  // costsMoveAction：消耗移动行动的技能，移动次数用完时不可用
  if (ability.costsMoveAction) {
    const player = ctx.core.players[ctx.playerId];
    if (player.moveCount >= MAX_MOVES_PER_TURN) {
      return { canUse: false, reason: '移动次数已用完' };
    }
  }

  // costsAttackAction：消耗攻击行动的技能，攻击次数用完时不可用
  if (ability.costsAttackAction) {
    const player = ctx.core.players[ctx.playerId];
    if (player.attackCount >= MAX_ATTACKS_PER_TURN) {
      return { canUse: false, reason: '攻击次数已用完' };
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
