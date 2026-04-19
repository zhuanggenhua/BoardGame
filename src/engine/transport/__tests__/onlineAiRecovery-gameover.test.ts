/**
 * 测试：游戏结束后 AI 恢复机制应该停止
 * 
 * Bug: 当 AI 对战获胜后，游戏无法正常结束
 * Root Cause: resolveForceEndTurnForStalledAi 没有检查 state.sys.gameover
 * Fix: 在函数开头添加游戏结束检查，如果游戏已结束则返回 null
 */

import { describe, it, expect } from 'vitest';
import {
    resolveForceAdvancePhaseAfterRecovery,
    resolveForceEndTurnForStalledAi,
    resolveManualForceEndAiPhase,
} from '../onlineAiRecovery';
import type { MatchState } from '../../types';
import type { AiSeatController } from '../../ai';

describe('onlineAiRecovery - 游戏结束检查', () => {
    it('游戏结束后应该返回 null，不再尝试强制推进 AI', () => {
        // 构造一个游戏已结束的状态
        const sharedState: MatchState<unknown> = {
            core: {
                currentPlayerId: '1', // AI 玩家
                phase: 'end',
            },
            sys: {
                // 游戏已结束
                gameover: {
                    winner: '0',
                },
                interaction: {
                    current: null,
                    isBlocked: false,
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        // 调用函数
        const result = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: {},
        });

        // 验证：应该返回 null，不再尝试强制推进
        expect(result).toBeNull();
    });

    it('游戏未结束时应该正常返回强制推进方案', () => {
        // 构造一个游戏未结束的状态
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1', // AI 玩家（使用 activePlayerId 而不是 currentPlayerId）
                phase: 'play',
            },
            sys: {
                // 游戏未结束
                gameover: undefined,
                interaction: {
                    current: null,
                    isBlocked: false,
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        // 调用函数
        const result = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: {},
        });

        // 验证：应该返回强制推进方案
        expect(result).not.toBeNull();
        expect(result?.playerId).toBe('1');
        expect(result?.reason).toBe('active-turn');
    });

    it('factionSelect 阶段即使当前玩家是 AI，也只允许 legal-action recovery，不得走 ADVANCE_PHASE 强制推进', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'factionSelect',
                interaction: {
                    current: null,
                    isBlocked: false,
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        const result = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: {},
        });

        expect(result).toMatchObject({
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
        });
        expect(result?.resolution.action.commands).toEqual([]);
    });

    it('游戏结束后即使有交互也应该返回 null', () => {
        // 构造一个游戏已结束且有交互的状态
        const sharedState: MatchState<unknown> = {
            core: {
                currentPlayerId: '1', // AI 玩家
                phase: 'ability',
            },
            sys: {
                // 游戏已结束
                gameover: {
                    winner: '0',
                },
                interaction: {
                    current: {
                        id: 'test-interaction',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            options: [
                                { id: 'option1', label: '选项1' },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        // 调用函数
        const result = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: {},
        });

        // 验证：应该返回 null，不再尝试处理交互
        expect(result).toBeNull();
    });

    it('游戏结束后即使有响应窗口也应该返回 null', () => {
        // 构造一个游戏已结束且有响应窗口的状态
        const sharedState: MatchState<unknown> = {
            core: {
                currentPlayerId: '0',
                phase: 'play',
            },
            sys: {
                // 游戏已结束
                gameover: {
                    winner: '0',
                },
                interaction: {
                    current: null,
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        // 调用函数
        const result = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: {},
        });

        // 验证：应该返回 null，不再尝试处理响应窗口
        expect(result).toBeNull();
    });

    it('可见 simple-choice 只有 Pass 控制项时，watchdog 应返回 RESPOND pass 而不是 cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: 'reaction-order-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个反应动作',
                            options: [
                                {
                                    id: 'trigger:afterScoring:base_a:1:0',
                                    label: '先结算触发 A',
                                    value: { kind: 'trigger', triggerId: 'afterScoring:base_a:1:0' },
                                },
                                {
                                    id: 'pass',
                                    label: 'Pass',
                                    value: { kind: 'pass' },
                                },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        const result = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: {},
        });

        expect(result?.reason).toBe('visible-interaction');
        expect(result?.requiresConfirmedAdvancePhase).toBe(true);
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'pass' },
        });
    });

    it('隐藏 simple-choice 只有 Pass 控制项时，watchdog 应把 Pass 视为可跳过控制项', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'scoreBases',
                interaction: {
                    current: null,
                    isBlocked: true,
                },
            },
        };

        const seatStateForAi: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: 'reaction-order-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个反应动作',
                            options: [
                                {
                                    id: 'pass',
                                    label: 'Pass',
                                    value: { kind: 'pass' },
                                },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        const result = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': seatStateForAi },
        });

        expect(result?.reason).toBe('hidden-interaction');
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'pass' },
        });
    });
});


describe('resolveForceAdvancePhaseAfterRecovery - 游戏结束检查', () => {
    it('游戏结束后应该返回 null，不再尝试推进阶段', () => {
        // 构造一个游戏已结束的状态
        const authoritativeState: MatchState<unknown> = {
            core: {
                activePlayerId: '1', // AI 玩家
                phase: 'end',
            },
            sys: {
                // 游戏已结束
                gameover: {
                    winner: '0',
                },
                interaction: {
                    current: null,
                    isBlocked: false,
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        // 调用函数
        const result = resolveForceAdvancePhaseAfterRecovery({
            authoritativeState,
            seatControllers,
            playerId: '1',
        });

        // 验证：应该返回 null，不再尝试推进阶段
        expect(result).toBeNull();
    });

    it('游戏未结束时应该正常返回推进阶段方案', () => {
        // 构造一个游戏未结束的状态
        const authoritativeState: MatchState<unknown> = {
            core: {
                activePlayerId: '1', // AI 玩家
                phase: 'play',
            },
            sys: {
                // 游戏未结束
                gameover: undefined,
                interaction: {
                    current: null,
                    isBlocked: false,
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        // 调用函数
        const result = resolveForceAdvancePhaseAfterRecovery({
            authoritativeState,
            seatControllers,
            playerId: '1',
        });

        // 验证：应该返回推进阶段方案
        expect(result).not.toBeNull();
        expect(result?.playerId).toBe('1');
        expect(result?.action.commands[0]?.type).toBe('ADVANCE_PHASE');
    });
});

describe('resolveManualForceEndAiPhase - human 响应窗口场景', () => {
    it('AI 当前阶段里若 human 正在响应，手动强制结束应优先强制关闭响应窗口', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
                phase: 'main1',
            },
            sys: {
                gameover: undefined,
                interaction: {
                    current: null,
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'rw-human-response',
                        windowType: 'afterCardPlayed',
                        sourceId: 'card-surprise',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                    },
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        const result = resolveManualForceEndAiPhase({
            sharedState,
            seatControllers,
            seatStates: {},
        });

        expect(result).not.toBeNull();
        expect(result?.playerId).toBe('1');
        expect(result?.reason).toBe('response-window');
        expect(result?.requiresConfirmedAdvancePhase).toBe(true);
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE',
            payload: {},
        });
    });
});
