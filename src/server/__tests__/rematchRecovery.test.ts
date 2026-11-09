import { describe, expect, it, vi } from 'vitest';
import { createRematchRecoveryReceipt, recoverCommittedRematch } from '../rematchRecovery';
import { parseRematchRecoveryRequest } from '../../shared/rematchRecovery';
import type { MatchMetadata } from '../../engine/transport/storage';

const recovery = { nextMatchID: 'abcdefghijklmnopqrstuv', token: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ' };
const make = (ownerType: 'guest' | 'user' = 'guest') => {
    const ownerKey = `${ownerType}:owner`;
    const metadata: MatchMetadata = {
        gameName: 'betrayal', createdAt: 0, updatedAt: 0,
        setupData: { ownerKey, ownerType }, players: { '0': { ownerKey, credentials: 'fresh-proof' } },
        rematchRecovery: createRematchRecoveryReceipt({ sourceMatchID: 'old', token: recovery.token,
            ownerCredentials: 'fresh-proof', ownerKey, ownerType, now: 100 }),
    };
    const fetch = vi.fn(async () => ({ metadata }));
    const args = { fetch, gameName: 'betrayal', sourceMatchID: 'old', recovery, now: 101 };
    return { metadata, fetch, args };
};
describe('read-only rematch receipt', () => {
    it('returns exactly the initial fresh seat proof and keeps only hashes', async () => {
        const h = make();
        expect(await recoverCommittedRematch(h.args)).toEqual({ exists: true, result: {
            matchID: recovery.nextMatchID, ownerPlayerID: '0', ownerCredentials: 'fresh-proof', ownerType: 'guest', ownerKey: 'guest:owner',
        } });
        expect(h.fetch).toHaveBeenCalledWith(recovery.nextMatchID, { metadata: true });
        expect(JSON.stringify(h.metadata.rematchRecovery)).not.toContain(recovery.token);
        expect(JSON.stringify(h.metadata.rematchRecovery)).not.toContain('fresh-proof');
    });
    it.each(['rotate', 'clear', 'owner', 'setup', 'expiry', 'malformed hash', 'missing receipt'])(
        'refuses %s without reissuing any credential', async (change) => {
            const h = make();
            if (change === 'rotate') h.metadata.players['0'].credentials = 'rotated';
            if (change === 'clear') delete h.metadata.players['0'].credentials;
            if (change === 'owner') h.metadata.players['0'].ownerKey = 'guest:other';
            if (change === 'setup') h.metadata.setupData = { ownerKey: 'guest:other', ownerType: 'guest' };
            if (change === 'expiry') h.metadata.rematchRecovery!.expiresAt = 101;
            if (change === 'malformed hash') h.metadata.rematchRecovery!.tokenHash = 'invalid';
            if (change === 'missing receipt') delete h.metadata.rematchRecovery;
            expect(await recoverCommittedRematch(h.args)).toEqual({ exists: true });
        });
    it('binds source, game, secret and signed-in owner', async () => {
        const h = make('user');
        for (const override of [{}, { authenticatedUserId: 'other' },
            { authenticatedUserId: 'owner', sourceMatchID: 'other' },
            { authenticatedUserId: 'owner', gameName: 'other' },
            { authenticatedUserId: 'owner', recovery: { ...recovery, token: 'wrong' } }]) {
            expect(await recoverCommittedRematch({ ...h.args, ...override })).toEqual({ exists: true });
        }
        expect((await recoverCommittedRematch({ ...h.args, authenticatedUserId: 'owner' })).result?.ownerCredentials).toBe('fresh-proof');
    });
    it('does not follow successor chains or recover a deleted target', async () => {
        const h = make();
        expect(await recoverCommittedRematch({ ...h.args, fetch: async () => ({}) })).toEqual({ exists: false });
    });
    it.each([null, [], {}, { ...recovery, nextMatchID: '../other' }, { ...recovery, token: 'short' }, { ...recovery, token: `${recovery.token}\n` }])('rejects malformed request %#', (value) => {
        expect(parseRematchRecoveryRequest(value)).toBeNull();
    });
});
