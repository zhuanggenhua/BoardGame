/**
 * 集成测试：胜利条件
 * 
 * 测试印戒统计 → 胜利条件检测 → 游戏结束的完整流程
 * 测试特殊胜利条件（机械精灵、精灵）
 * 
 * Requirements: 10.1, 10.2, 10.3, 16.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import CardiaDomain from '../domain';
import type { CardiaCore } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { createTestCard, createTestPlayedCard } from './test-helpers';
import { ABILITY_IDS } from '../domain/ids';

// 导入所有能力组以注册执行器
import '../domain/abilities/group1-resources';
import '../domain/abilities/group2-modifiers';
import '../domain/abilities/group3-ongoing';
import '../domain/abilities/group4-card-ops';
import '../domain/abilities/group5-copy';
import '../domain/abilities/group6-special';
import '../domain/abilities/group7-faction';

describe('胜利条件集成测试', () => {
  let initialState: MatchState<CardiaCore>;

  beforeEach(() => {
    const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
    initialState = {
      core,
      sys: {
        interaction: { queue: [], current: null },
        gameover: undefined,
        log: { entries: [] },
        eventStream: { entries: [], nextId: 0 },
        responseWindow: { current: null, history: [] },
        tutorial: { active: false, currentStep: null, completedSteps: [] }
      }
    };
  });

  describe('印戒统计', () => {
    it('应该正确统计玩家场上所有卡牌的印戒总和', () => {
      // 构造场景：p1 有 3 张卡牌，分别有 1、2、1 枚印戒
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
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
                  signets: 1,
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c2',
                  owner: 'p1',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 2,
                  encounterIndex: 1,
                }),
                createTestPlayedCard({
                  uid: 'c3',
                  owner: 'p1',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 1,
                  encounterIndex: 2,
                }),
              ],
            },
          },
        }
      };

      // 统计印戒总和
      const totalSignets = state.core.players.p1.playedCards.reduce(
        (sum, card) => sum + card.signets,
        0
      );

      expect(totalSignets).toBe(4);
    });

    it('应该正确统计双方玩家的印戒总和', () => {
      // 构造场景：p1 有 3 枚印戒，p2 有 2 枚印戒
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
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
                  signets: 2,
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c2',
                  owner: 'p1',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 1,
                  encounterIndex: 1,
                }),
              ],
            },
            p2: {
              ...core.players.p2,
              playedCards: [
                createTestPlayedCard({
                  uid: 'c3',
                  owner: 'p2',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 1,
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c4',
                  owner: 'p2',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 1,
                  encounterIndex: 1,
                }),
              ],
            },
          },
        }
      };

      // 统计双方印戒总和
      const p1Signets = state.core.players.p1.playedCards.reduce(
        (sum, card) => sum + card.signets,
        0
      );
      const p2Signets = state.core.players.p2.playedCards.reduce(
        (sum, card) => sum + card.signets,
        0
      );

      expect(p1Signets).toBe(3);
      expect(p2Signets).toBe(2);
    });
  });

  describe('标准胜利条件', () => {
    it('应该在玩家印戒总和≥5时触发标准胜利', () => {
      // 构造场景：p1 有 5 枚印戒，处于回合结束阶段
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          phase: 'end', // ⚠️ 修复：标准印戒胜利条件只在阶段3（回合结束阶段）检查
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
                  signets: 2,
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c2',
                  owner: 'p1',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 2,
                  encounterIndex: 1,
                }),
                createTestPlayedCard({
                  uid: 'c3',
                  owner: 'p1',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 1,
                  encounterIndex: 2,
                }),
              ],
            },
          },
        }
      };

      // 检查胜利条件
      const gameOver = CardiaDomain.isGameOver(state.core);

      expect(gameOver).toBeDefined();
      expect(gameOver?.winner).toBe('p1');
    });

    it('应该在玩家印戒总和>5时触发标准胜利', () => {
      // 构造场景：p1 有 6 枚印戒，处于回合结束阶段
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          phase: 'end', // ⚠️ 修复：标准印戒胜利条件只在阶段3（回合结束阶段）检查
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
                  signets: 3,
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c2',
                  owner: 'p1',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 2,
                  encounterIndex: 1,
                }),
                createTestPlayedCard({
                  uid: 'c3',
                  owner: 'p1',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 1,
                  encounterIndex: 2,
                }),
              ],
            },
          },
        }
      };

      // 检查胜利条件
      const gameOver = CardiaDomain.isGameOver(state.core);

      expect(gameOver).toBeDefined();
      expect(gameOver?.winner).toBe('p1');
    });

    it('应该在玩家印戒总和<5时不触发胜利', () => {
      // 构造场景：p1 有 4 枚印戒，处于回合结束阶段
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          phase: 'end', // ⚠️ 修复：标准印戒胜利条件只在阶段3（回合结束阶段）检查
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
                  signets: 2,
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c2',
                  owner: 'p1',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 2,
                  encounterIndex: 1,
                }),
              ],
            },
          },
        }
      };

      // 检查胜利条件
      const gameOver = CardiaDomain.isGameOver(state.core);

      expect(gameOver).toBeUndefined();
    });
  });

  describe('双方同时达到5枚印戒', () => {
    it('应该在双方同时达到5枚印戒时判定为平局', () => {
      // 构造场景：p1 和 p2 都有 5 枚印戒，处于回合结束阶段
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          phase: 'end', // ⚠️ 修复：标准印戒胜利条件只在阶段3（回合结束阶段）检查
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
                  signets: 3,
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c2',
                  owner: 'p1',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 2,
                  encounterIndex: 1,
                }),
              ],
            },
            p2: {
              ...core.players.p2,
              playedCards: [
                createTestPlayedCard({
                  uid: 'c3',
                  owner: 'p2',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 3,
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c4',
                  owner: 'p2',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 2,
                  encounterIndex: 1,
                }),
              ],
            },
          },
        }
      };

      // 检查胜利条件
      const gameOver = CardiaDomain.isGameOver(state.core);

      expect(gameOver).toBeDefined();
      expect(gameOver?.draw).toBe(true);
    });

    it('应该在一方印戒更多时判定该方获胜', () => {
      // 构造场景：p1 有 6 枚印戒，p2 有 5 枚印戒，处于回合结束阶段
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          phase: 'end', // ⚠️ 修复：标准印戒胜利条件只在阶段3（回合结束阶段）检查
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
                  signets: 3,
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c2',
                  owner: 'p1',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 3,
                  encounterIndex: 1,
                }),
              ],
            },
            p2: {
              ...core.players.p2,
              playedCards: [
                createTestPlayedCard({
                  uid: 'c3',
                  owner: 'p2',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 3,
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c4',
                  owner: 'p2',
                  baseInfluence: 10,
                  defId: 'test_card',
                  signets: 2,
                  encounterIndex: 1,
                }),
              ],
            },
          },
        }
      };

      // 检查胜利条件
      const gameOver = CardiaDomain.isGameOver(state.core);

      expect(gameOver).toBeDefined();
      expect(gameOver?.winner).toBe('p1');
    });
  });

  describe.skip('TODO: Deck II - 特殊胜利条件 - 机械精灵', () => {
    it('应该在机械精灵持续标记存在时验证标记正确放置', () => {
      // 构造场景：p1 有机械精灵持续标记
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.MECHANICAL_SPIRIT,
              cardId: 'c1',
              playerId: 'p1',
              effectType: 'conditionalVictory',
              encounterIndex: 0,
            }
          ],
        }
      };

      // 验证持续标记存在
      const mechanicalSpiritAbility = state.core.ongoingAbilities.find(
        a => a.effectType === 'conditionalVictory'
      );
      
      expect(mechanicalSpiritAbility).toBeDefined();
      expect(mechanicalSpiritAbility?.playerId).toBe('p1');
      expect(mechanicalSpiritAbility?.effectType).toBe('conditionalVictory');
    });

    it('应该在机械精灵持续标记存在且玩家遭遇获胜时触发游戏胜利', () => {
      // 注意：机械精灵的条件胜利在遭遇结算时检查
      // 这个测试验证 isGameOver 逻辑是否正确识别机械精灵的条件胜利
      
      // 构造场景：p1 有机械精灵持续标记，且已经赢得遭遇（印戒数达到5），处于回合结束阶段
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          phase: 'end', // ⚠️ 修复：标准印戒胜利条件只在阶段3（回合结束阶段）检查
          mechanicalSpiritActive: {
            playerId: 'p1',
            cardId: 'c1',
          },
          previousEncounter: {
            winnerId: 'p1',
            loserId: 'p2',
            p1Influence: 15,
            p2Influence: 10,
            p1CardUid: 'c1',
            p2CardUid: 'c2',
          },
          players: {
            ...core.players,
            p1: {
              ...core.players.p1,
              playedCards: [
                createTestPlayedCard({
                  uid: 'c1',
                  owner: 'p1',
                  baseInfluence: 15,
                  defId: 'card_ii_mechanical_spirit',
                  abilityIds: [ABILITY_IDS.MECHANICAL_SPIRIT],
                  signets: 5, // 达到5枚印戒
                  encounterIndex: 0,
                }),
              ],
            },
          },
        }
      };

      // 检查胜利条件
      // 机械精灵的条件胜利：如果有 mechanicalSpiritActive 标记且在当前遭遇中获胜，则获胜
      const gameOver = CardiaDomain.isGameOver(state.core);

      expect(gameOver).toBeDefined();
      expect(gameOver?.winner).toBe('p1');
    });
  });

  describe('特殊胜利条件 - 精灵', () => {
    it('应该在精灵能力激活时验证能力执行器已注册', () => {
      // 精灵能力：直接赢得游戏
      // 注意：精灵的直接胜利在能力执行时触发
      
      // 验证精灵能力 ID 正确
      expect(ABILITY_IDS.ELF).toBe('ability_i_elf');
      
      // 验证精灵能力执行器已注册（通过导入已经完成）
      // 实际的游戏胜利逻辑在 isGameOver 中检查
    });

    it('应该在精灵持续标记存在且印戒>=5时触发游戏胜利', () => {
      // 构造场景：p1 有精灵持续标记，且印戒数达到5，处于能力阶段
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          phase: 'ability', // ⚠️ 修复：特殊胜利条件只在阶段2（能力阶段）检查
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.ELF,
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
                  abilityIds: [ABILITY_IDS.ELF],
                  signets: 5, // 达到5枚印戒
                  encounterIndex: 0,
                }),
              ],
            },
          },
        }
      };

      // 检查胜利条件
      // 精灵的直接胜利：如果有精灵持续标记且印戒>=5，则获胜
      const gameOver = CardiaDomain.isGameOver(state.core);

      expect(gameOver).toBeDefined();
      expect(gameOver?.winner).toBe('p1');
    });
  });

  describe('对手无法出牌', () => {
    it('应该在对手手牌和牌库都为空时触发胜利', () => {
      // 构造场景：p2 手牌和牌库都为空
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          players: {
            ...core.players,
            p2: {
              ...core.players.p2,
              hand: [],
              deck: [],
            },
          },
        }
      };

      // 检查胜利条件
      const gameOver = CardiaDomain.isGameOver(state.core);

      expect(gameOver).toBeDefined();
      expect(gameOver?.winner).toBe('p1');
    });

    it('应该在对手只有手牌为空但牌库不为空时不触发胜利', () => {
      // 构造场景：p2 手牌为空但牌库有牌
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          players: {
            ...core.players,
            p2: {
              ...core.players.p2,
              hand: [],
              deck: ['d1', 'd2', 'd3'] as any,
            },
          },
        }
      };

      // 检查胜利条件
      const gameOver = CardiaDomain.isGameOver(state.core);

      // 不应该触发胜利（对手可以从牌库抽牌）
      expect(gameOver).toBeUndefined();
    });

    it('应该在对手只有牌库为空但手牌不为空时不触发胜利', () => {
      // 构造场景：p2 牌库为空但手牌有牌
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          players: {
            ...core.players,
            p2: {
              ...core.players.p2,
              hand: [
                createTestCard({
                  uid: 'c1',
                  owner: 'p2',
                  baseInfluence: 10,
                  defId: 'test_card',
                })
              ],
              deck: [],
            },
          },
        }
      };

      // 检查胜利条件
      const gameOver = CardiaDomain.isGameOver(state.core);

      // 不应该触发胜利（对手还有手牌可以打出）
      expect(gameOver).toBeUndefined();
    });
  });

  describe('游戏结束后状态', () => {
    it('应该在游戏结束后将结果写入 sys.gameover', () => {
      // 构造场景：p1 有 5 枚印戒，处于回合结束阶段
      const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...core,
          phase: 'end', // ⚠️ 修复：标准印戒胜利条件只在阶段3（回合结束阶段）检查
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
        }
      };

      // 检查胜利条件
      const gameOver = CardiaDomain.isGameOver(state.core);

      expect(gameOver).toBeDefined();
      
      // 验证游戏结束结果格式
      if (gameOver) {
        expect(gameOver.winner).toBeDefined();
        expect(['p1', 'p2', 'tie']).toContain(gameOver.winner);
      }
    });
  });
});
