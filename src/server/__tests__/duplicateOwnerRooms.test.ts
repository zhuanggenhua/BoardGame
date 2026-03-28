import { describe, expect, it } from 'vitest';
import type { MatchMetadata } from '../../engine/transport/storage';
import {
    decideDuplicateOwnerRoomAction,
    DUPLICATE_OWNER_DISCONNECT_GRACE_MS,
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
});
