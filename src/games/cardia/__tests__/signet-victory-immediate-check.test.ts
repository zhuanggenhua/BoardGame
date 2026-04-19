/**
 * 印戒胜利条件立即检查测试
 * 
 * 验证修复：游戏应该在任何玩家达到 5 个印戒时立即结束，而不是继续到 7+ 印戒
 * 
 * Bug 描述：
 * - 之前 isGameOver 只在 end 阶段检查印戒胜利条件
 * - 印戒在 play 阶段授予（遭遇解析时）
 * - 导致游戏继续多个回合，玩家可以达到 7+ 印戒
 * 
 * 修复：
 * - isGameOver 现在在所有阶段都检查印戒胜利条件
 * - 一旦任何玩家达到 5 个印戒，游戏立即结束
 */

import { describe, it, expect } from 'vitest';
import { CardiaDomain } from '../domain';
import type { CardiaCore } from '../domain/types';

describe('Cardia - Signet Victory Immediate Check', () => {
    /**
     * 测试1：play 阶段达到 5 印戒应立即触发胜利
     */
    it('should end game immediately when player reaches 5 signets in play phase', () => {
        // 创建一个玩家有 5 个印戒的状态（play 阶段）
        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    hand: [],
                    deck: [],
                    playedCards: [
                        { uid: 'card1', cardId: 'card1', playerId: '0', baseInfluence: 5, signets: 2 },
                        { uid: 'card2', cardId: 'card2', playerId: '0', baseInfluence: 5, signets: 3 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    playedCards: [
                        { uid: 'card3', cardId: 'card3', playerId: '1', baseInfluence: 5, signets: 1 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 1,
            phase: 'play',
            encounterHistory: [],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        const result = CardiaDomain.isGameOver(core);
        
        expect(result).toBeDefined();
        expect(result?.winner).toBe('0');
    });
    
    /**
     * 测试2：ability 阶段达到 5 印戒应立即触发胜利
     */
    it('should end game immediately when player reaches 5 signets in ability phase', () => {
        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    hand: [],
                    deck: [],
                    playedCards: [
                        { uid: 'card1', cardId: 'card1', playerId: '0', baseInfluence: 5, signets: 1 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    playedCards: [
                        { uid: 'card2', cardId: 'card2', playerId: '1', baseInfluence: 5, signets: 5 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '1',
            turnNumber: 1,
            phase: 'ability',
            encounterHistory: [],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        const result = CardiaDomain.isGameOver(core);
        
        expect(result).toBeDefined();
        expect(result?.winner).toBe('1');
    });
    
    /**
     * 测试3：end 阶段达到 5 印戒应触发胜利（保持原有行为）
     */
    it('should end game when player reaches 5 signets in end phase', () => {
        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    hand: [],
                    deck: [],
                    playedCards: [
                        { uid: 'card1', cardId: 'card1', playerId: '0', baseInfluence: 5, signets: 5 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    playedCards: [
                        { uid: 'card2', cardId: 'card2', playerId: '1', baseInfluence: 5, signets: 2 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 1,
            phase: 'end',
            encounterHistory: [],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        const result = CardiaDomain.isGameOver(core);
        
        expect(result).toBeDefined();
        expect(result?.winner).toBe('0');
    });
    
    /**
     * 测试4：4 个印戒不应触发胜利
     */
    it('should not end game when player has only 4 signets', () => {
        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    hand: [{ uid: 'hand-card-0', cardId: 'hand-card-0', playerId: '0', baseInfluence: 1, signets: 0 }],
                    deck: [],
                    playedCards: [
                        { uid: 'card1', cardId: 'card1', playerId: '0', baseInfluence: 5, signets: 4 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
                '1': {
                    id: '1',
                    hand: [{ uid: 'hand-card-1', cardId: 'hand-card-1', playerId: '1', baseInfluence: 1, signets: 0 }],
                    deck: [],
                    playedCards: [
                        { uid: 'card2', cardId: 'card2', playerId: '1', baseInfluence: 5, signets: 2 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 1,
            phase: 'play',
            encounterHistory: [],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        const result = CardiaDomain.isGameOver(core);
        
        expect(result).toBeUndefined();
    });
    
    /**
     * 测试5：双方同时达到 5 印戒，印戒多的获胜
     */
    it('should declare winner with more signets when both reach 5', () => {
        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    hand: [],
                    deck: [],
                    playedCards: [
                        { uid: 'card1', cardId: 'card1', playerId: '0', baseInfluence: 5, signets: 5 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    playedCards: [
                        { uid: 'card2', cardId: 'card2', playerId: '1', baseInfluence: 5, signets: 6 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 1,
            phase: 'play',
            encounterHistory: [],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        const result = CardiaDomain.isGameOver(core);
        
        expect(result).toBeDefined();
        expect(result?.winner).toBe('1');
    });
    
    /**
     * 测试6：双方同时达到相同印戒数（≥5），判定为平局
     */
    it('should declare draw when both players have same signets (≥5)', () => {
        const core: CardiaCore = {
            players: {
                '0': {
                    id: '0',
                    hand: [],
                    deck: [],
                    playedCards: [
                        { uid: 'card1', cardId: 'card1', playerId: '0', baseInfluence: 5, signets: 5 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    playedCards: [
                        { uid: 'card2', cardId: 'card2', playerId: '1', baseInfluence: 5, signets: 5 },
                    ],
                    currentCard: null,
                    signets: 0,
                    tags: { tags: {}, durations: {} },
                },
            },
            playerOrder: ['0', '1'],
            currentPlayerId: '0',
            turnNumber: 1,
            phase: 'play',
            encounterHistory: [],
            deckVariant: 'I',
            targetSignets: 5,
            ongoingAbilities: [],
            modifierTokens: [],
            delayedEffects: [],
            revealFirstNextEncounter: null,
            forcedPlayOrderNextEncounter: null,
            mechanicalSpiritActive: null,
        };
        
        const result = CardiaDomain.isGameOver(core);
        
        expect(result).toBeDefined();
        expect(result?.draw).toBe(true);
    });
});
