/**
 * 继承者（Heir）能力单元测试
 */

import { describe, it, expect } from 'vitest';
import { abilityExecutorRegistry } from '../domain/abilityExecutor';
import { ABILITY_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import { createMockCore, createMockContext, createMockCard } from './test-helpers';

// 导入能力文件
import '../domain/abilities/group1-resources';

describe('继承者（Heir）', () => {
  it('当对手手牌 > 2 张时，应该随机保留 2 张手牌，弃掉其余手牌和整个牌库', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].hand = [
      createMockCard({ uid: 'card1', defId: 'test1', ownerId: 'player2', baseInfluence: 7, faction: 'swamp' }),
      createMockCard({ uid: 'card2', defId: 'test2', ownerId: 'player2', baseInfluence: 2, faction: 'academy' }),
      createMockCard({ uid: 'card3', defId: 'test3', ownerId: 'player2', baseInfluence: 8, faction: 'guild' }),
      createMockCard({ uid: 'card4', defId: 'test4', ownerId: 'player2', baseInfluence: 5, faction: 'dynasty' }),
    ];
    mockCore.players['player2'].deck = [
      createMockCard({ uid: 'deck1', defId: 'test5', ownerId: 'player2', baseInfluence: 4, faction: 'swamp' }),
      createMockCard({ uid: 'deck2', defId: 'test6', ownerId: 'player2', baseInfluence: 6, faction: 'academy' }),
    ];
    const mockContext = createMockContext({ core: mockCore });
    
    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.HEIR);
    expect(executor).toBeDefined();

    const result = executor!(mockContext);

    expect(result.events).toHaveLength(2);
    
    // 第一个事件：弃掉未保留的手牌（应该弃掉 2 张）
    expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED);
    expect((result.events[0].payload as any).playerId).toBe('player2');
    expect((result.events[0].payload as any).cardIds).toHaveLength(2);
    expect((result.events[0].payload as any).from).toBe('hand');

    // 第二个事件：弃掉整个牌库
    expect(result.events[1].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK);
    expect((result.events[1].payload as any).playerId).toBe('player2');
    expect((result.events[1].payload as any).count).toBe(2);
  });

  it('当对手手牌 = 2 张时，应该只弃掉整个牌库', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].hand = [
      createMockCard({ uid: 'card1', defId: 'test1', ownerId: 'player2', baseInfluence: 7, faction: 'swamp' }),
      createMockCard({ uid: 'card2', defId: 'test2', ownerId: 'player2', baseInfluence: 2, faction: 'academy' }),
    ];
    mockCore.players['player2'].deck = [
      createMockCard({ uid: 'deck1', defId: 'test3', ownerId: 'player2', baseInfluence: 4, faction: 'swamp' }),
      createMockCard({ uid: 'deck2', defId: 'test4', ownerId: 'player2', baseInfluence: 6, faction: 'academy' }),
    ];
    const mockContext = createMockContext({ core: mockCore });

    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.HEIR);
    const result = executor!(mockContext);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK);
    expect((result.events[0].payload as any).playerId).toBe('player2');
    expect((result.events[0].payload as any).count).toBe(2);
  });

  it('当对手手牌 < 2 张时，应该只弃掉整个牌库', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].hand = [
      createMockCard({ uid: 'card1', defId: 'test1', ownerId: 'player2', baseInfluence: 7, faction: 'swamp' }),
    ];
    mockCore.players['player2'].deck = [
      createMockCard({ uid: 'deck1', defId: 'test2', ownerId: 'player2', baseInfluence: 4, faction: 'swamp' }),
      createMockCard({ uid: 'deck2', defId: 'test3', ownerId: 'player2', baseInfluence: 6, faction: 'academy' }),
      createMockCard({ uid: 'deck3', defId: 'test4', ownerId: 'player2', baseInfluence: 3, faction: 'guild' }),
    ];
    const mockContext = createMockContext({ core: mockCore });

    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.HEIR);
    const result = executor!(mockContext);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK);
    expect((result.events[0].payload as any).playerId).toBe('player2');
    expect((result.events[0].payload as any).count).toBe(3);
  });
});
