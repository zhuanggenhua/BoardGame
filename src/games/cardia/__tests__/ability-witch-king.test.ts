/**
 * 巫王（Witch King）能力单元测试
 */

import { describe, it, expect } from 'vitest';
import { abilityExecutorRegistry } from '../domain/abilityExecutor';
import { ABILITY_IDS, FACTION_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import { createMockCore, createMockContext, createMockCard } from './test-helpers';

// 导入能力文件
import '../domain/abilities/group7-faction';

describe('巫王（Witch King）', () => {
  it('应该让对手弃掉手牌和牌库中所有沼泽派系的卡牌，然后混洗牌库', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].hand = [
      createMockCard({ uid: 'hand1', defId: 'test1', ownerId: 'player2', baseInfluence: 7, faction: 'swamp' }),
      createMockCard({ uid: 'hand2', defId: 'test2', ownerId: 'player2', baseInfluence: 2, faction: 'academy' }),
      createMockCard({ uid: 'hand3', defId: 'test3', ownerId: 'player2', baseInfluence: 8, faction: 'swamp' }),
    ];
    mockCore.players['player2'].deck = [
      createMockCard({ uid: 'deck1', defId: 'test4', ownerId: 'player2', baseInfluence: 5, faction: 'swamp' }),
      createMockCard({ uid: 'deck2', defId: 'test5', ownerId: 'player2', baseInfluence: 3, faction: 'guild' }),
      createMockCard({ uid: 'deck3', defId: 'test6', ownerId: 'player2', baseInfluence: 4, faction: 'swamp' }),
    ];
    const mockContext = createMockContext({ core: mockCore });
    
    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.WITCH_KING);
    expect(executor).toBeDefined();

    const result = executor!(mockContext);

    expect(result.events).toHaveLength(4);
    
    // 第一个事件：派系选择
    expect(result.events[0].type).toBe(CARDIA_EVENTS.FACTION_SELECTED);
    expect((result.events[0].payload as any).faction).toBe(FACTION_IDS.SWAMP);

    // 第二个事件：弃掉手牌中的沼泽派系卡牌
    expect(result.events[1].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED);
    expect((result.events[1].payload as any).playerId).toBe('player2');
    expect((result.events[1].payload as any).cardIds).toHaveLength(2);
    expect((result.events[1].payload as any).cardIds).toContain('hand1');
    expect((result.events[1].payload as any).cardIds).toContain('hand3');
    expect((result.events[1].payload as any).from).toBe('hand');

    // 第三个事件：弃掉牌库中的沼泽派系卡牌
    expect(result.events[2].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK);
    expect((result.events[2].payload as any).playerId).toBe('player2');
    expect((result.events[2].payload as any).count).toBe(2);  // 修正：使用 count 而非 cardIds

    // 第四个事件：混洗牌库
    expect(result.events[3].type).toBe(CARDIA_EVENTS.DECK_SHUFFLED);
    expect((result.events[3].payload as any).playerId).toBe('player2');
  });

  it('当对手手牌和牌库中都没有沼泽派系卡牌时，应该只产生派系选择和混洗事件', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].hand = [
      createMockCard({ uid: 'hand1', defId: 'test1', ownerId: 'player2', baseInfluence: 2, faction: 'academy' }),
    ];
    mockCore.players['player2'].deck = [
      createMockCard({ uid: 'deck1', defId: 'test2', ownerId: 'player2', baseInfluence: 3, faction: 'guild' }),
    ];
    const mockContext = createMockContext({ core: mockCore });

    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.WITCH_KING);
    const result = executor!(mockContext);

    expect(result.events).toHaveLength(2);
    expect(result.events[0].type).toBe(CARDIA_EVENTS.FACTION_SELECTED);
    expect(result.events[1].type).toBe(CARDIA_EVENTS.DECK_SHUFFLED);
  });
});
