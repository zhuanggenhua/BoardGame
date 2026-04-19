/* @vitest-environment happy-dom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { LobbyMatch } from '../../services/lobbySocket';
import { socketHealthChecker } from '../../services/socketHealthCheck';
import { getTimeUntilExpiry, parseToken } from '../useTokenRefresh';
import { useLobbyMatchPresence } from '../useLobbyMatchPresence';

const subscribeMock = vi.fn();
const acquireConnectionMock = vi.fn();
const releaseConnectionMock = vi.fn();
const getSharedSocketMock = vi.fn();
let lastHandler: ((matches: LobbyMatch[]) => void) | null = null;

vi.mock('../../services/lobbySocket', () => ({
    lobbySocket: {
        subscribe: (gameId: string, handler: (matches: LobbyMatch[]) => void) => {
            subscribeMock(gameId);
            lastHandler = handler;
            return () => {};
        },
        acquireConnection: (...args: unknown[]) => acquireConnectionMock(...args),
        releaseConnection: (...args: unknown[]) => releaseConnectionMock(...args),
        getSharedSocket: (...args: unknown[]) => getSharedSocketMock(...args),
    },
}));

describe('useLobbyMatchPresence', () => {
    beforeEach(() => {
        subscribeMock.mockClear();
        lastHandler = null;
    });

    it('does not mark missing before the match is seen', () => {
        const { result } = renderHook(() =>
            useLobbyMatchPresence({
                gameId: 'tictactoe',
                matchId: 'm1',
                enabled: true,
                requireSeen: true,
            })
        );

        expect(subscribeMock).toHaveBeenCalledWith('tictactoe');
        act(() => {
            lastHandler?.([]);
        });

        expect(result.current.hasSnapshot).toBe(true);
        expect(result.current.hasSeen).toBe(false);
        expect(result.current.exists).toBe(false);
        expect(result.current.isMissing).toBe(false);
    });

    it('marks missing after the match disappears', () => {
        const { result } = renderHook(() =>
            useLobbyMatchPresence({
                gameId: 'tictactoe',
                matchId: 'm1',
                enabled: true,
                requireSeen: true,
            })
        );

        const match: LobbyMatch = {
            matchID: 'm1',
            gameName: 'tictactoe',
            players: [],
        };

        act(() => {
            lastHandler?.([match]);
        });

        expect(result.current.hasSnapshot).toBe(true);
        expect(result.current.hasSeen).toBe(true);
        expect(result.current.exists).toBe(true);
        expect(result.current.isMissing).toBe(false);

        act(() => {
            lastHandler?.([]);
        });

        expect(result.current.exists).toBe(false);
        expect(result.current.isMissing).toBe(true);
    });

    it('resets hasSeen when matchId changes', () => {
        const { result, rerender } = renderHook(
            ({ matchId }: { matchId: string }) =>
                useLobbyMatchPresence({
                    gameId: 'tictactoe',
                    matchId,
                    enabled: true,
                    requireSeen: true,
                }),
            { initialProps: { matchId: 'm1' } }
        );

        act(() => {
            lastHandler?.([
                {
                    matchID: 'm1',
                    gameName: 'tictactoe',
                    players: [],
                },
            ]);
        });

        expect(result.current.hasSeen).toBe(true);
        expect(result.current.exists).toBe(true);

        rerender({ matchId: 'm2' });

        expect(result.current.hasSeen).toBe(false);
        expect(result.current.isMissing).toBe(false);

        act(() => {
            lastHandler?.([
                {
                    matchID: 'm2',
                    gameName: 'tictactoe',
                    players: [],
                },
            ]);
        });

        expect(result.current.hasSeen).toBe(true);
        expect(result.current.exists).toBe(true);

        act(() => {
            lastHandler?.([]);
        });

        expect(result.current.isMissing).toBe(true);
    });
});

describe('socketHealthChecker', () => {
    afterEach(() => {
        socketHealthChecker.stopAll();
        vi.useRealTimers();
    });

    it('does not reconnect while socket is already connecting', () => {
        vi.useFakeTimers();
        const connect = vi.fn();
        const cleanup = socketHealthChecker.start({
            name: 'test-connecting-socket',
            getSocket: () => ({
                connected: false,
                active: true,
                connect,
            } as never),
        });

        expect(connect).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(30000);
        });

        expect(connect).not.toHaveBeenCalled();
        cleanup();
    });

    it('reconnects when socket is disconnected and inactive', () => {
        vi.useFakeTimers();
        const connect = vi.fn();
        const cleanup = socketHealthChecker.start({
            name: 'test-disconnected-socket',
            getSocket: () => ({
                connected: false,
                active: false,
                connect,
            } as never),
        });

        expect(connect).toHaveBeenCalledTimes(1);
        cleanup();
    });
});

describe('matchSocket shared connection', () => {
    beforeEach(() => {
        acquireConnectionMock.mockReset();
        releaseConnectionMock.mockReset();
        getSharedSocketMock.mockReset();
        vi.resetModules();
    });

    it('reuses lobby shared socket and releases it after match/chat become idle', async () => {
        const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
        const fakeSocket = {
            connected: false,
            active: false,
            on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                const next = handlers.get(event) ?? new Set<(...args: unknown[]) => void>();
                next.add(handler);
                handlers.set(event, next);
                return fakeSocket;
            }),
            off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                handlers.get(event)?.delete(handler);
                return fakeSocket;
            }),
            emit: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
        };

        acquireConnectionMock.mockReturnValue(fakeSocket);
        getSharedSocketMock.mockReturnValue(null);

        const { matchSocket, REMATCH_EVENTS, MATCH_CHAT_EVENTS } = await import('../../services/matchSocket');

        matchSocket.joinMatch('m1', 'p1');
        matchSocket.joinChat('m1');

        expect(acquireConnectionMock).toHaveBeenCalledTimes(2);
        expect(acquireConnectionMock).toHaveBeenCalledWith('match');
        expect(fakeSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
        expect(fakeSocket.on.mock.calls.filter(([event]) => event === 'connect')).toHaveLength(1);

        fakeSocket.connected = true;
        act(() => {
            handlers.get('connect')?.forEach((handler) => handler());
        });

        expect(fakeSocket.emit).toHaveBeenCalledWith(REMATCH_EVENTS.JOIN_MATCH, {
            matchId: 'm1',
            playerId: 'p1',
        });
        expect(fakeSocket.emit).toHaveBeenCalledWith(MATCH_CHAT_EVENTS.JOIN, { matchId: 'm1' });

        matchSocket.leaveMatch();
        expect(fakeSocket.emit).toHaveBeenCalledWith(REMATCH_EVENTS.LEAVE_MATCH);
        expect(releaseConnectionMock).not.toHaveBeenCalled();

        matchSocket.leaveChat();
        expect(fakeSocket.emit).toHaveBeenCalledWith(MATCH_CHAT_EVENTS.LEAVE);
        expect(releaseConnectionMock).toHaveBeenCalledTimes(1);
        expect(releaseConnectionMock).toHaveBeenCalledWith('match');

        matchSocket.disconnect();
    });

    it('unbinds handlers after idle release and does not duplicate shared socket events on rejoin', async () => {
        const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
        const fakeSocket = {
            connected: true,
            active: true,
            on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                const next = handlers.get(event) ?? new Set<(...args: unknown[]) => void>();
                next.add(handler);
                handlers.set(event, next);
                return fakeSocket;
            }),
            off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
                handlers.get(event)?.delete(handler);
                return fakeSocket;
            }),
            emit: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
        };

        acquireConnectionMock.mockReturnValue(fakeSocket);
        getSharedSocketMock.mockReturnValue(fakeSocket);

        const { matchSocket, REMATCH_EVENTS } = await import('../../services/matchSocket');
        const stateSpy = vi.fn();
        const unsubscribe = matchSocket.subscribeState(stateSpy);

        matchSocket.joinMatch('m1', 'p1');
        expect(acquireConnectionMock).toHaveBeenCalledTimes(1);
        expect(fakeSocket.emit).toHaveBeenCalledWith(REMATCH_EVENTS.JOIN_MATCH, {
            matchId: 'm1',
            playerId: 'p1',
        });

        matchSocket.leaveMatch();
        expect(releaseConnectionMock).toHaveBeenCalledTimes(1);
        expect(fakeSocket.off).toHaveBeenCalledWith(REMATCH_EVENTS.STATE_UPDATE, expect.any(Function));

        matchSocket.joinMatch('m2', 'p2');
        expect(acquireConnectionMock).toHaveBeenCalledTimes(2);
        expect(fakeSocket.emit).toHaveBeenCalledWith(REMATCH_EVENTS.JOIN_MATCH, {
            matchId: 'm2',
            playerId: 'p2',
        });

        const nextState = { votes: { p2: true }, ready: false, revision: 1 };
        act(() => {
            handlers.get(REMATCH_EVENTS.STATE_UPDATE)?.forEach((handler) => handler(nextState));
        });

        expect(stateSpy).toHaveBeenCalledTimes(2);
        expect(stateSpy).toHaveBeenLastCalledWith(nextState);

        unsubscribe();
        matchSocket.disconnect();
    });
});

describe('useTokenRefresh helpers', () => {
    const toBase64Url = (value: string) => (
        btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
    );

    it('parses base64url encoded JWT payload', () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const payload = {
            userId: 'u1',
            username: 'alice',
            iat: nowSeconds,
            exp: nowSeconds + 3600,
        };
        const token = [
            toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
            toBase64Url(JSON.stringify(payload)),
            'signature',
        ].join('.');

        expect(parseToken(token)).toEqual(payload);
        expect(getTimeUntilExpiry(token)).toBeGreaterThan(0);
    });
});
