import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import type { GameEngineConfig } from '../engineConfig';
import * as aiModule from '../../ai';
import {
    InMemoryStorage,
    MockIO,
    MockSocket,
    createEngineConfig,
    createEngineConfigWithId,
    createMetadata,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
    createStoredState,
    hasEvent,
} from './helpers/serverTestHarness';

describe('GameTransportServer（command feedback reporting）', () => {
    it('线上形状：同一 AI 座位的旧卡牌命令与 watchdog 失败共用预算，达到预算后不再进入领域管线', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const validateSpy = vi.fn(() => ({ valid: false, error: '手牌中没有该卡牌' }));
        const feedbackReporter = vi.fn(async () => undefined);
        const baseEngineConfig = createEngineConfig();

        await storage.createMatch('match-ai-circuit-breaker-production-shape', {
            initialState: createOnlineAiRecoveryState({ phase: 'playCards' }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...baseEngineConfig,
                domain: {
                    ...baseEngineConfig.domain,
                    validate: validateSpy,
                },
            }],
            onlineAiCircuitFailureBudget: 3,
            onlineAiFeedbackReporter: feedbackReporter,
        });
        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: Record<string, unknown>,
            ) => Promise<boolean>;
        };
        const match = await serverInternal.loadMatch('match-ai-circuit-breaker-production-shape');

        for (let index = 0; index < 3; index += 1) {
            match.stateID = index;
            match.state = {
                ...match.state,
                sys: {
                    ...match.state.sys,
                    turnNumber: index + 1,
                },
            };
            await expect(serverInternal.executeCommandInternal(
                match,
                '1',
                'su:play_minion',
                { cardUid: `old-card-${index}` },
                {
                    expectedStateID: index,
                    onlineAiCircuitSource: index === 1 ? 'watchdog' : 'client',
                    feedbackSource: index === 1 ? 'online-ai-watchdog' : 'player-command-failure',
                },
            )).resolves.toBe(false);
        }

        match.stateID = 3;
        const fourthAttempt = await serverInternal.executeCommandInternal(
            match,
            '1',
            'su:play_minion',
            { cardUid: 'old-card-4' },
            {
                expectedStateID: 3,
                onlineAiCircuitSource: 'watchdog',
                feedbackSource: 'online-ai-watchdog',
            },
        );

        expect(fourthAttempt).toBe(false);
        expect(match.lastCommandFailureReason).toBe('online_ai_circuit_open');
        expect(validateSpy).toHaveBeenCalledTimes(3);
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            incidentKind?: string;
            stateSnapshot?: string;
        } | undefined;
        expect(payload?.incidentKind).toBe('circuit-breaker-tripped');
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.circuit.failureCount).toBe(3);
        expect(snapshot.circuit.recentFailures).toHaveLength(3);
        expect(snapshot.circuit.recentFailures[0].commandSummary).toContain('old-card-0');
        expect(snapshot.circuit.recentFailures[1].source).toBe('watchdog');
    });

    it('排队后因权威状态前进而丢弃的 AI 命令，也会消耗同一座位的 stale 预算', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        await storage.createMatch('match-ai-queued-stale-circuit', {
            initialState: createOnlineAiRecoveryState({ phase: 'playCards' }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
        });
        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            handleCommand: (
                matchID: string,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
            drainCommandQueue: (match: any) => Promise<void>;
            onlineAiCircuitBreaker: { getSnapshot: (matchID: string, playerID: string) => any };
        };
        const match = await serverInternal.loadMatch('match-ai-queued-stale-circuit');
        match.executing = true;

        const queuedResult = serverInternal.handleCommand(
            'match-ai-queued-stale-circuit',
            '1',
            'su:play_minion',
            { cardUid: 'queued-old-card' },
        );
        match.stateID = 1;
        match.executing = false;
        await serverInternal.drainCommandQueue(match);

        await expect(queuedResult).resolves.toBe(false);
        const snapshot = serverInternal.onlineAiCircuitBreaker.getSnapshot(
            'match-ai-queued-stale-circuit',
            '1',
        );
        expect(snapshot.failureCount).toBe(1);
        expect(snapshot.recentFailures[0]).toMatchObject({
            commandType: 'su:play_minion',
            reason: 'stale_state',
            expectedStateID: 0,
        });
    });

    it('在线 AI watchdog 选出的动作若被权威领域状态拒绝，应跳过管线并自动记录失败现场', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const executeSpy = vi.fn(() => []);
        const baseEngineConfig = createEngineConfig();
        const engineConfig: GameEngineConfig = {
            ...baseEngineConfig,
            domain: {
                ...baseEngineConfig.domain,
                validate: () => ({ valid: false, error: '手牌中没有该卡牌' }),
                execute: executeSpy,
            },
        };

        await storage.createMatch('match-watchdog-authoritative-invalid-action', {
            initialState: createOnlineAiRecoveryState({ phase: 'playCards' }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
            commandFailureFeedbackReporter: feedbackReporter,
        });
        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<any>;
        };
        const match = await serverInternal.loadMatch('match-watchdog-authoritative-invalid-action');
        const resolveSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                attemptKey: 'stale-legal-action',
                source: 'local-ai',
                action: {
                    actionId: 'play-old-card',
                    kind: 'play-minion',
                    label: '打出已经离开手牌的随从',
                    commands: [{ type: 'TEST_CMD', payload: { cardUid: 'old-card' } }],
                },
            },
        } as any);

        try {
            const result = await serverInternal.tryRecoverOnlineAiWithLegalAction(
                match,
                {
                    playerId: '1',
                    reason: 'active-turn',
                    resolution: {
                        playerId: '1',
                        attemptKey: 'force-recovery',
                        source: 'local-ai',
                        action: {
                            actionId: 'force-recovery',
                            kind: 'force-end-turn',
                            label: '恢复 AI',
                            commands: [],
                        },
                    },
                },
                {
                    key: 'watchdog-authoritative-invalid-action',
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                },
                { '1': { type: 'local-ai' } },
            );

            expect(result.outcome).toBe('legal-action-command-failed');
            expect(result.failedCommandType).toBe('TEST_CMD');
            expect(executeSpy).not.toHaveBeenCalled();
            expect(feedbackReporter).toHaveBeenCalledTimes(1);

            const payload = feedbackReporter.mock.calls[0]?.[0] as {
                reason?: string;
                stateSnapshot?: string;
            } | undefined;
            expect(payload?.reason).toBe('手牌中没有该卡牌');
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.feedbackSource).toBe('online-ai-watchdog');
            expect(snapshot.command).toEqual({
                type: 'TEST_CMD',
                payload: { cardUid: 'old-card' },
            });
        } finally {
            resolveSpy.mockRestore();
        }
    });

    it('串行执行期间排队的普通命令若状态已前进，应直接丢弃而不是按新状态重放', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-queued-stale-command', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<{
                executing: boolean;
                stateID: number;
                commandQueue: unknown[];
            }>;
            handleCommand: (
                matchID: string,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
            drainCommandQueue: (match: unknown) => Promise<void>;
            executeCommandInternal: (...args: unknown[]) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-queued-stale-command');
        match.executing = true;
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        const queuedResult = serverInternal.handleCommand('match-queued-stale-command', '0', 'TEST_CMD', { stale: true });
        expect(match.commandQueue).toHaveLength(1);

        match.stateID += 1;
        match.executing = false;
        await serverInternal.drainCommandQueue(match);

        await expect(queuedResult).resolves.toBe(false);
        expect(executeSpy).not.toHaveBeenCalled();
    });

    it('串行执行期间已知旧状态的命令应在入队前立即拒绝', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-prequeue-stale-command', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            authenticate: async (_matchID, playerID, credentials, metadata) => (
                metadata.players[playerID]?.credentials === credentials
            ),
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<{
                executing: boolean;
                stateID: number;
                commandQueue: unknown[];
            }>;
            handleCommand: (
                matchID: string,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { expectedStateID?: number },
            ) => Promise<boolean>;
            executeCommandInternal: (...args: unknown[]) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-prequeue-stale-command');
        match.executing = true;
        match.stateID += 1;
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await expect(serverInternal.handleCommand(
            'match-prequeue-stale-command',
            '0',
            'TEST_CMD',
            { stale: true },
            { expectedStateID: match.stateID - 1 },
        )).resolves.toBe(false);

        expect(match.commandQueue).toHaveLength(0);
        expect(executeSpy).toHaveBeenCalledTimes(1);
    });

    it('batch 内命令验证失败时应透传领域错误码而不是折叠成 command_failed', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-batch-validation-error-detail', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const engineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                validate: (_state, command) => {
                    if (command.type === 'BAD_SUMMON') {
                        return { valid: false, error: 'summon_position_not_adjacent_to_gate' };
                    }
                    return { valid: true };
                },
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-batch-validation-error-detail');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-batch-validation-error-detail', '0', 'cred-0');
        socket.sent.length = 0;

        await socket.clientEmit(
            'batch',
            'match-batch-validation-error-detail',
            'batch-validation-error-detail-1',
            [{ type: 'BAD_SUMMON', payload: { position: { x: 1, y: 1 } } }],
            'cred-0',
        );

        expect(hasEvent(socket, 'batch:rejected', (args) => (
            args[1] === 'batch-validation-error-detail-1'
            && args[2] === 'summon_position_not_adjacent_to_gate'
        ))).toBe(true);
        expect(hasEvent(socket, 'batch:rejected', (args) => args[2] === 'command_failed')).toBe(false);

        const persisted = await storage.fetch('match-batch-validation-error-detail', { state: true });
        expect(persisted.state?._stateID).toBe(0);
    });

    it('batch 内 pipeline 异常时应透传异常详情，避免用户只看到泛化命令失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-batch-pipeline-error-detail', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const engineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            systems: [{
                id: 'throw-pipeline-detail',
                name: 'throw-pipeline-detail',
                priority: 1,
                beforeCommand: ({ command }: { command: { type: string } }) => {
                    if (command.type === 'TRIGGER_PIPELINE_ERROR') {
                        throw new Error('effect contract missing turnFlags for base_ninja_dojo');
                    }
                },
            } as any],
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-batch-pipeline-error-detail');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-batch-pipeline-error-detail', '0', 'cred-0');
        socket.sent.length = 0;

        await socket.clientEmit(
            'batch',
            'match-batch-pipeline-error-detail',
            'batch-pipeline-error-detail-1',
            [{ type: 'TRIGGER_PIPELINE_ERROR', payload: {} }],
            'cred-0',
        );

        expect(hasEvent(socket, 'batch:rejected', (args) => (
            args[1] === 'batch-pipeline-error-detail-1'
            && args[2] === 'pipeline_error: effect contract missing turnFlags for base_ninja_dojo'
        ))).toBe(true);
        expect(hasEvent(socket, 'batch:rejected', (args) => args[2] === 'command_failed')).toBe(false);
    });

    it('在线命令 pipeline 异常时应自动上报后台反馈，并在冷却期内去重', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-command-pipeline-feedback', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const engineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            systems: [{
                id: 'throw-command-feedback',
                name: 'throw-command-feedback',
                priority: 1,
                beforeCommand: ({ command }: { command: { type: string } }) => {
                    if (command.type === 'TRIGGER_PIPELINE_ERROR') {
                        throw new Error('effect contract missing turnFlags for base_ninja_dojo');
                    }
                },
            } as any],
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
            commandFailureFeedbackReporter: feedbackReporter,
            commandFailureFeedbackCooldownMs: 60_000,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-command-pipeline-feedback');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-command-pipeline-feedback', '0', 'cred-0');
        socket.sent.length = 0;

        await socket.clientEmit('command', 'match-command-pipeline-feedback', 'TRIGGER_PIPELINE_ERROR', {}, 'cred-0');
        await socket.clientEmit('command', 'match-command-pipeline-feedback', 'TRIGGER_PIPELINE_ERROR', {}, 'cred-0');

        expect(hasEvent(socket, 'error', (args) => args[1] === 'pipeline_error: effect contract missing turnFlags for base_ninja_dojo')).toBe(true);
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-command-pipeline-feedback',
            gameId: 'test-game',
            playerId: '0',
            incidentKind: 'command-failed',
            commandType: 'TRIGGER_PIPELINE_ERROR',
            reason: 'pipeline_error: effect contract missing turnFlags for base_ninja_dojo',
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            stateSnapshot?: string;
            actionLog?: string;
            progressMarker?: string;
            incidentKey?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot).toMatchObject({
            kind: 'command-failure-feedback',
            commandType: 'TRIGGER_PIPELINE_ERROR',
            reason: 'pipeline_error: effect contract missing turnFlags for base_ninja_dojo',
            progressMarker: payload?.progressMarker,
            feedbackSource: 'player-command-failure',
        });
        expect(snapshot.command).toEqual({
            type: 'TRIGGER_PIPELINE_ERROR',
            payload: {},
        });
        expect(snapshot.aiContext).toMatchObject({
            seatControllerType: 'human',
            legalActions: null,
        });
        expect(snapshot.visibleState).toBeTruthy();

        if (payload?.actionLog) {
            const actionLog = JSON.parse(payload.actionLog);
            expect(actionLog).toMatchObject({
                kind: 'online-ai-feedback-diagnostic',
                commandType: 'TRIGGER_PIPELINE_ERROR',
                reason: 'pipeline_error: effect contract missing turnFlags for base_ninja_dojo',
                progressMarker: payload?.progressMarker,
            });
        }
        expect(payload?.incidentKey).toContain('TRIGGER_PIPELINE_ERROR');
    });

    it('领域拒绝错误码不应误报成后台自动反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-command-domain-error-no-feedback', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const engineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            domain: {
                ...createEngineConfig().domain,
                validate: (_state, command) => {
                    if (command.type === 'BAD_SUMMON') {
                        return { valid: false, error: 'summon_position_not_adjacent_to_gate' };
                    }
                    return { valid: true };
                },
            },
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
            commandFailureFeedbackReporter: feedbackReporter,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-command-domain-error-no-feedback');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-command-domain-error-no-feedback', '0', 'cred-0');
        socket.sent.length = 0;

        await socket.clientEmit('command', 'match-command-domain-error-no-feedback', 'BAD_SUMMON', { position: { x: 1, y: 1 } }, 'cred-0');

        expect(hasEvent(socket, 'error', (args) => args[1] === 'summon_position_not_adjacent_to_gate')).toBe(true);
        expect(feedbackReporter).not.toHaveBeenCalled();
    });

    it('在线 AI watchdog 的失败命令应记录实际参数、状态版本与当前合法动作', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const baseEngineConfig = createEngineConfigWithId('smashup');

        await storage.createMatch('match-ai-command-failure-diagnostic', {
            initialState: createOnlineAiRecoveryState({ phase: 'playCards' }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...baseEngineConfig,
                systems: [{
                    id: 'throw-ai-command-feedback',
                    name: 'throw-ai-command-feedback',
                    priority: 1,
                    beforeCommand: ({ command }: { command: { type: string } }) => {
                        if (command.type === 'su:play_minion') {
                            throw new Error('hand_card_missing: c67');
                        }
                    },
                } as any, ...baseEngineConfig.systems],
            }],
            commandFailureFeedbackReporter: feedbackReporter,
        });
        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { reportFailureFeedback?: boolean; feedbackSource?: string },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-ai-command-failure-diagnostic');
        const success = await serverInternal.executeCommandInternal(
            match,
            '1',
            'su:play_minion',
            { cardUid: 'c67', baseIndex: 3 },
            { reportFailureFeedback: true, feedbackSource: 'online-ai-watchdog' },
        );

        expect(success).toBe(false);
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot).toMatchObject({
            feedbackSource: 'online-ai-watchdog',
            command: {
                type: 'su:play_minion',
                payload: { cardUid: 'c67', baseIndex: 3 },
            },
            aiContext: {
                seatControllerType: 'local-ai',
            },
        });
        expect(snapshot.stateIDBefore).toBe(0);
        expect(snapshot.progressMarker).toBeTruthy();
    });

    it('batch 内 pipeline 异常也应自动上报后台反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-batch-pipeline-feedback', {
            initialState: createStoredState(),
            metadata: createMetadata('cred-0'),
        });

        const engineConfig: GameEngineConfig = {
            ...createEngineConfig(),
            systems: [{
                id: 'throw-batch-feedback',
                name: 'throw-batch-feedback',
                priority: 1,
                beforeCommand: ({ command }: { command: { type: string } }) => {
                    if (command.type === 'TRIGGER_PIPELINE_ERROR') {
                        throw new Error('effect contract missing turnFlags for base_ninja_dojo');
                    }
                },
            } as any],
        };

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [engineConfig],
            commandFailureFeedbackReporter: feedbackReporter,
            authenticate: async (_matchID, playerID, credentials, metadata) => {
                return metadata.players[playerID]?.credentials === credentials;
            },
        });
        server.start();

        const socket = new MockSocket('socket-batch-pipeline-feedback');
        io.gameNamespace.connectSocket(socket);
        await socket.clientEmit('sync', 'match-batch-pipeline-feedback', '0', 'cred-0');
        socket.sent.length = 0;

        await socket.clientEmit(
            'batch',
            'match-batch-pipeline-feedback',
            'batch-pipeline-feedback-1',
            [{ type: 'TRIGGER_PIPELINE_ERROR', payload: {} }],
            'cred-0',
        );

        expect(hasEvent(socket, 'batch:rejected', (args) => (
            args[1] === 'batch-pipeline-feedback-1'
            && args[2] === 'pipeline_error: effect contract missing turnFlags for base_ninja_dojo'
        ))).toBe(true);
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-batch-pipeline-feedback',
            commandType: 'TRIGGER_PIPELINE_ERROR',
            reason: 'pipeline_error: effect contract missing turnFlags for base_ninja_dojo',
        }));
    });

});
