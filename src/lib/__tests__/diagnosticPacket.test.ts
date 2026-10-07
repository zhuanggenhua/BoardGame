import { describe, expect, it } from 'vitest';
import {
    assertFeedbackDiagnosticPacketConsumed,
    buildFeedbackDiagnosticPacket,
} from '../feedback/diagnosticPacket';

const state = {
    sys: {
        schemaVersion: 1,
        matchId: 'match-1',
        roomId: 'room-1',
        phase: 'scoreBases',
        turnNumber: 4,
        decisionEpoch: 9,
        interaction: { current: { id: 'interaction-1', kind: 'choose' } },
        responseWindow: { current: { id: 'response-1' } },
        actionLog: { entries: [{ type: 'score' }] },
        eventStream: { entries: [{ type: 'base_scored' }] },
        undo: { snapshots: [] },
    },
    core: { currentPlayer: '1' },
} as any;

describe('FeedbackDiagnosticPacket', () => {
    it('缺少原始关联和前后状态时明确降级为 partial 并列出缺失字段', () => {
        const packet = buildFeedbackDiagnosticPacket({
            state,
            source: 'user',
            clientContext: { matchId: 'match-1', appCommitSha: 'abc123' },
        });

        expect(packet.replayability).toBe('partial');
        expect(packet.collectionStatus).toBe('complete');
        expect(packet.correlation.matchId).toBe('match-1');
        expect(packet.phase).toBe('scoreBases');
        expect(packet.interaction).toEqual({ id: 'interaction-1', kind: 'choose' });
        expect(packet.missingFields).toEqual(expect.arrayContaining([
            'correlation.roomId',
            'correlation.requestId',
            'correlation.stateId',
            'correlation.stateRevision',
            'snapshots.before',
            'snapshots.after',
        ]));
    });

    it('补齐状态时点、稳定关联和前后快照后标记为 full', () => {
        const packet = buildFeedbackDiagnosticPacket({
            state,
            before: state,
            after: state,
            source: 'client-auto',
            roomId: 'room-1',
            requestId: 'request-1',
            stateId: 12,
            stateRevision: 3,
            randomCursor: 17,
            clientContext: { matchId: 'match-1' },
        });

        expect(packet.replayability).toBe('full');
        expect(packet.missingFields).toEqual([]);
        expect(packet.randomCursor).toBe(17);
        expect(packet.correlation).toMatchObject({
            matchId: 'match-1',
            roomId: 'room-1',
            requestId: 'request-1',
            stateId: 12,
            stateRevision: 3,
            decisionEpoch: 9,
        });
    });

    it('导入现场包后必须从运行时状态证明阶段、交互和关联键已被消费', () => {
        const packet = buildFeedbackDiagnosticPacket({
            state,
            before: state,
            after: state,
            source: 'client-auto',
            roomId: 'room-1',
            requestId: 'interaction-1',
            stateId: 12,
            stateRevision: 12,
            clientContext: { matchId: 'match-1' },
        });

        const result = assertFeedbackDiagnosticPacketConsumed({
            packet,
            runtimeState: state,
            runtimeStateId: 12,
        });

        expect(result.consumed).toBe(true);
        expect(result.reasons).toEqual([]);
        expect(result.observed).toMatchObject({
            matchId: 'match-1',
            roomId: 'room-1',
            requestId: 'interaction-1',
            stateId: 12,
            decisionEpoch: 9,
            phase: 'scoreBases',
        });
    });
});
