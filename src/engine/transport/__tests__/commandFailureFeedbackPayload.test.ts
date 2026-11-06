import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import { buildCommandFailureFeedbackPayload } from '../commandFailureFeedbackPayload';
import { buildCommandFailureFeedbackRequestBody } from '../transportFeedbackReporter';

const createState = (): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: {
        phase: 'main',
        turnNumber: 7,
        actionLog: {
            entries: [{ text: 'latest action', event: { type: 'LATEST_ACTION' } }],
        },
        eventStream: { nextId: 1, entries: [] },
    },
}) as unknown as MatchState<unknown>;

describe('commandFailureFeedbackPayload', () => {
    it('保留命令失败反馈 payload、快照和 actionLog 诊断合同', () => {
        const payload = buildCommandFailureFeedbackPayload({
            matchId: 'match-1',
            gameId: 'test-game',
            state: createState(),
            playerId: '1',
            commandType: 'TEST_COMMAND',
            reason: 'pipeline_error: denied',
            commandPayload: { cardUid: 'card-1' },
            progressMarker: 'marker-1',
            stateIdBefore: 12,
            visibleState: createState(),
            feedbackSource: 'online-ai-watchdog',
            aiContext: {
                seatControllerType: 'local-ai',
                legalActions: {
                    total: 1,
                    truncated: false,
                    items: [{
                        actionId: 'action-1',
                        kind: 'play-card',
                        label: 'Play',
                        commandTypes: ['TEST_COMMAND'],
                    }],
                },
            },
        });

        expect(payload).toMatchObject({
            matchId: 'match-1',
            gameId: 'test-game',
            playerId: '1',
            incidentKind: 'command-failed',
            feedbackSource: 'online-ai-watchdog',
            severity: 'high',
            incidentKey: '1:TEST_COMMAND:12:pipeline_error',
        });

        const snapshot = JSON.parse(payload.stateSnapshot) as {
            kind?: string;
            phase?: string;
            turnNumber?: number;
            stateIDBefore?: number;
            command?: { payload?: { cardUid?: string } };
            aiContext?: { legalActions?: { total?: number } };
        };
        expect(snapshot.kind).toBe('command-failure-feedback');
        expect(snapshot.phase).toBe('main');
        expect(snapshot.turnNumber).toBe(7);
        expect(snapshot.stateIDBefore).toBe(12);
        expect(snapshot.command?.payload?.cardUid).toBe('card-1');
        expect(snapshot.aiContext?.legalActions?.total).toBe(1);

        const actionLog = JSON.parse(payload.actionLog ?? '{}') as {
            commandPayload?: { cardUid?: string };
            actionLogTail?: Array<{ type?: string }>;
        };
        expect(actionLog.commandPayload?.cardUid).toBe('card-1');
        expect(actionLog.actionLogTail?.[0]?.type).toBe('LATEST_ACTION');
    });

    it('异常原因和交互选项原文只留在私密触发记录，公开反馈只含安全错误类别', () => {
        const optionId = 'private-option-id-canary';
        const optionValue = 'private-option-value-canary';
        const exception = 'pipeline_error: private-card-name-canary';
        const state = createState();
        const payload = buildCommandFailureFeedbackPayload({
            matchId: 'match-private-feedback',
            gameId: 'test-game',
            state,
            playerId: '1',
            commandType: 'INTERACTION_RESPOND',
            reason: exception,
            commandPayload: { optionId, optionValue },
            progressMarker: `choice:${optionId}:${optionValue}`,
            stateIdBefore: 12,
            visibleState: state,
            feedbackSource: 'online-ai-watchdog',
            aiContext: { seatControllerType: 'local-ai', legalActions: null },
        });
        const request = buildCommandFailureFeedbackRequestBody(payload);
        const publicText = JSON.stringify(request);

        expect(payload.reason).toBe('pipeline_error');
        expect(payload.privateReplayTrigger).toMatchObject({ reason: exception, payload: { optionId, optionValue } });
        expect(publicText).not.toContain(optionId);
        expect(publicText).not.toContain(optionValue);
        expect(publicText).not.toContain('private-card-name-canary');
        expect(publicText).toContain('pipeline_error');
    });
});
