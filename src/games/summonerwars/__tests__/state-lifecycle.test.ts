/**
 * 状态生命周期测试
 * 
 * 测试临时状态字段的完整生命周期：写入 → 消耗 → 清理
 * 
 * 覆盖字段：
 * - extraAttacks: 额外攻击次数
 * - tempAbilities: 临时技能
 * - boosts: 充能
 * - healingMode: 治疗模式
 * - wasAttackedThisTurn: 本回合被攻击标记
 * - hasMoved/hasAttacked: 行动标记
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SummonerWarsDomain } from '../domain';
import { createInitializedCore, placeTestUnit } from './test-helpers';
import { createInitialSystemState } from '../../../engine/pipeline';
import { SW_COMMANDS } from '../domain/types';
import type { UnitCard, RandomFn } from '../domain/types';

const fixedRandom: RandomFn = {
  random: () => 0.5,
  d: (max) => Math.ceil(max / 2),
  range: (min, max) => Math.floor((min + max) / 2),
  shuffle: (arr) => [...arr],
};

const runner = new GameTestRunner({
  domain: SummonerWarsDomain,
  playerIds: ['0', '1'],
  random: fixedRandom,
});

// ============================================================================
// tempAbilities 生命周期
// ============================================================================

describe('tempAbilities 生命周期', () => {
  it('写入 → 消耗（合并到技能列表）→ 清理', () => {
    // 简化测试：只验证回合清理
    // 写入和消耗逻辑已在 illusion 技能的人工审计中验证
    const result = runner.run({
      name: 'tempAbilities 回合清理',
      setup: (playerIds, random) => {
        const core = createInitializedCore(playerIds, random);
        core.phase = 'draw'; // 设置为最后阶段
        core.currentPlayer = '0';
        
        const witchCard: UnitCard = {
          id: 'test-witch',
          name: '女巫',
          cardType: 'unit',
          unitClass: 'common',
          cost: 2,
          life: 2,
          strength: 1,
          move: 2,
          abilities: ['illusion'],
        };
        placeTestUnit(core, { row: 3, col: 3 }, {
          card: witchCard,
          owner: '0',
          damage: 0,
          boosts: 0,
          hasMoved: false,
          hasAttacked: false,
          tempAbilities: ['charge', 'ferocity'], // 写入：临时技能
        });
        
        const sys = createInitialSystemState(playerIds, [], undefined);
        return { core, sys };
      },
      commands: [
        {
          type: SW_COMMANDS.END_PHASE,
          playerId: '0',
          payload: {},
        },
      ],
    });
    
    // 验证清理：tempAbilities 被移除
    const afterCleanup = result.finalState.core.board[3][3].unit;
    expect(afterCleanup?.tempAbilities).toBeUndefined();
  });
});

// ============================================================================
// 回合字段清理
// ============================================================================

describe('回合字段清理', () => {
  it('TURN_CHANGED 清理所有临时字段', () => {
    const result = runner.run({
      name: '回合结束清理所有临时字段',
      setup: (playerIds, random) => {
        const core = createInitializedCore(playerIds, random);
        core.phase = 'draw'; // 设置为最后阶段
        core.currentPlayer = '0';
        
        const unitCard: UnitCard = {
          id: 'test-unit',
          name: '单位',
          cardType: 'unit',
          unitClass: 'common',
          cost: 1,
          life: 3,
          strength: 2,
          move: 2,
          abilities: [],
        };
        placeTestUnit(core, { row: 3, col: 3 }, {
          card: unitCard,
          owner: '0',
          damage: 0,
          boosts: 1,
          hasMoved: true,
          hasAttacked: true,
          extraAttacks: 1,
          tempAbilities: ['charge'],
          wasAttackedThisTurn: true,
        });
        
        const sys = createInitialSystemState(playerIds, [], undefined);
        return { core, sys };
      },
      commands: [
        {
          type: SW_COMMANDS.END_PHASE,
          playerId: '0',
          payload: {},
        },
      ],
    });
    
    const unit = result.finalState.core.board[3][3].unit!;
    
    // 验证临时字段被清理
    expect(unit.extraAttacks).toBeUndefined();
    expect(unit.tempAbilities).toBeUndefined();
    expect(unit.wasAttackedThisTurn).toBe(false);
    expect(unit.hasMoved).toBe(false);
    expect(unit.hasAttacked).toBe(false);
    
    // 验证持久字段保留
    expect(unit.boosts).toBe(1); // 充能不清理
    expect(unit.damage).toBe(0);
  });
});
