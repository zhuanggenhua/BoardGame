/**
 * 召唤师战争 - 炽原精灵技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import type { CellCoord } from '../types';
import { SW_EVENTS } from '../types';
import { getUnitAt, manhattanDistance, isValidCoord, isForceMovePathClear, isInStraightLine, getStraightLinePath } from '../helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

/** 祖灵羁绊 */
abilityExecutorRegistry.register('ancestral_bond', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const abTargetPos = payload.targetPosition as CellCoord | undefined;
  if (!abTargetPos) return { events };

  const abTarget = getUnitAt(core, abTargetPos);
  if (!abTarget || abTarget.owner !== playerId) return { events };
  const abDist = manhattanDistance(sourcePosition, abTargetPos);
  if (abDist > 3) return { events };

  // 先充能目标1点
  events.push({
    type: SW_EVENTS.UNIT_CHARGED,
    payload: { position: abTargetPos, delta: 1, sourceAbilityId: 'ancestral_bond' },
    timestamp,
  });
  // 转移自身所有充能到目标
  const selfCharges = sourceUnit.boosts ?? 0;
  if (selfCharges > 0) {
    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: sourcePosition, delta: -selfCharges, sourceAbilityId: 'ancestral_bond' },
      timestamp,
    });
    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: abTargetPos, delta: selfCharges, sourceAbilityId: 'ancestral_bond' },
      timestamp,
    });
  }
  return { events };
});

/** 预备 */
abilityExecutorRegistry.register('prepare', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { sourcePosition, timestamp } = ctx;
  events.push({
    type: SW_EVENTS.UNIT_CHARGED,
    payload: { position: sourcePosition, delta: 1, sourceAbilityId: 'prepare' },
    timestamp,
  });
  return { events };
});

/** 启悟 */
abilityExecutorRegistry.register('inspire', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, ownerId: playerId, timestamp } = ctx;
  const adjDirs = [
    { row: -1, col: 0 }, { row: 1, col: 0 },
    { row: 0, col: -1 }, { row: 0, col: 1 },
  ];
  for (const d of adjDirs) {
    const adjPos = { row: sourcePosition.row + d.row, col: sourcePosition.col + d.col };
    if (!isValidCoord(adjPos)) continue;
    const adjUnit = getUnitAt(core, adjPos);
    if (adjUnit && adjUnit.owner === playerId && adjUnit.instanceId !== sourceUnit.instanceId) {
      events.push({
        type: SW_EVENTS.UNIT_CHARGED,
        payload: { position: adjPos, delta: 1, sourceAbilityId: 'inspire' },
        timestamp,
      });
    }
  }
  return { events };
});

/** 撤退 */
abilityExecutorRegistry.register('withdraw', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, sourceId: sourceUnitId, payload, ownerId: playerId, timestamp } = ctx;
  const wdCostType = payload.costType as 'charge' | 'magic';
  const wdNewPos = payload.targetPosition as CellCoord | undefined;
  if (!wdNewPos) return { events };

  if (wdCostType === 'charge') {
    if ((sourceUnit.boosts ?? 0) < 1) return { events };
    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: sourcePosition, delta: -1, sourceAbilityId: 'withdraw' },
      timestamp,
    });
  } else {
    if (core.players[playerId as '0' | '1'].magic < 1) return { events };
    events.push({
      type: SW_EVENTS.MAGIC_CHANGED,
      payload: { playerId, delta: -1 },
      timestamp,
    });
  }

  const wdDist = manhattanDistance(sourcePosition, wdNewPos);
  if (wdDist >= 1 && wdDist <= 2
    && isInStraightLine(sourcePosition, wdNewPos)
    && isForceMovePathClear(core, sourcePosition, wdNewPos)) {
    events.push({
      type: SW_EVENTS.UNIT_MOVED,
      payload: { 
        from: sourcePosition, 
        to: wdNewPos, 
        unitId: sourceUnitId, 
        reason: 'withdraw',
        path: getStraightLinePath(sourcePosition, wdNewPos), // 直线移动
      },
      timestamp,
    });
  }
  return { events };
}, { payloadContract: { required: ['costType', 'targetPosition'] } });

/** 连续射击：消耗1充能，授予额外攻击 */
abilityExecutorRegistry.register('rapid_fire', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { sourceUnit, sourcePosition, timestamp } = ctx;
  if ((sourceUnit.boosts ?? 0) < 1) return { events };
  events.push({
    type: SW_EVENTS.UNIT_CHARGED,
    payload: { position: sourcePosition, delta: -1, sourceAbilityId: 'rapid_fire' },
    timestamp,
  });
  events.push({
    type: SW_EVENTS.EXTRA_ATTACK_GRANTED,
    payload: {
      targetPosition: sourcePosition,
      targetUnitId: sourceUnit.instanceId,
      sourceAbilityId: 'rapid_fire',
    },
    timestamp,
  });
  return { events };
});

/** 祖灵交流 */
abilityExecutorRegistry.register('spirit_bond', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const sbChoice = payload.choice as 'self' | 'transfer';

  if (sbChoice === 'self') {
    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: sourcePosition, delta: 1, sourceAbilityId: 'spirit_bond' },
      timestamp,
    });
  } else if (sbChoice === 'transfer') {
    const sbTargetPos = payload.targetPosition as CellCoord | undefined;
    if (!sbTargetPos) return { events };
    if ((sourceUnit.boosts ?? 0) < 1) return { events };
    const sbTarget = getUnitAt(core, sbTargetPos);
    if (!sbTarget || sbTarget.owner !== playerId) return { events };
    const sbDist = manhattanDistance(sourcePosition, sbTargetPos);
    if (sbDist > 3) return { events };

    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: sourcePosition, delta: -1, sourceAbilityId: 'spirit_bond' },
      timestamp,
    });
    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: sbTargetPos, delta: 1, sourceAbilityId: 'spirit_bond' },
      timestamp,
    });
  }
  return { events };
}, { payloadContract: { required: ['choice'], optional: ['targetPosition'] } });
