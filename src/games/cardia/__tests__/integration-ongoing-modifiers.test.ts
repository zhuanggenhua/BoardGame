/**
 * 集成测试：持续能力组合场景
 * 
 * 测试持续能力与修正标记、多个持续能力、印戒移动、卡牌弃掉的组合场景
 * 
 * Requirements: 10.1, 10.2, 10.3
 * 
 * 测试场景：
 * 1. 持续能力 + 修正标记叠加
 * 2. 多个持续能力同时生效
 * 3. 持续能力 + 印戒移动
 * 4. 持续能力 + 卡牌弃掉
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

describe('持续能力组合场景集成测试', () => {
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

  describe('场景 1：持续能力 + 修正标记叠加', () => {
    it('应该正确叠加财务官持续能力和修正标记效果', () => {
      // 构造场景：存在财务官持续标记（额外印戒）+ 修正标记（+3 影响力）
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
          modifierTokens: [
            {
              id: 'mod1',
              value: 3,
              targetCardUid: 'c1',
              sourceCardUid: 'c_librarian',
              sourcePlayerId: 'p1',
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
                baseInfluence: 8,
                defId: 'test_card',
              })],
              hasPlayed: false,
            },
          },
        }
      };

      // 1. p1 打出卡牌（基础影响力 10 + 修正标记 +3 = 13）
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

      // 3. 验证遭遇结果：p1 获胜（13 > 8）
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

      // 6. 验证修正标记仍然存在（不受持续能力影响）
      expect(newCore.modifierTokens.length).toBe(1);
      expect(newCore.modifierTokens[0].targetCardUid).toBe('c1');
    });
  });

  describe('场景 2：多个持续能力同时生效', () => {
    it('应该正确处理调停者 + 审判官的优先级（审判官优先）', () => {
      // 构造场景：同时存在调停者（强制平局）和审判官（赢得平局）持续标记
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
              cardId: 'c_mediator',
              playerId: 'p2',
              effectType: 'forceTie',
              encounterIndex: 0,
            },
            {
              id: 'ongoing2',
              abilityId: ABILITY_IDS.MAGISTRATE,
              cardId: 'c_magistrate',
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

    it('应该正确处理财务官 + 调停者的组合（平局 + 额外印戒）', () => {
      // 构造场景：同时存在财务官（额外印戒）和调停者（强制平局）持续标记
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'play',
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.TREASURER,
              cardId: 'c_treasurer',
              playerId: 'p1',
              effectType: 'extraSignet',
              encounterIndex: 0,
            },
            {
              id: 'ongoing2',
              abilityId: ABILITY_IDS.MEDIATOR,
              cardId: 'c_mediator',
              playerId: 'p2',
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

      // 3. 验证遭遇结果：平局（调停者强制平局）
      expect(newCore.currentEncounter).toBeDefined();
      expect(newCore.currentEncounter?.winnerId).toBeUndefined();
      expect(newCore.currentEncounter?.loserId).toBeUndefined();

      // 4. 验证财务官持续标记未被触发（因为没有获胜者）
      // 财务官效果只在获胜时触发，平局时不触发
      const p1Card = newCore.players.p1.playedCards.find(c => c.uid === 'c1');
      expect(p1Card).toBeDefined();
      expect(p1Card?.signets).toBe(0); // 平局不获得印戒
    });
  });

  describe('场景 3：持续能力 + 印戒移动', () => {
    it('应该在卡牌被替换后正确移除持续能力', () => {
      // 构造场景：财务官持续能力生效 → 傀儡师替换卡牌 → 验证持续能力是否正确移除
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.TREASURER,
              cardId: 'c_treasurer',
              playerId: 'p1',
              effectType: 'extraSignet',
              encounterIndex: 0,
            }
          ],
          currentEncounter: {
            index: 0,
            player1Card: createTestCard({
              uid: 'c_treasurer',
              owner: 'p1',
              baseInfluence: 12,
              defId: 'deck_i_card_12',
              abilityIds: [ABILITY_IDS.TREASURER],
            }),
            player2Card: createTestCard({
              uid: 'c_puppeteer',
              owner: 'p2',
              baseInfluence: 10,
              defId: 'deck_i_card_10',
              abilityIds: [ABILITY_IDS.PUPPETEER],
            }),
            winnerId: 'p1',
            loserId: 'p2'
          },
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              playedCards: [createTestPlayedCard({
                uid: 'c_treasurer',
                owner: 'p1',
                baseInfluence: 12,
                defId: 'deck_i_card_12',
                abilityIds: [ABILITY_IDS.TREASURER],
                encounterIndex: 0,
                signets: 1,
              })],
              hand: [createTestCard({
                uid: 'c_replacement',
                owner: 'p1',
                baseInfluence: 8,
                defId: 'test_card',
              })],
            },
            p2: {
              ...initialState.core.players.p2,
              playedCards: [createTestPlayedCard({
                uid: 'c_puppeteer',
                owner: 'p2',
                baseInfluence: 10,
                defId: 'deck_i_card_10',
                abilityIds: [ABILITY_IDS.PUPPETEER],
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 执行傀儡师能力（替换对手卡牌）并自动解决所有交互
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p2',
        payload: {
          abilityId: ABILITY_IDS.PUPPETEER,
          sourceCardUid: 'c_puppeteer',
        }
      };

      const finalState = executeAndResolveInteraction(
        state,
        command,
        { random: () => 0.5 },
        CardiaDomain,
        true
      );

      // 验证财务官持续标记已被移除（卡牌被替换）
      const remainingAbilities = finalState.core.ongoingAbilities.filter(
        a => a.cardId === 'c_treasurer'
      );
      expect(remainingAbilities.length).toBe(0);

      // 验证印戒已转移到替换卡牌
      const replacementCard = finalState.core.players.p1.playedCards.find(
        c => c.uid === 'c_replacement'
      );
      expect(replacementCard).toBeDefined();
      expect(replacementCard?.signets).toBe(1);

      // 验证原卡牌已被弃掉
      const discardedCard = finalState.core.players.p1.discard.find(
        c => c.uid === 'c_treasurer'
      );
      expect(discardedCard).toBeDefined();
    });
  });

  describe('场景 4：持续能力 + 卡牌弃掉', () => {
    it('应该在卡牌被弃掉后正确移除持续能力', () => {
      // 构造场景：财务官持续能力生效 → 雇佣剑士弃掉财务官 → 验证持续能力是否正确移除
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.TREASURER,
              cardId: 'c_treasurer',
              playerId: 'p1',
              effectType: 'extraSignet',
              encounterIndex: 0,
            }
          ],
          currentEncounter: {
            index: 0,
            player1Card: createTestCard({
              uid: 'c_treasurer',
              owner: 'p1',
              baseInfluence: 12,
              defId: 'deck_i_card_12',
              abilityIds: [ABILITY_IDS.TREASURER],
            }),
            player2Card: createTestCard({
              uid: 'c_mercenary',
              owner: 'p2',
              baseInfluence: 8,
              defId: 'deck_i_card_01',
              abilityIds: [ABILITY_IDS.MERCENARY],
            }),
            winnerId: 'p1',
            loserId: 'p2'
          },
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              playedCards: [createTestPlayedCard({
                uid: 'c_treasurer',
                owner: 'p1',
                baseInfluence: 12,
                defId: 'deck_i_card_12',
                abilityIds: [ABILITY_IDS.TREASURER],
                encounterIndex: 0,
                signets: 1,
              })],
            },
            p2: {
              ...initialState.core.players.p2,
              playedCards: [createTestPlayedCard({
                uid: 'c_mercenary',
                owner: 'p2',
                baseInfluence: 8,
                defId: 'deck_i_card_01',
                abilityIds: [ABILITY_IDS.MERCENARY],
                encounterIndex: 0,
              })],
            },
          },
        }
      };

      // 执行雇佣剑士能力（弃掉本牌和相对的牌）
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p2',
        payload: {
          abilityId: ABILITY_IDS.MERCENARY,
          sourceCardUid: 'c_mercenary',
        }
      };

      const events = CardiaDomain.execute(state, command, () => 0.5);
      let newCore = state.core;
      for (const event of events) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 验证财务官持续标记已被移除（卡牌被弃掉）
      const remainingAbilities = newCore.ongoingAbilities.filter(
        a => a.cardId === 'c_treasurer'
      );
      expect(remainingAbilities.length).toBe(0);

      // 验证财务官卡牌已被弃掉
      const discardedCard = newCore.players.p1.discard.find(
        c => c.uid === 'c_treasurer'
      );
      expect(discardedCard).toBeDefined();

      // 验证雇佣剑士卡牌也被弃掉
      const mercenaryDiscarded = newCore.players.p2.discard.find(
        c => c.uid === 'c_mercenary'
      );
      expect(mercenaryDiscarded).toBeDefined();

      // 验证场上已无卡牌
      expect(newCore.players.p1.playedCards.length).toBe(0);
      expect(newCore.players.p2.playedCards.length).toBe(0);
    });

    it('应该在对手卡牌被弃掉后正确移除附着的持续能力', () => {
      // 构造场景：持续能力附着在对手卡牌上 → 对手卡牌被弃掉 → 验证持续能力是否正确移除
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          ongoingAbilities: [
            {
              id: 'ongoing1',
              abilityId: ABILITY_IDS.DIVINER,
              cardId: 'c_opponent',
              playerId: 'p1',
              effectType: 'forceOpponentFirst',
              encounterIndex: 0,
            }
          ],
          currentEncounter: {
            index: 0,
            player1Card: createTestCard({
              uid: 'c_mercenary',
              owner: 'p1',
              baseInfluence: 8,
              defId: 'deck_i_card_01',
              abilityIds: [ABILITY_IDS.MERCENARY],
            }),
            player2Card: createTestCard({
              uid: 'c_opponent',
              owner: 'p2',
              baseInfluence: 10,
              defId: 'test_card',
            }),
            winnerId: 'p2',
            loserId: 'p1'
          },
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              playedCards: [createTestPlayedCard({
                uid: 'c_mercenary',
                owner: 'p1',
                baseInfluence: 8,
                defId: 'deck_i_card_01',
                abilityIds: [ABILITY_IDS.MERCENARY],
                encounterIndex: 0,
              })],
            },
            p2: {
              ...initialState.core.players.p2,
              playedCards: [createTestPlayedCard({
                uid: 'c_opponent',
                owner: 'p2',
                baseInfluence: 10,
                defId: 'test_card',
                encounterIndex: 0,
                signets: 1,
              })],
            },
          },
        }
      };

      // 执行雇佣剑士能力（弃掉本牌和相对的牌）
      const command: CardiaCommand = {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p1',
        payload: {
          abilityId: ABILITY_IDS.MERCENARY,
          sourceCardUid: 'c_mercenary',
        }
      };

      const events = CardiaDomain.execute(state, command, () => 0.5);
      let newCore = state.core;
      for (const event of events) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 验证持续标记已被移除（附着的对手卡牌被弃掉）
      const remainingAbilities = newCore.ongoingAbilities.filter(
        a => a.cardId === 'c_opponent'
      );
      expect(remainingAbilities.length).toBe(0);

      // 验证对手卡牌已被弃掉
      const discardedCard = newCore.players.p2.discard.find(
        c => c.uid === 'c_opponent'
      );
      expect(discardedCard).toBeDefined();

      // 验证场上已无卡牌
      expect(newCore.players.p1.playedCards.length).toBe(0);
      expect(newCore.players.p2.playedCards.length).toBe(0);
    });
  });
});
