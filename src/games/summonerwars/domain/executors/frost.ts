/**
 * 召唤师战争 - 极地矮人技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import type { CellCoord } from '../types';
import { SW_EVENTS } from '../types';
import {
  getUnitAt,
  getStructureAt,
  getUnitAbilities,
  manhattanDistance,
  isValidCoord,
  isCellEmpty,
  BOARD_ROWS,
  BOARD_COLS,
} from '../helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

/** 结构变换 */
abilityExecutorRegistry.register('structure_shift', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const ssTargetPos = payload.targetPosition as CellCoord | undefined;
  const ssNewPos = payload.newPosition as CellCoord | undefined;
  if (!ssTargetPos) return { events };

  // 检查真实建筑或活体结构单位（如寒冰魔像）
  const ssStructure = getStructureAt(core, ssTargetPos);
  const ssUnit = getUnitAt(core, ssTargetPos);
  const isAllyStructure = (ssStructure && ssStructure.owner === playerId)
    || (ssUnit && ssUnit.owner === playerId
      && getUnitAbilities(ssUnit, core).includes('mobile_structure'));
  if (!isAllyStructure) return { events };
  const ssDist = manhattanDistance(sourcePosition, ssTargetPos);
  if (ssDist > 3) return { events };

  if (ssNewPos && isValidCoord(ssNewPos) && isCellEmpty(core, ssNewPos)
    && manhattanDistance(ssTargetPos, ssNewPos) === 1) {
    events.push({
      type: SW_EVENTS.UNIT_PUSHED,
      payload: { targetPosition: ssTargetPos, newPosition: ssNewPos, isStructure: true },
      timestamp,
    });
  }
  return { events };
}, { payloadContract: { required: ['targetPosition', 'newPosition'] } });

/** 寒冰碎屑 */
abilityExecutorRegistry.register('ice_shards', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, ownerId: playerId, timestamp } = ctx;
  if ((sourceUnit.boosts ?? 0) < 1) return { events };

  // 消耗1点充能
  events.push({
    type: SW_EVENTS.UNIT_CHARGED,
    payload: { position: sourcePosition, delta: -1 },
    timestamp,
  });

  // 收集所有和友方建筑相邻的敌方单位（去重）
  const damagedSet = new Set<string>();
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const structure = getStructureAt(core, { row: r, col: c });
      const structureUnit = getUnitAt(core, { row: r, col: c });
      const isAllyStructure = (structure && structure.owner === playerId)
        || (structureUnit && structureUnit.owner === playerId
          && getUnitAbilities(structureUnit, core).includes('mobile_structure'));
      if (!isAllyStructure) continue;

      const adjDirs = [
        { row: -1, col: 0 }, { row: 1, col: 0 },
        { row: 0, col: -1 }, { row: 0, col: 1 },
      ];
      for (const d of adjDirs) {
        const adjPos = { row: r + d.row, col: c + d.col };
        if (!isValidCoord(adjPos)) continue;
        const adjUnit = getUnitAt(core, adjPos);
        if (adjUnit && adjUnit.owner !== playerId && !damagedSet.has(adjUnit.cardId)) {
          damagedSet.add(adjUnit.cardId);
          events.push({
            type: SW_EVENTS.UNIT_DAMAGED,
            payload: { position: adjPos, damage: 1, reason: 'ice_shards' },
            timestamp,
          });
        }
      }
    }
  }
  return { events };
});

/** 冰霜战斧 */
abilityExecutorRegistry.register('frost_axe', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, sourceId: sourceUnitId, payload, ownerId: playerId, timestamp } = ctx;
  const fxChoice = payload.choice as 'self' | 'attach';

  if (fxChoice === 'self') {
    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: sourcePosition, delta: 1, sourceAbilityId: 'frost_axe' },
      timestamp,
    });
  } else if (fxChoice === 'attach') {
    const fxTargetPos = payload.targetPosition as CellCoord | undefined;
    if (!fxTargetPos) return { events };
    const fxTarget = getUnitAt(core, fxTargetPos);
    if (!fxTarget || fxTarget.owner !== playerId || fxTarget.card.unitClass !== 'common') return { events };
    const fxDist = manhattanDistance(sourcePosition, fxTargetPos);
    if (fxDist > 3) return { events };
    const charges = sourceUnit.boosts ?? 0;
    if (charges < 1) return { events };

    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: sourcePosition, newValue: 0, delta: -charges, sourceAbilityId: 'frost_axe' },
      timestamp,
    });
    events.push({
      type: SW_EVENTS.UNIT_ATTACHED,
      payload: {
        sourcePosition,
        targetPosition: fxTargetPos,
        sourceUnitId,
        sourceCard: sourceUnit.card,
        sourceOwner: playerId,
      },
      timestamp,
    });
  }
  return { events };
}, { payloadContract: { required: ['choice'], optional: ['targetPosition'] } });


/** 寒冰冲撞 — 对建筑相邻目标造成1伤 + 可选推拉1格 */
abilityExecutorRegistry.register('ice_ram', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, payload, ownerId: playerId, timestamp } = ctx;
  const targetPos = payload.targetPosition as CellCoord | undefined;
  const structurePos = payload.structurePosition as CellCoord | undefined;
  const pushNewPos = payload.pushNewPosition as CellCoord | undefined;
  if (!targetPos || !structurePos) return { events };

  // 验证目标与建筑相邻
  if (manhattanDistance(targetPos, structurePos) !== 1) return { events };
  const targetUnit = getUnitAt(core, targetPos);
  if (!targetUnit) return { events };

  // 造成1伤害
  events.push({
    type: SW_EVENTS.UNIT_DAMAGED,
    payload: {
      position: targetPos,
      damage: 1,
      reason: 'ice_ram',
      sourcePlayerId: playerId,
    },
    timestamp,
  });

  // 可选推拉1格
  if (pushNewPos && isValidCoord(pushNewPos)
    && manhattanDistance(targetPos, pushNewPos) === 1
    && isCellEmpty(core, pushNewPos)) {
    events.push({
      type: SW_EVENTS.UNIT_PUSHED,
      payload: { targetPosition: targetPos, newPosition: pushNewPos },
      timestamp,
    });
  }
  return { events };
}, { payloadContract: { required: ['targetPosition', 'structurePosition'], optional: ['pushNewPosition'] } });
