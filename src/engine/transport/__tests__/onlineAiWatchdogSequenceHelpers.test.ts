import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import {
    buildResponseWindowRecoveryFingerprintHint,
    type ForceEndTurnStalledAiResolution,
} from '../onlineAiRecovery';
import {
    canManualForceAdvanceAfterConfirmedRoll,
    isManualOnlineAiRecoveryContinuationCandidate,
    resolveOnlineAiForcedRecoveryCommandDecisionFromRuntime,
    resolveOnlineAiForcedRecoveryFailureDispatchDecision,
    resolveOnlineAiLegacyResponseWindowMirrorClearDecision,
    resolveOnlineAiRecoveryCompletionFailureDispatchDecision,
    resolveOnlineAiRecoveryFollowUpTransitionFromRuntime,
    resolveOnlineAiRecoverySuccessFeedbackDecision,
    shouldPreserveManualHumanResponseWindowForceClose,
} from '../onlineAiWatchdogSequenceHelpers';
import type { OnlineAiWatchdogSeatController } from '../onlineAiWatchdogSeatControllers';

const createState = (overrides: Partial<MatchState<unknown>> = {}): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase: 'main',
        turnNumber: 1,
        eventStream: { nextId: 1, entries: [] },
    },
    ...overrides,
}) as unknown as MatchState<unknown>;

const seatControllers: Record<string, OnlineAiWatchdogSeatController> = {
    '0': { type: 'human' },
    '1': { type: 'local-ai' },
};

const createCandidate = (
    overrides: Partial<ForceEndTurnStalledAiResolution> = {},
): ForceEndTurnStalledAiResolution => ({
    playerId: '1',
    reason: 'active-turn',
    resolution: {
        playerId: '1',
        attemptKey: 'force-end-turn:1',
        source: 'local-ai',
        action: {
            actionId: 'force-end-turn:1',
            kind: 'force-end-turn',
            label: '强制结束 AI 回合',
            commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
        },
    },
    ...overrides,
});

