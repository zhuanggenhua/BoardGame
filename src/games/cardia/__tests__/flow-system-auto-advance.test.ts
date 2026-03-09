/**
 * FlowSystem 自动推进测试
 * 
 * 验证 FlowSystem.afterEvents 是否正确调用 onAutoContinueCheck
 * 并在满足条件时自动推进阶段
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { Cardia } from '../game';
import CardiaDomain from '../domain';
import type { CardiaCore } from '../domain/core-types';
import { CARDIA_COMMANDS } from '../domain/commands';
import { ABILITY_IDS } from '../domain/ids';

describe('FlowSystem Auto-Advance', () => {
    describe('play → ability 阶段自动推进', () => {
        it('遭遇战解析后有失败者时，应自动推进到 ability 阶段', () => {
            const playerIds = ['0', '1'];
            const runner = new GameTestRunner({
                domain: CardiaDomain,
                systems: Cardia.systems,
                playerIds,
                random: {
                    random: () => 0.5,
                    d: (sides: number) => Math.floor(0.5 * sides) + 1,
                    range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
                    shuffle: <T>(arr: T[]) => [...arr],
                },
            });
            
            // 玩家 0 打出卡牌（影响力 5）
            const p0Hand = runner.getState().core.players['0'].hand;
            const p0Card = p0Hand.find(c => c.baseInfluence === 5);
            expect(p0Card).toBeDefined();
            
            runner.dispatch({
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                payload: {
                    cardUid: p0Card!.uid,
                    slotIndex: 0,
                },
            });
            
            // 玩家 1 打出卡牌（影响力 3）
            const p1Hand = runner.getState().core.players['1'].hand;
            const p1Card = p1Hand.find(c => c.baseInfluence === 3);
            expect(p1Card).toBeDefined();
            
            runner.dispatch({
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '1',
                payload: {
                    cardUid: p1Card!.uid,
                    slotIndex: 0,
                },
            });
            
            // 验证：遭遇战解析后，应自动推进到 ability 阶段
            const state = runner.getState();
            expect(state.sys.phase).toBe('ability');
            expect(state.core.currentEncounter).toBeDefined();
            expect(state.core.currentEncounter!.loserId).toBe('1');
        });
        
        it('遭遇战平局时，应跳过 ability 阶段，直接进入下一回合', () => {
            const playerIds = ['0', '1'];
            const runner = new GameTestRunner({
                domain: CardiaDomain,
                systems: Cardia.systems,
                playerIds,
                random: {
                    random: () => 0.5,
                    d: (sides: number) => Math.floor(0.5 * sides) + 1,
                    range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
                    shuffle: <T>(arr: T[]) => [...arr],
                },
            });
            
            // 玩家 0 打出卡牌（影响力 5）
            const p0Hand = runner.getState().core.players['0'].hand;
            const p0Card = p0Hand.find(c => c.baseInfluence === 5);
            expect(p0Card).toBeDefined();
            
            runner.dispatch({
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                payload: {
                    cardUid: p0Card!.uid,
                    slotIndex: 0,
                },
            });
            
            // 玩家 1 打出卡牌（影响力 5，平局）
            const p1Hand = runner.getState().core.players['1'].hand;
            const p1Card = p1Hand.find(c => c.baseInfluence === 5);
            expect(p1Card).toBeDefined();
            
            runner.dispatch({
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '1',
                payload: {
                    cardUid: p1Card!.uid,
                    slotIndex: 0,
                },
            });
            
            // 验证：平局时，应跳过 ability 阶段，直接进入下一回合的 play 阶段
            const state = runner.getState();
            expect(state.sys.phase).toBe('play');
            expect(state.core.currentEncounter).toBeDefined();
            expect(state.core.currentEncounter!.winnerId).toBe('tie');
            expect(state.core.currentEncounter!.loserId).toBeNull();
        });
    });
    
    describe('ability → end 阶段自动推进', () => {
        it('跳过能力后，应自动推进到 end 阶段', () => {
            const playerIds = ['0', '1'];
            const runner = new GameTestRunner({
                domain: CardiaDomain,
                systems: Cardia.systems,
                playerIds,
                random: {
                    random: () => 0.5,
                    d: (sides: number) => Math.floor(0.5 * sides) + 1,
                    range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
                    shuffle: <T>(arr: T[]) => [...arr],
                },
            });
            
            // 玩家 0 打出卡牌（影响力 5）
            const p0Hand = runner.getState().core.players['0'].hand;
            const p0Card = p0Hand.find(c => c.baseInfluence === 5);
            expect(p0Card).toBeDefined();
            
            runner.dispatch({
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '0',
                payload: {
                    cardUid: p0Card!.uid,
                    slotIndex: 0,
                },
            });
            
            // 玩家 1 打出卡牌（影响力 3）
            const p1Hand = runner.getState().core.players['1'].hand;
            const p1Card = p1Hand.find(c => c.baseInfluence === 3);
            expect(p1Card).toBeDefined();
            
            runner.dispatch({
                type: CARDIA_COMMANDS.PLAY_CARD,
                playerId: '1',
                payload: {
                    cardUid: p1Card!.uid,
                    slotIndex: 0,
                },
            });
            
            // 验证：已进入 ability 阶段
            expect(runner.getState().sys.phase).toBe('ability');
            
            // 玩家 1（失败者）跳过能力
            runner.dispatch({
                type: CARDIA_COMMANDS.SKIP_ABILITY,
                playerId: '1',
                payload: {
                    playerId: '1',
                },
            });
            
            // 验证：跳过能力后，应自动推进到 end 阶段
            const state = runner.getState();
            expect(state.sys.phase).toBe('end');
        });
        
        it('激活能力后（无交互），应自动推进到 end 阶段', () => {
            const playerIds = ['0', '1'];
            const runner = new GameTestRunner({
                domain: CardiaDomain,
                systems: Cardia.systems,
                playerIds,
                random: {
                    random: () => 0.5,
                    d: (sides: number) => Math.floor(0.5 * sides) + 1,
                    range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
                    shuffle: <T>(arr: T[]) => [...arr],
                },
            });
            
            // 构造场景：玩家 1 有一张带能力的卡牌
            // 使用状态注入构造场景（简化测试）
            const state = runner.getState();
            const p1 = state.core.players['1'];
            
            // 给玩家 1 一张带能力的卡牌（例如：毒师）
            const poisonerCard = {
                uid: 'test-poisoner-1',
                defId: 'card_ii_poisoner',
                baseInfluence: 3,
                ownerId: '1',
                abilities: [ABILITY_IDS.POISONER],
            };
            
            // 注入状态：玩家 0 打出影响力 5 的卡牌，玩家 1 打出毒师
            runner.setState({
                ...state,
                core: {
                    ...state.core,
                    players: {
                        ...state.core.players,
                        '0': {
                            ...state.core.players['0'],
                            currentCard: {
                                uid: 'test-card-0',
                                defId: 'card_i_basic',
                                baseInfluence: 5,
                                ownerId: '0',
                                abilities: [],
                            },
                            hasPlayed: true,
                        },
                        '1': {
                            ...p1,
                            currentCard: poisonerCard,
                            hasPlayed: true,
                        },
                    },
                    currentEncounter: {
                        slotIndex: 0,
                        player1Id: '0',
                        player2Id: '1',
                        player1Card: {
                            uid: 'test-card-0',
                            defId: 'card_i_basic',
                            baseInfluence: 5,
                            ownerId: '0',
                            abilities: [],
                        },
                        player2Card: poisonerCard,
                        player1Influence: 5,
                        player2Influence: 3,
                        winnerId: '0',
                        loserId: '1',
                    },
                },
                sys: {
                    ...state.sys,
                    phase: 'ability',
                },
            });
            
            // 玩家 1（失败者）激活毒师能力（无交互，直接生效）
            runner.dispatch({
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                playerId: '1',
                payload: {
                    abilityId: ABILITY_IDS.POISONER,
                    sourceCardUid: poisonerCard.uid,
                },
            });
            
            // 验证：激活能力后，应自动推进到 end 阶段
            const finalState = runner.getState();
            expect(finalState.sys.phase).toBe('end');
        });
    });
    
    describe('交互阻塞自动推进', () => {
        it('有交互正在进行时，不应自动推进', () => {
            const playerIds = ['0', '1'];
            const runner = new GameTestRunner({
                domain: CardiaDomain,
                systems: Cardia.systems,
                playerIds,
                random: {
                    random: () => 0.5,
                    d: (sides: number) => Math.floor(0.5 * sides) + 1,
                    range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
                    shuffle: <T>(arr: T[]) => [...arr],
                },
            });
            
            // 构造场景：玩家 1 有一张带交互的能力卡牌
            const state = runner.getState();
            const p1 = state.core.players['1'];
            
            // 给玩家 1 一张带交互的能力卡牌（例如：传送法师）
            const telekineticCard = {
                uid: 'test-telekinetic-1',
                defId: 'card_ii_telekinetic_mage',
                baseInfluence: 3,
                ownerId: '1',
                abilities: [ABILITY_IDS.TELEKINETIC_MAGE],
            };
            
            // 注入状态：玩家 0 打出影响力 5 的卡牌，玩家 1 打出传送法师
            runner.setState({
                ...state,
                core: {
                    ...state.core,
                    players: {
                        ...state.core.players,
                        '0': {
                            ...state.core.players['0'],
                            currentCard: {
                                uid: 'test-card-0',
                                defId: 'card_i_basic',
                                baseInfluence: 5,
                                ownerId: '0',
                                abilities: [],
                            },
                            hasPlayed: true,
                            playedCards: [
                                {
                                    uid: 'test-played-0',
                                    defId: 'card_i_basic',
                                    baseInfluence: 4,
                                    ownerId: '0',
                                    abilities: [],
                                },
                            ],
                        },
                        '1': {
                            ...p1,
                            currentCard: telekineticCard,
                            hasPlayed: true,
                        },
                    },
                    currentEncounter: {
                        slotIndex: 0,
                        player1Id: '0',
                        player2Id: '1',
                        player1Card: {
                            uid: 'test-card-0',
                            defId: 'card_i_basic',
                            baseInfluence: 5,
                            ownerId: '0',
                            abilities: [],
                        },
                        player2Card: telekineticCard,
                        player1Influence: 5,
                        player2Influence: 3,
                        winnerId: '0',
                        loserId: '1',
                    },
                },
                sys: {
                    ...state.sys,
                    phase: 'ability',
                },
            });
            
            // 玩家 1（失败者）激活传送法师能力（会创建交互）
            runner.dispatch({
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                playerId: '1',
                payload: {
                    abilityId: ABILITY_IDS.TELEKINETIC_MAGE,
                    sourceCardUid: telekineticCard.uid,
                },
            });
            
            // 验证：有交互正在进行时，不应自动推进
            const stateAfterActivate = runner.getState();
            expect(stateAfterActivate.sys.phase).toBe('ability');
            expect(stateAfterActivate.sys.interaction.current).toBeDefined();
        });
    });
});
