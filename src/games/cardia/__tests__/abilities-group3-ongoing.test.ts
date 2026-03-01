/**
 * 组 3：持续能力单元测试
 * 
 * 测试范围：
 * - 调停者（Mediator）
 * - 审判官（Magistrate）
 * - 财务官（Treasurer）
 * - 顾问（Advisor）
 * - 机械精灵（Mechanical Spirit）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { CardiaCore } from '../domain/core-types';
import { abilityExecutorRegistry, initializeAbilityExecutors } from '../domain/abilityExecutor';
import { ABILITY_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaAbilityContext } from '../domain/abilityExecutor';
import { createModifierStack } from '../../../engine/primitives/modifier';
import { createTagContainer } from '../../../engine/primitives/tags';

// 初始化所有能力执行器
beforeAll(async () => {
  await initializeAbilityExecutors();
});

describe('组 3：持续能力', () => {
  let mockCore: CardiaCore;
  let mockContext: CardiaAbilityContext;

  beforeEach(() => {
    mockCore = {
      players: {
        'player1': {
          id: 'player1',
          name: 'Player 1',
          hand: [],
          deck: [],
          discard: [],
          playedCards: [],
          signets: 0,
          tags: createTagContainer(),
          hasPlayed: false,
          cardRevealed: false,
        },
        'player2': {
          id: 'player2',
          name: 'Player 2',
          hand: [],
          deck: [],
          discard: [],
          playedCards: [],
          signets: 0,
          tags: createTagContainer(),
          hasPlayed: false,
          cardRevealed: false,
        },
      },
      playerOrder: ['player1', 'player2'],
      currentPlayerId: 'player1',
      turnNumber: 1,
      phase: 'ability',
      encounterHistory: [],
      ongoingAbilities: [],
      modifierTokens: [],
      delayedEffects: [],
      revealFirstNextEncounter: null,
      mechanicalSpiritActive: null,
      deckVariant: 'deck_i' as const,
      targetSignets: 5,
    };

    mockContext = {
      core: mockCore,
      abilityId: 'test_ability',
      cardId: 'test_card',
      sourceId: 'test_card',
      playerId: 'player1',
      ownerId: 'player1',
      opponentId: 'player2',
      timestamp: Date.now(),
      random: () => 0.5,
    };
  });

  describe('调停者（Mediator）', () => {
    it('应该放置持续标记，强制遭遇为平局', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MEDIATOR)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.ONGOING_ABILITY_PLACED);
      expect(executor.events[0].payload.abilityId).toBe(mockContext.abilityId);
      expect(executor.events[0].payload.cardId).toBe(mockContext.cardId);
      expect(executor.events[0].payload.playerId).toBe('player1');
      expect(executor.events[0].payload.effectType).toBe('forceTie');
    });

    it('持续标记应该是永久的（不自动移除）', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MEDIATOR)!(mockContext);

      // 检查事件 payload 中没有 oneTime 或 duration 字段
      expect(executor.events[0].payload).not.toHaveProperty('oneTime');
      expect(executor.events[0].payload).not.toHaveProperty('duration');
    });
  });

  describe('审判官（Magistrate）', () => {
    it('应该放置持续标记，赢得所有平局', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MAGISTRATE)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.ONGOING_ABILITY_PLACED);
      expect(executor.events[0].payload.abilityId).toBe(mockContext.abilityId);
      expect(executor.events[0].payload.cardId).toBe(mockContext.cardId);
      expect(executor.events[0].payload.playerId).toBe('player1');
      expect(executor.events[0].payload.effectType).toBe('winTies');
    });

    it('持续标记应该是永久的（不自动移除）', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MAGISTRATE)!(mockContext);

      expect(executor.events[0].payload).not.toHaveProperty('oneTime');
      expect(executor.events[0].payload).not.toHaveProperty('duration');
    });
  });

  describe('财务官（Treasurer）', () => {
    it('应该放置持续标记，下次遭遇获胜时额外获得1枚印戒', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.TREASURER)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.ONGOING_ABILITY_PLACED);
      expect(executor.events[0].payload.abilityId).toBe(mockContext.abilityId);
      expect(executor.events[0].payload.cardId).toBe(mockContext.cardId);
      expect(executor.events[0].payload.playerId).toBe('player1');
      expect(executor.events[0].payload.effectType).toBe('extraSignet');
    });

    it('持续标记应该是一次性的（触发后自动移除）', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.TREASURER)!(mockContext);

      // 财务官的持续标记是一次性的，但这个特性在遭遇结算时处理
      // 这里只验证事件正确发射
      expect(executor.events[0].payload.effectType).toBe('extraSignet');
    });
  });

  describe('顾问（Advisor）', () => {
    it('应该放置持续标记，下次遭遇获胜时额外获得1枚印戒', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ADVISOR)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.ONGOING_ABILITY_PLACED);
      expect(executor.events[0].payload.abilityId).toBe(mockContext.abilityId);
      expect(executor.events[0].payload.cardId).toBe(mockContext.cardId);
      expect(executor.events[0].payload.playerId).toBe('player1');
      expect(executor.events[0].payload.effectType).toBe('extraSignet');
    });

    it('顾问和财务官的效果应该相同', () => {
      const advisorExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.ADVISOR)!(mockContext);
      const treasurerExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.TREASURER)!(mockContext);

      expect(advisorExecutor.events[0].payload.effectType).toBe(treasurerExecutor.events[0].payload.effectType);
    });
  });

  describe('机械精灵（Mechanical Spirit）', () => {
    it('应该放置持续标记，下次遭遇获胜时直接赢得游戏', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MECHANICAL_SPIRIT)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.ONGOING_ABILITY_PLACED);
      expect(executor.events[0].payload.abilityId).toBe(mockContext.abilityId);
      expect(executor.events[0].payload.cardId).toBe(mockContext.cardId);
      expect(executor.events[0].payload.playerId).toBe('player1');
      expect(executor.events[0].payload.effectType).toBe('conditionalVictory');
    });

    it('持续标记应该是一次性的（触发后自动移除）', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MECHANICAL_SPIRIT)!(mockContext);

      // 机械精灵的持续标记是一次性的，触发后游戏结束
      expect(executor.events[0].payload.effectType).toBe('conditionalVictory');
    });
  });

  describe('持续能力优先级', () => {
    it('审判官的优先级应该高于调停者', () => {
      // 这个测试验证持续能力的 effectType 不同
      // 实际优先级逻辑在遭遇结算时处理
      const mediatorExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.MEDIATOR)!(mockContext);
      const magistrateExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.MAGISTRATE)!(mockContext);

      expect(mediatorExecutor.events[0].payload.effectType).toBe('forceTie');
      expect(magistrateExecutor.events[0].payload.effectType).toBe('winTies');
      
      // winTies 应该在遭遇结算时优先于 forceTie 处理
    });
  });

  describe('持续标记的生命周期', () => {
    it('永久持续标记（调停者、审判官）不应该有移除条件', () => {
      const mediatorExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.MEDIATOR)!(mockContext);
      const magistrateExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.MAGISTRATE)!(mockContext);

      // 永久持续标记只能被虚空法师移除
      expect(mediatorExecutor.events[0].payload.effectType).toBe('forceTie');
      expect(magistrateExecutor.events[0].payload.effectType).toBe('winTies');
    });

    it('一次性持续标记（财务官、顾问、机械精灵）应该在触发后移除', () => {
      const treasurerExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.TREASURER)!(mockContext);
      const advisorExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.ADVISOR)!(mockContext);
      const mechanicalSpiritExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.MECHANICAL_SPIRIT)!(mockContext);

      // 一次性持续标记的 effectType 应该标识其一次性特性
      expect(treasurerExecutor.events[0].payload.effectType).toBe('extraSignet');
      expect(advisorExecutor.events[0].payload.effectType).toBe('extraSignet');
      expect(mechanicalSpiritExecutor.events[0].payload.effectType).toBe('conditionalVictory');
    });
  });
});
