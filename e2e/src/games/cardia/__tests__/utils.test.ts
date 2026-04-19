/**
 * Cardia - 工具函数测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CardiaDomain } from '../domain';
import { 
    getOpponentId, 
    calculateCurrentInfluence,
    recalculateCardInfluence,
    getCardModifiers,
    getTotalSignets,
    checkStandardVictoryCondition
} from '../domain/utils';
import type { CardiaCore, ModifierToken } from '../domain/core-types';
import type { RandomFn } from '../../../engine/types';

describe('Cardia - 工具函数', () => {
    let state: CardiaCore;
    let random: RandomFn;
    
    beforeEach(() => {
        const playerIds = ['0', '1'];
        random = {
            random: () => 0.5,
            d: (sides: number) => Math.floor(0.5 * sides) + 1,
            range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
            shuffle: <T>(arr: T[]) => [...arr],
        };
        state = CardiaDomain.setup(playerIds, random);
    });
    
    describe('getOpponentId', () => {
        it('应该返回对手ID', () => {
            const opponentId = getOpponentId(state, '0');
            expect(opponentId).toBe('1');
            
            const opponentId2 = getOpponentId(state, '1');
            expect(opponentId2).toBe('0');
        });
    });
    
    describe('calculateCurrentInfluence', () => {
        it('应该返回基础影响力（无修正）', () => {
            const baseInfluence = 5;
            const modifiers: ModifierToken[] = [];
            
            const influence = calculateCurrentInfluence(baseInfluence, modifiers);
            expect(influence).toBe(5);
        });
        
        it('应该包含修正标记的影响', () => {
            const baseInfluence = 5;
            const modifiers: ModifierToken[] = [
                { id: 'mod1', cardId: 'card1', value: 3, sourceAbilityId: 'test' }
            ];
            
            const influence = calculateCurrentInfluence(baseInfluence, modifiers);
            expect(influence).toBe(8);
        });
        
        it('应该正确处理多个修正', () => {
            const baseInfluence = 5;
            const modifiers: ModifierToken[] = [
                { id: 'mod1', cardId: 'card1', value: 3, sourceAbilityId: 'test1' },
                { id: 'mod2', cardId: 'card1', value: -2, sourceAbilityId: 'test2' },
                { id: 'mod3', cardId: 'card1', value: 1, sourceAbilityId: 'test3' }
            ];
            
            const influence = calculateCurrentInfluence(baseInfluence, modifiers);
            expect(influence).toBe(7); // 5 + 3 - 2 + 1
        });
        
        it('应该正确处理负修正', () => {
            const baseInfluence = 5;
            const modifiers: ModifierToken[] = [
                { id: 'mod1', cardId: 'card1', value: -2, sourceAbilityId: 'test' }
            ];
            
            const influence = calculateCurrentInfluence(baseInfluence, modifiers);
            expect(influence).toBe(3);
        });
    });
    
    describe('getTotalSignets', () => {
        it('应该返回玩家场上所有印戒总和', () => {
            // 初始状态没有场上卡牌
            const total = getTotalSignets(state, '0');
            expect(total).toBe(0);
        });
        
        it('应该正确计算多张卡牌的印戒', () => {
            // 添加场上卡牌
            const card1 = { ...state.players['0'].hand[0], signets: 2, encounterIndex: 0 };
            const card2 = { ...state.players['0'].hand[1], signets: 1, encounterIndex: 1 };
            
            state.players['0'].playedCards = [card1, card2];
            
            const total = getTotalSignets(state, '0');
            expect(total).toBe(3);
        });
    });
    
    describe('checkStandardVictoryCondition', () => {
        it('应该在玩家达到目标印戒数时返回获胜者', () => {
            // 设置玩家0有5个印戒
            const card1 = { ...state.players['0'].hand[0], signets: 3, encounterIndex: 0 };
            const card2 = { ...state.players['0'].hand[1], signets: 2, encounterIndex: 1 };
            state.players['0'].playedCards = [card1, card2];
            
            const winner = checkStandardVictoryCondition(state);
            expect(winner).toBe('0');
        });
        
        it('应该在双方都未达到目标时返回null', () => {
            const winner = checkStandardVictoryCondition(state);
            expect(winner).toBeNull();
        });
    });
});
