/**
 * 女导师能力复制逻辑单元测试
 * 
 * 专注测试能力复制的核心逻辑:
 * 1. 第一次调用返回交互
 * 2. 第二次调用（带 selectedCardId）执行被复制的能力
 * 3. 被复制能力的交互正确传递
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

describe('女导师能力复制逻辑', () => {
  let mockCore: CardiaCore;
  let mockContext: CardiaAbilityContext;

  beforeEach(() => {
    // 创建一个简单的测试场景
    const inventorCard: PlayedCard = {
      uid: 'inventor_card',
      defId: 'deck_i_card_15',
      ownerId: 'player1',
      baseInfluence: 15,
      faction: 'academy',
      abilityIds: [ABILITY_IDS.INVENTOR], // 发明家能力
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 0,
    };

    const governessCard: PlayedCard = {
      uid: 'governess_card',
      defId: 'deck_i_card_14',
      ownerId: 'player1',
      baseInfluence: 14,
      faction: 'academy',
      abilityIds: [ABILITY_IDS.GOVERNESS], // 女导师能力
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 1,
    };

    const targetCard1: PlayedCard = {
      uid: 'target_card_1',
      defId: 'deck_i_card_13',
      ownerId: 'player1',
      baseInfluence: 13,
      faction: 'swamp',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 2,
    };

    const targetCard2: PlayedCard = {
      uid: 'target_card_2',
      defId: 'deck_i_card_12',
      ownerId: 'player1',
      baseInfluence: 12,
      faction: 'dynasty',
      abilityIds: [],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 3,
    };

    mockCore = {
      players: {
        'player1': {
          id: 'player1',
          name: 'Player 1',
          hand: [],
          deck: [],
          discard: [],
          playedCards: [inventorCard, governessCard, targetCard1, targetCard2],
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
      deckVariant: 'deck_i',
      targetSignets: 5,
    };

    mockContext = {
      core: mockCore,
      abilityId: ABILITY_IDS.GOVERNESS,
      cardId: 'governess_card',
      sourceId: 'governess_card',
      playerId: 'player1',
      ownerId: 'player1',
      opponentId: 'player2',
      timestamp: Date.now(),
      random: () => 0.5,
    };
  });

  it('步骤1: 女导师第一次调用应该返回交互', () => {
    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.GOVERNESS)!;
    const result = executor(mockContext);

    console.log('[Test] 第一次调用结果:', {
      hasInteraction: !!result.interaction,
      interactionType: (result.interaction as any)?.type,
      availableCards: (result.interaction as any)?.availableCards,
      eventsCount: result.events.length,
    });

    // 验证返回交互
    expect(result.interaction).toBeDefined();
    expect((result.interaction as any).type).toBe('card_selection');
    expect((result.interaction as any).availableCards).toContain('inventor_card');
    expect((result.interaction as any).cardId).toBe('governess_card'); // ✅ 验证 cardId 已保存
    expect(result.events).toHaveLength(0);
  });

  it('步骤2: 女导师第二次调用（选择发明家）应该返回发明家的交互', () => {
    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.GOVERNESS)!;
    
    // 第二次调用，传入 selectedCardId
    const contextWithSelection = {
      ...mockContext,
      selectedCardId: 'inventor_card',
    };
    
    const result = executor(contextWithSelection);

    console.log('[Test] 第二次调用结果:', {
      eventsCount: result.events.length,
      eventTypes: result.events.map(e => e.type),
      hasInteraction: !!result.interaction,
      interactionType: (result.interaction as any)?.type,
      interactionTitle: (result.interaction as any)?.title,
    });

    // 验证事件
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].type).toBe(CARDIA_EVENTS.ABILITY_COPIED);
    expect((result.events[0].payload as any).sourceAbilityId).toBe(ABILITY_IDS.INVENTOR);

    // ✅ 关键验证：发明家的交互应该被返回
    expect(result.interaction).toBeDefined();
    expect((result.interaction as any).type).toBe('card_selection');
    expect((result.interaction as any).title).toContain('选择'); // 发明家的交互标题
  });

  it('步骤3: 验证发明家能力本身返回交互', () => {
    // 直接调用发明家能力，验证它确实返回交互
    const inventorExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.INVENTOR)!;
    
    const inventorContext: CardiaAbilityContext = {
      core: mockCore,
      abilityId: ABILITY_IDS.INVENTOR,
      cardId: 'inventor_card',
      sourceId: 'inventor_card',
      playerId: 'player1',
      ownerId: 'player1',
      opponentId: 'player2',
      timestamp: Date.now(),
      random: () => 0.5,
    };

    const result = inventorExecutor(inventorContext);

    console.log('[Test] 发明家能力直接调用结果:', {
      hasInteraction: !!result.interaction,
      interactionType: (result.interaction as any)?.type,
      availableCards: (result.interaction as any)?.availableCards,
      eventsCount: result.events.length,
    });

    // 验证发明家返回交互
    expect(result.interaction).toBeDefined();
    expect((result.interaction as any).type).toBe('card_selection');
    expect(result.events).toHaveLength(0); // 第一次调用不产生事件
  });

  it('步骤4: 完整流程 - 女导师复制发明家的两次交互', () => {
    const governessExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.GOVERNESS)!;
    const inventorExecutor = abilityExecutorRegistry.resolve(ABILITY_IDS.INVENTOR)!;

    // 1. 女导师第一次调用
    const step1 = governessExecutor(mockContext);
    expect(step1.interaction).toBeDefined();
    console.log('[Test] 步骤1: 女导师返回交互 ✓');

    // 2. 女导师第二次调用（选择发明家）
    const step2 = governessExecutor({
      ...mockContext,
      selectedCardId: 'inventor_card',
    });
    expect(step2.interaction).toBeDefined();
    console.log('[Test] 步骤2: 女导师返回发明家的第一次交互 ✓');

    // 3. 发明家第一次交互（选择+3目标）
    const step3 = inventorExecutor({
      core: mockCore,
      abilityId: ABILITY_IDS.INVENTOR,
      cardId: 'governess_card', // 注意：这里应该是女导师的 cardId
      sourceId: 'governess_card',
      playerId: 'player1',
      ownerId: 'player1',
      opponentId: 'player2',
      timestamp: Date.now(),
      random: () => 0.5,
      selectedCardId: 'target_card_1',
    });
    
    console.log('[Test] 步骤3: 发明家第一次选择结果:', {
      eventsCount: step3.events.length,
      hasInteraction: !!step3.interaction,
      hasPending: !!(mockCore as any).inventorPending,
    });

    // 验证发明家返回交互（第一次选择不产生事件）
    expect(step3.events.length).toBe(0); // 第一次选择不产生事件
    expect(step3.interaction).toBeDefined(); // 但应该返回第二次交互
  });

  it('边界情况: 女导师复制没有交互的能力（破坏者）', () => {
    // 添加破坏者卡牌（没有交互的能力）
    const saboteurCard: PlayedCard = {
      uid: 'saboteur_card',
      defId: 'deck_i_card_05',
      ownerId: 'player1',
      baseInfluence: 15,
      faction: 'swamp',
      abilityIds: [ABILITY_IDS.SABOTEUR],
      difficulty: 1,
      modifiers: createModifierStack(),
      tags: createTagContainer(),
      signets: 0,
      ongoingMarkers: [],
      encounterIndex: 0,
    };

    mockCore.players['player1'].playedCards.unshift(saboteurCard);

    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.GOVERNESS)!;
    
    // 选择破坏者
    const result = executor({
      ...mockContext,
      selectedCardId: 'saboteur_card',
    });

    console.log('[Test] 复制破坏者结果:', {
      eventsCount: result.events.length,
      eventTypes: result.events.map(e => e.type),
      hasInteraction: !!result.interaction,
    });

    // 验证：破坏者不返回交互
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].type).toBe(CARDIA_EVENTS.ABILITY_COPIED);
    expect(result.interaction).toBeUndefined(); // 破坏者没有交互
  });
});
