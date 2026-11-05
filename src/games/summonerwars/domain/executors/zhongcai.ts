/**
 * 召唤师战争 - 仲裁派系技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import { SW_EVENTS } from '../types';
import type { CellCoord } from '../types';
import { getUnitAt, isCellEmpty, isValidCoord, manhattanDistance } from '../helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

abilityExecutorRegistry.register('zhongcai_erase', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  if (!targetPosition) return { events };
  const target = getUnitAt(ctx.core, targetPosition);
  // 卡面只写“一个士兵”，没有友方/敌方限定；士兵类型仍由 common 约束。
  if (!target || target.card.unitClass !== 'common') return { events };
  if (manhattanDistance(ctx.sourcePosition, targetPosition) > 3) return { events };
  events.push({
    type: SW_EVENTS.ABILITY_TRIGGERED,
    payload: {
      abilityId: 'zhongcai_erase',
      sourceUnitId: ctx.sourceUnit.instanceId,
      sourcePosition: ctx.sourcePosition,
      targetUnitId: target.instanceId,
      grantSuppression: true,
      // 这是玩家选定目标后的完成事件，只记录状态，不应再次打开目标选择。
      interactionResolved: true,
    },
    timestamp: ctx.timestamp,
  });
  return { events };
}, { payloadContract: { required: ['targetPosition'] } });

abilityExecutorRegistry.register('zhongcai_word', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  const newPosition = ctx.payload.newPosition as CellCoord | undefined;
  if (!targetPosition || !newPosition) return { events };
  const target = getUnitAt(ctx.core, targetPosition);
  if (!target || target.owner !== ctx.ownerId || target.card.unitClass !== 'common') return { events };
  if (manhattanDistance(ctx.sourcePosition, targetPosition) > 2) return { events };
  if (!isValidCoord(newPosition) || manhattanDistance(targetPosition, newPosition) !== 1 || !isCellEmpty(ctx.core, newPosition)) {
    return { events };
  }
  events.push({
    type: SW_EVENTS.UNIT_PUSHED,
    payload: {
      targetPosition,
      newPosition,
      targetUnitId: target.instanceId,
      sourceUnitId: ctx.sourceUnit.instanceId,
      sourceAbilityId: 'zhongcai_word',
      distance: 1,
      direction: 'choice',
    },
    timestamp: ctx.timestamp,
  });
  return { events };
}, { payloadContract: { required: ['targetPosition', 'newPosition'] } });

abilityExecutorRegistry.register('zhongcai_inspire', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  if (!targetPosition) return { events };
  const target = getUnitAt(ctx.core, targetPosition);
  if (!target || target.owner !== ctx.ownerId || target.card.unitClass !== 'common') return { events };
  if (manhattanDistance(ctx.sourcePosition, targetPosition) !== 1 || target.damage <= 0) return { events };
  events.push({
    type: SW_EVENTS.UNIT_HEALED,
    payload: { position: targetPosition, amount: 1, sourceAbilityId: 'zhongcai_inspire' },
    timestamp: ctx.timestamp,
  });
  return { events };
}, { payloadContract: { required: ['targetPosition'] } });
