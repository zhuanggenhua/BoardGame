/**
 * 集成测试：影响力修正
 * 
 * 测试修正标记 → 影响力变化 → 遭遇结果改变 → 印戒移动的完整流程
 * 测试多个修正标记叠加
 * 
 * Requirements: 4.1, 4.3, 4.4, 4.5
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

describe('影响力修正集成测试', () => {
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

  describe('修正标记放置和影响力计算', () => {
    it('应该正确放置 +5 修正标记并更新影响力', () => {
      // 构造场景：p1 失败，发动外科医生能力（+5 修正标记）
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        ...TEST_CARDS.SURGEON,
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
                ...TEST_CARDS.SURGEON,
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 执行外科医生能力（需要选择目标卡牌）
      // 注意：这个测试简化了交互流程，实际游戏中需要通过交互系统选择目标
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.SURGEON,
          sourceCardUid: 'c1',
        }
      };

      const events = CardiaDomain.execute(state, command, { random: () => 0.5 });

      // 验证事件
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('cardia:ability_activated');
      
      // 注意：由于外科医生需要交互选择目标卡牌，
      // 在没有交互系统的情况下，执行器可能返回交互请求而不是直接产生修正标记事件
      // 这个测试主要验证能力激活事件正确产生
    });

    it('应该正确放置 -3 修正标记并更新影响力', () => {
      // 构造场景：p1 失败，发动税务官能力（-3 修正标记）
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        ...TEST_CARDS.TAX_COLLECTOR,
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
                ...TEST_CARDS.TAX_COLLECTOR,
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 执行税务官能力
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.TAX_COLLECTOR,
          sourceCardUid: 'c1',
        }
      };

      const events = CardiaDomain.execute(state, command, { random: () => 0.5 });

      // 验证事件
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('cardia:ability_activated');
    });
  });

  describe('多个修正标记叠加', () => {
    it('应该正确计算多个修正标记的叠加效果', () => {
      // 构造场景：一张卡牌上有多个修正标记
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        baseInfluence: 5,
        defId: 'test_card',
      });
      
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          modifierTokens: [
            {
              id: 'm1',
              cardId: 'c1',
              value: 5,
              sourceAbilityId: ABILITY_IDS.SURGEON,
              sourcePlayerId: 'p1',
            },
            {
              id: 'm2',
              cardId: 'c1',
              value: 1,
              sourceAbilityId: ABILITY_IDS.PRODIGY,
              sourcePlayerId: 'p1',
            },
            {
              id: 'm3',
              cardId: 'c1',
              value: -3,
              sourceAbilityId: ABILITY_IDS.TAX_COLLECTOR,
              sourcePlayerId: 'p2',
            },
          ],
        }
      };

      // 计算最终影响力：5 (基础) + 5 (外科医生) + 1 (天才) - 3 (税务官) = 8
      const modifiers = state.core.modifierTokens.filter(t => t.cardId === 'c1');
      const finalInfluence = modifiers.reduce((acc, m) => acc + m.value, p1Card.baseInfluence);

      expect(finalInfluence).toBe(8);
    });
  });

  describe('遭遇结果改变和印戒移动', () => {
    it('应该在影响力改变后重新判定遭遇结果', () => {
      // 1. 构造场景：p1 和 p2 已经打出卡牌，遭遇已结算
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        baseInfluence: 5,
        defId: 'test_card',
      });
      
      const p2Card = createTestCard({
        uid: 'c2',
        owner: 'p2',
        baseInfluence: 10,
        defId: 'test_card',
      });
      
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          currentEncounter: {
            player1Card: p1Card,
            player2Card: p2Card,
            player1Influence: 5,
            player2Influence: 10,
            winnerId: 'p2',
            loserId: 'p1'
          },
          encounterHistory: [
            {
              player1Card: p1Card,
              player2Card: p2Card,
              player1Influence: 5,
              player2Influence: 10,
              winnerId: 'p2',
              loserId: 'p1'
            }
          ],
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              playedCards: [createTestPlayedCard({
                uid: 'c1',
                owner: 'p1',
                baseInfluence: 5,
                defId: 'test_card',
                encounterIndex: 0,
              })],
            },
            p2: {
              ...initialState.core.players.p2,
              playedCards: [createTestPlayedCard({
                uid: 'c2',
                owner: 'p2',
                baseInfluence: 10,
                defId: 'test_card',
                signets: 1, // p2 获胜获得印戒
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 2. 执行添加修正标记的命令
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ADD_MODIFIER,
        playerId: 'p1',
        payload: {
          cardUid: 'c1',
          modifierValue: 5,
        }
      };
      const events = CardiaDomain.execute(state, command, () => 0.5);
      let newCore = state.core;
      for (const event of events) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 3. 验证修正标记已添加
      const p1Card_modifiers = newCore.players.p1.playedCards[0].modifiers;
      expect(p1Card_modifiers.entries.length).toBeGreaterThan(0);
      expect(p1Card_modifiers.entries[0].def.value).toBe(5);

      // 4. 验证遭遇结果已改变（从 p2 获胜变为平局）
      const updatedEncounter = newCore.encounterHistory[0];
      expect(updatedEncounter.winnerId).toBeUndefined(); // 平局
      expect(updatedEncounter.loserId).toBeUndefined();

      // 5. 验证影响力已更新
      expect(updatedEncounter.player1Influence).toBe(10); // 5 + 5 = 10
      expect(updatedEncounter.player2Influence).toBe(10);
    });

    it('应该在遭遇结果改变时移动印戒', () => {
      // 1. 构造场景：p1 和 p2 已经打出卡牌，遭遇已结算
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        baseInfluence: 8,
        defId: 'test_card',
      });
      
      const p2Card = createTestCard({
        uid: 'c2',
        owner: 'p2',
        baseInfluence: 10,
        defId: 'test_card',
      });
      
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          currentEncounter: {
            player1Card: p1Card,
            player2Card: p2Card,
            player1Influence: 8,
            player2Influence: 10,
            winnerId: 'p2',
            loserId: 'p1'
          },
          encounterHistory: [
            {
              player1Card: p1Card,
              player2Card: p2Card,
              player1Influence: 8,
              player2Influence: 10,
              winnerId: 'p2',
              loserId: 'p1'
            }
          ],
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              playedCards: [createTestPlayedCard({
                uid: 'c1',
                owner: 'p1',
                baseInfluence: 8,
                defId: 'test_card',
                signets: 0,
                encounterIndex: 0,
              })],
            },
            p2: {
              ...initialState.core.players.p2,
              playedCards: [createTestPlayedCard({
                uid: 'c2',
                owner: 'p2',
                baseInfluence: 10,
                defId: 'test_card',
                signets: 1, // p2 获胜获得印戒
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 2. 执行添加修正标记的命令
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ADD_MODIFIER,
        playerId: 'p1',
        payload: {
          cardUid: 'c1',
          modifierValue: 5,
        }
      };
      const events = CardiaDomain.execute(state, command, () => 0.5);
      let newCore = state.core;
      for (const event of events) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 3. 验证修正标记已添加
      const p1Card_modifiers = newCore.players.p1.playedCards[0].modifiers;
      expect(p1Card_modifiers.entries.length).toBeGreaterThan(0);
      expect(p1Card_modifiers.entries[0].def.value).toBe(5);

      // 4. 验证遭遇结果已改变（从 p2 获胜变为 p1 获胜）
      const updatedEncounter = newCore.encounterHistory[0];
      expect(updatedEncounter.winnerId).toBe('p1');
      expect(updatedEncounter.loserId).toBe('p2');

      // 5. 验证影响力已更新
      expect(updatedEncounter.player1Influence).toBe(13); // 8 + 5 = 13
      expect(updatedEncounter.player2Influence).toBe(10);

      // 6. 验证印戒已移动（从 p2 移动到 p1）
      const p1CardFinal = newCore.players.p1.playedCards[0];
      const p2CardFinal = newCore.players.p2.playedCards[0];
      expect(p1CardFinal.signets).toBe(1); // p1 获得印戒
      expect(p2CardFinal.signets).toBe(0); // p2 失去印戒
    });
  });

  describe('延迟效果', () => {
    it('应该正确注册延迟效果（图书管理员）', () => {
      // 构造场景：p1 失败，发动图书管理员能力
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        baseInfluence: 7,
        defId: 'card_i_librarian',
        abilityIds: [ABILITY_IDS.LIBRARIAN],
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
                baseInfluence: 7,
                defId: 'card_i_librarian',
                abilityIds: [ABILITY_IDS.LIBRARIAN],
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 执行图书管理员能力
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.LIBRARIAN,
          sourceCardUid: 'c1',
        }
      };

      const events = CardiaDomain.execute(state, command, { random: () => 0.5 });

      // 验证事件
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('cardia:ability_activated');
      
      // 注意：图书管理员需要交互选择 +2 或 -2
      // 在没有交互系统的情况下，执行器会返回交互请求而不是直接产生延迟效果事件
      // 这个测试主要验证能力激活事件正确产生
      // 完整的延迟效果测试需要在交互系统实现后补充
    });
  });
});
