import { describe, expect, it } from 'vitest';
import type { EventCommitEvidence, MatchState } from '../../types';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import {
    buildOnlineAiDiagnosticActionLog,
    buildOnlineAiRecoveryStateSnapshot,
    buildOnlineAiUnsatisfiableInteractionStateSnapshot,
    extractOnlineAiRecoveryFingerprintFromTrackerKey,
    resolveOnlineAiRecoveryBlockerFingerprint,
} from '../onlineAiWatchdogFeedbackDiagnostics';

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

const createEvidence = (): EventCommitEvidence => ({
    timingPointId: 'commit-damage',
    position: 'eventCommit',
    factKind: 'DAMAGE_DEALT',
    originalEventType: 'DAMAGE_DEALT',
    originalEventTimestamp: 10,
    commandType: 'ATTACK',
    parentFrameId: 'frame-1',
    opportunityIds: ['opp-shield'],
    opportunityTimingPointIds: ['prevent-damage'],
    appliedOpportunityIds: ['opp-shield'],
});

describe('onlineAiWatchdogFeedbackDiagnostics', () => {
    it('从 tracker key 只提取同一玩家和同一原因的 recovery fingerprint', () => {
        expect(extractOnlineAiRecoveryFingerprintFromTrackerKey(
            '1',
            'visible-interaction',
            '1:visible-interaction:interaction:1:main:simple-choice',
        )).toBe('interaction:1:main:simple-choice');

        expect(extractOnlineAiRecoveryFingerprintFromTrackerKey(
            '1',
            'visible-interaction',
            '2:visible-interaction:interaction:2:main:simple-choice',
        )).toBeNull();
    });

    it('blocker fingerprint 优先保留 tracker key，并追加私有视图失败原因', () => {
        const fingerprint = resolveOnlineAiRecoveryBlockerFingerprint({
            state: createState(),
            candidate: createCandidate(),
            trackerKey: '1:active-turn:legal-action-only:1:main',
            progressMarker: 'progress-marker-fallback',
            failureReason: 'private_overlay_stale',
        });

        expect(fingerprint).toBe('legal-action-only:1:main:stale-private-overlay');
    });

    it('diagnostic action log 保留最近 action/event tail、交互摘要和命令 payload', () => {
        const actionLog = buildOnlineAiDiagnosticActionLog({
            state: createState({
                sys: {
                    phase: 'main',
                    turnNumber: 1,
                    actionLog: {
                        entries: [
                            { text: 'old', event: { type: 'OLD' } },
                            { text: 'latest', event: { type: 'LATEST' } },
                        ],
                    },
                    eventStream: {
                        entries: [
                            { type: 'EVENT_1', timestamp: 10, payload: { nested: { value: 1 } } },
                        ],
                    },
                    refereeTrace: {
                        entries: [{ id: 1, evidence: createEvidence() }],
                        maxEntries: 10,
                        nextId: 2,
                    },
                },
            } as unknown as MatchState<unknown>),
            phase: 'main',
            progressMarker: 'marker-1',
            blockerFingerprint: 'blocker-1',
            interaction: {
                id: 'choice-1',
                kind: 'simple-choice',
                sourceId: 'source-1',
                options: [{ id: 'skip', label: 'Skip' }],
            },
            commandType: 'TEST_COMMAND',
            reason: 'command_failed',
            commandPayload: { cardUid: 'card-1' },
        });

        expect(actionLog).toBeTruthy();
        const parsed = JSON.parse(actionLog ?? '{}') as {
            actionLogTail?: Array<{ text?: string; type?: string }>;
            eventStreamTail?: Array<{ type?: string; payload?: { nested?: { value?: number } } }>;
            interaction?: { seat?: { id?: string; options?: Array<{ id?: string }> } };
            commandPayload?: { cardUid?: string };
            refereeReplay?: {
                traceEntries?: Array<{ originalEventType?: string; appliedOpportunityIds?: string[] }>;
            };
        };
        expect(parsed.actionLogTail?.at(-1)).toEqual({ text: 'latest', type: 'LATEST' });
        expect(parsed.eventStreamTail?.[0]?.payload?.nested?.value).toBe(1);
        expect(parsed.interaction?.seat?.id).toBe('choice-1');
        expect(parsed.interaction?.seat?.options?.[0]?.id).toBe('skip');
        expect(parsed.commandPayload).toEqual({ cardUid: 'card-1' });
        expect(parsed.refereeReplay?.traceEntries?.[0]).toMatchObject({
            originalEventType: 'DAMAGE_DEALT',
            appliedOpportunityIds: ['opp-shield'],
        });
    });

    it('recovery state snapshot 保留卡点现场、seat 视角和 AI 摘要', () => {
        const snapshot = buildOnlineAiRecoveryStateSnapshot({
            matchId: 'match-1',
            gameId: 'test-game',
            state: createState({
                sys: {
                    phase: 'main',
                    turnNumber: 2,
                    interaction: { isBlocked: true },
                    actionLog: {
                        entries: [{ text: 'latest action', event: { type: 'LATEST_ACTION' } }],
                    },
                    eventStream: {
                        entries: [{ type: 'LATEST_EVENT', timestamp: 20 }],
                    },
                    refereeTrace: {
                        entries: [{ id: 1, evidence: createEvidence() }],
                        maxEntries: 10,
                        nextId: 2,
                    },
                },
            } as unknown as MatchState<unknown>),
            seatState: createState({
                sys: {
                    phase: 'main',
                    turnNumber: 2,
                    interaction: {
                        isBlocked: true,
                        current: {
                            id: 'choice-1',
                            kind: 'simple-choice',
                            playerId: '1',
                            data: {
                                sourceId: 'source-1',
                                options: [{
                                    id: 'skip',
                                    label: 'Skip',
                                    value: { skip: true },
                                    displayMode: 'button',
                                }],
                            },
                        },
                    },
                    eventStream: { entries: [] },
                },
            } as unknown as MatchState<unknown>),
            candidate: createCandidate({ reason: 'visible-interaction' }),
            trackerKey: 'tracker-1',
            progressMarker: 'marker-1',
            blockerFingerprint: 'blocker-1',
            aiSummary: {
                seatControllerType: 'local-ai',
                legalActions: {
                    total: 1,
                    truncated: false,
                    items: [{
                        actionId: 'skip-action',
                        kind: 'interaction-skip',
                        label: 'Skip',
                        commandTypes: ['SYS_INTERACTION_RESPOND'],
                    }],
                },
                decisionPreview: null,
            },
        });

        const parsed = JSON.parse(snapshot) as {
            matchId?: string;
            blockerFingerprint?: string;
            recentActionLogTail?: Array<{ text?: string; type?: string }>;
            recentEventStreamTail?: Array<{ type?: string }>;
            interaction?: {
                isBlocked?: boolean;
                seat?: { id?: string; sourceId?: string };
                seatSelectability?: { enabledOptions?: number; selectionState?: string };
            };
            seatControllerType?: string;
            legalActions?: { total?: number; items?: Array<{ commandTypes?: string[] }> };
            refereeReplay?: {
                traceEntries?: Array<{ traceEntryId?: number; originalEventType?: string }>;
            };
        };
        expect(parsed.matchId).toBe('match-1');
        expect(parsed.blockerFingerprint).toBe('blocker-1');
        expect(parsed.recentActionLogTail?.[0]).toEqual({ text: 'latest action', type: 'LATEST_ACTION' });
        expect(parsed.recentEventStreamTail?.[0]?.type).toBe('LATEST_EVENT');
        expect(parsed.interaction?.isBlocked).toBe(true);
        expect(parsed.interaction?.seat?.id).toBe('choice-1');
        expect(parsed.interaction?.seat?.sourceId).toBe('source-1');
        expect(parsed.interaction?.seatSelectability?.enabledOptions).toBe(1);
        expect(parsed.interaction?.seatSelectability?.selectionState).toBe('recoverable-option-available');
        expect(parsed.seatControllerType).toBe('local-ai');
        expect(parsed.legalActions?.total).toBe(1);
        expect(parsed.legalActions?.items?.[0]?.commandTypes).toEqual(['SYS_INTERACTION_RESPOND']);
        expect(parsed.refereeReplay?.traceEntries?.[0]).toMatchObject({
            traceEntryId: 1,
            originalEventType: 'DAMAGE_DEALT',
        });
    });

    it('unsatisfiable interaction snapshot 保留无解交互现场和 AI 摘要', () => {
        const snapshot = buildOnlineAiUnsatisfiableInteractionStateSnapshot({
            matchId: 'match-unsat',
            gameId: 'test-game',
            state: createState({
                sys: {
                    phase: 'main',
                    turnNumber: 3,
                    interaction: {
                        isBlocked: true,
                        current: {
                            id: 'shared-choice',
                            kind: 'simple-choice',
                            playerId: '1',
                            data: { sourceId: 'shared-source', options: [] },
                        },
                    },
                    actionLog: {
                        entries: [{ text: 'latest action', event: { type: 'LATEST_ACTION' } }],
                    },
                    eventStream: {
                        entries: [{ type: 'LATEST_EVENT', timestamp: 30 }],
                    },
                },
            } as unknown as MatchState<unknown>),
            seatState: createState({
                sys: {
                    phase: 'main',
                    turnNumber: 3,
                    interaction: {
                        isBlocked: true,
                        current: {
                            id: 'seat-choice',
                            kind: 'simple-choice',
                            playerId: '1',
                            data: { sourceId: 'seat-source', options: [] },
                        },
                    },
                    eventStream: { entries: [] },
                },
            } as unknown as MatchState<unknown>),
            playerId: '1',
            reason: 'empty-options',
            commandType: 'SYS_INTERACTION_RESPOND',
            progressMarker: 'marker-unsat',
            aiSummary: {
                seatControllerType: 'local-ai',
                legalActions: {
                    total: 0,
                    truncated: false,
                    items: [],
                },
                decisionPreview: null,
            },
        });

        const parsed = JSON.parse(snapshot) as {
            matchId?: string;
            commandType?: string;
            blockerFingerprint?: string;
            recentActionLogTail?: Array<{ type?: string }>;
            interaction?: {
                sharedUnsatisfiableReason?: string;
                seat?: { id?: string; sourceId?: string };
                seatSelectability?: { totalOptions?: number; selectionState?: string };
                seatUnsatisfiableReason?: string;
            };
            legalActions?: { total?: number };
        };
        expect(parsed.matchId).toBe('match-unsat');
        expect(parsed.commandType).toBe('SYS_INTERACTION_RESPOND');
        expect(parsed.blockerFingerprint).toBe('main:empty-options:interaction:simple-choice:seat-source');
        expect(parsed.recentActionLogTail?.[0]?.type).toBe('LATEST_ACTION');
        expect(parsed.interaction?.sharedUnsatisfiableReason).toBe('empty-options');
        expect(parsed.interaction?.seat?.id).toBe('seat-choice');
        expect(parsed.interaction?.seat?.sourceId).toBe('seat-source');
        expect(parsed.interaction?.seatSelectability?.totalOptions).toBe(0);
        expect(parsed.interaction?.seatSelectability?.selectionState).toBe('no-options');
        expect(parsed.interaction?.seatUnsatisfiableReason).toBe('empty-options');
        expect(parsed.legalActions?.total).toBe(0);
    });
});
