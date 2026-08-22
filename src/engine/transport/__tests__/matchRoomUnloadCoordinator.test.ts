import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    MatchRoomUnloadCoordinator,
    type MatchRoomUnloadHooks,
    type MatchRoomUnloadMatch,
    type MatchRoomUnloadSocket,
} from '../matchRoomUnloadCoordinator';

type TestMatch = MatchRoomUnloadMatch & {
    unloaded: boolean;
};

function createMatch(): TestMatch {
    return {
        matchID: 'match-1',
        connections: new Map([
            ['0', new Set(['socket-player-a', 'socket-player-b'])],
            ['1', new Set(['socket-player-c'])],
        ]),
        spectatorSockets: new Set(['socket-spectator']),
        offlineTimers: new Map([
            ['0', setTimeout(() => undefined, 1000)],
            ['1', setTimeout(() => undefined, 1000)],
        ]),
        unloaded: false,
    };
}

function createSocket(): MatchRoomUnloadSocket & {
    emitted: Array<{ event: string; args: unknown[] }>;
    disconnected: boolean;
    closeArg: boolean | undefined;
} {
    return {
        emitted: [],
        disconnected: false,
        closeArg: undefined,
        emit(event, ...args) {
            this.emitted.push({ event, args });
        },
        disconnect(close) {
            this.disconnected = true;
            this.closeArg = close;
        },
    };
}

function createHarness(options?: {
    match?: TestMatch;
    fetchError?: unknown;
}) {
    const match = options?.match;
    const socketIndex = new Set([
        'socket-player-a',
        'socket-player-b',
        'socket-player-c',
        'socket-spectator',
    ]);
    const sequence: string[] = [];
    const clearedRecovery: string[] = [];
    const clearedCircuit: string[] = [];
    const disconnectFailures: Array<{ matchID: string; error: unknown }> = [];
    const sockets = [createSocket(), createSocket()];

    const hooks: MatchRoomUnloadHooks<TestMatch> = {
        getMatch: vi.fn((matchID) => (match?.matchID === matchID ? match : undefined)),
        markRuntimeUnloaded: vi.fn((activeMatch) => {
            sequence.push('markRuntimeUnloaded');
            activeMatch.unloaded = true;
        }),
        deleteSocketInfo: vi.fn((socketId) => {
            sequence.push(`deleteSocketInfo:${socketId}`);
            socketIndex.delete(socketId);
        }),
        deleteMatch: vi.fn((matchID) => {
            sequence.push('deleteMatch');
            return match?.matchID === matchID;
        }),
        clearRecoveryState: vi.fn((matchID) => {
            sequence.push('clearRecoveryState');
            clearedRecovery.push(matchID);
        }),
        clearCircuitState: vi.fn((matchID) => {
            sequence.push('clearCircuitState');
            clearedCircuit.push(matchID);
        }),
        fetchRoomSockets: vi.fn(async () => {
            if (options?.fetchError) {
                throw options.fetchError;
            }
            return sockets;
        }),
        onDisconnectRoomSocketsFailed: vi.fn((matchID, error) => {
            disconnectFailures.push({ matchID, error });
        }),
    };

    return {
        coordinator: new MatchRoomUnloadCoordinator({ hooks }),
        hooks,
        match,
        socketIndex,
        sequence,
        clearedRecovery,
        clearedCircuit,
        disconnectFailures,
        sockets,
    };
}

describe('MatchRoomUnloadCoordinator', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('房间不存在时返回 false，不触发任何卸载副作用', () => {
        const harness = createHarness();

        expect(harness.coordinator.unloadMatch('missing-match')).toBe(false);

        expect(harness.hooks.markRuntimeUnloaded).not.toHaveBeenCalled();
        expect(harness.hooks.deleteMatch).not.toHaveBeenCalled();
        expect(harness.hooks.clearRecoveryState).not.toHaveBeenCalled();
        expect(harness.hooks.clearCircuitState).not.toHaveBeenCalled();
    });

    it('卸载房间时标记运行时卸载，清空离线定时器、socket 索引和 AI 运行时账本', () => {
        vi.useFakeTimers();
        const match = createMatch();
        const harness = createHarness({ match });

        expect(harness.coordinator.unloadMatch('match-1')).toBe(true);

        expect(match.unloaded).toBe(true);
        expect(match.offlineTimers.size).toBe(0);
        expect(harness.socketIndex.size).toBe(0);
        expect(harness.clearedRecovery).toEqual(['match-1']);
        expect(harness.clearedCircuit).toEqual(['match-1']);
        expect(harness.sequence[0]).toBe('markRuntimeUnloaded');
        expect(harness.sequence).toContain('deleteMatch');
    });

    it('请求断开 socket 时，先发送 match_not_found，再断开连接', async () => {
        vi.useFakeTimers();
        const harness = createHarness({ match: createMatch() });

        expect(harness.coordinator.unloadMatch('match-1', { disconnectSockets: true })).toBe(true);
        await vi.runAllTimersAsync();

        expect(harness.hooks.fetchRoomSockets).toHaveBeenCalledWith('match-1');
        for (const socket of harness.sockets) {
            expect(socket.emitted).toEqual([{
                event: 'error',
                args: ['match-1', 'match_not_found'],
            }]);
            expect(socket.disconnected).toBe(true);
            expect(socket.closeArg).toBe(true);
        }
    });

    it('断开房间 socket 失败时只上报失败，不回滚已经完成的卸载状态', async () => {
        vi.useFakeTimers();
        const error = new Error('fetch failed');
        const match = createMatch();
        const harness = createHarness({ match, fetchError: error });

        expect(harness.coordinator.unloadMatch('match-1', { disconnectSockets: true })).toBe(true);
        await vi.runAllTimersAsync();

        expect(match.unloaded).toBe(true);
        expect(harness.socketIndex.size).toBe(0);
        expect(harness.disconnectFailures).toEqual([{ matchID: 'match-1', error }]);
    });
});
