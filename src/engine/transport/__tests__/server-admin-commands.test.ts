import { describe, expect, it } from 'vitest';
import type { Server as IOServer } from 'socket.io';
import { createCheatSystem, CHEAT_COMMANDS } from '../../systems/CheatSystem';
import { createInitialSystemState } from '../../pipeline';
import { GameTransportServer } from '../server';
import {
    InMemoryStorage,
    MockIO,
    MockSocket,
    createEngineConfig,
    createMetadata,
    createStoredState,
    hasEvent,
    MockTrainingDataRecorder,
} from './helpers/serverTestHarness';

describe('GameTransportServer admin debug commands', () => {
    it('无座位管理员经当前角色校验后通过权威管线改状态并广播', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const trainingDataRecorder = new MockTrainingDataRecorder();
        const matchID = 'match-admin-debug';
        const cheatSystem = createCheatSystem();
        const initialState = createStoredState();
        initialState.G.sys = createInitialSystemState(['0'], [cheatSystem]);
        await storage.createMatch(matchID, {
            initialState,
            metadata: createMetadata('seat-credential'),
        });

        const baseConfig = createEngineConfig();
        const server = new GameTransportServer({
            io: io as unknown as IOServer,
            storage,
            games: [{ ...baseConfig, systems: [cheatSystem] }],
            authenticate: async (_matchID, playerID, credentials, metadata) => (
                metadata.players[playerID]?.credentials === credentials
            ),
            authenticateAdminDebugToken: async (token) => token === 'current-admin-token' ? 'admin-42' : null,
            trainingDataRecorder,
            trainingDataMinCompletedMatchDurationMs: 1,
            gameManifests: {
                'test-game': { ai: { capture: true, trainingMinCompletedDurationMs: 1 } },
            },
            onlineAiRecoveryTickMs: 0,
        });
        server.start();

        const playerSocket = new MockSocket('socket-player');
        io.gameNamespace.connectSocket(playerSocket);
        await playerSocket.clientEmit('sync', matchID, '0', 'seat-credential');

        const adminSocket = new MockSocket('socket-admin');
        io.gameNamespace.connectSocket(adminSocket);
        await adminSocket.clientEmit('sync', matchID, null);
        let commandResult: { accepted: boolean; reason?: string } | undefined;
        await adminSocket.clientEmit(
            'admin-debug:command',
            matchID,
            CHEAT_COMMANDS.SET_STATE,
            { state: { score: 42 } },
            'current-admin-token',
            (result: { accepted: boolean; reason?: string }) => {
                commandResult = result;
            },
        );

        expect(commandResult).toEqual({ accepted: true });
        const persisted = await storage.fetch(matchID, { state: true });
        expect(persisted.state?._stateID).toBe(1);
        expect(persisted.state?.G.core).toEqual({ score: 42 });
        expect(trainingDataRecorder.pending.has(matchID)).toBe(false);
        expect(hasEvent(playerSocket, 'state:update', (args) => args[0] === matchID)
            || hasEvent(playerSocket, 'state:patch', (args) => args[0] === matchID)).toBe(true);
        expect(hasEvent(adminSocket, 'state:update', (args) => args[0] === matchID)
            || hasEvent(adminSocket, 'state:patch', (args) => args[0] === matchID)).toBe(true);
    });

    it('普通用户、developer 和已降权管理员都不能通过调试 socket 修改状态', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const matchID = 'match-admin-demoted';
        const cheatSystem = createCheatSystem();
        const initialState = createStoredState();
        initialState.G.sys = createInitialSystemState(['0'], [cheatSystem]);
        await storage.createMatch(matchID, {
            initialState,
            metadata: createMetadata('seat-credential'),
        });

        let currentRole = 'user';
        const baseConfig = createEngineConfig();
        const server = new GameTransportServer({
            io: io as unknown as IOServer,
            storage,
            games: [{ ...baseConfig, systems: [cheatSystem] }],
            authenticate: async (_matchID, playerID, credentials, metadata) => (
                metadata.players[playerID]?.credentials === credentials
            ),
            authenticateAdminDebugToken: async (token) => (
                token === 'current-token' && currentRole === 'admin' ? 'admin-42' : null
            ),
            onlineAiRecoveryTickMs: 0,
        });
        server.start();

        const userSocket = new MockSocket('socket-user');
        io.gameNamespace.connectSocket(userSocket);
        await userSocket.clientEmit('sync', matchID, null);
        let commandResult: { accepted: boolean; reason?: string } | undefined;

        await userSocket.clientEmit(
            'admin-debug:command',
            matchID,
            CHEAT_COMMANDS.SET_STATE,
            { state: { score: 42 } },
            'current-token',
            (result: { accepted: boolean; reason?: string }) => {
                commandResult = result;
            },
        );

        expect(commandResult).toEqual({ accepted: false, reason: 'unauthorized' });
        currentRole = 'admin';
        const adminSocket = new MockSocket('socket-demoted-admin');
        io.gameNamespace.connectSocket(adminSocket);
        await adminSocket.clientEmit('sync', matchID, null);
        currentRole = 'developer';
        commandResult = undefined;

        await adminSocket.clientEmit(
            'admin-debug:command',
            matchID,
            CHEAT_COMMANDS.SET_STATE,
            { state: { score: 42 } },
            'current-token',
            (result: { accepted: boolean; reason?: string }) => {
                commandResult = result;
            },
        );

        expect(commandResult).toEqual({ accepted: false, reason: 'unauthorized' });
        const persisted = await storage.fetch(matchID, { state: true });
        expect(persisted.state?._stateID).toBe(0);
        expect(persisted.state?.G.core).toEqual({ currentPlayer: '0' });
    });
});
