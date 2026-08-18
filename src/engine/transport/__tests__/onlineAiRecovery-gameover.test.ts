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
    resolveManualForceEndAiPhase,
    resolveUnsatisfiableReasonFromInteraction,
    shouldUseOnlineAiEmergencyOverlayFallback,
    type OnlineAiRecoveryEngineConfig,
} from '../onlineAiRecovery';
import { shouldProbeOnlineAiLegalActionOnlyCandidateForHumanTurn } from '../onlineAiWatchdogGameSemantics';
import type { MatchState } from '../../types';
import type { AiSeatController } from '../../ai';

const testRecoveryEngineConfig: OnlineAiRecoveryEngineConfig = {
    gameId: 'test-recovery-game',
    onlineAiRecovery: {
        activeTurnLegalActionOnlyPhases: ['testActiveLegalOnlyPhase'],
        humanTurnLegalActionProbePhases: ['testOffTurnProbePhase', 'testTargetingPhase'],
        resolveForcedInteractionCommand: ({ interaction }) => {
            const data = interaction.data as Record<string, unknown> | undefined;
            if (interaction.kind === 'test:token-response') {
                return { type: 'TEST_SKIP_TOKEN_PROMPT', payload: {} };
            }
            if (interaction.kind === 'test:bonus-dice') {
                return false;
            }
            if (interaction.kind !== 'test:defender-choice') {
                return null;
            }

            const options = Array.isArray(data?.options) ? data.options : [];
            const enabledPlayerIds = options
                .filter((option): option is Record<string, unknown> =>
                    Boolean(option)
                    && typeof option === 'object'
                    && !Array.isArray(option)
                    && option.disabled !== true
                    && typeof option.playerId === 'string')
                .map((option) => option.playerId as string);

            return enabledPlayerIds.length === 1
                ? { type: 'TEST_SELECT_TARGET', payload: { defenderId: enabledPlayerIds[0] } }
                : null;
        },
        buildInteractionRecoveryFingerprintHint: ({ state, playerId, phase, interaction, fallbackFingerprintHint }) => {
            const data = interaction.data as Record<string, unknown> | undefined;
            const kind = typeof interaction.kind === 'string' ? interaction.kind : '';
            const interactionId = typeof interaction.id === 'string' ? interaction.id : '';
            const sourceId = typeof data?.sourceId === 'string' ? data.sourceId : '';
            const core = state.core as Record<string, unknown> | undefined;

            if (kind === 'test:defender-choice') {
                const attackerId = typeof data?.attackerId === 'string' ? data.attackerId : '';
                const targetRollValue = typeof data?.targetRollValue === 'number'
                    ? String(data.targetRollValue)
                    : '';
                const optionSignature = Array.isArray(data?.options)
                    ? data.options.map((option) => {
                        const raw = option && typeof option === 'object' && !Array.isArray(option)
                            ? option as Record<string, unknown>
                            : {};
                        return `${raw.playerId ?? ''}:${raw.customId ?? ''}:${raw.disabled === true ? 1 : 0}`;
                    }).join('|')
                    : '';
                return `interaction:${playerId}:${phase}:test:defender-choice:${sourceId}:${attackerId}:${targetRollValue}:${optionSignature}:${interactionId}`;
            }
            if (kind === 'test:token-response') {
                return `interaction:${playerId}:${phase}:test:token-response:${sourceId}:${JSON.stringify(core?.pendingDamage ?? null)}:${interactionId}`;
            }
            if (kind === 'test:bonus-dice') {
                return `interaction:${playerId}:${phase}:test:bonus-dice:${sourceId}:${JSON.stringify(core?.pendingBonusDiceSettlement ?? null)}:${interactionId}`;
            }
            return fallbackFingerprintHint;
        },
        offlineAdjudicationCommandByInteractionKind: {
            'test:token-response': 'TEST_SKIP_TOKEN_PROMPT',
            'test:bonus-dice': null,
        },
    },
};

describe('onlineAiWatchdogGameSemantics - human turn legal-action probe', () => {
    const buildState = (phase: string): MatchState<unknown> => ({
        core: { activePlayerId: '0', hostStarted: true },
        sys: {
            phase,
            interaction: { current: null, isBlocked: false },
        },
    });

    it('未声明 humanTurnLegalActionProbePhases 时，不应按默认阶段探测 AI legal-only', () => {
        expect(shouldProbeOnlineAiLegalActionOnlyCandidateForHumanTurn({
            state: buildState('testOffTurnProbePhase'),
            currentPlayerId: '0',
        })).toBe(false);
    });

    it('游戏配置声明 off-turn 阶段后，才允许探测 AI legal-only', () => {
        expect(shouldProbeOnlineAiLegalActionOnlyCandidateForHumanTurn({
            state: buildState('testOffTurnProbePhase'),
            currentPlayerId: '0',
            engineConfig: testRecoveryEngineConfig,
        })).toBe(true);
    });

    it('游戏配置 hook 可拒绝某个已声明阶段的探测', () => {
        expect(shouldProbeOnlineAiLegalActionOnlyCandidateForHumanTurn({
            state: buildState('testOffTurnProbePhase'),
            currentPlayerId: '0',
            engineConfig: {
                gameId: 'test-recovery-game',
                onlineAiRecovery: {
                    humanTurnLegalActionProbePhases: ['testOffTurnProbePhase'],
                    shouldProbeHumanTurnLegalActionOnlyCandidate: () => false,
                },
            },
        })).toBe(false);
    });
});

