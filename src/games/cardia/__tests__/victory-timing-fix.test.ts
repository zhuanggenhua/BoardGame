/**
 * 测试：印戒胜利条件时机修复
 * 
 * Bug: 印戒数量判定在阶段2（能力阶段）就触发，应该在阶段3（回合结束阶段）才判定
 * Fix: isGameOver 中的标准印戒胜利条件只在 phase === 'end' 时检查
 */

import { describe, it, expect } from 'vitest';
import CardiaDomain from '../domain';
import type { CardiaCore } from '../domain/types';
import { createTestPlayedCard } from './test-helpers';

describe('印戒胜利条件时机修复', () => {
  it('应该在阶段1（打出卡牌）时不触发印戒胜利条件', () => {
    const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
    
    // 构造场景：p1 有 5 枚印戒，但处于 play 阶段
    const testCore: CardiaCore = {
      ...core,
      phase: 'play',
      players: {
        ...core.players,
        p1: {
          ...core.players.p1,
          playedCards: [
            createTestPlayedCard({
              uid: 'c1',
              owner: 'p1',
              baseInfluence: 10,
              defId: 'test_card',
              signets: 5,
              encounterIndex: 0,
            }),
          ],
        },
      },
    };

    // 检查胜利条件：应该返回 undefined（不触发胜利）
    const gameOver = CardiaDomain.isGameOver(testCore);
    expect(gameOver).toBeUndefined();
  });

  it('应该在阶段2（能力阶段）时不触发印戒胜利条件', () => {
    const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
    
    // 构造场景：p1 有 5 枚印戒，但处于 ability 阶段
    const testCore: CardiaCore = {
      ...core,
      phase: 'ability',
      players: {
        ...core.players,
        p1: {
          ...core.players.p1,
          playedCards: [
            createTestPlayedCard({
              uid: 'c1',
              owner: 'p1',
              baseInfluence: 10,
              defId: 'test_card',
              signets: 5,
              encounterIndex: 0,
            }),
          ],
        },
      },
    };

    // 检查胜利条件：应该返回 undefined（不触发胜利）
    const gameOver = CardiaDomain.isGameOver(testCore);
    expect(gameOver).toBeUndefined();
  });

  it('应该在阶段3（回合结束阶段）时触发印戒胜利条件', () => {
    const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
    
    // 构造场景：p1 有 5 枚印戒，处于 end 阶段
    const testCore: CardiaCore = {
      ...core,
      phase: 'end',
      players: {
        ...core.players,
        p1: {
          ...core.players.p1,
          playedCards: [
            createTestPlayedCard({
              uid: 'c1',
              owner: 'p1',
              baseInfluence: 10,
              defId: 'test_card',
              signets: 5,
              encounterIndex: 0,
            }),
          ],
        },
      },
    };

    // 检查胜利条件：应该返回获胜者
    const gameOver = CardiaDomain.isGameOver(testCore);
    expect(gameOver).toBeDefined();
    expect(gameOver?.winner).toBe('p1');
  });

  it('特殊胜利条件（精灵）应该在阶段2（能力阶段）判定', () => {
    const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
    
    // 构造场景：p1 有精灵能力且有 5 枚印戒，处于 ability 阶段
    const testCore: CardiaCore = {
      ...core,
      phase: 'ability',
      ongoingAbilities: [
        {
          id: 'ongoing1',
          abilityId: 'ability_i_elf',
          cardId: 'c1',
          playerId: 'p1',
          effectType: 'directVictory',
          encounterIndex: 0,
        }
      ],
      players: {
        ...core.players,
        p1: {
          ...core.players.p1,
          playedCards: [
            createTestPlayedCard({
              uid: 'c1',
              owner: 'p1',
              baseInfluence: 16,
              defId: 'card_i_elf',
              abilityIds: ['ability_i_elf'],
              signets: 5,
              encounterIndex: 0,
            }),
          ],
        },
      },
    };

    // 检查胜利条件：精灵能力应该在 ability 阶段触发胜利
    const gameOver = CardiaDomain.isGameOver(testCore);
    expect(gameOver).toBeDefined();
    expect(gameOver?.winner).toBe('p1');
  });

  it('特殊胜利条件（精灵）不应该在阶段1（打出卡牌）判定', () => {
    const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
    
    // 构造场景：p1 有精灵能力且有 5 枚印戒，但处于 play 阶段
    const testCore: CardiaCore = {
      ...core,
      phase: 'play',
      ongoingAbilities: [
        {
          id: 'ongoing1',
          abilityId: 'ability_i_elf',
          cardId: 'c1',
          playerId: 'p1',
          effectType: 'directVictory',
          encounterIndex: 0,
        }
      ],
      players: {
        ...core.players,
        p1: {
          ...core.players.p1,
          playedCards: [
            createTestPlayedCard({
              uid: 'c1',
              owner: 'p1',
              baseInfluence: 16,
              defId: 'card_i_elf',
              abilityIds: ['ability_i_elf'],
              signets: 5,
              encounterIndex: 0,
            }),
          ],
        },
      },
    };

    // 检查胜利条件：精灵能力不应该在 play 阶段触发
    const gameOver = CardiaDomain.isGameOver(testCore);
    expect(gameOver).toBeUndefined();
  });

  it('特殊胜利条件（精灵）不应该在阶段3（回合结束）判定', () => {
    const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
    
    // 构造场景：p1 有精灵能力且有 5 枚印戒，但处于 end 阶段
    const testCore: CardiaCore = {
      ...core,
      phase: 'end',
      ongoingAbilities: [
        {
          id: 'ongoing1',
          abilityId: 'ability_i_elf',
          cardId: 'c1',
          playerId: 'p1',
          effectType: 'directVictory',
          encounterIndex: 0,
        }
      ],
      players: {
        ...core.players,
        p1: {
          ...core.players.p1,
          playedCards: [
            createTestPlayedCard({
              uid: 'c1',
              owner: 'p1',
              baseInfluence: 16,
              defId: 'card_i_elf',
              abilityIds: ['ability_i_elf'],
              signets: 5,
              encounterIndex: 0,
            }),
          ],
        },
      },
    };

    // 检查胜利条件：精灵能力不应该在 end 阶段触发（但会触发标准印戒胜利）
    const gameOver = CardiaDomain.isGameOver(testCore);
    // 这个场景下会触发标准印戒胜利（因为有 5 枚印戒且在 end 阶段）
    expect(gameOver).toBeDefined();
    expect(gameOver?.winner).toBe('p1');
  });

  it('无牌可打的胜利条件应该在阶段1（打出卡牌）时判定', () => {
    const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
    
    // 构造场景：p2 手牌和牌库都为空，处于 play 阶段
    const testCore: CardiaCore = {
      ...core,
      phase: 'play',
      players: {
        ...core.players,
        p2: {
          ...core.players.p2,
          hand: [],
          deck: [],
        },
      },
    };

    // 检查胜利条件：p1 应该获胜（p2 无牌可打）
    const gameOver = CardiaDomain.isGameOver(testCore);
    expect(gameOver).toBeDefined();
    expect(gameOver?.winner).toBe('p1');
  });

  it('无牌可打的胜利条件不应该在阶段2（能力阶段）判定', () => {
    const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
    
    // 构造场景：p2 手牌和牌库都为空，但处于 ability 阶段
    const testCore: CardiaCore = {
      ...core,
      phase: 'ability',
      players: {
        ...core.players,
        p2: {
          ...core.players.p2,
          hand: [],
          deck: [],
        },
      },
    };

    // 检查胜利条件：不应该触发胜利（不在 play 阶段）
    const gameOver = CardiaDomain.isGameOver(testCore);
    expect(gameOver).toBeUndefined();
  });

  it('无牌可打的胜利条件不应该在阶段3（回合结束）判定', () => {
    const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
    
    // 构造场景：p2 手牌和牌库都为空，但处于 end 阶段
    const testCore: CardiaCore = {
      ...core,
      phase: 'end',
      players: {
        ...core.players,
        p2: {
          ...core.players.p2,
          hand: [],
          deck: [],
        },
      },
    };

    // 检查胜利条件：不应该触发无牌可打的胜利（不在 play 阶段）
    // 但如果有印戒数达标，会触发印戒胜利
    const gameOver = CardiaDomain.isGameOver(testCore);
    // 这个场景下应该返回 undefined（没有印戒胜利，也不检查无牌可打）
    expect(gameOver).toBeUndefined();
  });
});
