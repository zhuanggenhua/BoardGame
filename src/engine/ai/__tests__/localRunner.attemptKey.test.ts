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
                    sourceId: 'smashup_reaction_choose',
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
                sourceId: 'smashup_reaction_choose',
                responderQueue: ['1'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        },
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
});
