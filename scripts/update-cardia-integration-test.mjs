import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/cardia/__tests__/integration-ability-trigger.test.ts';
let content = readFileSync(filePath, 'utf-8');

// 替换第二个测试（平局）
const test2Old = `    it('应该在平局时跳过能力阶段', () => {
      // 构造场景：双方影响力相等
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          currentEncounter: {
            index: 0,
            player1Card: {
              uid: 'c1',
              defId: 'card_i_mercenary_swordsman',
              owner: 'p1',
              baseInfluence: 10,
              currentInfluence: 10,
              signets: 0,
              modifierTokens: [],
              ongoingAbilities: []
            },
            player2Card: {
              uid: 'c2',
              defId: 'card_i_saboteur',
              owner: 'p2',
              baseInfluence: 10,
              currentInfluence: 10,
              signets: 0,
              modifierTokens: [],
              ongoingAbilities: []
            },
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
          abilityId: ABILITY_IDS.MERCENARY_SWORDSMAN,
          cardId: 'c1',
          playerId: 'p1'
        }
      });

      const validateP2 = CardiaDomain.validate(state, {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p2',
        payload: {
          abilityId: ABILITY_IDS.SABOTEUR,
          cardId: 'c2',
          playerId: 'p2'
        }
      });

      expect(validateP1.valid).toBe(false);
      expect(validateP2.valid).toBe(false);
    });`;

const test2New = `    it('应该在平局时跳过能力阶段', () => {
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
          cardId: 'c1',
          playerId: 'p1'
        }
      });

      const validateP2 = CardiaDomain.validate(state, {
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: 'p2',
        payload: {
          abilityId: ABILITY_IDS.SABOTEUR,
          cardId: 'c2',
          playerId: 'p2'
        }
      });

      expect(validateP1.valid).toBe(false);
      expect(validateP2.valid).toBe(false);
    });`;

content = content.replace(test2Old, test2New);

// 替换第三个测试（获胜方拒绝）
const test3Old = `    it('应该在获胜方尝试发动能力时拒绝', () => {
      // 构造场景：p2 获胜
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          currentEncounter: {
            index: 0,
            player1Card: {
              uid: 'c1',
              defId: 'card_i_mercenary_swordsman',
              owner: 'p1',
              baseInfluence: 5,
              currentInfluence: 5,
              signets: 0,
              modifierTokens: [],
              ongoingAbilities: []
            },
            player2Card: {
              uid: 'c2',
              defId: 'card_i_saboteur',
              owner: 'p2',
              baseInfluence: 10,
              currentInfluence: 10,
              signets: 1,
              modifierTokens: [],
              ongoingAbilities: []
            },
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
          cardId: 'c2',
          playerId: 'p2'
        }
      });

      expect(validateResult.valid).toBe(false);
      expect(validateResult.error).toContain('只有失败方才能发动能力');
    });`;

const test3New = `    it('应该在获胜方尝试发动能力时拒绝', () => {
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
          cardId: 'c2',
          playerId: 'p2'
        }
      });

      expect(validateResult.valid).toBe(false);
      expect(validateResult.error).toContain('Only the loser can activate abilities');
    });`;

content = content.replace(test3Old, test3New);

// 替换第四个测试（执行破坏者能力）
const test4Old = `    it('应该执行破坏者能力并更新对手牌库', () => {
      // 构造场景：p1 失败，发动破坏者能力
      const state: MatchState<CardiaCore> = {
        ...initialState,
        core: {
          ...initialState.core,
          phase: 'ability',
          currentEncounter: {
            index: 0,
            player1Card: {
              uid: 'c1',
              defId: 'card_i_saboteur',
              owner: 'p1',
              baseInfluence: 5,
              currentInfluence: 5,
              signets: 0,
              modifierTokens: [],
              ongoingAbilities: []
            },
            player2Card: {
              uid: 'c2',
              defId: 'card_i_mercenary_swordsman',
              owner: 'p2',
              baseInfluence: 10,
              currentInfluence: 10,
              signets: 1,
              modifierTokens: [],
              ongoingAbilities: []
            },
            winnerId: 'p2',
            loserId: 'p1'
          },
          players: {
            ...initialState.core.players,
            p1: {
              ...initialState.core.players.p1,
              playedCards: [{
                uid: 'c1',
                defId: 'card_i_saboteur',
                owner: 'p1',
                baseInfluence: 5,
                currentInfluence: 5,
                signets: 0,
                modifierTokens: [],
                ongoingAbilities: []
              }]
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
          cardId: 'c1',
          playerId: 'p1'
        }
      };

      const events = CardiaDomain.execute(state, command, { random: () => 0.5 });

      // 验证事件
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('cardia:ability_activated');
      expect(events[1].type).toBe('cardia:cards_discarded_from_deck');

      // 验证状态更新
      let newCore = state.core;
      for (const event of events) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 对手牌库应该减少 2 张
      expect(newCore.players.p2.deck.length).toBe(3);
      // 对手弃牌堆应该增加 2 张
      expect(newCore.players.p2.discard.length).toBe(2);
    });`;

const test4New = `    it('应该执行破坏者能力并更新对手牌库', () => {
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
          cardId: 'c1',
          playerId: 'p1'
        }
      };

      const events = CardiaDomain.execute(state, command, { random: () => 0.5 });

      // 验证事件
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('cardia:ability_activated');
      expect(events[1].type).toBe('cardia:cards_discarded_from_deck');

      // 验证状态更新
      let newCore = state.core;
      for (const event of events) {
        newCore = CardiaDomain.reduce(newCore, event);
      }

      // 对手牌库应该减少 2 张
      expect(newCore.players.p2.deck.length).toBe(3);
      // 对手弃牌堆应该增加 2 张
      expect(newCore.players.p2.discard.length).toBe(2);
    });`;

content = content.replace(test4Old, test4New);

writeFileSync(filePath, content, 'utf-8');
console.log('✅ 集成测试已更新');
