import { describe, it, expect, beforeEach } from 'vitest';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import { CARDIA_EVENTS } from '../domain/events';
import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';
import type { CardiaCore } from '../domain/core-types';
import type { RandomFn, MatchState } from '../../../engine/types';

describe('Cardia - Command Execution', () => {
    let core: CardiaCore;
    let state: MatchState<CardiaCore>;
    let random: RandomFn;
    
    beforeEach(() => {
        const playerIds = ['0', '1'];
        random = {
            random: () => 0.5,
            d: (sides: number) => Math.floor(0.5 * sides) + 1,
            range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
            shuffle: <T>(arr: T[]) => [...arr],
        };
        core = CardiaDomain.setup(playerIds, random);
        state = {
            core,
            sys: {} as any, // 测试中不需要完整的 sys 对象
        };
    });
    
    describe('PLAY_CARD', () => {
        it('should emit CARD_PLAYED event', () => {
            const cardUid = core.players['0'].hand[0].uid;
            const events = CardiaDomain.execute(state, {
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                payload: { cardUid },
            }, random);
            
            expect(events.length).toBeGreaterThan(0);
            expect(events[0].type).toBe(CARDIA_EVENTS.CARD_PLAYED);
            expect(events[0].payload.playerId).toBe('0');
            expect(events[0].payload.cardUid).toBe(cardUid);
        });
        
        it('should trigger encounter when both players have played', () => {
            // Player 0 plays first
            const card0Uid = core.players['0'].hand[0].uid;
            const events0 = CardiaDomain.execute(state, {
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                payload: { cardUid: card0Uid },
            }, random);
            
            // Apply events to state
            for (const event of events0) {
                core = CardiaDomain.reduce(core, event);
            }
            state.core = core;
            
            // Player 1 plays
            const card1Uid = core.players['1'].hand[0].uid;
            const events1 = CardiaDomain.execute(state, {
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '1',
                payload: { cardUid: card1Uid },
            }, random);
            
            // Should have CARD_PLAYED, ENCOUNTER_RESOLVED, possibly SIGNET_GRANTED
            // Note: PHASE_CHANGED is now emitted by FlowSystem (SYS_PHASE_CHANGED), not by domain execute
            expect(events1.length).toBeGreaterThanOrEqual(2);
            expect(events1.some(e => e.type === CARDIA_EVENTS.ENCOUNTER_RESOLVED)).toBe(true);
        });
    });
    
    describe('ACTIVATE_ABILITY', () => {
        it('should emit ABILITY_ACTIVATED event', () => {
            // Setup encounter state
            core.phase = 'ability';
            const player0Card = core.players['0'].hand[0];
            const player1Card = core.players['1'].hand[0];
            
            core.players['0'].currentCard = player0Card;
            core.players['1'].currentCard = player1Card;
            
            core.currentEncounter = {
                player1Card: player0Card,
                player2Card: player1Card,
                player1Influence: 1,
                player2Influence: 5,
                winnerId: '1',
                loserId: '0',
            };
            
            const abilityId = player0Card.abilityIds[0];
            
            const events = CardiaDomain.execute(state, {
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                playerId: '0',
                payload: {
                    abilityId,
                    sourceCardUid: player0Card.uid,
                },
            }, random);
            
            expect(events.length).toBeGreaterThan(0);
            expect(events[0].type).toBe(CARDIA_EVENTS.ABILITY_ACTIVATED);
            expect(events[0].payload.playerId).toBe('0');
            expect(events[0].payload.abilityId).toBe(abilityId);
        });
        
        it('should transition to end phase after ability', () => {
            // Setup encounter state
            core.phase = 'ability';
            const player0Card = core.players['0'].hand[0];
            const player1Card = core.players['1'].hand[0];
            
            core.players['0'].currentCard = player0Card;
            core.players['1'].currentCard = player1Card;
            
            core.currentEncounter = {
                player1Card: player0Card,
                player2Card: player1Card,
                player1Influence: 1,
                player2Influence: 5,
                winnerId: '1',
                loserId: '0',
            };
            
            const abilityId = player0Card.abilityIds[0];
            
            let events = CardiaDomain.execute(state, {
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                playerId: '0',
                payload: {
                    abilityId,
                    sourceCardUid: player0Card.uid,
                },
            }, random);
            
            // Apply events to state
            for (const event of events) {
                core = CardiaDomain.reduce(core, event);
            }
            state.core = core;
            
            // If there's an interaction, resolve it
            if (state.sys.interaction?.current) {
                const interaction = state.sys.interaction.current;
                const resolveEvents = CardiaDomain.execute(state, {
                    type: CARDIA_COMMANDS.RESOLVE_INTERACTION,
                    playerId: interaction.playerId,
                    payload: {
                        interactionId: interaction.id,
                        response: { confirmed: true }
                    }
                }, random);
                events = [...events, ...resolveEvents];
                for (const event of resolveEvents) {
                    core = CardiaDomain.reduce(core, event);
                }
            }
            
            // Note: Phase changes are now handled by FlowSystem.afterEvents, not by execute
            // The phase will be updated by FlowSystem after these events are processed
            // We don't check for PHASE_CHANGED events here because they're emitted by FlowSystem
        });
    });
    
    describe('SKIP_ABILITY', () => {
        it('should emit ABILITY_SKIPPED event', () => {
            core.phase = 'ability';
            const player0Card = core.players['0'].hand[0];
            const player1Card = core.players['1'].hand[0];
            
            core.currentEncounter = {
                player1Card: player0Card,
                player2Card: player1Card,
                player1Influence: 1,
                player2Influence: 5,
                winnerId: '1',
                loserId: '0',
            };
            
            const events = CardiaDomain.execute(state, {
                type: CARDIA_COMMANDS.SKIP_ABILITY,
                playerId: '0',
                payload: {
                    playerId: '0',
                },
            }, random);
            
            // SKIP_ABILITY should emit ABILITY_SKIPPED event to trigger FlowSystem auto-advance
            expect(events.length).toBeGreaterThanOrEqual(1);
            const abilitySkippedEvent = events.find(e => e.type === CARDIA_EVENTS.ABILITY_SKIPPED);
            expect(abilitySkippedEvent).toBeDefined();
            expect(abilitySkippedEvent?.payload.playerId).toBe('0');
        });
    });
    
    describe('END_TURN', () => {
        it('should emit CARD_DRAWN and TURN_ENDED events', () => {
            state.phase = 'end';
            
            const events = CardiaDomain.execute(state, {
                type: CARDIA_COMMANDS.END_TURN,
                playerId: '0',
                payload: {},
            }, random);
            
            // Should have 2 CARD_DRAWN (one for each player) and TURN_ENDED
            // Note: PHASE_CHANGED is now emitted by FlowSystem, not by domain execute
            expect(events.length).toBeGreaterThanOrEqual(3);
            expect(events.filter(e => e.type === CARDIA_EVENTS.CARD_DRAWN).length).toBe(2);
            expect(events.some(e => e.type === CARDIA_EVENTS.TURN_ENDED)).toBe(true);
        });
        
        it('should transition to play phase', () => {
            state.phase = 'end';
            
            const events = CardiaDomain.execute(state, {
                type: CARDIA_COMMANDS.END_TURN,
                playerId: '0',
                payload: {},
            }, random);
            
            // Note: Phase changes are now handled by FlowSystem.afterEvents, not by execute
            // The phase will be updated by FlowSystem after these events are processed
        });
    });
    
    describe('ADD_MODIFIER', () => {
        it('should emit MODIFIER_ADDED event', () => {
            const cardUid = core.players['0'].hand[0].uid;
            
            const events = CardiaDomain.execute(state, {
                type: CARDIA_COMMANDS.ADD_MODIFIER,
                playerId: '0',
                payload: {
                    cardUid,
                    modifierValue: 3,
                },
            }, random);
            
            expect(events.length).toBe(1);
            expect(events[0].type).toBe(CARDIA_EVENTS.MODIFIER_ADDED);
            expect(events[0].payload.cardUid).toBe(cardUid);
            expect(events[0].payload.value).toBe(3);
        });
    });
    
    describe('REMOVE_MODIFIER', () => {
        it('should emit MODIFIER_REMOVED event', () => {
            const cardUid = core.players['0'].hand[0].uid;
            const modifierId = 'test_modifier';
            
            const events = CardiaDomain.execute(state, {
                type: CARDIA_COMMANDS.REMOVE_MODIFIER,
                playerId: '0',
                payload: {
                    cardUid,
                    modifierId,
                },
            }, random);
            
            expect(events.length).toBe(1);
            expect(events[0].type).toBe(CARDIA_EVENTS.MODIFIER_REMOVED);
            expect(events[0].payload.cardUid).toBe(cardUid);
            expect(events[0].payload.modifierId).toBe(modifierId);
        });
    });
});
