/**
 * 革命者（Revolutionary）能力单元测试
 */

import { describe, it, expect } from 'vitest';
import { abilityExecutorRegistry } from '../domain/abilityExecutor';
import { ABILITY_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import { createMockCore, createMockContext, createMockCard } from './test-helpers';

// 导入能力文件
import '../domain/abilities/group1-resources';

describe('革命者（Revolutionary）', () => {
  it('应该让对手弃掉 2 张手牌，然后抽取 2 张牌', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].hand = [
      createMockCard({ uid: 'card1', defId: 'test1', ownerId: 'player2', baseInfluence: 7, faction: 'swamp' }),
      createMockCard({ uid: 'card2', defId: 'test2', ownerId: 'player2', baseInfluence: 2, faction: 'academy' }),
      createMockCard({ uid: 'card3', defId: 'test3', ownerId: 'player2', baseInfluence: 8, faction: 'guild' }),
    ];
    const mockContext = createMockContext({ core: mockCore });
    
    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.REVOLUTIONARY);
    expect(executor).toBeDefined();

    const result = executor!(mockContext);

    expect(result.events).toHaveLength(2);
    expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED);
    expect((result.events[0].payload as any).playerId).toBe('player2');
    expect((result.events[0].payload as any).cardIds).toHaveLength(2);
    expect((result.events[0].payload as any).from).toBe('hand');

    expect(result.events[1].type).toBe(CARDIA_EVENTS.CARD_DRAWN);
    expect((result.events[1].payload as any).playerId).toBe('player2');
    expect((result.events[1].payload as any).count).toBe(2);
  });

  it('当对手手牌少于 2 张时，应该弃掉所有手牌', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].hand = [
      createMockCard({ uid: 'card1', defId: 'test1', ownerId: 'player2', baseInfluence: 7, faction: 'swamp' }),
    ];
    const mockContext = createMockContext({ core: mockCore });

    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.REVOLUTIONARY);
    const result = executor!(mockContext);

    expect((result.events[0].payload as any).cardIds).toHaveLength(1);
  });

  it('当对手手牌为空时，应该只抽牌', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].hand = [];
    const mockContext = createMockContext({ core: mockCore });

    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.REVOLUTIONARY);
    const result = executor!(mockContext);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(CARDIA_EVENTS.CARD_DRAWN);
  });
});
