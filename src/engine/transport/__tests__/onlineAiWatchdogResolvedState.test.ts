import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import { createSimpleChoice } from '../../systems/InteractionSystem';
import * as aiModule from '../../ai';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfig,
    createEngineConfigWithId,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
} from './helpers/serverTestHarness';

describe('online AI watchdog resolved state', () => {
    it('online AI watchdog 的 hidden-interaction resolved 判定应忽略 stale lastBroadcastedViews baseline，直接跟随 fresh applyPlayerView snapshot', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-hidden-interaction-fresh-seat-view-over-cache', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main1',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
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
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
            stateSynchronizer: {
                applyPlayerView: (match: any, playerID: string) => MatchState<unknown>;
            };
        };

        const match = await serverInternal.loadMatch('match-watchdog-hidden-interaction-fresh-seat-view-over-cache');
        match.lastBroadcastedViews.set('1', {
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { nextId: 999 },
            },
        });

        const candidate = {
            playerId: '1',
            reason: 'hidden-interaction',
            requiresConfirmedAdvancePhase: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:hidden-interaction:owner-only-secret',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:hidden-interaction:owner-only-secret',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };

        let hiddenStillPresent = true;
        vi.spyOn(serverInternal.stateSynchronizer, 'applyPlayerView').mockImplementation((activeMatch, playerID) => {
            if (playerID !== '1') {
                return activeMatch.state as MatchState<unknown>;
            }
            return {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    interaction: hiddenStillPresent
                        ? {
                            current: createSimpleChoice(
                                'owner-only-secret',
                                '1',
                                '选择要处理的秘密目标',
                                [
                                    { id: 'skip', label: '跳过', value: { skip: true } },
                                ],
                                { sourceId: 'super_spies_secret_agent_discard', targetType: 'hand' },
                            ),
                            queue: [],
                            isBlocked: false,
                        }
                        : {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                },
            } as MatchState<unknown>;
        });

        const unresolved = await serverInternal.hasOnlineAiRecoveryResolved(
            match,
            candidate,
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );
        hiddenStillPresent = false;
        const resolved = await serverInternal.hasOnlineAiRecoveryResolved(
            match,
            candidate,
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(unresolved).toBe(false);
        expect(resolved).toBe(true);
    });
    it('resolveOnlineAiRecoveryCandidate 在 seat-legal-only 遇到 stale-private-overlay 时，不应把 candidate 提前吞成 null', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const gameId = 'test-watchdog-seat-legal-only-stale-private-overlay-candidate';

        await storage.createMatch('match-watchdog-seat-legal-only-stale-private-overlay-candidate', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                currentPlayerIndex: 0,
                turnOrder: ['0', '1'],
                phase: 'defensiveRoll',
                turnNumber: 4,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'stale-private-overlay',
            visibility: 'private-required',
            blockedKey: '1:private-required:stale-private-overlay',
            diagnostics: {
                sharedPhase: 'defensiveRoll',
                privatePhase: 'defensiveRoll',
                sharedTurnNumber: 4,
                privateTurnNumber: 4,
                sharedCurrentPlayerId: '0',
                privateCurrentPlayerId: '0',
            },
        } as any);

        try {
            const engineConfig = createEngineConfigWithId(gameId);
            engineConfig.onlineAiRecovery = {
                ...engineConfig.onlineAiRecovery,
                humanTurnLegalActionProbePhases: ['defensiveRoll'],
            };
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [engineConfig],
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

            const match = await serverInternal.loadMatch('match-watchdog-seat-legal-only-stale-private-overlay-candidate');
            const candidate = await serverInternal.resolveOnlineAiRecoveryCandidate(match, {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            });

            expect(candidate).not.toBeNull();
            expect(candidate?.reason).toBe('seat-legal-only');
            expect(candidate?.playerId).toBe('1');
            expect(candidate?.legalActionOnly).toBe(true);
            expect(candidate?.fingerprintHint).toContain('stale-private-overlay');
            expect(candidate?.fingerprintHint).toContain('1:private-required:stale-private-overlay');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('resolveOnlineAiRecoveryCandidate 在 seat-legal-only 遇到 missing-private-overlay 时，不应把 candidate 提前吞成 null', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const gameId = 'test-watchdog-seat-legal-only-missing-private-overlay-candidate';

        await storage.createMatch('match-watchdog-seat-legal-only-missing-private-overlay-candidate', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                currentPlayerIndex: 0,
                turnOrder: ['0', '1'],
                phase: 'defensiveRoll',
                turnNumber: 4,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'blocked',
            playerId: '1',
            blockedReason: 'missing-private-overlay',
            visibility: 'private-required',
            blockedKey: '1:private-required:missing-private-overlay',
            diagnostics: {
                sharedPhase: 'defensiveRoll',
                privatePhase: 'defensiveRoll',
                sharedTurnNumber: 4,
                privateTurnNumber: 4,
                sharedCurrentPlayerId: '0',
                privateCurrentPlayerId: '0',
            },
        } as any);

        try {
            const engineConfig = createEngineConfigWithId(gameId);
            engineConfig.onlineAiRecovery = {
                ...engineConfig.onlineAiRecovery,
                humanTurnLegalActionProbePhases: ['defensiveRoll'],
            };
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [engineConfig],
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

            const match = await serverInternal.loadMatch('match-watchdog-seat-legal-only-missing-private-overlay-candidate');
            const candidate = await serverInternal.resolveOnlineAiRecoveryCandidate(match, {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            });

            expect(candidate).not.toBeNull();
            expect(candidate?.reason).toBe('seat-legal-only');
            expect(candidate?.playerId).toBe('1');
            expect(candidate?.legalActionOnly).toBe(true);
            expect(candidate?.fingerprintHint).toContain('missing-private-overlay');
            expect(candidate?.fingerprintHint).toContain('1:private-required:missing-private-overlay');
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 的 visible-interaction resolved 判定在 live prompt 已切到新 fingerprint 时，应视为旧 incident 已 resolved', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-visible-interaction-resolve-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main1',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-new',
                        '1',
                        '选择新的目标',
                        [
                            { id: 'choose-new', label: '新目标', value: { targetId: 'target-new' } },
                        ],
                        { sourceId: 'visible-source-new' },
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
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-resolve-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            fingerprintHint: 'interaction:1:main1:simple-choice:visible-source-old:选择旧目标:1::choose-old:0:{"targetId":"target-old"}',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:main1:simple-choice:visible-source-old:选择旧目标:1::choose-old:0:{"targetId":"target-old"}',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:main1:simple-choice:visible-source-old:选择旧目标:1::choose-old:0:{"targetId":"target-old"}',
                    kind: 'respond',
                    label: '服务端代 AI 交互响应',
                    commands: [],
                },
            },
        };

        const resolved = await serverInternal.hasOnlineAiRecoveryResolved(match, candidate, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(resolved).toBe(true);
    });
    it('online AI watchdog 的 hidden-interaction resolved 判定在 live prompt 已切到新 fingerprint 时，应视为旧 incident 已 resolved', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-hidden-interaction-resolve-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'main1',
                interaction: {
                    current: undefined,
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
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-hidden-interaction-resolve-fingerprint-drift');
        const originalApplyPlayerView = (server as any).stateSynchronizer.applyPlayerView.bind(
            (server as any).stateSynchronizer,
        );
        vi.spyOn((server as any).stateSynchronizer, 'applyPlayerView').mockImplementation((activeMatch: any, playerID: string) => {
            if (playerID !== '1') {
                return originalApplyPlayerView(activeMatch, playerID);
            }
            return {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    interaction: {
                        current: createSimpleChoice(
                            'owner-only-secret-new',
                            '1',
                            '选择新的秘密目标',
                            [
                                { id: 'choose-secret-new', label: '新秘密目标', value: { targetId: 'secret-new' } },
                            ],
                            { sourceId: 'secret-source-new', targetType: 'hand' },
                        ),
                        queue: [],
                        isBlocked: false,
                    },
                },
            } as MatchState<unknown>;
        });

        const candidate = {
            playerId: '1',
            reason: 'hidden-interaction',
            fingerprintHint: 'interaction:1:main1:simple-choice:secret-source-old:选择旧的秘密目标:1::choose-secret-old:0:{"targetId":"secret-old"}',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:interaction:1:main1:simple-choice:secret-source-old:选择旧的秘密目标:1::choose-secret-old:0:{"targetId":"secret-old"}',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:interaction:1:main1:simple-choice:secret-source-old:选择旧的秘密目标:1::choose-secret-old:0:{"targetId":"secret-old"}',
                    kind: 'respond',
                    label: '服务端代 AI 私有交互响应',
                    commands: [],
                },
            },
        };

        const resolved = await serverInternal.hasOnlineAiRecoveryResolved(match, candidate, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(resolved).toBe(true);
    });
    it('online AI watchdog 的 active-turn resolved 判定在同一 AI 仍处于 active-turn 时，不应提前判定为 resolved', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-active-turn-resolve-same-surface', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main2',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
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
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-active-turn-resolve-same-surface');
        const candidate = {
            playerId: '1',
            reason: 'active-turn',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn:resolve-same-surface',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn:resolve-same-surface',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };

        const resolved = await serverInternal.hasOnlineAiRecoveryResolved(match, candidate, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(resolved).toBe(false);
    });
    it('online AI watchdog 的 active-turn-legal-only resolved 判定在同一 AI 仍处于同一 legal-only surface 时，不应提前判定为 resolved', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-active-turn-legal-only-resolve-same-surface', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
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
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-active-turn-legal-only-resolve-same-surface');
        const candidate = {
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:defensiveRoll',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:defensiveRoll',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:defensiveRoll',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };

        const resolved = await serverInternal.hasOnlineAiRecoveryResolved(match, candidate, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(resolved).toBe(false);
    });
    it('online AI watchdog 的 active-turn-legal-only resolved 判定在同一 AI 已切到新的 legal-only phase 时，应视为旧 incident 已 resolved', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-active-turn-legal-only-resolve-new-phase', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
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
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-active-turn-legal-only-resolve-new-phase');
        const candidate = {
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'active-turn-legal-only:1:defensiveRoll',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:defensiveRoll',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:defensiveRoll',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                phase: 'targetingRoll',
            },
        };

        const resolved = await serverInternal.hasOnlineAiRecoveryResolved(match, candidate, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(resolved).toBe(true);
    });
    it('online AI watchdog 的 legalActionOnly resolved 判定在 live candidate 仍是同一 AI 的 active-turn 时，不应仅因缺少 legalActionOnly 标记就提前判定为 resolved', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-active-turn-legal-only-resolve-same-active-turn', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'main2',
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
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
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-active-turn-legal-only-resolve-same-active-turn');
        const candidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn:legal-only',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn:legal-only',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };

        const unresolved = await serverInternal.hasOnlineAiRecoveryResolved(match, candidate, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(unresolved).toBe(false);
    });
    it('online AI watchdog 的 seat-legal-only resolved 判定在同一 AI 仍处于 response-window 时，不应提前判定为 resolved', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-seat-legal-only-resolve-response-window', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'seat-legal-only-response-window-1',
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
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-seat-legal-only-resolve-response-window');
        const candidate = {
            playerId: '1',
            reason: 'seat-legal-only',
            legalActionOnly: true,
            fingerprintHint: 'seat-legal-only:1:defensiveRoll:modify-die',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:seat-legal-only:1:defensiveRoll:modify-die',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:seat-legal-only:1:defensiveRoll:modify-die',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 执行合法动作',
                    commands: [],
                },
            },
        };

        const unresolved = await serverInternal.hasOnlineAiRecoveryResolved(match, candidate, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(unresolved).toBe(false);
    });
    it('online AI watchdog 的 display-only-bonus resolved 判定在同一 orphan settlement 仍存在时，不应提前判定为 resolved', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-display-only-bonus-resolve-same-settlement', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hp: 28, maxHp: 50, combatPoints: 3, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                            '1': { hp: 29, maxHp: 50, combatPoints: 2, statusEffects: {}, tokens: { loaded: 1 }, hand: [], deck: [], discardPile: [] },
                        },
                        selectedCharacters: {
                            '0': 'shadow_thief',
                            '1': 'gunslinger',
                        },
                        pendingAttack: undefined,
                        pendingBonusDiceSettlement: {
                            id: 'display-only-bonus-resolve-1',
                            sourceAbilityId: 'bounty-hunter',
                            attackerId: '1',
                            targetId: '0',
                            dice: [{
                                index: 0,
                                value: 6,
                                face: 'bullseye',
                                effectKey: 'bonusDie.effect.gunslingerLoadedDie',
                                effectParams: {
                                    value: 6,
                                    index: 0,
                                    bonusDamage: 3,
                                },
                            }],
                            rerollCostTokenId: '',
                            rerollCostAmount: 0,
                            rerollCount: 0,
                            maxRerollCount: 0,
                            readyToSettle: false,
                            displayOnly: true,
                        },
                    },
                    sys: {
                        phase: 'main1',
                        turnNumber: 9,
                        eventStream: { nextId: 18 },
                        interaction: {
                            current: undefined,
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
                gameName: 'dicethrone',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-display-only-bonus-resolve-same-settlement');
        const candidate = {
            playerId: '1',
            reason: 'seat-legal-only',
            fingerprintHint: 'display-only-bonus:1:main1:display-only-bonus-resolve-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:display-only-bonus:display-only-bonus-resolve-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:display-only-bonus:display-only-bonus-resolve-1',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 结算展示态奖励骰',
                    commands: [],
                },
            },
        };

        const unresolved = await serverInternal.hasOnlineAiRecoveryResolved(match, candidate, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(unresolved).toBe(false);
    });
    it('online AI watchdog 的 response-window resolved 判定在 live window 已切到新 fingerprint 时，应视为旧 incident 已 resolved', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-window-resolve-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-new-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-2',
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
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-response-window-resolve-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'response-window',
            fingerprintHint: 'response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-old-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-old-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-old-1',
                    kind: 'response-pass',
                    label: '服务端代 AI 响应',
                    commands: [],
                },
            },
        };

        const resolved = await serverInternal.hasOnlineAiRecoveryResolved(match, candidate, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(resolved).toBe(true);
    });
    it('online AI watchdog 的 response-loop resolved 判定在 live window 已切到新 fingerprint 时，应视为旧 incident 已 resolved', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-loop-resolve-fingerprint-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-loop-new-1',
                        windowType: 'afterAttackResolved',
                        sourceId: 'attack-loop-2',
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
            hasOnlineAiRecoveryResolved: (
                match: any,
                candidate: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-response-loop-resolve-fingerprint-drift');
        const candidate = {
            playerId: '1',
            reason: 'response-loop',
            fingerprintHint: 'response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-1:1:response-loop-old-1',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-1:1:response-loop-old-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-1:1:response-loop-old-1',
                    kind: 'response-pass',
                    label: '服务端代 AI 响应',
                    commands: [],
                },
            },
        };

        const resolved = await serverInternal.hasOnlineAiRecoveryResolved(match, candidate, {
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        });

        expect(resolved).toBe(true);
    });
});
