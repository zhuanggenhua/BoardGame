/**
 * 召唤师战争 - execute 层公共辅助函数
 *
 * 消除 execute 内部的重复代码：
 * - findBoardUnitByCardId: 替代 5 处嵌套 for 循环
 * - emitDestroyWithTriggers: 统一 ~8 处 UNIT_DESTROYED + 触发链
 * - createAbilityTriggeredEvent: 替代 6 处 ABILITY_TRIGGERED 样板
 * - postProcessDeathChecks: 增强版（补充 onKill/onDeath）
 * - getFuneralPyreChargeEvents: 殉葬火堆充能
 * - getPhaseDisplayName: 阶段显示名
 */

import type { GameEvent } from '../../../../engine/types';
import type {
  SummonerWarsCore,
  PlayerId,
  BoardUnit,
  CellCoord,
} from '../types';
import { SW_EVENTS } from '../types';
import { findOnGrid } from '../../../../engine/primitives/grid';
import type { BoardCell } from '../types';
import { getEffectiveLife, getEffectiveStructureLife, triggerAbilities, triggerAllUnitsAbilities } from '../abilityResolver';
import type { AbilityContext } from '../abilityResolver';
import { reduceEvent } from '../reduce';
import { abilityRegistry } from '../abilities';
import { getBaseCardId, CARD_IDS } from '../ids';

// ============================================================================
// 棋盘查询
// ============================================================================

/**
 * 在棋盘上按 cardId 查找单位
 *
 * @deprecated 同类型多单位时只返回第一个，应使用 findBoardUnitByInstanceId
 */
export function findBoardUnitByCardId(
  core: SummonerWarsCore,
  cardId: string,
  ownerFilter?: PlayerId,
): { unit: BoardUnit; position: CellCoord } | undefined {
  const result = findOnGrid<BoardCell>(core.board, (cell) => {
    const unit = cell.unit;
    return !!unit && unit.cardId === cardId && (!ownerFilter || unit.owner === ownerFilter);
  });
  if (!result || !result.cell.unit) return undefined;
  return { unit: result.cell.unit, position: result.position };
}

/**
 * 在棋盘上按 instanceId 查找单位（唯一匹配）
 */
export function findBoardUnitByInstanceId(
  core: SummonerWarsCore,
  instanceId: string,
): { unit: BoardUnit; position: CellCoord } | undefined {
  const result = findOnGrid<BoardCell>(core.board, (cell) => {
    return !!cell.unit && cell.unit.instanceId === instanceId;
  });
  if (!result || !result.cell.unit) return undefined;
  return { unit: result.cell.unit, position: result.position };
}

// ============================================================================
// 事件工厂
// ============================================================================

/**
 * 创建 ABILITY_TRIGGERED 事件
 *
 * engine-systems.md 规范禁止手写 ABILITY_TRIGGERED payload，必须用此函数。
 */
export function createAbilityTriggeredEvent(
  abilityId: string,
  sourceUnitId: string,
  sourcePosition: CellCoord,
  timestamp: number,
  extra?: Record<string, unknown>,
): GameEvent {
  // 支持带前缀的 abilityId（如 'afterMove:spirit_bond'），提取真实 ID 查 registry
  const baseId = abilityId.includes(':') ? abilityId.split(':')[1] : abilityId;
  const abilityName = abilityRegistry.get(baseId)?.name;
  return {
    type: SW_EVENTS.ABILITY_TRIGGERED,
    payload: {
      abilityId,
      ...(abilityName ? { abilityName } : {}),
      sourceUnitId,
      sourcePosition,
      ...extra,
    },
    timestamp,
  };
}

// ============================================================================
// 销毁 + 触发链
// ============================================================================

export interface DestroyOptions {
  /** 击杀者（用于 onKill 触发） */
  killer?: { unit: BoardUnit; position: CellCoord };
  /** 击杀者玩家 ID（用于魔力奖励） */
  killerPlayerId?: PlayerId;
  /** 当前玩家 ID */
  playerId: PlayerId;
  timestamp: number;
  /** 销毁原因标记 */
  reason?: string;
  /** 是否跳过魔力奖励 */
  skipMagicReward?: boolean;
  /** 是否触发 onKill（默认 false） */
  triggerOnKill?: boolean;
  /** 是否触发 onDeath（默认 false） */
  triggerOnDeath?: boolean;
}

/**
 * 生成 UNIT_DESTROYED 事件 + 完整触发链
 *
 * 统一 ~8 处销毁+触发模式。支持的触发组合：
 * - 仅 DESTROYED + onUnitDestroyed（默认）
 * - DESTROYED + onKill + onDeath + onUnitDestroyed（完整击杀链）
 */
