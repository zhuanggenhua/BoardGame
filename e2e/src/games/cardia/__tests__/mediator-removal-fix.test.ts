/**
 * 测试调停者持续标记被移除后重新判定胜负
 * 
 * Bug 场景：
 * 1. 第一次遭遇：玩家0打出card04（影响力4），玩家1打出card11（影响力11）
 * 2. 玩家1获胜，card11获得1枚印戒
 * 3. 玩家0激活调停者能力，放置持续标记，强制平局，移除card11的印戒
 * 4. 第二次遭遇：玩家1打出card02（虚空法师），激活能力移除card04的持续标记
 * 5. 预期：card11应该重新获得1枚印戒（因为调停者效果失效，恢复原本的胜负结果）
 * 6. 实际：card11没有重新获得印戒
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reduce';
import { CARDIA_EVENTS } from '../domain/events';
import { ABILITY_IDS } from '../domain/ids';
import { createTagContainer } from '../../../engine/primitives/tags';
import type { CardiaCore, CardiaCard } from '../domain/core-types';

describe('调停者持续标记移除后重新判定胜负', () => {
    it('应该在调停者标记被移除后，重新判定遭遇胜负并授予印戒', () => {
        // 创建测试卡牌
        const card04: CardiaCard = {
            uid: 'card04_uid',
            defId: 'deck_i_card_04',
            ownerId: '0',
            baseInfluence: 4,
            faction: 'dynasty',
            abilityIds: [ABILITY_IDS.MEDIATOR],
            difficulty: 0,
            modifiers: { entries: [], nextOrder: 0 },
            tags: createTagContainer(),
            signets: 0,
            ongoingMarkers: [ABILITY_IDS.MEDIATOR],
            imagePath: 'cardia/cards/deck1/4',
            encounterIndex: 1,
        };
        
        const card11: CardiaCard = {
            uid: 'card11_uid',
            defId: 'deck_i_card_11',
            ownerId: '1',
            baseInfluence: 11,
            faction: 'guild',
            abilityIds: [ABILITY_IDS.CLOCKMAKER],
            difficulty: 2,
            modifiers: { entries: [], nextOrder: 0 },
            tags: createTagContainer(),
            signets: 0,  // 调停者效果生效后，印戒被移除
            ongoingMarkers: [],
            imagePath: 'cardia/cards/deck1/11',
            encounterIndex: 1,
        };
        
        // 初始状态：调停者持续标记已放置，card11的印戒已被移除
        const initialCore: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    name: 'Player 0',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [card04],
                    signets: 0,
                    tags: createTagContainer(),
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
                    playedCards: [card11],
                    signets: 0,
                    tags: createTagContainer(),
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
                    player1Card: card04,
                    player2Card: card11,
                    player1Influence: 4,
                    player2Influence: 11,
                    winnerId: '1',  // 原本玩家1获胜
                    loserId: '0',
                },
            ],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [
                {
                    abilityId: ABILITY_IDS.MEDIATOR,
                    cardId: card04.uid,
                    playerId: '0',
                    effectType: 'forceTie',
                    timestamp: Date.now(),
                    encounterIndex: 1,
                },
            ],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
            previousEncounter: null,
        };
        
        // 虚空法师移除调停者的持续标记
        const event = {
            type: CARDIA_EVENTS.ONGOING_ABILITY_REMOVED.type,
            payload: {
                abilityId: ABILITY_IDS.MEDIATOR,
                cardId: card04.uid,
                playerId: '0',
            },
            timestamp: Date.now(),
        };
        
        // 执行 reduce
        const newCore = reduce(initialCore, event);
        
        // 验证：调停者标记已被移除
        expect(newCore.ongoingAbilities).toHaveLength(0);
        expect(newCore.players['0'].playedCards[0].ongoingMarkers).toHaveLength(0);
        
        // 验证：card11重新获得1枚印戒（因为调停者效果失效，恢复原本的胜负结果）
        const card11AfterRemoval = newCore.players['1'].playedCards.find(c => c.uid === card11.uid);
        expect(card11AfterRemoval).toBeDefined();
        expect(card11AfterRemoval!.signets).toBe(1);
    });
    
    it('应该在调停者标记被移除后，如果原本是平局则不授予印戒', () => {
        // 创建测试卡牌（影响力相等）
        const card04: CardiaCard = {
            uid: 'card04_uid',
            defId: 'deck_i_card_04',
            ownerId: '0',
            baseInfluence: 4,
            faction: 'dynasty',
            abilityIds: [ABILITY_IDS.MEDIATOR],
            difficulty: 0,
            modifiers: { entries: [], nextOrder: 0 },
            tags: createTagContainer(),
            signets: 0,
            ongoingMarkers: [ABILITY_IDS.MEDIATOR],
            imagePath: 'cardia/cards/deck1/4',
            encounterIndex: 1,
        };
        
        const card03: CardiaCard = {
            uid: 'card03_uid',
            defId: 'deck_i_card_03',
            ownerId: '1',
            baseInfluence: 4,  // 与card04影响力相等
            faction: 'guild',
            abilityIds: [ABILITY_IDS.SURGEON],
            difficulty: 0,
            modifiers: { entries: [], nextOrder: 0 },
            tags: createTagContainer(),
            signets: 0,
            ongoingMarkers: [],
            imagePath: 'cardia/cards/deck1/3',
            encounterIndex: 1,
        };
        
        // 初始状态：调停者持续标记已放置
        const initialCore: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    name: 'Player 0',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [card04],
                    signets: 0,
                    tags: createTagContainer(),
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
                    playedCards: [card03],
                    signets: 0,
                    tags: createTagContainer(),
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
                    player1Card: card04,
                    player2Card: card03,
                    player1Influence: 4,
                    player2Influence: 4,  // 影响力相等
                    winnerId: null,  // 原本就是平局
                    loserId: null,
                },
            ],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [
                {
                    abilityId: ABILITY_IDS.MEDIATOR,
                    cardId: card04.uid,
                    playerId: '0',
                    effectType: 'forceTie',
                    timestamp: Date.now(),
                    encounterIndex: 1,
                },
            ],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
            previousEncounter: null,
        };
        
        // 虚空法师移除调停者的持续标记
        const event = {
            type: CARDIA_EVENTS.ONGOING_ABILITY_REMOVED.type,
            payload: {
                abilityId: ABILITY_IDS.MEDIATOR,
                cardId: card04.uid,
                playerId: '0',
            },
            timestamp: Date.now(),
        };
        
        // 执行 reduce
        const newCore = reduce(initialCore, event);
        
        // 验证：调停者标记已被移除
        expect(newCore.ongoingAbilities).toHaveLength(0);
        
        // 验证：两张卡牌都没有印戒（因为原本就是平局）
        const card04AfterRemoval = newCore.players['0'].playedCards.find(c => c.uid === card04.uid);
        const card03AfterRemoval = newCore.players['1'].playedCards.find(c => c.uid === card03.uid);
        expect(card04AfterRemoval!.signets).toBe(0);
        expect(card03AfterRemoval!.signets).toBe(0);
    });
});
