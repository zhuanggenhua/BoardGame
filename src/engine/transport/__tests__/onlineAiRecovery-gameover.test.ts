/**
 * 测试：游戏结束后 AI 恢复机制应该停止
 * 
 * Bug: 当 AI 对战获胜后，游戏无法正常结束
 * Root Cause: resolveForceEndTurnForStalledAi 没有检查 state.sys.gameover
 * Fix: 在函数开头添加游戏结束检查，如果游戏已结束则返回 null
 */

import { describe, it, expect } from 'vitest';
import {
    ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASONS,
    ONLINE_AI_LEGAL_ACTION_ONLY_REASONS,
    resolveForceAdvancePhaseAfterRecovery,
    resolveForceEndTurnForStalledAi,
    resolveForceSkippableHiddenAiInteraction,
    resolveManualForceEndAiPhase,
    resolveUnsatisfiableReasonFromInteraction,
    shouldInspectSeatStatesForHiddenAiInteraction,
    shouldUseOnlineAiEmergencyOverlayFallback,
} from '../onlineAiRecovery';
import type { MatchState } from '../../types';
import type { AiSeatController } from '../../ai';

describe('onlineAiRecovery - 游戏结束检查', () => {
    it('legal-action-only reason 必须同步到 emergency overlay fallback 白名单', () => {
        const uncovered = ONLINE_AI_LEGAL_ACTION_ONLY_REASONS.filter(
            (reason) => !shouldUseOnlineAiEmergencyOverlayFallback(reason),
        );
        expect(uncovered).toEqual([]);
        expect(ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASONS).toContain('response-window');
        expect(ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASONS).toContain('response-loop');
        expect(ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASONS).toContain('active-turn-legal-only');
        expect(ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASONS).toContain('seat-legal-only');
    });

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

    it('active-turn candidate 即使同一 AI，也应随 progressMarker 漂移生成新的 fingerprint 与 attemptKey', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (phase: string, nextId: number): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
                phase,
            },
            sys: {
                gameover: undefined,
                turnNumber: 1,
                phase,
                interaction: {
                    current: null,
                    isBlocked: false,
                },
                eventStream: {
                    nextId,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState('playCards', 5),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState('endTurn', 6),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('active-turn');
        expect(second?.reason).toBe('active-turn');
        expect(first?.fingerprintHint).toContain('active-turn:1:');
        expect(second?.fingerprintHint).toContain('active-turn:1:');
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('display-only-bonus candidate 即使 settlementId 相同，也应随 phase 漂移生成新的 fingerprint 与 attemptKey', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (phase: string): MatchState<unknown> => ({
            core: {
                activePlayerId: '0',
                pendingBonusDiceSettlement: {
                    id: 'display-only-bonus-1',
                    attackerId: '1',
                    displayOnly: true,
                },
            },
            sys: {
                gameover: undefined,
                phase,
                interaction: {
                    current: null,
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState('main1'),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState('main2'),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('seat-legal-only');
        expect(second?.reason).toBe('seat-legal-only');
        expect(first?.fingerprintHint).toContain('display-only-bonus:1:main1:display-only-bonus-1');
        expect(second?.fingerprintHint).toContain('display-only-bonus:1:main2:display-only-bonus-1');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
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

    it('DiceThrone targetingRoll 阶段即使当前玩家是 AI，也只允许 legal-action recovery，不得走裸 ADVANCE_PHASE fallback', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'targetingRoll',
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

    it('active-turn-legal-only candidate 即使同一 AI 与 phase，也应随 progressMarker 漂移生成新的 fingerprint 与 attemptKey', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (nextId: number): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'factionSelect',
                turnNumber: 1,
                eventStream: {
                    nextId,
                },
                interaction: {
                    current: null,
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(5),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(6),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('active-turn-legal-only');
        expect(second?.reason).toBe('active-turn-legal-only');
        expect(first?.fingerprintHint).toContain('active-turn-legal-only:1:factionSelect:');
        expect(second?.fingerprintHint).toContain('active-turn-legal-only:1:factionSelect:');
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('AI 对 AI 的 defensiveRoll legal-only fallback 即使 defenderId 相同，也应随 pendingAttack.sourceAbilityId 漂移生成新的 fingerprint 与 attemptKey', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'local-ai', policyId: 'baseline' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        const first = resolveForceEndTurnForStalledAi({
            sharedState: {
                core: {
                    activePlayerId: '1',
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'attack-a',
                    },
                },
                sys: {
                    gameover: undefined,
                    phase: 'defensiveRoll',
                    interaction: {
                        current: null,
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                },
            },
            seatControllers,
            seatStates: {},
            gameId: 'dicethrone',
        });

        const second = resolveForceEndTurnForStalledAi({
            sharedState: {
                core: {
                    activePlayerId: '1',
                    pendingAttack: {
                        attackerId: '1',
                        defenderId: '0',
                        sourceAbilityId: 'attack-b',
                    },
                },
                sys: {
                    gameover: undefined,
                    phase: 'defensiveRoll',
                    interaction: {
                        current: null,
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                },
            },
            seatControllers,
            seatStates: {},
            gameId: 'dicethrone',
        });

        expect(first?.reason).toBe('active-turn-legal-only');
        expect(second?.reason).toBe('active-turn-legal-only');
        expect(first?.playerId).toBe('0');
        expect(second?.playerId).toBe('0');
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('Splendor 即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'main1',
                interaction: {
                    current: null,
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
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
            gameId: 'splendor',
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

    it('可见 simple-choice 只剩 done 控制项时，watchdog 应返回 RESPOND done 而不是 cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'playCards',
                interaction: {
                    current: {
                        id: 'full-sail-finish-only',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'pirate_full_sail_choose_minion',
                            title: '选择要移动的己方随从（或完成）',
                            options: [
                                {
                                    id: 'done',
                                    label: '完成移动',
                                    value: { done: true },
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
            payload: { optionId: 'done' },
        });
    });

    it('可见 simple-choice 只剩 __emergency_skip__ 控制项时，watchdog 应返回 RESPOND emergency skip 而不是 cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: 'reaction-order-emergency-skip-only',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '当前无可执行反应',
                            options: [
                                {
                                    id: '__emergency_skip__',
                                    label: '跳过（当前无可执行选项）',
                                    value: { __emergency_skip__: true, skip: true },
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
            payload: { optionId: '__emergency_skip__' },
        });
    });

    it('可见 simple-choice 只剩 __cancel__ 控制项时，watchdog 应返回 RESPOND cancel option 而不是 generic cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'playCards',
                interaction: {
                    current: {
                        id: 'cancel-only-visible-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'ghosts_spirit_choose_base',
                            title: '取消本次选择',
                            options: [
                                {
                                    id: '__cancel__',
                                    label: '取消',
                                    value: { __cancel__: true },
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
            payload: { optionId: '__cancel__' },
        });
    });

    it('可见 simple-choice 只剩 skip 控制项时，watchdog 应返回 RESPOND skip 而不是 cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: 'skip-only-visible-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'base_the_nexus_may_return_minion',
                            title: '跳过这次可选效果',
                            options: [
                                {
                                    id: 'skip',
                                    label: '跳过',
                                    value: { skip: true },
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
            payload: { optionId: 'skip' },
        });
    });

    it('可见 simple-choice 若允许空选且无控制项时，watchdog 应返回 RESPOND 空 optionIds 而不是 cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'main1',
                interaction: {
                    current: {
                        id: 'optional-multi-visible-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'ghosts_discard_any_number',
                            title: '选择至多两张牌弃掉',
                            multi: { min: 0, max: 2 },
                            options: [
                                { id: 'card-a', label: '候选 A', value: { cardUid: 'card-a' } },
                                { id: 'card-b', label: '候选 B', value: { cardUid: 'card-b' } },
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
            payload: { optionIds: [] },
        });
    });

    it('可见 compare-roll-choice 只有 confirmValue 且无选项时，watchdog 应返回 CONFIRM 而不是 cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'offensiveRoll',
                interaction: {
                    current: {
                        id: 'compare-roll-showdown',
                        playerId: '1',
                        kind: 'compare-roll-choice',
                        data: {
                            sourceId: 'showdown',
                            title: '摊到牌面',
                            contestants: [
                                { playerId: '0', label: '我方', roll: 6 },
                                { playerId: '1', label: '对手', roll: 1 },
                            ],
                            confirmValue: {
                                customId: 'showdown-win',
                                value: 2,
                            },
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
            type: 'SYS_INTERACTION_CONFIRM',
            payload: {},
        });
    });

    it('可见 compare-roll-choice 只有一个可选项时，watchdog 应返回 RESPOND 该选项而不是 cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'offensiveRoll',
                interaction: {
                    current: {
                        id: 'compare-roll-resolve-only',
                        playerId: '1',
                        kind: 'compare-roll-choice',
                        data: {
                            sourceId: 'showdown',
                            title: '摊到牌面',
                            contestants: [
                                { playerId: '0', label: '我方', roll: 6 },
                                { playerId: '1', label: '对手', roll: 1 },
                            ],
                            options: [
                                {
                                    id: 'resolve',
                                    label: '继续',
                                    value: { kind: 'confirm' },
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
            payload: { optionId: 'resolve' },
        });
    });

    it('可见 compare-roll-choice 的 confirmValue 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (confirmCustomId: string, confirmValue: number): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'offensiveRoll',
                interaction: {
                    current: {
                        id: 'compare-roll-confirm-drift',
                        playerId: '1',
                        kind: 'compare-roll-choice',
                        data: {
                            sourceId: 'showdown',
                            title: '摊到牌面',
                            contestants: [
                                { playerId: '0', label: '我方', roll: 6 },
                                { playerId: '1', label: '对手', roll: 1 },
                            ],
                            confirmValue: {
                                customId: confirmCustomId,
                                value: confirmValue,
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState('showdown-win', 2),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState('showdown-lose', 0),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CONFIRM',
            payload: {},
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CONFIRM',
            payload: {},
        });
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('可见 compare-roll-choice 的 option value 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (optionValue: unknown): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'offensiveRoll',
                interaction: {
                    current: {
                        id: 'compare-roll-option-value-drift',
                        playerId: '1',
                        kind: 'compare-roll-choice',
                        data: {
                            sourceId: 'showdown',
                            title: '摊到牌面',
                            contestants: [
                                { playerId: '0', label: '我方', roll: 6 },
                                { playerId: '1', label: '对手', roll: 1 },
                            ],
                            options: [
                                {
                                    id: 'resolve',
                                    label: '继续',
                                    value: optionValue,
                                },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState({ kind: 'confirm', payout: 2 }),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState({ kind: 'confirm', payout: 0 }),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'resolve' },
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'resolve' },
        });
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('可见 dt:token-response 的 pendingDamage 语义漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (currentDamage: number, honorSpent: number): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
                pendingDamage: {
                    id: 'pending-damage-shared',
                    responderId: '1',
                    responseType: 'beforeDamageReceived',
                    currentDamage,
                    sourcePlayerId: '0',
                    targetPlayerId: '1',
                    tokenUsageTotals: { honor: honorSpent },
                },
            },
            sys: {
                gameover: undefined,
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'dt-token-response-shared',
                        playerId: '1',
                        kind: 'dt:token-response',
                        data: null,
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(5, 1),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(2, 2),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SKIP_TOKEN_RESPONSE',
            payload: {},
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SKIP_TOKEN_RESPONSE',
            payload: {},
        });
        expect(first?.fingerprintHint).toContain(':dt:token-response:pending-damage-shared:1:beforeDamageReceived:5:0:1:0:honor:1');
        expect(second?.fingerprintHint).toContain(':dt:token-response:pending-damage-shared:1:beforeDamageReceived:2:0:1:0:honor:2');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('可见 dt:bonus-dice 的 settlement 语义漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (rerollCount: number, readyToSettle: boolean, firstDieValue: number, firstDieRerolled: boolean): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
                pendingBonusDiceSettlement: {
                    id: 'bonus-settlement-shared',
                    attackerId: '1',
                    rerollCount,
                    maxRerollCount: 1,
                    readyToSettle,
                    dice: [
                        { index: 0, value: firstDieValue, rerolled: firstDieRerolled },
                        { index: 1, value: 1, rerolled: false },
                    ],
                },
            },
            sys: {
                gameover: undefined,
                phase: 'offensiveRoll',
                interaction: {
                    current: {
                        id: 'dt-bonus-dice-shared',
                        playerId: '1',
                        kind: 'dt:bonus-dice',
                        data: null,
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(0, false, 4, false),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(1, true, 6, true),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SKIP_BONUS_DICE_REROLL',
            payload: {},
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SKIP_BONUS_DICE_REROLL',
            payload: {},
        });
        expect(first?.fingerprintHint).toContain(':dt:bonus-dice:bonus-settlement-shared:1:0:1:0:0:4:0,1:1:0');
        expect(second?.fingerprintHint).toContain(':dt:bonus-dice:bonus-settlement-shared:1:1:1:1:0:6:1,1:1:0');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('可见 dt:defender-choice 只有一个 enabled 目标时，watchdog 应返回 SELECT_DEFENDER_TARGET 而不是 cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
                pendingAttack: {
                    attackerId: '0',
                    defenderId: undefined,
                },
            },
            sys: {
                gameover: undefined,
                phase: 'targetingRoll',
                interaction: {
                    current: {
                        id: 'dt-defender-choice-single',
                        playerId: '1',
                        kind: 'dt:defender-choice',
                        data: {
                            attackerId: '0',
                            chooserPlayerId: '1',
                            sourceId: 'barbarian_reckless',
                            targetRollValue: 6,
                            options: [
                                { playerId: '2', customId: 'defender-2', disabled: true },
                                { playerId: '3', customId: 'defender-3' },
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
            type: 'SELECT_DEFENDER_TARGET',
            payload: { defenderId: '3' },
        });
    });

    it('可见 dt:defender-choice 的唯一 enabled 目标漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (enabledDefenderId: string): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
                pendingAttack: {
                    attackerId: '0',
                    defenderId: undefined,
                },
            },
            sys: {
                gameover: undefined,
                phase: 'targetingRoll',
                interaction: {
                    current: {
                        id: 'dt-defender-choice-single-drift',
                        playerId: '1',
                        kind: 'dt:defender-choice',
                        data: {
                            attackerId: '0',
                            chooserPlayerId: '1',
                            sourceId: 'barbarian_reckless',
                            targetRollValue: 6,
                            options: [
                                { playerId: '2', customId: 'defender-2', disabled: enabledDefenderId !== '2' },
                                { playerId: '3', customId: 'defender-3', disabled: enabledDefenderId !== '3' },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState('2'),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState('3'),
            seatControllers,
            seatStates: {},
        });

        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SELECT_DEFENDER_TARGET',
            payload: { defenderId: '2' },
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SELECT_DEFENDER_TARGET',
            payload: { defenderId: '3' },
        });
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('可见 dt:defender-choice 的 defenderId 漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (defenderId: string): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
                pendingAttack: {
                    attackerId: '0',
                    defenderId,
                },
            },
            sys: {
                gameover: undefined,
                phase: 'targetingRoll',
                interaction: {
                    current: {
                        id: 'dt-defender-choice-defender-drift',
                        playerId: '1',
                        kind: 'dt:defender-choice',
                        data: {
                            attackerId: '0',
                            defenderId,
                            chooserPlayerId: '1',
                            sourceId: 'barbarian_reckless',
                            targetRollValue: 6,
                            options: [
                                { playerId: '2', customId: 'defender-2' },
                                { playerId: '3', customId: 'defender-3', disabled: true },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState('1'),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState('2'),
            seatControllers,
            seatStates: {},
        });

        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SELECT_DEFENDER_TARGET',
            payload: { defenderId: '2' },
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SELECT_DEFENDER_TARGET',
            payload: { defenderId: '2' },
        });
        expect(first?.fingerprintHint).toContain(':defender-choice:barbarian_reckless:1:0:6:');
        expect(second?.fingerprintHint).toContain(':defender-choice:barbarian_reckless:2:0:6:');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('可见 dt:card-interaction 的 targetPlayerIds 集合漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (targetPlayerIds: string[]): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'main2',
                interaction: {
                    current: {
                        id: 'dt-card-interaction-shared',
                        playerId: '1',
                        kind: 'dt:card-interaction',
                        data: {
                            sourceId: 'monk_ability',
                            type: 'selectStatus',
                            targetPlayerIds,
                            requiresTargetWithStatus: true,
                            transferConfig: {
                                statusId: 'poison',
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(['0', '1']),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(['2', '3']),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
        expect(first?.fingerprintHint).toContain('0,1');
        expect(second?.fingerprintHint).toContain('2,3');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('可见 dt:card-interaction 的 transferStatusId 漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (statusId: string): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'main2',
                interaction: {
                    current: {
                        id: 'dt-card-interaction-shared',
                        playerId: '1',
                        kind: 'dt:card-interaction',
                        data: {
                            sourceId: 'monk_ability',
                            type: 'selectStatus',
                            targetPlayerIds: ['0', '1'],
                            requiresTargetWithStatus: true,
                            transferConfig: {
                                statusId,
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState('poison'),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState('burn'),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
        expect(first?.fingerprintHint).toContain(':poison');
        expect(second?.fingerprintHint).toContain(':burn');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('可见 dt:card-interaction 的 requiresTargetWithStatus 漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (requiresTargetWithStatus: boolean): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'main2',
                interaction: {
                    current: {
                        id: 'dt-card-interaction-shared',
                        playerId: '1',
                        kind: 'dt:card-interaction',
                        data: {
                            sourceId: 'monk_ability',
                            type: 'selectStatus',
                            targetPlayerIds: ['0', '1'],
                            requiresTargetWithStatus,
                            transferConfig: {
                                statusId: 'poison',
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(true),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(false),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
        expect(first?.fingerprintHint).toContain(':1:poison');
        expect(second?.fingerprintHint).toContain(':0:poison');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 visible-interaction 的 sourceId 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (sourceId: string): MatchState<unknown> => ({
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
                            sourceId,
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
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState('smashup_reaction_choose'),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState('base_primate_park_return'),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.fingerprintHint).toContain('smashup_reaction_choose');
        expect(second?.fingerprintHint).toContain('base_primate_park_return');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 visible multistep-choice 的 targetOpponentDice 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (targetOpponentDice: boolean): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'main2',
                interaction: {
                    current: {
                        id: 'multistep-choice-target-owner-drift',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            sourceId: 'artificer_overclock',
                            title: '选择要重掷的骰子',
                            maxSteps: 2,
                            minSteps: 1,
                            allowedDieIds: [0, 1],
                            completedDieIds: [],
                            meta: {
                                dtType: 'reroll',
                                diceOwnerId: '1',
                                targetOpponentDice,
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(false),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(true),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
        expect(first?.fingerprintHint).toContain(':multistep-choice:artificer_overclock:选择要重掷的骰子:reroll:2:1:0,1::1:0');
        expect(second?.fingerprintHint).toContain(':multistep-choice:artificer_overclock:选择要重掷的骰子:reroll:2:1:0,1::1:1');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 visible multistep-choice 的 selectCount / dieModifyConfig 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (
            selectCount: number,
            dieModifyConfig: Record<string, unknown>,
        ): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'multistep-choice-modify-drift',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            sourceId: 'way_of_the_lotus_tip',
                            title: '选择要修改的骰子',
                            maxSteps: 2,
                            minSteps: 1,
                            allowedDieIds: [1, 2],
                            completedDieIds: [1],
                            meta: {
                                dtType: 'modifyDie',
                                diceOwnerId: '1',
                                targetOpponentDice: false,
                                selectCount,
                                dieModifyConfig,
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(1, { mode: 'set', targetValue: 6 }),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(2, { mode: 'adjust', adjustRange: { min: -2, max: 2 } }),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
        expect(first?.fingerprintHint).toContain(':multistep-choice:way_of_the_lotus_tip:选择要修改的骰子:modifyDie:2:1:1,2:1:1:0:1:set:6');
        expect(second?.fingerprintHint).toContain(':multistep-choice:way_of_the_lotus_tip:选择要修改的骰子:modifyDie:2:1:1,2:1:1:0:2:adjust::-2:2');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 visible simple-choice 的 option value 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (optionValue: Record<string, unknown>): MatchState<unknown> => ({
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
                                    id: 'control',
                                    label: 'Control',
                                    value: optionValue,
                                },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState({ kind: 'pass' }),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState({ done: true }),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'control' },
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'control' },
        });
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 visible simple-choice 的 interactionId 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (interactionId: string): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: interactionId,
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个反应动作',
                            options: [
                                {
                                    id: 'control',
                                    label: 'Control',
                                    value: { kind: 'pass' },
                                },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState('reaction-order-choice-a'),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState('reaction-order-choice-b'),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'control' },
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'control' },
        });
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 visible simple-choice 的 title 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (title: string): MatchState<unknown> => ({
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
                            title,
                            options: [
                                {
                                    id: 'control',
                                    label: 'Control',
                                    value: { kind: 'pass' },
                                },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState('选择第一个反应动作'),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState('选择第二个反应动作'),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'control' },
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'control' },
        });
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 visible simple-choice 的 slider 配置漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildState = (max: number): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: 'amount-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'giant_ants_brood_queen',
                            title: '选择要转移的力量指示物数量',
                            options: [
                                {
                                    id: 'confirm',
                                    label: '确认',
                                    value: { amount: max },
                                },
                                {
                                    id: 'skip',
                                    label: '跳过',
                                    value: { skip: true },
                                },
                            ],
                            slider: {
                                min: 1,
                                max,
                                defaultValue: max,
                                confirmOptionId: 'confirm',
                                skipOptionId: 'skip',
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(2),
            seatControllers,
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(4),
            seatControllers,
            seatStates: {},
        });

        expect(first?.reason).toBe('visible-interaction');
        expect(second?.reason).toBe('visible-interaction');
        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'skip' },
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'skip' },
        });
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
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

    it('自动 hidden-interaction 的 sourceId 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
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

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildSeatState = (sourceId: string): MatchState<unknown> => ({
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
                            sourceId,
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
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState('smashup_reaction_choose') },
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState('base_primate_park_return') },
        });

        expect(first?.reason).toBe('hidden-interaction');
        expect(second?.reason).toBe('hidden-interaction');
        expect(first?.fingerprintHint).toContain('smashup_reaction_choose');
        expect(second?.fingerprintHint).toContain('base_primate_park_return');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 hidden-interaction 的 interactionId 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
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

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildSeatState = (interactionId: string): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: interactionId,
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
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState('reaction-order-choice-a') },
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState('reaction-order-choice-b') },
        });

        expect(first?.reason).toBe('hidden-interaction');
        expect(second?.reason).toBe('hidden-interaction');
        expect(first?.fingerprintHint).toContain('reaction-order-choice-a');
        expect(second?.fingerprintHint).toContain('reaction-order-choice-b');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 hidden-interaction 的 title 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
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

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildSeatState = (title: string): MatchState<unknown> => ({
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
                            title,
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
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState('选择一个反应动作') },
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState('选择第二个反应动作') },
        });

        expect(first?.reason).toBe('hidden-interaction');
        expect(second?.reason).toBe('hidden-interaction');
        expect(first?.fingerprintHint).toContain('选择一个反应动作');
        expect(second?.fingerprintHint).toContain('选择第二个反应动作');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 hidden-interaction 的 option id/disabled 相同但 value 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
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

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildSeatState = (value: unknown): MatchState<unknown> => ({
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
                                    value,
                                },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState({ kind: 'pass' }) },
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState({ done: true }) },
        });

        expect(first?.reason).toBe('hidden-interaction');
        expect(second?.reason).toBe('hidden-interaction');
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 hidden-interaction 的 option signature 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
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

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildSeatState = (cardUid: string): MatchState<unknown> => ({
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
                                    value: { cardUid },
                                },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState('hand-a') },
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState('hand-b') },
        });

        expect(first?.reason).toBe('hidden-interaction');
        expect(second?.reason).toBe('hidden-interaction');
        expect(first?.fingerprintHint).not.toBe(second?.fingerprintHint);
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自动 hidden-interaction 的 slider 配置漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
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

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const buildSeatState = (max: number): MatchState<unknown> => ({
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
                            sourceId: 'giant_ants_brood_queen',
                            title: '选择要转移的力量指示物数量',
                            options: [
                                {
                                    id: 'confirm',
                                    label: '确认',
                                    value: { amount: max },
                                },
                                {
                                    id: 'skip',
                                    label: '跳过',
                                    value: { skip: true },
                                },
                            ],
                            slider: {
                                min: 1,
                                max,
                                defaultValue: max,
                                confirmOptionId: 'confirm',
                                skipOptionId: 'skip',
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState(2) },
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: { '1': buildSeatState(4) },
        });

        expect(first?.reason).toBe('hidden-interaction');
        expect(second?.reason).toBe('hidden-interaction');
        expect(first?.fingerprintHint).toContain('giant_ants_brood_queen');
        expect(second?.fingerprintHint).toContain('giant_ants_brood_queen');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('pendingInteractionId 锁住响应窗口时，即使 shared 没有 current，也必须继续检查 hidden seat state', () => {
        const state: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'main2',
                interaction: {
                    current: undefined,
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'rw-hidden-lock-1',
                        pendingInteractionId: 'hidden-choice-1',
                    },
                },
            },
        };

        expect(shouldInspectSeatStatesForHiddenAiInteraction(state)).toBe(true);
    });

    it('shared 当前交互还在时，即使 responseWindow 残留 pendingInteractionId，也不得错误转去 hidden seat state', () => {
        const state: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'main2',
                interaction: {
                    current: {
                        id: 'visible-choice-1',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            options: [{ id: 'skip', label: '跳过', value: { skip: true } }],
                        },
                    },
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'rw-hidden-lock-1',
                        pendingInteractionId: 'hidden-choice-1',
                    },
                },
            },
        };

        expect(shouldInspectSeatStatesForHiddenAiInteraction(state)).toBe(false);
    });

    it('resolveForceSkippableHiddenAiInteraction 遇到 skip 时应优先 force-skip；若只剩非控制项 + cancel 则不得自动取消', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '0',
            },
            sys: {
                phase: 'main2',
                interaction: {
                    current: undefined,
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'rw-hidden-lock-1',
                        pendingInteractionId: 'hidden-choice-1',
                    },
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        const controlOnlySeatState: MatchState<unknown> = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                interaction: {
                    current: {
                        id: 'hidden-choice-1',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'card-bye-bye',
                            title: '选择要移除的状态效果',
                            options: [
                                { id: 'skip', label: '跳过', value: { skip: true } },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        const mixedSkipSeatState: MatchState<unknown> = {
            ...controlOnlySeatState,
            sys: {
                ...controlOnlySeatState.sys,
                interaction: {
                    current: {
                        id: 'hidden-choice-2',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'super_spies_secret_agent_discard',
                            title: '选择要弃掉的手牌',
                            options: [
                                { id: 'hand-a', label: '候选 A', value: { cardUid: 'hand-a' } },
                                { id: 'skip', label: '跳过', value: { skip: true } },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        const nonControlCancelSeatState: MatchState<unknown> = {
            ...controlOnlySeatState,
            sys: {
                ...controlOnlySeatState.sys,
                interaction: {
                    current: {
                        id: 'hidden-choice-3',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'super_spies_secret_agent_discard',
                            title: '选择要弃掉的手牌',
                            options: [
                                { id: 'hand-a', label: '候选 A', value: { cardUid: 'hand-a' } },
                                { id: '__cancel__', label: '取消', value: { __cancel__: true } },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        expect(resolveForceSkippableHiddenAiInteraction({
            sharedState,
            seatControllers,
            seatStates: {
                '1': controlOnlySeatState,
            },
        })).toMatchObject({
            playerId: '1',
            interactionId: 'hidden-choice-1',
            sourceId: 'card-bye-bye',
            resolution: {
                playerId: '1',
                action: {
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'skip' } }],
                },
            },
        });

        expect(resolveForceSkippableHiddenAiInteraction({
            sharedState,
            seatControllers,
            seatStates: {
                '1': mixedSkipSeatState,
            },
        })).toMatchObject({
            playerId: '1',
            interactionId: 'hidden-choice-2',
            resolution: {
                action: {
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'skip' } }],
                },
            },
        });

        const doneOnlySeatState: MatchState<unknown> = {
            ...controlOnlySeatState,
            sys: {
                ...controlOnlySeatState.sys,
                interaction: {
                    current: {
                        id: 'hidden-choice-done-only',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'pirate_full_sail_choose_minion',
                            title: '选择要移动的己方随从（或完成）',
                            options: [
                                { id: 'done', label: '完成移动', value: { done: true } },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        expect(resolveForceSkippableHiddenAiInteraction({
            sharedState,
            seatControllers,
            seatStates: {
                '1': doneOnlySeatState,
            },
        })).toMatchObject({
            playerId: '1',
            interactionId: 'hidden-choice-done-only',
            sourceId: 'pirate_full_sail_choose_minion',
            resolution: {
                action: {
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'done' } }],
                },
            },
        });

        const emergencySkipOnlySeatState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: 'hidden-choice-emergency-skip-only',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '当前无可执行反应',
                            options: [
                                {
                                    id: '__emergency_skip__',
                                    label: '跳过（当前无可执行选项）',
                                    value: { __emergency_skip__: true, skip: true },
                                },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        expect(resolveForceSkippableHiddenAiInteraction({
            sharedState,
            seatControllers,
            seatStates: {
                '1': emergencySkipOnlySeatState,
            },
        })).toEqual({
            playerId: '1',
            interactionId: 'hidden-choice-emergency-skip-only',
            sourceId: 'smashup_reaction_choose',
            title: '当前无可执行反应',
            fingerprintHint: expect.stringContaining('smashup_reaction_choose'),
            resolution: {
                playerId: '1',
                attemptKey: expect.stringContaining('smashup_reaction_choose'),
                source: 'local-ai',
                action: {
                    actionId: expect.stringContaining('smashup_reaction_choose'),
                    kind: 'interaction-choice',
                    label: '强制跳过 AI 可选效果',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: '__emergency_skip__' } }],
                },
            },
        });

        const cancelOnlySeatState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'playCards',
                interaction: {
                    current: {
                        id: 'hidden-choice-cancel-only',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'ghosts_spirit_choose_base',
                            title: '取消本次选择',
                            options: [
                                { id: '__cancel__', label: '取消', value: { __cancel__: true } },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        expect(resolveForceSkippableHiddenAiInteraction({
            sharedState,
            seatControllers,
            seatStates: {
                '1': cancelOnlySeatState,
            },
        })).toMatchObject({
            playerId: '1',
            interactionId: 'hidden-choice-cancel-only',
            sourceId: 'ghosts_spirit_choose_base',
            resolution: {
                playerId: '1',
                action: {
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: '__cancel__' } }],
                },
            },
        });

        const emptyMultiSeatState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: 'hidden-choice-empty-multi',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'time_travelers_wormhole_choose',
                            title: '选择这里任意数量你的随从',
                            multi: { min: 0, max: 2 },
                            options: [
                                { id: 'mine-a', label: 'Mine A', value: { minionUid: 'mine-a' } },
                                { id: 'mine-b', label: 'Mine B', value: { minionUid: 'mine-b' } },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        expect(resolveForceSkippableHiddenAiInteraction({
            sharedState,
            seatControllers,
            seatStates: {
                '1': emptyMultiSeatState,
            },
        })).toBeNull();

        expect(resolveForceSkippableHiddenAiInteraction({
            sharedState,
            seatControllers,
            seatStates: {
                '1': nonControlCancelSeatState,
            },
        })).toBeNull();
    });

    it('未提供 interaction 时，不应把自动反馈诊断误记成 empty-options', () => {
        expect(resolveUnsatisfiableReasonFromInteraction(undefined, undefined)).toBeNull();
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

    it('Splendor 交互收口后不得再补发阶段推进命令', () => {
        const authoritativeState: MatchState<unknown> = {
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
                    current: undefined,
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        const result = resolveForceAdvancePhaseAfterRecovery({
            authoritativeState,
            seatControllers,
            playerId: '1',
            gameId: 'splendor',
        });

        expect(result).toBeNull();
    });
});

describe('resolveManualForceEndAiPhase - human 响应窗口场景', () => {
    it('AI 可见交互有 pass 时，手动强制结束应直接硬取消而不是先选 pass', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
                phase: 'scoreBases',
            },
            sys: {
                gameover: undefined,
                interaction: {
                    current: {
                        id: 'manual-ai-visible-choice',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个反应动作',
                            options: [
                                { id: 'trigger-a', label: '触发 A', value: { kind: 'trigger' } },
                                { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                            ],
                        },
                    },
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        };

        const result = resolveManualForceEndAiPhase({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(result?.reason).toBe('visible-interaction');
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
    });

    it('手动 visible-interaction 的 sourceId 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const buildResult = (sourceId: string) => resolveManualForceEndAiPhase({
            sharedState: {
                core: {
                    activePlayerId: '1',
                    phase: 'scoreBases',
                },
                sys: {
                    gameover: undefined,
                    interaction: {
                        current: {
                            id: 'manual-ai-visible-choice',
                            kind: 'simple-choice',
                            playerId: '1',
                            data: {
                                sourceId,
                                title: '选择一个反应动作',
                                options: [
                                    { id: 'trigger-a', label: '触发 A', value: { kind: 'trigger' } },
                                    { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                                ],
                            },
                        },
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        const first = buildResult('smashup_reaction_choose');
        const second = buildResult('base_primate_park_return');

        expect(first?.fingerprintHint).toContain('smashup_reaction_choose');
        expect(second?.fingerprintHint).toContain('base_primate_park_return');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('AI 隐藏交互有 skip 时，手动强制结束应直接硬取消隐藏交互', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '0',
                phase: 'main1',
            },
            sys: {
                gameover: undefined,
                interaction: {
                    current: undefined,
                    isBlocked: true,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        };
        const seatState: MatchState<unknown> = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                interaction: {
                    current: {
                        id: 'manual-ai-hidden-choice',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'hidden-ai-choice',
                            title: '隐藏 AI 选择',
                            options: [
                                { id: 'skip', label: '跳过', value: { skip: true } },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        const result = resolveManualForceEndAiPhase({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: { '1': seatState },
        });

        expect(result?.reason).toBe('hidden-interaction');
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: {},
        });
    });

    it('手动 hidden-interaction 的 sourceId 漂移时，attemptKey 也必须跟随 fingerprint 变化', () => {
        const buildResult = (sourceId: string) => resolveManualForceEndAiPhase({
            sharedState: {
                core: {
                    activePlayerId: '0',
                    phase: 'main1',
                },
                sys: {
                    gameover: undefined,
                    interaction: {
                        current: undefined,
                        isBlocked: true,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {
                '1': {
                    core: {},
                    sys: {
                        interaction: {
                            current: {
                                id: 'manual-ai-hidden-choice',
                                kind: 'simple-choice',
                                playerId: '1',
                                data: {
                                    sourceId,
                                    title: '隐藏 AI 选择',
                                    options: [
                                        { id: 'skip', label: '跳过', value: { skip: true } },
                                    ],
                                },
                            },
                            isBlocked: false,
                        },
                    },
                } as MatchState<unknown>,
            },
        });

        const first = buildResult('hidden-ai-choice-a');
        const second = buildResult('hidden-ai-choice-b');

        expect(first?.fingerprintHint).toContain('hidden-ai-choice-a');
        expect(second?.fingerprintHint).toContain('hidden-ai-choice-b');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('纯 AI 响应窗口中，手动强制结束应直接强制关闭响应窗口', () => {
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
                        id: 'rw-ai-response',
                        windowType: 'afterCardPlayed',
                        sourceId: 'card-surprise',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        };

        const result = resolveManualForceEndAiPhase({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(result?.reason).toBe('response-window');
        expect(result?.fingerprintHint).toBe('manual-response-window:1:afterCardPlayed:card-surprise:rw-ai-response:1');
        expect(result?.resolution.attemptKey).toBe('force-end-turn:1:manual-response-window:1:afterCardPlayed:card-surprise:rw-ai-response:1');
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE',
            payload: {},
        });
    });

    it('纯 AI 响应窗口中，手动强制结束的 response-window candidate 也应随 responderQueue signature 漂移生成新的 fingerprint 与 attemptKey', () => {
        const baseSeatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const, policyId: 'baseline' },
        };

        const firstResult = resolveManualForceEndAiPhase({
            sharedState: {
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
                            id: 'rw-manual-response-queue-1',
                            windowType: 'afterCardPlayed',
                            sourceId: 'card-surprise',
                            responderQueue: ['1'],
                            currentResponderIndex: 0,
                        },
                    },
                },
            },
            seatControllers: baseSeatControllers,
            seatStates: {},
        });

        const secondResult = resolveManualForceEndAiPhase({
            sharedState: {
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
                            id: 'rw-manual-response-queue-1',
                            windowType: 'afterCardPlayed',
                            sourceId: 'card-surprise',
                            responderQueue: ['1', '0'],
                            currentResponderIndex: 0,
                        },
                    },
                },
            },
            seatControllers: baseSeatControllers,
            seatStates: {},
        });

        expect(firstResult?.reason).toBe('response-window');
        expect(secondResult?.reason).toBe('response-window');
        expect(firstResult?.fingerprintHint).not.toBe(secondResult?.fingerprintHint);
        expect(firstResult?.resolution.attemptKey).not.toBe(secondResult?.resolution.attemptKey);
    });

    it('纯 AI 响应窗口中，自动 watchdog 的 response-window candidate 也应带 windowType/sourceId/windowId provenance', () => {
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
                        id: 'rw-auto-response',
                        windowType: 'afterCardPlayed',
                        sourceId: 'card-surprise',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        };

        const result = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(result?.reason).toBe('response-window');
        expect(result?.fingerprintHint).toBe('response-window:1:afterCardPlayed:card-surprise:rw-auto-response:1');
        expect(result?.resolution.attemptKey).toBe('force-end-turn:1:response-window:1:afterCardPlayed:card-surprise:rw-auto-response:1');
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'RESPONSE_PASS',
            payload: {},
        });
    });

    it('纯 AI 响应窗口中，自动 watchdog 的 response-window candidate 也应随 responderQueue signature 漂移生成新的 fingerprint 与 attemptKey', () => {
        const baseSeatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const, policyId: 'baseline' },
        };

        const firstResult = resolveForceEndTurnForStalledAi({
            sharedState: {
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
                            id: 'rw-auto-response-queue-1',
                            windowType: 'afterCardPlayed',
                            sourceId: 'card-surprise',
                            responderQueue: ['1'],
                            currentResponderIndex: 0,
                        },
                    },
                },
            },
            seatControllers: baseSeatControllers,
            seatStates: {},
        });

        const secondResult = resolveForceEndTurnForStalledAi({
            sharedState: {
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
                            id: 'rw-auto-response-queue-1',
                            windowType: 'afterCardPlayed',
                            sourceId: 'card-surprise',
                            responderQueue: ['1', '0'],
                            currentResponderIndex: 0,
                        },
                    },
                },
            },
            seatControllers: baseSeatControllers,
            seatStates: {},
        });

        expect(firstResult?.reason).toBe('response-window');
        expect(secondResult?.reason).toBe('response-window');
        expect(firstResult?.fingerprintHint).not.toBe(secondResult?.fingerprintHint);
        expect(firstResult?.resolution.attemptKey).not.toBe(secondResult?.resolution.attemptKey);
    });

    it('混合 responderQueue 里当前轮到 AI 响应时，手动强制结束仍应允许强制关闭响应窗口', () => {
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
                        id: 'rw-mixed-response',
                        windowType: 'afterCardPlayed',
                        sourceId: 'card-surprise',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                    },
                },
            },
        };

        const result = resolveManualForceEndAiPhase({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(result?.reason).toBe('response-window');
        expect(result?.playerId).toBe('1');
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE',
            payload: {},
        });
    });

    it('AI 当前阶段里若 human 正在响应，手动强制结束不得强制关闭玩家响应窗口', () => {
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

        expect(result).toBeNull();
    });
});
