/**
 * 召唤师战争 - 暗影精灵技能执行器
 *
 * 目标选择由 InteractionSystem 产生，执行器只接受已经选定的参数，
 * 并把最终的领域状态变化转换成事件。
 */

import type { GameEvent } from '../../../../engine/types';
import type { CellCoord } from '../types';
import { SW_EVENTS } from '../types';
import {
  getAdjacentCells,
  getStructureAt,
  getUnitAt,
  getPlayerUnits,
  isCellEmpty,
  isForceMovePathClear,
  isValidCoord,
  manhattanDistance,
} from '../helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

function isSoldierOrChampion(unit: { card: { unitClass: string } }): boolean {
  return unit.card.unitClass === 'common' || unit.card.unitClass === 'champion';
}

function findUnitByInstanceId(ctx: SWAbilityContext, instanceId: string) {
  return getPlayerUnits(ctx.core, ctx.ownerId).find((unit) => unit.instanceId === instanceId)
    ?? getPlayerUnits(ctx.core, ctx.ownerId === '0' ? '1' : '0').find((unit) => unit.instanceId === instanceId);
}

/** 回归暗影：消耗2点充能，把3格内友方单位返回手牌。 */
abilityExecutorRegistry.register('shadow_return_to_shadow', (ctx: SWAbilityContext) => {
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  if (!targetPosition || ctx.sourceUnit.boosts < 2) return { events: [] };

  const target = getUnitAt(ctx.core, targetPosition);
  if (!target || target.owner !== ctx.ownerId || target.instanceId === ctx.sourceUnit.instanceId) {
    return { events: [] };
  }
  if (manhattanDistance(ctx.sourcePosition, targetPosition) > 3) return { events: [] };

  const events: GameEvent[] = [
    {
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: ctx.sourcePosition, delta: -2, sourceAbilityId: 'shadow_return_to_shadow' },
      timestamp: ctx.timestamp,
    },
    {
      type: SW_EVENTS.UNIT_RETURNED_TO_HAND,
      payload: {
        position: targetPosition,
        unitId: target.instanceId,
        cardId: target.cardId,
        card: target.card,
        owner: target.owner,
        attachedUnits: target.attachedUnits,
        attachedCards: target.attachedCards,
        sourceAbilityId: 'shadow_return_to_shadow',
      },
      timestamp: ctx.timestamp,
    },
  ];
  return { events };
}, { payloadContract: { required: ['targetPosition'] } });

/** 审判：消耗任意数量充能，对相邻士兵/英雄造成同等伤害。 */
abilityExecutorRegistry.register('shadow_judgment', (ctx: SWAbilityContext) => {
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  const amount = Number(ctx.payload.amount ?? 0);
  if (!targetPosition || !Number.isInteger(amount) || amount <= 0 || amount > ctx.sourceUnit.boosts) {
    return { events: [] };
  }
  if (manhattanDistance(ctx.sourcePosition, targetPosition) !== 1) return { events: [] };
  const target = getUnitAt(ctx.core, targetPosition);
  if (!target || !isSoldierOrChampion(target)) return { events: [] };

  return {
    events: [
      {
        type: SW_EVENTS.UNIT_CHARGED,
        payload: { position: ctx.sourcePosition, delta: -amount, sourceAbilityId: 'shadow_judgment' },
        timestamp: ctx.timestamp,
      },
      {
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: {
          position: targetPosition,
          damage: amount,
          sourceAbilityId: 'shadow_judgment',
          sourcePlayerId: ctx.ownerId,
        },
        timestamp: ctx.timestamp,
      },
    ],
  };
}, { payloadContract: { required: ['targetPosition', 'amount'] } });

/** 撕裂帷幕：把友方士兵/英雄传送到受伤敌方传送门旁的空格。 */
abilityExecutorRegistry.register('shadow_tear_the_veil', (ctx: SWAbilityContext) => {
  const targetUnitId = ctx.payload.targetUnitId as string | undefined;
  const gatePosition = ctx.payload.gatePosition as CellCoord | undefined;
  const newPosition = ctx.payload.newPosition as CellCoord | undefined;
  if (!targetUnitId || !gatePosition || !newPosition) return { events: [] };

  const target = findUnitByInstanceId(ctx, targetUnitId);
  const gate = getStructureAt(ctx.core, gatePosition);
  if (!target || target.owner !== ctx.ownerId || !isSoldierOrChampion(target)) return { events: [] };
  if (!gate || gate.owner === ctx.ownerId || !gate.card.isGate || gate.damage <= 0) return { events: [] };
  if (manhattanDistance(ctx.sourcePosition, gatePosition) !== 1) return { events: [] };
  if (!getAdjacentCells(gatePosition).some((pos) => pos.row === newPosition.row && pos.col === newPosition.col)) return { events: [] };
  if (!isValidCoord(newPosition) || !isCellEmpty(ctx.core, newPosition)) return { events: [] };

  return {
    events: [{
      type: SW_EVENTS.UNIT_MOVED,
      payload: {
        from: target.position,
        to: newPosition,
        unitId: target.instanceId,
        reason: 'shadow_tear_the_veil',
        path: [target.position, newPosition],
      },
      timestamp: ctx.timestamp,
    }],
  };
}, { payloadContract: { required: ['targetUnitId', 'gatePosition', 'newPosition'] } });

