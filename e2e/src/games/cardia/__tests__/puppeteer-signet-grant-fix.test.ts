/**
 * 傀儡师印戒授予修复测试
 * 
 * Bug: 傀儡师能力发动后，如果胜负反转，新获胜者没有得到印戒
 * 
 * 场景：
 * - P1 出 card10（傀儡师，影响力 5）
 * - P0 出 card11（钟表匠，影响力 11）
 * - P0 赢，遭遇结算时 card11 获得 1 个印戒
 * - P1 的 card10 输了，触发傀儡师能力
 * - 傀儡师替换 P0 的 card11 为 P0 手牌中的 card03（影响力 3）
 * - 胜负反转：P1 的 card10（影响力 5）> P0 的 card03（影响力 3）
 * - 预期：P1 的 card10 应该获得 1 个印戒
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initializeAbilityExecutors } from '../domain/abilityExecutor';
import { reduce } from '../domain/reduce';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaCore } from '../domain/core-types';

beforeAll(async () => {
    await initializeAbilityExecutors();
});

describe('傀儡师印戒授予修复', () => {
    it('胜负反转时应该给新获胜者授予印戒', () => {
        // 初始状态：遭遇已结算，P0 的 card11 获得了 1 个印戒
        const initialCore: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    name: 'Player 0',
                    hand: [
                        {
                            uid: 'p0_hand_card03',
                            defId: 'deck_i_card_03',
                            ownerId: '0',
                            baseInfluence: 3,
                            faction: 'guild',
                            abilityIds: ['ability_i_surgeon'],
                            difficulty: 0,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/3',
                        },
                    ],
                    deck: [],
                    discard: [],
                    playedCards: [
                        {
                            uid: 'p0_card11',
                            defId: 'deck_i_card_11',
                            ownerId: '0',
                            baseInfluence: 11,
                            faction: 'guild',
                            abilityIds: ['ability_i_clockmaker'],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 1,  // 遭遇结算时获得的印戒
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/11',
                            encounterIndex: 1,
                        },
                    ],
                    signets: 0,
                    tags: { tags: {} },
                    hasPlayed: false,
                    cardRevealed: false,
                    currentCard: null,
                },
                '1': {
                    id: '1',
                    name: 'Player 1',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [
                        {
                            uid: 'p1_card10',
                            defId: 'deck_i_card_10',
                            ownerId: '1',
                            baseInfluence: 10,
                            faction: 'academy',
                            abilityIds: ['ability_i_puppeteer'],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/10',
                            encounterIndex: 1,
                        },
                    ],
                    signets: 0,
                    tags: { tags: {} },
                    hasPlayed: false,
                    cardRevealed: false,
                    currentCard: null,
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 1,
            phase: 'ability',
            encounterHistory: [
                {
                    player1Card: {
                        uid: 'p0_card11',
                        defId: 'deck_i_card_11',
                        ownerId: '0',
                        baseInfluence: 11,
                        faction: 'guild',
                        abilityIds: ['ability_i_clockmaker'],
                        difficulty: 2,
                        modifiers: { entries: [], nextOrder: 0 },
                        tags: {},
                        signets: 0,
                        ongoingMarkers: [],
                        imagePath: 'cardia/cards/deck1/11',
                    },
                    player2Card: {
                        uid: 'p1_card10',
                        defId: 'deck_i_card_10',
                        ownerId: '1',
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
                    player1Influence: 11,
                    player2Influence: 5,  // 被外科医生降低了 5 点
                    winnerId: '0',
                    loserId: '1',
                },
            ],
            currentEncounter: {
                player1Card: {
                    uid: 'p0_card11',
                    defId: 'deck_i_card_11',
                    ownerId: '0',
                    baseInfluence: 11,
                    faction: 'guild',
                    abilityIds: ['ability_i_clockmaker'],
                    difficulty: 2,
                    modifiers: { entries: [], nextOrder: 0 },
                    tags: {},
                    signets: 0,
                    ongoingMarkers: [],
                    imagePath: 'cardia/cards/deck1/11',
                },
                player2Card: {
                    uid: 'p1_card10',
                    defId: 'deck_i_card_10',
                    ownerId: '1',
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
                player1Influence: 11,
                player2Influence: 5,
                winnerId: '0',
                loserId: '1',
            },
            previousEncounter: null,
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [
                {
                    cardId: 'p1_card10',
                    value: -5,
                    source: 'ability_i_surgeon',
                    timestamp: Date.now(),
                },
            ],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        // 傀儡师能力发动：替换 P0 的 card11 为 P0 手牌中的 card03
        const cardReplacedEvent = {
            type: CARDIA_EVENTS.CARD_REPLACED.type,
            timestamp: Date.now(),
            payload: {
                oldCardId: 'p0_card11',
                newCardId: 'p0_hand_card03',
                playerId: '0',
                encounterIndex: 1,
                suppressAbility: true,
            },
        };
        
        const newCore = reduce(initialCore, cardReplacedEvent);
        
        // 验证：P1 的 card10 应该获得 1 个印戒
        const p1Card10 = newCore.players['1'].playedCards.find(c => c.uid === 'p1_card10');
        expect(p1Card10).toBeDefined();
        expect(p1Card10!.signets).toBe(1);
        
        // 验证：P0 的新卡牌（card03）应该没有印戒
        const p0Card03 = newCore.players['0'].playedCards.find(c => c.uid === 'p0_hand_card03');
        expect(p0Card03).toBeDefined();
        expect(p0Card03!.signets).toBe(0);
        
        // 验证：遭遇历史应该更新
        expect(newCore.encounterHistory[0].winnerId).toBe('1');
        expect(newCore.encounterHistory[0].loserId).toBe('0');
        expect(newCore.encounterHistory[0].player1Influence).toBe(3);  // card03 的影响力
        expect(newCore.encounterHistory[0].player2Influence).toBe(5);  // card10 的影响力（10 - 5）
    });
    
    it('如果旧卡牌有多个印戒，应该全部转移', () => {
        // 初始状态：P0 的 card11 有 2 个印戒
        const initialCore: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    name: 'Player 0',
                    hand: [
                        {
                            uid: 'p0_hand_card03',
                            defId: 'deck_i_card_03',
                            ownerId: '0',
                            baseInfluence: 3,
                            faction: 'guild',
                            abilityIds: ['ability_i_surgeon'],
                            difficulty: 0,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/3',
                        },
                    ],
                    deck: [],
                    discard: [],
                    playedCards: [
                        {
                            uid: 'p0_card11',
                            defId: 'deck_i_card_11',
                            ownerId: '0',
                            baseInfluence: 11,
                            faction: 'guild',
                            abilityIds: ['ability_i_clockmaker'],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 2,  // 有 2 个印戒
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/11',
                            encounterIndex: 1,
                        },
                    ],
                    signets: 0,
                    tags: { tags: {} },
                    hasPlayed: false,
                    cardRevealed: false,
                    currentCard: null,
                },
                '1': {
                    id: '1',
                    name: 'Player 1',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [
                        {
                            uid: 'p1_card10',
                            defId: 'deck_i_card_10',
                            ownerId: '1',
                            baseInfluence: 10,
                            faction: 'academy',
                            abilityIds: ['ability_i_puppeteer'],
                            difficulty: 2,
                            modifiers: { entries: [], nextOrder: 0 },
                            tags: {},
                            signets: 0,
                            ongoingMarkers: [],
                            imagePath: 'cardia/cards/deck1/10',
                            encounterIndex: 1,
                        },
                    ],
                    signets: 0,
                    tags: { tags: {} },
                    hasPlayed: false,
                    cardRevealed: false,
                    currentCard: null,
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 1,
            phase: 'ability',
            encounterHistory: [
                {
                    player1Card: {
                        uid: 'p0_card11',
                        defId: 'deck_i_card_11',
                        ownerId: '0',
                        baseInfluence: 11,
                        faction: 'guild',
                        abilityIds: ['ability_i_clockmaker'],
                        difficulty: 2,
                        modifiers: { entries: [], nextOrder: 0 },
                        tags: {},
                        signets: 0,
                        ongoingMarkers: [],
                        imagePath: 'cardia/cards/deck1/11',
                    },
                    player2Card: {
                        uid: 'p1_card10',
                        defId: 'deck_i_card_10',
                        ownerId: '1',
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
                    player1Influence: 11,
                    player2Influence: 5,
                    winnerId: '0',
                    loserId: '1',
                },
            ],
            currentEncounter: null,
            previousEncounter: null,
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        // 傀儡师能力发动
        const cardReplacedEvent = {
            type: CARDIA_EVENTS.CARD_REPLACED.type,
            timestamp: Date.now(),
            payload: {
                oldCardId: 'p0_card11',
                newCardId: 'p0_hand_card03',
                playerId: '0',
                encounterIndex: 1,
                suppressAbility: true,
            },
        };
        
        const newCore = reduce(initialCore, cardReplacedEvent);
        
        // 验证：P1 的 card10 应该获得 2 个印戒（转移）
        const p1Card10 = newCore.players['1'].playedCards.find(c => c.uid === 'p1_card10');
        expect(p1Card10).toBeDefined();
        expect(p1Card10!.signets).toBe(2);
    });
});
