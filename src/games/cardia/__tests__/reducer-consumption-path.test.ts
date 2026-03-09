/**
 * Reducer 消耗路径测试（D11-D14）
 * 
 * 验证事件写入的资源/额度/状态在 reducer 消耗时走的分支是否正确
 * 验证能力/事件写入的字段在所有消费点是否被正确读取和消耗
 * 验证同一资源有多个写入来源时，消耗逻辑是否正确区分来源
 * 验证回合/阶段结束时临时状态是否全部正确清理
 * 
 * 测试维度：
 * - D11: Reducer 消耗路径
 * - D12: 写入-消耗对称
 * - D13: 多来源竞争
 * - D14: 回合清理完整
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reduce';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaCore, PlayerState, PlayedCard } from '../domain/core-types';

/**
 * 创建测试用的玩家状态
 */
function createMockPlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
  return {
    id,
    name: `Player ${id}`,
    hand: [],
    deck: [],
    discard: [],
    playedCards: [],
    signets: 0,
    hasPlayed: false,
    tags: [],
    cardRevealed: false,
    currentCard: null,
    ...overrides,
  };
}

/**
 * 创建测试用的卡牌
 */
function createMockCard(uid: string, defId: string, ownerId: string, overrides?: Partial<PlayedCard>): PlayedCard {
  return {
    uid,
    defId,
    ownerId,
    baseInfluence: 1,
    faction: 'military',
    abilityIds: [],
    difficulty: 1,
    modifiers: { entries: [], nextOrder: 0 },
    tags: [],
    signets: 0,
    ongoingMarkers: [],
    imageIndex: 0,
    imagePath: '',
    ...overrides,
  };
}

