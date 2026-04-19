import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import type { MatchMetadata, StoredMatchState } from '../../engine/transport/storage';
import { createClaimSeatHandler } from '../claimSeat';

const buildState = (ownerKey: string): StoredMatchState => ({
    G: { __setupData: { ownerKey } },
    _stateID: 0,
});

const buildMetadata = (ownerKey: string, playerName?: string): MatchMetadata => ({
    gameName: 'tictactoe',
    players: {
        0: { name: playerName },
        1: { name: 'P1' },
    },
    setupData: { ownerKey },
    createdAt: Date.now(),
    updatedAt: Date.now(),
} as MatchMetadata);

type SavedMatchData = {
    players?: Record<string, { name?: string; credentials?: string }>;
};

describe('claim-seat handler', () => {
    type ClaimSeatHandler = ReturnType<typeof createClaimSeatHandler>;
    type ClaimSeatContext = Parameters<ClaimSeatHandler>[0];

    it('登录用户 claim-seat 回填用户名并签发凭据', async () => {
        const jwtSecret = 'test-secret';
        const token = jwt.sign({ userId: 'u1', username: 'Alice' }, jwtSecret);
        const metadata = buildMetadata('user:u1');
        const state = buildState('user:u1');
        let savedPlayers: SavedMatchData['players'];

        const handler = createClaimSeatHandler({
            db: {
                fetch: async () => ({ metadata, state }),
                setMetadata: async (_id, nextMetadata) => {
                    savedPlayers = (nextMetadata as SavedMatchData).players;
                },
            },
            auth: { generateCredentials: () => 'new-cred' },
            jwtSecret,
        });

        const ctx: ClaimSeatContext = {
            get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : ''),
            request: { body: { playerID: '0' } },
            throw: (status: number, message: string) => {
                throw new Error(`${status}:${message}`);
            },
            body: undefined,
        };

        await handler(ctx, 'match-1');
        const savedPlayer = savedPlayers?.['0'];
        expect(savedPlayer?.name).toBe('Alice');
        expect(savedPlayer?.credentials).toBe('new-cred');
        expect((ctx.body as { playerCredentials?: string })?.playerCredentials).toBe('new-cred');
    });

    it('游客 claim-seat 使用 guestId 且回填昵称', async () => {
        const jwtSecret = 'test-secret';
        const metadata = buildMetadata('guest:g1');
        const state = buildState('guest:g1');
        let savedPlayers: SavedMatchData['players'];

        const handler = createClaimSeatHandler({
            db: {
                fetch: async () => ({ metadata, state }),
                setMetadata: async (_id, nextMetadata) => {
                    savedPlayers = (nextMetadata as SavedMatchData).players;
                },
            },
            auth: { generateCredentials: () => 'guest-cred' },
            jwtSecret,
        });

        const ctx: ClaimSeatContext = {
            get: () => '',
            request: { body: { playerID: '0', guestId: 'g1', playerName: '游客001' } },
            throw: (status: number, message: string) => {
                throw new Error(`${status}:${message}`);
            },
            body: undefined,
        };

        await handler(ctx, 'match-2');
        const savedPlayer = savedPlayers?.['0'];
        expect(savedPlayer?.name).toBe('游客001');
        expect(savedPlayer?.credentials).toBe('guest-cred');
    });
});
