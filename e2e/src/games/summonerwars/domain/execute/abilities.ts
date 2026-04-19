/**
 * 召唤师战争 - ACTIVATE_ABILITY 子命令处理
 *
 * 通过 AbilityExecutorRegistry 分发，不再使用 switch-case。
 */

import type { GameEvent } from '../../../../engine/types';
import type { SummonerWarsCore, PlayerId, CellCoord } from '../types';
import { SW_EVENTS } from '../types';
import { getUnitAt } from '../helpers';
import { findBoardUnitByInstanceId, createAbilityTriggeredEvent } from './helpers';
import { abilityExecutorRegistry } from '../executors';
import { abilityRegistry } from '../abilities';
import type { SWAbilityContext } from '../executors/types';
import { triggerAbilities, type AbilityContext } from '../abilityResolver';

/**
 * 执行主动技能命令
 *
 * 签名保持不变（push 到 events 数组），供 execute.ts 调用。
 */
export function executeActivateAbility(
  events: GameEvent[],
  core: SummonerWarsCore,
  playerId: PlayerId,
  payload: Record<string, unknown>,
  timestamp: number
): void {
  const abilityId = payload.abilityId as string;
  const sourceUnitId = payload.sourceUnitId as string;

  // 寒冰冲撞：事件卡持续效果，无源单位，直接走执行器
  if (abilityId === 'ice_ram') {
    const executor = abilityExecutorRegistry.resolve('ice_ram');
    if (!executor) return;
    // 构造虚拟上下文（sourceUnit 用空占位，executor 不依赖它）
    const structurePos = payload.structurePosition as { row: number; col: number } | undefined;
    const ctx: SWAbilityContext = {
      sourceId: 'ice_ram',
      ownerId: playerId,
      timestamp,
      core,
      sourceUnit: { instanceId: 'ice_ram#0', cardId: 'ice_ram', card: {} as never, owner: playerId, position: structurePos ?? { row: 0, col: 0 }, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false },
      sourcePosition: structurePos ?? { row: 0, col: 0 },
      payload,
    };
    const result = executor(ctx);
    events.push(...result.events);
    return;
  }

  // 查找源单位（sourceUnitId 为 instanceId）
  const found = findBoardUnitByInstanceId(core, sourceUnitId);
  if (!found) {
    console.warn('[SummonerWars] 技能源单位未找到:', sourceUnitId);
    return;
  }
  const sourceUnit = found.unit;
  const sourcePosition = found.position;

  // 实际执行也会保留一条 ABILITY_TRIGGERED 记录用于日志/usageCount，
  // 但 interactionResolved=true 表示 UI / InteractionSystem 不应再次打开选择交互。
  events.push(createAbilityTriggeredEvent(abilityId, sourceUnitId, sourcePosition, timestamp, {
    interactionResolved: true,
  }));

  // 注册表分发
  const executor = abilityExecutorRegistry.resolve(abilityId);
  if (!executor) {
    console.warn('[SummonerWars] 未注册的技能执行器:', abilityId);
    return;
  }

  const ctx: SWAbilityContext = {
    sourceId: sourceUnitId,
    ownerId: playerId,
    timestamp,
    core,
    sourceUnit,
    sourcePosition,
    payload,
  };

  const result = executor(ctx);
  events.push(...result.events);

  // 方案 A：心灵捕获在玩家完成“控制/伤害”决策并结算后，才触发 afterAttack 技能
  if (abilityId === 'mind_capture_resolve') {
    const targetPosition = payload.targetPosition as CellCoord | undefined;
    const afterAttackCtx: AbilityContext = {
      state: core,
      sourceUnit,
      sourcePosition,
      ownerId: playerId,
      targetUnit: targetPosition ? getUnitAt(core, targetPosition) : undefined,
      targetPosition,
      timestamp,
    };
    events.push(...triggerAbilities('afterAttack', afterAttackCtx));
  }

  /**
   * @deprecated 推荐使用引擎层的通用约束系统（engine/primitives/abilityConstraints）
   * 
   * 此处保留是为了支持现有技能的行动消耗机制。
   * 新增技能应使用 constraints 字段声明约束，execute 层通过事件消耗行动。
   * 
   * 通用机制：技能声明 costsMoveAction 时自动消耗一次移动行动
   */
  const abilityDef = abilityRegistry.get(abilityId);
  if (abilityDef?.costsMoveAction) {
    events.push({
      type: SW_EVENTS.MOVE_ACTION_CONSUMED,
      payload: { position: sourcePosition, unitId: sourceUnitId, sourceAbilityId: abilityId },
      timestamp,
    });
  }
  /**
   * @deprecated 推荐使用引擎层的通用约束系统（engine/primitives/abilityConstraints）
   * 
   * 通用机制：技能声明 costsAttackAction 时自动消耗一次攻击行动
   */
  if (abilityDef?.costsAttackAction) {
    events.push({
      type: SW_EVENTS.ATTACK_ACTION_CONSUMED,
      payload: { position: sourcePosition, unitId: sourceUnitId, sourceAbilityId: abilityId },
      timestamp,
    });
  }
}
