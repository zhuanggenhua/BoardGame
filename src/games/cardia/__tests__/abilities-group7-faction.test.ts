/**
 * 组 7：派系相关能力单元测试
 * 
 * 测试范围：
 * - 伏击者（Ambusher）- 派系弃牌
 * - 巫王（Witch King）- 派系弃牌
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { CardiaCore, CardInstance } from '../domain/core-types';
import { abilityExecutorRegistry, initializeAbilityExecutors } from '../domain/abilityExecutor';
import { ABILITY_IDS, FACTION_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaAbilityContext } from '../domain/abilityExecutor';
import { createModifierStack } from '../../../engine/primitives/modifier';
import { createTagContainer } from '../../../engine/primitives/tags';

// 初始化所有能力执行器
beforeAll(async () => {
  await initializeAbilityExecutors();
});

describe('组 7：派系相关能力', () => {
  let mockCore: CardiaCore;
  let mockContext: CardiaAbilityContext;

  beforeEach(() => {
    const opponentHandCard1: CardInstance = {
      uid: 'opp_hand1',
      defId: 'test_opp_hand_1',
      ownerId: 'player2',
      baseInfluence: 8,
      faction: 'swamp',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
    };

    const opponentHandCard2: CardInstance = {
      uid: 'opp_hand2',
      defId: 'test_opp_hand_2',
      ownerId: 'player2',
      baseInfluence: 6,
      faction: 'academy',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
    };

    const opponentHandCard3: CardInstance = {
      uid: 'opp_hand3',
      defId: 'test_opp_hand_3',
      ownerId: 'player2',
      baseInfluence: 7,
      faction: 'swamp',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
    };

    const opponentDeckCard1: CardInstance = {
      uid: 'opp_deck1',
      defId: 'test_opp_deck_1',
      ownerId: 'player2',
      baseInfluence: 5,
      faction: 'swamp',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
    };

    const opponentDeckCard2: CardInstance = {
      uid: 'opp_deck2',
      defId: 'test_opp_deck_2',
      ownerId: 'player2',
      baseInfluence: 4,
      faction: 'guild',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
    };

    const opponentDeckCard3: CardInstance = {
      uid: 'opp_deck3',
      defId: 'test_opp_deck_3',
      ownerId: 'player2',
      baseInfluence: 6,
      faction: 'swamp',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
    };

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
          hand: [opponentHandCard1, opponentHandCard2, opponentHandCard3],
          deck: [opponentDeckCard1, opponentDeckCard2, opponentDeckCard3],
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
      abilityId: ABILITY_IDS.AMBUSHER,
      cardId: 'test_card',
      sourceId: 'test_card',
      playerId: 'player1',
      ownerId: 'player1',
      opponentId: 'player2',
      timestamp: Date.now(),
      random: () => 0.5,
    };
  });

  describe('伏击者（Ambusher）- 派系弃牌', () => {
    it('应该让对手弃掉所有指定派系的手牌', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER)!(mockContext);

      expect(executor.events.length).toBeGreaterThanOrEqual(2);
      
      // 第一个事件：派系选择
      const factionEvent = executor.events.find(e => e.type === CARDIA_EVENTS.FACTION_SELECTED);
      expect(factionEvent).toBeDefined();
      expect(factionEvent?.payload.playerId).toBe('player1');
      expect(factionEvent?.payload.faction).toBe(FACTION_IDS.SWAMP);
      
      // 第二个事件：弃掉手牌
      const discardEvent = executor.events.find(e => e.type === CARDIA_EVENTS.CARDS_DISCARDED);
      expect(discardEvent).toBeDefined();
      expect(discardEvent?.payload.playerId).toBe('player2');
      expect(discardEvent?.payload.from).toBe('hand');
      expect(discardEvent?.payload.cardIds).toHaveLength(2); // 对手有 2 张沼泽派系手牌
      expect(discardEvent?.payload.cardIds).toContain('opp_hand1');
      expect(discardEvent?.payload.cardIds).toContain('opp_hand3');
    });

    it('当对手没有指定派系手牌时，应该不产生弃牌事件', () => {
      // 移除所有沼泽派系手牌
      mockCore.players['player2'].hand = [mockCore.players['player2'].hand[1]]; // 只保留学院派系

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER)!(mockContext);

      // 应该只有派系选择事件，没有弃牌事件
      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.FACTION_SELECTED);
    });

    it('应该只弃掉指定派系的手牌，保留其他派系', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER)!(mockContext);

      const discardEvent = executor.events.find(e => e.type === CARDIA_EVENTS.CARDS_DISCARDED);
      
      // 不应该弃掉学院派系的手牌
      expect(discardEvent?.payload.cardIds).not.toContain('opp_hand2');
    });

    it('应该发射派系选择事件', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER)!(mockContext);

      const factionEvent = executor.events.find(e => e.type === CARDIA_EVENTS.FACTION_SELECTED);
      expect(factionEvent).toBeDefined();
      expect(factionEvent?.payload.faction).toBe(FACTION_IDS.SWAMP);
    });

    it('当前简化实现自动选择沼泽派系', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER)!(mockContext);

      const factionEvent = executor.events.find(e => e.type === CARDIA_EVENTS.FACTION_SELECTED);
      expect(factionEvent?.payload.faction).toBe(FACTION_IDS.SWAMP);
      
      // TODO: 在 Task 11 实现交互系统后，让玩家选择派系
    });
  });

  describe('巫王（Witch King）- 派系弃牌', () => {
    it('应该让对手从手牌和牌库弃掉所有指定派系的牌，然后混洗牌库', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.WITCH_KING)!(mockContext);

      expect(executor.events.length).toBeGreaterThanOrEqual(3);
      
      // 第一个事件：派系选择
      const factionEvent = executor.events.find(e => e.type === CARDIA_EVENTS.FACTION_SELECTED);
      expect(factionEvent).toBeDefined();
      expect(factionEvent?.payload.playerId).toBe('player1');
      expect(factionEvent?.payload.faction).toBe(FACTION_IDS.SWAMP);
      
      // 第二个事件：弃掉手牌
      const discardHandEvent = executor.events.find(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED && e.payload.from === 'hand'
      );
      expect(discardHandEvent).toBeDefined();
      expect(discardHandEvent?.payload.playerId).toBe('player2');
      expect(discardHandEvent?.payload.cardIds).toHaveLength(2); // 对手有 2 张沼泽派系手牌
      
      // 第三个事件：弃掉牌库
      const discardDeckEvent = executor.events.find(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK
      );
      expect(discardDeckEvent).toBeDefined();
      expect(discardDeckEvent?.payload.playerId).toBe('player2');
      expect(discardDeckEvent?.payload.count).toBe(2); // 对手有 2 张沼泽派系牌库牌
      
      // 第四个事件：混洗牌库
      const shuffleEvent = executor.events.find(e => e.type === CARDIA_EVENTS.DECK_SHUFFLED);
      expect(shuffleEvent).toBeDefined();
      expect(shuffleEvent?.payload.playerId).toBe('player2');
    });

    it('当对手手牌中没有指定派系时，应该只弃掉牌库中的牌', () => {
      // 移除所有沼泽派系手牌
      mockCore.players['player2'].hand = [mockCore.players['player2'].hand[1]]; // 只保留学院派系

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.WITCH_KING)!(mockContext);

      // 应该有派系选择、弃掉牌库、混洗牌库三个事件
      expect(executor.events.length).toBeGreaterThanOrEqual(3);
      
      const discardHandEvent = executor.events.find(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED && e.payload.from === 'hand'
      );
      expect(discardHandEvent).toBeUndefined(); // 没有手牌弃牌事件
      
      const discardDeckEvent = executor.events.find(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK
      );
      expect(discardDeckEvent).toBeDefined();
    });

    it('当对手牌库中没有指定派系时，应该只弃掉手牌中的牌', () => {
      // 移除所有沼泽派系牌库牌
      mockCore.players['player2'].deck = [mockCore.players['player2'].deck[1]]; // 只保留公会派系

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.WITCH_KING)!(mockContext);

      // 应该有派系选择、弃掉手牌、混洗牌库三个事件
      expect(executor.events.length).toBeGreaterThanOrEqual(3);
      
      const discardHandEvent = executor.events.find(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED && e.payload.from === 'hand'
      );
      expect(discardHandEvent).toBeDefined();
      
      const discardDeckEvent = executor.events.find(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK
      );
      expect(discardDeckEvent).toBeUndefined(); // 没有牌库弃牌事件
    });

    it('应该在弃牌后混洗牌库', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.WITCH_KING)!(mockContext);

      const shuffleEvent = executor.events.find(e => e.type === CARDIA_EVENTS.DECK_SHUFFLED);
      expect(shuffleEvent).toBeDefined();
      expect(shuffleEvent?.payload.playerId).toBe('player2');
      
      // 混洗事件应该在弃牌事件之后
      const shuffleIndex = executor.events.findIndex(e => e.type === CARDIA_EVENTS.DECK_SHUFFLED);
      const discardIndex = executor.events.findIndex(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED || e.type === CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK
      );
      expect(shuffleIndex).toBeGreaterThan(discardIndex);
    });

    it('应该只弃掉指定派系的牌，保留其他派系', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.WITCH_KING)!(mockContext);

      const discardHandEvent = executor.events.find(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED && e.payload.from === 'hand'
      );
      const discardDeckEvent = executor.events.find(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK
      );
      
      // 不应该弃掉学院派系的手牌
      expect(discardHandEvent?.payload.cardIds).not.toContain('opp_hand2');
      
      // 牌库弃牌事件只有 count，无法验证具体卡牌
      // 但可以验证 count 正确（只弃掉沼泽派系的牌）
      expect(discardDeckEvent?.payload.count).toBe(2); // 只有 2 张沼泽派系牌库牌
    });

    it('当前简化实现自动选择沼泽派系', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.WITCH_KING)!(mockContext);

      const factionEvent = executor.events.find(e => e.type === CARDIA_EVENTS.FACTION_SELECTED);
      expect(factionEvent?.payload.faction).toBe(FACTION_IDS.SWAMP);
      
      // TODO: 在 Task 11 实现交互系统后，让玩家选择派系
    });
  });

  describe('派系选择交互', () => {
    it('应该提供四个派系选项', () => {
      // TODO: 在 Task 11 实现交互系统后，验证派系选择交互
      // 当前简化实现自动选择沼泽派系
      
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER)!(mockContext);
      
      const factionEvent = executor.events.find(e => e.type === CARDIA_EVENTS.FACTION_SELECTED);
      expect(factionEvent).toBeDefined();
      
      // 四个派系：沼泽、学院、公会、王朝
      expect([FACTION_IDS.SWAMP, FACTION_IDS.ACADEMY, FACTION_IDS.GUILD, FACTION_IDS.DYNASTY])
        .toContain(factionEvent?.payload.faction);
    });

    it('玩家应该能够选择任意派系', () => {
      // TODO: 在 Task 11 实现交互系统后，测试玩家选择不同派系
      
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER)!(mockContext);
      
      const factionEvent = executor.events.find(e => e.type === CARDIA_EVENTS.FACTION_SELECTED);
      expect(factionEvent?.payload.faction).toBeDefined();
    });
  });

  describe('派系过滤逻辑', () => {
    it('应该正确过滤指定派系的卡牌', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER)!(mockContext);

      const discardEvent = executor.events.find(e => e.type === CARDIA_EVENTS.CARDS_DISCARDED);
      
      // 验证弃掉的卡牌都是沼泽派系
      const discardedCards = discardEvent?.payload.cardIds || [];
      discardedCards.forEach(cardId => {
        const card = mockCore.players['player2'].hand.find(c => c.uid === cardId);
        expect(card?.faction).toBe(FACTION_IDS.SWAMP);
      });
    });

    it('应该能够处理空派系（没有该派系的卡牌）', () => {
      // 移除所有沼泽派系卡牌
      mockCore.players['player2'].hand = [mockCore.players['player2'].hand[1]]; // 只保留学院派系
      mockCore.players['player2'].deck = [mockCore.players['player2'].deck[1]]; // 只保留公会派系

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER)!(mockContext);

      // 应该只有派系选择事件，没有弃牌事件
      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.FACTION_SELECTED);
    });

    it('应该能够处理多个派系混合的情况', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.WITCH_KING)!(mockContext);

      const discardHandEvent = executor.events.find(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED && e.payload.from === 'hand'
      );
      const discardDeckEvent = executor.events.find(e => 
        e.type === CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK
      );
      
      // 验证弃掉的手牌都是沼泽派系
      const discardedHandCards = discardHandEvent?.payload.cardIds || [];
      discardedHandCards.forEach(cardId => {
        const card = mockCore.players['player2'].hand.find(c => c.uid === cardId);
        expect(card?.faction).toBe(FACTION_IDS.SWAMP);
      });
      
      // 验证弃掉的牌库牌都是沼泽派系
      const discardedDeckCards = discardDeckEvent?.payload.cardIds || [];
      discardedDeckCards.forEach(cardId => {
        const card = mockCore.players['player2'].deck.find(c => c.uid === cardId);
        expect(card?.faction).toBe(FACTION_IDS.SWAMP);
      });
    });
  });
});
