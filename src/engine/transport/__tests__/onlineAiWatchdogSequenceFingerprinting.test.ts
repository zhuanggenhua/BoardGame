import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import {
    buildOnlineAiRecoverySequenceStepKey,
    readOnlineAiRefereeDecisionRecoveryFingerprint,
    readOnlineAiCurrentInteractionSemanticFingerprint,
    resolveOnlineAiRecoveryFingerprint,
} from '../onlineAiWatchdogSequenceFingerprinting';

const createState = (overrides: Partial<MatchState<unknown>> = {}): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase: 'main',
        turnNumber: 1,
        eventStream: { nextId: 1, entries: [] },
    },
    ...overrides,
}) as unknown as MatchState<unknown>;

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

describe('onlineAiWatchdogSequenceFingerprinting', () => {
    it('普通 idle 状态没有裁判证据时不改变 recovery step key', () => {
        expect(buildOnlineAiRecoverySequenceStepKey({
            state: createState(),
            playerId: '1',
            progressMarker: 'idle-progress-marker',
        })).toBe('idle-progress-marker');
    });

    it('没有 tracker fingerprint 时按候选和权威状态生成 fallback fingerprint', () => {
        const fingerprint = resolveOnlineAiRecoveryFingerprint({
            state: createState({
                core: {
                    pendingDamage: {
                        id: 'damage-1',
                        responderId: '1',
                        responseType: 'prevent',
                    },
                },
            } as unknown as MatchState<unknown>),
            candidate: createCandidate({ reason: 'pending-damage' }),
            progressMarker: 'progress-marker-fallback',
        });

        expect(fingerprint).toBe('pending-damage:1:main:damage-1:prevent');
    });

    it('交互语义指纹应包含 option 状态，避免同一 marker 下把真实变化误判成 no_progress', () => {
        const createChoiceState = (disabled: boolean): MatchState<unknown> => createState({
            sys: {
                phase: 'main',
                turnNumber: 1,
                eventStream: { nextId: 1, entries: [] },
                interaction: {
                    current: {
                        id: 'choice-1',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'source-1',
                            title: 'choose',
                            options: [
                                { id: 'pass', disabled, value: { kind: 'pass' } },
                            ],
                        },
                    },
                },
            },
        } as unknown as MatchState<unknown>);
        const enabledState = createChoiceState(false);
        const disabledState = createChoiceState(true);

        expect(readOnlineAiCurrentInteractionSemanticFingerprint(enabledState, '1'))
            .not.toBe(readOnlineAiCurrentInteractionSemanticFingerprint(disabledState, '1'));
        expect(buildOnlineAiRecoverySequenceStepKey({
            state: enabledState,
            playerId: '1',
            progressMarker: 'same-progress-marker',
        })).not.toBe(buildOnlineAiRecoverySequenceStepKey({
            state: disabledState,
            playerId: '1',
            progressMarker: 'same-progress-marker',
        }));
    });

    it('交互语义指纹应包含 pendingDamage，避免响应结算变化被同一交互壳吞掉', () => {
        const createDamageState = (currentDamage: number): MatchState<unknown> => createState({
            core: {
                pendingDamage: {
                    id: 'damage-1',
                    responderId: '1',
                    responseType: 'prevent',
                    currentDamage,
                },
            },
            sys: {
                phase: 'main',
                turnNumber: 1,
                eventStream: { nextId: 1, entries: [] },
                interaction: {
                    current: {
                        id: 'damage-choice',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'damage-source',
                            title: 'prevent damage',
                            options: [
                                { id: 'confirm', disabled: false, value: { kind: 'confirm' } },
                            ],
                        },
                    },
                },
            },
        } as unknown as MatchState<unknown>);

        expect(readOnlineAiCurrentInteractionSemanticFingerprint(createDamageState(3), '1'))
            .not.toBe(readOnlineAiCurrentInteractionSemanticFingerprint(createDamageState(2), '1'));
    });

    it('同一 progress marker 下 active resolution frame 变化会进入 recovery step key', () => {
        const createFrameState = (blockedById: string): MatchState<unknown> => createState({
            sys: {
                phase: 'main',
                turnNumber: 1,
                eventStream: { nextId: 1, entries: [] },
                resolution: {
                    activeFrameId: 'frame-1',
                    frames: [{
                        id: 'frame-1',
                        kind: 'damage-resolution',
                        ordering: 'explicit',
                        status: 'blocked',
                        blockedBy: { type: 'interaction', id: blockedById },
                    }],
                },
            },
        } as unknown as MatchState<unknown>);

        expect(buildOnlineAiRecoverySequenceStepKey({
            state: createFrameState('choice-a'),
            playerId: '1',
            progressMarker: 'same-progress-marker',
        })).not.toBe(buildOnlineAiRecoverySequenceStepKey({
            state: createFrameState('choice-b'),
            playerId: '1',
            progressMarker: 'same-progress-marker',
        }));
    });

    it('同一 progress marker 下裁判提交证据变化会进入 recovery fingerprint', () => {
        const createTraceState = (opportunityId: string): MatchState<unknown> => createState({
            sys: {
                phase: 'main',
                turnNumber: 1,
                eventStream: { nextId: 1, entries: [] },
                refereeTrace: {
                    entries: [{
                        id: 1,
                        evidence: {
                            timingPointId: 'commit-damage',
                            position: 'eventCommit',
                            factKind: 'damage',
                            originalEventType: 'DAMAGE_DEALT',
                            commandType: 'ATTACK',
                            opportunityIds: [opportunityId],
                            opportunityTimingPointIds: [`prevent-${opportunityId}`],
                            appliedOpportunityIds: [opportunityId],
                        },
                    }],
                    maxEntries: 10,
                    nextId: 2,
                },
            },
        } as unknown as MatchState<unknown>);

        expect(resolveOnlineAiRecoveryFingerprint({
            state: createTraceState('shield-a'),
            candidate: createCandidate({ reason: 'active-turn' }),
            progressMarker: 'same-progress-marker',
        })).not.toBe(resolveOnlineAiRecoveryFingerprint({
            state: createTraceState('shield-b'),
            candidate: createCandidate({ reason: 'active-turn' }),
            progressMarker: 'same-progress-marker',
        }));
    });

    it('裁判恢复指纹按玩家视角隐藏其它玩家私有候选', () => {
        const state = createState({
            sys: {
                phase: 'main',
                turnNumber: 1,
                eventStream: { nextId: 1, entries: [] },
                interaction: {
                    current: {
                        id: 'secret-choice',
                        kind: 'simple-choice',
                        playerId: '2',
                        data: {
                            sourceId: 'secret-card',
                            options: [{
                                id: 'secret-option',
                                value: { hiddenCardId: 'hidden-card' },
                            }],
                        },
                    },
                },
            },
        } as unknown as MatchState<unknown>);

        const fingerprint = readOnlineAiRefereeDecisionRecoveryFingerprint(state, '1');

        expect(fingerprint).toContain('blocked-interaction');
        expect(fingerprint).toContain('2');
        expect(fingerprint).not.toContain('secret-option');
        expect(fingerprint).not.toContain('hidden-card');
    });
});
