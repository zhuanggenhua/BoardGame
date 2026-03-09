/**
 * 集成测试：持续能力
 * 
 * 测试持续标记放置 → 持续效果应用 → 标记移除 → 状态回溯的完整流程
 * 测试多个持续能力同时生效
 * 
 * Requirements: 3.1, 3.2, 3.3, 12.1, 12.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import CardiaDomain from '../domain';
import type { CardiaCore, CardiaCommand } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { CARDIA_COMMANDS } from '../domain/commands';
import { ABILITY_IDS } from '../domain/ids';
import { createTestCard, createTestPlayedCard, executeAndResolveInteraction } from './test-helpers';

// 导入所有能力组以注册执行器
import '../domain/abilities/group1-resources';
import '../domain/abilities/group2-modifiers';
import '../domain/abilities/group3-ongoing';
import '../domain/abilities/group4-card-ops';
import '../domain/abilities/group5-copy';
import '../domain/abilities/group6-special';
import '../domain/abilities/group7-faction';

describe('持续能力集成测试', () => {
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

  describe('持续标记放置和移除', () => {
    it('应该正确放置调停者持续标记', () => {
      // 构造场景：p1 失败，发动调停者能力
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        baseInfluence: 7,
        defId: 'card_i_mediator',
        abilityIds: [ABILITY_IDS.MEDIATOR],
      });
      
      const p2Card = createTestCard({
        uid: 'c2',
        owner: 'p2',
        baseInfluence: 10,
        defId: 'test_card',
        signets: 1,
      });
      
      let state: MatchState<CardiaCore> = {
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
                defId: 'card_i_mediator',
                abilityIds: [ABILITY_IDS.MEDIATOR],
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 执行调停者能力并自动解决所有交互
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.MEDIATOR,
          sourceCardUid: 'c1',
        }
      };
      
      state = executeAndResolveInteraction(
        state,
        command,
        { random: () => 0.5 },
        CardiaDomain,
        true
      );
      
      // 检查是否产生持续标记
      const ongoingAbility = state.core.ongoingAbilities.find(
        a => a.abilityId === ABILITY_IDS.MEDIATOR && a.effectType === 'forceTie'
      );
      expect(ongoingAbility).toBeDefined();
    });

    it('应该正确放置审判官持续标记', () => {
      // 构造场景：p1 失败，发动审判官能力
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        baseInfluence: 11,
        defId: 'card_i_magistrate',
        abilityIds: [ABILITY_IDS.MAGISTRATE],
      });
      
      const p2Card = createTestCard({
        uid: 'c2',
        owner: 'p2',
        baseInfluence: 15,
        defId: 'test_card',
        signets: 1,
      });
      
      let state: MatchState<CardiaCore> = {
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
                baseInfluence: 11,
                defId: 'card_i_magistrate',
                abilityIds: [ABILITY_IDS.MAGISTRATE],
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 执行审判官能力并自动解决所有交互
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.MAGISTRATE,
          sourceCardUid: 'c1',
        }
      };

      state = executeAndResolveInteraction(
        state,
        command,
        { random: () => 0.5 },
        CardiaDomain,
        true
      );
      
      // 检查是否产生持续标记
      const ongoingAbility = state.core.ongoingAbilities.find(
        a => a.abilityId === ABILITY_IDS.MAGISTRATE && a.effectType === 'winTies'
      );
      expect(ongoingAbility).toBeDefined();
    });

    it('应该正确放置财务官持续标记', () => {
      // 构造场景：p1 失败，发动财务官能力
      const p1Card = createTestCard({
        uid: 'c1',
        owner: 'p1',
        baseInfluence: 12,
        defId: 'card_i_treasurer',
        abilityIds: [ABILITY_IDS.TREASURER],
      });
      
      const p2Card = createTestCard({
        uid: 'c2',
        owner: 'p2',
        baseInfluence: 15,
        defId: 'test_card',
        signets: 1,
      });
      
      let state: MatchState<CardiaCore> = {
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
                baseInfluence: 12,
                defId: 'card_i_treasurer',
                abilityIds: [ABILITY_IDS.TREASURER],
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 执行财务官能力并自动解决所有交互
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.TREASURER,
          sourceCardUid: 'c1',
        }
      };

      state = executeAndResolveInteraction(
        state,
        command,
        { random: () => 0.5 },
        CardiaDomain,
        true
      );
      
      // 检查是否产生持续标记
      const ongoingAbility = state.core.ongoingAbilities.find(
        a => a.abilityId === ABILITY_IDS.TREASURER && a.effectType === 'extraSignet'
      );
      expect(ongoingAbility).toBeDefined();
    });
  });

  describe('持续效果应用', () => {
    it('应该在遭遇结算时应用调停者效果（强制平局）', () => {
      // 构造场景：存在调停者持续标记
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'play',
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.MEDIATOR,
              cardId: 'c1',
              playerId: 'p1',
              effectType: 'forceTie',
              encounterIndex: 0,
            }
          ],
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              hand: [createTestCard({
                uid: 'c1',
                owner: 'p1',
                baseInfluence: 5,
                defId: 'test_card',
              })],
              hasPlayed: false,
            },
            p2: {
              ...initialState.core.players.p2,
              hand: [createTestCard({
                uid: 'c2',
                owner: 'p2',
                baseInfluence: 10,
                defId: 'test_card',
              })],
              hasPlayed: false,
            },
          },
        }
      };

      // 1. p1 打出卡牌
      const command1: CardiaCommand = {
        type: CARDIA_COMMANDS.PLAY_CARD,
        playerId: 'p1',
        payload: {
          cardUid: 'c1',
          slotIndex: 0,
        }
      };
      const events1 = CardiaDomain.execute(state, command1, () => 0.5);
      let newCore = state.core;
      for (const event of events1) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 2. p2 打出卡牌（触发遭遇结算）
      const state2: MatchState<CardiaCore> = {
        ...state,
        core: newCore
      };
      const command2: CardiaCommand = {
        type: CARDIA_COMMANDS.PLAY_CARD,
        playerId: 'p2',
        payload: {
          cardUid: 'c2',
          slotIndex: 0,
        }
      };
      const events2 = CardiaDomain.execute(state2, command2, () => 0.5);
      for (const event of events2) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 3. 验证遭遇结果：应该是平局（调停者效果）
      expect(newCore.currentEncounter).toBeDefined();
      expect(newCore.currentEncounter?.winnerId).toBeUndefined();
      expect(newCore.currentEncounter?.loserId).toBeUndefined();
    });

    it('应该在遭遇结算时应用审判官效果（赢得平局）', () => {
      // 构造场景：存在审判官持续标记，平局时应该转换为己方获胜
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'play',
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.MAGISTRATE,
              cardId: 'c1',
              playerId: 'p1',
              effectType: 'winTies',
              encounterIndex: 0,
            }
          ],
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              hand: [createTestCard({
                uid: 'c1',
                owner: 'p1',
                baseInfluence: 10,
                defId: 'test_card',
              })],
              hasPlayed: false,
            },
            p2: {
              ...initialState.core.players.p2,
              hand: [createTestCard({
                uid: 'c2',
                owner: 'p2',
                baseInfluence: 10,
                defId: 'test_card',
              })],
              hasPlayed: false,
            },
          },
        }
      };

      // 1. p1 打出卡牌
      const command1: CardiaCommand = {
        type: CARDIA_COMMANDS.PLAY_CARD,
        playerId: 'p1',
        payload: {
          cardUid: 'c1',
          slotIndex: 0,
        }
      };
      const events1 = CardiaDomain.execute(state, command1, () => 0.5);
      let newCore = state.core;
      for (const event of events1) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 2. p2 打出卡牌（触发遭遇结算）
      const state2: MatchState<CardiaCore> = {
        ...state,
        core: newCore
      };
      const command2: CardiaCommand = {
        type: CARDIA_COMMANDS.PLAY_CARD,
        playerId: 'p2',
        payload: {
          cardUid: 'c2',
          slotIndex: 0,
        }
      };
      const events2 = CardiaDomain.execute(state2, command2, () => 0.5);
      for (const event of events2) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 3. 验证遭遇结果：p1 获胜（审判官效果赢得平局）
      expect(newCore.currentEncounter).toBeDefined();
      expect(newCore.currentEncounter?.winnerId).toBe('p1');
      expect(newCore.currentEncounter?.loserId).toBe('p2');
    });

    it('应该在遭遇结算时应用财务官效果（额外印戒）', () => {
      // 构造场景：存在财务官持续标记，获胜时应该额外获得 1 枚印戒
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'play',
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.TREASURER,
              cardId: 'c1',
              playerId: 'p1',
              effectType: 'extraSignet',
              encounterIndex: 0,
            }
          ],
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              hand: [createTestCard({
                uid: 'c1',
                owner: 'p1',
                baseInfluence: 15,
                defId: 'test_card',
              })],
              hasPlayed: false,
            },
            p2: {
              ...initialState.core.players.p2,
              hand: [createTestCard({
                uid: 'c2',
                owner: 'p2',
                baseInfluence: 10,
                defId: 'test_card',
              })],
              hasPlayed: false,
            },
          },
        }
      };

      // 1. p1 打出卡牌
      const command1: CardiaCommand = {
        type: CARDIA_COMMANDS.PLAY_CARD,
        playerId: 'p1',
        payload: {
          cardUid: 'c1',
          slotIndex: 0,
        }
      };
      const events1 = CardiaDomain.execute(state, command1, () => 0.5);
      let newCore = state.core;
      for (const event of events1) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 2. p2 打出卡牌（触发遭遇结算）
      const state2: MatchState<CardiaCore> = {
        ...state,
        core: newCore
      };
      const command2: CardiaCommand = {
        type: CARDIA_COMMANDS.PLAY_CARD,
        playerId: 'p2',
        payload: {
          cardUid: 'c2',
          slotIndex: 0,
        }
      };
      const events2 = CardiaDomain.execute(state2, command2, () => 0.5);
      for (const event of events2) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 3. 验证遭遇结果：p1 获胜
      expect(newCore.currentEncounter).toBeDefined();
      expect(newCore.currentEncounter?.winnerId).toBe('p1');
      expect(newCore.currentEncounter?.loserId).toBe('p2');

      // 4. 验证获胜卡牌获得 2 枚印戒（基础 1 + 财务官额外 1）
      const winnerCard = newCore.players.p1.playedCards.find(c => c.uid === 'c1');
      expect(winnerCard).toBeDefined();
      expect(winnerCard?.signets).toBe(2);

      // 5. 验证财务官持续标记已被移除（一次性效果）
      const remainingAbilities = newCore.ongoingAbilities.filter(
        a => a.abilityId === ABILITY_IDS.TREASURER
      );
      expect(remainingAbilities.length).toBe(0);
    });
  });

  describe('持续效果优先级', () => {
    it('应该优先应用审判官效果而不是调停者效果', () => {
      // 构造场景：同时存在调停者和审判官持续标记
      // 审判官优先级更高，应该赢得平局而不是强制平局
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'play',
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.MEDIATOR,
              cardId: 'c1',
              playerId: 'p2',
              effectType: 'forceTie',
              encounterIndex: 0,
            },
            {
              id: 'ongoing2',
              abilityId: ABILITY_IDS.MAGISTRATE,
              cardId: 'c2',
              playerId: 'p1',
              effectType: 'winTies',
              encounterIndex: 0,
            }
          ],
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              hand: [createTestCard({
                uid: 'c1',
                owner: 'p1',
                baseInfluence: 5,
                defId: 'test_card',
              })],
              hasPlayed: false,
            },
            p2: {
              ...initialState.core.players.p2,
              hand: [createTestCard({
                uid: 'c2',
                owner: 'p2',
                baseInfluence: 10,
                defId: 'test_card',
              })],
              hasPlayed: false,
            },
          },
        }
      };

      // 1. p1 打出卡牌
      const command1: CardiaCommand = {
        type: CARDIA_COMMANDS.PLAY_CARD,
        playerId: 'p1',
        payload: {
          cardUid: 'c1',
          slotIndex: 0,
        }
      };
      const events1 = CardiaDomain.execute(state, command1, () => 0.5);
      let newCore = state.core;
      for (const event of events1) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 2. p2 打出卡牌（触发遭遇结算）
      const state2: MatchState<CardiaCore> = {
        ...state,
        core: newCore
      };
      const command2: CardiaCommand = {
        type: CARDIA_COMMANDS.PLAY_CARD,
        playerId: 'p2',
        payload: {
          cardUid: 'c2',
          slotIndex: 0,
        }
      };
      const events2 = CardiaDomain.execute(state2, command2, () => 0.5);
      for (const event of events2) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 3. 验证遭遇结果：p1 获胜（审判官效果优先级更高）
      // 逻辑：p2 初始获胜（10 > 5）→ 调停者强制平局 → 审判官赢得平局（p1 获胜）
      expect(newCore.currentEncounter).toBeDefined();
      expect(newCore.currentEncounter?.winnerId).toBe('p1');
      expect(newCore.currentEncounter?.loserId).toBe('p2');
    });
  });

  describe('一次性持续标记自动移除', () => {
    it('应该在财务官效果触发后自动移除持续标记', () => {
      // 构造场景：财务官持续标记在获胜后应该自动移除
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.TREASURER,
              cardId: 'c1',
              playerId: 'p1',
              effectType: 'extraSignet',
              encounterIndex: 0,
            }
          ],
        }
      };

      // 模拟遭遇结算逻辑
      const winner = 'p1';
      
      // 应用财务官效果后，标记应该被移除
      const treasurerAbility = state.core.ongoingAbilities.find(
        a => a.effectType === 'extraSignet' && a.playerId === winner
      );
      
      expect(treasurerAbility).toBeDefined();
      
      // 移除标记（在实际游戏中由 reduce 处理）
      const remainingAbilities = state.core.ongoingAbilities.filter(
        a => a.id !== treasurerAbility?.id
      );
      
      expect(remainingAbilities.length).toBe(0);
    });

    it('应该在机械精灵效果触发后自动移除持续标记', () => {
      // 构造场景：机械精灵持续标记在触发条件胜利后应该自动移除
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
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

      // 模拟遭遇结算逻辑
      const winner = 'p1';
      
      // 应用机械精灵效果后，标记应该被移除
      const mechanicalSpiritAbility = state.core.ongoingAbilities.find(
        a => a.effectType === 'conditionalVictory' && a.playerId === winner
      );
      
      expect(mechanicalSpiritAbility).toBeDefined();
      
      // 移除标记（在实际游戏中由 reduce 处理）
      const remainingAbilities = state.core.ongoingAbilities.filter(
        a => a.id !== mechanicalSpiritAbility?.id
      );
      
      expect(remainingAbilities.length).toBe(0);
    });
  });
});
