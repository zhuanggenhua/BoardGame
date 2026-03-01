/**
 * 集成测试：能力触发流程
 * 
 * 测试遭遇结算 → 能力触发 → 状态更新的完整流程
 * 测试多个能力连续触发
 * 
 * Requirements: 1.1, 2.1, 17.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import CardiaDomain from '../domain';
import type { CardiaCore, CardiaCommand } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { CARDIA_COMMANDS } from '../domain/commands';
import { ABILITY_IDS } from '../domain/ids';
import { createTestCard, createTestPlayedCard, TEST_CARDS } from './test-helpers';

// 导入所有能力组以注册执行器
import '../domain/abilities/group1-resources';
import '../domain/abilities/group2-modifiers';
import '../domain/abilities/group3-ongoing';
import '../domain/abilities/group4-card-ops';
import '../domain/abilities/group5-copy';
import '../domain/abilities/group6-special';
import '../domain/abilities/group7-faction';

describe('能力触发流程集成测试', () => {
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

  describe('基础能力触发流程', () => {
    it('应该在遭遇失败后允许发动能力', () => {
      // 构造场景：p1 打出影响力 5 的牌，p2 打出影响力 10 的牌（带破坏者能力）
      // p1 失败，可以发动能力
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        defId: TEST_CARDS.MERCENARY_SWORDSMAN,
        baseInfluence: 1,
        faction: 'swamp',
        abilityIds: [ABILITY_IDS.MERCENARY_SWORDSMAN],
      });
      
      const p2Card = createTestCard({
        uid: 'c2',
        owner: 'p2',
        defId: TEST_CARDS.SABOTEUR,
        baseInfluence: 10,
        faction: 'swamp',
        abilityIds: [ABILITY_IDS.SABOTEUR],
        signets: 1, // p2 获胜
      });
      
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability', // 设置为能力阶段
          currentEncounter: {
            index: 0,
            player1Card: p1Card,
            player2Card: p2Card,
            winnerId: 'p2',
            loserId: 'p1'
          },
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              playedCards: [createTestPlayedCard({
                uid: 'c1',
                owner: 'p1',
                defId: TEST_CARDS.MERCENARY_SWORDSMAN,
                baseInfluence: 1,
                faction: 'swamp',
                abilityIds: [ABILITY_IDS.MERCENARY_SWORDSMAN],
                encounterIndex: 0,
              })],
            },
            p2: {
              ...initialState.core.players.p2,
              playedCards: [createTestPlayedCard({
                uid: 'c2',
                owner: 'p2',
                defId: TEST_CARDS.SABOTEUR,
                baseInfluence: 10,
                faction: 'swamp',
                abilityIds: [ABILITY_IDS.SABOTEUR],
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 验证失败方（p1）可以发动能力
      const validateResult = CardiaDomain.validate(state, {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.MERCENARY_SWORDSMAN,
          sourceCardUid: 'c1',
        }
      });

      if (!validateResult.valid) {
        console.log('Validation failed:', validateResult.error);
        console.log('State:', {
          phase: state.core.phase,
          currentEncounter: state.core.currentEncounter,
          p1PlayedCards: state.core.players.p1.playedCards,
        });
      }

      expect(validateResult.valid).toBe(true);
    });

    it('应该在平局时跳过能力阶段', () => {
      // 构造场景：双方影响力相等
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        ...TEST_CARDS.SABOTEUR, // 使用影响力10的牌
      });
      
      const p2Card = createTestCard({
        uid: 'c2',
        owner: 'p2',
        ...TEST_CARDS.SABOTEUR, // 同样影响力10
      });
      
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          currentEncounter: {
            index: 0,
            player1Card: p1Card,
            player2Card: p2Card,
            winnerId: null, // 平局
            loserId: null
          }
        }
      };

      // 验证双方都不能发动能力
      const validateP1 = CardiaDomain.validate(state, {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.SABOTEUR,
          sourceCardUid: 'c1',
        }
      });

      const validateP2 = CardiaDomain.validate(state, {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p2',
        payload: {
          abilityId: ABILITY_IDS.SABOTEUR,
          sourceCardUid: 'c2',
        }
      });

      expect(validateP1.valid).toBe(false);
      expect(validateP2.valid).toBe(false);
    });

    it('应该在获胜方尝试发动能力时拒绝', () => {
      // 构造场景：p2 获胜
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        ...TEST_CARDS.MERCENARY_SWORDSMAN,
      });
      
      const p2Card = createTestCard({
        uid: 'c2',
        owner: 'p2',
        ...TEST_CARDS.SABOTEUR,
        signets: 1,
      });
      
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          currentEncounter: {
            index: 0,
            player1Card: p1Card,
            player2Card: p2Card,
            winnerId: 'p2',
            loserId: 'p1'
          }
        }
      };

      // 验证获胜方（p2）不能发动能力
      const validateResult = CardiaDomain.validate(state, {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p2',
        payload: {
          abilityId: ABILITY_IDS.SABOTEUR,
          sourceCardUid: 'c2',
        }
      });

      expect(validateResult.valid).toBe(false);
      expect(validateResult.error).toContain('Only the loser can activate abilities');
    });
  });

  describe('能力执行和状态更新', () => {
    it('应该执行破坏者能力并更新对手牌库', () => {
      // 构造场景：p1 失败，发动破坏者能力
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        ...TEST_CARDS.SABOTEUR,
      });
      
      const p2Card = createTestCard({
        uid: 'c2',
        owner: 'p2',
        ...TEST_CARDS.MERCENARY_SWORDSMAN,
        signets: 1,
      });
      
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          currentEncounter: {
            index: 0,
            player1Card: p1Card,
            player2Card: p2Card,
            winnerId: 'p2',
            loserId: 'p1'
          },
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              playedCards: [createTestPlayedCard({
                uid: 'c1',
                owner: 'p1',
                ...TEST_CARDS.SABOTEUR,
                encounterIndex: 0,
              })],
            },
            p2: {
              ...initialState.core.players.p2,
              deck: ['d4', 'd5', 'd6', 'd7', 'd8'] as any,
              discard: []
            }
          }
        }
      };

      // 执行破坏者能力
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.SABOTEUR,
          sourceCardUid: 'c1',
        }
      };

      const events = CardiaDomain.execute(state, command, { random: () => 0.5 });

      // 验证事件（可能包括 ABILITY_ACTIVATED）
      expect(events.length).toBeGreaterThanOrEqual(2);
      
      // 找到关键事件
      const abilityActivatedEvent = events.find(e => e.type === 'cardia:ability_activated');
      const cardsDiscardedEvent = events.find(e => e.type === 'cardia:cards_discarded_from_deck');
      
      expect(abilityActivatedEvent).toBeDefined();
      expect(cardsDiscardedEvent).toBeDefined();

      // 验证状态更新
      let newCore = state.core;
      for (const event of events) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 对手牌库应该减少 2 张
      expect(newCore.players.p2.deck.length).toBe(3);
      // 对手弃牌堆应该增加 2 张
      expect(newCore.players.p2.discard.length).toBe(2);
    });
  });

  describe('能力触发时机', () => {
    it('应该在遭遇结算完成后才允许发动能力', () => {
      // 构造场景：遭遇尚未结算
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'play', // 还在打牌阶段
          currentEncounter: null
        }
      };

      // 验证不能发动能力
      const validateResult = CardiaDomain.validate(state, {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.SABOTEUR,
          sourceCardUid: 'c1',
        }
      });

      expect(validateResult.valid).toBe(false);
      expect(validateResult.error).toContain('Not in ability phase');
    });
  });

  describe('多能力触发时序', () => {
    it('应该允许同一玩家依次触发多个能力且效果正确叠加', () => {
      // 构造场景：p1 有两张破坏者卡牌，p1 失败
      // 测试目标：验证玩家可以依次触发两个能力，且效果叠加
      const p1Card1 = createTestCard({
        uid: 'c1',
        owner: 'p1',
        defId: TEST_CARDS.SABOTEUR,
        baseInfluence: 5,
        faction: 'swamp',
        abilityIds: [ABILITY_IDS.SABOTEUR],
      });
      
      const p1Card2 = createTestCard({
        uid: 'c2',
        owner: 'p1',
        defId: TEST_CARDS.SABOTEUR,
        baseInfluence: 5,
        faction: 'swamp',
        abilityIds: [ABILITY_IDS.SABOTEUR],
      });
      
      const p2Card = createTestCard({
        uid: 'c3',
        owner: 'p2',
        defId: TEST_CARDS.MERCENARY_SWORDSMAN,
        baseInfluence: 10,
        faction: 'swamp',
        abilityIds: [ABILITY_IDS.MERCENARY_SWORDSMAN],
        signets: 1, // p2 获胜
      });
      
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          currentEncounter: {
            index: 0,
            player1Card: p1Card1,
            player2Card: p2Card,
            winnerId: 'p2',
            loserId: 'p1'
          },
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              playedCards: [
                createTestPlayedCard({
                  uid: 'c1',
                  owner: 'p1',
                  defId: TEST_CARDS.SABOTEUR,
                  baseInfluence: 5,
                  faction: 'swamp',
                  abilityIds: [ABILITY_IDS.SABOTEUR],
                  encounterIndex: 0,
                }),
                createTestPlayedCard({
                  uid: 'c2',
                  owner: 'p1',
                  defId: TEST_CARDS.SABOTEUR,
                  baseInfluence: 5,
                  faction: 'swamp',
                  abilityIds: [ABILITY_IDS.SABOTEUR],
                  encounterIndex: 0,
                }),
              ],
            },
            p2: {
              ...initialState.core.players.p2,
              deck: ['d4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'] as any, // 7张牌
              discard: []
            }
          }
        }
      };

      // 执行第一个能力：破坏者（弃对手牌库 2 张）
      const command1: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.SABOTEUR,
          sourceCardUid: 'c1',
        }
      };

      const events1 = CardiaDomain.execute(state, command1, () => 0.5);
      
      // reduce 第一个能力的事件
      let newCore = state.core;
      for (const event of events1) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 验证第一个能力的效果
      expect(newCore.players.p2.deck.length).toBe(5); // 7 - 2 = 5
      expect(newCore.players.p2.discard.length).toBe(2);

      // 执行第二个能力：破坏者（再弃对手牌库 2 张）
      const state2: MatchState<CardiaCore> = {
        ...state,
        core: newCore
      };

      const command2: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.SABOTEUR,
          sourceCardUid: 'c2',
        }
      };

      const events2 = CardiaDomain.execute(state2, command2, () => 0.5);
      
      // reduce 第二个能力的事件
      for (const event of events2) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 验证第二个能力的效果
      expect(newCore.players.p2.deck.length).toBe(3); // 5 - 2 = 3
      expect(newCore.players.p2.discard.length).toBe(4); // 2 + 2 = 4

      // 验证两个能力的效果都生效且正确叠加
      // 对手牌库从 7 张减少到 3 张（弃了 4 张）
      // 对手弃牌堆从 0 张增加到 4 张
      expect(newCore.players.p2.deck.length).toBe(3);
      expect(newCore.players.p2.discard.length).toBe(4);
    });
  });
});