describe('onlineAiRecovery - 游戏结束检查', () => {
    it('legal-action-only reason 必须同步到 emergency overlay fallback 白名单', () => {
        const uncovered = ONLINE_AI_LEGAL_ACTION_ONLY_REASONS.filter(
            (reason) => !shouldUseOnlineAiEmergencyOverlayFallback(reason),
        );
        expect(uncovered).toEqual([]);
        expect(ONLINE_AI_EMERGENCY_OVERLAY_FALLBACK_REASONS).toContain('response-window');
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
            engineConfig: testRecoveryEngineConfig,
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
            engineConfig: testRecoveryEngineConfig,
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
                hostStarted: false,
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
            engineConfig: {
                gameId: 'test-reaction-game',
                onlineAiRecovery: {
                    publicPregameLegalActionPhases: ['factionSelect'],
                },
            },
        });

        expect(result).toMatchObject({
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
        });
        expect(result?.resolution.action.commands).toEqual([]);
    });

    it('自定义目标选择阶段当前玩家为 AI 时，应先维持 active-turn recovery surface', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'testTargetingPhase',
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
            engineConfig: {
                gameId: 'test-offturn-roll-game',
                onlineAiRecovery: {
                    humanTurnLegalActionProbePhases: ['testDefensePhase', 'testTargetingPhase'],
                },
            },
        });

        expect(result).toMatchObject({
            playerId: '1',
            reason: 'active-turn',
        });
        expect(result?.resolution.action.commands).toEqual([
            { type: 'ADVANCE_PHASE', payload: {} },
        ]);
    });

    it('禁用 fallback advance 的游戏即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback', () => {
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
            engineConfig: {
                gameId: 'test-no-fallback-game',
                onlineAiRecovery: {
                    disableFallbackAdvancePhase: true,
                },
            },
        });

        expect(result).toMatchObject({
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
        });
        expect(result?.resolution.action.commands).toEqual([]);
    });

    it('禁用 fallback advance 的游戏未开局时不得触发 active-turn legal-action watchdog', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                currentPlayer: '1',
                hostStarted: false,
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
            engineConfig: {
                gameId: 'test-no-fallback-game',
                onlineAiRecovery: {
                    disableFallbackAdvancePhase: true,
                    shouldSuppressActiveTurnCandidate: ({ state, phase, turnNumber }) => {
                        const core = state.core as { hostStarted?: unknown } | undefined;
                        return core?.hostStarted !== true && (!phase || turnNumber === 0);
                    },
                },
            },
        });

        expect(result).toBeNull();
    });

    it('禁用 fallback advance 的游戏 turn0 / unknown-phase 残态不得触发 active-turn legal-action watchdog', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                currentPlayer: '1',
            },
            sys: {
                gameover: undefined,
                phase: '',
                turnNumber: 0,
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
            engineConfig: {
                gameId: 'test-no-fallback-game',
                onlineAiRecovery: {
                    disableFallbackAdvancePhase: true,
                    shouldSuppressActiveTurnCandidate: ({ state, phase, turnNumber }) => {
                        const core = state.core as { hostStarted?: unknown } | undefined;
                        return core?.hostStarted !== true && (!phase || turnNumber === 0);
                    },
                },
            },
        });

        expect(result).toBeNull();
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
            engineConfig: testRecoveryEngineConfig,
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
            engineConfig: testRecoveryEngineConfig,
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
                            sourceId: 'test_reaction_choose',
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
            engineConfig: testRecoveryEngineConfig,
        });

        expect(result?.reason).toBe('visible-interaction');
        expect(result?.requiresConfirmedAdvancePhase).toBe(true);
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { interactionId: 'reaction-order-choice', optionId: 'pass' },
        });
    });

    it('可见 simple-choice 的让过选项 id 已漂移时，watchdog 必须命中当前 live optionId', () => {
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
                            sourceId: 'test_reaction_choose',
                            title: '选择一个反应动作',
                            options: [
                                {
                                    id: 'stale-pass',
                                    label: '旧让过',
                                    value: { kind: 'pass' },
                                },
                            ],
                            optionsGenerator: () => [
                                {
                                    id: 'live-pass',
                                    label: '当前让过',
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
            engineConfig: testRecoveryEngineConfig,
        });

        expect(result?.reason).toBe('visible-interaction');
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { interactionId: 'reaction-order-choice', optionId: 'live-pass' },
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
                            sourceId: 'test_reaction_choose',
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
            payload: { interactionId: 'reaction-order-choice', optionId: 'pass' },
        });
    });

    it('trigger-only simple-choice 应按 engineConfig 自动选择首个 trigger，而不是依赖 shared 里的具体 sourceId 硬编码', () => {
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
                            sourceId: 'test_reaction_choose',
                            title: '选择一个反应动作',
                            multi: { min: 1, max: 1 },
                            options: [
                                {
                                    id: 'trigger:afterScoring:base_a:1:0',
                                    label: '先结算触发 A',
                                    value: { kind: 'trigger', triggerId: 'afterScoring:base_a:1:0' },
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
            engineConfig: {
                gameId: 'test-reaction-game',
                onlineAiRecovery: {
                    autoSelectFirstTriggerOnlySimpleChoiceSourceIds: ['test_reaction_choose'],
                },
            },
        });

        expect(result?.reason).toBe('visible-interaction');
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { interactionId: 'reaction-order-choice', optionId: 'trigger:afterScoring:base_a:1:0' },
        });
    });

    it('可见 simple-choice 在同 interactionId 下若 option value 漂移，watchdog 的 attemptKey 也必须跟着变化', () => {
        const baseState: MatchState<unknown> = {
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
                            sourceId: 'test_reaction_choose',
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
        const driftedState: MatchState<unknown> = {
            ...baseState,
            sys: {
                ...baseState.sys,
                interaction: {
                    current: {
                        id: 'reaction-order-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'test_reaction_choose',
                            title: '选择一个反应动作',
                            options: [
                                {
                                    id: 'trigger:afterScoring:base_a:1:0',
                                    label: '先结算触发 A',
                                    value: { kind: 'trigger', triggerId: 'afterScoring:base_a:1:0:drifted' },
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

        const baseResult = resolveForceEndTurnForStalledAi({
            sharedState: baseState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });
        const driftedResult = resolveForceEndTurnForStalledAi({
            sharedState: driftedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });

        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
    });

    it('可见 simple-choice 在 sourceId/title/options 不变但 slider 配置漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const baseState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: 'reaction-slider-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'test_slider_source',
                            title: '选择要转移的数量',
                            options: [
                                {
                                    id: 'confirm',
                                    label: '确认转移',
                                    value: { kind: 'confirm' },
                                },
                                {
                                    id: 'skip',
                                    label: '跳过',
                                    value: { kind: 'pass', skip: true },
                                },
                            ],
                            slider: {
                                min: 1,
                                max: 2,
                                step: 1,
                                defaultValue: 2,
                                confirmOptionId: 'confirm',
                                skipOptionId: 'skip',
                                confirmLabel: '确认转移 {{value}}',
                                valueLabel: '当前数量：{{value}} / {{max}}',
                                skipLabel: '跳过',
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        };
        const driftedState: MatchState<unknown> = {
            ...baseState,
            sys: {
                ...baseState.sys,
                interaction: {
                    current: {
                        id: 'reaction-slider-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'test_slider_source',
                            title: '选择要转移的数量',
                            options: [
                                {
                                    id: 'confirm',
                                    label: '确认转移',
                                    value: { kind: 'confirm' },
                                },
                                {
                                    id: 'skip',
                                    label: '跳过',
                                    value: { kind: 'pass', skip: true },
                                },
                            ],
                            slider: {
                                min: 1,
                                max: 4,
                                step: 1,
                                defaultValue: 4,
                                confirmOptionId: 'confirm',
                                skipOptionId: 'skip',
                                confirmLabel: '确认转移 {{value}}',
                                valueLabel: '当前数量：{{value}} / {{max}}',
                                skipLabel: '跳过',
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        const baseResult = resolveForceEndTurnForStalledAi({
            sharedState: baseState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });
        const driftedResult = resolveForceEndTurnForStalledAi({
            sharedState: driftedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
    });

    it('可见 multistep-choice 在 allowed/completed 不变但 selectCount 漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const buildState = (selectCount: number): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'multistep-choice-select-count-drift',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'shadow_thief_samesies',
                            allowedDieIds: [0, 1, 2],
                            completedDieIds: [],
                            meta: {
                                dtType: 'selectDie',
                                selectCount,
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(1),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(2),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('可见 multistep-choice 在 allowed/completed 不变但 dieModifyConfig 漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const buildState = (targetValue: number): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'multistep-choice-die-config-drift',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'gunslinger_tip_it',
                            allowedDieIds: [0, 1],
                            completedDieIds: [0],
                            meta: {
                                dtType: 'modifyDie',
                                selectCount: 1,
                                dieModifyConfig: {
                                    mode: 'set',
                                    targetValue,
                                },
                            },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(1),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(6),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
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
            engineConfig: testRecoveryEngineConfig,
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

    it('可见 test:token-response 时，watchdog 应返回 TEST_SKIP_TOKEN_PROMPT 而不是 cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'token-response-1',
                        playerId: '1',
                        kind: 'test:token-response',
                        data: {
                            sourceId: 'test_token_response',
                            title: '是否消耗 token',
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
            engineConfig: testRecoveryEngineConfig,
        });

        expect(result?.reason).toBe('visible-interaction');
        expect(result?.requiresConfirmedAdvancePhase).toBe(true);
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'TEST_SKIP_TOKEN_PROMPT',
            payload: {},
        });
    });

    it('可见 test:bonus-dice 时，watchdog 不能代替右侧骰盘普通确认', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'offensiveRoll',
                interaction: {
                    current: {
                        id: 'bonus-dice-1',
                        playerId: '1',
                        kind: 'test:bonus-dice',
                        data: {
                            sourceId: 'bonus-roll',
                            title: '是否重掷奖励骰',
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
            engineConfig: testRecoveryEngineConfig,
        });

        expect(result).toBeNull();
    });

    it('自定义 interaction kind 可通过 engineConfig seam 提供 force command，而不必改 shared transport', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'timingWindow',
                interaction: {
                    current: {
                        id: 'custom-timing-window-1',
                        playerId: '1',
                        kind: 'custom:timing-window',
                        data: {
                            sourceId: 'custom_window_source',
                            title: '是否跳过自定义时机窗',
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
            engineConfig: {
                gameId: 'test-custom-game',
                onlineAiRecovery: {
                    resolveForcedInteractionCommand: ({ interaction }) => interaction.kind === 'custom:timing-window'
                        ? {
                            type: 'CUSTOM_SKIP_TIMING_WINDOW',
                            payload: {},
                        }
                        : null,
                },
            },
        });

        expect(result?.reason).toBe('visible-interaction');
        expect(result?.requiresConfirmedAdvancePhase).toBe(true);
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'CUSTOM_SKIP_TIMING_WINDOW',
            payload: {},
        });
    });

    it('engineConfig seam 返回 false 时，watchdog 不应回退到共享 cancel', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'timingWindow',
                interaction: {
                    current: {
                        id: 'custom-non-recoverable-1',
                        playerId: '1',
                        kind: 'custom:non-recoverable',
                        data: {
                            sourceId: 'custom_non_recoverable_source',
                            title: '必须保留给正式 UI 的时机窗',
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
            engineConfig: {
                gameId: 'test-custom-game',
                onlineAiRecovery: {
                    resolveForcedInteractionCommand: ({ interaction }) => interaction.kind === 'custom:non-recoverable'
                        ? false
                        : null,
                },
            },
        });

        expect(result).toBeNull();
    });

    it('自定义 seat-legal-only recovery 可通过 engineConfig seam 提供 force command，而不必改 shared transport', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '0',
                pendingAutoResolve: {
                    playerId: '1',
                    stepId: 'cleanup-bonus-window',
                },
            },
            sys: {
                gameover: undefined,
                phase: 'main2',
                interaction: {
                    current: undefined,
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
            engineConfig: {
                gameId: 'test-custom-game',
                onlineAiRecovery: {
                    resolveSeatLegalOnlyRecovery: ({ state, phase }) => {
                        const core = state.core as {
                            pendingAutoResolve?: {
                                playerId?: unknown;
                                stepId?: unknown;
                            };
                        } | undefined;
                        const recovery = core?.pendingAutoResolve;
                        if (typeof recovery?.playerId !== 'string' || typeof recovery?.stepId !== 'string') {
                            return null;
                        }
                        return {
                            playerId: recovery.playerId,
                            fingerprintHint: `custom-seat-legal-only:${recovery.playerId}:${phase}:${recovery.stepId}`,
                            attemptSuffix: `custom-seat-legal-only:${recovery.playerId}:${recovery.stepId}`,
                            command: {
                                type: 'CUSTOM_RESOLVE_PENDING_STEP',
                                payload: { stepId: recovery.stepId },
                            },
                        };
                    },
                },
            },
        });

        expect(result?.reason).toBe('seat-legal-only');
        expect(result?.playerId).toBe('1');
        expect(result?.fingerprintHint).toBe('custom-seat-legal-only:1:main2:cleanup-bonus-window');
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'CUSTOM_RESOLVE_PENDING_STEP',
            payload: { stepId: 'cleanup-bonus-window' },
        });
    });

    it('可见 test:token-response 的 pendingDamage 语义漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
        const buildState = (currentDamage: number): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
                pendingDamage: {
                    id: 'pending-damage-1',
                    responderId: '1',
                    responseType: 'token',
                    currentDamage,
                    sourceAbilityId: 'test_token_response',
                    tokenUsageTotals: { rage: currentDamage },
                },
            },
            sys: {
                gameover: undefined,
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'token-response-1',
                        playerId: '1',
                        kind: 'test:token-response',
                        data: {
                            sourceId: 'test_token_response',
                            title: '是否消耗 token',
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(2),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(4),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });

        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('可见 test:bonus-dice 的 settlement 语义漂移时，watchdog 仍不得生成强制确认候选', () => {
        const buildState = (rerollCount: number): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
                pendingBonusDiceSettlement: {
                    id: 'bonus-settlement-1',
                    attackerId: '1',
                    displayOnly: false,
                    rerollCount,
                    dice: [{ index: 0, value: 6 - rerollCount }],
                },
            },
            sys: {
                gameover: undefined,
                phase: 'offensiveRoll',
                interaction: {
                    current: {
                        id: 'bonus-dice-1',
                        playerId: '1',
                        kind: 'test:bonus-dice',
                        data: {
                            sourceId: 'bonus-roll',
                            title: '是否重掷奖励骰',
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(1),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(2),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });

        expect(first).toBeNull();
        expect(second).toBeNull();
    });

    it('可见 compare-roll-choice 在同 interactionId 下若 confirmValue 漂移，watchdog 的 attemptKey 也必须跟着变化', () => {
        const baseState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'compare-roll-choice-1',
                        playerId: '1',
                        kind: 'compare-roll-choice',
                        data: {
                            sourceId: 'test_compare_roll_source',
                            title: '选择一个反应动作',
                            options: [
                                { id: 'confirm', label: '确认', value: { accepted: true } },
                            ],
                            confirmValue: { accepted: true },
                        },
                    },
                    isBlocked: false,
                },
            },
        };
        const driftedState: MatchState<unknown> = {
            ...baseState,
            sys: {
                ...baseState.sys,
                interaction: {
                    current: {
                        id: 'compare-roll-choice-1',
                        playerId: '1',
                        kind: 'compare-roll-choice',
                        data: {
                            sourceId: 'test_compare_roll_source',
                            title: '选择一个反应动作',
                            options: [
                                { id: 'confirm', label: '确认', value: { accepted: false } },
                            ],
                            confirmValue: { accepted: false },
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        const baseResult = resolveForceEndTurnForStalledAi({
            sharedState: baseState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });
        const driftedResult = resolveForceEndTurnForStalledAi({
            sharedState: driftedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });

        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
    });

    it('可见 test:defender-choice 在同 interactionId 下若 sourceId 漂移，watchdog 的 attemptKey 也必须跟着变化', () => {
        const baseState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                },
            },
            sys: {
                gameover: undefined,
                phase: 'testTargetingPhase',
                interaction: {
                    current: {
                        id: 'test-defender-choice-0-6-1',
                        playerId: '1',
                        kind: 'test:defender-choice',
                        data: {
                            attackerId: '0',
                            chooserPlayerId: '1',
                            sourceId: 'test_targeting_source',
                            targetRollValue: 6,
                            options: [
                                { playerId: '2', customId: 'defender-2' },
                                { playerId: '3', customId: 'defender-3' },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };
        const driftedState: MatchState<unknown> = {
            ...baseState,
            sys: {
                ...baseState.sys,
                interaction: {
                    current: {
                        id: 'test-defender-choice-0-6-1',
                        playerId: '1',
                        kind: 'test:defender-choice',
                        data: {
                            attackerId: '0',
                            chooserPlayerId: '1',
                            sourceId: 'test_targeting_source_drifted',
                            targetRollValue: 6,
                            options: [
                                { playerId: '2', customId: 'defender-2' },
                                { playerId: '3', customId: 'defender-3' },
                            ],
                        },
                    },
                    isBlocked: false,
                },
            },
        };

        const baseResult = resolveForceEndTurnForStalledAi({
            sharedState: baseState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });
        const driftedResult = resolveForceEndTurnForStalledAi({
            sharedState: driftedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });

        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
    });

    it('可见 test:defender-choice 只有一个 enabled 目标时，watchdog 应返回 TEST_SELECT_TARGET 而不是 cancel', () => {
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
                phase: 'testTargetingPhase',
                interaction: {
                    current: {
                        id: 'test-defender-choice-single',
                        playerId: '1',
                        kind: 'test:defender-choice',
                        data: {
                            attackerId: '0',
                            chooserPlayerId: '1',
                            sourceId: 'test_targeting_source',
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
            engineConfig: testRecoveryEngineConfig,
        });

        expect(result?.reason).toBe('visible-interaction');
        expect(result?.requiresConfirmedAdvancePhase).toBe(true);
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'TEST_SELECT_TARGET',
            payload: { defenderId: '3' },
        });
    });

    it('可见 test:defender-choice 的唯一 enabled 目标漂移时，watchdog 的 attemptKey 也必须跟着变化', () => {
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
                phase: 'testTargetingPhase',
                interaction: {
                    current: {
                        id: 'test-defender-choice-single-drift',
                        playerId: '1',
                        kind: 'test:defender-choice',
                        data: {
                            attackerId: '0',
                            chooserPlayerId: '1',
                            sourceId: 'test_targeting_source',
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
            engineConfig: testRecoveryEngineConfig,
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState('3'),
            seatControllers,
            seatStates: {},
            engineConfig: testRecoveryEngineConfig,
        });

        expect(first?.resolution.action.commands[0]).toEqual({
            type: 'TEST_SELECT_TARGET',
            payload: { defenderId: '2' },
        });
        expect(second?.resolution.action.commands[0]).toEqual({
            type: 'TEST_SELECT_TARGET',
            payload: { defenderId: '3' },
        });
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
    });

    it('自定义 interaction fingerprint seam 在同 interactionId 下若 meta.step 漂移，watchdog 的 attemptKey 也必须跟着变化', () => {
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };
        const engineConfig = {
            gameId: 'test-game',
            onlineAiRecovery: {
                buildInteractionRecoveryFingerprintHint: ({ fallbackFingerprintHint, interaction }: {
                    fallbackFingerprintHint: string;
                    interaction: { data?: Record<string, unknown> | undefined };
                }) => {
                    const meta = interaction.data?.meta as { step?: unknown } | undefined;
                    const step = typeof meta?.step === 'number' ? meta.step : 'unknown';
                    return `${fallbackFingerprintHint}:custom-step:${step}`;
                },
            },
        };
        const buildState = (step: number): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'main2',
                interaction: {
                    current: {
                        id: 'custom-timing-window-1',
                        playerId: '1',
                        kind: 'custom:timing-window',
                        data: {
                            sourceId: 'custom-window',
                            meta: { step },
                        },
                    },
                    isBlocked: false,
                },
            },
        });

        const first = resolveForceEndTurnForStalledAi({
            sharedState: buildState(1),
            seatControllers,
            seatStates: {},
            engineConfig,
        });
        const second = resolveForceEndTurnForStalledAi({
            sharedState: buildState(2),
            seatControllers,
            seatStates: {},
            engineConfig,
        });

        expect(first?.fingerprintHint).toBe('interaction:1:main2:custom:timing-window:custom-timing-window-1:custom-step:1');
        expect(second?.fingerprintHint).toBe('interaction:1:main2:custom:timing-window:custom-timing-window-1:custom-step:2');
        expect(first?.resolution.attemptKey).not.toBe(second?.resolution.attemptKey);
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

    it('禁用 fallback advance 的游戏交互收口后不得再补发阶段推进命令', () => {
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
            engineConfig: {
                gameId: 'test-no-fallback-game',
                onlineAiRecovery: {
                    disableFallbackAdvancePhase: true,
                },
            },
        });

        expect(result).toBeNull();
    });

    it('合法动作专属阶段不得在交互收口后补发裸阶段推进命令', () => {
        const authoritativeState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
                phase: 'offensiveRoll',
            },
            sys: {
                gameover: undefined,
                phase: 'offensiveRoll',
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
            engineConfig: {
                gameId: 'test-legal-action-only-game',
                onlineAiRecovery: {
                    activeTurnLegalActionOnlyPhases: ['offensiveRoll'],
                },
            },
        });

        expect(result).toBeNull();
    });

    it('自定义游戏交互收口后应按 engineConfig 使用 TEST_END_PHASE 推进阶段', () => {
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
            engineConfig: {
                gameId: 'test-custom-advance-game',
                onlineAiRecovery: {
                    advancePhaseCommandType: 'TEST_END_PHASE',
                },
            },
        });

        expect(result?.action.commands[0]?.type).toBe('TEST_END_PHASE');
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
                            sourceId: 'test_reaction_choose',
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
            payload: { interactionId: 'manual-ai-visible-choice' },
        });
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
            payload: { interactionId: 'manual-ai-hidden-choice' },
        });
    });

    it('手动 visible-interaction 的 sourceId 漂移时，attemptKey 也必须跟随 semantic fingerprint 变化', () => {
        const buildState = (sourceId: string): MatchState<unknown> => ({
            core: {
                activePlayerId: '1',
            },
            sys: {
                gameover: undefined,
                phase: 'scoreBases',
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
        });

        const baseResult = resolveManualForceEndAiPhase({
            sharedState: buildState('test_reaction_choose'),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });
        const driftedResult = resolveManualForceEndAiPhase({
            sharedState: buildState('test_reaction_choose_drifted'),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(baseResult?.reason).toBe('visible-interaction');
        expect(driftedResult?.reason).toBe('visible-interaction');
        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
        expect(baseResult?.fingerprintHint).toContain('manual-visible-interaction:interaction:1:scoreBases:simple-choice:test_reaction_choose');
        expect(driftedResult?.fingerprintHint).toContain('manual-visible-interaction:interaction:1:scoreBases:simple-choice:test_reaction_choose_drifted');
    });

    it('手动 hidden-interaction 的 sourceId 漂移时，attemptKey 也必须跟随 semantic fingerprint 变化', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '0',
            },
            sys: {
                gameover: undefined,
                phase: 'main1',
                interaction: {
                    current: undefined,
                    isBlocked: true,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        };
        const buildSeatState = (sourceId: string): MatchState<unknown> => ({
            ...sharedState,
            sys: {
                ...sharedState.sys,
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
        });

        const baseResult = resolveManualForceEndAiPhase({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: { '1': buildSeatState('hidden-ai-choice') },
        });
        const driftedResult = resolveManualForceEndAiPhase({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: { '1': buildSeatState('hidden-ai-choice-drifted') },
        });

        expect(baseResult?.reason).toBe('hidden-interaction');
        expect(driftedResult?.reason).toBe('hidden-interaction');
        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
        expect(baseResult?.fingerprintHint).toContain('manual-hidden-interaction:interaction:1:main1:simple-choice:hidden-ai-choice');
        expect(driftedResult?.fingerprintHint).toContain('manual-hidden-interaction:interaction:1:main1:simple-choice:hidden-ai-choice-drifted');
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
        expect(result?.resolution.action.commands[0]).toEqual({
            type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE',
            payload: {},
        });
    });

    it('手动 response-window 只应把 manual-response-window 写进 fingerprint，不应变成新的 reason 分支', () => {
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
                    current: {
                        id: 'rw-manual-fingerprint',
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
        expect(result?.fingerprintHint).toBe('manual-response-window:1:main1:afterCardPlayed:card-surprise:1:rw-manual-fingerprint');
        expect(result?.resolution.attemptKey).toContain('manual-response-window:1:main1:afterCardPlayed:card-surprise:1:rw-manual-fingerprint:rw-manual-fingerprint');
        expect(shouldUseOnlineAiEmergencyOverlayFallback(result!.reason)).toBe(true);
    });

    it('手动 response-window 在当前 responder 不变但 responderQueue signature 漂移时，fingerprint 与 attemptKey 也必须变化', () => {
        const buildSharedState = (responderQueue: string[]): MatchState<unknown> => ({
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
                    current: {
                        id: 'rw-manual-queue-signature',
                        windowType: 'afterCardPlayed',
                        sourceId: 'card-surprise',
                        responderQueue,
                        currentResponderIndex: 0,
                    },
                },
            },
        });

        const baseResult = resolveManualForceEndAiPhase({
            sharedState: buildSharedState(['1']),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });
        const driftedResult = resolveManualForceEndAiPhase({
            sharedState: buildSharedState(['1', '2']),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
                '2': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(baseResult?.reason).toBe('response-window');
        expect(driftedResult?.reason).toBe('response-window');
        expect(baseResult?.fingerprintHint).toBe('manual-response-window:1:main1:afterCardPlayed:card-surprise:1:rw-manual-queue-signature');
        expect(driftedResult?.fingerprintHint).toBe('manual-response-window:1:main1:afterCardPlayed:card-surprise:1|2:rw-manual-queue-signature');
        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
    });

    it('手动 response-window 在同 responder 下若 sourceId 漂移，fingerprint 与 attemptKey 也必须变化', () => {
        const buildSharedState = (sourceId: string): MatchState<unknown> => ({
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
                    current: {
                        id: 'rw-manual-source-drift',
                        windowType: 'afterCardPlayed',
                        sourceId,
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        });

        const baseResult = resolveManualForceEndAiPhase({
            sharedState: buildSharedState('card-surprise-a'),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });
        const driftedResult = resolveManualForceEndAiPhase({
            sharedState: buildSharedState('card-surprise-b'),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(baseResult?.reason).toBe('response-window');
        expect(driftedResult?.reason).toBe('response-window');
        expect(baseResult?.fingerprintHint).toBe('manual-response-window:1:main1:afterCardPlayed:card-surprise-a:1:rw-manual-source-drift');
        expect(driftedResult?.fingerprintHint).toBe('manual-response-window:1:main1:afterCardPlayed:card-surprise-b:1:rw-manual-source-drift');
        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
    });

    it('手动 response-window 在同 responder/source 下若 windowType 漂移，fingerprint 与 attemptKey 也必须变化', () => {
        const buildSharedState = (windowType: string): MatchState<unknown> => ({
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
                    current: {
                        id: 'rw-manual-windowtype-drift',
                        windowType,
                        sourceId: 'card-surprise',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        });

        const baseResult = resolveManualForceEndAiPhase({
            sharedState: buildSharedState('afterCardPlayed'),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });
        const driftedResult = resolveManualForceEndAiPhase({
            sharedState: buildSharedState('afterRollConfirmed'),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(baseResult?.reason).toBe('response-window');
        expect(driftedResult?.reason).toBe('response-window');
        expect(baseResult?.fingerprintHint).toBe('manual-response-window:1:main1:afterCardPlayed:card-surprise:1:rw-manual-windowtype-drift');
        expect(driftedResult?.fingerprintHint).toBe('manual-response-window:1:main1:afterRollConfirmed:card-surprise:1:rw-manual-windowtype-drift');
        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
    });

    it('自动 response-window 在同 responder 下若 sourceId 漂移，attemptKey 也必须跟随 semantic fingerprint 变化', () => {
        const buildState = (windowId: string, sourceId: string): MatchState<unknown> => ({
            core: {
                activePlayerId: '0',
            },
            sys: {
                gameover: undefined,
                phase: 'defensiveRoll',
                interaction: {
                    current: null,
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: windowId,
                        windowType: 'afterRollConfirmed',
                        sourceId,
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        });

        const baseResult = resolveForceEndTurnForStalledAi({
            sharedState: buildState('response-window-1', 'attack-old-1'),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });
        const driftedResult = resolveForceEndTurnForStalledAi({
            sharedState: buildState('response-window-1', 'attack-new-1'),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(baseResult?.reason).toBe('response-window');
        expect(driftedResult?.reason).toBe('response-window');
        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
    });

    it('自动 response-window 在 sourceId 相同但 window id 漂移时，attemptKey 也必须跟随 semantic fingerprint 变化', () => {
        const buildState = (windowId: string): MatchState<unknown> => ({
            core: {
                activePlayerId: '0',
            },
            sys: {
                gameover: undefined,
                phase: 'defensiveRoll',
                interaction: {
                    current: null,
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: windowId,
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-old-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        });

        const baseResult = resolveForceEndTurnForStalledAi({
            sharedState: buildState('response-window-1'),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });
        const driftedResult = resolveForceEndTurnForStalledAi({
            sharedState: buildState('response-window-2'),
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {},
        });

        expect(baseResult?.reason).toBe('response-window');
        expect(driftedResult?.reason).toBe('response-window');
        expect(baseResult?.resolution.attemptKey).not.toBe(driftedResult?.resolution.attemptKey);
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

    it('AI 当前阶段里若 human 正在响应，自动 watchdog 不应代替真人强制关闭窗口', () => {
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

        const result = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: {},
        });

        expect(result).toBeNull();
    });

    it('AI 当前阶段里若 AI 可见交互被 human 响应窗口挡住，自动 watchdog 应先强制关闭窗口', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
                phase: 'main1',
            },
            sys: {
                gameover: undefined,
                phase: 'main1',
                interaction: {
                    current: {
                        id: 'dt-interaction-card-transfer-status-1',
                        playerId: '1',
                        kind: 'dt:card-interaction',
                        data: { sourceId: 'card-transfer-status' },
                    },
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'rw-human-response-with-ai-interaction',
                        windowType: 'afterCardPlayed',
                        sourceId: 'card-transfer-status',
                        responderQueue: ['0'],
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

        expect(result).toMatchObject({
            playerId: '1',
            reason: 'response-window',
            resolution: {
                action: {
                    commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                },
            },
        });
        expect(result?.resolution.action.commands).not.toContainEqual({
            type: 'RESPONSE_PASS',
            payload: {},
        });
    });

    it('AI 当前阶段里若 human 正在响应，手动强制结束应强制关闭窗口而不是返回空', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
                phase: 'main1',
            },
            sys: {
                gameover: undefined,
                phase: 'main1',
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

        expect(result).toMatchObject({
            playerId: '1',
            reason: 'response-window',
            fingerprintHint: 'manual-response-window:0:main1:afterCardPlayed:card-surprise:0:rw-human-response',
            resolution: {
                action: {
                    commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                },
            },
        });
        expect(result?.resolution.action.commands).not.toContainEqual({
            type: 'RESPONSE_PASS',
            payload: {},
        });
    });

    it('human 当前阶段里若 human 正在响应，自动和手动恢复都不得强制关闭窗口', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '0',
                phase: 'main1',
            },
            sys: {
                gameover: undefined,
                phase: 'main1',
                interaction: {
                    current: null,
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'rw-human-own-turn-response',
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

        expect(resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: {},
        })).toBeNull();
        expect(resolveManualForceEndAiPhase({
            sharedState,
            seatControllers,
            seatStates: {},
        })).toBeNull();
    });

    it('手动强制结束在 AI 阶段无显式阻塞面时，也应返回兜底推进命令', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '1',
                phase: 'main1',
            },
            sys: {
                gameover: undefined,
                phase: 'main1',
                interaction: {
                    current: null,
                    isBlocked: false,
                    queue: [],
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

        expect(result).toMatchObject({
            playerId: '1',
            reason: 'active-turn',
            resolution: {
                action: {
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        });
    });

    it('手动强制结束在真人阶段且无 AI 阻塞面时，不应借 AI 座位伪造推进', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                activePlayerId: '0',
                phase: 'main1',
            },
            sys: {
                gameover: undefined,
                phase: 'main1',
                interaction: {
                    current: null,
                    isBlocked: false,
                    queue: [],
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

        expect(result).toBeNull();
    });
});
