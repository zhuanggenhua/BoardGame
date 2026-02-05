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
import { triggerAllUnitsAbilities } from './abilityResolver';

/** 阶段顺序映射 */
const PHASE_INDEX: Record<GamePhase, number> = {
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
  onPhaseExit: ({ state, from }): PhaseExitResult => {
    const events: GameEvent[] = [];
    const core = state.core;
    const playerId = core.currentPlayer;

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
            timestamp: Date.now(),
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
          timestamp: Date.now(),
        });
      }
      
      // 触发回合结束技能（如血腥狂怒衰减）
      events.push(...triggerAllUnitsAbilities('onTurnEnd', core, playerId));
    }

    return { events };
  },

  /**
   * 进入阶段时的副作用
   */
  onPhaseEnter: ({ state, from, to }): GameEvent[] => {
    const events: GameEvent[] = [];
    const core = state.core;
    const playerId = core.currentPlayer;

    // 从抽牌阶段进入召唤阶段 = 新回合开始
    if (from === 'draw' && to === 'summon') {
      const nextPlayer = playerId === '0' ? '1' : '0';
      events.push({
        type: SW_EVENTS.TURN_CHANGED,
        payload: { from: playerId, to: nextPlayer },
        timestamp: Date.now(),
      });
      
      // 弃置当前玩家的所有主动事件
      const currentPlayer = core.players[playerId];
      for (const activeEvent of currentPlayer.activeEvents) {
        events.push({
          type: SW_EVENTS.ACTIVE_EVENT_DISCARDED,
          payload: { playerId, cardId: activeEvent.id },
          timestamp: Date.now(),
        });
      }
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
