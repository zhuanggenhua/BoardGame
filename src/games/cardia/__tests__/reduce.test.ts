import { describe, it, expect, beforeEach } from 'vitest';
import { CardiaDomain } from '../domain';
import { CARDIA_EVENTS } from '../domain/events';
import type { CardiaCore } from '../domain/core-types';
import type { RandomFn } from '../../../engine/types';

describe('Cardia - Event Reduction', () => {
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
    
    describe('CARD_PLAYED', () => {
        it('should remove card from hand and set as current card', () => {
            const cardUid = state.players['0'].hand[0].uid;
            const initialHandSize = state.players['0'].hand.length;
            
            const newState = CardiaDomain.reduce(state, {
                type: CARDIA_EVENTS.CARD_PLAYED,
                timestamp: Date.now(),
                payload: {
                    playerId: '0',
                    cardUid,
                    cardDefId: 'card_1_1',
                },
            });
            
            expect(newState.players['0'].hand.length).toBe(initialHandSize - 1);
            expect(newState.players['0'].currentCard?.uid).toBe(cardUid);
            expect(newState.players['0'].hasPlayed).toBe(true);
        });
    });
    
    describe('ENCOUNTER_RESOLVED', () => {
        it('should set current encounter', () => {
            const player0Card = state.players['0'].hand[0];
            const player1Card = state.players['1'].hand[0];
            
            state.players['0'].currentCard = player0Card;
            state.players['1'].currentCard = player1Card;
            
            const newState = CardiaDomain.reduce(state, {
                type: CARDIA_EVENTS.ENCOUNTER_RESOLVED,
                timestamp: Date.now(),
                payload: {
                    slotIndex: 0,
                    winner: '0',
                    loser: '1',
                },
            });
            
            expect(newState.currentEncounter).toBeDefined();
            expect(newState.currentEncounter?.winnerId).toBe('0');
            expect(newState.currentEncounter?.loserId).toBe('1');
            expect(newState.encounterHistory.length).toBe(1);
        });
    });
    
    describe('SIGNET_GRANTED', () => {
        it('should add signet to card on board', () => {
            // 先将卡牌放到场上
            const card = state.players['0'].hand[0];
            const playedCard = {
                ...card,
                encounterIndex: 1,
            };
            
            const stateWithPlayedCard = {
                ...state,
                players: {
                    ...state.players,
                    '0': {
                        ...state.players['0'],
                        playedCards: [playedCard],
                    },
                },
            };
            
            const newState = CardiaDomain.reduce(stateWithPlayedCard, {
                type: CARDIA_EVENTS.SIGNET_GRANTED,
                timestamp: Date.now(),
                payload: {
                    playerId: '0',
                    cardUid: card.uid,
                },
            });
            
            // 验证卡牌上的印戒数量增加
            expect(newState.players['0'].playedCards[0].signets).toBe(1);
        });
    });
    
    describe('CARD_DRAWN', () => {
        it('should move cards from deck to hand', () => {
            const initialHandSize = state.players['0'].hand.length;
            const initialDeckSize = state.players['0'].deck.length;
            
            const newState = CardiaDomain.reduce(state, {
                type: CARDIA_EVENTS.CARD_DRAWN,
                timestamp: Date.now(),
                payload: {
                    playerId: '0',
                    count: 2,
                },
            });
            
            expect(newState.players['0'].hand.length).toBe(initialHandSize + 2);
            expect(newState.players['0'].deck.length).toBe(initialDeckSize - 2);
        });
    });
    
    describe('MODIFIER_ADDED', () => {
        it('should add modifier to current card', () => {
            const player0Card = state.players['0'].hand[0];
            state.players['0'].currentCard = player0Card;
            
            const newState = CardiaDomain.reduce(state, {
                type: CARDIA_EVENTS.MODIFIER_ADDED,
                timestamp: Date.now(),
                payload: {
                    cardUid: player0Card.uid,
                    value: 3,
                    playerId: '0',
                },
            });
            
            expect(newState.players['0'].currentCard?.modifiers).toBeDefined();
            // Modifier stack should have the new modifier
            expect(newState.players['0'].currentCard?.modifiers.entries.length).toBeGreaterThan(0);
        });
    });
    
    describe('TURN_ENDED', () => {
        it('should switch current player and increment turn number', () => {
            const initialTurnNumber = state.turnNumber;
            const initialCurrentPlayer = state.currentPlayerId;
            
            const newState = CardiaDomain.reduce(state, {
                type: CARDIA_EVENTS.TURN_ENDED,
                timestamp: Date.now(),
                payload: {
                    playerId: '0',
                    newTurnNumber: initialTurnNumber + 1,
                },
            });
            
            expect(newState.turnNumber).toBe(initialTurnNumber + 1);
            expect(newState.currentPlayerId).not.toBe(initialCurrentPlayer);
            expect(newState.players['0'].hasPlayed).toBe(false);
            expect(newState.players['1'].hasPlayed).toBe(false);
            expect(newState.currentEncounter).toBeUndefined();
        });
    });
    
    describe('PHASE_CHANGED', () => {
        it('should update game phase', () => {
            const newState = CardiaDomain.reduce(state, {
                type: CARDIA_EVENTS.PHASE_CHANGED,
                timestamp: Date.now(),
                payload: {
                    oldPhase: 'play',
                    newPhase: 'ability',
                },
            });
            
            expect(newState.phase).toBe('ability');
        });
    });
    
    describe('CARDS_DISCARDED', () => {
        it('should move card from hand to discard', () => {
            const cardUid = state.players['0'].hand[0].uid;
            const initialHandSize = state.players['0'].hand.length;
            const initialDiscardSize = state.players['0'].discard.length;
            
            const newState = CardiaDomain.reduce(state, {
                type: CARDIA_EVENTS.CARDS_DISCARDED,
                timestamp: Date.now(),
                payload: {
                    playerId: '0',
                    cardIds: [cardUid],
                    from: 'hand',
                },
            });
            
            expect(newState.players['0'].hand.length).toBe(initialHandSize - 1);
            expect(newState.players['0'].discard.length).toBe(initialDiscardSize + 1);
        });
    });
    
    describe('CARD_RECYCLED', () => {
        it('should move card from discard to hand', () => {
            // First add a card to discard
            const card = state.players['0'].hand[0];
            state.players['0'].discard.push(card);
            
            const initialHandSize = state.players['0'].hand.length;
            const initialDiscardSize = state.players['0'].discard.length;
            
            const newState = CardiaDomain.reduce(state, {
                type: CARDIA_EVENTS.CARD_RECYCLED,
                timestamp: Date.now(),
                payload: {
                    playerId: '0',
                    cardId: card.uid,
                    from: 'discard',
                },
            });
            
            expect(newState.players['0'].hand.length).toBe(initialHandSize + 1);
            expect(newState.players['0'].discard.length).toBe(initialDiscardSize - 1);
        });
    });
});
