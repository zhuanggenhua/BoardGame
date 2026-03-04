/**
 * 组 2：影响力修正能力单元测试
 * 
 * 测试范围：
 * - 外科医生（Surgeon）
 * - 税务官（Tax Collector）
 * - 天才（Genius）
 * - 使者（Messenger）
 * - 发明家（Inventor）
 * - 钟表匠（Clockmaker）
 * - 宫廷卫士（Court Guard）
 * - 毒师（Poisoner）
 * - 图书管理员（Librarian）
 * - 工程师（Engineer）
 * - 念动力法师（Telekinetic Mage）
 * - 雇佣剑士（Mercenary Swordsman）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { CardiaCore, PlayedCard } from '../domain/core-types';
import { abilityExecutorRegistry, initializeAbilityExecutors } from '../domain/abilityExecutor';
import { ABILITY_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaAbilityContext } from '../domain/abilityExecutor';

// 初始化所有能力执行器
beforeAll(async () => {
  await initializeAbilityExecutors();
});

describe('组 2：影响力修正能力', () => {
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
      modifiers: { modifiers: [] },
      tags: { tags: {} },
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
      modifiers: { modifiers: [] },
      tags: { tags: {} },
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
      modifiers: { modifiers: [] },
      tags: { tags: {} },
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 0,
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
          tags: { tags: {} },
          hasPlayed: false,
          cardRevealed: false,
        },
        'player2': {
          id: 'player2',
          name: 'Player 2',
          hand: [],
          deck: [],
          discard: [],
          playedCards: [opponentPlayedCard1],
          signets: 0,
          tags: { tags: {} },
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
      cardId: 'played1',
      playerId: 'player1',
      opponentId: 'player2',
      timestamp: Date.now(),
      random: () => 0.5,
    };
  });

  describe('外科医生（Surgeon）', () => {
    it('应该注册延迟效果，为下一张打出的牌添加 -5 影响力', () => {
      // 设置正确的 abilityId
      mockContext.abilityId = ABILITY_IDS.SURGEON;
      
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SURGEON);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED);
      expect(result.events[0].payload.effectType).toBe('modifyInfluence');
      expect(result.events[0].payload.target).toBe('self');
      expect(result.events[0].payload.value).toBe(-5);
      expect(result.events[0].payload.condition).toBe('onNextCardPlayed');
      expect(result.events[0].payload.sourceAbilityId).toBe(ABILITY_IDS.SURGEON);
      expect(result.events[0].payload.sourcePlayerId).toBe('player1');
    });
  });

  describe('税务官（Tax Collector）', () => {
    it('应该为本牌添加 +4 修正标记', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.TAX_COLLECTOR);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.MODIFIER_TOKEN_PLACED);
      expect(result.events[0].payload.cardId).toBe('played1');
      expect(result.events[0].payload.value).toBe(4);
    });
  });

  describe('天才（Genius）', () => {
    it('应该为己方一张影响力≤8的打出的牌添加 +3 修正标记', () => {
      mockContext.selectedCardId = 'played1';

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.GENIUS);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.MODIFIER_TOKEN_PLACED);
      expect(result.events[0].payload.cardId).toBe('played1');
      expect(result.events[0].payload.value).toBe(3);
    });

    it('未选择卡牌时，应该创建卡牌选择交互（过滤影响力≤8）', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.GENIUS);
      const result = executor!(mockContext);

      expect(result.interaction).toBeDefined();
      expect(result.interaction?.type).toBe('card_selection');
      if (result.interaction?.type === 'card_selection') {
        expect(result.interaction.filter?.maxInfluence).toBe(8);
      }
    });
  });

  describe('使者（Messenger）', () => {
    it('应该为任一张场上牌添加 -3 修正标记', () => {
      mockContext.selectedCardId = 'opp_played1';

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MESSENGER);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.MODIFIER_TOKEN_PLACED);
      expect(result.events[0].payload.cardId).toBe('opp_played1');
      expect(result.events[0].payload.value).toBe(-3);
    });

    it('选择"下一张牌"选项时，应该注册延迟效果', () => {
      mockContext.selectedOption = 'next_card';

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MESSENGER);
      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED);
      expect(result.events[0].payload.value).toBe(-3);
    });

    it('未选择时，应该创建卡牌选择交互（包含"下一张牌"选项）', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MESSENGER);
      const result = executor!(mockContext);

      expect(result.interaction).toBeDefined();
      expect(result.interaction?.type).toBe('card_selection');
    });
  });

  describe('发明家（Inventor）', () => {
    it('应该为己方两张打出的牌添加修正标记（第一张+3，第二张-3）', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.INVENTOR);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.MODIFIER_TOKEN_PLACED);
      expect(result.events[0].payload.value).toBe(3);
      expect(result.events[1].type).toBe(CARDIA_EVENTS.MODIFIER_TOKEN_PLACED);
      expect(result.events[1].payload.value).toBe(-3);
    });

    it('当己方只有 1 张场上卡牌时，应该只添加 +3 修正标记', () => {
      mockCore.players['player1'].playedCards = [mockCore.players['player1'].playedCards[0]];

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.INVENTOR);
      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].payload.value).toBe(3);
    });
  });

  describe('钟表匠（Clockmaker）', () => {
    it('应该为上一个遭遇的牌添加 +3 修正标记，并为下一张打出的牌注册延迟效果', () => {
      mockContext.cardId = 'played2'; // 当前卡牌是第二张（encounterIndex = 1）

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.CLOCKMAKER);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events.length).toBeGreaterThanOrEqual(2);
      
      const modifierEvent = result.events.find(e => e.type === CARDIA_EVENTS.MODIFIER_TOKEN_PLACED);
      expect(modifierEvent).toBeDefined();
      expect(modifierEvent?.payload.cardId).toBe('played1'); // 上一张牌
      expect(modifierEvent?.payload.value).toBe(3);

      const delayedEvent = result.events.find(e => e.type === CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED);
      expect(delayedEvent).toBeDefined();
      expect(delayedEvent?.payload.value).toBe(3);
    });

    it('当是第一张牌时，应该只注册延迟效果', () => {
      mockContext.cardId = 'played1'; // 第一张牌（encounterIndex = 0）

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.CLOCKMAKER);
      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED);
    });
  });

  describe('宫廷卫士（Court Guard）', () => {
    it('当对手有指定派系手牌时，应该弃掉该手牌', () => {
      mockCore.players['player2'].hand = [
        { uid: 'p2card1', defId: 'test_card', ownerId: 'player2', baseInfluence: 5, faction: 'swamp', abilityIds: [], difficulty: 1, modifiers: { modifiers: [] }, tags: { tags: {} }, signets: 0, ongoingMarkers: [] },
      ];
      mockContext.selectedFaction = 'swamp';

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.COURT_GUARD);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED);
    });

    it('当对手没有指定派系手牌时，应该为本牌添加 +7 修正标记', () => {
      mockCore.players['player2'].hand = [];
      mockContext.selectedFaction = 'swamp';

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.COURT_GUARD);
      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.MODIFIER_TOKEN_PLACED);
      expect(result.events[0].payload.value).toBe(7);
    });
  });

  describe('毒师（Poisoner）', () => {
    it('应该降低相对的牌的影响力直到当前遭遇为平局', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.POISONER);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.MODIFIER_TOKEN_PLACED);
      expect(result.events[0].payload.cardId).toBe('opp_played1');
      // 对手影响力 7，己方影响力 5，需要降低 2
      expect(result.events[0].payload.value).toBe(-2);
    });

    it('当己方已经获胜时，应该不产生事件', () => {
      mockCore.players['player1'].playedCards[0].baseInfluence = 10;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.POISONER);
      const result = executor!(mockContext);

      expect(result.events).toHaveLength(0);
    });
  });

  describe('图书管理员（Librarian）', () => {
    it('选择修正值后，应该注册延迟效果', () => {
      mockContext.selectedModifierValue = 2;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.LIBRARIAN);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED);
      expect(result.events[0].payload.value).toBe(2);
    });

    it('未选择修正值时，应该创建修正标记选择交互', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.LIBRARIAN);
      const result = executor!(mockContext);

      expect(result.interaction).toBeDefined();
      expect(result.interaction?.type).toBe('modifier_selection');
      if (result.interaction?.type === 'modifier_selection') {
        expect(result.interaction.availableModifiers).toContain(2);
        expect(result.interaction.availableModifiers).toContain(-2);
      }
    });
  });

  describe('工程师（Engineer）', () => {
    it('应该注册延迟效果，为下次遭遇的牌添加 +5 修正标记', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ENGINEER);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED);
      expect(result.events[0].payload.value).toBe(5);
      expect(result.events[0].payload.condition).toBe('onNextEncounterAfterAbility');
    });
  });

  describe('念动力法师（Telekinetic Mage）', () => {
    it('应该移动所有修正标记和持续标记到另一张牌', () => {
      // 添加修正标记到第一张牌
      mockCore.modifierTokens = [
        { cardId: 'played1', value: 3, source: 'test_source', timestamp: Date.now() },
      ];
      // 添加持续标记到第一张牌
      mockCore.ongoingAbilities = [
        { abilityId: 'test_ability', cardId: 'played1', playerId: 'player1', effectType: 'test', timestamp: Date.now() },
      ];

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.TELEKINETIC_MAGE);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      // 应该有 4 个事件：移除修正标记、放置修正标记、移除持续标记、放置持续标记
      expect(result.events.length).toBeGreaterThanOrEqual(4);
      
      const removeModifierEvent = result.events.find(e => e.type === CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED);
      expect(removeModifierEvent).toBeDefined();

      const placeModifierEvent = result.events.find(e => e.type === CARDIA_EVENTS.MODIFIER_TOKEN_PLACED);
      expect(placeModifierEvent).toBeDefined();

      const removeOngoingEvent = result.events.find(e => e.type === CARDIA_EVENTS.ONGOING_ABILITY_REMOVED);
      expect(removeOngoingEvent).toBeDefined();

      const placeOngoingEvent = result.events.find(e => e.type === CARDIA_EVENTS.ONGOING_ABILITY_PLACED);
      expect(placeOngoingEvent).toBeDefined();
    });

    it('当没有修正标记或持续标记时，应该不产生事件', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.TELEKINETIC_MAGE);
      const result = executor!(mockContext);

      expect(result.events).toHaveLength(0);
    });
  });

  describe('雇佣剑士（Mercenary Swordsman）', () => {
    it('应该弃掉本牌和相对的牌', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MERCENARY_SWORDSMAN);
      expect(executor).toBeDefined();

      const result = executor!(mockContext);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED);
      expect(result.events[0].payload.cardIds).toContain('played1');
      expect(result.events[1].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED);
      expect(result.events[1].payload.cardIds).toContain('opp_played1');
    });

    it('当没有相对的牌时，应该只弃掉本牌', () => {
      mockCore.players['player2'].playedCards = [];

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.MERCENARY_SWORDSMAN);
      const result = executor!(mockContext);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].payload.cardIds).toContain('played1');
    });
  });
});
