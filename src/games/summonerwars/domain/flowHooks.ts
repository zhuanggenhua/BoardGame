/**
 * 召唤师战争 - FlowSystem 钩子配置
 * 
 * 定义阶段流转规则、阶段进入/退出副作用
 */

import type { FlowHooks, PhaseExitResult } from '../../../engine/systems/FlowSystem';
import type { GameEvent, PlayerId } from '../../../engine/types';
import type { SummonerWarsCore, GamePhase } from './types';
import { SW_EVENTS, PHASE_ORDER } from './types';
import { getSummoner, HAND_SIZE, getUnitAbilities as getUnitAbilityIds } from './helpers';
import type { AbilityContext, AbilityTrigger } from './abilityResolver';
import { triggerAllUnitsAbilities, resolveAbilityEffects, triggerAbilities } from './abilityResolver';
import { abilityRegistry } from './abilities';
import { getUnitAbilities, getUnitAt } from './helpers';
import { getBaseCardId, CARD_IDS } from './ids';
import { canActivateAbility } from './abilityHelpers';
import { reduceEvent } from './reduce';
import {
  applyHuijinPhoenixSoulBonus,
  findBoardUnitByCardId,
  findBoardUnitByInstanceId,
  postProcessDeathChecks,
} from './execute/helpers';
import { getYonghengPostProcessEvents } from './yonghengMechanics';

/**
 * 需要玩家确认的阶段结束技能（"你可以"/"may" 语义）
 * 这些技能在 onPhaseExit 中只产生通知事件，需要玩家确认后通过 ACTIVATE_ABILITY 执行
 */
const CONFIRMABLE_PHASE_END_ABILITIES = new Set(['feed_beast', 'mogu_decay', 'mogu_parasite', 'huijin_call_guards']);
const PHASE_START_ABILITIES_REQUIRING_AVAILABILITY_CHECK = new Set(['ice_shards']);

/**
 * 检查当前玩家是否有可触发的、需要确认的阶段结束技能
 */
function hasConfirmablePhaseEndAbility(
  core: SummonerWarsCore,
  playerId: PlayerId,
  phase: GamePhase,
  resolvedMap?: Record<string, true>,
): boolean {
  const abilityIds = PHASE_END_ABILITIES[phase] ?? [];
  if (abilityIds.length === 0) return false;

  for (let row = 0; row < core.board.length; row++) {
    for (let col = 0; col < core.board[row].length; col++) {
      const unit = core.board[row]?.[col]?.unit;
      if (!unit || unit.owner !== playerId) continue;
      const unitAbilityList = getUnitAbilityIds(unit, core);
      for (const abilityId of abilityIds) {
        if (!CONFIRMABLE_PHASE_END_ABILITIES.has(abilityId)) continue;
        if (!unitAbilityList.includes(abilityId)) continue;
        const resolutionKey = `${core.turnNumber}:${phase}:${abilityId}:${unit.instanceId}`;
        if (resolvedMap?.[resolutionKey]) continue;
        if (canActivateAbility(core, unit, abilityId, playerId)) {
          return true;
        }
      }
    }
  }
  return false;
}

export const PHASE_START_ABILITIES: Record<GamePhase, string[]> = {
  factionSelect: [],
  summon: ['guidance'],
  move: ['illusion', 'huijin_wildfire'],
  build: [],
  attack: ['blood_rune', 'ice_shards'],
  magic: [],
  draw: [],
};

export const PHASE_END_ABILITIES: Record<GamePhase, string[]> = {
  factionSelect: [],
  summon: [],
  move: ['mogu_decay'],
  build: [],
  attack: ['feed_beast', 'mogu_parasite', 'huijin_call_guards'],
  magic: ['mogu_burst'],
  draw: [],
};

