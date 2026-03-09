/**
 * 傀儡师能力修复测试
 * 
 * 验证 reduceCardReplaced 中使用 newCore 而不是 core 调用 getOpponentId
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reduce';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaCore } from '../domain/core-types';
import type { CardiaEvent } from '../domain/events';

describe('Cardia - 傀儡师能力修复', () => {
    it('应该正确处理卡牌替换和印戒转移', () => {
        // 初始状态：玩家0的card_10（傀儡师）vs 玩家1的card_15（发明家，1枚印戒）
        // 玩家1获胜
        const initialCore: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    name: 'Player 0',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [
                        {
                            uid: 'card_10',
                            defId: 'deck_i_card_10',
                            ownerId: '0',
                            baseInfluence: 10,
                            faction: 'academy',
                            abilityIds: ['ability_i_puppeteer'],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/10',
                            encounterIndex: 3,
                        },
                    ],
                    signets: 0,
                    tags: { tags: {} },
                    hasPlayed: false,
                    cardRevealed: true,
                    currentCard: null,
                },
                '1': {
                    id: '1',
                    name: 'Player 1',
                    hand: [
                        {
                            uid: 'card_09',
                            defId: 'deck_i_card_09',
                            ownerId: '1',
                            baseInfluence: 9,
                            faction: 'swamp',
                            abilityIds: ['ability_i_ambusher'],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/9',
                        },
                    ],
                    deck: [],
                    discard: [],
                    playedCards: [
                        {
                            uid: 'card_15',
                            defId: 'deck_i_card_15',
                            ownerId: '1',
                            baseInfluence: 15,
                            faction: 'guild',
                            abilityIds: ['ability_i_inventor'],
                            difficulty: 3,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 1,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/15',
                            encounterIndex: 3,
                        },
                    ],
                    signets: 0,
                    tags: { tags: {} },
                    hasPlayed: false,
                    cardRevealed: true,
                    currentCard: null,
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 3,
            phase: 'ability',
            encounterHistory: [
                {
                    player1Card: {
                        uid: 'card_10',
                        defId: 'deck_i_card_10',
                        ownerId: '0',
                        baseInfluence: 10,
                        faction: 'academy',
                        abilityIds: ['ability_i_puppeteer'],
                        difficulty: 2,
                        modifiers: { entries: [], nextOrder: 0 },
                        tags: {},
                        signets: 0,
                        ongoingMarkers: [],
                        imagePath: 'cardia/cards/deck1/10',
                    },
                    player2Card: {
                        uid: 'card_15',
                        defId: 'deck_i_card_15',
                        ownerId: '1',
                        baseInfluence: 15,
                        faction: 'guild',
                        abilityIds: ['ability_i_inventor'],
                        difficulty: 3,
                        modifiers: { entries: [], nextOrder: 0 },
                        tags: {},
                        signets: 0,
                        ongoingMarkers: [],
                        imagePath: 'cardia/cards/deck1/15',
                    },
                    player1Influence: 10,
                    player2Influence: 15,
                    winnerId: '1',
                    loserId: '0',
                },
            ],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
            currentEncounter: {
                player1Card: {
                    uid: 'card_10',
                    defId: 'deck_i_card_10',
                    ownerId: '0',
                    baseInfluence: 10,
                    faction: 'academy',
                    abilityIds: ['ability_i_puppeteer'],
                    difficulty: 2,
                    modifiers: { entries: [], nextOrder: 0 },
                    tags: {},
                    signets: 0,
                    ongoingMarkers: [],
                    imagePath: 'cardia/cards/deck1/10',
                },
                player2Card: {
                    uid: 'card_15',
                    defId: 'deck_i_card_15',
                    ownerId: '1',
                    baseInfluence: 15,
                    faction: 'guild',
                    abilityIds: ['ability_i_inventor'],
                    difficulty: 3,
                    modifiers: { entries: [], nextOrder: 0 },
                    tags: {},
                    signets: 0,
                    ongoingMarkers: [],
                    imagePath: 'cardia/cards/deck1/15',
                },
                player1Influence: 10,
                player2Influence: 15,
                winnerId: '1',
                loserId: '0',
            },
        };
        
        // 傀儡师能力：弃掉相对的牌（card_15），替换为从对手手牌随机抽取的一张牌（card_09）
        const event: CardiaEvent = {
            type: CARDIA_EVENTS.CARD_REPLACED,
            payload: {
                oldCardId: 'card_15',
                newCardId: 'card_09',
                playerId: '1',
                encounterIndex: 3,
                suppressAbility: true,
            },
            timestamp: Date.now(),
        };
        
        // 执行 reduce
        const newCore = reduce(initialCore, event);
        
        // 验证对手的卡牌被替换
        const player1PlayedCards = newCore.players['1'].playedCards;
        expect(player1PlayedCards.length).toBe(1);
        expect(player1PlayedCards[0].uid).toBe('card_09'); // 替换为手牌中的 card_09
        
        // 验证旧卡牌被弃掉
        const player1Discard = newCore.players['1'].discard;
        expect(player1Discard.length).toBe(1);
        expect(player1Discard[0].uid).toBe('card_15');
        expect(player1Discard[0].signets).toBe(0); // 印戒被清零
        
        // 验证对手手牌减少
        const player1Hand = newCore.players['1'].hand;
        expect(player1Hand.length).toBe(0);
        
        // 验证遭遇结果更新
        const encounter = newCore.encounterHistory[0];
        expect(encounter.player2Card?.uid).toBe('card_09');
        expect(encounter.player2Influence).toBe(9);
        
        // 验证印戒转移（从 card_15 的 1 枚印戒转移到 card_10）
        // 因为遭遇结果改变：原来玩家1获胜，现在玩家0获胜
        const player0PlayedCards = newCore.players['0'].playedCards;
        expect(player0PlayedCards[0].uid).toBe('card_10');
        expect(player0PlayedCards[0].signets).toBe(1); // 获得 1 枚印戒
    });
});
