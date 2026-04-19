import { describe, it, expect } from 'vitest';
import { CardiaDomain } from '../domain';
import { createFixedRandom } from './helpers/testRandom';

describe('Cardia - Smoke Test', () => {
    it('should setup initial state without errors', () => {
        const playerIds = ['player1', 'player2'];
        const random = createFixedRandom(0.5);
        
        const initialState = CardiaDomain.setup(playerIds, random);
        
        expect(initialState).toBeDefined();
        expect(initialState.players).toBeDefined();
        expect(Object.keys(initialState.players)).toHaveLength(2);
        expect(initialState.currentPlayerId).toBe('player1');
        expect(initialState.turnNumber).toBe(1);
        expect(initialState.phase).toBe('play');
        expect(initialState.deckVariant).toBe('I');
        expect(initialState.targetSignets).toBe(5);
    });
    
    it('should have valid player states', () => {
        const playerIds = ['player1', 'player2'];
        const random = createFixedRandom(0.5);
        
        const initialState = CardiaDomain.setup(playerIds, random);
        
        Object.values(initialState.players).forEach(player => {
            expect(player.id).toBeDefined();
            // 初始手牌应该有5张
            expect(player.hand).toHaveLength(5);
            // 初始牌库应该有11张（16 - 5）
            expect(player.deck).toHaveLength(11);
            // 弃牌堆应该为空
            expect(player.discard).toEqual([]);
            // 印戒数量应该为0
            expect(player.signets).toBe(0);
            // 未打出卡牌
            expect(player.hasPlayed).toBe(false);
        });
    });
    
    it('should not be game over initially', () => {
        const playerIds = ['player1', 'player2'];
        const random = createFixedRandom(0.5);
        
        const initialState = CardiaDomain.setup(playerIds, random);
        const gameOver = CardiaDomain.isGameOver(initialState);
        
        expect(gameOver).toBeUndefined();
    });
});