function appendDirectDestroyDeathTriggers(
  events: GameEvent[],
  core: SummonerWarsCore,
  timestamp: number,
): void {
  for (const destroyEvent of events.filter(e => e.type === SW_EVENTS.UNIT_DESTROYED)) {
    const destroyPayload = destroyEvent.payload as {
      position: { row: number; col: number };
      owner?: PlayerId;
      instanceId?: string;
      cardId?: string;
    };
    const destroyedUnit = findBoardUnitByInstanceId(core, destroyPayload.instanceId ?? '')
      ?? (destroyPayload.cardId ? findBoardUnitByCardId(core, destroyPayload.cardId, destroyPayload.owner) : undefined)
      ?? (() => {
        const unit = getUnitAt(core, destroyPayload.position);
        return unit ? { unit, position: destroyPayload.position } : undefined;
      })();
    if (!destroyedUnit) continue;
    if (!getUnitAbilities(destroyedUnit.unit, core).includes('mogu_fungal_mutation')) continue;
    const alreadySummoned = events.some(e => {
      if (e.type !== SW_EVENTS.UNIT_SUMMONED) return false;
      const p = e.payload as { position?: { row: number; col: number }; sourceAbilityId?: string };
      return p.sourceAbilityId === 'mogu_fungal_mutation'
        && p.position?.row === destroyedUnit.position.row
        && p.position?.col === destroyedUnit.position.col;
    });
    if (alreadySummoned) continue;
    events.push(...triggerAbilities('onDeath', {
      state: core,
      sourceUnit: destroyedUnit.unit,
      sourcePosition: destroyedUnit.position,
      ownerId: destroyedUnit.unit.owner,
      timestamp,
    }));
  }
}

function triggerPhaseAbilities(
  core: SummonerWarsCore,
  playerId: PlayerId,
  trigger: 'onPhaseStart' | 'onPhaseEnd',
  abilityIds: string[],
  timestamp: number
): GameEvent[] {
  if (abilityIds.length === 0) return [];
  const events: GameEvent[] = [];

  for (let row = 0; row < core.board.length; row++) {
    for (let col = 0; col < core.board[row].length; col++) {
      const unit = core.board[row]?.[col]?.unit;
      if (!unit || unit.owner !== playerId) continue;
      const unitAbilityIds = getUnitAbilities(unit, core);
      for (const abilityId of abilityIds) {
        if (!unitAbilityIds.includes(abilityId)) continue;
        // 阶段触发技能需在触发前做可用性门控（充能不足/条件不满足时不产生通知事件）
        const requiresAvailabilityCheck =
          (trigger === 'onPhaseEnd' && CONFIRMABLE_PHASE_END_ABILITIES.has(abilityId))
          || (trigger === 'onPhaseStart' && PHASE_START_ABILITIES_REQUIRING_AVAILABILITY_CHECK.has(abilityId));
        if (requiresAvailabilityCheck && !canActivateAbility(core, unit, abilityId, playerId)) continue;
        const def = abilityRegistry.get(abilityId);
        if (!def || def.trigger !== trigger) continue;
        events.push(...resolveAbilityEffects(def, {
          state: core,
          sourceUnit: unit,
          sourcePosition: { row, col },
          ownerId: playerId,
          timestamp,
        }));
      }
    }
  }

  return events;
}

/**
 * 逐个触发会直接改变共享状态的自动技能。
 *
 * 普通 triggerAllUnitsAbilities 会先基于同一份 core 快照收集所有事件；
 * 史米革「魔力成瘾」这类回合结束技能会消费共享魔力，必须让前一个单位
 * 的事件先进入临时 core，再判断下一个单位。
 */
function triggerSequentialUnitAbilities(
  trigger: AbilityTrigger,
  core: SummonerWarsCore,
  playerId: PlayerId,
  additionalCtx?: Partial<AbilityContext>,
): GameEvent[] {
  const events: GameEvent[] = [];
  let workingCore = core;
  const timestamp = typeof additionalCtx?.timestamp === 'number' ? additionalCtx.timestamp : 0;

  for (let row = 0; row < workingCore.board.length; row++) {
    for (let col = 0; col < workingCore.board[row].length; col++) {
      const unit = workingCore.board[row]?.[col]?.unit;
      if (!unit || unit.owner !== playerId) continue;

      const sourcePosition = { row, col };
      const sourceEvents = triggerAbilities(trigger, {
        state: workingCore,
        sourceUnit: unit,
        sourcePosition,
        ownerId: playerId,
        timestamp,
        ...additionalCtx,
      });

      for (const event of sourceEvents) {
        events.push(event);
        workingCore = reduceEvent(workingCore, event);
      }
    }
  }

  return events;
}

