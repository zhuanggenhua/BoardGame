import { describe, expect, it, vi } from 'vitest';
import {
    buildCommandFailureFeedbackRequestBody,
    buildOnlineAiRecoveryFeedbackRequestBody,
    defaultOnlineAiFeedbackReporter,
    resolveTransportFeedbackCorrelation,
    TransportFeedbackReporter,
    type OnlineAiRecoveryFeedbackPayload,
} from '../transportFeedbackReporter';

const correlationState = {
    sys: {
        matchId: 'room-1',
        revision: 41,
        decisionEpoch: 7,
        interaction: { current: { id: 'request-1' } },
        responseWindow: { current: { id: 'response-1' } },
    },
    core: {},
} as any;

describe('TransportFeedbackReporter', () => {
    it('服务端现场关联键必须来自权威状态和状态版本', () => {
        expect(resolveTransportFeedbackCorrelation({
            matchId: 'match-1',
            state: correlationState,
            stateId: 42,
        })).toEqual({
            requestId: 'request-1',
            stateId: 42,
            stateRevision: 41,
            decisionEpoch: 7,
        });
    });

    it('只有显式提供独立 roomId 时才记录 roomId，不把 matchId 当作 roomId', () => {
        expect(resolveTransportFeedbackCorrelation({
            matchId: 'match-1',
            roomId: 'room-1',
            state: correlationState,
        })).toEqual({
            roomId: 'room-1',
            requestId: 'request-1',
            stateRevision: 41,
            decisionEpoch: 7,
        });
    });

    it('显式 stateRevision 覆盖 state.sys.revision，但不受 decisionEpoch 影响', () => {
        expect(resolveTransportFeedbackCorrelation({
            matchId: 'match-1',
            state: correlationState,
            stateId: 42,
            stateRevision: 55,
        })).toMatchObject({ stateId: 42, stateRevision: 55, decisionEpoch: 7 });
    });

    it('online AI watchdog 默认上报链路应把成功恢复类事件写入反馈库', async () => {
        const postFeedback = vi.fn(async (_body: Record<string, unknown>) => undefined);
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
                content: `[system][online-ai-watchdog] ${event.incidentKind} active-turn`,
                source: 'online-ai-watchdog',
                autoReportKind: event.incidentKind,
                status: 'resolved',
                resolvedMethod: event.incidentKind === 'legal-action-recovered'
                    ? '系统已自动找到可执行操作并继续推进该 AI 座位，对局没有停在该步骤。'
                    : '系统已自动推进停滞的 AI 座位，让对局继续进行。',
                incidentKey: `${event.incidentKind}:1:active-turn`,
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
            diagnosticPacket: expect.stringContaining('"source":"server"'),
        }));
    });

    it('服务端兼容快照与日志按白名单投影，privateReplay 单独保留权威内容', async () => {
        const canary = 'private-card-payload-canary';
        const privateReplay = `private:${canary}`;
        const postFeedback = vi.fn(async (_body: Record<string, unknown>) => undefined);

        await defaultOnlineAiFeedbackReporter({
            matchId: 'match-safe-projection',
            gameId: 'dicethrone',
            playerId: '0',
            incidentKind: 'force-end-turn-failed',
            severity: 'high',
            reason: 'watchdog-recovery-failed',
            trackerKey: 'incident-1',
            progressMarker: 'phase|main|epoch-1',
            roomId: 'room-1',
            stateId: 12,
            stateRevision: 8,
            decisionEpoch: 4,
            requestId: 'choice-1',
            stateSnapshot: JSON.stringify({
                kind: 'command-failure-feedback',
                commandType: 'PLAY_CARD',
                command: { type: 'PLAY_CARD', payload: { cardId: canary } },
                visibleState: { sys: { phase: 'main', revision: 8 }, core: { hand: [canary] } },
            }),
            actionLog: JSON.stringify({
                kind: 'online-ai-feedback-diagnostic',
                phase: 'main',
                actionLogTail: [{ id: 'log-1', timestamp: 1, kind: 'PLAY_CARD', segments: [{ text: canary }] }],
                eventStreamTail: [{ id: 1, event: { type: 'CARD_PLAYED', payload: { cardId: canary } } }],
            }),
            privateReplay,
        }, postFeedback);

        const body = postFeedback.mock.calls[0]?.[0] as Record<string, unknown>;
        const diagnosticPacket = JSON.parse(String(body.diagnosticPacket));
        expect(body.privateReplay).toBe(privateReplay);
        expect(String(body.stateSnapshot)).not.toContain(canary);
        expect(String(body.actionLog)).not.toContain(canary);
        expect(String(body.diagnosticPacket)).not.toContain(canary);
        expect(diagnosticPacket.collectionStatus).toBe('partial');
        expect(diagnosticPacket.missingFields).toEqual(expect.arrayContaining(['snapshots.before', 'snapshots.after']));
        expect(diagnosticPacket.correlation).toMatchObject({ stateId: 12, stateRevision: 8, decisionEpoch: 4 });
    });

    it('命令失败反馈也必须过滤兼容快照与日志中的原始 payload', () => {
        const canary = 'failed-command-private-canary';
        const body = buildCommandFailureFeedbackRequestBody({
            matchId: 'match-command-failure',
            gameId: 'dicethrone',
            playerId: '0',
            incidentKind: 'command-failed',
            feedbackSource: 'online-ai-watchdog',
            severity: 'high',
            commandType: 'PLAY_CARD',
            reason: 'pipeline_error',
            incidentKey: 'incident-command-failure',
            progressMarker: 'main|epoch-2',
            stateId: 16,
            stateRevision: 9,
            decisionEpoch: 2,
            requestId: 'choice-2',
            stateSnapshot: JSON.stringify({
                kind: 'command-failure-feedback',
                phase: 'main',
                commandType: 'PLAY_CARD',
                command: { payload: { cardId: canary } },
                visibleState: { core: { hand: [canary] } },
            }),
            actionLog: JSON.stringify({
                kind: 'online-ai-feedback-diagnostic',
                actionLogTail: [{ kind: 'PLAY_CARD', segments: [{ text: canary }] }],
            }),
            privateReplay: `private:${canary}`,
        });

        expect(String(body.privateReplay)).toContain(canary);
        expect(String(body.stateSnapshot)).not.toContain(canary);
        expect(String(body.actionLog)).not.toContain(canary);
        expect(String(body.diagnosticPacket)).not.toContain(canary);
    });

    it('Qidahen 首次 watchdog 请求体保留安全阻塞摘要并剥离候选内容', () => {
        const secret = 'qidahen-private-choice-canary';
        const body = buildOnlineAiRecoveryFeedbackRequestBody({
            matchId: 'match-qidahen',
            gameId: 'qidahen',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            severity: 'high',
            reason: 'missing-visible-state',
            trackerKey: '1:active-turn:choice-2',
            progressMarker: 'turn-5|step-2',
            roomId: 'room-qidahen',
            requestId: 'choice-1',
            stateId: 22,
            stateRevision: 9,
            decisionEpoch: 4,
            stateSnapshot: JSON.stringify({
                matchId: 'match-qidahen',
                gameId: 'qidahen',
                playerId: '1',
                phase: 'select-region',
                turnNumber: 5,
                currentPlayerId: '1',
                blockerFingerprint: 'phase:select-region|choice:2',
                progressMarker: 'turn-5|step-2',
                interaction: {
                    isBlocked: true,
                    seat: { id: 'choice-1', kind: 'selection', options: [{ id: secret }] },
                    seatSelectability: {
                        totalOptions: 2,
                        enabledOptions: 0,
                        disabledOptions: 2,
                        minSelectionCount: 1,
                        selectionState: 'all-options-disabled',
                        disabledOptionIds: [secret],
                    },
                    seatUnsatisfiableReason: 'all-options-disabled',
                },
                responseWindow: { id: 'response-1', windowType: 'before-damage', responderQueue: ['0', '1'] },
                legalActions: {
                    total: 2,
                    items: [{ actionId: secret, label: secret, commandTypes: ['SELECT_REGION'] }],
                },
                aiDecisionPreview: { commandType: 'SELECT_REGION', candidateCount: 2, selectedOptionId: secret },
                gameStateSummary: {
                    turnPhase: 'march',
                    factionSelection: { pendingPlayerIds: ['0', '1'], selectedPlayerIds: [secret] },
                    pendingScenarioCharacterChoices: [{ count: 2, optionCount: 3, characterIds: [secret] }],
                    privatePayload: secret,
                },
            }),
            privateReplay: 'admin-only-private-replay',
        });

        const packet = JSON.parse(String(body.diagnosticPacket));
        expect(packet.snapshots.at).toMatchObject({
            hasBlockerFingerprint: true,
            hasProgressMarker: true,
            currentPlayerId: '1',
            interaction: {
                isBlocked: true,
                seat: { id: 'choice-1', kind: 'selection', optionCount: 1 },
                seatSelectability: { totalOptions: 2, enabledOptions: 0, disabledOptions: 2, selectionState: 'all-options-disabled' },
            },
            responseWindow: { responderCount: 2 },
            legalActions: { count: 2, types: ['SELECT_REGION'] },
            aiDecisionPreview: { commandType: 'SELECT_REGION', candidateCount: 2 },
            gameStateSummary: {
                turnPhase: 'march',
                factionSelection: { pendingPlayerIds: ['0', '1'] },
                pendingScenarioCharacterChoiceCount: 1,
                pendingScenarioCharacterOptionCount: 3,
            },
        });
        expect(JSON.stringify(packet)).not.toContain(secret);
        expect(JSON.stringify(packet)).not.toContain('phase:select-region|choice:2');
        expect(JSON.stringify(packet)).not.toContain('turn-5|step-2');
        expect(body.incidentKey).toBe('force-end-turn-failed:1:missing-visible-state');
        expect(body.privateReplay).toBe('admin-only-private-replay');
    });
});
