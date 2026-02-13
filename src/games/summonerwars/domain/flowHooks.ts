/**
 * 召唤师战争 - FlowSystem 钩子配置
 * 
 * 定义阶段流转规则、阶段进入/退出副作用
 */

import type { FlowHooks, PhaseExitResult } from '../../../engine/systems/FlowSystem';
import type { GameEvent, PlayerId } from '../../../engine/types';
import type { SummonerWarsCore, GamePhase } from './types';
import { SW_EVENTS, PHASE_ORDER } from './types';
import { getSummoner, HAND_SIZE } from './helpers';
import { triggerAllUnitsAbilities, resolveAbilityEffects } from './abilityResolver';
import { abilityRegistry } from './abilities';
import { getUnitAbilities } from './helpers';
import { getBaseCardId, CARD_IDS } from './ids';

export const PHASE_START_ABILITIES: Record<GamePhase, string[]> = {
  factionSelect: [],
  summon: ['guidance'],
  move: ['illusion'],
  build: [],
  attack: ['blood_rune'],
  magic: [],
  draw: [],
};

export const PHASE_END_ABILITIES: Record<GamePhase, string[]> = {
  factionSelect: [],
  summon: [],
  move: [],
  build: ['ice_shards'],
  attack: ['feed_beast'],
  magic: [],
  draw: [],
};

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
    // 基本检查通过（游戏结束由 boardgame.io 层处理）
    return { ok: true };
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
      
      // 触发回合结束技能（如血腥狂怒衰减）
      events.push(...triggerAllUnitsAbilities('onTurnEnd', core, playerId, { timestamp }));
    }

    // 阶段结束技能触发（按阶段筛选）
    const phaseEndAbilities = PHASE_END_ABILITIES[from as GamePhase] ?? [];
    if (phaseEndAbilities.length > 0) {
      events.push(...triggerPhaseAbilities(core, playerId, 'onPhaseEnd', phaseEndAbilities, timestamp));
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
      
      // 弃置当前玩家的所有主动事件
      // 殉葬火堆有充能时不自动弃置，等待玩家选择治疗目标（由 UI 触发 FUNERAL_PYRE_HEAL 命令）
      const currentPlayer = core.players[playerId];
      for (const activeEvent of currentPlayer.activeEvents) {
        const cardBaseId = getBaseCardId(activeEvent.id);
        if (cardBaseId === CARD_IDS.NECRO_FUNERAL_PYRE && (activeEvent.charges ?? 0) > 0) {
          // 有充能的殉葬火堆：不自动弃置，由 UI 处理
          continue;
        }
        if (cardBaseId === CARD_IDS.PALADIN_HOLY_JUDGMENT && (activeEvent.charges ?? 0) > 0) {
          // 圣洁审判有充能时：消耗1充能代替弃置
          events.push({
            type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
            payload: { playerId, eventCardId: activeEvent.id, charges: (activeEvent.charges ?? 0) - 1 },
            timestamp,
          });
          continue;
        }
        events.push({
          type: SW_EVENTS.ACTIVE_EVENT_DISCARDED,
          payload: { playerId, cardId: activeEvent.id },
          timestamp,
        });
      }

      // 新回合开始技能
      events.push(...triggerAllUnitsAbilities('onTurnStart', core, nextPlayer, { timestamp }));
    }

    // 阶段开始技能触发（按阶段筛选）
    const phaseStartAbilities = PHASE_START_ABILITIES[to as GamePhase] ?? [];
    if (phaseStartAbilities.length > 0) {
      events.push(...triggerPhaseAbilities(core, phaseStartPlayer, 'onPhaseStart', phaseStartAbilities, timestamp));
    }

    return events;
  },

  /**
   * 获取当前活跃玩家
   */
  getActivePlayerId: ({ state }): PlayerId => {
    return state.core.currentPlayer;
  },
};

export default summonerWarsFlowHooks;
