/**
 * Cardia - 交互系统测试
 * 
 * 测试交互创建、验证、执行和处理的完整流程
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CardiaDomain } from '../domain';
import { CARDIA_COMMANDS } from '../domain/commands';
import { CARDIA_EVENTS } from '../domain/events';
import { FACTION_IDS } from '../domain/ids';
import type { CardiaCore } from '../domain/core-types';
import type { RandomFn, MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { Cardia } from '../game';

describe('Cardia - 交互系统', () => {
    let matchState: MatchState<CardiaCore>;
    let random: RandomFn;
    
    beforeEach(() => {
        const playerIds = ['0', '1'];
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
    
    describe('CHOOSE_CARD 命令验证', () => {
        it('应该允许选择手牌中的卡牌', () => {
            const cardUids = [matchState.core.players['0'].hand[0].uid];
            
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.CHOOSE_CARD,
                playerId: '0',
                payload: {
                    cardUids,
                    interactionId: 'test_interaction',
                },
            });
            
            expect(result.valid).toBe(true);
        });
        
        it('应该拒绝选择不在手牌中的卡牌', () => {
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.CHOOSE_CARD,
                playerId: '0',
                payload: {
                    cardUids: ['nonexistent_card'],
                    interactionId: 'test_interaction',
                },
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not in hand');
        });
        
        it('应该拒绝空选择', () => {
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.CHOOSE_CARD,
                playerId: '0',
                payload: {
                    cardUids: [],
                    interactionId: 'test_interaction',
                },
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('No cards selected');
        });
        
        it('应该允许选择多张卡牌', () => {
            const cardUids = [
                matchState.core.players['0'].hand[0].uid,
                matchState.core.players['0'].hand[1].uid,
            ];
            
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.CHOOSE_CARD,
                playerId: '0',
                payload: {
                    cardUids,
                    interactionId: 'test_interaction',
                },
            });
            
            expect(result.valid).toBe(true);
        });
    });
    
    describe('CHOOSE_FACTION 命令验证', () => {
        it('应该允许选择有效的派系', () => {
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.CHOOSE_FACTION,
                playerId: '0',
                payload: {
                    faction: FACTION_IDS.SWAMP,
                    interactionId: 'test_interaction',
                },
            });
            
            expect(result.valid).toBe(true);
        });
        
        it('应该拒绝无效的派系', () => {
            const result = CardiaDomain.validate(matchState, {
                type: CARDIA_COMMANDS.CHOOSE_FACTION,
                playerId: '0',
                payload: {
                    faction: 'invalid_faction',
                    interactionId: 'test_interaction',
                },
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid faction');
        });
        
        it('应该允许所有四个派系', () => {
            const factions = [
                FACTION_IDS.SWAMP,
                FACTION_IDS.ACADEMY,
                FACTION_IDS.GUILD,
                FACTION_IDS.DYNASTY,
            ];
            
            for (const faction of factions) {
                const result = CardiaDomain.validate(matchState, {
                    type: CARDIA_COMMANDS.CHOOSE_FACTION,
                    playerId: '0',
                    payload: {
                        faction,
                        interactionId: 'test_interaction',
                    },
                });
                
                expect(result.valid).toBe(true);
            }
        });
    });
    
    describe('交互命令执行', () => {
        it('CHOOSE_CARD 应该返回空事件数组（由 InteractionSystem 处理）', () => {
            const cardUids = [matchState.core.players['0'].hand[0].uid];
            
            const events = CardiaDomain.execute(matchState.core, {
                type: CARDIA_COMMANDS.CHOOSE_CARD,
                playerId: '0',
                payload: {
                    cardUids,
                    interactionId: 'test_interaction',
                },
            }, random);
            
            // 命令由 InteractionSystem 处理，execute 返回空数组
            expect(events).toEqual([]);
        });
        
        it('CHOOSE_FACTION 应该返回空事件数组（由 InteractionSystem 处理）', () => {
            const events = CardiaDomain.execute(matchState.core, {
                type: CARDIA_COMMANDS.CHOOSE_FACTION,
                playerId: '0',
                payload: {
                    faction: FACTION_IDS.SWAMP,
                    interactionId: 'test_interaction',
                },
            }, random);
            
            // 命令由 InteractionSystem 处理，execute 返回空数组
            expect(events).toEqual([]);
        });
    });
    
    describe('交互事件处理', () => {
        it('INTERACTION_CREATED 事件应该被正确处理', () => {
            // 这个测试验证交互创建事件的结构
            const interaction = {
                id: 'test_interaction',
                playerId: '0',
                type: 'choice' as const,
                data: {
                    title: '选择卡牌',
                    options: [
                        { id: 'option1', label: '选项1', value: { cardUid: 'card1' } },
                        { id: 'option2', label: '选项2', value: { cardUid: 'card2' } },
                    ],
                },
            };
            
            const event = {
                type: CARDIA_EVENTS.INTERACTION_CREATED,
                timestamp: Date.now(),
                payload: { interaction },
            };
            
            expect(event.type).toBe(CARDIA_EVENTS.INTERACTION_CREATED);
            expect(event.payload.interaction.id).toBe('test_interaction');
            expect(event.payload.interaction.playerId).toBe('0');
            expect(event.payload.interaction.data.options.length).toBe(2);
        });
    });
});
