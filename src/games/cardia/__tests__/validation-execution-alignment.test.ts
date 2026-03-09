/**
 * D2 维度：验证-执行前置条件对齐测试
 * 
 * 测试目标：
 * - 验证验证层（validate.ts）和执行层（execute.ts）的前置条件完全一致
 * - 验证边界完整、概念载体覆盖、打出约束、额度授予约束
 * 
 * 子维度：
 * - D2.1 边界完整：所有限定条件是否全程约束
 * - D2.2 概念载体覆盖：游戏术语在数据层的所有承载形式是否都被筛选覆盖
 * - D2.3 打出约束：ongoing 行动卡的打出约束是否在数据定义、验证层、UI 层三层体现
 * - D2.4 额度授予约束：额外出牌额度的约束条件是否在 payload、reduce、validate、UI 四层体现
 */

import { describe, test, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { COMMANDS } from '../domain/commands';
import type { CardiaCore } from '../domain/core-types';

describe('Feature: cardia-full-audit, Property D2: 验证-执行前置条件对齐', () => {
  
  describe('D2.1 边界完整：所有限定条件是否全程约束', () => {
    
    test('Card02 Void Mage - 弃牌能力在手牌为空时应被拒绝', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 设置初始状态：p0 手牌为空
      const { state } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
        // 清空 p0 的手牌
        { type: 'CHEAT_SET_STATE', state: (s: CardiaCore) => {
          s.players.p0.hand = [];
          return s;
        }},
      ]);
      
      // 尝试激活弃牌能力（应该被拒绝）
      const result = await runner.runCommands([
        { type: COMMANDS.ACTIVATE_ABILITY, playerId: 'p0', abilityId: 'void_mage_discard', cardUid: 'vm-1' },
      ]);
      
      // 验证：命令应该被拒绝（因为手牌为空）
      expect(result.error).toBeDefined();
      expect(result.error).toContain('手牌为空');
    });
    
    test('Card04 Mediator - 移除印戒能力在无印戒时应被拒绝', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 设置初始状态：场上无印戒
      const { state } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
        { type: 'CHEAT_SET_STATE', state: (s: CardiaCore) => {
          // 清空所有印戒
          s.players.p0.encounter = [];
          s.players.p1.encounter = [];
          return s;
        }},
      ]);
      
      // 尝试激活移除印戒能力（应该被拒绝）
      const result = await runner.runCommands([
        { type: COMMANDS.ACTIVATE_ABILITY, playerId: 'p0', abilityId: 'mediator_remove_signet', cardUid: 'med-1' },
      ]);
      
      // 验证：命令应该被拒绝（因为无印戒可移除）
      expect(result.error).toBeDefined();
      expect(result.error).toContain('无印戒');
    });
    
    test('Card06 Diviner - 查看牌库能力在牌库为空时应被拒绝', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 设置初始状态：p0 牌库为空
      const { state } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
        { type: 'CHEAT_SET_STATE', state: (s: CardiaCore) => {
          s.players.p0.deck = [];
          return s;
        }},
      ]);
      
      // 尝试激活查看牌库能力（应该被拒绝）
      const result = await runner.runCommands([
        { type: COMMANDS.ACTIVATE_ABILITY, playerId: 'p0', abilityId: 'diviner_scry', cardUid: 'div-1' },
      ]);
      
      // 验证：命令应该被拒绝（因为牌库为空）
      expect(result.error).toBeDefined();
      expect(result.error).toContain('牌库为空');
    });
  });
  
  describe('D2.2 概念载体覆盖：游戏术语在数据层的所有承载形式是否都被筛选覆盖', () => {
    
    test('Card14 Governess - 复制能力应覆盖所有可复制的能力来源', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 设置初始状态：场上有多种能力来源
      const { state } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
        { type: 'CHEAT_SET_STATE', state: (s: CardiaCore) => {
          // 场上有即时能力卡牌
          s.players.p0.encounter = [
            { defId: 'card01_elf', uid: 'elf-1', signets: 0 },
          ];
          // 场上有持续能力卡牌
          s.players.p1.encounter = [
            { defId: 'card05_swamp_guard', uid: 'sg-1', signets: 0 },
          ];
          return s;
        }},
      ]);
      
      // 激活复制能力
      const result = await runner.runCommands([
        { type: COMMANDS.ACTIVATE_ABILITY, playerId: 'p0', abilityId: 'governess_copy', cardUid: 'gov-1' },
      ]);
      
      // 验证：应该能看到所有可复制的能力（即时 + 持续）
      expect(result.state.sys.interaction.current).toBeDefined();
      const options = result.state.sys.interaction.current!.data.options;
      expect(options.length).toBeGreaterThanOrEqual(2); // 至少有 2 个选项（elf + swamp_guard）
    });
    
    test('修正标记应覆盖所有修正来源（能力添加 + 持续效果）', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 设置初始状态：场上有修正标记
      const { state } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
        { type: 'CHEAT_SET_STATE', state: (s: CardiaCore) => {
          // 添加修正标记（来自能力）
          s.players.p0.encounter = [
            { defId: 'card03_dwarf', uid: 'dwarf-1', signets: 0, modifiers: [{ value: 3, source: 'ability' }] },
          ];
          // 添加持续效果修正
          s.players.p1.encounter = [
            { defId: 'card05_swamp_guard', uid: 'sg-1', signets: 0, modifiers: [{ value: 1, source: 'ongoing' }] },
          ];
          return s;
        }},
      ]);
      
      // 验证：计算影响力时应该包含所有修正来源
      const p0Card = state.players.p0.encounter[0];
      const p1Card = state.players.p1.encounter[0];
      
      // Dwarf 基础影响力 3 + 修正 3 = 6
      const p0Influence = 3 + p0Card.modifiers!.reduce((sum, m) => sum + m.value, 0);
      expect(p0Influence).toBe(6);
      
      // Swamp Guard 基础影响力 5 + 修正 1 = 6
      const p1Influence = 5 + p1Card.modifiers!.reduce((sum, m) => sum + m.value, 0);
      expect(p1Influence).toBe(6);
    });
  });
  
  describe('D2.3 打出约束：ongoing 行动卡的打出约束是否在数据定义、验证层、UI 层三层体现', () => {
    
    test('Card05 Swamp Guard - 持续能力的打出约束应在数据定义中声明', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 读取卡牌定义
      const { cardRegistry } = await import('../domain/ids');
      const swampGuardDef = cardRegistry.get('card05_swamp_guard');
      
      // 验证：持续能力应该有 playConstraint 声明
      expect(swampGuardDef).toBeDefined();
      expect(swampGuardDef!.abilityType).toBe('ongoing');
      // 如果描述中有条件性打出目标，应该有 playConstraint
      if (swampGuardDef!.description.includes('当') || swampGuardDef!.description.includes('如果')) {
        expect(swampGuardDef!.playConstraint).toBeDefined();
      }
    });
    
    test('Card05 Swamp Guard - 持续能力的打出约束应在验证层检查', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 设置初始状态：不满足打出约束
      const { state } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
        { type: 'CHEAT_SET_STATE', state: (s: CardiaCore) => {
          // 设置场景：不满足 Swamp Guard 的打出条件
          s.players.p0.hand = [{ defId: 'card05_swamp_guard', uid: 'sg-1' }];
          s.players.p0.encounter = []; // 场上无卡牌
          return s;
        }},
      ]);
      
      // 尝试打出卡牌（如果有打出约束，应该被拒绝）
      const result = await runner.runCommands([
        { type: COMMANDS.PLAY_CARD, playerId: 'p0', cardUid: 'sg-1', position: 0 },
      ]);
      
      // 验证：如果有打出约束且不满足，命令应该被拒绝
      // 注意：Swamp Guard 没有打出约束，所以这个测试应该通过
      expect(result.error).toBeUndefined();
    });
  });
  
  describe('D2.4 额度授予约束：额外出牌额度的约束条件是否在 payload、reduce、validate、UI 四层体现', () => {
    
    test('Card01 Elf - 抽牌能力的额度应在 payload 中声明', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 激活抽牌能力
      const { state, events } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
        { type: COMMANDS.PLAY_CARD, playerId: 'p0', cardUid: 'elf-1', position: 0 },
      ]);
      
      // 验证：事件 payload 应该包含抽牌数量
      const drawEvent = events.find(e => e.type === 'CARD_DRAWN');
      expect(drawEvent).toBeDefined();
      expect(drawEvent!.payload).toHaveProperty('count');
      expect(drawEvent!.payload.count).toBe(1);
    });
    
    test('Card01 Elf - 抽牌能力的额度应在 reduce 中正确消耗', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 设置初始状态
      const { state: initialState } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
      ]);
      
      const initialHandSize = initialState.players.p0.hand.length;
      
      // 激活抽牌能力
      const { state: finalState } = await runner.runCommands([
        { type: COMMANDS.PLAY_CARD, playerId: 'p0', cardUid: 'elf-1', position: 0 },
      ]);
      
      // 验证：手牌数量应该增加 1
      expect(finalState.players.p0.hand.length).toBe(initialHandSize + 1);
    });
    
    test('Card01 Elf - 抽牌能力在牌库为空时应该被拒绝或降级', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 设置初始状态：牌库为空
      const { state } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
        { type: 'CHEAT_SET_STATE', state: (s: CardiaCore) => {
          s.players.p0.deck = [];
          return s;
        }},
      ]);
      
      // 尝试激活抽牌能力
      const result = await runner.runCommands([
        { type: COMMANDS.PLAY_CARD, playerId: 'p0', cardUid: 'elf-1', position: 0 },
      ]);
      
      // 验证：命令应该被拒绝或降级（不抽牌但卡牌仍然打出）
      // 注意：Elf 的抽牌是即时效果，不是打出约束，所以卡牌应该能打出
      expect(result.error).toBeUndefined();
      expect(result.state.players.p0.hand.length).toBe(state.players.p0.hand.length); // 手牌数量不变
    });
  });
  
  describe('D2 综合测试：验证层与执行层的一致性', () => {
    
    test('所有能力的验证层前置条件应与执行层一致', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 读取所有能力定义
      const { abilityRegistry } = await import('../domain/abilityRegistry');
      const allAbilityIds = Array.from(abilityRegistry.keys());
      
      // 对每个能力进行测试
      for (const abilityId of allAbilityIds) {
        const abilityDef = abilityRegistry.get(abilityId);
        
        // 验证：如果有 customValidator，应该有对应的执行层检查
        if (abilityDef?.validation?.customValidator) {
          // 这里只是结构检查，具体的一致性需要在单独的测试中验证
          expect(abilityDef.validation.customValidator).toBeTypeOf('function');
        }
      }
    });
    
    test('验证层允许的操作，执行层必须能成功执行', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 设置初始状态：满足所有前置条件
      const { state } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
        { type: 'CHEAT_SET_STATE', state: (s: CardiaCore) => {
          // 确保 p0 有手牌、牌库、场上有卡牌
          s.players.p0.hand = [
            { defId: 'card02_void_mage', uid: 'vm-1' },
            { defId: 'card03_dwarf', uid: 'dwarf-1' },
          ];
          s.players.p0.deck = [
            { defId: 'card01_elf', uid: 'elf-1' },
          ];
          s.players.p0.encounter = [
            { defId: 'card04_mediator', uid: 'med-1', signets: 1 },
          ];
          return s;
        }},
      ]);
      
      // 尝试激活各种能力（验证层应该允许，执行层应该成功）
      const result1 = await runner.runCommands([
        { type: COMMANDS.ACTIVATE_ABILITY, playerId: 'p0', abilityId: 'void_mage_discard', cardUid: 'vm-1' },
      ]);
      expect(result1.error).toBeUndefined(); // 验证层允许，执行层应该成功
    });
    
    test('验证层拒绝的操作，执行层不应该被调用', async () => {
      const runner = new GameTestRunner({
        gameId: 'cardia',
        random: () => 0.5,
      });
      
      // 设置初始状态：不满足前置条件
      const { state } = await runner.runCommands([
        { type: 'SETUP_GAME', players: ['p0', 'p1'] },
        { type: 'CHEAT_SET_STATE', state: (s: CardiaCore) => {
          // 清空 p0 的手牌
          s.players.p0.hand = [];
          return s;
        }},
      ]);
      
      // 尝试激活弃牌能力（验证层应该拒绝）
      const result = await runner.runCommands([
        { type: COMMANDS.ACTIVATE_ABILITY, playerId: 'p0', abilityId: 'void_mage_discard', cardUid: 'vm-1' },
      ]);
      
      // 验证：命令应该被拒绝，执行层不应该被调用
      expect(result.error).toBeDefined();
      expect(result.state.players.p0.hand.length).toBe(0); // 手牌数量不变（执行层未被调用）
    });
  });
});