describe('onlineAiWatchdogSequenceHelpers', () => {
    it('manual continuation 只接受正式前缀，确认主骰后才允许强推阶段', () => {
        expect(isManualOnlineAiRecoveryContinuationCandidate(createCandidate({
            fingerprintHint: 'manual-immediate-ai-continuation:1:marker',
        }))).toBe(true);
        expect(isManualOnlineAiRecoveryContinuationCandidate(createCandidate({
            fingerprintHint: 'manual-force-advance-after-confirm:1:marker',
        }))).toBe(true);
        expect(isManualOnlineAiRecoveryContinuationCandidate(createCandidate({
            fingerprintHint: 'manual-response-window:1:marker',
        }))).toBe(false);

        expect(canManualForceAdvanceAfterConfirmedRoll({
            actionKind: 'confirm-roll',
            metadata: { rollConfirmScope: 'main-roll' },
        })).toBe(true);
        expect(canManualForceAdvanceAfterConfirmedRoll({
            actionKind: 'confirm-roll',
            metadata: { rollConfirmScope: 'bonus-roll' },
        })).toBe(false);
    });

    it('manual response-window 保留只允许真人当前响应者且同一 recovery 指纹', () => {
        const state = createState({
            sys: {
                phase: 'main',
                turnNumber: 1,
                eventStream: { nextId: 2, entries: [] },
                responseWindow: {
                    current: {
                        sourceId: 'manual-window',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 0,
                    },
                },
            } as MatchState<unknown>['sys'],
        });
        const expectedCandidate = createCandidate({
            reason: 'response-window',
            fingerprintHint: buildResponseWindowRecoveryFingerprintHint(
                state,
                '1',
                'manual-response-window',
            ),
            resolution: {
                playerId: '1',
                attemptKey: 'manual-response-window:1',
                source: 'local-ai',
                action: {
                    actionId: 'manual-response-window:1',
                    kind: 'force-end-turn',
                    label: '强制关闭响应窗口',
                    commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                },
            },
        });

        expect(shouldPreserveManualHumanResponseWindowForceClose({
            state,
            expectedCandidate,
            seatControllers,
            currentPlayerId: '1',
        })).toBe(true);

        expect(shouldPreserveManualHumanResponseWindowForceClose({
            state,
            expectedCandidate,
            seatControllers,
            currentPlayerId: '0',
        })).toBe(false);
    });

    it('legacy response-window mirror 只清理配置白名单中的 sourceId', () => {
        const state = createState({
            sys: {
                phase: 'main',
                turnNumber: 1,
                eventStream: { nextId: 2, entries: [] },
                responseWindow: {
                    current: {
                        sourceId: 'legacy-reaction-window',
                    },
                },
            } as MatchState<unknown>['sys'],
        });

        expect(resolveOnlineAiLegacyResponseWindowMirrorClearDecision({
            state,
            legacySourceIds: ['legacy-reaction-window'],
        })).toEqual({
            kind: 'clear',
            sourceId: 'legacy-reaction-window',
        });

        expect(resolveOnlineAiLegacyResponseWindowMirrorClearDecision({
            state,
            legacySourceIds: ['other-window'],
        })).toEqual({ kind: 'skip' });
    });

    it('RESPONSE_PASS 后同一 AI response-window 重开时升级为 response-loop 强关候选', () => {
        const state = createState({
            sys: {
                phase: 'main',
                turnNumber: 1,
                eventStream: { nextId: 2, entries: [] },
                responseWindow: {
                    current: {
                        windowType: 'interrupt',
                        sourceId: 'reaction-window',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            } as MatchState<unknown>['sys'],
        });
        const currentCandidate = createCandidate({ reason: 'response-window' });
        const nextCandidate = createCandidate({
            reason: 'response-window',
            fingerprintHint: 'next-response-window',
            resolution: {
                playerId: '1',
                attemptKey: 'response-pass:1',
                source: 'local-ai',
                action: {
                    actionId: 'response-pass:1',
                    kind: 'response-pass',
                    label: '跳过响应',
                    commands: [{ type: 'RESPONSE_PASS', payload: {} }],
                },
            },
        });

        const decision = resolveOnlineAiRecoveryFollowUpTransitionFromRuntime({
            state,
            rootCandidate: currentCandidate,
            currentCandidate,
            nextCandidate,
            currentPlayerIdBeforeStep: '1',
            currentPlayerIdAfterStep: '1',
            actionRecoveryApplied: true,
            responseWindowFingerprintBeforeStep: 'response-window-before',
            seatViewInteractionAfterStep: null,
            executedResponsePass: true,
            hasHumanResponderInCurrentWindow: false,
            hasLiveSeatConnection: false,
            allowForceCommandAfterLegalActionExhaustedRequested: false,
        });

        expect(decision.kind).toBe('continue-with-candidate');
        if (decision.kind !== 'continue-with-candidate') {
            return;
        }
        expect(decision.candidate.reason).toBe('response-loop');
        expect(decision.candidate.resolution.action.commands).toEqual([
            { type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} },
        ]);
    });

    it('交互恢复后回到 AI active-turn 时按 confirmed-advance 合同限制为 legal-action-only', () => {
        const state = createState();
        const rootCandidate = createCandidate({
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: true,
        });
        const nextCandidate = createCandidate({
            reason: 'active-turn',
            resolution: {
                playerId: '1',
                attemptKey: 'advance:1',
                source: 'local-ai',
                action: {
                    actionId: 'advance:1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        });

        const decision = resolveOnlineAiRecoveryFollowUpTransitionFromRuntime({
            state,
            rootCandidate,
            currentCandidate: rootCandidate,
            nextCandidate,
            currentPlayerIdBeforeStep: '0',
            currentPlayerIdAfterStep: '1',
            actionRecoveryApplied: true,
            responseWindowFingerprintBeforeStep: null,
            seatViewInteractionAfterStep: 'visible-interaction:still-private',
            executedResponsePass: false,
            hasHumanResponderInCurrentWindow: false,
            hasLiveSeatConnection: false,
            allowForceCommandAfterLegalActionExhaustedRequested: false,
        });

        expect(decision.kind).toBe('continue-with-candidate');
        if (decision.kind !== 'continue-with-candidate') {
            return;
        }
        expect(decision.candidate).toMatchObject({
            reason: 'active-turn',
            legalActionOnly: true,
        });
        expect(decision.candidate.resolution.action.commands).toEqual([]);
        expect(decision.nextTrackerKey).toContain('1:active-turn:');
    });

    it('legal-action-only 且无可用 legal action 时不越权执行强制命令', () => {
        const decision = resolveOnlineAiForcedRecoveryCommandDecisionFromRuntime({
            gameId: 'test-game',
            state: createState(),
            seatControllers,
            currentCandidate: createCandidate({
                reason: 'active-turn',
                legalActionOnly: true,
            }),
            actionRecovery: {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
                reportedAction: null,
            },
            blockedFailureReason: null,
            resolveForceCommandAllowance: undefined,
            formatCommandFailureReason: (reason) => reason,
        });

        expect(decision).toEqual({
            kind: 'report-legal-action-unavailable',
            failureReason: 'legal_action_unavailable',
        });
    });

    it('forced fallback 失败分派应保留重校验语义和命令失败原因', () => {
        const currentCandidate = createCandidate({ reason: 'active-turn' });
        const formatCommandFailureReason = (
            reason: string,
            failedCommandType?: string,
            commandFailureReason?: string | null,
        ) => [reason, failedCommandType, commandFailureReason].filter(Boolean).join(':');

        expect(resolveOnlineAiForcedRecoveryFailureDispatchDecision({
            forcedRecoveryCommandDecision: {
                kind: 'report-legal-action-command-failed',
                failureReason: 'legal_action_command_failed:sw:select_faction',
            },
            currentCandidate,
            currentPhaseLabel: 'follow-up-advance',
            formatCommandFailureReason,
        })).toEqual({
            kind: 'report-failure',
            candidate: currentCandidate,
            phaseLabel: 'follow-up-advance',
            reason: 'legal_action_command_failed:sw:select_faction',
        });

        expect(resolveOnlineAiForcedRecoveryFailureDispatchDecision({
            forcedRecoveryCommandDecision: { kind: 'advance-guard-blocked' },
            currentCandidate,
            currentPhaseLabel: 'follow-up-advance',
            formatCommandFailureReason,
        })).toEqual({
            kind: 'report-failure',
            candidate: currentCandidate,
            phaseLabel: 'follow-up-advance',
            reason: 'advance_guard_blocked',
            shouldRevalidateCandidate: false,
        });

        expect(resolveOnlineAiForcedRecoveryFailureDispatchDecision({
            forcedRecoveryCommandDecision: {
                kind: 'execute-forced-command',
                commandType: 'END_PHASE',
                commandPayload: {},
                shouldCountAdvanceStep: true,
            },
            currentCandidate,
            currentPhaseLabel: 'follow-up-advance',
            commandExecutionSucceeded: false,
            commandFailureReason: 'phase-locked',
            formatCommandFailureReason,
        })).toEqual({
            kind: 'report-failure',
            candidate: currentCandidate,
            phaseLabel: 'follow-up-advance',
            reason: 'command_failed:END_PHASE:phase-locked',
        });
    });

    it('收口失败决策应区分旧 blocker 持续和完全无推进', () => {
        const currentCandidate = createCandidate({ reason: 'active-turn' });
        const unresolvedCandidate = createCandidate({
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: true,
        });

        expect(resolveOnlineAiRecoveryCompletionFailureDispatchDecision({
            rootPlayerId: '1',
            unresolvedCandidate,
            markerAfterRecovery: 'marker-after',
            progressMarkerBeforeRecovery: 'marker-before',
            currentCandidate,
            currentPhaseLabel: 'follow-up-advance',
        })).toEqual({
            kind: 'report-failure',
            candidate: unresolvedCandidate,
            phaseLabel: 'recover-interaction',
            reason: 'blocker_persisted',
        });

        expect(resolveOnlineAiRecoveryCompletionFailureDispatchDecision({
            rootPlayerId: '1',
            unresolvedCandidate: null,
            markerAfterRecovery: 'marker-before',
            progressMarkerBeforeRecovery: 'marker-before',
            currentCandidate,
            currentPhaseLabel: 'follow-up-advance',
        })).toEqual({
            kind: 'report-failure',
            candidate: currentCandidate,
            phaseLabel: 'follow-up-advance',
            reason: 'no_progress',
        });
    });

    it('成功反馈决策应统一 legal-action、observed recovery 和 forced success 元数据', () => {
        const baseArgs = {
            matchId: 'match-1',
            gameId: 'summonerwars',
            trackerKey: 'tracker-1',
            progressMarker: 'marker-1',
            rootPlayerId: '1',
            fallbackReason: 'seat-legal-only' as ForceEndTurnStalledAiResolution['reason'],
            fallbackPhaseLabel: 'follow-up-advance' as const,
        };

        expect(resolveOnlineAiRecoverySuccessFeedbackDecision({
            ...baseArgs,
            forcedCommandProgress: {
                usedForcedRecoveryCommand: false,
                totalAdvanceSteps: 0,
                totalForcedCommands: 0,
                lastForcedReason: null,
                lastForcedPhaseLabel: 'follow-up-advance',
            },
            sequenceProgress: {
                recoverySteps: 1,
                allowNaturalAiContinuation: false,
                lastUnreportedLegalActionRecovery: null,
            },
            shouldReportObservedRecoveryWithoutForcedCommand: true,
        })).toEqual({
            kind: 'report',
            metadata: {
                matchId: 'match-1',
                gameId: 'summonerwars',
                playerId: '1',
                incidentKind: 'observed-recovery',
                severity: 'medium',
                status: 'resolved',
                reason: 'seat-legal-only:observed-progress',
                trackerKey: 'tracker-1',
                progressMarker: 'marker-1',
            },
        });

        expect(resolveOnlineAiRecoverySuccessFeedbackDecision({
            ...baseArgs,
            forcedCommandProgress: {
                usedForcedRecoveryCommand: true,
                totalAdvanceSteps: 2,
                totalForcedCommands: 1,
                lastForcedReason: 'active-turn',
                lastForcedPhaseLabel: 'follow-up-advance',
            },
            sequenceProgress: {
                recoverySteps: 3,
                allowNaturalAiContinuation: false,
                lastUnreportedLegalActionRecovery: null,
            },
        })).toEqual({
            kind: 'report',
            metadata: expect.objectContaining({
                incidentKind: 'force-end-turn-success',
                reason: 'active-turn:follow-up-advance:steps=2',
            }),
        });
    });
});
