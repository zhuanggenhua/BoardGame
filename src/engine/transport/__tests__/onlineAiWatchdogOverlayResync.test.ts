import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import { buildAiProgressMarker } from '../onlineAiRecovery';
import {
    createCompareRollChoice,
    createInteractionSystem,
    createSimpleChoice,
    INTERACTION_COMMANDS,
} from '../../systems/InteractionSystem';
import { createSimpleChoiceSystem } from '../../systems/SimpleChoiceSystem';
import * as aiModule from '../../ai';
import smashUpEngineConfig from '../../../games/smashup/game';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfigWithId,
    createInteractiveEngineConfig,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
    nextTick,
} from './helpers/serverTestHarness';

describe('online AI watchdog overlay resync and strict visible recovery', () => {
    it('online AI watchdog 触发 overlay resync 后应按冷却去重，避免连续广播风暴', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-overlay-resync-cooldown', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-resync-cooldown',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
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
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('smashup')],
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
            onlineAiRecoveryLedger: {
                getOverlayResyncCooldownKeys: () => string[];
                getOverlayResyncCooldownExpiresAt: (cooldownKey: string) => number | undefined;
            };
        };

        await serverInternal.loadMatch('match-watchdog-overlay-resync-cooldown');
        const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
        vi.spyOn(serverInternal, 'executeCommandInternal').mockResolvedValue(true);

            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            // 首次 blocked 触发一次 resync，冷却期内不应重复广播。
            expect(broadcastSpy).toHaveBeenCalledTimes(1);
            expect(serverInternal.onlineAiRecoveryLedger.getOverlayResyncCooldownKeys()).toEqual([
                expect.stringContaining('match-watchdog-overlay-resync-cooldown:1:1:private-required:stale-private-overlay:'),
            ]);
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 blockedKey 相同但 progressMarker 漂移时，应允许再次触发 overlay resync，而不是被旧冷却一并吞掉', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-overlay-resync-progress-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-resync-progress-drift',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
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
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            maybeTriggerOnlineAiOverlayResync: (args: {
                match: any;
                playerId: string;
                blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
                blockedKey: string;
                progressMarker: string;
            }) => void;
            onlineAiRecoveryLedger: {
                getOverlayResyncCooldownKeys: () => string[];
                getOverlayResyncCooldownExpiresAt: (cooldownKey: string) => number | undefined;
            };
        };

        const match = await serverInternal.loadMatch('match-watchdog-overlay-resync-progress-drift');
        const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
        const blockedKey = '1:private-required:stale-private-overlay';
        const firstMarker = buildAiProgressMarker(match.state);

        serverInternal.maybeTriggerOnlineAiOverlayResync({
            match,
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            blockedKey,
            progressMarker: firstMarker,
        });
        serverInternal.maybeTriggerOnlineAiOverlayResync({
            match,
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            blockedKey,
            progressMarker: firstMarker,
        });

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                eventStream: {
                    ...(match.state.sys?.eventStream ?? {}),
                    nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                },
            },
        };
        const driftedMarker = buildAiProgressMarker(match.state);

        serverInternal.maybeTriggerOnlineAiOverlayResync({
            match,
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            blockedKey,
            progressMarker: driftedMarker,
        });

        expect(broadcastSpy).toHaveBeenCalledTimes(2);
        expect(serverInternal.onlineAiRecoveryLedger.getOverlayResyncCooldownKeys()).toEqual([
            expect.stringContaining(`match-watchdog-overlay-resync-progress-drift:1:${blockedKey}:${firstMarker}`),
            expect.stringContaining(`match-watchdog-overlay-resync-progress-drift:1:${blockedKey}:${driftedMarker}`),
        ]);
    });
    it('online AI watchdog 在 blockedKey 与 progressMarker 都不变时，冷却过期后仍应允许再次触发 overlay resync', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-overlay-resync-expired-cooldown', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-resync-expired-cooldown',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
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
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            maybeTriggerOnlineAiOverlayResync: (args: {
                match: any;
                playerId: string;
                blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
                blockedKey: string;
                progressMarker: string;
            }) => void;
            onlineAiRecoveryLedger: {
                getOverlayResyncCooldownKeys: () => string[];
                getOverlayResyncCooldownExpiresAt: (cooldownKey: string) => number | undefined;
            };
        };

        const match = await serverInternal.loadMatch('match-watchdog-overlay-resync-expired-cooldown');
        const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
        const dateNowSpy = vi.spyOn(Date, 'now');
        const blockedKey = '1:private-required:stale-private-overlay';
        const progressMarker = buildAiProgressMarker(match.state);
        const cooldownKey = `match-watchdog-overlay-resync-expired-cooldown:1:${blockedKey}:${progressMarker}`;

        try {
            dateNowSpy.mockReturnValueOnce(1_000);
            serverInternal.maybeTriggerOnlineAiOverlayResync({
                match,
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                blockedKey,
                progressMarker,
            });

            dateNowSpy.mockReturnValueOnce(2_000);
            serverInternal.maybeTriggerOnlineAiOverlayResync({
                match,
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                blockedKey,
                progressMarker,
            });

            dateNowSpy.mockReturnValueOnce(2_600);
            serverInternal.maybeTriggerOnlineAiOverlayResync({
                match,
                playerId: '1',
                blockedReason: 'stale-private-overlay',
                blockedKey,
                progressMarker,
            });
        } finally {
            dateNowSpy.mockRestore();
        }

        expect(broadcastSpy).toHaveBeenCalledTimes(2);
        expect(serverInternal.onlineAiRecoveryLedger.getOverlayResyncCooldownKeys()).toEqual([cooldownKey]);
        expect(serverInternal.onlineAiRecoveryLedger.getOverlayResyncCooldownExpiresAt(cooldownKey)).toBe(4_100);
    });
    it('online AI watchdog 在 progressMarker 相同但 blockedKey 漂移时，应允许再次触发 overlay resync，而不是被旧冷却一并吞掉', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-overlay-resync-blocked-key-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'playCards',
                interaction: {
                    current: createSimpleChoice(
                        'smashup-extra-action-choice-resync-blocked-key-drift',
                        '1',
                        '立刻打出一张额外战术，或放弃这次机会',
                        [
                            {
                                id: 'card-0',
                                label: '额外战术 A',
                                value: { cardUid: 'hand-1', defId: 'test_action' },
                            },
                            {
                                id: 'skip',
                                label: '放弃这次额外战术',
                                value: { skip: true },
                            },
                        ],
                        {
                            sourceId: 'smashup_immediate_extra_action',
                            targetType: 'hand',
                        },
                    ),
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
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            maybeTriggerOnlineAiOverlayResync: (args: {
                match: any;
                playerId: string;
                blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
                blockedKey: string;
                progressMarker: string;
            }) => void;
            onlineAiRecoveryLedger: {
                getOverlayResyncCooldownKeys: () => string[];
                getOverlayResyncCooldownExpiresAt: (cooldownKey: string) => number | undefined;
            };
        };

        const match = await serverInternal.loadMatch('match-watchdog-overlay-resync-blocked-key-drift');
        const broadcastSpy = vi.spyOn((serverInternal as any).stateSynchronizer, 'broadcast');
        const progressMarker = buildAiProgressMarker(match.state);

        serverInternal.maybeTriggerOnlineAiOverlayResync({
            match,
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            blockedKey: '1:private-required:stale-private-overlay',
            progressMarker,
        });
        serverInternal.maybeTriggerOnlineAiOverlayResync({
            match,
            playerId: '1',
            blockedReason: 'missing-private-overlay',
            blockedKey: '1:private-required:missing-private-overlay',
            progressMarker,
        });

        expect(broadcastSpy).toHaveBeenCalledTimes(2);
        expect(serverInternal.onlineAiRecoveryLedger.getOverlayResyncCooldownKeys()).toEqual([
            expect.stringContaining(`match-watchdog-overlay-resync-blocked-key-drift:1:1:private-required:stale-private-overlay:${progressMarker}`),
            expect.stringContaining(`match-watchdog-overlay-resync-blocked-key-drift:1:1:private-required:missing-private-overlay:${progressMarker}`),
        ]);
    });
    it('online AI watchdog 应优先执行 AI 合法动作来解除可见交互阻塞，而不是直接 force-end-turn', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-interaction-action', {
            initialState: createOnlineAiRecoveryState({
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-1',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'pass',
                                label: 'Pass',
                                value: { kind: 'pass' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                action: {
                    actionId: 'interaction:reaction-choice-1:pass',
                    kind: 'interaction-choice',
                    label: 'Pass',
                    commands: [{
                        type: INTERACTION_COMMANDS.RESPOND,
                        payload: { interactionId: 'reaction-choice-1', optionId: 'pass' },
                    }],
                },
                attemptKey: 'watchdog-ai-action',
                source: 'local-ai',
            },
        });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createInteractiveEngineConfig()],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiRecoveryFailureReportThreshold: 1,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoveryTick: () => Promise<void>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-action');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolutionSpy).toHaveBeenCalled();
            expect(match.state.sys.interaction?.current).toBeUndefined();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-visible-interaction-action',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 AI owner 的 compare-roll 可见交互时，应通过 strict visibleStateResolver 直接恢复，不得误走 emergency playerView', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-ai-owner-compare-roll-strict-view', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: createCompareRollChoice(
                        'compare-roll-ai-owner-1',
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

        const resolverKinds: Array<'strict' | 'emergency'> = [];
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockImplementation(async (dispatchArgs) => {
                const resolved = dispatchArgs.visibleStateResolver?.('1');
                const isStrictResolved = Boolean(
                    resolved
                    && typeof resolved === 'object'
                    && 'kind' in resolved
                    && resolved.kind === 'online-ai-decision-view',
                );
                resolverKinds.push(isStrictResolved ? 'strict' : 'emergency');

                if (!isStrictResolved) {
                    return {
                        kind: 'idle',
                        idleReason: 'compare-roll-emergency-view-unexpected',
                    };
                }

                if (resolverKinds.length === 1) {
                    expect(resolved).toMatchObject({
                        kind: 'online-ai-decision-view',
                        visibility: 'shared',
                        canDecide: true,
                        blockedReason: null,
                    });
                    const visibleState = resolved.visibleState as MatchState<unknown>;
                    expect(visibleState.sys?.interaction?.current).toMatchObject({
                        id: 'compare-roll-ai-owner-1',
                        kind: 'compare-roll-choice',
                        playerId: '1',
                    });
                    expect(visibleState.sys?.interaction?.isBlocked).toBe(false);

                    return {
                        kind: 'action',
                        resolution: {
                            playerId: '1',
                            action: {
                                actionId: 'interaction:compare-roll-ai-owner-1:confirm',
                                kind: 'interaction-choice',
                                label: '确认比较结果',
                                commands: [{
                                    type: INTERACTION_COMMANDS.CONFIRM,
                                    payload: { interactionId: 'compare-roll-ai-owner-1' },
                                }],
                            },
                            attemptKey: 'watchdog-compare-roll-strict-visible-state',
                            source: 'local-ai',
                        },
                    };
                }

                return {
                    kind: 'idle',
                    idleReason: 'compare-roll-already-resolved',
                };
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('dicethrone')],
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

            const match = await serverInternal.loadMatch('match-watchdog-ai-owner-compare-roll-strict-view');
            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });

                if (commandType === INTERACTION_COMMANDS.CONFIRM) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(activeMatch.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                throw new Error(`Unexpected command: ${commandType}`);
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolverKinds).not.toContain('emergency');
            expect(executed.map((item) => item.commandType)).toEqual([INTERACTION_COMMANDS.CONFIRM]);
            expect(match.state.sys.interaction?.current).toBeUndefined();

            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolverKinds).not.toContain('emergency');
            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
            expect(executed.map((item) => item.commandType)).toEqual([INTERACTION_COMMANDS.CONFIRM]);
            expect(match.state.sys.interaction?.current).toBeUndefined();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-ai-owner-compare-roll-strict-view',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 的 compare-roll strict resolver 应忽略 stale lastBroadcastedViews baseline，直接取 fresh applyPlayerView snapshot', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-ai-owner-compare-roll-fresh-seat-view-over-cache', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: createCompareRollChoice(
                        'compare-roll-live-1',
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

        const observedInteractionIds: Array<string | null> = [];
        const observedEventStreamNextIds: Array<number | null> = [];
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch')
            .mockImplementationOnce(async (dispatchArgs) => {
                const resolved = dispatchArgs.visibleStateResolver?.('1');
                expect(resolved).toMatchObject({
                    kind: 'online-ai-decision-view',
                    visibility: 'shared',
                    canDecide: true,
                    blockedReason: null,
                });
                if (!resolved || typeof resolved !== 'object' || !('visibleState' in resolved)) {
                    throw new Error('expected resolved online ai decision view');
                }
                const visibleState = resolved.visibleState as MatchState<unknown>;
                observedInteractionIds.push(
                    typeof visibleState.sys?.interaction?.current?.id === 'string'
                        ? visibleState.sys.interaction.current.id
                        : null,
                );
                observedEventStreamNextIds.push(
                    typeof visibleState.sys?.eventStream?.nextId === 'number'
                        ? visibleState.sys.eventStream.nextId
                        : null,
                );
                expect(visibleState.sys?.eventStream?.nextId).toBe(1);
                expect(visibleState.sys?.interaction?.current).toMatchObject({
                    id: 'compare-roll-live-1',
                    kind: 'compare-roll-choice',
                    playerId: '1',
                });

                return {
                    kind: 'action',
                    resolution: {
                        playerId: '1',
                        action: {
                            actionId: 'interaction:compare-roll-live-1:confirm',
                            kind: 'interaction-choice',
                            label: '确认比较结果',
                            commands: [{
                                type: INTERACTION_COMMANDS.CONFIRM,
                                payload: { interactionId: 'compare-roll-live-1' },
                            }],
                        },
                        attemptKey: 'watchdog-compare-roll-fresh-seat-view-over-cache',
                        source: 'local-ai',
                    },
                };
            })
            .mockImplementation(async (dispatchArgs) => {
                const resolved = dispatchArgs.visibleStateResolver?.('1');
                if (resolved && typeof resolved === 'object' && 'visibleState' in resolved) {
                    const visibleState = resolved.visibleState as MatchState<unknown>;
                    observedInteractionIds.push(
                        typeof visibleState.sys?.interaction?.current?.id === 'string'
                            ? visibleState.sys.interaction.current.id
                            : null,
                    );
                    observedEventStreamNextIds.push(
                        typeof visibleState.sys?.eventStream?.nextId === 'number'
                            ? visibleState.sys.eventStream.nextId
                            : null,
                    );
                }
                return {
                    kind: 'idle',
                    idleReason: 'compare-roll-already-resolved',
                };
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [createEngineConfigWithId('dicethrone')],
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

            const match = await serverInternal.loadMatch('match-watchdog-ai-owner-compare-roll-fresh-seat-view-over-cache');
            match.lastBroadcastedViews.set('1', {
                core: {
                    activePlayerId: '1',
                    currentPlayerIndex: 1,
                },
                sys: {
                    phase: 'defensiveRoll',
                    turnNumber: 9,
                    eventStream: { nextId: 999 },
                    interaction: {
                        current: {
                            id: 'compare-roll-stale-cache',
                            kind: 'compare-roll-choice',
                            playerId: '1',
                        },
                        queue: [],
                        isBlocked: false,
                    },
                },
            });

            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });

                if (commandType === INTERACTION_COMMANDS.CONFIRM) {
                    activeMatch.state = {
                        ...activeMatch.state,
                        core: {
                            ...activeMatch.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: {
                                ...(activeMatch.state.sys?.eventStream ?? {}),
                                nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(activeMatch.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }

                throw new Error(`Unexpected command: ${commandType}`);
            });

            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();

            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
            expect(observedInteractionIds[0]).toBe('compare-roll-live-1');
            expect(observedEventStreamNextIds[0]).toBe(1);
            expect(observedInteractionIds).not.toContain('compare-roll-stale-cache');
            expect(observedEventStreamNextIds).not.toContain(999);
            expect(executed.map((item) => item.commandType)).toEqual([INTERACTION_COMMANDS.CONFIRM]);
            expect(match.state.sys.interaction?.current).toBeUndefined();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-ai-owner-compare-roll-fresh-seat-view-over-cache',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls.at(-1)?.[0] as {
                trackerKey?: string;
                stateSnapshot?: string;
                actionLog?: string;
            } | undefined;
            expect(payload?.trackerKey).toContain('compare-roll-live-1');
            expect(payload?.trackerKey).not.toContain('compare-roll-stale-cache');

            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}') as {
                blockerFingerprint?: string | null;
                trackerKey?: string;
            };
            expect(snapshot.blockerFingerprint).toContain('compare-roll-live-1');
            expect(snapshot.blockerFingerprint).not.toContain('compare-roll-stale-cache');
            expect(snapshot.trackerKey).toBe(payload?.trackerKey);

            const actionLog = JSON.parse(payload?.actionLog ?? '{}') as {
                blockerFingerprint?: string | null;
                trackerKey?: string;
            };
            expect(actionLog.blockerFingerprint).toContain('compare-roll-live-1');
            expect(actionLog.blockerFingerprint).not.toContain('compare-roll-stale-cache');
            expect(actionLog.trackerKey).toBe(payload?.trackerKey);
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('watchdog falls back to first trigger respond for smashup mandatory reaction ordering', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-interaction-mandatory-order-fallback', {
            initialState: createOnlineAiRecoveryState({
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-mandatory-order',
                        '1',
                        '??????????',
                        [
                            {
                                id: 'trigger-base-arena',
                                label: '???',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:base_arena:1777092533686:0' },
                            },
                            {
                                id: 'trigger-wizard-archmage',
                                label: '???',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:wizard_archmage:1777092533686:0' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            visibility: 'private-required',
            blockedKey: '1:private-required:stale-private-overlay',
            diagnostics: null,
        } as any);

        try {
            const interactiveConfig = createInteractiveEngineConfig();
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [{
                    ...interactiveConfig,
                    gameId: 'smashup',
                    domain: {
                        ...interactiveConfig.domain,
                        gameId: 'smashup',
                    },
                    onlineAiRecovery: smashUpEngineConfig.onlineAiRecovery,
                }],
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

            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, _playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    match.state = {
                        ...match.state,
                        sys: {
                            ...match.state.sys,
                            eventStream: {
                                ...(match.state.sys?.eventStream ?? {}),
                                nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(match.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                        },
                    };
                }
                return true;
            });

            const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-mandatory-order-fallback');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executed[0]).toEqual({
                commandType: INTERACTION_COMMANDS.RESPOND,
                payload: { interactionId: 'reaction-choice-mandatory-order', optionId: 'trigger-base-arena' },
            });
            expect(match.state.sys.interaction?.current).toBeUndefined();
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('watchdog falls back to first trigger respond for smashup onTurnEnd mandatory reaction ordering', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-interaction-turn-end-mandatory-order-fallback', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '3',
                        currentPlayerIndex: 3,
                        turnOrder: ['0', '1', '2', '3'],
                    },
                    sys: {
                        phase: 'endTurn',
                        turnNumber: 9,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: createSimpleChoice(
                                'smashup_reaction_turn-end:3:2:0_3_0',
                                '3',
                                '选择一个反应动作',
                                [
                                    {
                                        id: 'trigger:onTurnEnd:steampunk_difference_engine:0:0',
                                        label: '差分机',
                                        value: { kind: 'trigger', triggerId: 'onTurnEnd:steampunk_difference_engine:0:0' },
                                    },
                                    {
                                        id: 'trigger:onTurnEnd:tricksters_big_funny_giant:0:1',
                                        label: '滑稽巨人',
                                        value: { kind: 'trigger', triggerId: 'onTurnEnd:tricksters_big_funny_giant:0:1' },
                                    },
                                ],
                                {
                                    sourceId: 'smashup_reaction_choose',
                                    targetType: 'button',
                                },
                            ),
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
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'smashup',
                seatControllers: {
                    '0': { type: 'local-ai' },
                    '1': { type: 'local-ai' },
                    '2': { type: 'local-ai' },
                    '3': { type: 'local-ai' },
                },
            }),
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

            const executed: Array<{ commandType: string; payload: unknown }> = [];
            vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (match, playerID, commandType, payload) => {
                executed.push({ commandType, payload });
                expect(playerID).toBe('3');
                if (commandType === INTERACTION_COMMANDS.RESPOND) {
                    expect(payload).toEqual({
                        interactionId: 'smashup_reaction_turn-end:3:2:0_3_0',
                        optionId: 'trigger:onTurnEnd:steampunk_difference_engine:0:0',
                    });
                    match.state = {
                        ...match.state,
                        core: {
                            ...match.state.core,
                            activePlayerId: '3',
                            currentPlayerIndex: 3,
                        },
                        sys: {
                            ...match.state.sys,
                            eventStream: {
                                ...(match.state.sys?.eventStream ?? {}),
                                nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(match.state.sys?.interaction ?? {}),
                                current: undefined,
                            },
                            responseWindow: {
                                ...(match.state.sys?.responseWindow ?? {}),
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }
                if (commandType === 'ADVANCE_PHASE') {
                    match.state = {
                        ...match.state,
                        core: {
                            ...match.state.core,
                            activePlayerId: '0',
                            currentPlayerIndex: 0,
                        },
                        sys: {
                            ...match.state.sys,
                            phase: 'startTurn',
                            eventStream: {
                                ...(match.state.sys?.eventStream ?? {}),
                                nextId: (match.state.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: {
                                ...(match.state.sys?.interaction ?? {}),
                                current: undefined,
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

            const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-turn-end-mandatory-order-fallback');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executed).toEqual([
                {
                    commandType: INTERACTION_COMMANDS.RESPOND,
                    payload: {
                        interactionId: 'smashup_reaction_turn-end:3:2:0_3_0',
                        optionId: 'trigger:onTurnEnd:steampunk_difference_engine:0:0',
                    },
                },
                {
                    commandType: 'ADVANCE_PHASE',
                    payload: {},
                },
            ]);
            expect(match.state.sys.phase).toBe('startTurn');
            expect(match.state.sys.interaction?.current).toBeUndefined();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-visible-interaction-turn-end-mandatory-order-fallback',
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
            expect(snapshot.blockerFingerprint).toContain('smashup_reaction_choose');
            expect(snapshot.trackerKey).toBe(payload?.trackerKey);

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('smashup_reaction_choose');
            expect(actionLog.trackerKey).toBe(payload?.trackerKey);
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 处理 live 校验交互时，应沿用原始 interactionData 快照，避免下游把 blocker 重新挂回', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'test-watchdog-live-interaction-snapshot';

        const makeSnapshotSensitiveInteraction = () => createSimpleChoice(
            'snapshot-sensitive-choice',
            '1',
            '选择一张卡牌',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
                { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
            ],
            {
                sourceId: 'test-live-snapshot',
                targetType: 'button',
                autoRefresh: 'hand',
                responseValidationMode: 'live',
            },
        );

        const expectedOptionIds = ['opt-1', 'opt-2', 'pass'];
        const snapshotSensitiveSystem = {
            id: 'snapshot-sensitive-followup',
            name: 'SnapshotSensitiveFollowUp',
            priority: 40,
            afterEvents: ({ state, events }: { state: any; events: any[] }) => {
                let newState = state;

                for (const event of events) {
                    if (event.type !== 'SYS_INTERACTION_RESOLVED') {
                        continue;
                    }

                    const payload = event.payload as {
                        sourceId?: string;
                        interactionData?: {
                            options?: Array<{ id?: string }>;
                        };
                    };
                    if (payload.sourceId !== 'test-live-snapshot') {
                        continue;
                    }

                    const optionIds = Array.isArray(payload.interactionData?.options)
                        ? payload.interactionData.options
                            .map((option) => option?.id)
                            .filter((id): id is string => typeof id === 'string')
                        : [];
                    const snapshotPreserved = JSON.stringify(optionIds) === JSON.stringify(expectedOptionIds);

                    newState = {
                        ...newState,
                        core: {
                            ...newState.core,
                            activePlayerId: snapshotPreserved ? '0' : '1',
                            currentPlayerIndex: snapshotPreserved ? 0 : 1,
                        },
                        sys: {
                            ...newState.sys,
                            phase: snapshotPreserved ? 'draw' : 'scoreBases',
                            eventStream: {
                                ...(newState.sys?.eventStream ?? {}),
                                nextId: (newState.sys?.eventStream?.nextId ?? 1) + 1,
                            },
                            interaction: snapshotPreserved
                                ? {
                                    ...(newState.sys?.interaction ?? {}),
                                    current: undefined,
                                    queue: [],
                                    isBlocked: false,
                                }
                                : {
                                    ...(newState.sys?.interaction ?? {}),
                                    current: makeSnapshotSensitiveInteraction(),
                                    queue: [],
                                    isBlocked: false,
                                },
                        },
                    };
                }

                return { halt: false, state: newState, events: [] };
            },
        } as any;

        await storage.createMatch('match-watchdog-live-interaction-snapshot', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hand: [] },
                            '1': {
                                hand: [{ uid: 'card-1', defId: 'test-card-1' }],
                            },
                        },
                    },
                    sys: {
                        phase: 'scoreBases',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: makeSnapshotSensitiveInteraction(),
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
            metadata: createOnlineAiRecoveryMetadata({ gameName: gameId }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...createInteractiveEngineConfig(),
                gameId,
                domain: {
                    ...createInteractiveEngineConfig().domain,
                    gameId,
                },
                systems: [
                    createInteractionSystem(),
                    createSimpleChoiceSystem(),
                    snapshotSensitiveSystem,
                ],
            }],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-live-interaction-snapshot');
        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        for (let i = 0; i < 10; i++) { await nextTick(); }
        await nextTick();

        expect(match.state.core.activePlayerId).toBe('0');
        expect(match.state.sys.phase).toBe('draw');
        expect(match.state.sys.interaction?.current).toBeUndefined();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-live-interaction-snapshot',
            incidentKind: 'force-end-turn-success',
            reason: 'visible-interaction:recover-interaction:steps=1',
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-live-interaction-snapshot',
            incidentKind: 'force-end-turn-failed',
        }));
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.blockerFingerprint).toContain('test-live-snapshot');
        expect(snapshot.trackerKey).toContain('visible-interaction:interaction:1:scoreBases:simple-choice:test-live-snapshot');

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog.blockerFingerprint).toContain('test-live-snapshot');
        expect(actionLog.trackerKey).toContain('visible-interaction:interaction:1:scoreBases:simple-choice:test-live-snapshot');
    });
});
