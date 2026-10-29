import { describe, expect, it, vi } from 'vitest';
import { buildOnlineAiRecoveryFeedbackRequestBody, postInternalSystemFeedback, TransportFeedbackReporter, type OnlineAiRecoveryFeedbackPayload } from '../transportFeedbackReporter';

const payload: OnlineAiRecoveryFeedbackPayload = {
    matchId: 'match', gameId: 'dicethrone', playerId: '1', incidentKind: 'force-end-turn-failed',
    severity: 'high', reason: 'blocked', trackerKey: 'key', progressMarker: 'before',
    stateSnapshot: '{"phase":"offensiveRoll","request":"original"}',
};

describe('服务端自动反馈投递', () => {
    it('没有权威现场时诊断包必须明确标记不完整', () => {
        const body = buildOnlineAiRecoveryFeedbackRequestBody(payload);
        const packet = JSON.parse(body.diagnosticPacket as string);
        expect(packet.collectionStatus).toBe('partial');
        expect(packet.collectionErrors).toContain('private_replay_not_captured');
    });
    it('未配置内部反馈服务时不能伪报投递成功', async () => {
        await expect(postInternalSystemFeedback({}, { endpoint: null, token: null, disabledReason: 'missing-token' }))
            .rejects.toThrow('feedback_delivery_unavailable:missing-token');
    });
    it('同一次故障应自动重发原始现场，并在成功后进入冷却', async () => {
        const post = vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValue(undefined);
        const reporter = new TransportFeedbackReporter({ postInternalSystemFeedback: post });
        await reporter.reportOnlineAiRecoveryFeedback(payload);
        expect(post).toHaveBeenCalledTimes(2);
        expect(post.mock.calls[0][0]).toEqual(post.mock.calls[1][0]);
        await reporter.reportOnlineAiRecoveryFeedback(payload);
        expect(post).toHaveBeenCalledTimes(2);
    });

    it('所有发送尝试均失败后不能让失败的冷却键阻止重试', async () => {
        const post = vi.fn().mockRejectedValue(new Error('network down'));
        const reporter = new TransportFeedbackReporter({ postInternalSystemFeedback: post });
        await reporter.reportOnlineAiRecoveryFeedback(payload);
        expect(post).toHaveBeenCalledTimes(3);
        post.mockResolvedValue(undefined);
        await reporter.reportOnlineAiRecoveryFeedback(payload);
        expect(post).toHaveBeenCalledTimes(4);
    });
});
