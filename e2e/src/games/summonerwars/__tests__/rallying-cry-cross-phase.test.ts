/**
 * 群情激愤 - 跨阶段攻击测试
 * 验证群情激愤事件卡可以让友方单位在魔力阶段攻击
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner, type TestCase } from '../../../engine/testing/GameTestRunner';
import { SummonerWarsDomain } from '../domain';
import type { SummonerWarsCore, SummonerWarsCommand, SummonerWarsEvent } from '../domain/types';
import { SW_COMMANDS } from '../domain/types';
import { CARD_IDS } from '../domain/ids';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';

// ============================================================================
// 测试运行器配置
// ============================================================================

const runner = new GameTestRunner<SummonerWarsCore, SummonerWarsCommand, SummonerWarsEvent>({
  domain: SummonerWarsDomain,
  playerIds: ['0', '1'],
  systems: [],
  random: {
    random: () => 0.9, // High roll for damage
    d: (max) => max, // Always roll max
    range: (min, max) => max, // Always max
    shuffle: (arr) => [...arr],
  },
});

// ============================================================================
// 辅助函数：创建测试状态
// ============================================================================

function createRallyingCryTestState(hasRallyingCry: boolean, isActive: boolean = true): MatchState<SummonerWarsCore> {
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
        activeEvents: hasRallyingCry ? [
          {
            id: CARD_IDS.BARBARIC_RALLYING_CRY,
            cardType: 'event',
            name: '群情激愤',
            faction: 'barbaric',
            cost: 1,
            playPhase: 'magic',
            effect: '允许在魔力阶段攻击',
            isActive,
            deckSymbols: [],
          },
        ] : [],
        moveCount: 0,
        attackCount: 0,
      },
      '1': {
        hand: [],
        deck: [],
        discard: [],
        magic: 5,
        activeEvents: [],
        moveCount: 0,
        attackCount: 0,
      },
    },
    phase: 'magic', // 魔力阶段
    currentPlayer: '0',
    turnNumber: 1,
  };

  // 放置友方单位
  core.board[3][3] = {
    unit: {
      instanceId: 'soldier-1',
      cardId: 'barbaric-soldier',
      owner: '0',
      position: { row: 3, col: 3 },
      damage: 0,
      hasMoved: false,
      hasAttacked: false,
      card: {
        id: 'barbaric-soldier',
        cardType: 'unit',
        name: '野蛮人士兵',
        unitClass: 'common',
        faction: 'barbaric',
        cost: 1,
        life: 3,
        strength: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: [],
        deckSymbols: [],
      },
    },
    structure: undefined,
  };

  // 放置敌方单位
  core.board[3][4] = {
    unit: {
      instanceId: 'enemy-1',
      cardId: 'enemy-soldier',
      owner: '1',
      position: { row: 3, col: 4 },
      damage: 0,
      hasMoved: false,
      hasAttacked: false,
      card: {
        id: 'enemy-soldier',
        cardType: 'unit',
        name: '敌方士兵',
        unitClass: 'common',
        faction: 'paladin',
        cost: 1,
        life: 3,
        strength: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: [],
        deckSymbols: [],
      },
    },
    structure: undefined,
  };

  const sys = createInitialSystemState(['0', '1'], []);
  return { core, sys };
}

// ============================================================================
// 测试用例
// ============================================================================

describe('群情激愤 - 跨阶段攻击', () => {
  it('魔力阶段没有群情激愤时不能攻击', () => {
    const testCase: TestCase = {
      name: '魔力阶段没有群情激愤时不能攻击',
      setup: () => createRallyingCryTestState(false),
      commands: [
        {
          type: SW_COMMANDS.DECLARE_ATTACK,
          playerId: '0',
          payload: {
            attacker: { row: 3, col: 3 },
            target: { row: 3, col: 4 },
          },
        },
      ],
      expect: {
        expectError: {
          command: SW_COMMANDS.DECLARE_ATTACK,
          error: '当前不是攻击阶段',
        },
      },
    };

    const result = runner.run(testCase);
    expect(result.passed).toBe(true);
  });

  it('魔力阶段有群情激愤时可以攻击', () => {
    const testCase: TestCase = {
      name: '魔力阶段有群情激愤时可以攻击',
      setup: () => createRallyingCryTestState(true),
      commands: [
        {
          type: SW_COMMANDS.DECLARE_ATTACK,
          playerId: '0',
          payload: {
            attacker: { row: 3, col: 3 },
            target: { row: 3, col: 4 },
          },
        },
      ],
    };

    const result = runner.run(testCase);
    
    // 验证命令执行成功（验证通过）
    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
  });

  it('群情激愤失效后不能跨阶段攻击', () => {
    const testCase: TestCase = {
      name: '群情激愤失效后不能跨阶段攻击',
      setup: () => createRallyingCryTestState(true, false), // isActive = false
      commands: [
        {
          type: SW_COMMANDS.DECLARE_ATTACK,
          playerId: '0',
          payload: {
            attacker: { row: 3, col: 3 },
            target: { row: 3, col: 4 },
          },
        },
      ],
      expect: {
        expectError: {
          command: SW_COMMANDS.DECLARE_ATTACK,
          error: '当前不是攻击阶段',
        },
      },
    };

    const result = runner.run(testCase);
    expect(result.passed).toBe(true);
  });

  it('攻击阶段不需要群情激愤也能攻击', () => {
    const testCase: TestCase = {
      name: '攻击阶段不需要群情激愤也能攻击',
      setup: () => {
        const state = createRallyingCryTestState(false);
        state.core.phase = 'attack'; // 改为攻击阶段
        return state;
      },
      commands: [
        {
          type: SW_COMMANDS.DECLARE_ATTACK,
          playerId: '0',
          payload: {
            attacker: { row: 3, col: 3 },
            target: { row: 3, col: 4 },
          },
        },
      ],
    };

    const result = runner.run(testCase);
    
    // 验证命令执行成功
    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
  });
});
