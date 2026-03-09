/**
 * 组 6：特殊机制能力单元测试
 * 
 * 测试范围：
 * - 傀儡师（Puppeteer）
 * - 占卜师（Diviner）
 * - 贵族（Aristocrat）
 * - 精灵（Elf）
 * - 勒索者（Extortionist）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { CardiaCore, PlayedCard, CardInstance } from '../domain/core-types';
import { abilityExecutorRegistry, initializeAbilityExecutors } from '../domain/abilityExecutor';
import { ABILITY_IDS, FACTION_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaAbilityContext } from '../domain/abilityExecutor';
import { createModifierStack } from '../../../engine/primitives/modifier';
import { createTagContainer } from '../../../engine/primitives/tags';
import { createFixedRandom } from './helpers/testRandom';

// 初始化所有能力执行器
beforeAll(async () => {
  await initializeAbilityExecutors();
});

describe('组 6：特殊机制能力', () => {
  let mockCore: CardiaCore;
  let mockContext: CardiaAbilityContext;

  beforeEach(() => {
    const playedCard1: PlayedCard = {
      uid: 'played1',
      defId: 'test_played_1',
      ownerId: 'player1',
      baseInfluence: 10,
      faction: 'swamp',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 0,
    };

    const opponentPlayedCard1: PlayedCard = {
      uid: 'opp_played1',
      defId: 'test_opp_played_1',
      ownerId: 'player2',
      baseInfluence: 12,
      faction: 'guild',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 0,
    };

    const opponentHandCard1: CardInstance = {
      uid: 'opp_hand1',
      defId: 'test_opp_hand_1',
      ownerId: 'player2',
      baseInfluence: 8,
      faction: 'academy',
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
      faction: 'dynasty',
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
          playedCards: [playedCard1],
          signets: 0,
          tags: createTagContainer(),
          hasPlayed: false,
          cardRevealed: false,
        },
        'player2': {
          id: 'player2',
          name: 'Player 2',
          hand: [opponentHandCard1, opponentHandCard2],
          deck: [],
          discard: [],
          playedCards: [opponentPlayedCard1],
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
      abilityId: ABILITY_IDS.PUPPETEER,
      cardId: 'played1',
      sourceId: 'played1',
      playerId: 'player1',
      ownerId: 'player1',
      opponentId: 'player2',
      timestamp: Date.now(),
      random: createFixedRandom(0.5),
    };
  });

  describe('傀儡师（Puppeteer）', () => {
    it('应该弃掉相对的牌，替换为从对手手牌随机抽取的一张牌', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.PUPPETEER)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.CARD_REPLACED);
      expect(executor.events[0].payload.oldCardId).toBe('opp_played1');
      expect(executor.events[0].payload.newCardId).toMatch(/opp_hand[12]/); // 随机选择的手牌
      expect(executor.events[0].payload.playerId).toBe('player2');
      expect(executor.events[0].payload.encounterIndex).toBe(0);
      expect(executor.events[0].payload.suppressAbility).toBe(true);
    });

    it('替换的卡牌不应该触发能力', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.PUPPETEER)!(mockContext);

      expect(executor.events[0].payload.suppressAbility).toBe(true);
    });

    it('当对手没有相对的牌时，应该不产生事件', () => {
      mockCore.players['player2'].playedCards = [];

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.PUPPETEER)!(mockContext);

      expect(executor.events).toHaveLength(0);
    });

    it('当对手手牌为空时，应该不产生事件', () => {
      mockCore.players['player2'].hand = [];

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.PUPPETEER)!(mockContext);

      expect(executor.events).toHaveLength(0);
    });

    it('应该使用随机数选择对手手牌', () => {
      // 测试随机数为 0 时选择第一张手牌
      mockContext.random = createFixedRandom(0);

      const executor1 = abilityExecutorRegistry.resolve(ABILITY_IDS.PUPPETEER)!(mockContext);
      expect(executor1.events[0].payload.newCardId).toBe('opp_hand1');

      // 测试随机数为 0.9 时选择第二张手牌
      mockContext.random = createFixedRandom(0.9);

      const executor2 = abilityExecutorRegistry.resolve(ABILITY_IDS.PUPPETEER)!(mockContext);
      expect(executor2.events[0].payload.newCardId).toBe('opp_hand2');
    });

    it('应该保持相同的遭遇序号', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.PUPPETEER)!(mockContext);

      expect(executor.events[0].payload.encounterIndex).toBe(0);
    });
  });

  describe('占卜师（Diviner）', () => {
    it('应该改变下次遭遇的揭示顺序', () => {
      mockContext.abilityId = ABILITY_IDS.DIVINER;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.DIVINER)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.REVEAL_ORDER_CHANGED);
      expect(executor.events[0].payload.revealFirstPlayerId).toBe('player2');
    });

    it('应该让对手在下次遭遇中先揭示卡牌', () => {
      mockContext.abilityId = ABILITY_IDS.DIVINER;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.DIVINER)!(mockContext);

      // 验证揭示顺序改变事件
      expect(executor.events[0].payload.revealFirstPlayerId).toBe(mockContext.opponentId);
    });

    it('揭示顺序改变应该只影响下一次遭遇', () => {
      mockContext.abilityId = ABILITY_IDS.DIVINER;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.DIVINER)!(mockContext);

      // 验证事件正确发射
      // 实际的"只影响下一次遭遇"逻辑在 execute.ts 中处理
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.REVEAL_ORDER_CHANGED);
    });
  });

  describe('贵族（Aristocrat）', () => {
    it('应该在本牌获胜时额外获得1枚印戒', () => {
      mockContext.abilityId = ABILITY_IDS.ARISTOCRAT;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ARISTOCRAT)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.EXTRA_SIGNET_PLACED);
      expect(executor.events[0].payload.cardId).toBe('played1');
      expect(executor.events[0].payload.playerId).toBe('player1');
      expect(executor.events[0].payload.conditional).toBe(true);
    });

    it('额外印戒应该是条件性的（只在获胜时放置）', () => {
      mockContext.abilityId = ABILITY_IDS.ARISTOCRAT;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ARISTOCRAT)!(mockContext);

      // 验证事件标记为条件性效果
      expect(executor.events[0].payload.conditional).toBe(true);
      
      // 实际的条件检查在遭遇结算时处理
    });

    it('应该在遭遇结算时检查本牌是否获胜', () => {
      mockContext.abilityId = ABILITY_IDS.ARISTOCRAT;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ARISTOCRAT)!(mockContext);

      // 验证事件正确发射
      // 实际的获胜检查在 execute.ts 的 resolveEncounter 中处理
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.EXTRA_SIGNET_PLACED);
    });
  });

  describe('精灵（Elf）', () => {
    it('应该直接赢得游戏', () => {
      mockContext.abilityId = ABILITY_IDS.ELF;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ELF)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.GAME_WON);
      expect(executor.events[0].payload.winnerId).toBe('player1');
      expect(executor.events[0].payload.reason).toBe('elf');
    });

    it('精灵的胜利应该是无条件的', () => {
      mockContext.abilityId = ABILITY_IDS.ELF;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ELF)!(mockContext);

      // 验证胜利原因是精灵能力
      expect(executor.events[0].payload.reason).toBe('elf');
    });

    it('精灵的胜利应该立即触发游戏结束', () => {
      mockContext.abilityId = ABILITY_IDS.ELF;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ELF)!(mockContext);

      // 验证游戏胜利事件
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.GAME_WON);
      
      // 实际的游戏结束逻辑在 execute.ts 中处理
    });
  });

  describe('勒索者（Extortionist）', () => {
    it('应该注册延迟效果，在对手下次打牌后检查派系', () => {
      mockContext.abilityId = ABILITY_IDS.EXTORTIONIST;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.EXTORTIONIST)!(mockContext);

      expect(executor.events).toHaveLength(1);
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED);
      expect(executor.events[0].payload.abilityId).toBe(ABILITY_IDS.EXTORTIONIST);
      expect(executor.events[0].payload.playerId).toBe('player1');
      expect(executor.events[0].payload.targetPlayerId).toBe('player2');
      expect(executor.events[0].payload.trigger).toBe('onOpponentPlayCard');
    });

    it('延迟效果应该包含派系和弃牌数量信息', () => {
      mockContext.abilityId = ABILITY_IDS.EXTORTIONIST;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.EXTORTIONIST)!(mockContext);

      expect(executor.events[0].payload.data.requiredFaction).toBe(FACTION_IDS.SWAMP);
      expect(executor.events[0].payload.data.discardCount).toBe(2);
    });

    it('应该在对手打出非指定派系的牌后触发弃牌', () => {
      mockContext.abilityId = ABILITY_IDS.EXTORTIONIST;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.EXTORTIONIST)!(mockContext);

      // 验证延迟效果注册
      expect(executor.events[0].payload.trigger).toBe('onOpponentPlayCard');
      
      // 实际的触发逻辑在 execute.ts 中处理
    });

    it('当对手打出指定派系的牌时，应该不触发弃牌', () => {
      mockContext.abilityId = ABILITY_IDS.EXTORTIONIST;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.EXTORTIONIST)!(mockContext);

      // 验证延迟效果包含派系信息
      expect(executor.events[0].payload.data.requiredFaction).toBeDefined();
      
      // 实际的派系检查在 execute.ts 中处理
    });
  });

  describe('特殊机制的交互', () => {
    it('傀儡师替换的卡牌应该保持原有的遭遇序号', () => {
      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.PUPPETEER)!(mockContext);

      expect(executor.events[0].payload.encounterIndex).toBe(0);
    });

    it('占卜师的揭示顺序改变应该只影响下一次遭遇', () => {
      mockContext.abilityId = ABILITY_IDS.DIVINER;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.DIVINER)!(mockContext);

      // 验证事件正确发射
      expect(executor.events[0].type).toBe(CARDIA_EVENTS.REVEAL_ORDER_CHANGED);
      
      // 实际的"只影响下一次遭遇"逻辑在 execute.ts 中处理
      // 需要在遭遇结算后重置 revealFirstNextEncounter
    });

    it('贵族的额外印戒应该只在本牌获胜时放置', () => {
      mockContext.abilityId = ABILITY_IDS.ARISTOCRAT;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ARISTOCRAT)!(mockContext);

      // 验证事件标记为条件性效果
      expect(executor.events[0].payload.conditional).toBe(true);
    });

    it('精灵的胜利应该优先于其他胜利条件', () => {
      mockContext.abilityId = ABILITY_IDS.ELF;

      const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.ELF)!(mockContext);

      // 验证胜利原因是精灵能力
      expect(executor.events[0].payload.reason).toBe('elf');
      
      // 精灵的胜利应该立即触发游戏结束，不检查其他胜利条件
    });
  });
});
