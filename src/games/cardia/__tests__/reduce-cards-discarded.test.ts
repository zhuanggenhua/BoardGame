/**
 * 单元测试：验证 reduceCardsDiscarded 函数
 * 
 * 目的：验证从手牌弃牌的 reducer 是否正确工作
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reduce';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaCore, CardInstance } from '../domain/core-types';

describe('reduceCardsDiscarded - 从手牌弃牌', () => {
    it('应该正确地从手牌弃掉指定的卡牌', () => {
        // 创建测试状态
        const card1: CardInstance = {
            uid: 'card_1',
            defId: 'deck_i_card_08',
            ownerId: '1',
            baseInfluence: 8,
            faction: 'academy',
            abilityIds: [],
            difficulty: 1,
            modifiers: { entries: [], nextOrder: 0 },
            tags: { entries: [], nextOrder: 0 },
            signets: 0,
            ongoingMarkers: [],
            imageIndex: 0,
            imagePath: '',
        };
        
        const card2: CardInstance = {
            uid: 'card_2',
            defId: 'deck_i_card_14',
            ownerId: '1',
            baseInfluence: 14,
            faction: 'academy',
            abilityIds: [],
            difficulty: 1,
            modifiers: { entries: [], nextOrder: 0 },
            tags: { entries: [], nextOrder: 0 },
            signets: 0,
            ongoingMarkers: [],
            imageIndex: 0,
            imagePath: '',
        };
        
        const card3: CardInstance = {
            uid: 'card_3',
            defId: 'deck_i_card_01',
            ownerId: '1',
            baseInfluence: 1,
            faction: 'guild',
            abilityIds: [],
            difficulty: 1,
            modifiers: { entries: [], nextOrder: 0 },
            tags: { entries: [], nextOrder: 0 },
            signets: 0,
            ongoingMarkers: [],
            imageIndex: 0,
            imagePath: '',
        };
        
        const initialCore: CardiaCore = {
            phase: 'play',
            turnNumber: 1,
            currentPlayerId: '0',
            playerOrder: ['0', '1'],
            players: {
                '0': {
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [],
                    currentCard: null,
                    hasPlayed: false,
                    cardRevealed: false,
                },
                '1': {
                    hand: [card1, card2, card3], // 3 张手牌
                    deck: [],
                    discard: [], // 弃牌堆为空
                    playedCards: [],
                    currentCard: null,
                    hasPlayed: false,
                    cardRevealed: false,
                },
            },
            encounterHistory: [],
            currentEncounter: undefined,
            previousEncounter: undefined,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: undefined,
        };
        
        // 创建 CARDS_DISCARDED 事件（弃掉 2 张 Academy 派系的牌）
        const event = {
            type: CARDIA_EVENTS.CARDS_DISCARDED,
            payload: {
                playerId: '1',
                cardIds: ['card_1', 'card_2'], // 弃掉前两张牌
                from: 'hand' as const,
            },
            timestamp: Date.now(),
        };
        
        // 调用 reduce 函数
        const newCore = reduce(initialCore, event);
        
        // 验证结果
        console.log('Reduce 结果:', {
            oldHandSize: initialCore.players['1'].hand.length,
            newHandSize: newCore.players['1'].hand.length,
            oldDiscardSize: initialCore.players['1'].discard.length,
            newDiscardSize: newCore.players['1'].discard.length,
        });
        
        // 断言：手牌减少 2 张
        expect(newCore.players['1'].hand.length).toBe(1); // 3 - 2 = 1
        
        // 断言：弃牌堆增加 2 张
        expect(newCore.players['1'].discard.length).toBe(2); // 0 + 2 = 2
        
        // 断言：剩余手牌是 card3（Guild 派系）
        expect(newCore.players['1'].hand[0].uid).toBe('card_3');
        expect(newCore.players['1'].hand[0].faction).toBe('guild');
        
        // 断言：弃牌堆包含 card1 和 card2
        const discardUids = newCore.players['1'].discard.map(c => c.uid);
        expect(discardUids).toContain('card_1');
        expect(discardUids).toContain('card_2');
    });
});