export function emitDestroyWithTriggers(
  core: SummonerWarsCore,
  victim: BoardUnit,
  position: CellCoord,
  opts: DestroyOptions,
): GameEvent[] {
  const events: GameEvent[] = [];
  const killerPlayerId = opts.killerPlayerId ?? opts.killer?.unit.owner;

  // 1. UNIT_DESTROYED 事件
  events.push({
    type: SW_EVENTS.UNIT_DESTROYED,
    payload: {
      position,
      cardId: victim.cardId,
      instanceId: victim.instanceId,
      cardName: victim.card.name,
      owner: victim.owner,
      ...(opts.reason ? { reason: opts.reason } : {}),
      ...(killerPlayerId ? { killerPlayerId } : {}),
      ...(opts.killer?.unit.instanceId ? { killerUnitId: opts.killer.unit.instanceId } : {}),
      ...(opts.skipMagicReward ? { skipMagicReward: true } : {}),
    },
    timestamp: opts.timestamp,
  });

  // 2. onKill 触发（感染、灵魂转移等）
  if (opts.triggerOnKill && opts.killer) {
    const killerCtx: AbilityContext = {
      state: core,
      sourceUnit: opts.killer.unit,
      sourcePosition: opts.killer.position,
      ownerId: opts.playerId,
      victimUnit: victim,
      victimPosition: position,
      timestamp: opts.timestamp,
    };
    events.push(...triggerAbilities('onKill', killerCtx));
  }

  // 3. onDeath 触发（献祭等）
  if (opts.triggerOnDeath) {
    const victimCtx: AbilityContext = {
      state: core,
      sourceUnit: victim,
      sourcePosition: position,
      ownerId: victim.owner,
      killerUnit: opts.killer?.unit,
      timestamp: opts.timestamp,
    };
    events.push(...triggerAbilities('onDeath', victimCtx));
  }

  // 4. onUnitDestroyed 触发（血腥狂怒等全局回调）
  // 注意：blood_rage 规则为"在你的回合中"，所以只遍历当前回合玩家的单位
  events.push(...triggerAllUnitsAbilities('onUnitDestroyed', core, opts.playerId, {
    victimUnit: victim,
    victimPosition: position,
    timestamp: opts.timestamp,
  }));

  return events;
}

// ============================================================================
// 事件后处理
// ============================================================================

/**
 * 后处理：自动补全死亡检测（支持连锁）
 *
 * 遍历事件列表，对每个 UNIT_DAMAGED 模拟累计伤害，
 * 若致死且该单位尚无 UNIT_DESTROYED 事件，则自动注入完整触发链。
 * 注入的事件也会被后续迭代处理，因此支持连锁死亡。
 */
export function postProcessDeathChecks(
  events: GameEvent[],
  originalCore: SummonerWarsCore,
): GameEvent[] {
  // 预收集已有 UNIT_DESTROYED 的 instanceId（优先）和 cardId（兼容），避免重复注入
  const destroyedUnitIds = new Set<string>();
  const destroyedStructureIds = new Set<string>();
  for (const e of events) {
    if (e.type === SW_EVENTS.UNIT_DESTROYED) {
      const p = e.payload as Record<string, unknown>;
      // 优先用 instanceId 去重，兼容旧事件用 cardId
      const id = (p.instanceId as string) ?? (p.cardId as string);
      if (id) destroyedUnitIds.add(id);
    }
    if (e.type === SW_EVENTS.STRUCTURE_DESTROYED) {
      const cardId = (e.payload as Record<string, unknown>).cardId as string;
      if (cardId) destroyedStructureIds.add(cardId);
    }
  }

  const result: GameEvent[] = [...events];
  let workingState = originalCore;
  let idx = 0;
  const maxEvents = events.length + 200; // 安全上限

  while (idx < result.length && result.length < maxEvents) {
    const event = result[idx];

    if (event.type === SW_EVENTS.UNIT_DAMAGED) {
      const { position, damage, sourcePlayerId, skipMagicReward } = event.payload as {
        position: CellCoord;
        damage: number;
        sourcePlayerId?: PlayerId;
        skipMagicReward?: boolean;
      };
      const cell = workingState.board[position.row]?.[position.col];
      const unit = cell?.unit;
      const structure = cell?.structure;

      if (unit && !destroyedUnitIds.has(unit.instanceId)) {
        const newDamage = unit.damage + damage;
        if (newDamage >= getEffectiveLife(unit, workingState)) {
          // 注入完整触发链（triggerOnDeath: 间接伤害致死也应触发 onDeath 能力，如献祭）
          const destroyEvents = emitDestroyWithTriggers(workingState, unit, position, {
            playerId: sourcePlayerId ?? workingState.currentPlayer,
            killerPlayerId: sourcePlayerId,
            skipMagicReward,
            timestamp: event.timestamp,
            triggerOnDeath: true,
          });
          result.splice(idx + 1, 0, ...destroyEvents);
          destroyedUnitIds.add(unit.instanceId);
        }
      } else if (structure && !destroyedStructureIds.has(structure.cardId)) {
        const newDamage = structure.damage + damage;
        if (newDamage >= getEffectiveStructureLife(workingState, structure)) {
          result.splice(idx + 1, 0, {
            type: SW_EVENTS.STRUCTURE_DESTROYED,
            payload: {
              position,
              cardId: structure.cardId,
              cardName: structure.card.name,
              owner: structure.owner,
              isGate: structure.card.isGate ?? structure.card.isStartingGate ?? false,
              ...(sourcePlayerId ? { killerPlayerId: sourcePlayerId } : {}),
              ...(skipMagicReward ? { skipMagicReward: true } : {}),
            },
            timestamp: event.timestamp,
          });
          destroyedStructureIds.add(structure.cardId);
        }
      }
    }

    workingState = reduceEvent(workingState, event);
    idx++;
  }

  return result;
}

/**
 * 检查双方主动事件区是否有殉葬火堆，有则生成充能事件
 */
export function getFuneralPyreChargeEvents(core: SummonerWarsCore, timestamp: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (const pid of ['0', '1'] as PlayerId[]) {
    const player = core.players[pid];
    for (const ev of player.activeEvents) {
      if (ev.name === '殉葬火堆' || getBaseCardId(ev.id) === CARD_IDS.NECRO_FUNERAL_PYRE) {
        events.push({
          type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
          payload: { playerId: pid, cardId: ev.id },
          timestamp,
        });
      }
    }
  }
  return events;
}

/** 获取阶段显示名称 */
export function getPhaseDisplayName(phase: string): string {
  const names: Record<string, string> = {
    summon: '召唤阶段',
    move: '移动阶段',
    build: '建造阶段',
    attack: '攻击阶段',
    magic: '魔力阶段',
    draw: '抽牌阶段',
  };
  return names[phase] ?? phase;
}
