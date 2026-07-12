import { describe, expect, it, vi } from 'vitest';
import type { Server as IOServer, Socket as IOSocket } from 'socket.io';
import type {
    ClaimSeatMetadataInput,
    ClaimSeatMetadataResult,
    CreateMatchData,
    FetchOpts,
    FetchResult,
    ListMatchesOpts,
    MatchMetadata,
    MatchStorage,
    StoredMatchState,
} from '../../engine/transport/storage';
import { createLobbyCoordinator } from '../lobbyCoordinator';
import { LOBBY_ALL, LOBBY_EVENTS } from '../../shared/lobby';

type EmittedRoomEvent = {
    room: string;
    event: string;
    payload: unknown;
};

function buildMetadata(overrides?: Partial<MatchMetadata>): MatchMetadata {
    return {
        gameName: 'tictactoe',
        players: {
            '0': { name: 'Alice', isConnected: true },
            '1': {},
        },
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}

function createStorage(records: Record<string, MatchMetadata>, states: Record<string, StoredMatchState> = {}) {
    const fetch = vi.fn(async (matchID: string, opts: FetchOpts): Promise<FetchResult> => ({
        metadata: opts.metadata ? records[matchID] : undefined,
        state: opts.state ? states[matchID] : undefined,
    }));
    const listMatches = vi.fn(async (opts?: ListMatchesOpts): Promise<string[]> => (
        Object.entries(records)
            .filter(([, metadata]) => !opts?.gameName || metadata.gameName === opts.gameName)
            .map(([matchID]) => matchID)
    ));
    const wipe = vi.fn(async (matchID: string): Promise<void> => {
        delete records[matchID];
    });

    const storage: MatchStorage = {
        connect: async () => undefined,
        createMatch: async (_matchID: string, _data: CreateMatchData) => undefined,
        setState: async (_matchID: string, _state: StoredMatchState) => undefined,
        setMetadata: async (_matchID: string, _metadata: MatchMetadata) => undefined,
        claimSeatMetadata: async (
            _matchID: string,
            _input: ClaimSeatMetadataInput,
        ): Promise<ClaimSeatMetadataResult> => ({ playerExists: false }),
        fetch,
        wipe,
        listMatches,
    };

    return { storage, fetch, listMatches, wipe };
}

function createFakeIo() {
    const emitted: EmittedRoomEvent[] = [];
    const io = {
        to: (room: string) => ({
            emit: (event: string, payload: unknown) => {
                emitted.push({ room, event, payload });
            },
        }),
    } as unknown as IOServer;

    return { io, emitted };
}

function createFakeSocket(id: string) {
    const joined: string[] = [];
    const left: string[] = [];
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const socket = {
        id,
        data: {},
        join: (room: string) => {
            joined.push(room);
        },
        leave: (room: string) => {
            left.push(room);
        },
        emit: (event: string, payload: unknown) => {
            emitted.push({ event, payload });
        },
    } as unknown as IOSocket;

    return { socket, joined, left, emitted };
}

describe('createLobbyCoordinator', () => {
    it('caches snapshot results and filters empty rooms', async () => {
        const records: Record<string, MatchMetadata> = {
            'match-1': buildMetadata(),
            'match-2': buildMetadata({
                players: {
                    '0': {},
                    '1': {},
                },
            }),
        };
        const { storage, fetch, listMatches } = createStorage(records);
        const coordinator = createLobbyCoordinator({
            storage,
            supportedGames: ['tictactoe'] as const,
            isSupportedGame: (gameName: string): gameName is 'tictactoe' => gameName === 'tictactoe',
            normalizeGameName: (name?: string) => (name || '').toLowerCase(),
            logger: { warn: vi.fn() },
        });

        const firstSnapshot = await coordinator.getLobbySnapshot('tictactoe');
        const secondSnapshot = await coordinator.getLobbySnapshot('tictactoe');

        expect(firstSnapshot.map((match) => match.matchID)).toEqual(['match-1']);
        expect(secondSnapshot.map((match) => match.matchID)).toEqual(['match-1']);
        expect(listMatches).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('tracks subscriptions and clears joined rooms', () => {
        const { storage } = createStorage({});
        const coordinator = createLobbyCoordinator({
            storage,
            supportedGames: ['tictactoe'] as const,
            isSupportedGame: (gameName: string): gameName is 'tictactoe' => gameName === 'tictactoe',
            normalizeGameName: (name?: string) => (name || '').toLowerCase(),
            logger: { warn: vi.fn() },
        });
        const gameSocket = createFakeSocket('socket-game');
        const allSocket = createFakeSocket('socket-all');

        const gameSub = coordinator.addLobbySubscription(gameSocket.socket, 'tictactoe');
        const allSub = coordinator.addLobbySubscription(allSocket.socket, LOBBY_ALL);

        expect(gameSub).toEqual({ isNew: true, subscriberCount: 1 });
        expect(allSub).toEqual({ isNew: true, subscriberCount: 1 });
        expect(coordinator.getSubscriberCount('tictactoe')).toBe(1);
        expect(coordinator.getAllSubscriberCount()).toBe(1);

        coordinator.clearLobbySubscriptions(gameSocket.socket);
        coordinator.clearLobbySubscriptions(allSocket.socket);

        expect(coordinator.getSubscriberCount('tictactoe')).toBe(0);
        expect(coordinator.getAllSubscriberCount()).toBe(0);
        expect(gameSocket.joined).toEqual(['lobby:subscribers:tictactoe']);
        expect(gameSocket.left).toEqual(['lobby:subscribers:tictactoe']);
        expect(allSocket.joined).toEqual(['lobby:subscribers:all']);
        expect(allSocket.left).toEqual(['lobby:subscribers:all']);
        expect(gameSocket.socket.data.lobbyGameIds).toBeUndefined();
        expect(allSocket.socket.data.lobbyGameIds).toBeUndefined();
    });

    it('emits room events for create, update, and end flows', async () => {
        const records: Record<string, MatchMetadata> = {
            'match-1': buildMetadata(),
        };
        const { storage } = createStorage(records);
        const { io, emitted } = createFakeIo();
        const coordinator = createLobbyCoordinator({
            storage,
            supportedGames: ['tictactoe'] as const,
            isSupportedGame: (gameName: string): gameName is 'tictactoe' => gameName === 'tictactoe',
            normalizeGameName: (name?: string) => (name || '').toLowerCase(),
            logger: { warn: vi.fn() },
        });
        coordinator.attachIO(io);

        const gameSocket = createFakeSocket('socket-game');
        const allSocket = createFakeSocket('socket-all');
        coordinator.addLobbySubscription(gameSocket.socket, 'tictactoe');
        coordinator.addLobbySubscription(allSocket.socket, LOBBY_ALL);

        await coordinator.handleMatchCreated('match-1', 'tictactoe');

        records['match-1'] = {
            ...records['match-1'],
            updatedAt: 2,
            players: {
                ...records['match-1'].players,
                '1': { name: 'Bob', isConnected: true },
            },
        };
        await coordinator.handleMatchJoined('match-1', 'tictactoe');

        records['match-1'] = {
            ...records['match-1'],
            players: {
                '0': {},
                '1': {},
            },
            updatedAt: 3,
        };
        await coordinator.handleMatchLeft('match-1', 'tictactoe');

        expect(emitted.map((entry) => [entry.room, entry.event])).toEqual([
            ['lobby:subscribers:tictactoe', LOBBY_EVENTS.MATCH_CREATED],
            ['lobby:subscribers:all', LOBBY_EVENTS.MATCH_CREATED],
            ['lobby:subscribers:tictactoe', LOBBY_EVENTS.MATCH_UPDATED],
            ['lobby:subscribers:all', LOBBY_EVENTS.MATCH_UPDATED],
            ['lobby:subscribers:tictactoe', LOBBY_EVENTS.MATCH_ENDED],
            ['lobby:subscribers:all', LOBBY_EVENTS.MATCH_ENDED],
        ]);
        expect((emitted[0]?.payload as { match?: { matchID?: string } }).match?.matchID).toBe('match-1');
        expect((emitted[4]?.payload as { matchID?: string }).matchID).toBe('match-1');
    });

    it('山屋房间列表在局内确认后显示当前剧本，确认前仍显示未定', async () => {
        const records: Record<string, MatchMetadata> = {
            'match-pending': buildMetadata({
                gameName: 'betrayal',
                players: {
                    '0': { name: 'Alice', isConnected: true },
                    '1': {},
                    '2': {},
                },
                setupData: {},
            }),
            'match-confirmed': buildMetadata({
                gameName: 'betrayal',
                players: {
                    '0': { name: 'Alice', isConnected: true },
                    '1': {},
                    '2': {},
                },
                setupData: {},
            }),
        };
        const states: Record<string, StoredMatchState> = {
            'match-pending': {
                G: { core: { phase: 'characterSelect', scenarioId: 'first-scenario' } },
                _stateID: 1,
            },
            'match-confirmed': {
                G: { core: { phase: 'preHaunt', scenarioId: 'first-scenario' } },
                _stateID: 2,
            },
        };
        const { storage, fetch } = createStorage(records, states);
        const coordinator = createLobbyCoordinator({
            storage,
            supportedGames: ['betrayal'] as const,
            isSupportedGame: (gameName: string): gameName is 'betrayal' => gameName === 'betrayal',
            normalizeGameName: (name?: string) => (name || '').toLowerCase(),
            logger: { warn: vi.fn() },
        });

        const snapshot = await coordinator.getLobbySnapshot('betrayal');

        expect(snapshot.find((match) => match.matchID === 'match-pending')?.publicSetupSummary).toEqual({});
        expect(snapshot.find((match) => match.matchID === 'match-confirmed')?.publicSetupSummary).toEqual({
            scenarioId: 'first-scenario',
        });
        expect(fetch).toHaveBeenCalledWith('match-pending', { metadata: true, state: true });
        expect(fetch).toHaveBeenCalledWith('match-confirmed', { metadata: true, state: true });
    });
});