/** 禁忌学识：对自身或相邻传送门造成1点伤害并抓1张牌。 */
abilityExecutorRegistry.register('shadow_forbidden_knowledge', (ctx: SWAbilityContext) => {
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  if (!targetPosition) return { events: [] };
  const targetUnit = getUnitAt(ctx.core, targetPosition);
  const targetStructure = getStructureAt(ctx.core, targetPosition);
  const isSelf = targetUnit?.instanceId === ctx.sourceUnit.instanceId;
  const isAdjacentGate = !!targetStructure
    && targetStructure.card.isGate === true
    && manhattanDistance(ctx.sourcePosition, targetPosition) === 1;
  if (!isSelf && !isAdjacentGate) return { events: [] };

  return {
    events: [
      {
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: {
          position: targetPosition,
          damage: 1,
          sourceAbilityId: 'shadow_forbidden_knowledge',
          sourcePlayerId: ctx.ownerId,
        },
        timestamp: ctx.timestamp,
      },
      {
        type: SW_EVENTS.CARD_DRAWN,
        payload: { playerId: ctx.ownerId, count: 1, sourceAbilityId: 'shadow_forbidden_knowledge' },
        timestamp: ctx.timestamp,
      },
    ],
  };
}, { payloadContract: { required: ['targetPosition'] } });

/** 佯攻：攻击后把自身推拉到选定的两格内直线位置。 */
abilityExecutorRegistry.register('shadow_feint', (ctx: SWAbilityContext) => {
  const newPosition = ctx.payload.newPosition as CellCoord | undefined;
  if (!newPosition) return { events: [] };
  const distance = manhattanDistance(ctx.sourcePosition, newPosition);
  if (distance < 1 || distance > 2 || !isValidCoord(newPosition)) return { events: [] };
  if (ctx.sourcePosition.row !== newPosition.row && ctx.sourcePosition.col !== newPosition.col) return { events: [] };
  if (!isForceMovePathClear(ctx.core, ctx.sourcePosition, newPosition)) return { events: [] };

  return {
    events: [{
      type: SW_EVENTS.UNIT_PUSHED,
      payload: { targetPosition: ctx.sourcePosition, newPosition, sourceAbilityId: 'shadow_feint' },
      timestamp: ctx.timestamp,
    }],
  };
}, { payloadContract: { required: ['newPosition'] } });

/** 暗影召唤：将暗影骑士移动到目标相邻空格，并伤害目标。 */
abilityExecutorRegistry.register('shadow_shadow_summon', (ctx: SWAbilityContext) => {
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  const newPosition = ctx.payload.newPosition as CellCoord | undefined;
  if (!targetPosition || !newPosition) return { events: [] };
  const target = getUnitAt(ctx.core, targetPosition);
  const targetStructure = getStructureAt(ctx.core, targetPosition);
  if (target && (target.owner !== ctx.ownerId || target.card.abilities?.includes('shadow_shadow_summon'))) return { events: [] };
  if (targetStructure && targetStructure.owner !== ctx.ownerId) return { events: [] };
  if (!target && !targetStructure) return { events: [] };
  if (!getAdjacentCells(targetPosition).some((pos) => pos.row === newPosition.row && pos.col === newPosition.col)) return { events: [] };
  if (!isValidCoord(newPosition) || !isCellEmpty(ctx.core, newPosition)) return { events: [] };
  if (manhattanDistance(ctx.sourcePosition, newPosition) !== 1) return { events: [] };

  return {
    events: [
      {
        type: SW_EVENTS.UNIT_MOVED,
        payload: {
          from: ctx.sourcePosition,
          to: newPosition,
          unitId: ctx.sourceUnit.instanceId,
          reason: 'shadow_shadow_summon',
          path: [ctx.sourcePosition, newPosition],
        },
        timestamp: ctx.timestamp,
      },
      {
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: {
          position: targetPosition,
          damage: 1,
          sourceAbilityId: 'shadow_shadow_summon',
          sourcePlayerId: ctx.ownerId,
        },
        timestamp: ctx.timestamp,
      },
    ],
  };
}, { payloadContract: { required: ['targetPosition', 'newPosition'] } });

/** 急袭：召唤后把自身推拉1格。 */
abilityExecutorRegistry.register('shadow_sudden_assault', (ctx: SWAbilityContext) => {
  const newPosition = ctx.payload.newPosition as CellCoord | undefined;
  if (!newPosition || !isValidCoord(newPosition)) return { events: [] };
  if (manhattanDistance(ctx.sourcePosition, newPosition) !== 1 || !isCellEmpty(ctx.core, newPosition)) {
    return { events: [] };
  }
  return {
    events: [{
      type: SW_EVENTS.UNIT_PUSHED,
      payload: { targetPosition: ctx.sourcePosition, newPosition, sourceAbilityId: 'shadow_sudden_assault' },
      timestamp: ctx.timestamp,
    }],
  };
}, { payloadContract: { required: ['newPosition'] } });
