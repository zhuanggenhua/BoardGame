/**
 * 技能辅助函数
 * 
 * 提供通用的技能可用性判断逻辑
 */

import type { SummonerWarsCore, PlayerId, BoardUnit, CellCoord } from './types';
import { SW_COMMANDS } from './types';
import { SummonerWarsDomain } from './index';
import { abilityRegistry } from './abilities';
import { buildUsageKey } from './utils';
import type { AbilityTrigger, ValidationContext } from './abilities';
import { getUnitAbilities, hasUnitKilledThisTurn } from './helpers';
import { isUndeadCard } from './ids';

/**
 * 获取单位在当前阶段可主动激活的技能
 * 
 * @param unit 单位
 * @param phase 当前阶段
 * @returns 可激活的技能 ID 列表
 */
export function getActivatableAbilities(
  unit: BoardUnit,
  phase: string,
  state: SummonerWarsCore
): string[] {
  const abilities = getUnitAbilities(unit, state);
  const activatable: string[] = [];
  
  for (const abilityId of abilities) {
    const abilityDef = abilityRegistry.get(abilityId);
    if (!abilityDef) continue;
    
    // 有 UI 按钮的技能（如 beforeAttack 的 holy_arrow）也视为可主动激活
    if (abilityDef.ui?.requiresButton) {
      if (abilityDef.ui.buttonPhase && abilityDef.ui.buttonPhase !== phase) continue;
      activatable.push(abilityId);
      continue;
    }
    
    // 'activated' 触发类型的技能
    if (abilityDef.trigger !== 'activated') continue;
    
    // 检查阶段限制（如果有）
    if (abilityDef.validation?.requiredPhase && abilityDef.validation.requiredPhase !== phase) {
      continue;
    }
    
    activatable.push(abilityId);
  }
  
  return activatable;
}

/**
 * 检查单位是否有指定触发类型的技能
 * 
 * @param unit 单位
 * @param trigger 触发类型
 * @returns 是否有该类型技能
 */
export function hasAbilityWithTrigger(unit: BoardUnit, trigger: AbilityTrigger, state: SummonerWarsCore): boolean {
  const abilities = getUnitAbilities(unit, state);
  for (const abilityId of abilities) {
    const abilityDef = abilityRegistry.get(abilityId);
    if (abilityDef && abilityDef.trigger === trigger) {
      return true;
    }
  }
  return false;
}

/**
 * 检查单位是否有移动后触发的技能
 * 
 * @param unit 单位
 * @returns 是否有移动后技能
 */
export function hasAfterMoveAbility(unit: BoardUnit, state: SummonerWarsCore): boolean {
  // 移动后技能通常是 'activated' 类型，但在移动阶段可用
  // 检查是否有在移动阶段可激活的技能
  const abilities = getUnitAbilities(unit, state);
  for (const abilityId of abilities) {
    const abilityDef = abilityRegistry.get(abilityId);
    if (!abilityDef) continue;
    
    // 检查是否是移动阶段可用的主动技能
    if (abilityDef.trigger === 'activated' && abilityDef.validation?.requiredPhase === 'move') {
      return true;
    }
  }
  return false;
}

/**
 * 检查单位是否有攻击前触发的技能
 * 
 * @param unit 单位
 * @returns 是否有攻击前技能
 */
export function hasBeforeAttackAbility(unit: BoardUnit, state: SummonerWarsCore): boolean {
  return hasAbilityWithTrigger(unit, 'beforeAttack', state);
}

/**
 * 检查技能是否真正可用（包含特殊条件检查）
 * 
 * @param core 游戏状态
 * @param unit 单位
 * @param abilityId 技能 ID
 * @param playerId 玩家 ID
 * @returns 技能是否可用
 */
export function canActivateAbility(
  core: SummonerWarsCore,
  unit: BoardUnit,
  abilityId: string,
  playerId: PlayerId
): boolean {
  const abilityDef = abilityRegistry.get(abilityId);
  if (!abilityDef) return false;

  // 对于 onPhaseEnd 触发的技能，不检查 requiredPhase
  // 因为它们在 onPhaseExit 中触发，此时阶段可能已经推进
  // 但技能确认/跳过仍需要在原阶段的上下文中进行
  if (abilityDef.trigger !== 'onPhaseEnd' && abilityDef.validation?.requiredPhase && abilityDef.validation.requiredPhase !== core.phase) {
    return false;
  }

  if (abilityDef.usesPerTurn !== undefined) {
    const usageKey = buildUsageKey(unit.instanceId, abilityId);
    const usageCount = (core.abilityUsageCount ?? {})[usageKey] ?? 0;
    if (usageCount >= abilityDef.usesPerTurn) {
      return false;
    }
  }
  
  // 特殊检查：复活死灵需要弃牌堆有亡灵单位
  if (abilityId === 'revive_undead') {
    const player = core.players[playerId];
    return player.discard.some(c => isUndeadCard(c));
  }

  // 喂养巨食兽：仅在本回合未消灭任何单位时可激活
  if (abilityId === 'feed_beast' && hasUnitKilledThisTurn(core, unit.instanceId)) {
    return false;
  }

  if (abilityDef.validation?.customValidator && !abilityDef.requiresTargetSelection) {
    const ctx: ValidationContext = {
      core,
      playerId,
      sourceUnit: unit,
      sourcePosition: unit.position,
      payload: {},
    };
    const result = abilityDef.validation.customValidator(ctx);
    if (!result.valid) {
      return false;
    }
  }
  
  // 其他技能默认可用（具体的验证在 validate 中进行）
  return true;
}
