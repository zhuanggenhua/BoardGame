/* @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preparePendingRematch, readPendingRematch, completePendingRematch } from '../match/pendingRematchRecovery';
import { persistMatchCredentials, readStoredMatchCredentials, clearMatchCredentials } from '../match/useMatchStatus';
vi.mock('../match/matchCredentialTransaction', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../match/matchCredentialTransaction')>();
    let queue = Promise.resolve<unknown>(undefined);
    return { ...actual, withMatchCredentialWrite: <T,>(write: () => T): Promise<T> => {
        const result = queue.then(write); queue = result.catch(() => {}); return result;
    } };
});
afterEach(() => { vi.restoreAllMocks(); });
function denyWrites() {
    const storage = localStorage;
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
        getItem: storage.getItem.bind(storage), key: storage.key.bind(storage), length: storage.length,
        clear: storage.clear.bind(storage), removeItem: storage.removeItem.bind(storage),
        setItem: () => { throw new Error('denied'); },
    });
}
const input = { sourceMatchID: 'old', gameName: 'betrayal', playerName: 'Owner', authUserID: null };
beforeEach(async () => {
    vi.restoreAllMocks(); localStorage.clear();
    await persistMatchCredentials('old', { matchID: 'old', playerID: '0', credentials: 'old-proof', gameName: 'betrayal' });
});
const resultFor = (p: Awaited<ReturnType<typeof preparePendingRematch>>) => ({ matchID: p.nextMatchID, ownerPlayerID: '0' as const,
    ownerCredentials: 'new-proof', ownerType: 'guest' as const, ownerKey: 'guest:owner' });
describe('durable rematch preparation and completion', () => {
    it('serializes two tab preparations into one durable cryptographic request', async () => {
        const [a, b] = await Promise.all([preparePendingRematch(input), preparePendingRematch(input)]);
        expect(a).toEqual(b); expect(a.nextMatchID).toMatch(/^[\w-]{22}$/); expect(a.token).toMatch(/^[\w-]{43}$/);
        expect(readPendingRematch()).toEqual(a);
    });
    it('restores the original proof after remount and clears pending only after saving', async () => {
        const pending = await preparePendingRematch(input);
        expect(await completePendingRematch(readPendingRematch()!, resultFor(pending), () => true)).toBe(true);
        expect(readStoredMatchCredentials(pending.nextMatchID)?.credentials).toBe('new-proof');
        expect(readStoredMatchCredentials('old')).toBeNull(); expect(readPendingRematch()).toBeNull();
    });
    it('does not install after auth changes while queued for the write lock', async () => {
        const pending = await preparePendingRematch(input); let current = true;
        const saving = completePendingRematch(pending, resultFor(pending), () => current); current = false;
        expect(await saving).toBe(false); expect(readPendingRematch()).toEqual(pending);
        expect(readStoredMatchCredentials(pending.nextMatchID)).toBeNull();
    });
    it('does not resurrect after selecting another room and then clearing it', async () => {
        const pending = await preparePendingRematch(input);
        await persistMatchCredentials('other', { matchID: 'other', credentials: 'other-proof' });
        await clearMatchCredentials('other');
        expect(await completePendingRematch(pending, resultFor(pending), () => true)).toBe(false);
        expect(readStoredMatchCredentials(pending.nextMatchID)).toBeNull();
    });
    it('refuses unrelated results and changed seat proofs', async () => {
        const p = await preparePendingRematch(input);
        expect(await completePendingRematch(p, { ...resultFor(p), matchID: 'other' }, () => true)).toBe(false);
        await persistMatchCredentials(p.nextMatchID, { matchID: p.nextMatchID, playerID: '0', credentials: 'rotated' });
        expect(await completePendingRematch(p, resultFor(p), () => true)).toBe(false);
    });
    it('fails before create if pending cannot be written', async () => {
        denyWrites();
        await expect(preparePendingRematch(input)).rejects.toThrow();
    });
    it('keeps pending when saving the recovered proof is denied', async () => {
        const p = await preparePendingRematch(input);
        denyWrites();
        await expect(completePendingRematch(p, resultFor(p), () => true)).rejects.toThrow();
        expect(readPendingRematch()).toEqual(p);
    });
    it('protects pending source from automatic stale cleanup but respects explicit discard', async () => {
        const p = await preparePendingRematch(input);
        expect(await clearMatchCredentials('old')).toBe(false);
        expect(readStoredMatchCredentials('old')?.credentials).toBe('old-proof');
        expect(await completePendingRematch(p, resultFor(p), () => true)).toBe(true);
    });
    it('explicit local exit discards pending and cannot resurrect later', async () => {
        const p = await preparePendingRematch(input);
        expect(await clearMatchCredentials('old', undefined, { discardPending: true })).toBe(true);
        expect(readPendingRematch()).toBeNull();
        expect(await completePendingRematch(p, resultFor(p), () => true)).toBe(false);
    });
    it('two tab completions retain exactly the same proof', async () => {
        const p = await preparePendingRematch(input);
        expect(await Promise.all([completePendingRematch(p, resultFor(p), () => true), completePendingRematch(p, resultFor(p), () => true)])).toEqual([true, true]);
        expect(readStoredMatchCredentials(p.nextMatchID)?.credentials).toBe('new-proof');
        expect(readPendingRematch()).toBeNull();
    });

});
