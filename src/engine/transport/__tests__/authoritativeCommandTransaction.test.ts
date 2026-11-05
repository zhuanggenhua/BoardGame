import { describe, expect, it, vi } from 'vitest';
import { createInitialSystemState } from '../../pipeline';
import { createTrackedRandom } from '../trackedRandom';
import type { MatchMetadata } from '../storage';
import { executeAuthoritativeTransaction } from '../authoritativeCommandTransaction';

function createMatch() {
    const tracked = createTrackedRandom('transaction-seed', 2);
    const metadata: MatchMetadata = {
        gameName: 'test', players: { '0': { isConnected: false } }, createdAt: 1, updatedAt: 1,
    };
    return {
        matchID: 'transaction-match', state: { core: { count: 0 }, sys: createInitialSystemState(['0', '1'], []) },
        metadata, stateID: 1, randomSeed: 'transaction-seed', random: tracked.random, getRandomCursor: tracked.getCursor,
        lastCommandPlayerId: null as string | null, lastCommandFailureReason: null as string | null,
        lastBroadcastedViews: new Map<string, unknown>(), unloaded: false,
    };
}

describe('authoritative business transaction', () => {
    it('discards state, RNG and terminal effects when a later command rejects', async () => {
        const match = createMatch();
        const effect = vi.fn(async () => undefined);
        const persistState = vi.fn(async () => undefined);
        const result = await executeAuthoritativeTransaction({
            match, persistState, succeeded: (success) => success, onEffectError: vi.fn(),
            execute: async (working, effects) => {
                working.state.core.count += 1;
                working.random.random();
                working.metadata.gameover = { winner: '0' };
                working.stateID += 1;
                effects.push(effect);
                return false;
            },
        });
        expect(result).toBe(false);
        expect(match.state.core.count).toBe(0);
        expect(match.stateID).toBe(1);
        expect(match.getRandomCursor()).toBe(2);
        expect(match.metadata.gameover).toBeUndefined();
        expect(persistState).not.toHaveBeenCalled();
        expect(effect).not.toHaveBeenCalled();
    });

    it('persists once before publishing, and preserves reconnect metadata', async () => {
        const match = createMatch();
        const observed: number[] = [];
        const persistState = vi.fn(async () => {
            expect(match.state.core.count).toBe(0);
            expect(observed).toEqual([]);
            match.metadata.players['0'].isConnected = true;
        });
        await executeAuthoritativeTransaction({
            match, persistState, succeeded: (success) => success, onEffectError: vi.fn(),
            execute: async (working, effects) => {
                working.state.core.count = 2;
                working.stateID += 2;
                working.random.random();
                effects.push(async (committed, final) => { observed.push(committed.state.core.count); expect(final).toBe(false); });
                effects.push(async (_, final) => { expect(final).toBe(true); });
                return true;
            },
        });
        expect(persistState).toHaveBeenCalledTimes(1);
        expect(match.state.core.count).toBe(2);
        expect(match.stateID).toBe(3);
        expect(match.getRandomCursor()).toBe(3);
        expect(match.metadata.players['0'].isConnected).toBe(true);
        expect(observed).toEqual([2]);
    });

    it('keeps live state private when storage rejects', async () => {
        const match = createMatch();
        const effect = vi.fn(async () => undefined);
        await expect(executeAuthoritativeTransaction({
            match, persistState: async () => { throw new Error('storage unavailable'); },
            succeeded: (success) => success, onEffectError: vi.fn(),
            execute: async (working, effects) => { working.state.core.count = 1; effects.push(effect); return true; },
        })).rejects.toThrow('storage unavailable');
        expect(match.state.core.count).toBe(0);
        expect(effect).not.toHaveBeenCalled();
    });

    it('does not reject durable business success after a notification fails', async () => {
        const match = createMatch();
        const onEffectError = vi.fn();
        const result = await executeAuthoritativeTransaction({
            match, persistState: async () => undefined, succeeded: (success) => success, onEffectError,
            execute: async (working, effects) => {
                working.state.core.count = 1;
                effects.push(async () => { throw new Error('notification unavailable'); });
                return true;
            },
        });
        expect(result).toBe(true);
        expect(match.state.core.count).toBe(1);
        expect(onEffectError).toHaveBeenCalledTimes(1);
    });

    it('does not publish or deliver effects after a room unloads during storage', async () => {
        const match = createMatch();
        const effect = vi.fn(async () => undefined);
        await expect(executeAuthoritativeTransaction({
            match, persistState: async () => { match.unloaded = true; },
            succeeded: (success) => success, onEffectError: vi.fn(),
            execute: async (working, effects) => { working.state.core.count = 1; effects.push(effect); return true; },
        })).rejects.toThrow('match_unloaded');
        expect(match.state.core.count).toBe(0);
        expect(effect).not.toHaveBeenCalled();
    });
});
