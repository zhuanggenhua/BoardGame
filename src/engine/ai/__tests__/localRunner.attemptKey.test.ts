import { describe, expect, it } from 'vitest';
import { registerGameAiRuntime, resolveNextAiAction } from '..';
import type { MatchState } from '../../types';

const buildState = (decisionEpoch: number): MatchState<unknown> => ({
    core: {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 1,
    },
    sys: {
        phase: 'scoreBases',
        turnNumber: 1,
        decisionEpoch,
        eventStream: {
            nextId: 5,
            entries: [],
        },
        interaction: {
            current: {
                id: 'reaction-choice-1',
                kind: 'simple-choice',
                playerId: '1',
                data: {
                    sourceId: 'test_reaction_choose',
                    options: [
                        { id: 'trigger-a', disabled: false },
                        { id: 'pass', disabled: false },
                    ],
                },
            },
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            current: {
                id: 'reaction-window-1',
                windowType: 'afterScoring',
                sourceId: 'test_reaction_choose',
                responderQueue: ['1'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        },
    },
}) as MatchState<unknown>;

const buildDecisionOwnerState = (decisionOwnerId: string): MatchState<unknown> => ({
    ...buildState(12),
    core: {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        decisionOwnerId,
    },
    sys: {
        ...buildState(12).sys,
        phase: 'testDecisionPhase',
    },
}) as MatchState<unknown>;

describe('resolveNextAiAction attemptKey', () => {
    it('决策面 epoch 变化时应生成新的 attemptKey，避免把新 AI 决策误压成重复尝试', async () => {
        const gameId = '__test_local_ai_attempt_key_decision_epoch__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') {
                    return [];
                }
                return [{
                    actionId: 'response-pass',
                    kind: 'response-pass',
                    label: 'Pass',
                    commands: [{ type: 'RESPONSE_PASS', payload: {} }],
                }];
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'response-pass' }),
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const seatControllers = {
            '1': { type: 'local-ai', minimumActionDelayMs: 0 },
        } as const;
        const engineConfig = {
            gameId,
            domain: {},
            systems: [],
        } as never;

        const first = await resolveNextAiAction({
            engineConfig,
            state: buildState(7),
            matchId: 'match-attempt-key-1',
            seatControllers,
        });
        const second = await resolveNextAiAction({
            engineConfig,
            state: buildState(8),
            matchId: 'match-attempt-key-2',
            seatControllers,
        });

        expect(first?.attemptKey).toBeTruthy();
        expect(second?.attemptKey).toBeTruthy();
        expect(first?.attemptKey).not.toBe(second?.attemptKey);
    });

    it('runtime 声明的当前决策者变化时应生成新的 attemptKey', async () => {
        const gameId = '__test_local_ai_attempt_key_runtime_decision_owner__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') {
                    return [];
                }
                return [{
                    actionId: 'response-pass',
                    kind: 'response-pass',
                    label: 'Pass',
                    commands: [{ type: 'RESPONSE_PASS', payload: {} }],
                }];
            },
            resolveCurrentDecisionPlayerId({ state }) {
                const ownerId = (state.core as { decisionOwnerId?: unknown } | undefined)?.decisionOwnerId;
                return typeof ownerId === 'string' ? ownerId : undefined;
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'response-pass' }),
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const seatControllers = {
            '1': { type: 'local-ai', minimumActionDelayMs: 0 },
        } as const;
        const engineConfig = {
            gameId,
            domain: {},
            systems: [],
        } as never;

        const first = await resolveNextAiAction({
            engineConfig,
            state: buildDecisionOwnerState('1'),
            matchId: 'match-attempt-key-decision-owner-1',
            seatControllers,
        });
        const second = await resolveNextAiAction({
            engineConfig,
            state: buildDecisionOwnerState('0'),
            matchId: 'match-attempt-key-decision-owner-2',
            seatControllers,
        });

        expect(first?.attemptKey).toBeTruthy();
        expect(second?.attemptKey).toBeTruthy();
        expect(first?.attemptKey).not.toBe(second?.attemptKey);
    });

    it('本地 AI 策略若仍返回无进展微操作，runner 应允许 runtime 改成收口动作', async () => {
        const gameId = '__test_local_ai_refine_action__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') {
                    return [];
                }
                return [
                    {
                        actionId: 'toggle-die-lock:0:lock',
                        kind: 'toggle-die-lock',
                        label: '锁定骰子 0',
                        commands: [{ type: 'TOGGLE_DIE_LOCK', payload: { dieId: 0, keep: true } }],
                    },
                    {
                        actionId: 'confirm-roll',
                        kind: 'confirm-roll',
                        label: '确认掷骰',
                        commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                    },
                ];
            },
            refineAiAction({ context, proposedAction }) {
                if (proposedAction.kind !== 'toggle-die-lock') {
                    return proposedAction;
                }
                return context.legalActions.find((action) => action.kind === 'confirm-roll') ?? proposedAction;
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'toggle-die-lock:0:lock' }),
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {},
                systems: [],
            } as never,
            state: buildState(9),
            matchId: 'match-refine-action-1',
            seatControllers: {
                '1': { type: 'local-ai', minimumActionDelayMs: 0 },
            },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('confirm-roll');
        expect(resolution?.action.commands).toEqual([{ type: 'CONFIRM_ROLL', payload: {} }]);
    });

    it('refineAiAction 返回 null 时应拒绝本地 fallback 动作，而不是继续执行原候选动作', async () => {
        const gameId = '__test_local_ai_refine_rejects_local_fallback__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') {
                    return [];
                }
                return [{
                    actionId: 'unsafe-fallback-action',
                    kind: 'unsafe-fallback-action',
                    label: '不安全 fallback',
                    commands: [{ type: 'UNSAFE_FALLBACK', payload: {} }],
                }];
            },
            refineAiAction({ source }) {
                if (source === 'local-fallback') {
                    return null;
                }
                return undefined;
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {},
                systems: [],
            } as never,
            state: buildState(10),
            matchId: 'match-refine-reject-fallback-1',
            seatControllers: {
                '1': { type: 'local-ai', minimumActionDelayMs: 0 },
            },
        });

        expect(resolution).toBeNull();
    });

    it('响应窗口被私有交互锁定时不应 fallback 成 RESPONSE_PASS', async () => {
        const gameId = '__test_local_ai_pending_interaction_blocks_response_pass_fallback__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const state = buildState(11);
        state.sys.interaction.current = undefined;
        state.sys.responseWindow.current = {
            ...state.sys.responseWindow.current,
            pendingInteractionId: 'hidden-response-choice-1',
        } as typeof state.sys.responseWindow.current;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {},
                systems: [],
            } as never,
            state,
            matchId: 'match-pending-response-pass-fallback-1',
            seatControllers: {
                '1': { type: 'local-ai', minimumActionDelayMs: 0 },
            },
        });

        expect(resolution).toBeNull();
    });
});
