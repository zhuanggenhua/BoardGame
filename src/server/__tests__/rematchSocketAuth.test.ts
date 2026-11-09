import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as rematch from '../rematch';
import type { MatchMetadata } from '../../engine/transport/storage';

const source = ts.createSourceFile('server.ts', readFileSync('server.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const events = { JOIN_MATCH: 'join', LEAVE_MATCH: 'leave', VOTE: 'vote', STATE_UPDATE: 'state', TRIGGER_RESET: 'reset', DEBUG_NEW_ROOM: 'new-room' };
function callback(event: keyof typeof events | 'RESET_STATE', env: Record<string, unknown>) {
    let expression: ts.Expression | undefined;
    function visit(node: ts.Node) {
        if (event === 'RESET_STATE' && ts.isVariableDeclaration(node)
            && node.name.getText(source) === 'scheduleRematchStateReset') expression = node.initializer;
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'socket.on'
            && node.arguments[0]?.getText(source) === `REMATCH_EVENTS.${event}`) expression = node.arguments[1];
        ts.forEachChild(node, visit);
    }
    visit(source);
    if (!expression) throw new Error('Production socket handler not found');
    const js = ts.transpileModule(`(${expression.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
    return runInNewContext(js.outputText, { ...env, Error }) as (payload?: unknown) => Promise<void>;
}
function room(): MatchMetadata {
    return { gameName: 'betrayal', createdAt: 0, updatedAt: 0,
        setupData: { ownerKey: 'guest:owner', ownerType: 'guest' },
        players: { '0': { name: 'Owner', credentials: 'owner-proof' }, '1': { name: 'Other', credentials: 'other-proof' } },
    };
}
function harness() {
    const rooms = new Map([['old', room()], ['new', room()]]);
    rooms.get('new')!.players['0'].credentials = 'new-proof';
    const broadcast = vi.fn();
    const timers: Array<() => void> = [];
    const socket = { id: 'socket-1', data: {} as Record<string, unknown>, join: vi.fn(), leave: vi.fn(), emit: vi.fn(), to: vi.fn(() => ({ emit: broadcast })) };
    const state = { votes: {}, ready: false, revision: 0 };
    const env = {
        ...rematch, socket, REMATCH_EVENTS: events,
        setTimeout: (timer: () => void) => { timers.push(timer); return timers.length; },
        storage: { fetch: vi.fn(async (id: string) => ({ metadata: rooms.get(id) })) },
        fetchRematchMetadata: vi.fn(async (id: string) => rooms.get(id)),
        logger: { warn: vi.fn(), info: vi.fn() },
        matchSubscribers: new Map<string, Set<string>>(), rematchStateByMatch: new Map([['old', state]]),
        resolveAutoAcceptedRematchPlayerIds: vi.fn(async () => []),
        normalizeRematchPlayerIds: (value: unknown) => Array.isArray(value) ? value : [],
        lobbySocketIO: { to: vi.fn(() => ({ emit: broadcast })) }, scheduleRematchStateReset: vi.fn(),
    };
    env.scheduleRematchStateReset.mockImplementation((matchId: string) => callback('RESET_STATE', env)(matchId));
    return { env, socket, rooms, state, broadcast, timers, run: (event: keyof typeof events, payload?: unknown) => callback(event, env)(payload) };
}

describe('production rematch socket authentication', () => {
    it.each([undefined, '', 'wrong', 'other-proof'])('rejects impersonated owner subscription: %s', async credentials => {
        const h = harness();
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials });
        expect(h.socket.join).not.toHaveBeenCalled();
        expect(h.socket.emit).not.toHaveBeenCalled();
        expect(h.socket.data.rematchMatchId).toBeUndefined();
    });
    it('admits a real seat and revalidates credentials at each vote', async () => {
        const h = harness();
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        await h.run('VOTE');
        expect(h.state.votes).toEqual({ '0': true });
        h.rooms.get('old')!.players['0'].credentials = 'rotated-proof';
        await h.run('VOTE');
        expect(h.state.votes).toEqual({ '0': true });
    });
    it('cannot trigger reset using unauthenticated socket identity', async () => {
        const h = harness(); h.state.votes = { '1': true };
        h.socket.data = { rematchMatchId: 'old', rematchPlayerId: '0', rematchCredentials: 'wrong' };
        await h.run('VOTE');
        expect(h.state.ready).toBe(false);
        expect(h.broadcast).not.toHaveBeenCalled();
    });
    it('announces only an owned new room with a fresh P0 proof and server-generated URL', async () => {
        const h = harness();
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        // The old match may already be gone after the authorized create completed.
        h.rooms.delete('old');
        await h.run('DEBUG_NEW_ROOM', { matchID: 'new', credentials: 'new-proof', url: 'https://attacker.invalid' });
        expect(h.broadcast).toHaveBeenCalledWith('new-room', { url: '/play/betrayal/match/new' });
        expect(JSON.stringify(h.broadcast.mock.calls)).not.toContain('new-proof');
    });
    it.each([
        { url: 'https://attacker.invalid' },
        { matchID: 'new', credentials: 'wrong' },
        { matchID: 'old', credentials: 'owner-proof' },
    ])('rejects arbitrary new-room broadcast: %j', async payload => {
        const h = harness();
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        await h.run('DEBUG_NEW_ROOM', payload);
        expect(h.broadcast).not.toHaveBeenCalled();
    });
    it.each(['owner', 'game', 'seat'])('rejects mismatched new-room authority: %s', async kind => {
        const h = harness();
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: kind === 'seat' ? '1' : '0', credentials: kind === 'seat' ? 'other-proof' : 'owner-proof' });
        if (kind === 'owner') h.rooms.get('new')!.setupData = { ownerKey: 'guest:another' };
        if (kind === 'game') h.rooms.get('new')!.gameName = 'mage-wars';
        await h.run('DEBUG_NEW_ROOM', { matchID: 'new', credentials: 'new-proof' });
        expect(h.broadcast).not.toHaveBeenCalled();
    });
    it('clears held authority when leaving the room', async () => {
        const h = harness();
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        await h.run('LEAVE_MATCH');
        expect(h.socket.data.rematchCredentials).toBeUndefined();
        expect(h.socket.data.rematchOwnerKey).toBeUndefined();
        await h.run('DEBUG_NEW_ROOM', { matchID: 'new', credentials: 'new-proof' });
        expect(h.broadcast).not.toHaveBeenCalled();
    });
    it.each([false, true])('drops an old vote after same-room rejoin with other subscribers: %s', async keepRound => {
        const h = harness();
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        let release!: (value: MatchMetadata) => void;
        h.env.fetchRematchMetadata.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = h.run('VOTE');
        if (keepRound) h.env.matchSubscribers.get('old')!.add('other-socket');
        await h.run('LEAVE_MATCH');
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        release(room()); await pending;
        expect(h.env.rematchStateByMatch.get('old')).toEqual({ votes: {}, ready: false, revision: 0 });
        expect(h.broadcast).not.toHaveBeenCalled();
        await h.run('VOTE');
        expect(h.env.rematchStateByMatch.get('old')?.votes).toEqual({ '0': true });
    });

    it('does not let a late duplicate vote cancel a ready rematch', async () => {
        const h = harness(); h.state.votes = { '1': true };
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        let release!: (value: MatchMetadata) => void;
        h.env.fetchRematchMetadata.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = h.run('VOTE');
        await h.run('VOTE');
        expect(h.state.ready).toBe(true);
        release(room()); await pending;
        expect(h.state).toEqual({ votes: { '0': true, '1': true }, ready: true, revision: 1 });
        expect(h.broadcast.mock.calls.filter(([event]) => event === events.TRIGGER_RESET)).toHaveLength(1);
        expect(h.env.scheduleRematchStateReset).toHaveBeenCalledExactlyOnceWith('old');
    });

    it('accepts concurrent votes from different authenticated players in the same round', async () => {
        const h = harness();
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        const follower = { ...h.socket, id: 'socket-2', data: {} };
        const followerEnv = { ...h.env, socket: follower };
        await callback('JOIN_MATCH', followerEnv)({ matchId: 'old', playerId: '1', credentials: 'other-proof' });
        let release!: (value: MatchMetadata) => void;
        h.env.fetchRematchMetadata.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const ownerVote = h.run('VOTE');
        await callback('VOTE', followerEnv)();
        release(room()); await ownerVote;
        expect(h.state).toEqual({ votes: { '0': true, '1': true }, ready: true, revision: 2 });
        expect(h.broadcast.mock.calls.filter(([event]) => event === events.TRIGGER_RESET)).toHaveLength(1);
    });

    it('drops an old vote that returns after the completed round has reset', async () => {
        const h = harness(); h.state.votes = { '1': true };
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        let release!: (value: MatchMetadata) => void;
        h.env.fetchRematchMetadata.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = h.run('VOTE');
        await h.run('VOTE');
        h.timers.shift()!();
        h.broadcast.mockClear();
        release(room()); await pending;
        expect(h.env.rematchStateByMatch.get('old')).toEqual({ votes: {}, ready: false, revision: 2 });
        expect(h.broadcast).not.toHaveBeenCalled();
        await h.run('VOTE');
        expect(h.env.rematchStateByMatch.get('old')?.votes).toEqual({ '0': true });
    });

    it('does not let a previous round timer reset a newer room subscription', async () => {
        const h = harness(); h.state.votes = { '1': true };
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        await h.run('VOTE');
        await h.run('LEAVE_MATCH');
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        await h.run('VOTE');
        h.broadcast.mockClear();
        h.timers.shift()!();
        expect(h.env.rematchStateByMatch.get('old')).toEqual({ votes: { '0': true }, ready: false, revision: 1 });
        expect(h.broadcast).not.toHaveBeenCalled();
    });

    it.each(['same-owner', 'different-seat'] as const)('drops a pending owner broadcast after same-room rejoin: %s', async identity => {
        const h = harness();
        await h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        let release!: (value: MatchMetadata) => void;
        h.env.fetchRematchMetadata.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = h.run('DEBUG_NEW_ROOM', { matchID: 'new', credentials: 'new-proof' });
        await h.run('LEAVE_MATCH');
        await h.run('JOIN_MATCH', { matchId: 'old',
            playerId: identity === 'same-owner' ? '0' : '1',
            credentials: identity === 'same-owner' ? 'owner-proof' : 'other-proof',
        });
        release(h.rooms.get('new')!); await pending;
        expect(h.broadcast).not.toHaveBeenCalled();
    });

    it('does not resurrect a subscription after leave interrupts credential verification', async () => {
        const h = harness();
        let release!: (value: MatchMetadata) => void;
        h.env.fetchRematchMetadata.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = h.run('JOIN_MATCH', { matchId: 'old', playerId: '0', credentials: 'owner-proof' });
        await h.run('LEAVE_MATCH');
        release(room()); await pending;
        expect(h.socket.join).not.toHaveBeenCalled();
        expect(h.socket.data.rematchCredentials).toBeUndefined();
    });
});
