/**
 * 召唤师战争 - 冰苔兽人技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import type { CellCoord } from '../types';
import { SW_EVENTS } from '../types';
import { calculatePushPullPosition, getForceDestinations, getUnitAbilities, getUnitAt } from '../helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

abilityExecutorRegistry.register('shouren_brute_impact', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, timestamp } = ctx;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  const newPosition = payload.newPosition as CellCoord | undefined;
  if (!targetPosition || !newPosition) return { events };

  const targetUnit = getUnitAt(core, targetPosition);
  if (!targetUnit || targetUnit.owner === sourceUnit.owner) return { events };
  const expected = calculatePushPullPosition(core, targetPosition, sourcePosition, 1, 'push');
  if (!expected || expected.row !== newPosition.row || expected.col !== newPosition.col) return { events };

  events.push({
    type: SW_EVENTS.UNIT_PUSHED,
    payload: {
      targetPosition,
      newPosition,
      targetUnitId: targetUnit.instanceId,
      sourceUnitId: sourceUnit.instanceId,
      sourceAbilityId: 'shouren_brute_impact',
      distance: 1,
      direction: 'push',
    },
    timestamp,
  });
  return { events };
}, { payloadContract: { required: ['targetPosition', 'newPosition'] } });

abilityExecutorRegistry.register('shouren_bloody_rush', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, timestamp } = ctx;
  const newPosition = payload.newPosition as CellCoord | undefined;
  if (!newPosition) return { events };
  const destination = getForceDestinations(core, sourcePosition, 1)
    .find(item => item.position.row === newPosition.row && item.position.col === newPosition.col);
  if (!destination) return { events };

  events.push({
    type: SW_EVENTS.UNIT_DAMAGED,
    payload: {
      position: sourcePosition,
      damage: 1,
      reason: 'shouren_bloody_rush',
      sourceAbilityId: 'shouren_bloody_rush',
      sourcePlayerId: sourceUnit.owner,
    },
    timestamp,
  });
  events.push({
    type: SW_EVENTS.UNIT_PUSHED,
    payload: {
      targetPosition: sourcePosition,
      newPosition,
      targetUnitId: sourceUnit.instanceId,
      sourceUnitId: sourceUnit.instanceId,
      sourceAbilityId: 'shouren_bloody_rush',
      distance: 1,
      direction: 'choice',
    },
    timestamp,
  });
  return { events };
}, { payloadContract: { required: ['newPosition'] } });

abilityExecutorRegistry.register('shouren_berserk', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, timestamp } = ctx;
  const newPosition = payload.newPosition as CellCoord | undefined;
  if (!newPosition) return { events };
  const destination = getForceDestinations(core, sourcePosition, 1)
    .find(item => item.position.row === newPosition.row && item.position.col === newPosition.col);
  if (!destination) return { events };

  events.push({
    type: SW_EVENTS.UNIT_PUSHED,
    payload: {
      targetPosition: sourcePosition,
      newPosition,
      targetUnitId: sourceUnit.instanceId,
      sourceUnitId: sourceUnit.instanceId,
      sourceAbilityId: 'shouren_berserk',
      distance: 1,
      direction: 'choice',
    },
    timestamp,
  });
  events.push({
    type: SW_EVENTS.EXTRA_ATTACK_GRANTED,
    payload: {
      targetPosition: newPosition,
      targetUnitId: sourceUnit.instanceId,
      sourceAbilityId: 'shouren_berserk',
    },
    timestamp,
  });
  return { events };
}, { payloadContract: { required: ['newPosition'] } });

abilityExecutorRegistry.register('shouren_primal_fury', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, timestamp } = ctx;
  const newPosition = payload.newPosition as CellCoord | undefined;
  if (!newPosition
    || sourceUnit.card.unitClass !== 'summoner'
    || !getUnitAbilities(sourceUnit, core).includes('shouren_primal_fury')) return { events };
  const destination = [
    ...getForceDestinations(core, sourcePosition, 1),
    ...getForceDestinations(core, sourcePosition, 2),
  ].find(item => item.position.row === newPosition.row && item.position.col === newPosition.col);
  if (!destination) return { events };

  events.push({
    type: SW_EVENTS.UNIT_PUSHED,
    payload: {
      targetPosition: sourcePosition,
      newPosition,
      targetUnitId: sourceUnit.instanceId,
      sourceUnitId: sourceUnit.instanceId,
      sourceAbilityId: 'shouren_primal_fury',
      distance: Math.abs(newPosition.row - sourcePosition.row) + Math.abs(newPosition.col - sourcePosition.col),
      direction: 'choice',
    },
    timestamp,
  });
  events.push({
    type: SW_EVENTS.EXTRA_ATTACK_GRANTED,
    payload: {
      targetPosition: newPosition,
      targetUnitId: sourceUnit.instanceId,
      sourceAbilityId: 'shouren_primal_fury',
    },
    timestamp,
  });
  return { events };
}, { payloadContract: { required: ['newPosition'] } });
