/**
 * 召唤师战争 - UI 提示提供者
 *
 * 实现引擎层的 UIHintProvider 接口，提供可交互实体的查询功能。
 */

import type { UIHint, UIHintFilter } from '../../../engine/primitives/uiHints';
import type { SummonerWarsCore, PlayerId, GamePhase } from './types';
import { getPlayerUnits, getValidMoveTargetsEnhanced, getValidAttackTargetsEnhanced, MAX_MOVES_PER_TURN, MAX_ATTACKS_PER_TURN, isImmobile } from './helpers';
import { getActivatableAbilities, canActivateAbility } from './abilityHelpers';

/**
 * 获取可移动/攻击的单位提示（绿色边框）
 */
function getActionableUnitHints(
  core: SummonerWarsCore,
  playerId: PlayerId,
  phase: GamePhase
): UIHint[] {
  const hints: UIHint[] = [];
  const player = core.players[playerId];
  const units = getPlayerUnits(core, playerId);

  switch (phase) {
    case 'move': {
      const remainingMoves = MAX_MOVES_PER_TURN - player.moveCount;
      if (remainingMoves > 0) {
        for (const u of units) {
          if (!u.hasMoved && !isImmobile(u, core) && getValidMoveTargetsEnhanced(core, u.position).length > 0) {
            hints.push({
              type: 'actionable',
              position: u.position,
              entityId: u.cardId,
              actions: ['move'],
            });
            if (hints.length >= remainingMoves) break;
          }
        }
      }
      break;
    }
    case 'attack': {
      const remainingAttacks = MAX_ATTACKS_PER_TURN - player.attackCount;
      if (remainingAttacks > 0) {
        for (const u of units) {
          if (!u.hasAttacked && getValidAttackTargetsEnhanced(core, u.position).length > 0) {
            hints.push({
              type: 'actionable',
              position: u.position,
              entityId: u.cardId,
              actions: ['attack'],
            });
            if (hints.length >= remainingAttacks) break;
          }
        }
      }
      break;
    }
  }

  return hints;
}

/**
 * 获取可使用技能的单位提示（青色波纹）
 */
function getAbilityReadyHints(
  core: SummonerWarsCore,
  playerId: PlayerId,
  phase: GamePhase
): UIHint[] {
  const hints: UIHint[] = [];
  const units = getPlayerUnits(core, playerId);

  for (const u of units) {
    // 移动阶段：只显示未移动的单位
    if (phase === 'move' && u.hasMoved) continue;

    // 获取可激活的技能
    const activatableAbilities = getActivatableAbilities(u, phase, core);
    if (activatableAbilities.length === 0) continue;

    // 检查是否真正可用（包含特殊条件）
    const usableAbilities = activatableAbilities.filter(abilityId =>
      canActivateAbility(core, u, abilityId, playerId)
    );

    if (usableAbilities.length > 0) {
      hints.push({
        type: 'ability',
        position: u.position,
        entityId: u.cardId,
        actions: usableAbilities,
      });
    }
  }

  return hints;
}

/**
 * 召唤师战争 UI 提示提供者
 *
 * @param core   游戏状态
 * @param filter 过滤器
 * @returns      UI 提示列表
 */
export function getSummonerWarsUIHints(
  core: SummonerWarsCore,
  filter?: UIHintFilter
): UIHint[] {
  const hints: UIHint[] = [];

  // 提取过滤参数
  const playerId = (filter?.playerId ?? '0') as PlayerId;
  const phase = (filter?.phase ?? core.phase) as GamePhase;
  const types = filter?.types;

  // 可移动/攻击的单位
  if (!types || types.includes('actionable')) {
    hints.push(...getActionableUnitHints(core, playerId, phase));
  }

  // 可使用技能的单位
  if (!types || types.includes('ability')) {
    hints.push(...getAbilityReadyHints(core, playerId, phase));
  }

  return hints;
}
