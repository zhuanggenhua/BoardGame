/**
 * 召唤师战争 - 亡灵法师技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import type { UnitCard, CellCoord } from '../types';
import { SW_EVENTS } from '../types';
import { findBoardUnitByCardId, findBoardUnitByInstanceId, emitDestroyWithTriggers } from '../execute/helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

/** 复活死灵 */
abilityExecutorRegistry.register('revive_undead', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const targetCardId = payload.targetCardId as string | undefined;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  if (!targetCardId || !targetPosition) return { events };

  events.push({
    type: SW_EVENTS.UNIT_DAMAGED,
    payload: { position: sourcePosition, damage: 2, reason: 'revive_undead', sourcePlayerId: playerId },
    timestamp,
  });
  const player = core.players[playerId as '0' | '1'];
  const card = player.discard.find(c => c.id === targetCardId);
  if (card && card.cardType === 'unit') {
    events.push({
      type: SW_EVENTS.UNIT_SUMMONED,
      payload: { playerId, cardId: targetCardId, position: targetPosition, card: card as UnitCard, fromDiscard: true },
      timestamp,
    });
  }
  return { events };
}, { payloadContract: { required: ['targetCardId', 'targetPosition'] } });

/** 吸取生命 */
abilityExecutorRegistry.register('life_drain', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const targetUnitId = payload.targetUnitId as string | undefined;
  if (!targetUnitId) return { events };

  const ldVictim = findBoardUnitByInstanceId(core, targetUnitId)
    ?? findBoardUnitByCardId(core, targetUnitId, playerId as '0' | '1');
  if (ldVictim) {
    events.push(...emitDestroyWithTriggers(core, ldVictim.unit, ldVictim.position, {
      playerId: playerId as '0' | '1', timestamp, reason: 'life_drain',
    }));
    // 效果（special 算近战命中）由 execute.ts 的 beforeAttackSpecialCountsAsMelee 处理
  }
  return { events };
});

/** 感染 */
abilityExecutorRegistry.register('infection', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, payload, ownerId: playerId, timestamp } = ctx;
  const targetCardId = payload.targetCardId as string | undefined;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  if (!targetCardId || !targetPosition) return { events };

  const player = core.players[playerId as '0' | '1'];
  const card = player.discard.find(c => c.id === targetCardId);
  if (card && card.cardType === 'unit') {
    events.push({
      type: SW_EVENTS.UNIT_SUMMONED,
      payload: { playerId, cardId: targetCardId, position: targetPosition, card: card as UnitCard, fromDiscard: true },
      timestamp,
    });
  }
  return { events };
});

/** 灵魂转移 */
abilityExecutorRegistry.register('soul_transfer', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { sourcePosition, sourceId: sourceUnitId, payload, timestamp } = ctx;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  if (!targetPosition) return { events };

  events.push({
    type: SW_EVENTS.UNIT_MOVED,
    payload: { 
      from: sourcePosition, 
      to: targetPosition, 
      unitId: sourceUnitId, 
      reason: 'soul_transfer',
      path: [sourcePosition, targetPosition], // 传送类移动
    },
    timestamp,
  });
  return { events };
});
