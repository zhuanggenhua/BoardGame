/**
 * 召唤师战争 - 永恒议会技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import type { CellCoord, PlayerId } from '../types';
import { SW_EVENTS } from '../types';
import {
  getUnitAt,
  isCellEmpty,
  isValidCoord,
  manhattanDistance,
} from '../helpers';
import { getSummoner } from '../helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

function drawOneIfPossible(events: GameEvent[], playerId: PlayerId, deckLength: number, timestamp: number, sourceAbilityId: string): void {
  if (deckLength <= 0) return;
  events.push({
    type: SW_EVENTS.CARD_DRAWN,
    payload: { playerId, count: 1, sourceAbilityId },
    timestamp,
  });
}

function discardSelectedHandCard(
  events: GameEvent[],
  ctx: SWAbilityContext,
  sourceAbilityId: 'yongheng_arouse_fear' | 'yongheng_punish',
): void {
  const targetOwner = ctx.payload.targetOwner as PlayerId | undefined;
  const cardId = ctx.payload.targetCardId as string | undefined;
  if (!targetOwner || !cardId) return;
  const targetPlayer = ctx.core.players[targetOwner];
  if (!targetPlayer?.hand.some(card => card.id === cardId)) return;
  events.push({
    type: SW_EVENTS.CARD_DISCARDED,
    payload: { playerId: targetOwner, cardId, sourceAbilityId },
    timestamp: ctx.timestamp,
  });
}

abilityExecutorRegistry.register('yongheng_intelligence', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  drawOneIfPossible(events, ctx.ownerId as PlayerId, ctx.core.players[ctx.ownerId as PlayerId]?.deck.length ?? 0, ctx.timestamp, 'yongheng_intelligence');
  return { events };
});

abilityExecutorRegistry.register('yongheng_wisdom', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  drawOneIfPossible(events, ctx.ownerId as PlayerId, ctx.core.players[ctx.ownerId as PlayerId]?.deck.length ?? 0, ctx.timestamp, 'yongheng_wisdom');
  return { events };
});

abilityExecutorRegistry.register('yongheng_analysis', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  drawOneIfPossible(events, ctx.ownerId as PlayerId, ctx.core.players[ctx.ownerId as PlayerId]?.deck.length ?? 0, ctx.timestamp, 'yongheng_analysis');
  return { events };
});

abilityExecutorRegistry.register('yongheng_search', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  drawOneIfPossible(events, ctx.ownerId as PlayerId, ctx.core.players[ctx.ownerId as PlayerId]?.deck.length ?? 0, ctx.timestamp, 'yongheng_search');
  return { events };
});

abilityExecutorRegistry.register('yongheng_mental_invasion', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  if (!targetPosition) return { events };
  const summoner = getSummoner(ctx.core, ctx.ownerId as PlayerId);
  if (!summoner || manhattanDistance(summoner.position, targetPosition) > 2) return { events };
  const target = getUnitAt(ctx.core, targetPosition);
  if (!target || target.owner === ctx.ownerId) return { events };
  if (target.card.unitClass !== 'common' && target.card.unitClass !== 'champion') return { events };
  events.push({
    type: SW_EVENTS.UNIT_DAMAGED,
    payload: {
      position: targetPosition,
      damage: 1,
      reason: 'yongheng_mental_invasion',
      sourceAbilityId: 'yongheng_mental_invasion',
      sourcePlayerId: ctx.ownerId,
    },
    timestamp: ctx.timestamp,
  });
  return { events };
}, { payloadContract: { required: ['targetPosition'] } });

abilityExecutorRegistry.register('yongheng_warning', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  const newPosition = ctx.payload.newPosition as CellCoord | undefined;
  const cardId = ctx.payload.targetCardId as string | undefined;
  if (!targetPosition || !newPosition || !cardId) return { events };
  const player = ctx.core.players[ctx.ownerId as PlayerId];
  if (!player?.hand.some(card => card.id === cardId)) return { events };
  const summoner = getSummoner(ctx.core, ctx.ownerId as PlayerId);
  if (!summoner || summoner.position.row !== targetPosition.row || summoner.position.col !== targetPosition.col) return { events };
  if (!isValidCoord(newPosition) || manhattanDistance(targetPosition, newPosition) !== 1 || !isCellEmpty(ctx.core, newPosition)) {
    return { events };
  }
  events.push({
    type: SW_EVENTS.CARD_DISCARDED,
    payload: { playerId: ctx.ownerId, cardId, to: 'deckBottom', sourceAbilityId: 'yongheng_warning' },
    timestamp: ctx.timestamp,
  });
  events.push({
    type: SW_EVENTS.UNIT_PUSHED,
    payload: {
      targetPosition,
      newPosition,
      targetUnitId: summoner.instanceId,
      sourceUnitId: ctx.sourceUnit.instanceId,
      sourceAbilityId: 'yongheng_warning',
      distance: 1,
      direction: 'choice',
    },
    timestamp: ctx.timestamp,
  });
  return { events };
}, { payloadContract: { required: ['targetPosition', 'newPosition', 'targetCardId'] } });

abilityExecutorRegistry.register('yongheng_collision', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  const newPosition = ctx.payload.newPosition as CellCoord | undefined;
  if (!targetPosition || !newPosition) return { events };
  if (manhattanDistance(ctx.sourcePosition, targetPosition) !== 1) return { events };
  const target = getUnitAt(ctx.core, targetPosition);
  if (!target || target.owner === ctx.ownerId) return { events };
  if (target.card.unitClass !== 'common' && target.card.unitClass !== 'champion') return { events };
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
      sourceAbilityId: 'yongheng_collision',
      distance: 1,
      direction: 'choice',
    },
    timestamp: ctx.timestamp,
  });
  return { events };
}, { payloadContract: { required: ['targetPosition', 'newPosition'] } });

abilityExecutorRegistry.register('yongheng_application', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
  const cardId = ctx.payload.targetCardId as string | undefined;
  if (!targetPosition || !cardId) return { events };
  const player = ctx.core.players[ctx.ownerId as PlayerId];
  if (!player?.hand.some(card => card.id === cardId)) return { events };
  const target = getUnitAt(ctx.core, targetPosition);
  if (!target || manhattanDistance(ctx.sourcePosition, targetPosition) !== 1) return { events };
  events.push({
    type: SW_EVENTS.CARD_DISCARDED,
    payload: { playerId: ctx.ownerId, cardId, to: 'deckBottom', sourceAbilityId: 'yongheng_application' },
    timestamp: ctx.timestamp,
  });
  events.push({
    type: SW_EVENTS.UNIT_DAMAGED,
    payload: {
      position: targetPosition,
      damage: 1,
      reason: 'yongheng_application',
      sourceAbilityId: 'yongheng_application',
      sourcePlayerId: ctx.ownerId,
    },
    timestamp: ctx.timestamp,
  });
  return { events };
}, { payloadContract: { required: ['targetPosition', 'targetCardId'] } });

abilityExecutorRegistry.register('yongheng_arouse_fear', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  discardSelectedHandCard(events, ctx, 'yongheng_arouse_fear');
  return { events };
}, { payloadContract: { required: ['targetOwner', 'targetCardId'] } });

abilityExecutorRegistry.register('yongheng_punish', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  discardSelectedHandCard(events, ctx, 'yongheng_punish');
  return { events };
}, { payloadContract: { required: ['targetOwner', 'targetCardId'] } });
