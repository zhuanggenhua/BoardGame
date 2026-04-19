/**
 * 召唤师战争 - 群情激愤事件卡测试
 * 
 * 测试场景：
 * 1. 打出群情激愤后所有0费单位获得额外攻击
 * 2. 群情激愤只影响0费单位，不影响1费及以上单位
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner, type TestCase } from '../../../engine/testing/GameTestRunner';
import { SummonerWarsDomain } from '../domain';
import type { SummonerWarsCore } from '../domain/types';
import { SW_COMMANDS } from '../domain/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';

// ============================================================================
// 测试运行器配置
// ============================================================================

const runner = new GameTestRunner({
  domain: SummonerWarsDomain,
  playerIds: ['0', '1'],
  systems: [],
});

// ============================================================================
// 辅助函数：创建测试状态
// ============================================================================

function createGoblinFrenzyTestState(): MatchState<SummonerWarsCore> {
  const core: SummonerWarsCore = {
    board: Array(8).fill(null).map(() => 
      Array(8).fill(null).map(() => ({ unit: undefined, structure: undefined }))
    ),
    players: {
      '0': {
        id: '0',
        hand: [],
        deck: [],
        discard: [],
        magic: 5,
        activeEvents: [],
        moveCount: 0,
        attackCount: 0,
        summonerId: 'goblin-summoner',
        hasAttackedEnemy: false,
      },
      '1': {
        id: '1',
        hand: [],
        deck: [],
        discard: [],
        magic: 5,
        activeEvents: [],
        moveCount: 0,
        attackCount: 0,
        summonerId: 'necromancer-summoner',
        hasAttackedEnemy: false,
      },
    },
    phase: 'magic',
    currentPlayer: '0',
    turnNumber: 1,
  };

  // 放置玩家0的0费单位（地精步兵）
  core.board[3][3] = {
    unit: {
      instanceId: 'goblin-1',
      cardId: 'goblin-grunt',
      owner: '0',
      position: { row: 3, col: 3 },
      damage: 0,
      hasMoved: false,
      hasAttacked: false,
      boosts: [],
      card: {
        id: 'goblin-grunt',
        cardType: 'unit',
        name: '地精步兵',
        unitClass: 'common',
        faction: 'goblin',
        cost: 0,
        life: 1,
        strength: 1,
        attackType: 'melee',
        attackRange: 1,
        abilities: [],
        deckSymbols: [],
      },
    },
    structure: undefined,
  };

  // 放置另一个0费单位
  core.board[3][4] = {
    unit: {
      instanceId: 'goblin-2',
      cardId: 'goblin-grunt',
      owner: '0',
      position: { row: 3, col: 4 },
      damage: 0,
      hasMoved: false,
      hasAttacked: false,
      boosts: [],
      card: {
        id: 'goblin-grunt',
        cardType: 'unit',
        name: '地精步兵',
        unitClass: 'common',
        faction: 'goblin',
        cost: 0,
        life: 1,
        strength: 1,
        attackType: 'melee',
        attackRange: 1,
        abilities: [],
        deckSymbols: [],
      },
    },
    structure: undefined,
  };

  // 添加群情激愤事件卡到手牌
  core.players['0'].hand = [
    {
      id: 'goblin-frenzy-0-1',
      cardType: 'event',
      name: '群情激愤',
      faction: 'goblin',
      eventType: 'legendary',
      cost: 1,
      playPhase: 'magic',
      effect: '所有0费友方单位获得额外攻击',
      deckSymbols: [],
    },
  ];

  const sys = createInitialSystemState(['0', '1'], []);
  return { core, sys };
}

function createMixedCostTestState(): MatchState<SummonerWarsCore> {
  const core: SummonerWarsCore = {
    board: Array(8).fill(null).map(() => 
      Array(8).fill(null).map(() => ({ unit: undefined, structure: undefined }))
    ),
    players: {
      '0': {
        id: '0',
        hand: [],
        deck: [],
        discard: [],
        magic: 5,
        activeEvents: [],
        moveCount: 0,
        attackCount: 0,
        summonerId: 'goblin-summoner',
        hasAttackedEnemy: false,
      },
      '1': {
        id: '1',
        hand: [],
        deck: [],
        discard: [],
        magic: 5,
        activeEvents: [],
        moveCount: 0,
        attackCount: 0,
        summonerId: 'necromancer-summoner',
        hasAttackedEnemy: false,
      },
    },
    phase: 'magic',
    currentPlayer: '0',
    turnNumber: 1,
  };

  // 0费单位
  core.board[3][3] = {
    unit: {
      instanceId: 'goblin-1',
      cardId: 'goblin-grunt',
      owner: '0',
      position: { row: 3, col: 3 },
      damage: 0,
      hasMoved: false,
      hasAttacked: false,
      boosts: [],
      card: {
        id: 'goblin-grunt',
        cardType: 'unit',
        name: '地精步兵',
        unitClass: 'common',
        faction: 'goblin',
        cost: 0,
        life: 1,
        strength: 1,
        attackType: 'melee',
        attackRange: 1,
        abilities: [],
        deckSymbols: [],
      },
    },
    structure: undefined,
  };

  // 1费单位
  core.board[3][4] = {
    unit: {
      instanceId: 'goblin-archer',
      cardId: 'goblin-archer',
      owner: '0',
      position: { row: 3, col: 4 },
      damage: 0,
      hasMoved: false,
      hasAttacked: false,
      boosts: [],
      card: {
        id: 'goblin-archer',
        cardType: 'unit',
        name: '地精弓箭手',
        unitClass: 'common',
        faction: 'goblin',
        cost: 1,
        life: 2,
        strength: 2,
        attackType: 'ranged',
        attackRange: 2,
        abilities: [],
        deckSymbols: [],
      },
    },
    structure: undefined,
  };

  core.players['0'].hand = [
    {
      id: 'goblin-frenzy-0-1',
      cardType: 'event',
      name: '群情激愤',
      faction: 'goblin',
      eventType: 'legendary',
      cost: 1,
      playPhase: 'magic',
      effect: '所有0费友方单位获得额外攻击',
      deckSymbols: [],
    },
  ];

  const sys = createInitialSystemState(['0', '1'], []);
  return { core, sys };
}

// ============================================================================
// 测试用例
// ============================================================================

describe('群情激愤事件卡', () => {
  it('打出群情激愤后所有0费单位获得额外攻击', () => {
    const testCase: TestCase = {
      name: '群情激愤 - 0费单位获得额外攻击',
      setup: createGoblinFrenzyTestState,
      commands: [
        {
          type: SW_COMMANDS.PLAY_EVENT,
          playerId: '0',
          payload: { cardId: 'goblin-frenzy-0-1' },
        },
      ],
    };

    const result = runner.run(testCase);
    
    // 验证命令执行成功
    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
    
    // 验证单位获得额外攻击
    const state = result.finalState;
    expect(state.core.board[3][3].unit?.extraAttacks).toBe(1);
    expect(state.core.board[3][4].unit?.extraAttacks).toBe(1);
    
    // 验证事件卡从手牌移除
    expect(state.core.players['0'].hand.length).toBe(0);
    
    // 验证魔力消耗
    expect(state.core.players['0'].magic).toBe(4);
  });
  
  it('群情激愤只影响0费单位', () => {
    const testCase: TestCase = {
      name: '群情激愤 - 只影响0费单位',
      setup: createMixedCostTestState,
      commands: [
        {
          type: SW_COMMANDS.PLAY_EVENT,
          playerId: '0',
          payload: { cardId: 'goblin-frenzy-0-1' },
        },
      ],
    };

    const result = runner.run(testCase);
    
    // 验证命令执行成功
    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
    
    // 验证：只有0费单位获得额外攻击
    const state = result.finalState;
    expect(state.core.board[3][3].unit?.extraAttacks).toBe(1); // 0费单位
    expect(state.core.board[3][4].unit?.extraAttacks).toBeUndefined(); // 1费单位
  });

  it('群情激愤后可在魔力阶段发起攻击（跨阶段攻击）', () => {
    // 创建状态：0费单位有 extraAttacks，相邻有敌方单位
    const state = createGoblinFrenzyTestState();
    // 放置敌方单位在 (2,3)，与 (3,3) 的地精步兵相邻
    state.core.board[2][3] = {
      unit: {
        instanceId: 'enemy-1',
        cardId: 'enemy-unit',
        owner: '1',
        position: { row: 2, col: 3 },
        damage: 0,
        hasMoved: false,
        hasAttacked: false,
        boosts: [],
        card: {
          id: 'enemy-unit',
          cardType: 'unit',
          name: '敌方单位',
          unitClass: 'common',
          faction: 'goblin',
          cost: 0,
          life: 3,
          strength: 1,
          attackType: 'melee',
          attackRange: 1,
          abilities: [],
          deckSymbols: [],
        },
      },
      structure: undefined,
    };

    const testCase: TestCase = {
      name: '群情激愤 - 魔力阶段跨阶段攻击',
      setup: () => state,
      commands: [
        // 先打出群情激愤
        {
          type: SW_COMMANDS.PLAY_EVENT,
          playerId: '0',
          payload: { cardId: 'goblin-frenzy-0-1' },
        },
        // 然后在魔力阶段发起攻击（跨阶段）
        {
          type: SW_COMMANDS.DECLARE_ATTACK,
          playerId: '0',
          payload: {
            attacker: { row: 3, col: 3 },
            target: { row: 2, col: 3 },
          },
        },
      ],
    };

    const result = runner.run(testCase);
    
    // 验证两个命令都执行成功
    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
    expect(result.steps[1].success).toBe(true);
    
    // 验证攻击后 extraAttacks 递减
    const finalState = result.finalState;
    const attackerUnit = finalState.core.board[3][3].unit;
    expect(attackerUnit?.hasAttacked).toBe(true);
    expect(attackerUnit?.extraAttacks).toBe(0);
    
    // 验证敌方单位受到伤害
    const enemyUnit = finalState.core.board[2][3].unit;
    expect(enemyUnit?.damage).toBeGreaterThan(0);
  });
});
