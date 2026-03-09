import { describe, it, expect, beforeEach } from 'vitest';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import type { CardiaCore } from '../domain/core-types';
import type { RandomFn, MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { Cardia } from '../game';

describe('Cardia - Command Validation', () => {
    let matchState: MatchState<CardiaCore>;
    let random: RandomFn;
    
    beforeEach(() => {
        const playerIds = ['0', '1'];
        // 创建符合 RandomFn 接口的 random 对象
        random = {
            random: () => 0.5,
            d: (sides: number) => Math.floor(0.5 * sides) + 1,
            range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
            shuffle: <T>(arr: T[]) => [...arr],
        };
        const core = CardiaDomain.setup(playerIds, random);
        const sys = createInitialSystemState(playerIds, Cardia.systems, undefined);
        matchState = { core, sys };
    });
    
    describe('PLAY_CARD', () => {
        it('should allow playing card in play phase', () => {
            const cardUid = matchState.core.players['0'].hand[0].uid;
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                payload: { cardUid },
            });
            
            expect(result.valid).toBe(true);
        });
        
        it('should reject playing card in wrong phase', () => {
            matchState.core.phase = 'ability';
            matchState.sys.phase = 'ability';
            const cardUid = matchState.core.players['0'].hand[0].uid;
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                payload: { cardUid },
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Not in play phase');
        });
        
        it('should allow any player to play card in play phase (simultaneous play)', () => {
            // Cardia 是同时打出卡牌的游戏，任何玩家都可以在打出卡牌阶段打出卡牌
            const cardUid = matchState.core.players['1'].hand[0].uid;
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '1',
                payload: { cardUid },
            });
            
            expect(result.valid).toBe(true);
        });
        
        it('should reject playing card not in hand', () => {
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                payload: { cardUid: 'nonexistent' },
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Card not in hand');
        });
        
        it('should reject playing card when already played', () => {
            matchState.core.players['0'].hasPlayed = true;
            const cardUid = matchState.core.players['0'].hand[0].uid;
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                payload: { cardUid },
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Already played a card this turn');
        });
    });
    
    describe('ACTIVATE_ABILITY', () => {
        it('should allow activating ability in ability phase when loser', () => {
            // 设置遭遇战状态
            matchState.core.phase = 'ability';
            matchState.sys.phase = 'ability';
            const player0Card = matchState.core.players['0'].hand[0];
            const player1Card = matchState.core.players['1'].hand[0];
            
            // 将卡牌添加到场上（模拟已打出的卡牌）
            matchState.core.players['0'].playedCards = [player0Card];
            matchState.core.players['1'].playedCards = [player1Card];
            
            matchState.core.players['0'].currentCard = player0Card;
            matchState.core.players['1'].currentCard = player1Card;
            
            matchState.core.currentEncounter = {
                player1Card: player0Card,
                player2Card: player1Card,
                player1Influence: 1,
                player2Influence: 5,
                winnerId: '1',
                loserId: '0',
            };
            
            const abilityId = player0Card.abilityIds[0];
            
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                playerId: '0',
                payload: {
                    abilityId,
                    sourceCardUid: player0Card.uid,
                },
            });
            
            expect(result.valid).toBe(true);
        });
        
        it('should reject activating ability in wrong phase', () => {
            matchState.core.phase = 'play';
            matchState.sys.phase = 'play';
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                playerId: '0',
                payload: {
                    abilityId: 'ability_1_1',
                    sourceCardUid: 'any',
                },
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Not in ability phase');
        });
        
        it('should reject activating ability when not loser', () => {
            matchState.core.phase = 'ability';
            matchState.sys.phase = 'ability';
            const player0Card = matchState.core.players['0'].hand[0];
            const player1Card = matchState.core.players['1'].hand[0];
            
            // 将卡牌添加到场上（模拟已打出的卡牌）
            matchState.core.players['0'].playedCards = [player0Card];
            matchState.core.players['1'].playedCards = [player1Card];
            
            matchState.core.players['0'].currentCard = player0Card;
            matchState.core.players['1'].currentCard = player1Card;
            
            matchState.core.currentEncounter = {
                player1Card: player0Card,
                player2Card: player1Card,
                player1Influence: 5,
                player2Influence: 1,
                winnerId: '0',
                loserId: '1',
            };
            
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                playerId: '0',
                payload: {
                    abilityId: 'ability_1_1',
                    sourceCardUid: player0Card.uid,
                },
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Only the loser can activate abilities');
        });
    });
    
    describe('SKIP_ABILITY', () => {
        it('should allow skipping ability in ability phase when loser', () => {
            matchState.core.phase = 'ability';
            matchState.sys.phase = 'ability';
            const player0Card = matchState.core.players['0'].hand[0];
            const player1Card = matchState.core.players['1'].hand[0];
            
            matchState.core.currentEncounter = {
                player1Card: player0Card,
                player2Card: player1Card,
                player1Influence: 1,
                player2Influence: 5,
                winnerId: '1',
                loserId: '0',
            };
            
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.SKIP_ABILITY,
                playerId: '0',
                payload: {},
            });
            
            expect(result.valid).toBe(true);
        });
        
        it('should reject skipping ability in wrong phase', () => {
            matchState.core.phase = 'play';
            matchState.sys.phase = 'play';
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.SKIP_ABILITY,
                playerId: '0',
                payload: {},
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Not in ability phase');
        });
    });
    
    describe('END_TURN', () => {
        it('should allow ending turn in end phase', () => {
            matchState.core.phase = 'end';
            matchState.sys.phase = 'end';
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.END_TURN,
                playerId: '0',
                payload: {},
            });
            
            expect(result.valid).toBe(true);
        });
        
        it('should reject ending turn in wrong phase', () => {
            matchState.core.phase = 'play';
            matchState.sys.phase = 'play';
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.END_TURN,
                playerId: '0',
                payload: {},
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Not in end phase');
        });
        
        it('should reject ending turn when not current player', () => {
            matchState.core.phase = 'end';
            matchState.sys.phase = 'end';
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.END_TURN,
                playerId: '1',
                payload: {},
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Not your turn');
        });
    });
});
