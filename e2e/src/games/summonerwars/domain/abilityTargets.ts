/**
 * 召唤师战争 - 技能目标解析
 *
 * 从 abilityResolver.ts 提取。解析 TargetRef 引用，返回单位列表或位置。
 */

import type {
  SummonerWarsCore,
  PlayerId,
  CellCoord,
  UnitInstance,
} from './types';
import type { TargetRef } from './abilities';
import { BOARD_ROWS, BOARD_COLS, getUnitAt } from './helpers';
import type { AbilityContext } from './abilityResolver';

// ============================================================================
// 目标解析
// ============================================================================

/**
 * 解析目标引用，返回单位列表
 */
export function resolveTargetUnits(
  ref: TargetRef,
  ctx: AbilityContext
): UnitInstance[] {
  const { state, sourceUnit, targetUnit, victimUnit, killerUnit, ownerId } = ctx;

  if (ref === 'self') {
    return [sourceUnit];
  }
  if (ref === 'attacker') {
    return sourceUnit ? [sourceUnit] : [];
  }
  if (ref === 'target') {
    return targetUnit ? [targetUnit] : [];
  }
  if (ref === 'victim') {
    return victimUnit ? [victimUnit] : [];
  }
  if (ref === 'killer') {
    return killerUnit ? [killerUnit] : [];
  }
  if (ref === 'adjacentEnemies') {
    return getAdjacentUnits(state, ctx.sourcePosition, ownerId, 'enemy');
  }
  if (ref === 'adjacentAllies') {
    return getAdjacentUnits(state, ctx.sourcePosition, ownerId, 'ally');
  }
  if (ref === 'allAllies') {
    return getAllUnits(state, ownerId, 'ally');
  }
  if (ref === 'allEnemies') {
    return getAllUnits(state, ownerId, 'enemy');
  }
  if (typeof ref === 'object' && 'position' in ref) {
    const unit = getUnitAt(state, ref.position);
    return unit ? [unit] : [];
  }
  if (typeof ref === 'object' && 'unitId' in ref) {
    // 从选择的目标中查找
    if (ref.unitId === 'selectedAlly' && ctx.selectedTargets?.units) {
      return ctx.selectedTargets.units;
    }
    // 按 ID 查找
    const unit = findUnitById(state, ref.unitId);
    return unit ? [unit] : [];
  }

  return [];
}

/**
 * 解析目标位置
 */
export function resolveTargetPosition(
  ref: TargetRef | 'victimPosition' | CellCoord,
  ctx: AbilityContext
): CellCoord | undefined {
  if (ref === 'victimPosition') {
    return ctx.victimPosition;
  }
  if (ref === 'victim') {
    return ctx.victimPosition;
  }
  if (ref === 'self') {
    return ctx.sourcePosition;
  }
  if (ref === 'target') {
    return ctx.targetPosition;
  }
  // 直接传入的 CellCoord（有 row 和 col 但没有 position 属性）
  if (typeof ref === 'object' && 'row' in ref && 'col' in ref && !('position' in ref) && !('unitId' in ref)) {
    return ref as CellCoord;
  }
  if (typeof ref === 'object' && 'position' in ref) {
    return (ref as { position: CellCoord }).position;
  }
  return undefined;
}

/**
 * 获取相邻单位
 */
function getAdjacentUnits(
  state: SummonerWarsCore,
  position: CellCoord,
  ownerId: PlayerId,
  filter: 'ally' | 'enemy' | 'all'
): UnitInstance[] {
  const units: UnitInstance[] = [];
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  for (const dir of directions) {
    const newRow = position.row + dir.row;
    const newCol = position.col + dir.col;
    if (newRow >= 0 && newRow < BOARD_ROWS && newCol >= 0 && newCol < BOARD_COLS) {
      const unit = state.board[newRow]?.[newCol]?.unit;
      if (unit) {
        if (filter === 'all') {
          units.push(unit);
        } else if (filter === 'ally' && unit.owner === ownerId) {
          units.push(unit);
        } else if (filter === 'enemy' && unit.owner !== ownerId) {
          units.push(unit);
        }
      }
    }
  }

  return units;
}

/**
 * 获取所有单位
 */
function getAllUnits(
  state: SummonerWarsCore,
  ownerId: PlayerId,
  filter: 'ally' | 'enemy' | 'all'
): UnitInstance[] {
  const units: UnitInstance[] = [];

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = state.board[row]?.[col]?.unit;
      if (unit) {
        if (filter === 'all') {
          units.push(unit);
        } else if (filter === 'ally' && unit.owner === ownerId) {
          units.push(unit);
        } else if (filter === 'enemy' && unit.owner !== ownerId) {
          units.push(unit);
        }
      }
    }
  }

  return units;
}

/**
 * 按 ID 查找单位
 */
function findUnitById(state: SummonerWarsCore, unitId: string): UnitInstance | undefined {
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = state.board[row]?.[col]?.unit;
      if (unit && unit.cardId === unitId) {
        return unit;
      }
    }
  }
  return undefined;
}
