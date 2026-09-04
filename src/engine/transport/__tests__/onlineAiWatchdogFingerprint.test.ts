import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import { buildAiProgressMarker, resolveForceEndTurnForStalledAi } from '../onlineAiRecovery';
import { createCompareRollChoice, createSimpleChoice, INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import type { StoredMatchState } from '../storage';
import diceThroneEngineConfig from '../../../games/dicethrone/game';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfig,
    createEngineConfigWithId,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
} from './helpers/serverTestHarness';

describe('online AI watchdog fingerprint drift', () => {
    it('online AI watchdog 在 legal-only 候选 fingerprint 漂移时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-legal-only-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-legal-only-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'seat-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:defensiveRoll:roll',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:defensiveRoll:roll',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:defensiveRoll:roll',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };
        const driftedCandidate = {
            ...candidate,
            fingerprintHint: 'active-turn-legal-only:1:defensiveRoll:pass',
            resolution: {
                ...candidate.resolution,
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:defensiveRoll:pass',
                action: {
                    ...candidate.resolution.action,
                    actionId: 'force-end-turn:active-turn-legal-only:1:defensiveRoll:pass',
                },
            },
        };
        const tracker = {
            key: '1:seat-legal-only:active-turn-legal-only:1:defensiveRoll:roll',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockResolvedValueOnce({
            applied: false,
            blockedReason: null,
            executedCommandTypes: [],
            outcome: 'no-legal-action',
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate').mockResolvedValueOnce(driftedCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-legal-only-fingerprint-drift')).toBe(false);
    });
    it('online AI watchdog 在 visible-interaction 候选 fingerprint 漂移到新的 compare-roll current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-interaction-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: createCompareRollChoice(
                        'compare-roll-old-1',
                        '1',
                        {
                            title: 'compareRoll.gunslingerDuel.title',
                            sourceId: 'gunslinger_showdown',
                            contestants: [
                                { playerId: '1', roll: 6, labelKey: 'compareRoll.gunslingerDuel.attacker', characterId: 'gunslinger' },
                                { playerId: '0', roll: 2, labelKey: 'compareRoll.gunslingerDuel.defender', characterId: 'monk' },
                            ],
                            resultTextKey: 'compareRoll.gunslingerDuel.win',
                            options: [
                                { id: 'confirm', label: '确认', value: { accepted: true } },
                            ],
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: false,
            fingerprintHint: 'interaction:1:defensiveRoll:compare-roll-choice:gunslinger_showdown:null:confirm:0:{"accepted":true}:compare-roll-old-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:defensiveRoll:compare-roll-choice:gunslinger_showdown:null:confirm:0:{"accepted":true}:compare-roll-old-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:defensiveRoll:compare-roll-choice:gunslinger_showdown:null:confirm:0:{"accepted":true}:compare-roll-old-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };
        const driftedCandidate = {
            ...candidate,
            fingerprintHint: 'interaction:1:defensiveRoll:compare-roll-choice:gunslinger_showdown:null:confirm:0:{"accepted":true}:compare-roll-new-1',
            resolution: {
                ...candidate.resolution,
                attemptKey: 'force-end-turn:1:interaction:1:defensiveRoll:compare-roll-choice:gunslinger_showdown:null:confirm:0:{"accepted":true}:compare-roll-new-1',
                action: {
                    ...candidate.resolution.action,
                    actionId: 'force-end-turn:interaction:1:defensiveRoll:compare-roll-choice:gunslinger_showdown:null:confirm:0:{"accepted":true}:compare-roll-new-1',
                },
            },
        };
        const tracker = {
            key: '1:visible-interaction:interaction:1:defensiveRoll:compare-roll-choice:gunslinger_showdown:null:confirm:0:{"accepted":true}:compare-roll-old-1',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        ...(activeMatch.state.sys?.interaction ?? {}),
                        current: createCompareRollChoice(
                            'compare-roll-new-1',
                            '1',
                            {
                                title: 'compareRoll.gunslingerDuel.title',
                                sourceId: 'gunslinger_showdown',
                                contestants: [
                                    { playerId: '1', roll: 5, labelKey: 'compareRoll.gunslingerDuel.attacker', characterId: 'gunslinger' },
                                    { playerId: '0', roll: 4, labelKey: 'compareRoll.gunslingerDuel.defender', characterId: 'monk' },
                                ],
                                resultTextKey: 'compareRoll.gunslingerDuel.tie',
                                options: [
                                    { id: 'confirm', label: '确认', value: { accepted: true } },
                                ],
                            },
                        ),
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(driftedCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-visible-interaction-fingerprint-drift')).toBe(false);
    });
    it('online AI watchdog 在 hidden-interaction 候选 fingerprint 漂移到新的 owner-only current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-hidden-interaction-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main1',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-hidden-interaction-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'hidden-interaction',
            requiresConfirmedAdvancePhase: false,
            fingerprintHint: 'interaction:1:main1:simple-choice:super_spies_secret_agent_discard:选择旧的秘密目标:::choose-old:0:{"targetId":"old-secret"}',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:main1:simple-choice:super_spies_secret_agent_discard:选择旧的秘密目标:::choose-old:0:{"targetId":"old-secret"}',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:main1:simple-choice:super_spies_secret_agent_discard:选择旧的秘密目标:::choose-old:0:{"targetId":"old-secret"}',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };
        const driftedCandidate = {
            ...candidate,
            fingerprintHint: 'interaction:1:main1:simple-choice:super_spies_secret_agent_discard:选择新的秘密目标:::choose-new:0:{"targetId":"new-secret"}',
            resolution: {
                ...candidate.resolution,
                attemptKey: 'force-end-turn:1:interaction:1:main1:simple-choice:super_spies_secret_agent_discard:选择新的秘密目标:::choose-new:0:{"targetId":"new-secret"}',
                action: {
                    ...candidate.resolution.action,
                    actionId: 'force-end-turn:interaction:1:main1:simple-choice:super_spies_secret_agent_discard:选择新的秘密目标:::choose-new:0:{"targetId":"new-secret"}',
                },
            },
        };
        const tracker = {
            key: '1:hidden-interaction:interaction:1:main1:simple-choice:super_spies_secret_agent_discard:选择旧的秘密目标:::choose-old:0:{"targetId":"old-secret"}',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(driftedCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-hidden-interaction-fingerprint-drift')).toBe(false);
    });
    it('online AI watchdog 在 compare-roll visible interaction 尝试恢复后若同一 incident 仍持续，应明确上报 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-interaction-blocker-persisted', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: createCompareRollChoice(
                        'compare-roll-stuck-1',
                        '1',
                        {
                            title: 'compareRoll.gunslingerDuel.title',
                            sourceId: 'gunslinger_showdown',
                            contestants: [
                                { playerId: '1', roll: 6, labelKey: 'compareRoll.gunslingerDuel.attacker', characterId: 'gunslinger' },
                                { playerId: '0', roll: 2, labelKey: 'compareRoll.gunslingerDuel.defender', characterId: 'monk' },
                            ],
                            resultTextKey: 'compareRoll.gunslingerDuel.win',
                            options: [
                                { id: 'confirm', label: '确认', value: { accepted: true } },
                            ],
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: {
                    candidateReason: string;
                    playerId: string;
                    actionKind: string;
                    actionId: string;
                } | null;
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-blocker-persisted');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: true,
            fingerprintHint: 'interaction:1:defensiveRoll:compare-roll-choice:gunslinger_showdown:null:confirm:0:{"accepted":true}:compare-roll-stuck-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:defensiveRoll:compare-roll-choice:gunslinger_showdown:null:confirm:0:{"accepted":true}:compare-roll-stuck-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:defensiveRoll:compare-roll-choice:gunslinger_showdown:null:confirm:0:{"accepted":true}:compare-roll-stuck-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: INTERACTION_COMMANDS.RESPOND, payload: { interactionId: 'compare-roll-stuck-1', optionId: 'confirm' } }],
                },
            },
        };
        const tracker = {
            key: `1:visible-interaction:${(server as any).buildOnlineAiRecoveryFingerprint(
                match,
                candidate,
                buildAiProgressMarker(match.state),
            )}`,
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch, currentCandidate) => {
            expect(currentCandidate.reason).toBe('visible-interaction');
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                },
            };
            return {
                applied: true,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [INTERACTION_COMMANDS.RESPOND],
                outcome: 'applied',
                reportedAction: {
                    candidateReason: 'visible-interaction',
                    playerId: '1',
                    actionKind: 'interaction-choice',
                    actionId: 'respond-compare-roll-stuck',
                },
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(candidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalledTimes(1);
        expect(resolveCandidateSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-visible-interaction-blocker-persisted',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
            reason: 'visible-interaction:recover-interaction:blocker_persisted',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('compare-roll-stuck-1');
        expect(snapshot.blockerFingerprint).toContain('compare-roll-choice');
        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('compare-roll-stuck-1');
        expect(actionLog.blockerFingerprint).toContain('compare-roll-choice');
        expect(actionLog.trackerKey).toContain('compare-roll-stuck-1');
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-visible-interaction-blocker-persisted')).toBe(true);
    });
    it('online AI watchdog 在 compare-roll-choice 仅切到新的 interactionId 且 progress marker 未变时，不应硬取消新 prompt', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-compare-roll-sequence-interaction-id-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: createCompareRollChoice(
                        'compare-roll-sequence-old-1',
                        '1',
                        {
                            title: 'compareRoll.gunslingerDuel.title',
                            sourceId: 'gunslinger_showdown',
                            contestants: [
                                { playerId: '1', roll: 5, labelKey: 'compareRoll.gunslingerDuel.attacker', characterId: 'gunslinger' },
                                { playerId: '0', roll: 4, labelKey: 'compareRoll.gunslingerDuel.defender', characterId: 'monk' },
                            ],
                            resultTextKey: 'compareRoll.gunslingerDuel.tie',
                            options: [
                                { id: 'confirm', label: '确认', value: { accepted: true } },
                            ],
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };
        const match = await serverInternal.loadMatch('match-watchdog-compare-roll-sequence-interaction-id-drift');
        const candidate = await serverInternal.resolveOnlineAiRecoveryCandidate(match, seatControllers);
        expect(candidate?.fingerprintHint).toContain('compare-roll-sequence-old-1');

        const tracker = {
            key: `${candidate.playerId}:${candidate.reason}:${candidate.fingerprintHint}`,
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerId, commandType, payload) => {
            if (commandType === INTERACTION_COMMANDS.RESPOND) {
                expect(payload).toEqual({ optionId: 'confirm' });
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        interaction: {
                            ...(activeMatch.state.sys?.interaction ?? {}),
                            current: createCompareRollChoice(
                                'compare-roll-sequence-new-1',
                                '1',
                                {
                                    title: 'compareRoll.gunslingerDuel.title',
                                    sourceId: 'gunslinger_showdown',
                                    contestants: [
                                        { playerId: '1', roll: 5, labelKey: 'compareRoll.gunslingerDuel.attacker', characterId: 'gunslinger' },
                                        { playerId: '0', roll: 4, labelKey: 'compareRoll.gunslingerDuel.defender', characterId: 'monk' },
                                    ],
                                    resultTextKey: 'compareRoll.gunslingerDuel.tie',
                                    options: [
                                        { id: 'confirm', label: '确认', value: { accepted: true } },
                                    ],
                                },
                            ),
                        },
                    },
                };
                return true;
            }

            throw new Error(`Unexpected command during compare-roll interactionId drift: ${commandType}`);
        });

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            seatControllers,
        );

        expect(executeSpy.mock.calls.map((call) => call[2])[0]).toBe(INTERACTION_COMMANDS.RESPOND);
        expect(executeSpy.mock.calls.map((call) => call[2])).not.toContain(INTERACTION_COMMANDS.CANCEL);
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-compare-roll-sequence-interaction-id-drift')).toBe(false);
    });
    it('online AI watchdog 在 dt:token-response 的 pendingDamage 语义漂移时，也必须丢弃旧 tracker', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-dt-token-response-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                pendingDamage: {
                    id: 'pending-damage-1',
                    responderId: '1',
                    responseType: 'token',
                    currentDamage: 2,
                    sourceAbilityId: 'barbarian_revenge',
                    tokenUsageTotals: { rage: 2 },
                },
                interaction: {
                    current: {
                        id: 'token-response-1',
                        playerId: '1',
                        kind: 'dt:token-response',
                        data: {
                            sourceId: 'barbarian_revenge',
                            title: '是否消耗 token',
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dt-token-response-fingerprint-drift');
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };
        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
            gameId: 'dicethrone',
        });

        match.state = {
            ...match.state,
            core: {
                ...match.state.core,
                pendingDamage: {
                    id: 'pending-damage-1',
                    responderId: '1',
                    responseType: 'token',
                    currentDamage: 4,
                    sourceAbilityId: 'barbarian_revenge',
                    tokenUsageTotals: { rage: 4 },
                },
            },
        };
        const driftedCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
            gameId: 'dicethrone',
        });

        match.state = {
            ...match.state,
            core: {
                ...match.state.core,
                pendingDamage: {
                    id: 'pending-damage-1',
                    responderId: '1',
                    responseType: 'token',
                    currentDamage: 2,
                    sourceAbilityId: 'barbarian_revenge',
                    tokenUsageTotals: { rage: 2 },
                },
            },
        };

        const tracker = {
            key: `1:visible-interaction:${candidate?.fingerprintHint}`,
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    pendingDamage: {
                        id: 'pending-damage-1',
                        responderId: '1',
                        responseType: 'token',
                        currentDamage: 4,
                        sourceAbilityId: 'barbarian_revenge',
                        tokenUsageTotals: { rage: 4 },
                    },
                },
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(driftedCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).not.toHaveBeenCalled();
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-dt-token-response-fingerprint-drift')).toBe(false);
    });
    it('online AI watchdog 遇到可见 dt:bonus-dice 时不应生成强制确认候选', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-dt-bonus-dice-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
                pendingBonusDiceSettlement: {
                    id: 'bonus-settlement-1',
                    attackerId: '1',
                    displayOnly: false,
                    rerollCount: 1,
                    dice: [{ index: 0, value: 6 }],
                },
                interaction: {
                    current: {
                        id: 'bonus-dice-1',
                        playerId: '1',
                        kind: 'dt:bonus-dice',
                        data: {
                            sourceId: 'bonus-roll',
                            title: '是否重掷奖励骰',
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dt-bonus-dice-fingerprint-drift');
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };

        const candidate = await serverInternal.resolveOnlineAiRecoveryCandidate(match, seatControllers);

        expect(candidate).toBeNull();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 遇到 displayOnly dt:bonus-dice 可见确认态时应走 DiceThrone 合法确认候选', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-dt-display-only-bonus-dice-visible-confirm', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main2',
                pendingBonusDiceSettlement: {
                    id: 'display-only-bonus-visible-confirm',
                    attackerId: '1',
                    displayOnly: true,
                    rerollCount: 0,
                    dice: [{ index: 0, value: 4 }],
                },
                interaction: {
                    current: {
                        id: 'bonus-dice-display-only-visible-confirm',
                        playerId: '1',
                        kind: 'dt:bonus-dice',
                        data: {
                            sourceId: 'bonus-roll',
                            title: '确认奖励骰',
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dt-display-only-bonus-dice-visible-confirm');
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };

        const candidate = await serverInternal.resolveOnlineAiRecoveryCandidate(match, seatControllers);

        expect(candidate?.reason).toBe('seat-legal-only');
        expect(candidate?.playerId).toBe('1');
        expect(candidate?.fingerprintHint).toContain('display-only-bonus:1:main2:display-only-bonus-visible-confirm');
        expect(candidate?.resolution.action.commands).toEqual([
            { type: 'CONFIRM_ROLL', payload: {} },
        ]);
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('online AI watchdog 读取 DiceThrone 旧脏 bonus settlement 时也不生成可见奖励骰强制确认候选', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-dt-bonus-dice-legacy-dice-shape', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
                pendingBonusDiceSettlement: {
                    id: 'bonus-settlement-legacy',
                    attackerId: '1',
                    displayOnly: false,
                    rerollCount: 0,
                    dice: { legacy: true } as any,
                },
                interaction: {
                    current: {
                        id: 'bonus-dice-legacy',
                        playerId: '1',
                        kind: 'dt:bonus-dice',
                        data: {
                            sourceId: 'bonus-roll',
                            title: '是否重掷奖励骰',
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }) as StoredMatchState,
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dt-bonus-dice-legacy-dice-shape');
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };
        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
            engineConfig: diceThroneEngineConfig,
            gameId: 'dicethrone',
        });

        expect(candidate).toBeNull();
    });
    it('online AI watchdog 在 visible simple-choice 的 sourceId/title/options 相同但 slider 配置漂移时，也必须丢弃旧 tracker', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const baseChoice = createSimpleChoice(
            'reaction-slider-choice',
            '1',
            '选择要转移的数量',
            [
                {
                    id: 'confirm',
                    label: '确认转移',
                    value: { kind: 'confirm' },
                },
                {
                    id: 'skip',
                    label: '跳过',
                    value: { kind: 'pass', skip: true },
                },
            ],
            { sourceId: 'giant_ants_transfer_counter_prompt' },
        );
        (baseChoice.data as typeof baseChoice.data & { slider?: unknown }).slider = {
            min: 1,
            max: 2,
            step: 1,
            defaultValue: 2,
            confirmOptionId: 'confirm',
            skipOptionId: 'skip',
            confirmLabel: '确认转移 {{value}}',
            valueLabel: '当前数量：{{value}} / {{max}}',
            skipLabel: '跳过',
        };

        await storage.createMatch('match-watchdog-simple-choice-slider-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: baseChoice,
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-simple-choice-slider-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: false,
            fingerprintHint: 'interaction:1:scoreBases:simple-choice:giant_ants_transfer_counter_prompt:选择要转移的数量::{"min":1,"max":2,"step":1,"defaultValue":2,"confirmOptionId":"confirm","confirmLabel":"确认转移 {{value}}","valueLabel":"当前数量：{{value}} / {{max}}","skipOptionId":"skip","skipLabel":"跳过","hintKey":null}:confirm:0:{"kind":"confirm"},skip:0:{"kind":"pass","skip":true}',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:scoreBases:simple-choice:giant_ants_transfer_counter_prompt:选择要转移的数量::{"min":1,"max":2,"step":1,"defaultValue":2,"confirmOptionId":"confirm","confirmLabel":"确认转移 {{value}}","valueLabel":"当前数量：{{value}} / {{max}}","skipOptionId":"skip","skipLabel":"跳过","hintKey":null}:confirm:0:{"kind":"confirm"},skip:0:{"kind":"pass","skip":true}',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:scoreBases:simple-choice:giant_ants_transfer_counter_prompt:选择要转移的数量::{"min":1,"max":2,"step":1,"defaultValue":2,"confirmOptionId":"confirm","confirmLabel":"确认转移 {{value}}","valueLabel":"当前数量：{{value}} / {{max}}","skipOptionId":"skip","skipLabel":"跳过","hintKey":null}:confirm:0:{"kind":"confirm"},skip:0:{"kind":"pass","skip":true}',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };
        const driftedCandidate = {
            ...candidate,
            fingerprintHint: 'interaction:1:scoreBases:simple-choice:giant_ants_transfer_counter_prompt:选择要转移的数量::{"min":1,"max":4,"step":1,"defaultValue":4,"confirmOptionId":"confirm","confirmLabel":"确认转移 {{value}}","valueLabel":"当前数量：{{value}} / {{max}}","skipOptionId":"skip","skipLabel":"跳过","hintKey":null}:confirm:0:{"kind":"confirm"},skip:0:{"kind":"pass","skip":true}',
            resolution: {
                ...candidate.resolution,
                attemptKey: 'force-end-turn:1:interaction:1:scoreBases:simple-choice:giant_ants_transfer_counter_prompt:选择要转移的数量::{"min":1,"max":4,"step":1,"defaultValue":4,"confirmOptionId":"confirm","confirmLabel":"确认转移 {{value}}","valueLabel":"当前数量：{{value}} / {{max}}","skipOptionId":"skip","skipLabel":"跳过","hintKey":null}:confirm:0:{"kind":"confirm"},skip:0:{"kind":"pass","skip":true}',
                action: {
                    ...candidate.resolution.action,
                    actionId: 'force-end-turn:interaction:1:scoreBases:simple-choice:giant_ants_transfer_counter_prompt:选择要转移的数量::{"min":1,"max":4,"step":1,"defaultValue":4,"confirmOptionId":"confirm","confirmLabel":"确认转移 {{value}}","valueLabel":"当前数量：{{value}} / {{max}}","skipOptionId":"skip","skipLabel":"跳过","hintKey":null}:confirm:0:{"kind":"confirm"},skip:0:{"kind":"pass","skip":true}',
                },
            },
        };
        const tracker = {
            key: '1:visible-interaction:interaction:1:scoreBases:simple-choice:giant_ants_transfer_counter_prompt:选择要转移的数量::{"min":1,"max":2,"step":1,"defaultValue":2,"confirmOptionId":"confirm","confirmLabel":"确认转移 {{value}}","valueLabel":"当前数量：{{value}} / {{max}}","skipOptionId":"skip","skipLabel":"跳过","hintKey":null}:confirm:0:{"kind":"confirm"},skip:0:{"kind":"pass","skip":true}',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            const nextChoice = createSimpleChoice(
                'reaction-slider-choice',
                '1',
                '选择要转移的数量',
                [
                    {
                        id: 'confirm',
                        label: '确认转移',
                        value: { kind: 'confirm' },
                    },
                    {
                        id: 'skip',
                        label: '跳过',
                        value: { kind: 'pass', skip: true },
                    },
                ],
                { sourceId: 'giant_ants_transfer_counter_prompt' },
            );
            (nextChoice.data as typeof nextChoice.data & { slider?: unknown }).slider = {
                min: 1,
                max: 4,
                step: 1,
                defaultValue: 4,
                confirmOptionId: 'confirm',
                skipOptionId: 'skip',
                confirmLabel: '确认转移 {{value}}',
                valueLabel: '当前数量：{{value}} / {{max}}',
                skipLabel: '跳过',
            };

            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        current: nextChoice,
                        queue: [],
                        isBlocked: false,
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(driftedCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-simple-choice-slider-fingerprint-drift')).toBe(false);
    });
    it('online AI watchdog 在 visible simple-choice 的 slider 配置漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const baseChoice = createSimpleChoice(
            'reaction-slider-choice',
            '1',
            '选择要转移的数量',
            [
                {
                    id: 'confirm',
                    label: '确认转移',
                    value: { kind: 'confirm' },
                },
                {
                    id: 'skip',
                    label: '跳过',
                    value: { kind: 'pass', skip: true },
                },
            ],
            { sourceId: 'giant_ants_transfer_counter_prompt' },
        );
        (baseChoice.data as typeof baseChoice.data & { slider?: unknown }).slider = {
            min: 1,
            max: 2,
            step: 1,
            defaultValue: 2,
            confirmOptionId: 'confirm',
            skipOptionId: 'skip',
            confirmLabel: '确认转移 {{value}}',
            valueLabel: '当前数量：{{value}} / {{max}}',
            skipLabel: '跳过',
        };

        const driftedChoice = createSimpleChoice(
            'reaction-slider-choice',
            '1',
            '选择要转移的数量',
            [
                {
                    id: 'confirm',
                    label: '确认转移',
                    value: { kind: 'confirm' },
                },
                {
                    id: 'skip',
                    label: '跳过',
                    value: { kind: 'pass', skip: true },
                },
            ],
            { sourceId: 'giant_ants_transfer_counter_prompt' },
        );
        (driftedChoice.data as typeof driftedChoice.data & { slider?: unknown }).slider = {
            min: 1,
            max: 4,
            step: 1,
            defaultValue: 4,
            confirmOptionId: 'confirm',
            skipOptionId: 'skip',
            confirmLabel: '确认转移 {{value}}',
            valueLabel: '当前数量：{{value}} / {{max}}',
            skipLabel: '跳过',
        };

        await storage.createMatch('match-watchdog-simple-choice-slider-sequence-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'scoreBases',
                interaction: {
                    current: baseChoice,
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: null;
            }>;
        };

        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };
        const match = await serverInternal.loadMatch('match-watchdog-simple-choice-slider-sequence-drift');
        const candidate = await serverInternal.resolveOnlineAiRecoveryCandidate(match, seatControllers);
        expect(candidate?.reason).toBe('visible-interaction');

        const tracker = {
            key: `${candidate.playerId}:${candidate.reason}:${candidate.fingerprintHint}`,
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        let recoveryCallCount = 0;
        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementation(async (activeMatch) => {
            recoveryCallCount += 1;
            if (recoveryCallCount === 1) {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        interaction: {
                            current: driftedChoice,
                            queue: [],
                            isBlocked: false,
                        },
                    },
                };
                return {
                    applied: true,
                    resolved: false,
                    blockedReason: null,
                    executedCommandTypes: [INTERACTION_COMMANDS.RESPOND],
                    outcome: 'applied',
                    reportedAction: null,
                };
            }
            if (recoveryCallCount === 2) {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                    },
                };
                return {
                    applied: true,
                    resolved: true,
                    blockedReason: null,
                    executedCommandTypes: [INTERACTION_COMMANDS.RESPOND],
                    outcome: 'applied',
                    reportedAction: null,
                };
            }

            throw new Error(`Unexpected legal-action recovery attempt after slider drift: ${recoveryCallCount}`);
        });

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            seatControllers,
        );

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-simple-choice-slider-sequence-drift')).toBe(false);
    });
    it('online AI watchdog 在 visible simple-choice 的 option value 漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const baseChoice = createSimpleChoice(
            'smashup-counter-choice-sequence',
            '1',
            '选择一个反应动作',
            [
                {
                    id: 'counter-0',
                    label: '维尔的力量',
                    value: {
                        cardUid: 'force-1',
                        defId: 'geeks_force_of_wil',
                        cardType: 'action',
                    },
                },
                {
                    id: 'pass',
                    label: '让过',
                    value: { pass: true },
                },
            ],
            {
                sourceId: 'smashup_action_counter_choose',
                targetType: 'generic',
            },
        );

        const driftedChoice = createSimpleChoice(
            'smashup-counter-choice-sequence',
            '1',
            '选择一个反应动作',
            [
                {
                    id: 'counter-0',
                    label: '维尔的力量',
                    value: {
                        cardUid: 'force-1b',
                        defId: 'geeks_force_of_wil',
                        cardType: 'action',
                    },
                },
                {
                    id: 'pass',
                    label: '让过',
                    value: { pass: true },
                },
            ],
            {
                sourceId: 'smashup_action_counter_choose',
                targetType: 'generic',
            },
        );

        await storage.createMatch('match-watchdog-simple-choice-value-sequence-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'scoreBases',
                interaction: {
                    current: baseChoice,
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: null;
            }>;
        };

        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };
        const match = await serverInternal.loadMatch('match-watchdog-simple-choice-value-sequence-drift');
        const candidate = await serverInternal.resolveOnlineAiRecoveryCandidate(match, seatControllers);
        expect(candidate?.reason).toBe('visible-interaction');

        const tracker = {
            key: `${candidate.playerId}:${candidate.reason}:${candidate.fingerprintHint}`,
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        let recoveryCallCount = 0;
        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementation(async (activeMatch) => {
            recoveryCallCount += 1;
            if (recoveryCallCount === 1) {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        interaction: {
                            current: driftedChoice,
                            queue: [],
                            isBlocked: false,
                        },
                    },
                };
                return {
                    applied: true,
                    resolved: false,
                    blockedReason: null,
                    executedCommandTypes: [INTERACTION_COMMANDS.RESPOND],
                    outcome: 'applied',
                    reportedAction: null,
                };
            }
            if (recoveryCallCount === 2) {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                    },
                };
                return {
                    applied: true,
                    resolved: true,
                    blockedReason: null,
                    executedCommandTypes: [INTERACTION_COMMANDS.RESPOND],
                    outcome: 'applied',
                    reportedAction: null,
                };
            }

            throw new Error(`Unexpected legal-action recovery attempt after value drift: ${recoveryCallCount}`);
        });

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            seatControllers,
        );

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-simple-choice-value-sequence-drift')).toBe(false);
    });
    it('online AI watchdog 在 response-window 仅切到新的 window id 且 progress marker 未变时，应继续沿新窗口收口而不是上报 no_progress', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-window-sequence-window-id-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-old-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-sequence',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: {
                    candidateReason: string;
                    playerId: string;
                    actionKind: string;
                    actionId: string;
                } | null;
            }>;
        };

        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };
        const match = await serverInternal.loadMatch('match-watchdog-response-window-sequence-window-id-drift');
        const candidate = await serverInternal.resolveOnlineAiRecoveryCandidate(match, seatControllers);
        expect(candidate?.reason).toBe('response-window');

        const tracker = {
            key: `${candidate.playerId}:${candidate.reason}:${candidate.fingerprintHint}`,
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        let recoveryCallCount = 0;
        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementation(async (activeMatch) => {
            recoveryCallCount += 1;
            if (recoveryCallCount === 1) {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        responseWindow: {
                            current: {
                                id: 'response-window-new-1',
                                windowType: 'afterRollConfirmed',
                                sourceId: 'attack-sequence',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                            },
                        },
                    },
                };
                return {
                    applied: true,
                    resolved: false,
                    blockedReason: null,
                    executedCommandTypes: ['RESPONSE_PASS'],
                    outcome: 'applied',
                    reportedAction: {
                        candidateReason: 'response-window',
                        playerId: '1',
                        actionKind: 'response-pass',
                        actionId: 'legal-response-pass-old-window',
                    },
                };
            }
            if (recoveryCallCount === 2) {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        responseWindow: {
                            current: undefined,
                        },
                    },
                };
                return {
                    applied: true,
                    resolved: true,
                    blockedReason: null,
                    executedCommandTypes: ['RESPONSE_PASS'],
                    outcome: 'applied',
                    reportedAction: null,
                };
            }

            throw new Error(`Unexpected response-window legal-action recovery attempt after window id drift: ${recoveryCallCount}`);
        });

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            seatControllers,
        );

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter.mock.calls[0]?.[0]).toMatchObject({
            incidentKind: 'legal-action-recovered',
            reason: 'response-window:legal-action:response-pass:legal-response-pass-old-window',
        });
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('attack-sequence');
        expect(snapshot.blockerFingerprint).toContain('response-window-old-1');
        expect(snapshot.trackerKey).toContain('response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-sequence:1:response-window-old-1');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('attack-sequence');
        expect(actionLog.blockerFingerprint).toContain('response-window-old-1');
        expect(actionLog.trackerKey).toContain('response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-sequence:1:response-window-old-1');
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-response-window-sequence-window-id-drift')).toBe(false);
    });
    it('online AI watchdog 在 response-loop 仅切到新的 window id 且 progress marker 未变时，应继续沿新窗口收口而不是上报 no_progress', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-loop-sequence-window-id-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-loop-old-1',
                        windowType: 'afterAttackResolved',
                        sourceId: 'attack-loop-sequence',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
                reportedAction?: {
                    candidateReason: string;
                    playerId: string;
                    actionKind: string;
                    actionId: string;
                } | null;
            }>;
        };

        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };
        const match = await serverInternal.loadMatch('match-watchdog-response-loop-sequence-window-id-drift');
        const candidate = {
            playerId: '1',
            reason: 'response-loop',
            requiresConfirmedAdvancePhase: true,
            fingerprintHint: 'response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-sequence:1:response-loop-old-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-sequence:1:response-loop-old-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-sequence:1:response-loop-old-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                },
            },
        };

        const tracker = {
            key: '1:response-loop:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-sequence:1:response-loop-old-1',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 1,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        let recoveryCallCount = 0;
        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementation(async (activeMatch) => {
            recoveryCallCount += 1;
            if (recoveryCallCount === 1) {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        responseWindow: {
                            current: {
                                id: 'response-loop-new-1',
                                windowType: 'afterAttackResolved',
                                sourceId: 'attack-loop-sequence',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                            },
                        },
                    },
                };
                return {
                    applied: true,
                    resolved: false,
                    blockedReason: null,
                    executedCommandTypes: ['RESPONSE_PASS'],
                    outcome: 'applied',
                    reportedAction: {
                        candidateReason: 'response-loop',
                        playerId: '1',
                        actionKind: 'response-pass',
                        actionId: 'legal-response-pass-response-loop-old-window',
                    },
                };
            }
            if (recoveryCallCount === 2) {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        responseWindow: {
                            current: undefined,
                        },
                    },
                };
                return {
                    applied: true,
                    resolved: true,
                    blockedReason: null,
                    executedCommandTypes: ['RESPONSE_PASS'],
                    outcome: 'applied',
                    reportedAction: null,
                };
            }

            throw new Error(`Unexpected response-loop legal-action recovery attempt after window id drift: ${recoveryCallCount}`);
        });

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            seatControllers,
        );

        expect(tryRecoverSpy).toHaveBeenCalledTimes(2);
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter.mock.calls[0]?.[0]).toMatchObject({
            incidentKind: 'legal-action-recovered',
            reason: 'response-loop:legal-action:response-pass:legal-response-pass-response-loop-old-window',
        });
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('attack-loop-sequence');
        expect(snapshot.blockerFingerprint).toContain('response-loop-old-1');
        expect(snapshot.trackerKey).toContain('response-loop:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-sequence:1:response-loop-old-1');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('attack-loop-sequence');
        expect(actionLog.blockerFingerprint).toContain('response-loop-old-1');
        expect(actionLog.trackerKey).toContain('response-loop:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-sequence:1:response-loop-old-1');
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-response-loop-sequence-window-id-drift')).toBe(false);
    });
    it('online AI watchdog 在 multistep-choice 的 sourceId 相同但 allowed/completed 骰集合漂移时，也必须丢弃旧 tracker', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-multistep-choice-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'multistep-choice-1',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'santa_s_coming',
                            allowedDieIds: [0, 1, 2],
                            completedDieIds: [0],
                            meta: {
                                dtType: 'selectDie',
                                selectCount: 2,
                            },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-multistep-choice-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: false,
            fingerprintHint: 'interaction:1:defensiveRoll:multistep-choice:santa_s_coming:0,1,2:0:multistep-choice-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:defensiveRoll:multistep-choice:santa_s_coming:0,1,2:0:multistep-choice-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:defensiveRoll:multistep-choice:santa_s_coming:0,1,2:0:multistep-choice-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };
        const driftedCandidate = {
            ...candidate,
            fingerprintHint: 'interaction:1:defensiveRoll:multistep-choice:santa_s_coming:1,2,3:1,2:multistep-choice-1',
            resolution: {
                ...candidate.resolution,
                attemptKey: 'force-end-turn:1:interaction:1:defensiveRoll:multistep-choice:santa_s_coming:1,2,3:1,2:multistep-choice-1',
                action: {
                    ...candidate.resolution.action,
                    actionId: 'force-end-turn:interaction:1:defensiveRoll:multistep-choice:santa_s_coming:1,2,3:1,2:multistep-choice-1',
                },
            },
        };
        const tracker = {
            key: '1:visible-interaction:interaction:1:defensiveRoll:multistep-choice:santa_s_coming:0,1,2:0:multistep-choice-1',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        current: {
                            id: 'multistep-choice-1',
                            playerId: '1',
                            kind: 'multistep-choice',
                            data: {
                                title: 'dice.modify',
                                sourceId: 'santa_s_coming',
                                allowedDieIds: [1, 2, 3],
                                completedDieIds: [1, 2],
                                meta: {
                                    dtType: 'selectDie',
                                    selectCount: 2,
                                },
                            },
                        },
                        queue: [],
                        isBlocked: false,
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(driftedCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).not.toHaveBeenCalled();
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-multistep-choice-fingerprint-drift')).toBe(false);
    });
    it('online AI watchdog 在 multistep-choice 的 allowed/completed 相同但 selectCount 漂移时，也必须丢弃旧 tracker', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-multistep-choice-select-count-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'multistep-choice-1',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'shadow_thief_samesies',
                            allowedDieIds: [0, 1, 2],
                            completedDieIds: [],
                            meta: {
                                dtType: 'selectDie',
                                selectCount: 1,
                            },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-multistep-choice-select-count-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: false,
            fingerprintHint: 'interaction:1:defensiveRoll:multistep-choice:shadow_thief_samesies:0,1,2::{"dtType":"selectDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":null}:multistep-choice-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:defensiveRoll:multistep-choice:shadow_thief_samesies:0,1,2::{"dtType":"selectDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":null}:multistep-choice-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:defensiveRoll:multistep-choice:shadow_thief_samesies:0,1,2::{"dtType":"selectDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":null}:multistep-choice-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };
        const driftedCandidate = {
            ...candidate,
            fingerprintHint: 'interaction:1:defensiveRoll:multistep-choice:shadow_thief_samesies:0,1,2::{"dtType":"selectDie","selectCount":2,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":null}:multistep-choice-1',
            resolution: {
                ...candidate.resolution,
                attemptKey: 'force-end-turn:1:interaction:1:defensiveRoll:multistep-choice:shadow_thief_samesies:0,1,2::{"dtType":"selectDie","selectCount":2,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":null}:multistep-choice-1',
                action: {
                    ...candidate.resolution.action,
                    actionId: 'force-end-turn:interaction:1:defensiveRoll:multistep-choice:shadow_thief_samesies:0,1,2::{"dtType":"selectDie","selectCount":2,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":null}:multistep-choice-1',
                },
            },
        };
        const tracker = {
            key: '1:visible-interaction:interaction:1:defensiveRoll:multistep-choice:shadow_thief_samesies:0,1,2::{"dtType":"selectDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":null}:multistep-choice-1',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        current: {
                            id: 'multistep-choice-1',
                            playerId: '1',
                            kind: 'multistep-choice',
                            data: {
                                title: 'dice.modify',
                                sourceId: 'shadow_thief_samesies',
                                allowedDieIds: [0, 1, 2],
                                completedDieIds: [],
                                meta: {
                                    dtType: 'selectDie',
                                    selectCount: 2,
                                },
                            },
                        },
                        queue: [],
                        isBlocked: false,
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(driftedCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-multistep-choice-select-count-fingerprint-drift')).toBe(false);
    });
    it('online AI watchdog 在 multistep-choice 的 allowed/completed 相同但 dieModifyConfig 漂移时，也必须丢弃旧 tracker', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-multistep-choice-die-config-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'multistep-choice-1',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'gunslinger_tip_it',
                            allowedDieIds: [0, 1],
                            completedDieIds: [0],
                            meta: {
                                dtType: 'modifyDie',
                                selectCount: 1,
                                dieModifyConfig: {
                                    mode: 'set',
                                    targetValue: 1,
                                },
                            },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-multistep-choice-die-config-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: false,
            fingerprintHint: 'interaction:1:defensiveRoll:multistep-choice:gunslinger_tip_it:0,1:0:{"dtType":"modifyDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":{"mode":"set","targetValue":1,"adjustRange":null}}:multistep-choice-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:defensiveRoll:multistep-choice:gunslinger_tip_it:0,1:0:{"dtType":"modifyDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":{"mode":"set","targetValue":1,"adjustRange":null}}:multistep-choice-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:defensiveRoll:multistep-choice:gunslinger_tip_it:0,1:0:{"dtType":"modifyDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":{"mode":"set","targetValue":1,"adjustRange":null}}:multistep-choice-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };
        const driftedCandidate = {
            ...candidate,
            fingerprintHint: 'interaction:1:defensiveRoll:multistep-choice:gunslinger_tip_it:0,1:0:{"dtType":"modifyDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":{"mode":"set","targetValue":6,"adjustRange":null}}:multistep-choice-1',
            resolution: {
                ...candidate.resolution,
                attemptKey: 'force-end-turn:1:interaction:1:defensiveRoll:multistep-choice:gunslinger_tip_it:0,1:0:{"dtType":"modifyDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":{"mode":"set","targetValue":6,"adjustRange":null}}:multistep-choice-1',
                action: {
                    ...candidate.resolution.action,
                    actionId: 'force-end-turn:interaction:1:defensiveRoll:multistep-choice:gunslinger_tip_it:0,1:0:{"dtType":"modifyDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":{"mode":"set","targetValue":6,"adjustRange":null}}:multistep-choice-1',
                },
            },
        };
        const tracker = {
            key: '1:visible-interaction:interaction:1:defensiveRoll:multistep-choice:gunslinger_tip_it:0,1:0:{"dtType":"modifyDie","selectCount":1,"targetOpponentDice":null,"diceOwnerId":null,"dieModifyConfig":{"mode":"set","targetValue":1,"adjustRange":null}}:multistep-choice-1',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        current: {
                            id: 'multistep-choice-1',
                            playerId: '1',
                            kind: 'multistep-choice',
                            data: {
                                title: 'dice.modify',
                                sourceId: 'gunslinger_tip_it',
                                allowedDieIds: [0, 1],
                                completedDieIds: [0],
                                meta: {
                                    dtType: 'modifyDie',
                                    selectCount: 1,
                                    dieModifyConfig: {
                                        mode: 'set',
                                        targetValue: 6,
                                    },
                                },
                            },
                        },
                        queue: [],
                        isBlocked: false,
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(driftedCandidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy).toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-multistep-choice-die-config-fingerprint-drift')).toBe(false);
    });
    it('online AI watchdog 在 dt:defender-choice 候选 fingerprint 漂移到新的 sourceId 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-dt-defender-choice-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'targetingRoll',
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                },
                interaction: {
                    current: {
                        id: 'dt-defender-choice-old-1',
                        playerId: '1',
                        kind: 'dt:defender-choice',
                        data: {
                            attackerId: '0',
                            chooserPlayerId: '1',
                            sourceId: 'barbarian_reckless',
                            targetRollValue: 6,
                            options: [
                                { playerId: '2', customId: 'defender-2' },
                                { playerId: '3', customId: 'defender-3' },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dt-defender-choice-fingerprint-drift');
        const baseCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers: {
                '0': { type: 'human' as const },
                '1': { type: 'local-ai' as const },
            },
            seatStates: {},
        });
        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            baseCandidate,
            buildAiProgressMarker(match.state),
        );
        const tracker = {
            key: `1:visible-interaction:${baseFingerprint}`,
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    interaction: {
                        ...(activeMatch.state.sys?.interaction ?? {}),
                        current: {
                            id: 'dt-defender-choice-new-1',
                            playerId: '1',
                            kind: 'dt:defender-choice',
                            data: {
                                attackerId: '0',
                                chooserPlayerId: '1',
                                sourceId: 'barbarian_reckless_drifted',
                                targetRollValue: 6,
                                options: [
                                    { playerId: '2', customId: 'defender-2' },
                                    { playerId: '3', customId: 'defender-3' },
                                ],
                            },
                        },
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action' as const,
            };
        });

        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockImplementationOnce(async (activeMatch, seatControllers) => {
                const candidate = await resolveForceEndTurnForStalledAi({
                    sharedState: activeMatch.state,
                    seatControllers,
                    seatStates: {},
                });
                if (!candidate) {
                    return candidate;
                }
                return candidate;
            });

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            baseCandidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        tryRecoverSpy.mockRestore();
        resolveCandidateSpy.mockRestore();

        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-dt-defender-choice-fingerprint-drift')).toBe(false);
    });
    it('online AI watchdog 在 response-window 候选 fingerprint 漂移到新的窗口 current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-window-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-old-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-old-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-response-window-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'response-window',
            requiresConfirmedAdvancePhase: false,
            fingerprintHint: 'response-window:1:defensiveRoll:afterRollConfirmed:attack-old-1:1:response-window-old-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:response-window:1:defensiveRoll:afterRollConfirmed:attack-old-1:1:response-window-old-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:response-window:1:defensiveRoll:afterRollConfirmed:attack-old-1:1:response-window-old-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };
        const tracker = {
            key: '1:response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-old-1:1:response-window-old-1',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    responseWindow: {
                        ...(activeMatch.state.sys?.responseWindow ?? {}),
                        current: {
                            id: 'response-window-new-1',
                            windowType: 'afterRollConfirmed',
                            sourceId: 'attack-new-1',
                            responderQueue: ['1'],
                            currentResponderIndex: 0,
                        },
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(candidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-response-window-fingerprint-drift')).toBe(false);
    });
    it('online AI watchdog 在 response-loop 候选 fingerprint 漂移到新的窗口 current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-loop-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-loop-old-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-old-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-response-loop-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'response-loop',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:response-loop:1:defensiveRoll:afterRollConfirmed:attack-old-1:1:response-loop-old-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:response-loop:1:defensiveRoll:afterRollConfirmed:attack-old-1:1:response-loop-old-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                },
            },
        };
        const tracker = {
            key: '1:response-loop:response-loop:1:defensiveRoll:afterRollConfirmed:attack-old-1:1:response-loop-old-1',
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockImplementationOnce(async (activeMatch) => {
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                    responseWindow: {
                        ...(activeMatch.state.sys?.responseWindow ?? {}),
                        current: {
                            id: 'response-loop-new-1',
                            windowType: 'afterRollConfirmed',
                            sourceId: 'attack-new-1',
                            responderQueue: ['1'],
                            currentResponderIndex: 0,
                        },
                    },
                },
            };
            return {
                applied: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
            };
        });
        const resolveCandidateSpy = vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate')
            .mockResolvedValueOnce(candidate)
            .mockResolvedValueOnce(candidate);

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalled();
        expect(resolveCandidateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(feedbackReporter).not.toHaveBeenCalled();
        expect(tracker.autoSubmittedAt).toBeNull();
        expect((server as any).onlineAiRecoveryLedger.hasTracker('match-watchdog-response-loop-fingerprint-drift')).toBe(false);
    });
});
