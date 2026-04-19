/**
 * 主动事件跨回合持续生效测试
 * 验证主动事件在施放后持续生效，直到施放者的下一回合开始时才弃置
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner, type TestCase } from '../../../engine/testing/GameTestRunner';
import { SummonerWarsDomain } from '../domain';
import type { SummonerWarsCore, SummonerWarsCommand, SummonerWarsEvent } from '../domain/types';
import { SW_COMMANDS, SW_EVENTS } from '../domain/types';
import { CARD_IDS } from '../domain/ids';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';
import type { EventCard } from '../domain/types';

// ============================================================================
// 测试运行器配置
// ============================================================================

const runner = new GameTestRunner<SummonerWarsCore, SummonerWarsCommand, SummonerWarsEvent>({
  domain: SummonerWarsDomain,
  playerIds: ['0', '1'],
  systems: [],
  random: {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.ceil((min + max) / 2),
    shuffle: (arr) => [...arr],
  },
});

// ============================================================================
// 辅助函数
// ============================================================================

function createTestState(): MatchState<SummonerWarsCore> {
  const core: SummonerWarsCore = {
    board: Array(8).fill(null).map(() => 
      Array(8).fill(null).map(() => ({ unit: undefined, structure: undefined }))
    ),
    players: {
      '0': {
        hand: [],
        deck: [],
        discard: [],
        magic: 5,
        activeEvents: [],
        moveCount: 0,
        attackCount: 0,
        hasAttackedEnemy: false,
      },
      '1': {
        hand: [],
        deck: [],
        discard: [],
        magic: 5,
        activeEvents: [],
        moveCount: 0,
        attackCount: 0,
        hasAttackedEnemy: false,
      },
    },
    phase: 'summon',
    currentPlayer: '0',
    turnNumber: 1,
  };

  const sys = createInitialSystemState(['0', '1'], []);
  return { core, sys };
}

// ============================================================================
// 测试用例
// ============================================================================

describe('主动事件跨回合持续生效', () => {
  it('玩家 0 施放主动事件 → 玩家 1 回合（事件仍生效）→ 玩家 0 回合开始（事件被弃置）', () => {
    const testCase: TestCase = {
      name: '主动事件跨回合持续生效测试',
      setup: () => {
        const state = createTestState();
        // 玩家 0 施放群情激愤（主动事件）
        const rallyingCry: EventCard = {
          id: CARD_IDS.BARBARIC_RALLYING_CRY,
          cardType: 'event',
          name: '群情激愤',
          faction: 'barbaric',
          cost: 1,
          playPhase: 'magic',
          effect: '允许在魔力阶段攻击',
          isActive: true,
          deckSymbols: [],
        };
        state.core.players['0'].activeEvents.push(rallyingCry);
        state.core.phase = 'draw'; // 玩家 0 的抽牌阶段（即将结束回合）
        return state;
      },
      commands: [
        // 1. 玩家 0 推进阶段（从 draw 进入 summon，触发回合切换）
        {
          type: SW_COMMANDS.ADVANCE_PHASE,
          playerId: '0',
          payload: {},
        },
      ],
      expect: {
        // 验证玩家 0 的主动事件仍然存在（因为现在是玩家 1 的回合开始）
        finalState: (state) => {
          // 玩家 1 的回合开始了
          expect(state.core.currentPlayer).toBe('1');
          expect(state.core.phase).toBe('summon');
          
          // 玩家 0 的主动事件应该仍然存在（还没到玩家 0 的下一回合）
          expect(state.core.players['0'].activeEvents.length).toBe(1);
          expect(state.core.players['0'].activeEvents[0].id).toBe(CARD_IDS.BARBARIC_RALLYING_CRY);
          
          // 玩家 1 没有主动事件
          expect(state.core.players['1'].activeEvents.length).toBe(0);
        },
      },
    };

    const result = runner.run(testCase);
    expect(result.passed).toBe(true);
  });

  it('玩家 0 施放主动事件 → 完整一轮后回到玩家 0 回合开始 → 事件被弃置', () => {
    const testCase: TestCase = {
      name: '主动事件在施放者下一回合开始时弃置',
      setup: () => {
        const state = createTestState();
        // 玩家 0 施放群情激愤
        const rallyingCry: EventCard = {
          id: CARD_IDS.BARBARIC_RALLYING_CRY,
          cardType: 'event',
          name: '群情激愤',
          faction: 'barbaric',
          cost: 1,
          playPhase: 'magic',
          effect: '允许在魔力阶段攻击',
          isActive: true,
          deckSymbols: [],
        };
        state.core.players['0'].activeEvents.push(rallyingCry);
        state.core.phase = 'draw'; // 玩家 0 的抽牌阶段
        return state;
      },
      commands: [
        // 1. 玩家 0 结束回合（draw → summon，切换到玩家 1）
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
        // 2. 玩家 1 推进所有阶段直到回合结束
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: {} }, // summon → move
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: {} }, // move → build
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: {} }, // build → attack
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: {} }, // attack → magic
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: {} }, // magic → draw
        // 3. 玩家 1 结束回合（draw → summon，切换回玩家 0）
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: {} },
      ],
      expect: {
        finalState: (state) => {
          // 回到玩家 0 的回合
          expect(state.core.currentPlayer).toBe('0');
          expect(state.core.phase).toBe('summon');
          
          // 玩家 0 的主动事件应该已经被弃置
          expect(state.core.players['0'].activeEvents.length).toBe(0);
          
          // 事件应该在弃牌堆中
          expect(state.core.players['0'].discard.length).toBe(1);
          expect(state.core.players['0'].discard[0].id).toBe(CARD_IDS.BARBARIC_RALLYING_CRY);
        },
        // 验证产生了 ACTIVE_EVENT_DISCARDED 事件
        events: (events) => {
          const discardEvents = events.filter(e => e.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED);
          expect(discardEvents.length).toBe(1);
          expect(discardEvents[0].payload).toMatchObject({
            playerId: '0',
            cardId: CARD_IDS.BARBARIC_RALLYING_CRY,
          });
        },
      },
    };

    const result = runner.run(testCase);
    expect(result.passed).toBe(true);
  });

  it('玩家 1 施放主动事件 → 玩家 0 回合（事件仍生效）→ 玩家 1 回合开始（事件被弃置）', () => {
    const testCase: TestCase = {
      name: '玩家 1 的主动事件在玩家 1 下一回合开始时弃置',
      setup: () => {
        const state = createTestState();
        state.core.currentPlayer = '1';
        state.core.phase = 'draw';
        // 玩家 1 施放主动事件
        const rallyingCry: EventCard = {
          id: CARD_IDS.BARBARIC_RALLYING_CRY,
          cardType: 'event',
          name: '群情激愤',
          faction: 'barbaric',
          cost: 1,
          playPhase: 'magic',
          effect: '允许在魔力阶段攻击',
          isActive: true,
          deckSymbols: [],
        };
        state.core.players['1'].activeEvents.push(rallyingCry);
        return state;
      },
      commands: [
        // 1. 玩家 1 结束回合
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: {} },
        // 2. 玩家 0 推进所有阶段
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
        // 3. 玩家 0 结束回合，切换回玩家 1
        { type: SW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} },
      ],
      expect: {
        finalState: (state) => {
          // 回到玩家 1 的回合
          expect(state.core.currentPlayer).toBe('1');
          expect(state.core.phase).toBe('summon');
          
          // 玩家 1 的主动事件应该已经被弃置
          expect(state.core.players['1'].activeEvents.length).toBe(0);
          expect(state.core.players['1'].discard.length).toBe(1);
        },
        events: (events) => {
          const discardEvents = events.filter(e => e.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED);
          expect(discardEvents.length).toBe(1);
          expect(discardEvents[0].payload).toMatchObject({
            playerId: '1',
            cardId: CARD_IDS.BARBARIC_RALLYING_CRY,
          });
        },
      },
    };

    const result = runner.run(testCase);
    expect(result.passed).toBe(true);
  });
});
