/**
 * 友方治疗目标测试
 * 验证普通攻击不能攻击友方卡牌；牧师治疗技能会把友方目标改为治疗
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner, type TestCase } from '../../../engine/testing/GameTestRunner';
import { SummonerWarsDomain } from '../domain';
import type { SummonerWarsCore, SummonerWarsCommand, SummonerWarsEvent } from '../domain/types';
import { SW_COMMANDS } from '../domain/types';
import { canAttack, canAttackEnhanced } from '../domain/helpers';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';

// ============================================================================
// 测试运行器配置
// ============================================================================

const runner = new GameTestRunner<SummonerWarsCore, SummonerWarsCommand, SummonerWarsEvent>({
  domain: SummonerWarsDomain,
  playerIds: ['0', '1'],
  systems: [],
});

// ============================================================================
// 辅助函数：创建测试状态
// ============================================================================

function createHealingTestState(): MatchState<SummonerWarsCore> {
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
    phase: 'attack',
    currentPlayer: '0',
    turnNumber: 1,
  };

  // 放置牧师（healing 技能）
  core.board[3][3] = {
    unit: {
      instanceId: 'priest-1',
      cardId: 'paladin-priest',
      owner: '0',
      position: { row: 3, col: 3 },
      damage: 0,
      hasMoved: false,
      hasAttacked: false,
      card: {
        id: 'paladin-priest',
        cardType: 'unit',
        name: '圣殿牧师',
        unitClass: 'common',
        faction: 'paladin',
        cost: 2,
        life: 3,
        strength: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['healing'],
        deckSymbols: [],
      },
    },
    structure: undefined,
  };

  // 放置友方受伤士兵
  core.board[3][4] = {
    unit: {
      instanceId: 'soldier-1',
      cardId: 'paladin-soldier',
      owner: '0',
      position: { row: 3, col: 4 },
      damage: 2, // 受伤
      hasMoved: false,
      hasAttacked: false,
      card: {
        id: 'paladin-soldier',
        cardType: 'unit',
        name: '圣殿士兵',
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

describe('治疗技能 - 友军攻击', () => {
  it('canAttackEnhanced 应该允许治疗模式攻击友军', () => {
    const state = createHealingTestState();
    state.core.board[3][3].unit!.healingMode = true;

    // 验证 canAttackEnhanced 允许治疗目标
    const canAttack = canAttackEnhanced(state.core, { row: 3, col: 3 }, { row: 3, col: 4 });
    expect(canAttack).toBe(true);
  });

  it('治疗模式只能攻击相邻的友方士兵/英雄', () => {
    const state = createHealingTestState();
    state.core.board[3][3].unit!.healingMode = true;
    
    // 放置友方士兵（不相邻）
    state.core.board[3][5] = {
      unit: {
        instanceId: 'soldier-2',
        cardId: 'paladin-soldier',
        owner: '0',
        position: { row: 3, col: 5 },
        damage: 2,
        hasMoved: false,
        hasAttacked: false,
        card: {
          id: 'paladin-soldier',
          cardType: 'unit',
          name: '圣殿士兵',
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
    
    // 放置友方建筑（相邻）
    state.core.board[4][3] = {
      unit: undefined,
      structure: {
        instanceId: 'wall-1',
        cardId: 'paladin-wall',
        owner: '0',
        position: { row: 4, col: 3 },
        damage: 0,
        card: {
          id: 'paladin-wall',
          cardType: 'structure',
          name: '城墙',
          faction: 'paladin',
          cost: 2,
          life: 5,
          abilities: [],
          deckSymbols: [],
        },
      },
    };
    
    // ✅ 相邻士兵可以作为治疗目标
    expect(canAttackEnhanced(state.core, { row: 3, col: 3 }, { row: 3, col: 4 })).toBe(true);
    
    // ❌ 不相邻士兵不能作为治疗目标
    expect(canAttackEnhanced(state.core, { row: 3, col: 3 }, { row: 3, col: 5 })).toBe(false);
    
    // ❌ 建筑不能作为治疗目标
    expect(canAttackEnhanced(state.core, { row: 3, col: 3 }, { row: 4, col: 3 })).toBe(false);
  });

  it('普通攻击不能攻击满足距离的友方卡牌', () => {
    const state = createHealingTestState();
    
    // 替换为普通士兵（无 healing 技能）
    state.core.board[3][3] = {
      unit: {
        instanceId: 'soldier-1',
        cardId: 'paladin-soldier',
        owner: '0',
        position: { row: 3, col: 3 },
        damage: 0,
        hasMoved: false,
        hasAttacked: false,
        card: {
          id: 'paladin-soldier',
          cardType: 'unit',
          name: '圣殿士兵',
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
    
    // 放置另一个友方士兵
    state.core.board[3][4] = {
      unit: {
        instanceId: 'soldier-2',
        cardId: 'paladin-soldier',
        owner: '0',
        position: { row: 3, col: 4 },
        damage: 0,
        hasMoved: false,
        hasAttacked: false,
        card: {
          id: 'paladin-soldier',
          cardType: 'unit',
          name: '圣殿士兵',
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
    
    expect(canAttack(state.core, { row: 3, col: 3 }, { row: 3, col: 4 })).toBe(false);
    expect(canAttackEnhanced(state.core, { row: 3, col: 3 }, { row: 3, col: 4 })).toBe(false);

    const magicBefore = state.core.players['0'].magic;
    const result = runner.run({
      name: '普通攻击拒绝友方卡牌',
      setup: () => state,
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
    });

    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(false);
    expect(result.steps[0].error).toBe('无法攻击该目标');
    expect(result.finalState.core.players['0'].hasAttackedEnemy).not.toBe(true);
    expect(result.finalState.core.players['0'].attackCount).toBe(0);
    expect(result.finalState.core.players['0'].magic).toBe(magicBefore);
  });

  it('治疗攻击命令验证应该通过', () => {
    const testCase: TestCase = {
      name: '治疗攻击命令',
      setup: () => {
        const state = createHealingTestState();
        // 添加手牌用于弃牌
        state.core.players['0'].hand = [
          {
            id: 'card-1',
            cardType: 'unit',
            name: '测试卡',
            unitClass: 'common',
            faction: 'paladin',
            cost: 1,
            life: 1,
            strength: 1,
            attackType: 'melee',
            attackRange: 1,
            abilities: [],
            deckSymbols: [],
          },
        ];
        return state;
      },
      commands: [
        {
          type: SW_COMMANDS.DECLARE_ATTACK,
          playerId: '0',
          payload: {
            attacker: { row: 3, col: 3 },
            target: { row: 3, col: 4 },
            beforeAttack: {
              abilityId: 'healing',
              targetCardId: 'card-1', // 弃牌
            },
          },
        },
      ],
    };

    const result = runner.run(testCase);
    
    // 验证命令执行成功（验证通过）
    expect(result.passed).toBe(true);
    expect(result.steps[0].success).toBe(true);
  });
});
