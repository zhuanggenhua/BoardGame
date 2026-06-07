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

const cloneMetadata = (metadata: MatchMetadata): MatchMetadata => JSON.parse(JSON.stringify(metadata)) as MatchMetadata;

const createClaimSeatTestDb = (
    metadataRef: { current: MatchMetadata },
    state: StoredMatchState,
    onSave?: (metadata: MatchMetadata) => void,
) => ({
    fetch: async () => ({ metadata: cloneMetadata(metadataRef.current), state }),
    setMetadata: async (_id: string, nextMetadata: MatchMetadata) => {
        metadataRef.current = nextMetadata;
        onSave?.(nextMetadata);
    },
    claimSeatMetadata: async (_id: string, input: {
        playerID: string;
        playerCredentials: string;
        playerName?: string;
        updatedAt?: number;
    }) => {
        const current = metadataRef.current;
        const player = current.players[input.playerID];
        if (!player) {
            return { metadata: current, playerExists: false };
        }
        const existingCredentials = typeof player.credentials === 'string' && player.credentials.trim()
            ? player.credentials
            : undefined;
        const playerCredentials = existingCredentials ?? input.playerCredentials;
        const nextMetadata: MatchMetadata = {
            ...current,
            updatedAt: input.updatedAt ?? Date.now(),
            players: {
                ...current.players,
                [input.playerID]: {
                    ...player,
                    credentials: playerCredentials,
                    name: player.name || input.playerName || player.name,
                },
            },
        };
        metadataRef.current = nextMetadata;
        onSave?.(nextMetadata);
        return { metadata: nextMetadata, playerExists: true, playerCredentials };
    },
});

describe('claim-seat handler', () => {
    type ClaimSeatHandler = ReturnType<typeof createClaimSeatHandler>;
    type ClaimSeatContext = Parameters<ClaimSeatHandler>[0];

    it('登录用户 claim-seat 回填用户名并签发凭据', async () => {
        const jwtSecret = 'test-secret';
        const token = jwt.sign({ userId: 'u1', username: 'Alice' }, jwtSecret);
        const metadataRef = { current: buildMetadata('user:u1') };
        const state = buildState('user:u1');
        let savedPlayers: SavedMatchData['players'];

        const handler = createClaimSeatHandler({
            db: createClaimSeatTestDb(metadataRef, state, (nextMetadata) => {
                savedPlayers = (nextMetadata as SavedMatchData).players;
            }),
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
        const metadataRef = { current: buildMetadata('guest:g1') };
        const state = buildState('guest:g1');
        let savedPlayers: SavedMatchData['players'];

        const handler = createClaimSeatHandler({
            db: createClaimSeatTestDb(metadataRef, state, (nextMetadata) => {
                savedPlayers = (nextMetadata as SavedMatchData).players;
            }),
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

    it('重复 claim-seat 已占座位时返回既有凭据，避免并发补领覆盖 AI 座位凭据', async () => {
        const jwtSecret = 'test-secret';
        const metadataRef = { current: buildMetadata('guest:g1') };
        metadataRef.current.players['1'] = {
            name: 'AI-1',
            credentials: 'existing-ai-cred',
        };
        const state = buildState('guest:g1');
        let savedPlayers: SavedMatchData['players'];

        const handler = createClaimSeatHandler({
            db: createClaimSeatTestDb(metadataRef, state, (nextMetadata) => {
                savedPlayers = (nextMetadata as SavedMatchData).players;
            }),
            auth: {
                generateCredentials: () => {
                    throw new Error('重复 claim 不应重新签发凭据');
                },
            },
            jwtSecret,
        });

        const ctx: ClaimSeatContext = {
            get: () => '',
            request: { body: { playerID: '1', guestId: 'g1', playerName: 'AI-1' } },
            throw: (status: number, message: string) => {
                throw new Error(`${status}:${message}`);
            },
            body: undefined,
        };

        await handler(ctx, 'match-ai-race');

        expect((ctx.body as { playerCredentials?: string })?.playerCredentials).toBe('existing-ai-cred');
        expect(savedPlayers?.['1']?.credentials).toBe('existing-ai-cred');
    });

    it('并发 claim 多个 AI 座位时保留所有座位凭据', async () => {
        const jwtSecret = 'test-secret';
        const metadataRef = { current: buildMetadata('guest:g1') };
        metadataRef.current.players = {
            0: { name: 'Host', credentials: 'host-cred' },
            1: { name: 'AI-1' },
            2: { name: 'AI-2' },
            3: { name: 'AI-3' },
        };
        const state = buildState('guest:g1');
        let fullReplacementWrites = 0;

        const handler = createClaimSeatHandler({
            db: {
                ...createClaimSeatTestDb(metadataRef, state),
                setMetadata: async (_id, nextMetadata) => {
                    fullReplacementWrites += 1;
                    metadataRef.current = nextMetadata;
                },
            },
            auth: {
                generateCredentials: (ctx) => `cred-${ctx.request.body?.playerID}`,
            },
            jwtSecret,
        });

        const makeCtx = (playerID: string): ClaimSeatContext => ({
            get: () => '',
            request: { body: { playerID, guestId: 'g1', playerName: `AI-${playerID}` } },
            throw: (status: number, message: string) => {
                throw new Error(`${status}:${message}`);
            },
            body: undefined,
        });

        const contexts = ['1', '2', '3'].map(makeCtx);
        await Promise.all(contexts.map((ctx) => handler(ctx, 'match-ai-race')));

        expect(fullReplacementWrites).toBe(0);
        expect(metadataRef.current.players['1']?.credentials).toBe('cred-1');
        expect(metadataRef.current.players['2']?.credentials).toBe('cred-2');
        expect(metadataRef.current.players['3']?.credentials).toBe('cred-3');
        expect(contexts.map((ctx) => (ctx.body as { playerCredentials?: string }).playerCredentials).sort())
            .toEqual(['cred-1', 'cred-2', 'cred-3']);
    });
});
