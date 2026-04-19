/**
 * 召唤师战争 - 洞穴地精技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import type { CellCoord } from '../types';
import { SW_EVENTS } from '../types';
import { getUnitAt, isCellEmpty } from '../helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

/** 神出鬼没 */
abilityExecutorRegistry.register('vanish', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const vanishTargetPos = payload.targetPosition as CellCoord | undefined;
  if (!vanishTargetPos) return { events };

  const vanishTarget = getUnitAt(core, vanishTargetPos);
  if (!vanishTarget || vanishTarget.owner !== playerId || vanishTarget.card.cost !== 0) return { events };

  events.push({
    type: SW_EVENTS.UNITS_SWAPPED,
    payload: {
      positionA: sourcePosition,
      positionB: vanishTargetPos,
      unitIdA: sourceUnit.instanceId,
      unitIdB: vanishTarget.instanceId,
    },
    timestamp,
  });
  return { events };
});

/** 鲜血符文 */
abilityExecutorRegistry.register('blood_rune', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const brChoice = payload.choice as 'damage' | 'charge';

  if (brChoice === 'damage') {
    events.push({
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: { position: sourcePosition, damage: 1, reason: 'blood_rune', sourcePlayerId: playerId },
      timestamp,
    });
  } else {
    events.push({
      type: SW_EVENTS.MAGIC_CHANGED,
      payload: { playerId, delta: -1 },
      timestamp,
    });
    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: sourcePosition, delta: 1 },
      timestamp,
    });
  }
  return { events };
});

/** 喂养巨食兽 */
abilityExecutorRegistry.register('feed_beast', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const fbChoice = payload.choice as string | undefined;

  if (fbChoice === 'self_destroy') {
    events.push({
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: {
        position: sourcePosition, cardId: sourceUnit.cardId, instanceId: sourceUnit.instanceId,
        cardName: sourceUnit.card.name, owner: sourceUnit.owner,
        reason: 'feed_beast_self',
      },
      timestamp,
    });
  } else if (fbChoice === 'destroy_adjacent') {
    const fbTargetPos = payload.targetPosition as CellCoord | undefined;
    if (!fbTargetPos) return { events };
    const fbTarget = getUnitAt(core, fbTargetPos);
    if (!fbTarget || fbTarget.owner !== playerId) return { events };
    events.push({
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: {
        position: fbTargetPos, cardId: fbTarget.cardId, instanceId: fbTarget.instanceId,
        cardName: fbTarget.card.name, owner: fbTarget.owner,
        killerPlayerId: playerId,
        killerUnitId: sourceUnit.instanceId,
        reason: 'feed_beast',
      },
      timestamp,
    });
  } else {
    return { events };
  }
  return { events };
}, { payloadContract: { required: ['choice'], optional: ['targetPosition'] } });

/** 魔力成瘾 */
abilityExecutorRegistry.register('magic_addiction', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, ownerId: playerId, timestamp } = ctx;

  if (core.players[playerId as '0' | '1'].magic >= 1) {
    events.push({
      type: SW_EVENTS.MAGIC_CHANGED,
      payload: { playerId, delta: -1 },
      timestamp,
    });
  } else {
    events.push({
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: {
        position: sourcePosition, cardId: sourceUnit.cardId, instanceId: sourceUnit.instanceId,
        cardName: sourceUnit.card.name, owner: sourceUnit.owner,
        reason: 'magic_addiction',
      },
      timestamp,
    });
  }
  return { events };
});

/** 抓附跟随 */
abilityExecutorRegistry.register('grab', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourcePosition, sourceId: sourceUnitId, payload, timestamp } = ctx;
  const grabTargetPos = payload.targetPosition as CellCoord | undefined;
  if (!grabTargetPos) return { events };
  if (!isCellEmpty(core, grabTargetPos)) return { events };

  events.push({
    type: SW_EVENTS.UNIT_MOVED,
    payload: { 
      from: sourcePosition, 
      to: grabTargetPos, 
      unitId: sourceUnitId, 
      reason: 'grab',
      path: [sourcePosition, grabTargetPos], // 单格移动
    },
    timestamp,
  });
  return { events };
});
