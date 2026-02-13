/**
 * 召唤师战争 - 欺心巫族技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import type { CellCoord } from '../types';
import { SW_EVENTS } from '../types';
import {
  getUnitAt,
  getUnitAbilities,
  manhattanDistance,
  isValidCoord,
  isCellEmpty,
} from '../helpers';
import { getEffectiveLife } from '../abilityResolver';
import { emitDestroyWithTriggers } from '../execute/helpers';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

/** 心灵捕获决策 */
abilityExecutorRegistry.register('mind_capture_resolve', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const choice = payload.choice as 'control' | 'damage';
  const captureTargetPos = payload.targetPosition as CellCoord | undefined;
  const captureHits = payload.hits as number | undefined;
  if (!captureTargetPos) return { events };

  if (choice === 'control') {
    const captureTarget = getUnitAt(core, captureTargetPos);
    if (captureTarget && captureTarget.owner !== playerId) {
      events.push({
        type: SW_EVENTS.CONTROL_TRANSFERRED,
        payload: {
          targetPosition: captureTargetPos,
          targetUnitId: captureTarget.cardId,
          newOwner: playerId,
          duration: 'permanent',
          sourceAbilityId: 'mind_capture',
        },
        timestamp,
      });
    }
  } else if (choice === 'damage' && captureHits) {
    events.push({
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: { position: captureTargetPos, damage: captureHits, sourcePlayerId: playerId },
      timestamp,
    });
    const captureTarget = getUnitAt(core, captureTargetPos);
    if (captureTarget) {
      const newDamage = captureTarget.damage + captureHits;
      if (newDamage >= getEffectiveLife(captureTarget, core)) {
        events.push(...emitDestroyWithTriggers(core, captureTarget, captureTargetPos, {
          killer: { unit: sourceUnit, position: sourcePosition },
          playerId: playerId as '0' | '1', timestamp, triggerOnKill: true, triggerOnDeath: true,
        }));
      }
    }
  }
  return { events };
});

/** 幻化 */
abilityExecutorRegistry.register('illusion', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceId: sourceUnitId, sourcePosition, payload, timestamp } = ctx;
  const illusionTargetPos = payload.targetPosition as CellCoord | undefined;
  if (!illusionTargetPos) return { events };

  const illusionTarget = getUnitAt(core, illusionTargetPos);
  if (!illusionTarget) return { events };

  const copiedAbilities = getUnitAbilities(illusionTarget, core);
  if (copiedAbilities.length > 0) {
    events.push({
      type: SW_EVENTS.ABILITIES_COPIED,
      payload: {
        sourceUnitId,
        sourcePosition,
        targetUnitId: illusionTarget.cardId,
        targetPosition: illusionTargetPos,
        copiedAbilities,
      },
      timestamp,
    });
  }
  return { events };
});

/** 念力 / 高阶念力（共享逻辑） */
function executeTelekinesis(ctx: SWAbilityContext, maxRange: number): GameEvent[] {
  const events: GameEvent[] = [];
  const { core, sourcePosition, payload, timestamp } = ctx;
  const pushPullTargetPos = payload.targetPosition as CellCoord | undefined;
  const pushPullDirection = payload.direction as 'push' | 'pull' | undefined;
  if (!pushPullTargetPos || !pushPullDirection) return events;

  const pushPullTarget = getUnitAt(core, pushPullTargetPos);
  if (!pushPullTarget || pushPullTarget.card.unitClass === 'summoner') return events;
  if (getUnitAbilities(pushPullTarget, core).includes('stable')) return events;

  const dist = manhattanDistance(sourcePosition, pushPullTargetPos);
  if (dist > maxRange) return events;

  const dr = pushPullTargetPos.row - sourcePosition.row;
  const dc = pushPullTargetPos.col - sourcePosition.col;
  let moveRow = 0;
  let moveCol = 0;
  if (pushPullDirection === 'push') {
    if (Math.abs(dr) >= Math.abs(dc)) { moveRow = dr > 0 ? 1 : -1; }
    else { moveCol = dc > 0 ? 1 : -1; }
  } else {
    if (Math.abs(dr) >= Math.abs(dc)) { moveRow = dr > 0 ? -1 : 1; }
    else { moveCol = dc > 0 ? -1 : 1; }
  }

  const newPos = { row: pushPullTargetPos.row + moveRow, col: pushPullTargetPos.col + moveCol };
  if (isValidCoord(newPos) && isCellEmpty(core, newPos)) {
    const eventType = pushPullDirection === 'pull' ? SW_EVENTS.UNIT_PULLED : SW_EVENTS.UNIT_PUSHED;
    events.push({
      type: eventType,
      payload: { targetPosition: pushPullTargetPos, newPosition: newPos },
      timestamp,
    });
  }
  return events;
}

abilityExecutorRegistry.register('telekinesis', (ctx) => ({
  events: executeTelekinesis(ctx, 2),
}));

abilityExecutorRegistry.register('high_telekinesis', (ctx) => ({
  events: executeTelekinesis(ctx, 3),
}));

/** 读心传念 */
abilityExecutorRegistry.register('mind_transmission', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const extraAttackTargetPos = payload.targetPosition as CellCoord | undefined;
  if (!extraAttackTargetPos) return { events };

  const extraAttackTarget = getUnitAt(core, extraAttackTargetPos);
  if (!extraAttackTarget) return { events };
  if (extraAttackTarget.owner !== playerId) return { events };
  if (extraAttackTarget.card.unitClass !== 'common') return { events };

  const extraDist = manhattanDistance(sourcePosition, extraAttackTargetPos);
  if (extraDist > 3) return { events };

  events.push({
    type: SW_EVENTS.EXTRA_ATTACK_GRANTED,
    payload: {
      targetPosition: extraAttackTargetPos,
      targetUnitId: extraAttackTarget.cardId,
      sourceAbilityId: 'mind_transmission',
    },
    timestamp,
  });
  return { events };
});
