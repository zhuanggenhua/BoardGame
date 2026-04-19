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
          targetUnitId: captureTarget.instanceId,
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
        targetUnitId: illusionTarget.instanceId,
        targetPosition: illusionTargetPos,
        copiedAbilities,
      },
      timestamp,
    });
  }
  return { events };
});

/** 念力 / 高阶念力（共享逻辑，使用 moveRow/moveCol 方向向量，或 direction: 'push'/'pull'） */
function executeTelekinesis(ctx: SWAbilityContext, maxRange: number): GameEvent[] {
  const events: GameEvent[] = [];
  const { core, sourcePosition, payload, timestamp } = ctx;
  const pushPullTargetPos = payload.targetPosition as CellCoord | undefined;
  let moveRow = payload.moveRow as number | undefined;
  let moveCol = payload.moveCol as number | undefined;
  let isPull = false;

  // 支持 direction: 'push'/'pull' 字段（从 source→target 方向计算向量）
  if (moveRow === undefined && moveCol === undefined && payload.direction) {
    const direction = payload.direction as 'push' | 'pull';
    isPull = direction === 'pull';
    const dr = pushPullTargetPos ? pushPullTargetPos.row - sourcePosition.row : 0;
    const dc = pushPullTargetPos ? pushPullTargetPos.col - sourcePosition.col : 0;
    // 归一化为单格方向向量
    const normR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
    const normC = dc === 0 ? 0 : dc > 0 ? 1 : -1;
    if (direction === 'push') {
      // 推：沿 source→target 方向继续移动
      moveRow = normR;
      moveCol = normC;
    } else {
      // 拉：沿 target→source 方向移动（反向）
      moveRow = -normR;
      moveCol = -normC;
    }
  }

  if (!pushPullTargetPos || (moveRow === undefined && moveCol === undefined)) return events;

  const pushPullTarget = getUnitAt(core, pushPullTargetPos);
  if (!pushPullTarget || pushPullTarget.card.unitClass === 'summoner') return events;
  if (getUnitAbilities(pushPullTarget, core).includes('stable')) return events;

  const dist = manhattanDistance(sourcePosition, pushPullTargetPos);
  if (dist > maxRange) return events;

  // 沿指定方向移动1格（普通 Force，不穿过单位）
  const dr = moveRow ?? 0;
  const dc = moveCol ?? 0;
  const newPos = { row: pushPullTargetPos.row + dr, col: pushPullTargetPos.col + dc };
  if (isValidCoord(newPos) && isCellEmpty(core, newPos)) {
    events.push({
      type: isPull ? SW_EVENTS.UNIT_PULLED : SW_EVENTS.UNIT_PUSHED,
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

// 高阶念力（代替攻击）：复用相同的推拉逻辑
abilityExecutorRegistry.register('high_telekinesis_instead', (ctx) => ({
  events: executeTelekinesis(ctx, 3),
}));

// 念力（代替攻击）：复用相同的推拉逻辑，范围2格
abilityExecutorRegistry.register('telekinesis_instead', (ctx) => ({
  events: executeTelekinesis(ctx, 2),
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
      targetUnitId: extraAttackTarget.instanceId,
      sourceAbilityId: 'mind_transmission',
    },
    timestamp,
  });
  return { events };
});
