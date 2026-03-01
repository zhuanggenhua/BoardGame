/**
 * 测试 reduceEncounterResolved 修复
 * 验证 PlayedCard 的 encounterIndex 字段是否正确设置
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reduce';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaCore, CardInstance, PlayedCard } from '../domain/core-types';
import { createModifierStack } from '../../../engine/primitives/modifier';
import { createTagContainer } from '../../../engine/primitives/tags';

describe('reduceEncounterResolved - 卡牌显示修复', () => {
    it('应该正确设置 PlayedCard 的 encounterIndex 字段', () => {
        // 创建测试用的 CardInstance
        const player1Card: CardInstance = {
            uid: 'card-1',
            defId: 'test-card-1',
            ownerId: 'player1',
            baseInfluence: 5,
            faction: 'FACTION_MILITARY',
            abilityIds: [],
            difficulty: 1,
            modifiers: createModifierStack(),
            tags: createTagContainer(),
            signets: 0,
            ongoingMarkers: [],
            imagePath: 'test/card1',
        };

        const player2Card: CardInstance = {
            uid: 'card-2',
            defId: 'test-card-2',
            ownerId: 'player2',
            baseInfluence: 3,
            faction: 'FACTION_MYSTIC',
            abilityIds: [],
            difficulty: 1,
            modifiers: createModifierStack(),
            tags: createTagContainer(),
            signets: 0,
            ongoingMarkers: [],
            imagePath: 'test/card2',
        };

        // 创建测试用的核心状态
        const core: CardiaCore = {
            players: {
                player1: {
                    id: 'player1',
                    name: 'Player 1',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [],
                    signets: 0,
                    tags: createTagContainer(),
                    currentCard: player1Card,
                    hasPlayed: true,
                    cardRevealed: true,
                },
                player2: {
                    id: 'player2',
                    name: 'Player 2',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [],
                    signets: 0,
                    tags: createTagContainer(),
                    currentCard: player2Card,
                    hasPlayed: true,
                    cardRevealed: true,
                },
            },
            playerOrder: ['player1', 'player2'],
            currentPlayerId: 'player1',
            turnNumber: 3,
            phase: 'play',
            encounterHistory: [],
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            mechanicalSpiritActive: null,
            deckVariant: 'DECK_STANDARD',
            targetSignets: 5,
        };

        // 执行 ENCOUNTER_RESOLVED 事件
        const event = {
            type: CARDIA_EVENTS.ENCOUNTER_RESOLVED,
            payload: {
                slotIndex: 0,
                winner: 'player1',
                loser: 'player2',
            },
        };

        const newCore = reduce(core, event);

        // 验证 player1 的 playedCards
        expect(newCore.players.player1.playedCards).toHaveLength(1);
        const player1PlayedCard = newCore.players.player1.playedCards[0] as PlayedCard;
        
        // 关键验证：encounterIndex 字段必须存在且等于 turnNumber
        expect(player1PlayedCard.encounterIndex).toBeDefined();
        expect(player1PlayedCard.encounterIndex).toBe(3);
        
        // 验证其他必需字段
        expect(player1PlayedCard.uid).toBe('card-1');
        expect(player1PlayedCard.defId).toBe('test-card-1');
        expect(player1PlayedCard.ownerId).toBe('player1');
        expect(player1PlayedCard.baseInfluence).toBe(5);
        expect(player1PlayedCard.faction).toBe('FACTION_MILITARY');
        expect(player1PlayedCard.signets).toBe(0);

        // 验证 player2 的 playedCards
        expect(newCore.players.player2.playedCards).toHaveLength(1);
        const player2PlayedCard = newCore.players.player2.playedCards[0] as PlayedCard;
        
        // 关键验证：encounterIndex 字段必须存在且等于 turnNumber
        expect(player2PlayedCard.encounterIndex).toBeDefined();
        expect(player2PlayedCard.encounterIndex).toBe(3);
        
        // 验证其他必需字段
        expect(player2PlayedCard.uid).toBe('card-2');
        expect(player2PlayedCard.defId).toBe('test-card-2');
        expect(player2PlayedCard.ownerId).toBe('player2');
        expect(player2PlayedCard.baseInfluence).toBe(3);
        expect(player2PlayedCard.faction).toBe('FACTION_MYSTIC');
        expect(player2PlayedCard.signets).toBe(0);

        // 验证 currentCard 已清空
        expect(newCore.players.player1.currentCard).toBeNull();
        expect(newCore.players.player2.currentCard).toBeNull();
    });

    it('应该在多次遭遇后正确设置不同的 encounterIndex', () => {
        // 创建已有一张卡牌的状态
        const existingCard: PlayedCard = {
            uid: 'card-0',
            defId: 'test-card-0',
            ownerId: 'player1',
            baseInfluence: 4,
            faction: 'FACTION_INDUSTRIAL',
            abilityIds: [],
            difficulty: 1,
            modifiers: createModifierStack(),
            tags: createTagContainer(),
            signets: 1,
            ongoingMarkers: [],
            imagePath: 'test/card0',
            encounterIndex: 1,
        };

        const player1Card: CardInstance = {
            uid: 'card-3',
            defId: 'test-card-3',
            ownerId: 'player1',
            baseInfluence: 6,
            faction: 'FACTION_MILITARY',
            abilityIds: [],
            difficulty: 2,
            modifiers: createModifierStack(),
            tags: createTagContainer(),
            signets: 0,
            ongoingMarkers: [],
            imagePath: 'test/card3',
        };

        const player2Card: CardInstance = {
            uid: 'card-4',
            defId: 'test-card-4',
            ownerId: 'player2',
            baseInfluence: 7,
            faction: 'FACTION_MYSTIC',
            abilityIds: [],
            difficulty: 2,
            modifiers: createModifierStack(),
            tags: createTagContainer(),
            signets: 0,
            ongoingMarkers: [],
            imagePath: 'test/card4',
        };

        const core: CardiaCore = {
            players: {
                player1: {
                    id: 'player1',
                    name: 'Player 1',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [existingCard],
                    signets: 1,
                    tags: createTagContainer(),
                    currentCard: player1Card,
                    hasPlayed: true,
                    cardRevealed: true,
                },
                player2: {
                    id: 'player2',
                    name: 'Player 2',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [],
                    signets: 0,
                    tags: createTagContainer(),
                    currentCard: player2Card,
                    hasPlayed: true,
                    cardRevealed: true,
                },
            },
            playerOrder: ['player1', 'player2'],
            currentPlayerId: 'player1',
            turnNumber: 5,
            phase: 'play',
            encounterHistory: [],
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            mechanicalSpiritActive: null,
            deckVariant: 'DECK_STANDARD',
            targetSignets: 5,
        };

        const event = {
            type: CARDIA_EVENTS.ENCOUNTER_RESOLVED,
            payload: {
                slotIndex: 0,
                winner: 'player2',
                loser: 'player1',
            },
        };

        const newCore = reduce(core, event);

        // 验证 player1 现在有两张卡牌
        expect(newCore.players.player1.playedCards).toHaveLength(2);
        
        // 第一张卡牌的 encounterIndex 应该保持不变
        expect(newCore.players.player1.playedCards[0].encounterIndex).toBe(1);
        
        // 第二张卡牌的 encounterIndex 应该是当前 turnNumber
        expect(newCore.players.player1.playedCards[1].encounterIndex).toBe(5);
        expect(newCore.players.player1.playedCards[1].uid).toBe('card-3');

        // 验证 player2 的新卡牌
        expect(newCore.players.player2.playedCards).toHaveLength(1);
        expect(newCore.players.player2.playedCards[0].encounterIndex).toBe(5);
        expect(newCore.players.player2.playedCards[0].uid).toBe('card-4');
    });
});
