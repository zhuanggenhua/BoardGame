/**
 * 破坏者（Saboteur）能力单元测试
 */

import { describe, it, expect } from 'vitest';
import { abilityExecutorRegistry } from '../domain/abilityExecutor';
import { ABILITY_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import { createMockCore, createMockContext, createMockCard } from './test-helpers';

// 导入能力文件
import '../domain/abilities/group1-resources';

describe('破坏者（Saboteur）', () => {
  it('应该让对手弃掉牌库顶 2 张牌', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].deck = [
      createMockCard({ uid: 'deck1', defId: 'test1', ownerId: 'player2', baseInfluence: 5, faction: 'dynasty' }),
      createMockCard({ uid: 'deck2', defId: 'test2', ownerId: 'player2', baseInfluence: 3, faction: 'swamp' }),
      createMockCard({ uid: 'deck3', defId: 'test3', ownerId: 'player2', baseInfluence: 4, faction: 'academy' }),
    ];
    const mockContext = createMockContext({ core: mockCore });
    
    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SABOTEUR);
    expect(executor).toBeDefined();

    const result = executor!(mockContext);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK);
    expect((result.events[0].payload as any).playerId).toBe('player2');
    expect((result.events[0].payload as any).count).toBe(2);
  });

  it('当对手牌库少于 2 张时，应该弃掉所有牌', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].deck = [
      createMockCard({ uid: 'deck1', defId: 'test1', ownerId: 'player2', baseInfluence: 5, faction: 'dynasty' }),
    ];
    const mockContext = createMockContext({ core: mockCore });

    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SABOTEUR);
    const result = executor!(mockContext);

    expect(result.events).toHaveLength(1);
    expect((result.events[0].payload as any).count).toBe(2);
  });

  it('当对手牌库为空时，应该不产生事件', () => {
    const mockCore = createMockCore();
    mockCore.players['player2'].deck = [];
    const mockContext = createMockContext({ core: mockCore });

    const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SABOTEUR);
    const result = executor!(mockContext);

    expect(result.events).toHaveLength(0);
  });
});
