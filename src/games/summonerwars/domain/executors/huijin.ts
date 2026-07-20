/**
 * 召唤师战争 - 灰烬技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import type { CellCoord } from '../types';
import { SW_EVENTS } from '../types';
import {
  getUnitAt,
  isCellEmpty,
  isInStraightLine,
  isRangedPathClear,
  isValidCoord,
  manhattanDistance,
  normalizeUnitBoosts,
} from '../helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

abilityExecutorRegistry.register('huijin_call_guards', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  const position = payload.position as CellCoord | undefined;
  if (!targetPosition || !position) return { events };
  if (sourceUnit.card.unitClass !== 'summoner') return { events };
  if (normalizeUnitBoosts(sourceUnit.boosts) < 1) return { events };
  if (manhattanDistance(sourcePosition, position) !== 1 || !isCellEmpty(core, position)) return { events };

  const targetUnit = getUnitAt(core, targetPosition);
  if (!targetUnit || targetUnit.owner !== playerId || targetUnit.card.unitClass !== 'common') return { events };

  events.push({
    type: SW_EVENTS.UNIT_CHARGED,
    payload: { position: sourcePosition, delta: -1, sourceAbilityId: 'huijin_call_guards' },
    timestamp,
  });
  events.push({
    type: SW_EVENTS.UNIT_MOVED,
    payload: {
      from: targetPosition,
      to: position,
      unitId: targetUnit.instanceId,
      reason: 'huijin_call_guards',
      sourceAbilityId: 'huijin_call_guards',
      path: [targetPosition, position],
    },
    timestamp,
  });

  return { events };
}, { payloadContract: { required: ['targetPosition', 'position'] } });

abilityExecutorRegistry.register('huijin_ram', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  const newPosition = payload.newPosition as CellCoord | undefined;
  if (!targetPosition || !newPosition) return { events };
  if (manhattanDistance(sourcePosition, targetPosition) !== 1) return { events };

  const targetUnit = getUnitAt(core, targetPosition);
  if (!targetUnit || targetUnit.owner === playerId) return { events };
  if (targetUnit.card.unitClass !== 'common' && targetUnit.card.unitClass !== 'champion') return { events };
  if (!isValidCoord(newPosition) || manhattanDistance(targetPosition, newPosition) !== 1) return { events };
  if (!isCellEmpty(core, newPosition)) return { events };

  events.push({
    type: SW_EVENTS.UNIT_PUSHED,
    payload: {
      targetPosition,
      newPosition,
      targetUnitId: targetUnit.instanceId,
      sourceUnitId: sourceUnit.instanceId,
      sourceAbilityId: 'huijin_ram',
      distance: 1,
      direction: 'choice',
    },
    timestamp,
  });

  return { events };
}, { payloadContract: { required: ['targetPosition', 'newPosition'] } });

abilityExecutorRegistry.register('huijin_quick_shot', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  if (!targetPosition) return { events };

  const targetUnit = getUnitAt(core, targetPosition);
  if (!targetUnit || targetUnit.instanceId === sourceUnit.instanceId) return { events };
  const distance = manhattanDistance(sourcePosition, targetPosition);
  if (distance <= 0 || distance > 3) return { events };
  if (!isInStraightLine(sourcePosition, targetPosition)) return { events };
  if (!isRangedPathClear(core, sourcePosition, targetPosition, playerId)) return { events };

  events.push({
    type: SW_EVENTS.UNIT_DAMAGED,
    payload: {
      position: targetPosition,
      damage: 1,
      reason: 'huijin_quick_shot',
      sourceAbilityId: 'huijin_quick_shot',
      sourcePlayerId: playerId,
    },
    timestamp,
  });

  return { events };
}, { payloadContract: { required: ['targetPosition'] } });
