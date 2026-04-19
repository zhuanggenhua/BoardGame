import { describe, expect, it } from 'vitest';
import type { MatchMetadata } from '../../engine/transport/storage';
import {
    createMatchWithOwnerConflictRetry,
    decideDuplicateOwnerRoomAction,
    DUPLICATE_OWNER_DISCONNECT_GRACE_MS,
    parseActiveMatchExistsConflict,
    planDuplicateOwnerRoomCreate,
} from '../duplicateOwnerRooms';

const buildMetadata = (overrides?: Partial<MatchMetadata>): MatchMetadata => ({
    gameName: 'tictactoe',
    players: {
        0: {},
        1: {},
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
});

describe('decideDuplicateOwnerRoomAction', () => {
    it('blocks occupied active rooms', () => {
        const metadata = buildMetadata({
            players: {
                0: { name: 'Alice', credentials: 'cred-a', isConnected: true },
                1: {},
            },
        });

        expect(decideDuplicateOwnerRoomAction(metadata)).toEqual({
            action: 'block',
            reason: 'active_or_occupied',
        });
    });

    it('allows cleanup for empty rooms', () => {
        const metadata = buildMetadata();

        expect(decideDuplicateOwnerRoomAction(metadata)).toEqual({
            action: 'cleanup',
            reason: 'empty_room',
        });
    });

    it('allows cleanup for gameover rooms', () => {
        const metadata = buildMetadata({
            gameover: { winner: '0' },
            players: {
                0: { name: 'Alice', credentials: 'cred-a' },
                1: { name: 'Bob', credentials: 'cred-b' },
            },
        });

        expect(decideDuplicateOwnerRoomAction(metadata)).toEqual({
            action: 'cleanup',
            reason: 'gameover',
        });
    });

    it('allows cleanup for disconnected timeout rooms', () => {
        const now = Date.now();
        const metadata = buildMetadata({
            disconnectedSince: now - DUPLICATE_OWNER_DISCONNECT_GRACE_MS - 1,
            players: {
                0: { name: 'Alice', credentials: 'cred-a', isConnected: false },
                1: {},
            },
        });

        expect(decideDuplicateOwnerRoomAction(metadata, { now })).toEqual({
            action: 'cleanup',
            reason: 'disconnect_timeout',
        });
    });

    it('create plan blocks active rooms by default and keeps cleanable rooms for cleanup', () => {
        const activeMetadata = buildMetadata({
            updatedAt: 200,
            players: {
                0: { name: 'Alice', credentials: 'cred-a', isConnected: true },
                1: {},
            },
        });
        const emptyMetadata = buildMetadata({
            updatedAt: 100,
        });

        const plan = planDuplicateOwnerRoomCreate([
            {
                matchID: 'active-room',
                gameName: 'tictactoe',
                metadata: activeMetadata,
                decision: decideDuplicateOwnerRoomAction(activeMetadata),
            },
            {
                matchID: 'empty-room',
                gameName: 'tictactoe',
                metadata: emptyMetadata,
                decision: decideDuplicateOwnerRoomAction(emptyMetadata),
            },
        ]);

        expect(plan.action).toBe('block');
        if (plan.action !== 'block') {
            throw new Error('expected block plan');
        }
        expect(plan.activeMatch.matchID).toBe('active-room');
        expect(plan.cleanupMatches.map((match) => match.matchID)).toEqual(['empty-room']);
    });

    it('create plan forceReplaceActive=true 时会把活跃旧房也加入 cleanup 列表', () => {
        const activeMetadata = buildMetadata({
            updatedAt: 300,
            players: {
                0: { name: 'Alice', credentials: 'cred-a', isConnected: true },
                1: {},
            },
        });

        const plan = planDuplicateOwnerRoomCreate([
            {
                matchID: 'active-room',
                gameName: 'tictactoe',
                metadata: activeMetadata,
                decision: decideDuplicateOwnerRoomAction(activeMetadata),
            },
        ], {
            forceReplaceActive: true,
        });

        expect(plan).toEqual({
            action: 'allow',
            cleanupMatches: [{
                matchID: 'active-room',
                gameName: 'tictactoe',
                metadata: activeMetadata,
                decision: {
                    action: 'block',
                    reason: 'active_or_occupied',
                },
            }],
        });
    });
});

describe('parseActiveMatchExistsConflict', () => {
    it('parses ACTIVE_MATCH_EXISTS legacy error text', () => {
        expect(parseActiveMatchExistsConflict(new Error('ACTIVE_MATCH_EXISTS:dicethrone:match-1'))).toEqual({
            gameName: 'dicethrone',
            matchID: 'match-1',
        });
    });

    it('returns null for unrelated errors', () => {
        expect(parseActiveMatchExistsConflict(new Error('boom'))).toBeNull();
    });
});

describe('createMatchWithOwnerConflictRetry', () => {
    it('returns conflict immediately when forceReplaceActive is disabled', async () => {
        const createMatch = async () => {
            throw new Error('ACTIVE_MATCH_EXISTS:dicethrone:match-old');
        };
        const fetchConflictMetadata = async () => buildMetadata();
        const cleanupConflictMatch = async () => undefined;

        await expect(createMatchWithOwnerConflictRetry({
            createMatch,
            fetchConflictMetadata,
            cleanupConflictMatch,
            forceReplaceActive: false,
        })).resolves.toEqual({
            action: 'conflict',
            conflict: {
                gameName: 'dicethrone',
                matchID: 'match-old',
            },
        });
    });

    it('forceReplaceActive=true 时会清理冲突房间后重试创建', async () => {
        let attempt = 0;
        const createMatch = async () => {
            attempt += 1;
            if (attempt === 1) {
                throw new Error('ACTIVE_MATCH_EXISTS:dicethrone:match-old');
            }
        };
        const fetchConflictMetadata = async () => buildMetadata({ gameName: 'dicethrone' });
        const cleaned: string[] = [];
        const cleanupConflictMatch = async (matchID: string) => {
            cleaned.push(matchID);
        };

        await expect(createMatchWithOwnerConflictRetry({
            createMatch,
            fetchConflictMetadata,
            cleanupConflictMatch,
            forceReplaceActive: true,
        })).resolves.toEqual({
            action: 'created',
        });
        expect(cleaned).toEqual(['match-old']);
        expect(attempt).toBe(2);
    });

    it('超过强制清理重试上限后返回 conflict，而不是抛 unknown 错误', async () => {
        const createMatch = async () => {
            throw new Error('ACTIVE_MATCH_EXISTS:dicethrone:match-old');
        };
        const fetchConflictMetadata = async () => buildMetadata({ gameName: 'dicethrone' });
        const cleaned: string[] = [];
        const cleanupConflictMatch = async (matchID: string) => {
            cleaned.push(matchID);
        };

        await expect(createMatchWithOwnerConflictRetry({
            createMatch,
            fetchConflictMetadata,
            cleanupConflictMatch,
            forceReplaceActive: true,
            maxForceCleanupRetries: 2,
        })).resolves.toEqual({
            action: 'conflict',
            conflict: {
                gameName: 'dicethrone',
                matchID: 'match-old',
            },
        });
        expect(cleaned).toEqual(['match-old', 'match-old']);
    });

    it('非 ACTIVE_MATCH_EXISTS 错误继续向上抛出', async () => {
        const fetchConflictMetadata = async () => buildMetadata();
        const cleanupConflictMatch = async () => undefined;

        await expect(createMatchWithOwnerConflictRetry({
            createMatch: async () => {
                throw new Error('boom');
            },
            fetchConflictMetadata,
            cleanupConflictMatch,
            forceReplaceActive: true,
        })).rejects.toThrow('boom');
    });
});
