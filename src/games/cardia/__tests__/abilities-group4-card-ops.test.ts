/**
 * 组 4：卡牌操作能力单元测试
 * 
 * 测试范围：
 * - 沼泽守卫（Swamp Guard）
 * - 虚空法师（Void Mage）
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type { CardiaCore, PlayedCard } from '../domain/core-types';
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

describe('组 4：卡牌操作能力', () => {
  let mockCore: CardiaCore;
  let mockContext: CardiaAbilityContext;

  beforeEach(() => {
    const playedCard1: PlayedCard = {
      uid: 'played1',
      defId: 'test_played_1',
      ownerId: 'player1',
      baseInfluence: 5,
      faction: 'swamp',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 0,
    };

    const playedCard2: PlayedCard = {
      uid: 'played2',
      defId: 'test_played_2',
      ownerId: 'player1',
      baseInfluence: 8,
      faction: 'academy',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 1,
    };

    const opponentPlayedCard1: PlayedCard = {
      uid: 'opp_played1',
      defId: 'test_opp_played_1',
      ownerId: 'player2',
      baseInfluence: 7,
      faction: 'guild',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 0,
    };

    const opponentPlayedCard2: PlayedCard = {
      uid: 'opp_played2',
      defId: 'test_opp_played_2',
      ownerId: 'player2',
      baseInfluence: 6,
      faction: 'dynasty',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 1,
    };

    mockCore = {
      players: {
        'player1': {
          id: 'player1',
          name: 'Player 1',
          hand: [],
          deck: [],
          discard: [],
          playedCards: [playedCard1, playedCard2],
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
          playedCards: [opponentPlayedCard1, opponentPlayedCard2],
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
      deckVariant: 'deck_i',
      targetSignets: 5,
    };

    mockContext = {
      core: mockCore,
      abilityId: 'test_ability',
      cardId: 'played2', // 当前卡牌是第二张（encounterIndex = 1）
      sourceId: 'played2',
      playerId: 'player1',
      ownerId: 'player1',
      opponentId: 'player2',
      timestamp: Date.now(),
      random: () => 0.5,
    };
  });

  describe('沼泽守卫（Swamp Guard）', () => {
    it('第一次调用：应该创建交互让玩家选择目标卡牌', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(mockContext);

      // 第一次调用应该返回交互
      expect(executor.interaction).toBeDefined();
      expect((executor.interaction as any).type).toBe('card_selection');
      expect((executor.interaction as any).availableCards).toBeDefined();
      expect((executor.interaction as any).availableCards.length).toBe(1); // 只有 played1 可选（排除当前卡牌 played2）
      expect((executor.interaction as any).availableCards).toContain('played1');
      expect(executor.events).toHaveLength(0); // 第一次调用不产生事件
    });

    it('第二次调用：选择卡牌后应该回收己方卡牌到手牌，并弃掉相对的牌', () => {
      // 第二次调用，传入 selectedCardId
      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'played1',
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(contextWithSelection);

      expect(executor.events.length).toBe(2);
      
      // 第一个事件：回收己方卡牌
      const recycleEvent = executor.events.find(e => e.type === CARDIA_EVENTS.CARD_RECYCLED);
      expect(recycleEvent).toBeDefined();
      expect((recycleEvent?.payload as any).playerId).toBe('player1');
      expect((recycleEvent?.payload as any).cardId).toBe('played1');
      expect((recycleEvent?.payload as any).from).toBe('field');
      
      // 第二个事件：弃掉对手相对的牌
      const discardEvent = executor.events.find(e => e.type === CARDIA_EVENTS.CARDS_DISCARDED);
      expect(discardEvent).toBeDefined();
      expect((discardEvent?.payload as any).playerId).toBe('player2');
      expect((discardEvent?.payload as any).cardIds).toContain('opp_played1'); // 对手第一张牌（encounterIndex = 0）
      expect((discardEvent?.payload as any).from).toBe('field');
    });

    it('当己方没有其他场上卡牌时，应该发射 ABILITY_NO_VALID_TARGET 事件', () => {
      mockCore.players['player1'].playedCards = [mockCore.players['player1'].playedCards[1]]; // 只保留当前卡牌

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.ABILITY_NO_VALID_TARGET);
      expect((executor.events[0].payload as any).reason).toBe('no_field_cards');
      expect(executor.interaction).toBeUndefined();
    });

    it('当对手没有相对的牌时，应该只回收己方卡牌', () => {
      mockCore.players['player2'].playedCards = []; // 对手没有场上卡牌

      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'played1',
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(contextWithSelection);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.CARD_RECYCLED);
    });

    it('应该排除当前卡牌（不能回收自己）', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(mockContext);

      // 可选卡牌列表不应包含当前卡牌
      expect((executor.interaction as any).availableCards).not.toContain(mockContext.cardId);
      expect((executor.interaction as any).availableCards).toContain('played1');
    });

    it('应该弃掉相对的牌（相同遭遇序号）', () => {
      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'played1', // 回收 played1（encounterIndex = 0）
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(contextWithSelection);

      const discardEvent = executor.events.find(e => e.type === CARDIA_EVENTS.CARDS_DISCARDED);
      expect((discardEvent?.payload as any).cardIds).toContain('opp_played1'); // 对手第一张牌（encounterIndex = 0）
    });

    it('边界条件：选中的卡牌不存在时应该返回空事件', () => {
      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'non_existent_card',
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(contextWithSelection);

      expect(executor.events).toHaveLength(0);
    });
  });

  describe('虚空法师（Void Mage）', () => {
    beforeEach(() => {
      // 添加修正标记到第一张牌
      mockCore.modifierTokens = [
        { cardId: 'played1', value: 3, source: 'test_source_1', timestamp: Date.now() },
        { cardId: 'played1', value: -2, source: 'test_source_2', timestamp: Date.now() },
      ];
      
      // 添加持续标记到第二张牌
      mockCore.ongoingAbilities = [
        { abilityId: 'test_ability_1', cardId: 'played2', playerId: 'player1', effectType: 'forceTie', timestamp: Date.now() },
        { abilityId: 'test_ability_2', cardId: 'played2', playerId: 'player1', effectType: 'winTies', timestamp: Date.now() },
      ];
    });

    it('第一次调用：应该创建交互让玩家选择目标卡牌', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE)!(mockContext);

      // 第一次调用应该返回交互
      expect(executor.interaction).toBeDefined();
      expect(executor.interaction.type).toBe('card_selection');
      expect(executor.interaction.availableCards).toBeDefined();
      expect(executor.interaction.availableCards.length).toBeGreaterThan(0);
      expect(executor.events).toHaveLength(0); // 第一次调用不产生事件
    });

    it('第二次调用：选择卡牌后应该移除所有修正标记', () => {
      // 第二次调用，传入 selectedCardId
      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'played1',
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE)!(contextWithSelection);

      // 第二次调用应该返回事件
      expect(executor.interaction).toBeUndefined();
      const removeModifierEvents = executor.events.filter(e => e.type === CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED);
      expect(removeModifierEvents.length).toBe(2); // played1 有 2 个修正标记
      
      // 验证移除的是正确的卡牌
      removeModifierEvents.forEach(event => {
        expect(event.payload.cardId).toBe('played1');
      });
    });

    it('第二次调用：选择卡牌后应该移除所有持续标记', () => {
      // 第二次调用，传入 selectedCardId
      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'played2',
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE)!(contextWithSelection);

      // 第二次调用应该返回事件
      expect(executor.interaction).toBeUndefined();
      const removeOngoingEvents = executor.events.filter(e => e.type === CARDIA_EVENTS.ONGOING_ABILITY_REMOVED);
      expect(removeOngoingEvents.length).toBe(2); // played2 有 2 个持续标记
      
      // 验证移除的是正确的卡牌
      removeOngoingEvents.forEach(event => {
        expect(event.payload.cardId).toBe('played2');
      });
    });

    it('当没有修正标记或持续标记时，应该发射 ABILITY_NO_VALID_TARGET 事件', () => {
      mockCore.modifierTokens = [];
      mockCore.ongoingAbilities = [];

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.ABILITY_NO_VALID_TARGET);
      expect(executor.interaction).toBeUndefined();
    });

    it('应该同时移除修正标记和持续标记', () => {
      // 给同一张牌添加修正标记和持续标记
      mockCore.modifierTokens = [
        { cardId: 'played1', value: 5, source: 'test_source', timestamp: Date.now() },
      ];
      mockCore.ongoingAbilities = [
        { abilityId: 'test_ability', cardId: 'played1', playerId: 'player1', effectType: 'forceTie', timestamp: Date.now() },
      ];

      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'played1',
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE)!(contextWithSelection);

      const removeModifierEvents = executor.events.filter(e => e.type === CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED);
      const removeOngoingEvents = executor.events.filter(e => e.type === CARDIA_EVENTS.ONGOING_ABILITY_REMOVED);
      
      expect(removeModifierEvents.length).toBe(1);
      expect(removeOngoingEvents.length).toBe(1);
    });

    it('应该能够移除任意玩家卡牌上的标记', () => {
      // 给对手卡牌添加标记
      mockCore.modifierTokens = [
        { cardId: 'opp_played1', value: 3, source: 'test_source', timestamp: Date.now() },
      ];
      mockCore.ongoingAbilities = [
        { abilityId: 'test_ability', cardId: 'opp_played1', playerId: 'player2', effectType: 'forceTie', timestamp: Date.now() },
      ];

      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'opp_played1',
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE)!(contextWithSelection);

      expect(executor.events.length).toBe(2);
      
      const removeModifierEvent = executor.events.find(e => e.type === CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED);
      const removeOngoingEvent = executor.events.find(e => e.type === CARDIA_EVENTS.ONGOING_ABILITY_REMOVED);
      
      expect(removeModifierEvent?.payload.cardId).toBe('opp_played1');
      expect(removeOngoingEvent?.payload.cardId).toBe('opp_played1');
    });

    it('边界条件：选中的卡牌不存在时应该返回空事件', () => {
      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'non_existent_card',
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE)!(contextWithSelection);

      expect(executor.events).toHaveLength(0);
    });

    it('边界条件：选中的卡牌没有标记时应该返回空事件', () => {
      // played1 有标记，但我们选择 played2（没有标记）
      mockCore.modifierTokens = [
        { cardId: 'played1', value: 5, source: 'test_source', timestamp: Date.now() },
      ];
      mockCore.ongoingAbilities = [];

      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'played2', // 这张牌没有标记
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE)!(contextWithSelection);

      expect(executor.events).toHaveLength(0);
    });
  });

  describe('状态回溯', () => {
    it('沼泽守卫回收卡牌后，应该触发遭遇重新计算', () => {
      // 这个测试验证事件正确发射
      // 实际的状态回溯逻辑在 reduce.ts 和 execute.ts 中处理
      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'played1',
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SWAMP_GUARD)!(contextWithSelection);

      const recycleEvent = executor.events.find(e => e.type === CARDIA_EVENTS.CARD_RECYCLED);
      expect(recycleEvent).toBeDefined();
      
      // 回收卡牌会改变场上卡牌数量，需要重新计算遭遇结果
    });

    it('虚空法师移除标记后，应该触发影响力重新计算', () => {
      mockCore.modifierTokens = [
        { cardId: 'played1', value: 5, source: 'test_source', timestamp: Date.now() },
      ];

      // 需要传入 selectedCardId 才能执行移除逻辑
      const contextWithSelection = {
        ...mockContext,
        selectedCardId: 'played1',
      };
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.VOID_MAGE)!(contextWithSelection);

      const removeModifierEvent = executor.events.find(e => e.type === CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED);
      expect(removeModifierEvent).toBeDefined();
      
      // 移除修正标记会改变卡牌影响力，需要重新计算遭遇结果
    });
  });
});
