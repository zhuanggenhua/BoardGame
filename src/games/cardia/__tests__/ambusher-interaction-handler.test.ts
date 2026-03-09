/**
 * 单元测试：验证伏击者的交互处理器
 * 
 * 目的：验证交互处理器是否正确返回 CARDS_DISCARDED 事件
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { registerFactionInteractionHandlers } from '../domain/abilities/group7-faction';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { ABILITY_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaCore, CardInstance } from '../domain/core-types';
import type { MatchState, RandomFn } from '../../../../engine/types';

describe('伏击者交互处理器', () => {
    beforeEach(() => {
        // 注册交互处理器
        registerFactionInteractionHandlers();
    });
    
    it('应该正确返回 CARDS_DISCARDED 事件', () => {
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
        
        const core: CardiaCore = {
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
                    hand: [card1, card2, card3], // P2 有 3 张手牌（2 张 Academy + 1 张 Guild）
                    deck: [],
                    discard: [],
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
        
        const state: MatchState<CardiaCore> = {
            core,
            sys: {
                interaction: {
                    current: null,
                    queue: [],
                },
                gameover: null,
            },
        };
        
        const random: RandomFn = {
            random: () => Math.random(),
            d: (max: number) => Math.floor(Math.random() * max) + 1,
            range: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
            shuffle: <T>(array: T[]) => {
                const result = [...array];
                for (let i = result.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [result[i], result[j]] = [result[j], result[i]];
                }
                return result;
            },
        };
        
        // 获取交互处理器
        const handler = getInteractionHandler(ABILITY_IDS.AMBUSHER);
        
        console.log('Handler found:', !!handler);
        expect(handler).toBeDefined();
        
        if (!handler) {
            throw new Error('Handler not found');
        }
        
        // 调用交互处理器（P1 选择 Academy 派系）
        const value = { faction: 'academy' };
        const result = handler(state, '0', value, undefined, random, Date.now());
        
        console.log('Handler result:', {
            hasResult: !!result,
            eventsCount: result?.events?.length || 0,
            events: result?.events?.map(e => ({ type: e.type, payload: e.payload })),
        });
        
        // 验证结果
        expect(result).toBeDefined();
        expect(result!.events).toBeDefined();
        expect(result!.events.length).toBe(1);
        
        // 验证事件类型
        const event = result!.events[0];
        expect(event.type).toBe(CARDIA_EVENTS.CARDS_DISCARDED);
        
        // 验证事件 payload
        expect(event.payload).toEqual({
            playerId: '1', // 对手 ID
            cardIds: ['card_1', 'card_2'], // 2 张 Academy 派系的牌
            from: 'hand',
        });
        
        console.log('✅ 交互处理器正确返回 CARDS_DISCARDED 事件');
    });
});
