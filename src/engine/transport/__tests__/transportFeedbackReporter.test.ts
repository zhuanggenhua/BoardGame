import { describe, expect, it, vi } from 'vitest';
import {
    defaultOnlineAiFeedbackReporter,
    TransportFeedbackReporter,
    type OnlineAiRecoveryFeedbackPayload,
} from '../transportFeedbackReporter';

describe('TransportFeedbackReporter', () => {
    it('online AI watchdog 默认上报链路应把成功恢复类事件写入反馈库', async () => {
        const postFeedback = vi.fn(async () => undefined);
        const reporter = new TransportFeedbackReporter({
            onlineAiRecoveryFeedbackCooldownMs: 60_000,
            postInternalSystemFeedback: postFeedback,
        });

        const successEvents = [
            {
                incidentKind: 'legal-action-recovered' as const,
                reason: 'active-turn:legal-action:roll-dice:roll:dice',
                trackerKey: '1:active-turn:0|defensiveRoll|42|0|||||||1',
                progressMarker: 'marker-before-1',
            },
            {
                incidentKind: 'force-end-turn-success' as const,
                reason: 'active-turn:follow-up-advance:steps=1',
                trackerKey: '1:active-turn:0|defensiveRoll|42|0|||||||2',
                progressMarker: 'marker-before-2',
            },
        ];

        for (const event of successEvents) {
            await reporter.reportOnlineAiRecoveryFeedback({
                matchId: 'match-watchdog-report-success',
                gameId: 'dicethrone',
                playerId: '1',
                incidentKind: event.incidentKind,
                severity: 'medium',
                status: 'resolved',
                reason: event.reason,
                trackerKey: event.trackerKey,
                progressMarker: event.progressMarker,
                stateSnapshot: '{"matchId":"match-watchdog-report-success"}',
            });
        }

        expect(postFeedback).toHaveBeenCalledTimes(2);
        for (const event of successEvents) {
            expect(postFeedback).toHaveBeenCalledWith(expect.objectContaining({
                content: `[system][online-ai-watchdog] ${event.incidentKind} ${event.reason}`,
                source: 'online-ai-watchdog',
                autoReportKind: event.incidentKind,
                status: 'resolved',
                resolvedMethod: event.incidentKind === 'legal-action-recovered'
                    ? '系统已自动找到可执行操作并继续推进该 AI 座位，对局没有停在该步骤。'
                    : '系统已自动推进停滞的 AI 座位，让对局继续进行。',
                incidentKey: event.trackerKey,
                gameName: 'dicethrone',
                clientContext: expect.objectContaining({
                    route: 'server-watchdog',
                    mode: 'online',
                    matchId: 'match-watchdog-report-success',
                    playerId: '1',
                    gameId: 'dicethrone',
                }),
            }));
        }
    });

    it('online AI watchdog 默认系统反馈应附带版本定位字段', async () => {
        vi.stubEnv('APP_VERSION', '0.6.1-server');
        vi.stubEnv('APP_COMMIT_SHA', 'feedbead1234');
        vi.stubEnv('APP_BUILD_TIME', '2026-06-19T11:00:00.000Z');
        vi.stubEnv('APP_RELEASE_CHANNEL', 'production');
        const postFeedback = vi.fn(async () => undefined);

        try {
            await defaultOnlineAiFeedbackReporter({
                matchId: 'match-watchdog-build-meta',
                gameId: 'dicethrone',
                playerId: '1',
                incidentKind: 'force-end-turn-failed',
                severity: 'high',
                reason: 'active-turn:follow-up-advance:command_failed:ADVANCE_PHASE:not_active_player',
                trackerKey: '1:active-turn:0|defensiveRoll|42|0|||||||1',
                progressMarker: '0|defensiveRoll|42|0|||||||1',
                stateSnapshot: '{"matchId":"match-watchdog-build-meta"}',
                actionLog: '{"kind":"online-ai-feedback-diagnostic"}',
            } satisfies OnlineAiRecoveryFeedbackPayload, postFeedback);
        } finally {
            vi.unstubAllEnvs();
        }

        expect(postFeedback).toHaveBeenCalledWith(expect.objectContaining({
            clientContext: expect.objectContaining({
                appVersion: '0.6.1-server',
                appCommitSha: 'feedbead1234',
                appBuildTime: '2026-06-19T11:00:00.000Z',
                appReleaseChannel: 'production',
            }),
        }));
    });
});
