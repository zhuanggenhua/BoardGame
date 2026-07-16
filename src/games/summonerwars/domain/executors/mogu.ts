/**
 * 召唤师战争 - 莫古技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import { SW_EVENTS } from '../types';
import type { CellCoord } from '../types';
import {
  getUnitAt,
  isCellEmpty,
  manhattanDistance,
  normalizeUnitBoosts,
} from '../helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

/** 枯萎法师 - 鲜血灌注 */
abilityExecutorRegistry.register('mogu_blood_infusion', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, payload, ownerId: playerId, timestamp } = ctx;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  if (!targetPosition) return { events };
  const target = getUnitAt(core, targetPosition);
  if (!target || target.owner !== playerId) return { events };
  if (manhattanDistance(ctx.sourcePosition, targetPosition) > 2) return { events };
  events.push({
    type: SW_EVENTS.UNIT_CHARGED,
    payload: { position: targetPosition, delta: 1, sourceAbilityId: 'mogu_blood_infusion' },
    timestamp,
  });
  events.push({
    type: SW_EVENTS.UNIT_DAMAGED,
    payload: { position: targetPosition, damage: 1, reason: 'mogu_blood_infusion', sourcePlayerId: playerId },
    timestamp,
  });
  return { events };
});

/** 菌化野兽 - 寄生 */
abilityExecutorRegistry.register('mogu_parasite', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { payload, timestamp } = ctx;
  const choice = payload.choice as 'consume_charge' | 'take_damage' | undefined;
  if (choice === 'consume_charge') {
    if (normalizeUnitBoosts(ctx.sourceUnit.boosts) <= 0) return { events };
    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: ctx.sourcePosition, delta: -1, sourceAbilityId: 'mogu_parasite' },
      timestamp,
    });
  } else if (choice === 'take_damage') {
    events.push({
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: {
        position: ctx.sourcePosition,
        damage: 1,
        reason: 'mogu_parasite',
        sourceAbilityId: 'mogu_parasite',
        sourcePlayerId: ctx.ownerId,
      },
      timestamp,
    });
  }
  return { events };
}, { payloadContract: { required: ['choice'] } });

/** 鲜血萨满 - 传输 */
abilityExecutorRegistry.register('mogu_transmission', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, payload, ownerId: playerId, timestamp } = ctx;
  const mode = payload.mode as string | undefined;
  const fromPosition = payload.fromPosition as CellCoord | undefined;
  const toPosition = payload.toPosition as CellCoord | undefined;
  const amount = Number(payload.amount ?? 0);
  if (!toPosition || !Number.isFinite(amount) || amount <= 0) return { events };

  const sourcePosition = mode === 'self_to_target' ? ctx.sourcePosition : fromPosition;
  if (!sourcePosition) return { events };
  const fromUnit = getUnitAt(core, sourcePosition);
  const toUnit = getUnitAt(core, toPosition);
  if (!fromUnit || !toUnit || fromUnit.owner !== playerId || toUnit.owner !== playerId) return { events };
  if (manhattanDistance(ctx.sourcePosition, sourcePosition) > 2 || manhattanDistance(ctx.sourcePosition, toPosition) > 2) {
    return { events };
  }
  const transferAmount = Math.min(amount, normalizeUnitBoosts(fromUnit.boosts));
  if (transferAmount <= 0) return { events };

  events.push({
    type: SW_EVENTS.UNIT_CHARGED,
    payload: { position: sourcePosition, delta: -transferAmount, sourceAbilityId: 'mogu_transmission' },
    timestamp,
  });
  events.push({
    type: SW_EVENTS.UNIT_CHARGED,
    payload: { position: toPosition, delta: transferAmount, sourceAbilityId: 'mogu_transmission' },
    timestamp,
  });
  return { events };
}, { payloadContract: { required: ['mode', 'toPosition', 'amount'], optional: ['fromPosition'] } });

/** 狂热菌菇 - 持续效果手动结算 */
abilityExecutorRegistry.register('mogu_fanatical_fungus', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, payload, ownerId: playerId, timestamp } = ctx;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  const newPosition = payload.newPosition as CellCoord | undefined;
  if (!targetPosition) return { events };
  const target = getUnitAt(core, targetPosition);
  if (!target || target.owner !== playerId) return { events };

  const finalPosition = newPosition ?? targetPosition;
  if (newPosition && isCellEmpty(core, newPosition) && manhattanDistance(targetPosition, newPosition) === 1) {
    events.push({
      type: SW_EVENTS.UNIT_PUSHED,
      payload: { targetPosition, newPosition },
      timestamp,
    });
  }
  events.push({
    type: SW_EVENTS.UNIT_CHARGED,
    payload: { position: finalPosition, delta: 1, sourceAbilityId: 'mogu_fanatical_fungus' },
    timestamp,
  });
  events.push({
    type: SW_EVENTS.UNIT_DAMAGED,
    payload: { position: finalPosition, damage: 1, reason: 'mogu_fanatical_fungus', sourcePlayerId: playerId },
    timestamp,
  });
  return { events };
}, { payloadContract: { required: ['targetPosition'], optional: ['newPosition'] } });