/** 游戏进行阶段顺序映射（不含 factionSelect） */
const PHASE_INDEX: Record<string, number> = {
  summon: 0,
  move: 1,
  build: 2,
  attack: 3,
  magic: 4,
  draw: 5,
};

/** 获取下一阶段 */
function getNextPhase(current: GamePhase): GamePhase {
  const index = PHASE_INDEX[current];
  const nextIndex = (index + 1) % PHASE_ORDER.length;
  return PHASE_ORDER[nextIndex];
}

/**
 * 召唤师战争 FlowHooks
 */
export const summonerWarsFlowHooks: FlowHooks<SummonerWarsCore> = {
  initialPhase: 'summon',

  /**
   * 是否允许推进阶段
   */
  canAdvance: () => {
    return { ok: true };
  },

  /**
   * 获取当前活跃玩家（用于 ADVANCE_PHASE 发送者校验）
   */
  getCurrentPlayerId: ({ state }) => {
    return state.core.currentPlayer;
  },

  /**
   * 计算下一阶段
   */
  getNextPhase: ({ state }) => {
    const currentPhase = state.core.phase;
    return getNextPhase(currentPhase);
  },

  /**
   * 离开阶段时的副作用
   */
  onPhaseExit: ({ state, from, command }): PhaseExitResult => {
    const events: GameEvent[] = [];
    const core = state.core;
    const playerId = core.currentPlayer;
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;

    // 攻击阶段结束：检查不活动惩罚
    if (from === 'attack') {
      const player = core.players[playerId];
      if (!player.hasAttackedEnemy) {
        const summoner = getSummoner(core, playerId);
        if (summoner) {
          events.push({
            type: SW_EVENTS.UNIT_DAMAGED,
            payload: { 
              position: summoner.position, 
              damage: 1, 
              reason: 'inaction' 
            },
            timestamp,
          });
        }
      }
    }

    // 抽牌阶段结束：自动抽牌 + 回合结束技能触发
    if (from === 'draw') {
      const player = core.players[playerId];
      const drawCount = Math.max(0, HAND_SIZE - player.hand.length);
      const actualDraw = Math.min(drawCount, player.deck.length);
      
      if (actualDraw > 0) {
        events.push({
          type: SW_EVENTS.CARD_DRAWN,
          payload: { playerId, count: actualDraw },
          timestamp,
        });
      }
      
      // 回合结束技能可能消费共享资源，需逐个应用后再判断下一个单位。
      events.push(...triggerSequentialUnitAbilities('onTurnEnd', core, playerId, { timestamp }));
    }

    // 阶段结束技能触发（按阶段筛选）
    // 强口径：当 flow 已经 halt 在当前 phaseEnd 技能上时，重复收到 ADVANCE_PHASE / sw:end_phase
    // 不能再次发射同一批 ABILITY_TRIGGERED 通知事件，否则会造成：
    // 1) useGameEvents / 本地 UI 反复重建同一交互；
    // 2) EventStream 即时音效（ABILITY_TRIGGERED）持续重复；
    // 3) AI watchdog 的“兜底推进”看起来像在不停重试同一个提示。
    // 此时只需重新判断“是否仍需确认”，不应重放通知事件。
    const phaseEndAbilities = PHASE_END_ABILITIES[from as GamePhase] ?? [];
    const alreadyFlowHalted = state.sys.flowHalted === true;
    if (phaseEndAbilities.length > 0 && !alreadyFlowHalted) {
      events.push(...triggerPhaseAbilities(core, playerId, 'onPhaseEnd', phaseEndAbilities, timestamp));
    }
    const processedPhaseExitEvents = postProcessDeathChecks(events, core);
    if (processedPhaseExitEvents.length !== events.length) {
      events.splice(0, events.length, ...processedPhaseExitEvents);
    }
    appendDirectDestroyDeathTriggers(events, core, timestamp);

    // 有需要玩家确认的阶段结束技能时，halt 阶段推进
    // 即使 flowHalted 已为 true，仍需检查是否还有技能需要确认
    // 只有当所有技能都确认/跳过后，才允许阶段推进
    const needsConfirmation = hasConfirmablePhaseEndAbility(
      core,
      playerId,
      from as GamePhase,
      state.sys.summonerWars?.phaseEndAbilityResolved,
    );
    events.push(...getYonghengPostProcessEvents(core, events, timestamp));
    if (needsConfirmation) {
      return { events, halt: true };
    }

    return { events };
  },

  /**
   * 进入阶段时的副作用
   */
  onPhaseEnter: ({ state, from, to, command }): GameEvent[] => {
    const events: GameEvent[] = [];
    const core = state.core;
    const playerId = core.currentPlayer;
    const nextPlayer = playerId === '0' ? '1' : '0';
    const phaseStartPlayer = from === 'draw' && to === 'summon' ? nextPlayer : playerId;
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;

    // 从抽牌阶段进入召唤阶段 = 新回合开始
    if (from === 'draw' && to === 'summon') {
      events.push({
        type: SW_EVENTS.TURN_CHANGED,
        payload: { from: playerId, to: nextPlayer },
        timestamp,
      });
      
      // 弃置即将开始新回合的玩家的所有主动事件
      // 规则："你的主动事件在你回合开始时弃置" = 施放该事件的玩家在自己下一回合开始时弃置
      // 此时 nextPlayer 即将开始新回合，所以弃置 nextPlayer 的主动事件
      // 殉葬火堆有充能时不自动弃置，等待玩家选择治疗目标（由 UI 触发 FUNERAL_PYRE_HEAL 命令）
      const newTurnPlayer = core.players[nextPlayer];
      for (const activeEvent of newTurnPlayer.activeEvents) {
        const cardBaseId = getBaseCardId(activeEvent.id);
        if (cardBaseId === CARD_IDS.NECRO_FUNERAL_PYRE && (activeEvent.charges ?? 0) > 0) {
          // 有充能的殉葬火堆：不自动弃置，交互系统驱动选择治疗目标/跳过
          events.push({
            type: SW_EVENTS.FUNERAL_PYRE_PROMPTED,
            payload: { playerId: nextPlayer, cardId: activeEvent.id, charges: activeEvent.charges ?? 0 },
            timestamp,
          });
          continue;
        }
        if (cardBaseId === CARD_IDS.PALADIN_HOLY_JUDGMENT && (activeEvent.charges ?? 0) > 0) {
          // 圣洁审判有充能时：消耗1充能代替弃置
          events.push({
            type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
            payload: { playerId: nextPlayer, eventCardId: activeEvent.id, charges: (activeEvent.charges ?? 0) - 1 },
            timestamp,
          });
          continue;
        }
        events.push({
          type: SW_EVENTS.ACTIVE_EVENT_DISCARDED,
          payload: { playerId: nextPlayer, cardId: activeEvent.id },
          timestamp,
        });
      }

      // 新回合开始技能
      events.push(...triggerAllUnitsAbilities('onTurnStart', core, nextPlayer, { timestamp }));
    }

    // 阶段开始技能触发（按阶段筛选）
    const phaseStartAbilities = PHASE_START_ABILITIES[to as GamePhase] ?? [];
    if (phaseStartAbilities.length > 0) {
      const phaseStartCore = { ...core, phase: to as GamePhase };
      events.push(...triggerPhaseAbilities(phaseStartCore, phaseStartPlayer, 'onPhaseStart', phaseStartAbilities, timestamp));
    }

    applyHuijinPhoenixSoulBonus(events, core, timestamp);
    events.push(...getYonghengPostProcessEvents(core, events, timestamp));
    return events;
  },

  /**
   * 获取当前活跃玩家
   */
  getActivePlayerId: ({ state }): PlayerId => {
    return state.core.currentPlayer;
  },

  /**
   * 阶段结束技能确认/跳过后自动推进
   * 当 flowHalted（阶段结束技能等待确认）且不再有需要确认的技能时，自动推进
   */
  onAutoContinueCheck: ({ state }) => {
    if (!state.sys.flowHalted) return;
    const core = state.core;
    const phase = core.phase;
    const playerId = core.currentPlayer;
    // 仍有需要确认的技能 → 不自动推进
    if (hasConfirmablePhaseEndAbility(core, playerId, phase, state.sys.summonerWars?.phaseEndAbilityResolved)) return;
    return { autoContinue: true, playerId };
  },
};

export default summonerWarsFlowHooks;
