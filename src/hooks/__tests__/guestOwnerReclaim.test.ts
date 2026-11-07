/* @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimSeat, persistMatchCredentials, setOwnerActiveMatch } from '../match/useMatchStatus';

describe('guest room owner after account login', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ playerCredentials: 'seat-proof' }), { status: 200 })));
    });
    afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

    it('uses locally held P0 proof for the known guest room, not the current JWT', async () => {
        await setOwnerActiveMatch({ matchID: 'guest-room', gameName: 'betrayal', ownerType: 'guest' });
        await persistMatchCredentials('guest-room', { matchID: 'guest-room', gameName: 'betrayal', playerID: '0', credentials: 'local-owner-proof' });
        expect(await claimSeat('betrayal', 'guest-room', '0', { token: 'new-account-token', playerName: 'Owner' })).toMatchObject({ success: true });
        const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
        expect(init.headers).not.toHaveProperty('Authorization');
        expect(JSON.parse(String(init.body))).toMatchObject({ playerID: '0', ownerCredentials: 'local-owner-proof' });
    });

    it('does not borrow a guest room proof for another room or a non-owner seat', async () => {
        await setOwnerActiveMatch({ matchID: 'guest-room', gameName: 'betrayal', ownerType: 'guest' });
        await persistMatchCredentials('guest-room', { matchID: 'guest-room', gameName: 'betrayal', playerID: '0', credentials: 'local-owner-proof' });
        await claimSeat('betrayal', 'guest-room', '1', { token: 'account-token' });
        const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
        expect(init.headers).toHaveProperty('Authorization', 'Bearer account-token');
        expect(JSON.parse(String(init.body))).not.toHaveProperty('ownerCredentials');
    });
});

vi.mock('../match/matchCredentialTransaction', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../match/matchCredentialTransaction')>();
    let queue = Promise.resolve<unknown>(undefined);
    return { ...actual, withMatchCredentialWrite: <T,>(write: () => T): Promise<T> => {
        const result = queue.then(write); queue = result.catch(() => {}); return result;
    } };
});
