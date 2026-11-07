import { describe, expect, it, vi } from 'vitest';
import type { CreateMatchData } from '../../../engine/transport/storage';
import type { MongoStorage } from '../MongoStorage';
import { HybridStorage } from '../HybridStorage';

const data = (ownerType: 'guest' | 'user' = 'guest', finished = true): CreateMatchData => ({
    initialState: { G: {}, _stateID: 0 },
    metadata: {
        gameName: 'tictactoe', players: { '0': { credentials: 'synthetic-owner-proof' }, '1': {} },
        setupData: { ownerKey: `${ownerType}:synthetic`, ownerType },
        createdAt: 0, updatedAt: 0, ...(finished ? { gameover: { winner: '0' } } : {}),
    },
});
const build = () => new HybridStorage({ createMatch: vi.fn(), fetch: vi.fn() } as unknown as MongoStorage, { persistentEnabled: false });

describe('HybridStorage must not implicitly authenticate guest replacement', () => {
    it.each(['finished', 'empty', 'disconnected', 'legacy'] as const)('does not delete an old %s guest room when createMatch lacks proof', async kind => {
        const storage = build(); const old = data();
        if (kind === 'empty') { old.metadata.players = { '0': {}, '1': {} }; delete old.metadata.gameover; }
        if (kind === 'disconnected') { delete old.metadata.gameover; old.metadata.disconnectedSince = 1; }
        if (kind === 'legacy') old.metadata.setupData = { ownerKey: 'guest:synthetic' };
        await storage.createMatch('old', old);
        await expect(storage.createMatch('new', data())).rejects.toThrow('ACTIVE_MATCH_EXISTS:tictactoe:old');
        expect((await storage.fetch('old', { metadata: true })).metadata).toEqual(old.metadata);
        expect((await storage.fetch('new', { metadata: true })).metadata).toBeUndefined();
        expect(await storage.findMatchesByOwnerKey('guest:synthetic')).toEqual([{ matchID: 'old', gameName: 'tictactoe' }]);
    });
    it('supports creation after the authenticated application explicitly removed the old room', async () => {
        const storage = build(); await storage.createMatch('old', data());
        await storage.wipe('old'); await storage.createMatch('new', data());
        expect(await storage.listMatches()).toEqual(['new']);
    });
    it('requires atomic replacement for a finished account room too', async () => {
        const storage = build(); await storage.createMatch('old', data('user'));
        await expect(storage.createMatch('new', data('user'))).rejects.toThrow('ACTIVE_MATCH_EXISTS:tictactoe:old');
        expect(await storage.listMatches()).toEqual(['old']);
    });
});
