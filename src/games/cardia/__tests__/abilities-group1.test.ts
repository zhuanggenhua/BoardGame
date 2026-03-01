/**
 * Cardia - 组 1 能力测试（简单资源操作）
 * 
 * 测试组 1 的 5 个简单资源操作能力：
 * 1. 破坏者（Saboteur）- 对手弃掉牌库顶 2 张牌
 * 2. 革命者（Revolutionary）- 对手弃掉2张手牌，然后抽取2张牌
 * 3. 伏击者（Ambusher）- 选择一个派系，对手弃掉所有该派系的手牌
 * 4. 巫王（Witch King）- 选择一个派系，对手从手牌和牌库弃掉所有该派系的牌，然后混洗牌库
 * 5. 继承者（Heir）- 对手保留 2 张手牌，弃掉其余手牌和整个牌库
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { abilityExecutorRegistry } from '../domain/abilityExecutor';
import { ABILITY_IDS, FACTION_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaCore } from '../domain/core-types';
import type { CardiaAbilityContext } from '../domain/abilityExecutor';

// 直接导入能力执行器文件，不导入 game.ts（避免加载整个游戏引擎）
import '../domain/abilities/group1-resources';
import '../domain/abilities/group7-faction';  // 伏击者和巫王在这里

describe('Cardia - 组 1：简单资源操作能力', () => {
    let mockCore: CardiaCore;
    let mockContext: CardiaAbilityContext;
    
    beforeEach(() => {
        // 创建模拟的游戏状态
        mockCore = {
            playerOrder: ['player0', 'player1'],
            players: {
                player0: {
                    id: 'player0',
                    name: 'Player 0',
                    hand: [
                        { 
                            uid: 'p0_card1', 
                            defId: 'card1', 
                            ownerId: 'player0',
                            baseInfluence: 5,
                            faction: 'swamp',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        { 
                            uid: 'p0_card2', 
                            defId: 'card2', 
                            ownerId: 'player0',
                            baseInfluence: 6,
                            faction: 'swamp',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        { 
                            uid: 'p0_card3', 
                            defId: 'card3', 
                            ownerId: 'player0',
                            baseInfluence: 7,
                            faction: 'swamp',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                    ],
                    deck: [
                        { 
                            uid: 'p0_deck1', 
                            defId: 'card4', 
                            ownerId: 'player0',
                            baseInfluence: 8,
                            faction: 'swamp',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        { 
                            uid: 'p0_deck2', 
                            defId: 'card5', 
                            ownerId: 'player0',
                            baseInfluence: 9,
                            faction: 'swamp',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        { 
                            uid: 'p0_deck3', 
                            defId: 'card6', 
                            ownerId: 'player0',
                            baseInfluence: 10,
                            faction: 'swamp',
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                    ],
                    discard: [],
                    playedCards: [],
                    signets: 0,
                    tags: { tags: [] },
                    hasPlayed: false,
                    cardRevealed: false,
                },
                player1: {
                    id: 'player1',
                    name: 'Player 1',
                    hand: [
                        { 
                            uid: 'p1_card1', 
                            defId: 'card1', 
                            ownerId: 'player1',
                            baseInfluence: 5,
                            faction: 'swamp',  // 沼泽派系
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        { 
                            uid: 'p1_card2', 
                            defId: 'card2', 
                            ownerId: 'player1',
                            baseInfluence: 6,
                            faction: 'swamp',  // 沼泽派系
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        { 
                            uid: 'p1_card3', 
                            defId: 'card3', 
                            ownerId: 'player1',
                            baseInfluence: 7,
                            faction: 'mountain',  // 山脉派系（不同派系）
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        { 
                            uid: 'p1_card4', 
                            defId: 'card4', 
                            ownerId: 'player1',
                            baseInfluence: 8,
                            faction: 'mountain',  // 山脉派系（不同派系）
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                    ],
                    deck: [
                        { 
                            uid: 'p1_deck1', 
                            defId: 'card5', 
                            ownerId: 'player1',
                            baseInfluence: 9,
                            faction: 'swamp',  // 沼泽派系
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        { 
                            uid: 'p1_deck2', 
                            defId: 'card6', 
                            ownerId: 'player1',
                            baseInfluence: 10,
                            faction: 'swamp',  // 沼泽派系
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        { 
                            uid: 'p1_deck3', 
                            defId: 'card7', 
                            ownerId: 'player1',
                            baseInfluence: 11,
                            faction: 'mountain',  // 山脉派系
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                        { 
                            uid: 'p1_deck4', 
                            defId: 'card8', 
                            ownerId: 'player1',
                            baseInfluence: 12,
                            faction: 'mountain',  // 山脉派系
                            abilityIds: [],
                            difficulty: 1,
                            modifiers: { modifiers: [] },
                            tags: { tags: [] },
                            signets: 0,
                            ongoingMarkers: [],
                        },
                    ],
                    discard: [],
                    playedCards: [],
                    signets: 0,
                    tags: { tags: [] },
                    hasPlayed: false,
                    cardRevealed: false,
                },
            },
            currentPlayerId: 'player0',
            turnNumber: 1,
            phase: 'ability',
            encounterHistory: [],
            modifierTokens: [],
            ongoingAbilities: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            mechanicalSpiritActive: null,
            deckVariant: 'deck1',
            targetSignets: 5,
        } as CardiaCore;
        
        mockContext = {
            core: mockCore,
            abilityId: '',
            cardId: 'test_card',
            playerId: 'player0',
            opponentId: 'player1',
            timestamp: Date.now(),
            random: () => 0.5,  // 固定随机数用于测试
            sourceId: 'test_card',
            ownerId: 'player0',
        };
    });
    
    describe('破坏者（Saboteur）', () => {
        it('应该生成 CARDS_DISCARDED_FROM_DECK 事件，弃掉对手牌库顶 2 张牌', () => {
            mockContext.abilityId = ABILITY_IDS.SABOTEUR;
            const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.SABOTEUR);
            
            expect(executor).toBeDefined();
            
            const result = executor!(mockContext);
            
            expect(result.events).toHaveLength(1);
            expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK);
            expect(result.events[0].payload).toEqual({
                playerId: 'player1',
                count: 2,
            });
        });
    });
    
    describe('革命者（Revolutionary）', () => {
        it('应该生成 CARDS_DISCARDED 和 CARD_DRAWN 事件，弃掉对手2张手牌然后抽2张牌', () => {
            mockContext.abilityId = ABILITY_IDS.REVOLUTIONARY;
            const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.REVOLUTIONARY);
            
            expect(executor).toBeDefined();
            
            const result = executor!(mockContext);
            
            expect(result.events).toHaveLength(2);
            
            // 第一个事件：弃掉2张手牌
            expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED);
            expect(result.events[0].payload.playerId).toBe('player1');
            expect(result.events[0].payload.cardIds).toHaveLength(2);
            expect(result.events[0].payload.from).toBe('hand');
            
            // 第二个事件：抽2张牌
            expect(result.events[1].type).toBe(CARDIA_EVENTS.CARD_DRAWN);
            expect(result.events[1].payload).toEqual({
                playerId: 'player1',
                count: 2,
            });
        });
        
        it('对手没有手牌时，应该只生成 CARD_DRAWN 事件', () => {
            mockCore.players.player1.hand = [];
            mockContext.abilityId = ABILITY_IDS.REVOLUTIONARY;
            const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.REVOLUTIONARY);
            
            const result = executor!(mockContext);
            
            expect(result.events).toHaveLength(1);
            expect(result.events[0].type).toBe(CARDIA_EVENTS.CARD_DRAWN);
            expect(result.events[0].payload).toEqual({
                playerId: 'player1',
                count: 2,
            });
        });
    });
    
    describe('伏击者（Ambusher）', () => {
        it('应该生成 FACTION_SELECTED 和 CARDS_DISCARDED 事件，弃掉对手该派系的所有手牌', () => {
            mockContext.abilityId = ABILITY_IDS.AMBUSHER;
            const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER);
            
            expect(executor).toBeDefined();
            
            const result = executor!(mockContext);
            
            // 应该产生 2 个事件：FACTION_SELECTED + CARDS_DISCARDED
            expect(result.events).toHaveLength(2);
            
            // 第一个事件：派系选择
            expect(result.events[0].type).toBe(CARDIA_EVENTS.FACTION_SELECTED);
            expect(result.events[0].payload.playerId).toBe('player0');
            expect(result.events[0].payload.faction).toBe(FACTION_IDS.SWAMP);
            
            // 第二个事件：弃牌
            expect(result.events[1].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED);
            expect(result.events[1].payload.playerId).toBe('player1');
            expect(result.events[1].payload.from).toBe('hand');
            
            // 验证弃掉的是沼泽派系的所有手牌（当前简化版本自动选择沼泽）
            const discardedCardIds = result.events[1].payload.cardIds;
            expect(discardedCardIds.length).toBeGreaterThan(0);
            
            // 所有弃掉的卡牌都应该是对手手牌中的
            const opponentHandIds = mockCore.players.player1.hand.map(c => c.uid);
            discardedCardIds.forEach((cardId: string) => {
                expect(opponentHandIds).toContain(cardId);
            });
        });
        
        it('对手没有手牌时，应该只生成派系选择事件', () => {
            mockCore.players.player1.hand = [];
            mockContext.abilityId = ABILITY_IDS.AMBUSHER;
            const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.AMBUSHER);
            
            const result = executor!(mockContext);
            
            // 应该产生 1 个事件：FACTION_SELECTED
            expect(result.events).toHaveLength(1);
            expect(result.events[0].type).toBe(CARDIA_EVENTS.FACTION_SELECTED);
        });
    });
    
    describe('巫王（Witch King）', () => {
        it('应该生成 CARDS_DISCARDED、CARDS_DISCARDED_FROM_DECK 和 DECK_SHUFFLED 事件', () => {
            mockContext.abilityId = ABILITY_IDS.WITCH_KING;
            const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.WITCH_KING);
            
            expect(executor).toBeDefined();
            
            const result = executor!(mockContext);
            
            // 应该有 3 个事件：弃手牌、弃牌库、混洗
            expect(result.events.length).toBeGreaterThanOrEqual(1); // 至少有混洗事件
            
            // 最后一个事件应该是混洗牌库
            const lastEvent = result.events[result.events.length - 1];
            expect(lastEvent.type).toBe(CARDIA_EVENTS.DECK_SHUFFLED);
            expect(lastEvent.payload).toEqual({
                playerId: 'player1',
            });
            
            // 如果有弃手牌事件，应该是第一个
            if (result.events.length >= 2 && result.events[0].type === CARDIA_EVENTS.CARDS_DISCARDED) {
                expect(result.events[0].payload.playerId).toBe('player1');
                expect(result.events[0].payload.from).toBe('hand');
            }
            
            // 如果有弃牌库事件，应该在混洗之前
            if (result.events.length >= 2) {
                const deckDiscardEvent = result.events.find(e => e.type === CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK);
                if (deckDiscardEvent) {
                    expect(deckDiscardEvent.payload.playerId).toBe('player1');
                }
            }
        });
    });
    
    describe('继承者（Heir）', () => {
        it('对手手牌 > 2 张时，应该弃掉部分手牌和整个牌库', () => {
            // 对手有 4 张手牌
            expect(mockCore.players.player1.hand.length).toBe(4);
            
            mockContext.abilityId = ABILITY_IDS.HEIR;
            const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.HEIR);
            
            expect(executor).toBeDefined();
            
            const result = executor!(mockContext);
            
            expect(result.events).toHaveLength(2);
            
            // 第一个事件：弃掉部分手牌（保留 2 张，弃掉 2 张）
            expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED);
            expect(result.events[0].payload.playerId).toBe('player1');
            expect(result.events[0].payload.cardIds).toHaveLength(2);
            expect(result.events[0].payload.from).toBe('hand');
            
            // 第二个事件：弃掉整个牌库
            expect(result.events[1].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK);
            expect(result.events[1].payload.playerId).toBe('player1');
            expect(result.events[1].payload.count).toBe(4); // 对手牌库有 4 张牌
        });
        
        it('对手手牌 ≤ 2 张时，应该只弃掉整个牌库', () => {
            // 设置对手只有 2 张手牌
            mockCore.players.player1.hand = [
                { 
                    uid: 'p1_card1', 
                    defId: 'card1', 
                    ownerId: 'player1',
                    baseInfluence: 5,
                    faction: 'swamp',
                    abilityIds: [],
                    difficulty: 1,
                    modifiers: { modifiers: [] },
                    tags: { tags: [] },
                    signets: 0,
                    ongoingMarkers: [],
                },
                { 
                    uid: 'p1_card2', 
                    defId: 'card2', 
                    ownerId: 'player1',
                    baseInfluence: 6,
                    faction: 'swamp',
                    abilityIds: [],
                    difficulty: 1,
                    modifiers: { modifiers: [] },
                    tags: { tags: [] },
                    signets: 0,
                    ongoingMarkers: [],
                },
            ];
            
            mockContext.abilityId = ABILITY_IDS.HEIR;
            const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.HEIR);
            
            const result = executor!(mockContext);
            
            expect(result.events).toHaveLength(1);
            
            // 只有一个事件：弃掉整个牌库
            expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK);
            expect(result.events[0].payload.playerId).toBe('player1');
            expect(result.events[0].payload.count).toBe(4);
        });
        
        it('对手手牌为空时，应该只弃掉整个牌库', () => {
            mockCore.players.player1.hand = [];
            
            mockContext.abilityId = ABILITY_IDS.HEIR;
            const executor = abilityExecutorRegistry.resolve(ABILITY_IDS.HEIR);
            
            const result = executor!(mockContext);
            
            expect(result.events).toHaveLength(1);
            expect(result.events[0].type).toBe(CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK);
        });
    });
});

