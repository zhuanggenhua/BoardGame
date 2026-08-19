import { afterEach, describe, expect, it, vi } from 'vitest';
import * as aiModule from '../../ai';
import type { MatchState } from '../../types';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import {
    MANUAL_FORCE_ADVANCE_AFTER_CONFIRMED_ROLL_PREFIX,
    resolveOnlineAiRecoveryDispatch,
} from '../onlineAiRecoveryDispatch';

const createState = (sys: Record<string, unknown> = {}): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase: 'main',
        turnNumber: 1,
        eventStream: { nextId: 1 },
        ...sys,
    },
}) as unknown as MatchState<unknown>;

const createCandidate = (
    reason: ForceEndTurnStalledAiResolution['reason'] = 'response-window',
    overrides: Partial<ForceEndTurnStalledAiResolution> = {},
): ForceEndTurnStalledAiResolution => ({
    playerId: '1',
    reason,
    resolution: {
        playerId: '1',
        attemptKey: `force-end-turn:1:${reason}`,
        source: 'local-ai',
        action: {
            actionId: `force-end-turn:${reason}`,
            kind: 'force-end-turn',
            label: '强制结束 AI 回合',
            commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
        },
    },
    ...overrides,
});

const engineConfig = {
    gameId: 'test-online-ai-recovery-dispatch',
} as any;

const createBlockedDispatch = (
    blockedReason: 'missing-private-overlay' | 'stale-private-overlay',
) => ({
    kind: 'blocked' as const,
    playerId: '1',
    blockedReason,
    visibility: 'private-required' as const,
    blockedKey: `1:private-required:${blockedReason}`,
    diagnostics: null,
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('onlineAiRecoveryDispatch', () => {
    it('human seat 和手动确认骰面后推进候选不应进入 AI dispatch', async () => {
        const dispatchSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');

        const humanResult = await resolveOnlineAiRecoveryDispatch({
            engineConfig,
            gameId: engineConfig.gameId,
            matchId: 'match-human-seat',
            sharedState: createState(),
            candidate: createCandidate(),
            seatController: { type: 'human' },
            resolvePrivateOverlay: () => createState(),
        });

        const manualResult = await resolveOnlineAiRecoveryDispatch({
            engineConfig,
            gameId: engineConfig.gameId,
            matchId: 'match-manual-confirmed-advance',
            sharedState: createState(),
            candidate: createCandidate('active-turn', {
                fingerprintHint: `${MANUAL_FORCE_ADVANCE_AFTER_CONFIRMED_ROLL_PREFIX}1:main`,
            }),
            seatController: { type: 'local-ai' },
            resolvePrivateOverlay: () => createState(),
        });

        expect(humanResult).toEqual({ kind: 'no-legal-action' });
        expect(manualResult).toEqual({ kind: 'no-legal-action' });
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('private overlay 缺失时应先 strict 决策，再用 emergency playerView 重试动作', async () => {
        const privateOverlay = createState({
            responseWindow: {
                current: {
                    id: 'response-window-1',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                },
            },
        });
        const retrySpy = vi.fn();
        vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockImplementationOnce(async (args: any) => {
                const strictView = args.visibleStateResolver('1');
                expect(strictView.kind).toBe('online-ai-decision-view');
                return createBlockedDispatch('missing-private-overlay');
            })
            .mockImplementationOnce(async (args: any) => {
                const emergencyView = args.visibleStateResolver('1');
                expect(emergencyView).toBe(privateOverlay);
                return {
                    kind: 'action',
                    resolution: {
                        playerId: '1',
                        attemptKey: 'response-play-card:1',
                        source: 'local-ai',
                        action: {
                            actionId: 'response-play-card:1',
                            kind: 'response-play-card',
                            label: '打出响应牌',
                            commands: [{ type: 'PLAY_CARD', payload: { cardId: 'c1' } }],
                        },
                    },
                };
            });

        const result = await resolveOnlineAiRecoveryDispatch({
            engineConfig,
            gameId: engineConfig.gameId,
            matchId: 'match-emergency-player-view',
            sharedState: createState({
                responseWindow: {
                    current: {
                        id: 'response-window-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            candidate: createCandidate('response-window'),
            seatController: { type: 'local-ai' },
            resolvePrivateOverlay: () => privateOverlay,
            onEmergencyOverlayFallbackRetry: retrySpy,
        });

        expect(result).toMatchObject({
            kind: 'action',
            resolution: {
                playerId: '1',
                action: {
                    commands: [{ type: 'PLAY_CARD', payload: { cardId: 'c1' } }],
                },
            },
        });
        expect(retrySpy).toHaveBeenCalledWith({
            playerId: '1',
            reason: 'response-window',
            blockedReason: 'missing-private-overlay',
            blockedKey: '1:private-required:missing-private-overlay',
        });
    });

    it('response-loop 经 emergency playerView 后仍 stale 时不应要求 overlay resync', async () => {
        vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce(createBlockedDispatch('stale-private-overlay'))
            .mockResolvedValueOnce(createBlockedDispatch('stale-private-overlay'));

        const result = await resolveOnlineAiRecoveryDispatch({
            engineConfig,
            gameId: engineConfig.gameId,
            matchId: 'match-response-loop-no-resync',
            sharedState: createState({
                responseWindow: {
                    current: {
                        id: 'response-loop-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            candidate: createCandidate('response-loop'),
            seatController: { type: 'local-ai' },
            resolvePrivateOverlay: () => createState(),
        });

        expect(result).toEqual({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            visibility: 'private-required',
            blockedKey: '1:private-required:stale-private-overlay',
            shouldTriggerOverlayResync: false,
        });
        expect(aiModule.resolveNextAiDispatch).toHaveBeenCalledTimes(2);
    });

    it('非 response-loop 私有视图阻断时应要求 overlay resync', async () => {
        vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce(createBlockedDispatch('stale-private-overlay'))
            .mockResolvedValueOnce(createBlockedDispatch('stale-private-overlay'));

        const result = await resolveOnlineAiRecoveryDispatch({
            engineConfig,
            gameId: engineConfig.gameId,
            matchId: 'match-response-window-resync',
            sharedState: createState({
                responseWindow: {
                    current: {
                        id: 'response-window-2',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            candidate: createCandidate('response-window'),
            seatController: { type: 'local-ai' },
            resolvePrivateOverlay: () => createState(),
        });

        expect(result).toMatchObject({
            kind: 'blocked',
            blockedReason: 'stale-private-overlay',
            shouldTriggerOverlayResync: true,
        });
        expect(aiModule.resolveNextAiDispatch).toHaveBeenCalledTimes(2);
    });
});