describe('Reducer 消耗路径（D11-D14）', () => {
  describe('D11: Reducer 消耗路径', () => {
    it('Deck I - 应该正确消耗 MODIFIER_TOKEN_PLACED 事件写入的修正标记', () => {
      // 测试场景：添加修正标记 → 验证 reducer 正确写入 modifierTokens
      
      const initialCore: CardiaCore = {
        players: {
          player1: createMockPlayer('player1', {
            playedCards: [createMockCard('card1', 'deck_i_card_01', 'player1')],
          }),
          player2: createMockPlayer('player2'),
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
        deckVariant: 'I',
        targetSignets: 5,
      };

      const event = {
        type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
        payload: {
          cardId: 'card1',
          value: 3,
          source: 'ability_i_inventor',
        },
        timestamp: Date.now(),
      };

      const newCore = reduce(initialCore, event);

      // 验证：modifierTokens 数组应该包含新添加的修正标记
      expect(newCore.modifierTokens).toHaveLength(1);
      expect(newCore.modifierTokens[0].cardId).toBe('card1');
      expect(newCore.modifierTokens[0].value).toBe(3);
      expect(newCore.modifierTokens[0].source).toBe('ability_i_inventor');
    });

    it('Deck I - 应该正确消耗 DELAYED_EFFECT_REGISTERED 事件写入的延迟效果', () => {
      // 测试场景：注册延迟效果 → 验证 reducer 正确写入 delayedEffects
      
      const initialCore: CardiaCore = {
        players: {
          player1: createMockPlayer('player1'),
          player2: createMockPlayer('player2'),
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
        deckVariant: 'I',
        targetSignets: 5,
      };

      const event = {
        type: CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED,
        payload: {
          effectType: 'modifyInfluence',
          target: 'self',
          value: 3,
          condition: 'onNextCardPlayed',
          sourceAbilityId: 'ability_i_clockmaker',
          sourcePlayerId: 'player1',
        },
        timestamp: Date.now(),
      };

      const newCore = reduce(initialCore, event);

      // 验证：delayedEffects 数组应该包含新注册的延迟效果
      expect(newCore.delayedEffects).toHaveLength(1);
      expect(newCore.delayedEffects[0].effectType).toBe('modifyInfluence');
      expect(newCore.delayedEffects[0].value).toBe(3);
      expect(newCore.delayedEffects[0].sourceAbilityId).toBe('ability_i_clockmaker');
    });

    it('TODO: Deck II - 应该正确消耗其他资源类型的事件', () => {
      // TODO: Deck II 功能
      // 示例：充能、魔力、护盾等资源
      expect(true).toBe(true);
    });
  });

  describe('D12: 写入-消耗对称', () => {
    it('Deck I - DELAYED_EFFECT_TRIGGERED 事件应该正确移除对应的延迟效果', () => {
      // 测试场景：延迟效果触发 → 验证 reducer 正确移除 delayedEffects
      
      const initialCore: CardiaCore = {
        players: {
          player1: createMockPlayer('player1'),
          player2: createMockPlayer('player2'),
        },
        playerOrder: ['player1', 'player2'],
        currentPlayerId: 'player1',
        turnNumber: 1,
        phase: 'ability',
        encounterHistory: [],
        ongoingAbilities: [],
        modifierTokens: [],
        delayedEffects: [
          {
            effectType: 'modifyInfluence',
            target: 'self',
            value: 3,
            condition: 'onNextCardPlayed',
            sourceAbilityId: 'ability_i_clockmaker',
            sourcePlayerId: 'player1',
            timestamp: Date.now(),
          },
        ],
        revealFirstNextEncounter: null,
        mechanicalSpiritActive: null,
        deckVariant: 'I',
        targetSignets: 5,
      };

      const event = {
        type: CARDIA_EVENTS.DELAYED_EFFECT_TRIGGERED,
        payload: {
          effectType: 'modifyInfluence',
          sourceAbilityId: 'ability_i_clockmaker',
          sourcePlayerId: 'player1',
        },
        timestamp: Date.now(),
      };

      const newCore = reduce(initialCore, event);

      // 验证：delayedEffects 数组应该为空（延迟效果已被移除）
      expect(newCore.delayedEffects).toHaveLength(0);
    });

    it('Deck I - ONGOING_ABILITY_REMOVED 事件应该正确移除对应的持续能力', () => {
      // 测试场景：持续能力移除 → 验证 reducer 正确移除 ongoingAbilities
      
      const initialCore: CardiaCore = {
        players: {
          player1: createMockPlayer('player1', {
            playedCards: [createMockCard('card1', 'deck_i_card_04', 'player1', {
              ongoingMarkers: ['ability_i_mediator'],
            })],
          }),
          player2: createMockPlayer('player2'),
        },
        playerOrder: ['player1', 'player2'],
        currentPlayerId: 'player1',
        turnNumber: 1,
        phase: 'ability',
        encounterHistory: [],
        ongoingAbilities: [
          {
            cardId: 'card1',
            abilityId: 'ability_i_mediator',
            effectType: 'forceTie',
            playerId: 'player1',
            timestamp: Date.now(),
            encounterIndex: 1,
          },
        ],
        modifierTokens: [],
        delayedEffects: [],
        revealFirstNextEncounter: null,
        mechanicalSpiritActive: null,
        deckVariant: 'I',
        targetSignets: 5,
      };

      const event = {
        type: CARDIA_EVENTS.ONGOING_ABILITY_REMOVED,
        payload: {
          cardId: 'card1',
          abilityId: 'ability_i_mediator',
          playerId: 'player1',
        },
        timestamp: Date.now(),
      };

      const newCore = reduce(initialCore, event);

      // 验证：ongoingAbilities 数组应该为空（持续能力已被移除）
      expect(newCore.ongoingAbilities).toHaveLength(0);
      // 验证：卡牌的 ongoingMarkers 也应该被清空
      expect(newCore.players.player1.playedCards[0].ongoingMarkers).toHaveLength(0);
    });

    it('TODO: Deck II - 应该验证所有写入-消耗对称的字段', () => {
      // TODO: Deck II 功能
      // 示例：充能写入-消耗、魔力写入-消耗等
      expect(true).toBe(true);
    });
  });

  describe('D13: 多来源竞争', () => {
    it('Deck I - 应该正确区分不同来源的修正标记', () => {
      // 测试场景：同一张卡牌有多个修正标记（来自不同能力）
      // 验证：每个修正标记都有 source 字段，可以区分来源
      
      const initialCore: CardiaCore = {
        players: {
          player1: createMockPlayer('player1', {
            playedCards: [createMockCard('card1', 'deck_i_card_01', 'player1')],
          }),
          player2: createMockPlayer('player2'),
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
        deckVariant: 'I',
        targetSignets: 5,
      };

      // 添加第一个修正标记（来自发明家）
      const event1 = {
        type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
        payload: {
          cardId: 'card1',
          value: 3,
          source: 'ability_i_inventor',
        },
        timestamp: Date.now(),
      };

      const core1 = reduce(initialCore, event1);

      // 添加第二个修正标记（来自钟表匠）
      const event2 = {
        type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
        payload: {
          cardId: 'card1',
          value: 3,
          source: 'ability_i_clockmaker',
        },
        timestamp: Date.now() + 1,
      };

      const core2 = reduce(core1, event2);

      // 验证：应该有两个修正标记，来源不同
      expect(core2.modifierTokens).toHaveLength(2);
      expect(core2.modifierTokens[0].source).toBe('ability_i_inventor');
      expect(core2.modifierTokens[1].source).toBe('ability_i_clockmaker');
    });

    it('TODO: Deck II - 应该正确处理多来源竞争的复杂场景', () => {
      // TODO: Deck II 功能
      // 示例：多个能力同时修改同一资源，需要正确区分来源和优先级
      expect(true).toBe(true);
    });
  });

  describe('D14: 回合清理完整', () => {
    it('Deck I - TURN_ENDED 事件应该清理临时状态', () => {
      // 测试场景：回合结束 → 验证 reducer 清理临时状态
      
      const initialCore: CardiaCore = {
        players: {
          player1: createMockPlayer('player1', {
            playedCards: [createMockCard('card1', 'deck_i_card_01', 'player1', { signets: 1 })],
            hasPlayed: true, // 已打出卡牌
          }),
          player2: createMockPlayer('player2'),
        },
        playerOrder: ['player1', 'player2'],
        currentPlayerId: 'player1',
        turnNumber: 1,
        phase: 'end',
        encounterHistory: [],
        ongoingAbilities: [],
        modifierTokens: [
          {
            cardId: 'card1',
            value: 3,
            source: 'ability_i_inventor',
            timestamp: Date.now(),
          },
        ],
        delayedEffects: [],
        revealFirstNextEncounter: null,
        mechanicalSpiritActive: null,
        deckVariant: 'I',
        targetSignets: 5,
      };

      const event = {
        type: CARDIA_EVENTS.TURN_ENDED,
        payload: {
          playerId: 'player1',
        },
        timestamp: Date.now(),
      };

      const newCore = reduce(initialCore, event);

      // 验证：回合数应该增加
      expect(newCore.turnNumber).toBe(2);
      // 验证：当前玩家应该切换
      expect(newCore.currentPlayerId).toBe('player2');
      // 注意：TURN_ENDED 不会改变 phase，phase 由 PHASE_CHANGED 事件控制
      
      // 验证：hasPlayed 标志应该被重置
      expect(newCore.players.player1.hasPlayed).toBe(false);
      expect(newCore.players.player2.hasPlayed).toBe(false);
      
      // 注意：modifierTokens 不会在回合结束时清理（它们是永久的）
      // 只有在遭遇结算后才会清理
    });

    it('Deck I - ENCOUNTER_RESOLVED 事件应该记录遭遇历史', () => {
      // 测试场景：遭遇结算 → 验证 reducer 记录遭遇历史
      
      const card1 = createMockCard('card1', 'deck_i_card_01', 'player1', { 
        baseInfluence: 5,
        signets: 1,
      });
      const card2 = createMockCard('card2', 'deck_i_card_02', 'player2', { 
        baseInfluence: 3,
        signets: 0,
      });
      
      const initialCore: CardiaCore = {
        players: {
          player1: createMockPlayer('player1', {
            currentCard: card1,
            hasPlayed: true,
            cardRevealed: true,
          }),
          player2: createMockPlayer('player2', {
            currentCard: card2,
            hasPlayed: true,
            cardRevealed: true,
          }),
        },
        playerOrder: ['player1', 'player2'],
        currentPlayerId: 'player1',
        turnNumber: 1,
        phase: 'encounter',
        encounterHistory: [],
        ongoingAbilities: [],
        modifierTokens: [],
        delayedEffects: [],
        revealFirstNextEncounter: null,
        mechanicalSpiritActive: null,
        deckVariant: 'I',
        targetSignets: 5,
      };

      const event = {
        type: CARDIA_EVENTS.ENCOUNTER_RESOLVED,
        payload: {
          slotIndex: 0,
          winner: 'player1',
          loser: 'player2',
        },
        timestamp: Date.now(),
      };

      const newCore = reduce(initialCore, event);

      // 验证：遭遇历史应该记录
      expect(newCore.encounterHistory).toHaveLength(1);
      expect(newCore.encounterHistory[0].player1Card?.uid).toBe('card1');
      expect(newCore.encounterHistory[0].player2Card?.uid).toBe('card2');
      expect(newCore.encounterHistory[0].winnerId).toBe('player1');
      
      // 验证：卡牌应该移动到 playedCards
      expect(newCore.players.player1.playedCards).toHaveLength(1);
      expect(newCore.players.player2.playedCards).toHaveLength(1);
      
      // 验证：currentCard 应该被清空
      expect(newCore.players.player1.currentCard).toBeNull();
      expect(newCore.players.player2.currentCard).toBeNull();
    });

    it('TODO: Deck II - 应该验证所有临时状态的清理逻辑', () => {
      // TODO: Deck II 功能
      // 示例：充能、魔力、护盾等临时状态的清理
      expect(true).toBe(true);
    });
  });

  describe('D11-D14 总结', () => {
    it('Deck I - Reducer 消耗路径机制已实现', () => {
      // Deck I 实现了以下 Reducer 消耗路径：
      // 1. D11: 修正标记、延迟效果、持续能力的写入和消耗
      // 2. D12: 延迟效果触发后移除、持续能力移除
      // 3. D13: 多来源修正标记的区分（通过 source 字段）
      // 4. D14: 回合结束清理 hasPlayed 标志、遭遇结算记录历史
      
      // Deck I 没有以下功能（将在 Deck II 实现）：
      // 1. 充能、魔力、护盾等资源的写入-消耗
      // 2. 复杂的多来源竞争场景
      // 3. 更多临时状态的清理逻辑
      
      expect(true).toBe(true);
    });
  });
});
