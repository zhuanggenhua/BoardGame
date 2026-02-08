import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Server, State } from 'boardgame.io';
import { evaluateEmptyRoomJoinGuard } from '../joinGuard';

const buildState = (ownerKey?: string): State => ({
    G: { __setupData: ownerKey ? { ownerKey } : {} },
    ctx: {
        numPlayers: 2,
        playOrder: ['0', '1'],
        playOrderPos: 0,
        activePlayers: null,
        currentPlayer: '0',
        turn: 0,
        phase: 'default',
        gameover: null,
    },
    plugins: {},
    _undo: [],
    _redo: [],
    _stateID: 0,
});

const buildPlayers = (overrides: Record<string, Partial<Server.PlayerMetadata>> = {}) => {
    const base: Record<string, Server.PlayerMetadata> = {
        0: { id: 0 },
        1: { id: 1 },
    };
    Object.entries(overrides).forEach(([key, value]) => {
        base[key] = { ...base[key], ...value };
    });
    return base;
};

const buildMetadata = (ownerKey?: string, players?: Record<string, Server.PlayerMetadata>): Server.MatchData => ({
    gameName: 'tictactoe',
    players: players ?? buildPlayers(),
    setupData: ownerKey ? { ownerKey } : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
});

describe('evaluateEmptyRoomJoinGuard', () => {
    it('允许非空房间加入', () => {
        const metadata = buildMetadata('guest:g1', buildPlayers({
            0: { name: 'Alice' },
        }));

        const guard = evaluateEmptyRoomJoinGuard({
            metadata,
            state: buildState('guest:g1'),
            guestId: 'g2',
            jwtSecret: 'secret',
        });

        expect(guard.allowed).toBe(true);
        expect(guard.isEmptyRoom).toBe(false);
    });

    it('空房间仅允许房主 guest 重连', () => {
        const metadata = buildMetadata('guest:g1');

        const guard = evaluateEmptyRoomJoinGuard({
            metadata,
            state: buildState('guest:g1'),
            guestId: 'g1',
            jwtSecret: 'secret',
        });

        expect(guard.allowed).toBe(true);
        expect(guard.isEmptyRoom).toBe(true);
        expect(guard.ownerKey).toBe('guest:g1');
        expect(guard.requesterKey).toBe('guest:g1');
    });

    it('空房间拒绝非房主 guest 加入', () => {
        const metadata = buildMetadata('guest:g1');

        const guard = evaluateEmptyRoomJoinGuard({
            metadata,
            state: buildState('guest:g1'),
            guestId: 'g2',
            jwtSecret: 'secret',
        });

        expect(guard.allowed).toBe(false);
        expect(guard.reason).toBe('not_owner');
        expect(guard.status).toBe(403);
    });

    it('空房间允许房主 user token 重连', () => {
        const jwtSecret = 'secret';
        const token = jwt.sign({ userId: 'u1' }, jwtSecret);
        const metadata = buildMetadata('user:u1');

        const guard = evaluateEmptyRoomJoinGuard({
            metadata,
            state: buildState('user:u1'),
            authHeader: `Bearer ${token}`,
            jwtSecret,
        });

        expect(guard.allowed).toBe(true);
        expect(guard.requesterKey).toBe('user:u1');
    });

    it('空房间遇到非法 token 直接拒绝', () => {
        const metadata = buildMetadata('user:u1');

        const guard = evaluateEmptyRoomJoinGuard({
            metadata,
            state: buildState('user:u1'),
            authHeader: 'Bearer invalid.token.payload',
            jwtSecret: 'secret',
        });

        expect(guard.allowed).toBe(false);
        expect(guard.reason).toBe('invalid_token');
        expect(guard.status).toBe(401);
    });

    it('空房间缺失 ownerKey 时拒绝', () => {
        const metadata = buildMetadata();

        const guard = evaluateEmptyRoomJoinGuard({
            metadata,
            state: buildState(),
            guestId: 'g1',
            jwtSecret: 'secret',
        });

        expect(guard.allowed).toBe(false);
        expect(guard.reason).toBe('missing_owner');
        expect(guard.status).toBe(403);
    });
});
