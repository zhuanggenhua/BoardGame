import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import { buildCommandFailureFeedbackPayload } from '../commandFailureFeedbackPayload';

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
            incidentKey: '1:TEST_COMMAND:pipeline_error: denied:marker-1',
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
});
