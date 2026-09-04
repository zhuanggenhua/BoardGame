import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import type { GameEngineConfig } from '../engineConfig';
import { createSimpleChoice, INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import * as aiModule from '../../ai';
import smashUpEngineConfig, { smashUpSystemsForTest } from '../../../games/smashup/game';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfig,
    createEngineConfigWithId,
    createMetadata,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
    createPersistedStaleSmashUpReactionChoiceState,
    nextTick,
} from './helpers/serverTestHarness';

describe('online AI watchdog feedback and response-window recovery', () => {
    it('online AI watchdog 失败反馈应按 incident key 去重冷却', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-failure', {
            initialState: createOnlineAiRecoveryState(),
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
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-failure');
        vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(false);

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-failure',
            playerId: '1',
            incidentKind: 'force-end-turn-failed',
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('4|main2|1|0');
        expect(snapshot.trackerKey).toContain('active-turn:4|main2|1|0');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('4|main2|1|0');
        expect(actionLog.trackerKey).toContain('active-turn:4|main2|1|0');
    });
    it('online AI watchdog 同一卡点重复恢复三次后应强制取消 AI 交互并安全推进阶段', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const createRepeatedChoice = (id: string) => createSimpleChoice(
            id,
            '1',
            '重复卡点测试',
            [{ id: 'pass', label: '跳过', value: { kind: 'pass' } }],
            { sourceId: 'repeat-source' },
        );

        await storage.createMatch('match-watchdog-repeated-recovery-limit', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: createRepeatedChoice('repeat-choice-1'),
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
            onlineAiRecoveryRepeatedAttemptLimit: 3,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: null;
                executedCommandTypes: string[];
                outcome: 'no-legal-action';
                reportedAction: null;
            }>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-repeated-recovery-limit');
        vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockResolvedValue({
            applied: false,
            resolved: false,
            blockedReason: null,
            executedCommandTypes: [],
            outcome: 'no-legal-action',
            reportedAction: null,
        });
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
            expect(playerID).toBe('1');
            if (commandType === INTERACTION_COMMANDS.RESPOND) {
                expect(payload).toMatchObject({ optionId: 'pass' });
                const eventStreamNextId = (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1;
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: eventStreamNextId },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                    },
                };
                return true;
            }
            if (commandType === INTERACTION_COMMANDS.CANCEL) {
                expect(payload).toMatchObject({
                    interactionId: 'repeat-choice-4',
                    reason: 'repeated-recovery-limit',
                });
                const eventStreamNextId = (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1;
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: eventStreamNextId },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                    },
                };
                return true;
            }
            if (commandType === 'ADVANCE_PHASE') {
                const eventStreamNextId = (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1;
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'draw',
                        eventStream: { nextId: eventStreamNextId },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                };
                return true;
            }
            throw new Error(`Unexpected command: ${commandType}`);
        });

        const resetSameStuckPoint = (attempt: number): void => {
            match.state = {
                ...match.state,
                core: {
                    ...match.state.core,
                    activePlayerId: '1',
                    currentPlayerIndex: 1,
                },
                sys: {
                    ...match.state.sys,
                    phase: 'scoreBases',
                    eventStream: { nextId: 100 + attempt },
                    interaction: {
                        current: createRepeatedChoice(`repeat-choice-${attempt}`),
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                    gameover: undefined,
                },
            };
        };
        const runRecoveryCycle = async (): Promise<void> => {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            for (let i = 0; i < 5; i++) {
                await nextTick();
            }
        };

        for (let attempt = 1; attempt <= 3; attempt++) {
            resetSameStuckPoint(attempt);
            await runRecoveryCycle();
            expect(executeSpy).toHaveBeenCalledTimes(attempt);
        }

        resetSameStuckPoint(4);
        await runRecoveryCycle();

        expect(executeSpy.mock.calls.map(call => call[2])).toEqual([
            INTERACTION_COMMANDS.RESPOND,
            INTERACTION_COMMANDS.RESPOND,
            INTERACTION_COMMANDS.RESPOND,
            INTERACTION_COMMANDS.CANCEL,
            'ADVANCE_PHASE',
        ]);
        expect(match.state.sys.gameover).toBeUndefined();
        expect(match.state.sys.interaction?.current).toBeUndefined();
        expect(match.state.sys.phase).toBe('draw');
        expect(match.state.core.activePlayerId).toBe('0');
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-repeated-recovery-limit',
            playerId: '1',
            incidentKind: 'repeated-recovery-force-unblocked',
            severity: 'high',
            status: 'open',
            reason: expect.stringContaining('visible-interaction:repeat-limit-force-unblock:3/3:commands=SYS_INTERACTION_CANCEL+ADVANCE_PHASE'),
        }));
    });
    it('online AI watchdog 同一卡点重复恢复三次后若仍有响应窗口，不应裸 ADVANCE_PHASE 跳过窗口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const createRepeatedResponseWindow = () => ({
            current: {
                id: 'repeat-response-window',
                windowType: 'afterCardPlayed',
                sourceId: 'repeat-response-source',
                responderQueue: ['1'],
                currentResponderIndex: 0,
            },
        });

        await storage.createMatch('match-watchdog-repeated-response-window-limit', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'scoreBases',
                responseWindow: createRepeatedResponseWindow(),
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryRepeatedAttemptLimit: 3,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-repeated-response-window-limit');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('RESPONSE_PASS');
            const eventStreamNextId = (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1;
            activeMatch.state = {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: { nextId: eventStreamNextId },
                    responseWindow: {
                        current: undefined,
                    },
                },
            };
            return true;
        });

        const resetSameStuckPoint = (attempt: number): void => {
            match.state = {
                ...match.state,
                sys: {
                    ...match.state.sys,
                    phase: 'scoreBases',
                    eventStream: { nextId: 200 + attempt },
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: createRepeatedResponseWindow(),
                    gameover: undefined,
                },
            };
        };
        const runRecoveryCycle = async (): Promise<void> => {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            for (let i = 0; i < 5; i++) {
                await nextTick();
            }
        };

        for (let attempt = 1; attempt <= 3; attempt++) {
            resetSameStuckPoint(attempt);
            await runRecoveryCycle();
            expect(executeSpy).toHaveBeenCalledTimes(attempt);
        }

        resetSameStuckPoint(4);
        await runRecoveryCycle();

        expect(executeSpy).toHaveBeenCalledTimes(3);
        expect(match.state.sys.gameover).toBeUndefined();
        expect(match.state.sys.responseWindow?.current?.id).toBe('repeat-response-window');
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-repeated-response-window-limit',
            playerId: '1',
            incidentKind: 'repeated-recovery-suppressed',
            severity: 'high',
            status: 'open',
            reason: 'response-window:repeat-limit:3/3:no_safe_force_unblock',
        }));
    });
    it('smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const smashUpWatchdogConfig = {
            ...smashUpEngineConfig,
            systems: smashUpSystemsForTest.filter((_, index) => index !== 8),
        };

        await storage.createMatch('match-watchdog-smashup-stale-reaction-choice', {
            initialState: createPersistedStaleSmashUpReactionChoiceState(),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [smashUpWatchdogConfig],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-smashup-stale-reaction-choice');
        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();
        await nextTick();

        expect(match.state.sys.interaction?.current).toBeUndefined();
        expect(match.state.sys.responseWindow?.current).toBeUndefined();
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-smashup-stale-reaction-choice',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-smashup-stale-reaction-choice',
            playerId: '1',
            status: 'resolved',
        }));
    });
    it('smashup AI reaction pass 后仍停在同一交互时，应升级为硬取消而不是 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-smashup-reaction-pass-stuck', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: {
                        id: 'reaction-choice-stuck',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个反应动作',
                            options: [
                                {
                                    id: 'trigger-ninja-dojo',
                                    label: '结算 Ninja Dojo',
                                    value: { kind: 'trigger', triggerId: 'afterScoring:base_ninja_dojo:1:0' },
                                },
                                {
                                    id: 'pass',
                                    label: 'Pass',
                                    value: { kind: 'pass' },
                                },
                            ],
                        },
                    },
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
            onlineAiRecoveryMaxAdvanceSteps: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-smashup-reaction-pass-stuck');
        const executed: Array<{ commandType: string; payload: unknown }> = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
            executed.push({ commandType, payload });
            expect(playerID).toBe('1');

            if (commandType === INTERACTION_COMMANDS.RESPOND) {
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
                                ...(activeMatch.state.sys?.interaction?.current ?? {}),
                                id: 'reaction-choice-stuck-reopened',
                            },
                        },
                    },
                };
                return true;
            }

            if (commandType === INTERACTION_COMMANDS.CANCEL) {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'playCards',
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        interaction: {
                            ...(activeMatch.state.sys?.interaction ?? {}),
                            current: undefined,
                            isBlocked: false,
                        },
                    },
                };
                return true;
            }

            return false;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }

        expect(executed.map((item) => item.commandType)).toEqual([
            INTERACTION_COMMANDS.RESPOND,
            INTERACTION_COMMANDS.CANCEL,
        ]);
        expect(match.state.sys.interaction?.current).toBeUndefined();
        expect(match.state.core.activePlayerId).toBe('0');
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-smashup-reaction-pass-stuck',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('blocker_persisted'),
        }));
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-smashup-reaction-pass-stuck',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
            reason: 'visible-interaction:recover-interaction:steps=1',
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('smashup_reaction_choose');
        expect(snapshot.blockerFingerprint).toContain('afterScoring:base_ninja_dojo:1:0');
        expect(snapshot.trackerKey).toContain('visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('smashup_reaction_choose');
        expect(actionLog.blockerFingerprint).toContain('afterScoring:base_ninja_dojo:1:0');
        expect(actionLog.trackerKey).toContain('visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose');
    });
    it('online AI watchdog 自动反馈冷却期内应按 trackerKey 去重，即使 progressMarker 变化也不重复上报', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryFeedbackCooldownMs: 60_000,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            reportOnlineAiRecoveryFeedback: (payload: {
                matchId: string;
                gameId: string;
                playerId: string;
                incidentKind:
                    | 'force-end-turn-success'
                    | 'force-end-turn-failed'
                    | 'unsatisfiable-interaction-auto-skipped'
                    | 'legal-action-recovered';
                severity: 'medium' | 'high';
                reason: string;
                trackerKey: string;
                progressMarker: string;
                stateSnapshot: string;
                actionLog?: string;
            }) => Promise<void>;
        };

        const payload = {
            matchId: 'match-watchdog-dedupe',
            gameId: 'smashup',
            playerId: '1',
            incidentKind: 'force-end-turn-failed' as const,
            severity: 'high' as const,
            reason: 'visible-interaction:recover-interaction:blocker_persisted',
            trackerKey: '1:visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose:选择一个反应动作::2',
            progressMarker: 'marker-before-1',
            stateSnapshot: '{"matchId":"match-watchdog-dedupe"}',
        };

        await serverInternal.transportFeedbackReporter.reportOnlineAiRecoveryFeedback(payload);
        await serverInternal.transportFeedbackReporter.reportOnlineAiRecoveryFeedback({
            ...payload,
            progressMarker: 'marker-before-2',
        });

        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-dedupe',
            trackerKey: payload.trackerKey,
            progressMarker: 'marker-before-1',
        }));
    });
    it('online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-command-failure-diagnostic', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-command-failure',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'trigger-ninja-dojo',
                                label: '结算 Ninja Dojo',
                                value: { kind: 'trigger', triggerId: 'afterScoring:base_ninja_dojo:1:0' },
                            },
                            {
                                id: 'pass',
                                label: 'Pass',
                                value: { kind: 'pass' },
                            },
                        ],
                        { sourceId: 'smashup_reaction_choose', targetType: 'button' },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'idle',
            idleReason: 'no-action',
        } as any);

        try {
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
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            await serverInternal.loadMatch('match-watchdog-command-failure-diagnostic');
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, playerID, commandType, payload) => {
                expect(playerID).toBe('1');
                expect(commandType).toBe(INTERACTION_COMMANDS.RESPOND);
                expect(payload).toEqual({ interactionId: 'reaction-choice-command-failure', optionId: 'pass' });
                match.lastCommandFailureReason = 'invalid_interaction_response: stale option';
                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-command-failure-diagnostic',
                incidentKind: 'force-end-turn-failed',
                reason: 'visible-interaction:recover-interaction:command_failed:SYS_INTERACTION_RESPOND:invalid_interaction_response: stale option',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('smashup_reaction_choose');
            expect(snapshot.blockerFingerprint).toContain('afterScoring:base_ninja_dojo:1:0');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('smashup_reaction_choose');
            expect(actionLog.blockerFingerprint).toContain('afterScoring:base_ninja_dojo:1:0');
            expect(actionLog.trackerKey).toContain('visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 的 legal-action 若已命令失败，不应再用同一条 ADVANCE_PHASE 重试并吞成裸 command_failed', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-active-turn-advance-legal-action-failure', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                phase: 'playCards',
                turnNumber: 0,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 554,
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'smashup',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', minimumActionDelayMs: 0 },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                attemptKey: 'watchdog-active-turn-advance-phase',
                source: 'local-ai',
                action: {
                    actionId: 'advance-phase:playCards:1',
                    kind: 'advance-phase',
                    label: '结束当前阶段',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        });

        try {
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
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: { suppressBroadcast?: boolean },
                ) => Promise<boolean>;
            };

            await serverInternal.loadMatch('match-watchdog-active-turn-advance-legal-action-failure');
            const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, playerID, commandType, payload) => {
                expect(playerID).toBe('1');
                expect(commandType).toBe('ADVANCE_PHASE');
                expect(payload).toEqual({});
                match.lastCommandFailureReason = 'pipeline_error: test advance denied';
                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy).toHaveBeenCalledTimes(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-active-turn-advance-legal-action-failure',
                incidentKind: 'force-end-turn-failed',
                reason: 'active-turn:follow-up-advance:legal_action_command_failed:ADVANCE_PHASE:pipeline_error: test advance denied',
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('playCards');
            expect(snapshot.blockerFingerprint).toContain('4|playCards|1|0');
            expect(snapshot.trackerKey).toContain('active-turn:4|playCards|1|0');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('playCards');
            expect(actionLog.blockerFingerprint).toContain('4|playCards|1|0');
            expect(actionLog.trackerKey).toContain('active-turn:4|playCards|1|0');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 的同一合法动作连续命令失败达到上限后，不应无限重试同一命令', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-legal-action-failure-repeat-limit', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                attemptKey: 'watchdog-smashup-play-action-failure',
                source: 'local-ai',
                action: {
                    actionId: 'play-action:winter-surprise',
                    kind: 'play-action',
                    label: '打出 冬季惊喜',
                    commands: [{ type: 'su:play_action', payload: { cardUid: 'winter-surprise' } }],
                },
            },
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiRecoveryFailureReportThreshold: 1,
                onlineAiRecoveryRepeatedAttemptLimit: 3,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: { suppressBroadcast?: boolean },
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-legal-action-failure-repeat-limit');
            const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                expect(playerID).toBe('1');
                if (commandType === 'su:play_action') {
                    expect(payload).toEqual({ cardUid: 'winter-surprise' });
                    activeMatch.lastCommandFailureReason = 'pipeline_error: winter surprise event shape';
                    return false;
                }
                if (commandType === 'ADVANCE_PHASE') {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            phase: 'draw',
                            turnNumber: 5,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                        },
                    };
                    return true;
                }
                throw new Error(`Unexpected command: ${commandType}`);
            });

            const runRecoveryCycle = async (): Promise<void> => {
                await serverInternal.runOnlineAiRecoveryTick();
                await serverInternal.runOnlineAiRecoveryTick();
                await nextTick();
                await nextTick();
            };

            await runRecoveryCycle();
            await runRecoveryCycle();
            await runRecoveryCycle();
            await runRecoveryCycle();

            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual([
                'su:play_action',
                'su:play_action',
                'su:play_action',
                'ADVANCE_PHASE',
            ]);
            expect(match.state.sys.phase).toBe('draw');
            expect(match.state.core.activePlayerId).toBe('0');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-legal-action-failure-repeat-limit',
                incidentKind: 'repeated-recovery-force-unblocked',
                reason: expect.stringContaining('active-turn:repeat-limit-force-unblock:3/3:commands=ADVANCE_PHASE'),
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 SmashUp playCards 的合法动作无进展时，应 fallback 到 ADVANCE_PHASE 收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-smashup-playcards-no-progress-fallback', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                phase: 'playCards',
                turnNumber: 0,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
                eventStreamNextId: 118,
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                attemptKey: 'watchdog-smashup-activate-special-no-progress',
                source: 'local-ai',
                action: {
                    actionId: 'activate-special:c70:2',
                    kind: 'activate-special',
                    label: '激活特殊能力 ninja_acolyte',
                    commands: [{ type: 'su:activate_special', payload: { minionUid: 'c70', baseIndex: 2 } }],
                },
            },
        });

        try {
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
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                    options?: { suppressBroadcast?: boolean },
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-smashup-playcards-no-progress-fallback');
            const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                expect(playerID).toBe('1');

                if (commandType === 'su:activate_special') {
                    expect(payload).toEqual({ minionUid: 'c70', baseIndex: 2 });
                    return true;
                }

                if (commandType === 'ADVANCE_PHASE') {
                    expect(payload).toEqual({});
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            turnNumber: 1,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: 119,
                            },
                        },
                    };
                    return true;
                }

                throw new Error(`Unexpected command: ${commandType}`);
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual([
                'su:activate_special',
                'ADVANCE_PHASE',
            ]);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(match.state.sys.turnNumber).toBe(1);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-smashup-playcards-no-progress-fallback',
                incidentKind: 'force-end-turn-success',
                status: 'resolved',
                reason: 'active-turn:follow-up-advance:steps=1',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 自动反馈应携带交互选项与可选性诊断信息', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-option-diagnostics', {
            initialState: createOnlineAiRecoveryState({
                interaction: {
                    current: {
                        id: 'visible-choice-1',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'dt-test-visible-choice',
                            title: 'interaction.chooseTarget',
                            multi: { min: 1 },
                            options: [
                                {
                                    id: 'option-disabled',
                                    label: '被禁用目标',
                                    disabled: true,
                                    disabledReason: '目标已失效',
                                    value: { targetId: 'm-1' },
                                },
                                {
                                    id: 'option-manual',
                                    label: '只能人工决定',
                                    value: { targetId: 'm-2' },
                                },
                            ],
                        },
                    },
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
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-option-diagnostics');
        vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(false);

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            trackerKey?: string;
            stateSnapshot?: string;
            actionLog?: string;
        } | undefined;
        expect(typeof payload?.stateSnapshot).toBe('string');
        const snapshot = JSON.parse(payload!.stateSnapshot!);

        expect(snapshot.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: 'option-disabled',
            disabled: true,
        }));
        expect(snapshot.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: 'option-manual',
        }));
        expect(snapshot.interaction?.seatSelectability).toMatchObject({
            totalOptions: 2,
            enabledOptions: 1,
            disabledOptions: 1,
            selectionState: 'manual-selection-required',
            disabledOptionIds: ['option-disabled'],
            enabledOptionIds: ['option-manual'],
        });
        expect(snapshot.blockerFingerprint).toContain('dt-test-visible-choice');
        expect(snapshot.trackerKey).toBe(payload?.trackerKey);

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('dt-test-visible-choice');
        expect(actionLog.trackerKey).toBe(payload?.trackerKey);
    });
    it('online AI watchdog 自动反馈应携带 AI 决策预览', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-preview';

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [{
                actionId: 'advance-phase',
                kind: 'advance-phase',
                label: '结束阶段',
                commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
            }],
            localPolicies: {
                previewPolicy: {
                    id: 'previewPolicy',
                    decide: () => ({
                        actionId: 'advance-phase',
                        confidence: 0.88,
                        reasoningSummary: '阶段已无可执行动作；优先结束阶段',
                    }),
                },
            },
            defaultLocalPolicyId: 'previewPolicy',
        });

        await storage.createMatch('match-watchdog-ai-preview', {
            initialState: createOnlineAiRecoveryState({
                interaction: {
                    current: {
                        id: 'preview-choice',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'preview-source',
                            title: 'interaction.preview',
                            multi: { min: 1 },
                            options: [{
                                id: 'preview-option',
                                label: '预览选项',
                                value: { targetId: 'x-1' },
                            }],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'previewPolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-ai-preview');
        vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(false);

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            trackerKey?: string;
            stateSnapshot?: string;
            actionLog?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');

        expect(snapshot.seatControllerType).toBe('local-ai');
        expect(snapshot.legalActions).toMatchObject({
            total: 1,
            truncated: false,
        });
        expect(snapshot.legalActions?.items).toContainEqual(expect.objectContaining({
            actionId: 'advance-phase',
            kind: 'advance-phase',
            label: '结束阶段',
            commandTypes: ['ADVANCE_PHASE'],
        }));
        expect(snapshot.aiDecisionPreview).toMatchObject({
            previewSource: 'seat-policy',
            policyId: 'previewPolicy',
            reasoningSummary: '阶段已无可执行动作；优先结束阶段',
            confidence: 0.88,
            error: null,
        });
        expect(snapshot.aiDecisionPreview?.chosenAction).toMatchObject({
            actionId: 'advance-phase',
            kind: 'advance-phase',
            label: '结束阶段',
            commandTypes: ['ADVANCE_PHASE'],
        });
        expect(snapshot.blockerFingerprint).toContain('preview-source');
        expect(snapshot.trackerKey).toBe(payload?.trackerKey);

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('preview-source');
        expect(actionLog.trackerKey).toBe(payload?.trackerKey);
    });
    it('online AI watchdog 应能识别 dt:card-interaction 无可选目标并携带 reason 取消交互', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-dt-card-empty', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { statusEffects: {}, tokens: {} },
                            '1': { statusEffects: {}, tokens: {} },
                        },
                    },
                    sys: {
                        phase: 'main2',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: {
                                id: 'dt-interaction-empty',
                                kind: 'dt:card-interaction',
                                playerId: '1',
                                data: {
                                    type: 'selectStatus',
                                    targetPlayerIds: ['0', '1'],
                                    requiresTargetWithStatus: true,
                                },
                            },
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-dt-card-empty');

        let firstCommand: { type: string; payload: unknown } | null = null;
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (_match, _playerID, commandType, payload) => {
            if (!firstCommand) {
                firstCommand = { type: commandType, payload };
            }
            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(firstCommand).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: { interactionId: 'dt-interaction-empty' },
        });
    });
    it('命令异常触发 auto-cancel 时，若 CANCEL 自身失败也不应递归爆栈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const executedCommandTypes: string[] = [];
        const executedCommands: Array<{ type: string; payload?: unknown }> = [];

        const guardedEngineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            systems: [
                {
                    id: 'throw-on-command',
                    name: 'throw-on-command',
                    priority: 1,
                    beforeCommand: ({ command }: { command: { type: string; payload?: unknown } }) => {
                        executedCommandTypes.push(command.type);
                        executedCommands.push({ type: command.type, payload: command.payload });
                        if (command.type === 'TRIGGER_ERROR' || command.type === INTERACTION_COMMANDS.CANCEL) {
                            throw new Error(`forced-${command.type}`);
                        }
                    },
                } as any,
            ],
        };

        const interaction = createSimpleChoice(
            'interaction-cancel-recursion-guard',
            '0',
            '测试交互',
            [{ id: 'ok', label: '确认', value: 'ok' }],
        );

        await storage.createMatch('match-cancel-recursion-guard', {
            initialState: {
                G: {
                    core: { currentPlayer: '0' },
                    sys: {
                        phase: 'main',
                        turnNumber: 1,
                        interaction: {
                            current: interaction,
                            queue: [],
                            isBlocked: false,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createMetadata('cred-0'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [guardedEngineConfig],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-cancel-recursion-guard');
        const success = await serverInternal.executeCommandInternal(match, '0', 'TRIGGER_ERROR', {});

        expect(success).toBe(false);
        expect(executedCommandTypes).toEqual(['TRIGGER_ERROR', INTERACTION_COMMANDS.CANCEL]);
        expect(executedCommands[1]).toEqual({
            type: INTERACTION_COMMANDS.CANCEL,
            payload: { interactionId: 'interaction-cancel-recursion-guard' },
        });
    });
    it('online AI watchdog 响应循环时应强制关闭响应窗口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-loop', {
            initialState: createOnlineAiRecoveryState({
                responseWindow: {
                    current: {
                        id: 'response-loop-1',
                        windowType: 'afterCardPlayed',
                        sourceId: 'card-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
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
            onlineAiRecoveryMaxAdvanceSteps: 1,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-response-loop');

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, _playerID, commandType) => {
            executed.push(commandType);
            if (commandType === 'RESPONSE_PASS') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: {
                                id: 'response-loop-2',
                                windowType: 'afterCardPlayed',
                                sourceId: 'card-1',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                            },
                        },
                    },
                };
            }
            if (commandType === 'SYS_RESPONSE_WINDOW_FORCE_CLOSE') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
            }
            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }

        expect(executed).toContain('SYS_RESPONSE_WINDOW_FORCE_CLOSE');
    });
    it('resolveOnlineAiRecoveryCandidate 在 tracker 已进入同一 incident 的 response-loop key 后，仍应继续返回 response-loop，而不是退回 response-window', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-loop-existing-tracker', {
            initialState: createOnlineAiRecoveryState({
                responseWindow: {
                    current: {
                        id: 'response-loop-existing-1',
                        windowType: 'afterCardPlayed',
                        sourceId: 'card-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
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
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-response-loop-existing-tracker');
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, {
            key: '1:response-loop:response-loop:1:main2:afterCardPlayed:card-1:1:response-loop-existing-1',
            firstSeenAt: Date.now(),
            autoSubmittedAt: null,
            lastReportedFailureReason: 'command_failed',
            failureCount: 0,
        });

        const candidate = await serverInternal.resolveOnlineAiRecoveryCandidate(match, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(candidate?.reason).toBe('response-loop');
        expect(candidate?.fingerprintHint).toBe('response-loop:1:main2:afterCardPlayed:card-1:1:response-loop-existing-1');
        expect(candidate?.resolution?.action?.commands).toEqual([
            { type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} },
        ]);
    });
    it('online AI watchdog 不得把“事件流有变化但同一 AI 响应窗口立刻重开”误判为恢复成功', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-reopen-progress', {
            initialState: createOnlineAiRecoveryState({
                responseWindow: {
                    current: {
                        id: 'response-reopen-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'card-surprise-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
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
            onlineAiRecoveryMaxAdvanceSteps: 1,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-response-reopen-progress');

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, _playerID, commandType) => {
            executed.push(commandType);

            if (commandType === 'RESPONSE_PASS') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: {
                                id: 'response-reopen-2',
                                windowType: 'afterRollConfirmed',
                                sourceId: 'card-surprise-2',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                            },
                        },
                    },
                };
                return true;
            }

            if (commandType === 'SYS_RESPONSE_WINDOW_FORCE_CLOSE') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            }

            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        // recovery sequence is fire-and-forget; need enough microtask cycles for it to complete
        for (let i = 0; i < 10; i++) { await nextTick(); }
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }

        expect(executed[0]).toBe('RESPONSE_PASS');
        expect(executed).toContain('SYS_RESPONSE_WINDOW_FORCE_CLOSE');
    });
    it('online AI watchdog 在 response-window 先 RESPONSE_PASS 后若同一 AI 紧接给出 active-turn legal action，应在同一恢复序列内继续收口且不误落成失败反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const gameId = 'test-watchdog-response-loop-handoff-active-turn';
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-loop-handoff-active-turn', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                phase: 'playCards',
                turnNumber: 4,
                responseWindow: {
                    current: {
                        id: 'response-loop-handoff-1',
                        windowType: 'afterCardPlayed',
                        sourceId: 'card-hard-close-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
                eventStreamNextId: 1,
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'response-pass:afterCardPlayed:fallback:1',
                        kind: 'response-pass',
                        label: '先尝试结束当前响应窗口',
                        commands: [{ type: 'RESPONSE_PASS', payload: {} }],
                    },
                    attemptKey: 'watchdog-response-loop-pass-before-force-close',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'blocked',
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                visibility: 'private-required',
                blockedKey: '1:private-required:stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'playCards',
                    privatePhase: 'playCards',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-advance-after-hard-close',
                        kind: 'advance-phase',
                        label: '强关窗后继续结束当前阶段',
                        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                    },
                    attemptKey: 'watchdog-active-turn-after-hard-close',
                    source: 'local-ai',
                },
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };
        try {
            const match = await serverInternal.loadMatch('match-watchdog-response-loop-handoff-active-turn');
            const executed: string[] = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType) => {
                executed.push(commandType);
                expect(playerID).toBe('1');

                if (commandType === 'RESPONSE_PASS') {
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
                                    id: 'response-loop-handoff-2',
                                    windowType: 'afterCardPlayed',
                                    sourceId: 'card-hard-close-1',
                                    responderQueue: ['1'],
                                    currentResponderIndex: 0,
                                },
                            },
                        },
                    };
                    return true;
                }

                if (commandType === 'SYS_RESPONSE_WINDOW_FORCE_CLOSE') {
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
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                if (commandType === 'ADVANCE_PHASE') {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            phase: 'playCards',
                            turnNumber: (activeMatch.state.sys?.turnNumber ?? 4) + 1,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                        },
                    };
                    return true;
                }

                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            for (let i = 0; i < 10; i++) { await nextTick(); }

            expect(executed).toEqual(['RESPONSE_PASS', 'ADVANCE_PHASE']);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-response-loop-handoff-active-turn',
                gameId,
                playerId: '1',
                incidentKind: 'force-end-turn-failed',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 response window 先执行非 pass 合法动作时，不应误触发强制关窗或提前写 resolved 反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const gameId = 'test-watchdog-response-window-non-pass';
        const feedbackReporter = vi.fn(async () => undefined);

        aiModule.registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                if (playerId !== '1') {
                    return [];
                }

                const responseWindow = (state.sys?.responseWindow as { current?: unknown } | undefined)?.current as
                    | { responderQueue?: unknown; currentResponderIndex?: unknown }
                    | undefined;
                if (!responseWindow) {
                    return [];
                }

                const responderQueue = Array.isArray(responseWindow.responderQueue)
                    ? responseWindow.responderQueue
                    : [];
                const responderIndex = typeof responseWindow.currentResponderIndex === 'number'
                    ? responseWindow.currentResponderIndex
                    : 0;
                const currentResponderId = responderQueue[responderIndex];
                if (currentResponderId !== '1') {
                    return [];
                }

                const core = state.core as { modifiedOnce?: boolean };
                if (core.modifiedOnce !== true) {
                    return [{
                        actionId: 'legal-modify-die',
                        kind: 'modify-die',
                        label: '合法改骰',
                        commands: [{ type: 'MODIFY_DIE', payload: { dieIndex: 0, value: 6 } }],
                    }];
                }

                return [{
                    actionId: 'legal-response-pass',
                    kind: 'response-pass',
                    label: '结束响应',
                    commands: [{ type: 'RESPONSE_PASS', payload: {} }],
                }];
            },
            localPolicies: {
                responseWindowPolicy: {
                    id: 'responseWindowPolicy',
                    decide: (context) => ({
                        actionId: context.legalActions[0]?.actionId ?? 'legal-response-pass',
                        confidence: 0.95,
                        reasoningSummary: '先执行改骰动作，再按合法动作收口响应窗口。',
                    }),
                },
            },
            defaultLocalPolicyId: 'responseWindowPolicy',
        });

        await storage.createMatch('match-watchdog-response-window-non-pass', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-non-pass-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'responseWindowPolicy' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryMaxAdvanceSteps: 2,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-response-window-non-pass');

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, playerID, commandType) => {
            executed.push(commandType);
            expect(playerID).toBe('1');

            if (commandType === 'MODIFY_DIE') {
                match.state = {
                    ...match.state,
                    core: {
                        ...match.state.core,
                        modifiedOnce: true,
                    },
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: {
                                id: 'response-window-non-pass-2',
                                windowType: 'afterRollConfirmed',
                                sourceId: 'attack-1',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                            },
                        },
                    },
                };
                return true;
            }

            if (commandType === 'RESPONSE_PASS') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            }

            if (commandType === 'SYS_RESPONSE_WINDOW_FORCE_CLOSE') {
                return true;
            }

            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }

        expect(executed).toContain('MODIFY_DIE');
        expect(executed).toContain('RESPONSE_PASS');
        expect(executed).not.toContain('SYS_RESPONSE_WINDOW_FORCE_CLOSE');
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-response-window-non-pass',
            playerId: '1',
            incidentKind: 'legal-action-recovered',
            reason: 'response-window:legal-action:response-pass:legal-response-pass',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('attack-1');
        expect(snapshot.blockerFingerprint).toContain('response-window-non-pass-1');
        expect(snapshot.trackerKey).toContain('response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-non-pass-1');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('attack-1');
        expect(actionLog.blockerFingerprint).toContain('response-window-non-pass-1');
        expect(actionLog.trackerKey).toContain('response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-non-pass-1');
    });
    it('online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-responder-not-active-player', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
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
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-response-responder-not-active-player');

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, _playerID, commandType) => {
            executed.push(commandType);

            if (commandType === 'RESPONSE_PASS') {
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            }

            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executed[0]).toBe('RESPONSE_PASS');
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-response-responder-not-active-player',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
            reason: 'response-window:recover-interaction:steps=1',
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('attack-1');
        expect(snapshot.blockerFingerprint).toContain('response-window-1');
        expect(snapshot.trackerKey).toContain('response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-1');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('attack-1');
        expect(actionLog.blockerFingerprint).toContain('response-window-1');
        expect(actionLog.trackerKey).toContain('response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-1');
    });
    it('online AI watchdog 在 response-window 同一 sequence 内若进度 marker 回到已见现场，应上报 loop_detected 而不是继续空转', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-window-loop-detected', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-loop-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-loop-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-modify-die:loop-step-1',
                        kind: 'modify-die',
                        label: '循环改骰第 1 步',
                        commands: [{ type: 'MODIFY_DIE', payload: { dieIndex: 0, value: 5 } }],
                    },
                    attemptKey: 'watchdog-response-window-loop-step-1',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'legal-modify-die:loop-step-2',
                        kind: 'modify-die',
                        label: '循环改骰第 2 步',
                        commands: [{ type: 'MODIFY_DIE', payload: { dieIndex: 0, value: 1 } }],
                    },
                    attemptKey: 'watchdog-response-window-loop-step-2',
                    source: 'local-ai',
                },
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiRecoveryFailureReportThreshold: 1,
                onlineAiFeedbackReporter: feedbackReporter,
                onlineAiRecoveryMaxAdvanceSteps: 4,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-response-window-loop-detected');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
                expect(playerID).toBe('1');
                executed.push({ commandType, payload });

                if (executed.length === 1) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: 2,
                            },
                            responseWindow: {
                                ...(activeMatch.state.sys?.responseWindow ?? {}),
                                current: {
                                    ...(activeMatch.state.sys?.responseWindow?.current ?? {}),
                                    id: 'response-window-loop-1',
                                    windowType: 'afterRollConfirmed',
                                    sourceId: 'attack-loop-1',
                                    responderQueue: ['1'],
                                    currentResponderIndex: 0,
                                },
                            },
                        },
                    };
                    return true;
                }

                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: {
                            ...(activeMatch.state.sys?.eventStream ?? {}),
                            nextId: 1,
                        },
                        responseWindow: {
                            ...(activeMatch.state.sys?.responseWindow ?? {}),
                            current: {
                                ...(activeMatch.state.sys?.responseWindow?.current ?? {}),
                                id: 'response-window-loop-1',
                                windowType: 'afterRollConfirmed',
                                sourceId: 'attack-loop-1',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                            },
                        },
                    },
                };
                return true;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalledTimes(2);
            expect(executed.map((item) => item.commandType)).toEqual(['MODIFY_DIE', 'MODIFY_DIE']);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-response-window-loop-detected',
                playerId: '1',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('response-window:recover-interaction:loop_detected'),
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('attack-loop-1');
            expect(snapshot.trackerKey).toContain('response-window-loop-1');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('attack-loop-1');
            expect(actionLog.trackerKey).toContain('response-window-loop-1');
            expect(match.state.sys.responseWindow?.current?.sourceId).toBe('attack-loop-1');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 仍无推进时，应保留 missing_visible_state 而不是吞成 no_progress', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-window-missing-visible-state-no-progress', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-missing-visible-state-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-missing-visible-state-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'missing-visible-state',
            visibility: 'unknown',
            blockedKey: '1:missing-visible-state',
            diagnostics: null,
        });

        try {
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
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            await serverInternal.loadMatch('match-watchdog-response-window-missing-visible-state-no-progress');
            const executed: string[] = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (_match, playerID, commandType) => {
                expect(playerID).toBe('1');
                executed.push(commandType);
                return commandType === 'RESPONSE_PASS';
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(executed).toEqual(['RESPONSE_PASS']);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-response-window-missing-visible-state-no-progress',
                playerId: '1',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('response-window:recover-interaction:missing_visible_state'),
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('missing-visible-state');
            expect(snapshot.blockerFingerprint).toContain('attack-missing-visible-state-1');
            expect(snapshot.trackerKey).toContain('response-window:1:defensiveRoll:afterRollConfirmed:attack-missing-visible-state-1');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('missing-visible-state');
            expect(actionLog.blockerFingerprint).toContain('attack-missing-visible-state-1');
            expect(actionLog.trackerKey).toContain('response-window:1:defensiveRoll:afterRollConfirmed:attack-missing-visible-state-1');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 命令失败时，仍应明确上报 command_failed', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-response-window-missing-visible-state-command-failed', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-missing-visible-state-command-failed-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-missing-visible-state-command-failed-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'missing-visible-state',
            visibility: 'unknown',
            blockedKey: '1:missing-visible-state',
            diagnostics: null,
        });

        try {
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
                runOnlineAiRecoveryTick: () => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            await serverInternal.loadMatch('match-watchdog-response-window-missing-visible-state-command-failed');
            const executed: string[] = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType) => {
                expect(playerID).toBe('1');
                executed.push(commandType);
                activeMatch.lastCommandFailureReason = 'invalid_interaction_response: response window already closed';
                return false;
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(executed).toEqual(['RESPONSE_PASS']);
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-response-window-missing-visible-state-command-failed',
                playerId: '1',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('response-window:recover-interaction:command_failed:RESPONSE_PASS:invalid_interaction_response: response window already closed'),
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('attack-missing-visible-state-command-failed-1');
            expect(snapshot.trackerKey).toContain('response-window:1:defensiveRoll:afterRollConfirmed:attack-missing-visible-state-command-failed-1');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('attack-missing-visible-state-command-failed-1');
            expect(actionLog.trackerKey).toContain('response-window:1:defensiveRoll:afterRollConfirmed:attack-missing-visible-state-command-failed-1');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const metadata = createOnlineAiRecoveryMetadata({
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
                '2': { type: 'local-ai' },
                '3': { type: 'local-ai' },
            },
        });
        metadata.players['2'] = {
            name: 'AI 2',
            credentials: 'cred-2',
            isConnected: false,
        };
        metadata.players['3'] = {
            name: 'AI 3',
            credentials: 'cred-3',
            isConnected: false,
        };

        await storage.createMatch('match-watchdog-hidden-interaction-lock', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main1',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'afterCard-action-poison-tip-1777601347690',
                        windowType: 'afterCardPlayed',
                        sourceId: 'action-poison-tip',
                        responderQueue: ['2', '3'],
                        currentResponderIndex: 1,
                        passedPlayers: ['2'],
                        pendingInteractionId: 'card-bye-bye-1777601349600',
                    },
                },
            }),
            metadata,
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
            stateSynchronizer: {
                applyPlayerView: (match: any, playerID: string) => MatchState<unknown>;
            };
        };

        await serverInternal.loadMatch('match-watchdog-hidden-interaction-lock');

        let hiddenResolved = false;
        vi.spyOn(serverInternal.stateSynchronizer, 'applyPlayerView').mockImplementation((match, playerID) => {
            if (playerID !== '3') {
                return match.state as MatchState<unknown>;
            }
            return {
                ...match.state,
                sys: {
                    ...match.state.sys,
                    interaction: hiddenResolved
                        ? {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        }
                        : {
                            current: {
                                id: 'card-bye-bye-1777601349600',
                                kind: 'simple-choice',
                                playerId: '3',
                                data: {
                                    sourceId: 'card-bye-bye',
                                    title: '选择要移除的状态效果',
                                    options: [
                                        { id: 'skip', label: '跳过', value: { skip: true } },
                                    ],
                                },
                            },
                            queue: [],
                            isBlocked: false,
                        },
                },
            } as MatchState<unknown>;
        });

        const executed: string[] = [];
        vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, playerID, commandType, payload) => {
            executed.push(commandType);

            if (commandType === 'SYS_INTERACTION_RESPOND') {
                expect(playerID).toBe('3');
                expect(payload).toEqual({ interactionId: 'card-bye-bye-1777601349600', optionId: 'skip' });
                hiddenResolved = true;
                match.state = {
                    ...match.state,
                    sys: {
                        ...match.state.sys,
                        eventStream: {
                            ...(match.state.sys?.eventStream ?? {}),
                            nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                        },
                        responseWindow: {
                            ...(match.state.sys?.responseWindow ?? {}),
                            current: undefined,
                        },
                    },
                };
                return true;
            }

            return true;
        });

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executed[0]).toBe('SYS_INTERACTION_RESPOND');
        expect(executed).not.toContain('RESPONSE_PASS');
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-hidden-interaction-lock',
            playerId: '3',
            incidentKind: 'force-end-turn-success',
            status: 'resolved',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            trackerKey?: string;
            blockerFingerprint?: string | null;
            stateSnapshot?: string;
            actionLog?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('card-bye-bye');
        expect(snapshot.blockerFingerprint).toContain('main1');
        expect(snapshot.trackerKey).toBe(payload?.trackerKey);

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('card-bye-bye');
        expect(actionLog.blockerFingerprint).toContain('main1');
        expect(actionLog.trackerKey).toBe(payload?.trackerKey);
    });
});
