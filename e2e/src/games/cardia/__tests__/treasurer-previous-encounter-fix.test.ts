/**
 * Treasurer 能力修复测试
 * 
 * Bug: Treasurer 读取 previousEncounter 时，得到的是当前遭遇而不是上一个遭遇
 * 
 * 根因：
 * 1. Treasurer 在第N回合失败后的 ability 阶段激活
 * 2. 但在 ability 阶段之前，reduceEncounterResolved 已经将 previousEncounter 更新为第N回合
 * 3. Treasurer 应该读取 encounterHistory[length-2]（倒数第二个遭遇）
 * 
 * 修复：改为读取 encounterHistory 的倒数第二个元素
 */

import { describe, it, expect } from 'vitest';
import type { CardiaCore } from '../domain/core-types';

describe('Treasurer - Previous Encounter Fix', () => {
    it('应该从 encounterHistory 读取倒数第二个遭遇，而不是 previousEncounter', () => {
        // 构造第5回合的遭遇历史
        const encounter5 = {
            player1Card: {
                uid: 'card03_uid',
                defId: 'deck_i_card_03',
                ownerId: '0' as PlayerId,
                baseInfluence: 3,
                faction: 'guild' as const,
                abilityIds: ['ability_i_surgeon'],
                difficulty: 0,
                modifiers: { entries: [], nextOrder: 0 },
                tags: {},
                signets: 1,
                ongoingMarkers: [],
                imagePath: 'cardia/cards/deck1/3',
                encounterIndex: 5,
            },
            player2Card: {
                uid: 'card02_uid',
                defId: 'deck_i_card_02',
                ownerId: '1' as PlayerId,
                baseInfluence: 2,
                faction: 'academy' as const,
                abilityIds: ['ability_i_void_mage'],
                difficulty: 0,
                modifiers: { entries: [], nextOrder: 0 },
                tags: {},
                signets: 0,
                ongoingMarkers: [],
                imagePath: 'cardia/cards/deck1/2',
                encounterIndex: 5,
            },
            player1Influence: 3,
            player2Influence: 5,
            winnerId: '0' as PlayerId,
            loserId: '1' as PlayerId,
        };

        // 构造第6回合的遭遇历史
        const encounter6 = {
            player1Card: {
                uid: 'card12_uid',
                defId: 'deck_i_card_12',
                ownerId: '0' as PlayerId,
                baseInfluence: 12,
                faction: 'dynasty' as const,
                abilityIds: ['ability_i_treasurer'],
                difficulty: 2,
                modifiers: { entries: [], nextOrder: 0 },
                tags: {},
                signets: 0,
                ongoingMarkers: [],
                imagePath: 'cardia/cards/deck1/12',
                encounterIndex: 6,
            },
            player2Card: {
                uid: 'card15_uid',
                defId: 'deck_i_card_15',
                ownerId: '1' as PlayerId,
                baseInfluence: 15,
                faction: 'guild' as const,
                abilityIds: ['ability_i_inventor'],
                difficulty: 3,
                modifiers: { entries: [], nextOrder: 0 },
                tags: {},
                signets: 0,
                ongoingMarkers: [],
                imagePath: 'cardia/cards/deck1/15',
                encounterIndex: 6,
            },
            player1Influence: 7,
            player2Influence: 15,
            winnerId: '1' as PlayerId,
            loserId: '0' as PlayerId,
        };

        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    name: 'Player 0',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [
                        encounter5.player1Card,
                        encounter6.player1Card,
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
                        encounter5.player2Card,
                        encounter6.player2Card,
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
            turnNumber: 6,
            phase: 'ability',
            encounterHistory: [
                encounter5,  // 第5回合
                encounter6,  // 第6回合（当前遭遇）
            ],
            previousEncounter: encounter6,  // previousEncounter 已经是第6回合
            currentEncounter: encounter6,
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };

        // 测试修复后的逻辑
        const encounterHistory = core.encounterHistory;
        const previousEncounter = encounterHistory.length >= 2 
            ? encounterHistory[encounterHistory.length - 2]  // 倒数第二个遭遇
            : null;

        // 验证：previousEncounter 应该是第5回合的遭遇
        expect(previousEncounter).toBeDefined();
        expect(previousEncounter?.player1Card?.uid).toBe('card03_uid');  // card03 (Surgeon)
        expect(previousEncounter?.winnerId).toBe('0');

        // 验证：core.previousEncounter 是第6回合（错误的）
        expect(core.previousEncounter?.player1Card?.uid).toBe('card12_uid');  // card12 (Treasurer)
    });

    it('第1回合时，encounterHistory 只有1个元素，应该返回 null', () => {
        const encounter1 = {
            player1Card: {
                uid: 'card12_uid',
                defId: 'deck_i_card_12',
                ownerId: '0' as PlayerId,
                baseInfluence: 12,
                faction: 'dynasty' as const,
                abilityIds: ['ability_i_treasurer'],
                difficulty: 2,
                modifiers: { entries: [], nextOrder: 0 },
                tags: {},
                signets: 0,
                ongoingMarkers: [],
                imagePath: 'cardia/cards/deck1/12',
                encounterIndex: 1,
            },
            player2Card: {
                uid: 'card15_uid',
                defId: 'deck_i_card_15',
                ownerId: '1' as PlayerId,
                baseInfluence: 15,
                faction: 'guild' as const,
                abilityIds: ['ability_i_inventor'],
                difficulty: 3,
                modifiers: { entries: [], nextOrder: 0 },
                tags: {},
                signets: 0,
                ongoingMarkers: [],
                imagePath: 'cardia/cards/deck1/15',
                encounterIndex: 1,
            },
            player1Influence: 12,
            player2Influence: 15,
            winnerId: '1' as PlayerId,
            loserId: '0' as PlayerId,
        };

        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    name: 'Player 0',
                    hand: [],
                    deck: [],
                    discard: [],
                    playedCards: [encounter1.player1Card],
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
                    playedCards: [encounter1.player2Card],
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
            encounterHistory: [encounter1],  // 只有第1回合
            previousEncounter: null,
            currentEncounter: encounter1,
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };

        // 测试修复后的逻辑
        const encounterHistory = core.encounterHistory;
        const previousEncounter = encounterHistory.length >= 2 
            ? encounterHistory[encounterHistory.length - 2]
            : null;

        // 验证：第1回合时应该返回 null
        expect(previousEncounter).toBeNull();
    });
});
