/* @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => void>(),
    socket: { connected: true, active: true, emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    release: vi.fn(),
}));
vi.mock('../../services/lobbySocket', () => ({ lobbySocket: {
    acquireConnection: () => mocks.socket,
    getSharedSocket: () => mocks.socket,
    releaseConnection: mocks.release,
} }));
import { matchSocket, REMATCH_EVENTS } from '../../services/matchSocket';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.socket.connected = true;
    mocks.socket.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => { mocks.handlers.set(event, handler); });
    mocks.socket.off.mockImplementation((event: string) => { mocks.handlers.delete(event); });
});
afterEach(() => { matchSocket.disconnect(); });

describe('authenticated rematch socket contract', () => {
    it('sends saved seat proof on join, reconnect and AI-seat updates', () => {
        matchSocket.joinMatch('old', '0', { credentials: 'old-proof', autoAcceptedPlayerIds: ['1'] });
        expect(mocks.socket.emit).toHaveBeenLastCalledWith(REMATCH_EVENTS.JOIN_MATCH, {
            matchId: 'old', playerId: '0', credentials: 'old-proof', autoAcceptedPlayerIds: ['1'],
        });
        mocks.handlers.get('connect')!();
        expect(mocks.socket.emit).toHaveBeenLastCalledWith(REMATCH_EVENTS.JOIN_MATCH, {
            matchId: 'old', playerId: '0', credentials: 'old-proof', autoAcceptedPlayerIds: ['1'],
        });
        matchSocket.setAutoAcceptedPlayerIds(['2']);
        expect(mocks.socket.emit).toHaveBeenLastCalledWith(REMATCH_EVENTS.JOIN_MATCH, {
            matchId: 'old', playerId: '0', credentials: 'old-proof', autoAcceptedPlayerIds: ['2'],
        });
    });

    it('does not join, vote or broadcast without proof, including after leaving a previous room', () => {
        matchSocket.joinMatch('old', '0', { credentials: 'old-proof' });
        matchSocket.leaveMatch();
        mocks.socket.emit.mockClear();
        matchSocket.joinMatch('new', '0');
        matchSocket.setAutoAcceptedPlayerIds(['1']);
        matchSocket.connect();
        matchSocket.vote();
        matchSocket.broadcastNewRoom('/play/betrayal/match/new', 'new-proof');
        expect(mocks.socket.emit.mock.calls.some(([event]) => [REMATCH_EVENTS.JOIN_MATCH, REMATCH_EVENTS.VOTE, REMATCH_EVENTS.DEBUG_NEW_ROOM].includes(event))).toBe(false);
        expect(mocks.release).toHaveBeenCalledWith('match');
    });

    it('broadcasts only a parsed match ID and new P0 proof, never a URL', () => {
        matchSocket.joinMatch('old', '0', { credentials: 'old-proof' });
        mocks.socket.emit.mockClear();
        matchSocket.broadcastNewRoom('/play/betrayal/match/new', 'new-proof');
        expect(mocks.socket.emit).toHaveBeenCalledExactlyOnceWith(REMATCH_EVENTS.DEBUG_NEW_ROOM, { matchID: 'new', credentials: 'new-proof' });
    });

    it('rejects arbitrary navigation URLs, missing proof and non-owner broadcasts', () => {
        matchSocket.joinMatch('old', '0', { credentials: 'old-proof' });
        mocks.socket.emit.mockClear();
        for (const url of ['https://evil.test/play/betrayal/match/new', '//evil.test', '/play/betrayal/match/new?redirect=evil', '/play/betrayal/match/../evil']) {
            matchSocket.broadcastNewRoom(url, 'new-proof');
        }
        matchSocket.broadcastNewRoom('/play/betrayal/match/new');
        expect(mocks.socket.emit).not.toHaveBeenCalled();
        matchSocket.joinMatch('old', '1', { credentials: 'other-proof' });
        mocks.socket.emit.mockClear();
        matchSocket.broadcastNewRoom('/play/betrayal/match/new', 'new-proof');
        expect(mocks.socket.emit).not.toHaveBeenCalled();
    });
});
