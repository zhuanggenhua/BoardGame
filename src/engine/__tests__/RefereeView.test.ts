import { describe, expect, it } from 'vitest';
import {
    buildRefereeDecisionSnapshot,
    getRefereeMessages,
} from '../RefereeView';
import type { EventCommitEvidence, MatchState, SystemState } from '../types';
import { DEFAULT_TUTORIAL_STATE } from '../types';

interface TestCore {
    value: number;
}

function createState(overrides: Partial<SystemState> = {}): MatchState<TestCore> {
    return {
        core: { value: 1 },
        sys: {
            schemaVersion: 1,
            decisionEpoch: 7,
            undo: { snapshots: [], maxSnapshots: 10 },
            interaction: { queue: [] },
            log: { entries: [], maxEntries: 0 },
            eventStream: { entries: [], maxEntries: 0, nextId: 1 },
            actionLog: { entries: [], maxEntries: 0 },
            rematch: { votes: {}, ready: false },
            responseWindow: {},
            tutorial: DEFAULT_TUTORIAL_STATE,
            turnNumber: 1,
            phase: 'main',
            ...overrides,
        },
    };
}

function createEvidence(id: string): EventCommitEvidence {
    return {
        timingPointId: `commit-${id}`,
        position: 'eventCommit',
        factKind: 'damage',
        originalEventType: 'DAMAGE_DEALT',
        originalEventTimestamp: 10,
        opportunityIds: [`opp-${id}`],
        opportunityTimingPointIds: [`prevent-${id}`],
        appliedOpportunityIds: [`opp-${id}`],
    };
}

describe('RefereeView', () => {
    it('把当前交互、响应窗口、结算 frame 和提交证据合成裁判消息', () => {
        const state = createState({
            interaction: {
                current: {
                    id: 'choice-1',
                    kind: 'simple-choice',
                    playerId: 'p1',
                    resolutionFrameId: 'frame-1',
                    data: {
                        sourceId: 'card-1',
                        options: [
                            { id: 'target-a', label: 'A', value: { targetId: 'a' } },
                            { id: 'target-b', label: 'B', value: { targetId: 'b' }, disabled: true },
                        ],
                        choiceRequest: {
                            requestId: 'choice-1',
                            choiceKind: 'select-object',
                            aiDiagnosticStatus: 'ok',
                            candidateSummary: {
                                total: 2,
                                enabledCandidateIds: ['target-a'],
                                disabledCandidateIds: ['target-b'],
                            },
                        },
                    },
                },
                queue: [],
            },
            responseWindow: {
                current: {
                    id: 'window-1',
                    windowType: 'after-card-played',
                    sourceId: 'card-1',
                    responderQueue: ['p1', 'p2'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                    resolutionFrameId: 'frame-1',
                },
            },
            resolution: {
                activeFrameId: 'frame-1',
                frames: [{
                    id: 'frame-1',
                    kind: 'reaction-chain',
                    ordering: 'stack',
                    status: 'blocked',
                    blockedBy: { type: 'interaction', id: 'choice-1' },
                    deferredEvents: [{ type: 'FOLLOW_UP', payload: { hidden: true }, timestamp: 11 }],
                    deferredActions: [{ internal: true }],
                    metadata: { opportunityId: 'opp-1' },
                }],
            },
            refereeTrace: {
                entries: [
                    { id: 1, evidence: createEvidence('old') },
                    { id: 2, evidence: createEvidence('new') },
                ],
                maxEntries: 10,
                nextId: 3,
            },
        });
        const before = JSON.stringify(state);

        const snapshot = buildRefereeDecisionSnapshot(state, { playerId: 'p1', traceLimit: 1 });

        expect(JSON.stringify(state)).toBe(before);
        expect(snapshot.messages.map(message => message.type)).toEqual([
            'referee:interaction',
            'referee:response-window',
            'referee:resolution-frame',
            'referee:event-commit',
        ]);
        expect(snapshot.interaction).toMatchObject({
            visible: true,
            id: 'choice-1',
            kind: 'simple-choice',
            playerId: 'p1',
            sourceId: 'card-1',
            resolutionFrameId: 'frame-1',
            optionSummary: {
                total: 2,
                enabledOptionIds: ['target-a'],
                disabledOptionIds: ['target-b'],
            },
            choiceRequest: {
                requestId: 'choice-1',
                choiceKind: 'select-object',
            },
        });
        expect(snapshot.responseWindow).toMatchObject({
            id: 'window-1',
            currentResponderId: 'p1',
            isCurrentResponder: true,
        });
        expect(snapshot.resolution?.frames[0]).toMatchObject({
            id: 'frame-1',
            deferredEventTypes: ['FOLLOW_UP'],
            deferredActionCount: 1,
        });
        expect(JSON.stringify(snapshot.resolution)).not.toContain('hidden');
        expect(snapshot.trace?.entries.map(entry => entry.id)).toEqual([2]);
    });

    it('玩家视角不泄漏其它玩家当前 interaction 的候选内容', () => {
        const state = createState({
            interaction: {
                current: {
                    id: 'secret-choice',
                    kind: 'simple-choice',
                    playerId: 'p2',
                    data: {
                        sourceId: 'secret-card',
                        options: [{ id: 'secret-target', label: 'Secret', value: { cardUid: 'hidden' } }],
                        choiceRequest: {
                            requestId: 'secret-choice',
                            candidateSummary: { enabledCandidateIds: ['secret-target'] },
                        },
                    },
                },
                queue: [],
            },
        });

        const snapshot = buildRefereeDecisionSnapshot(state, { playerId: 'p1' });

        expect(snapshot.interaction).toEqual({
            visible: false,
            blockedByPlayerId: 'p2',
        });
        expect(snapshot.messages).toEqual([{
            type: 'referee:blocked-interaction',
            payload: {
                visible: false,
                blockedByPlayerId: 'p2',
            },
        }]);
        expect(JSON.stringify(snapshot)).not.toContain('secret-target');
        expect(JSON.stringify(snapshot)).not.toContain('hidden');
    });

    it('空闲状态返回稳定 idle 消息', () => {
        const state = createState();

        expect(getRefereeMessages(state)).toEqual([{
            type: 'referee:idle',
            payload: { decisionEpoch: 7 },
        }]);
    });
});
