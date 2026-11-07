// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchCredentialStorageError, withMatchCredentialWrite } from '../match/matchCredentialTransaction';

afterEach(() => { vi.unstubAllGlobals(); });
// Controlled platform events test rejection/late-open handling only. Cross-page
// mutual exclusion requires the separate native-browser test, not this stub.
describe('credential native transaction failure boundaries', () => {
    it('does not silently run unlocked when IndexedDB is unavailable', async () => {
        vi.stubGlobal('indexedDB', undefined); const write = vi.fn();
        await expect(withMatchCredentialWrite(write)).rejects.toBeInstanceOf(MatchCredentialStorageError);
        expect(write).not.toHaveBeenCalled();
    });
    it.each(['onerror', 'onblocked'] as const)('rejects %s and refuses any later successful open', async event => {
        const close = vi.fn(); const transaction = vi.fn(); const write = vi.fn();
        const request = { result: { close, transaction }, onerror: undefined as undefined | (() => void),
            onblocked: undefined as undefined | (() => void), onsuccess: undefined as undefined | (() => void) };
        vi.stubGlobal('indexedDB', { open: () => request });
        const pending = withMatchCredentialWrite(write);
        request[event]!(); await expect(pending).rejects.toBeInstanceOf(MatchCredentialStorageError);
        request.onsuccess!(); expect(transaction).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(close).toHaveBeenCalled();
    });
    it('rejects an aborted native transaction without claiming completion', async () => {
        const read = { onsuccess: undefined as undefined | (() => void) };
        const tx = { objectStore: () => ({ get: () => read }), onabort: undefined as undefined | (() => void),
            oncomplete: undefined as undefined | (() => void), abort: () => tx.onabort?.() };
        const request = { result: { close: vi.fn(), transaction: () => tx }, onsuccess: undefined as undefined | (() => void) };
        vi.stubGlobal('indexedDB', { open: () => request });
        const write = vi.fn(); const pending = withMatchCredentialWrite(write);
        request.onsuccess!(); tx.abort();
        await expect(pending).rejects.toBeInstanceOf(MatchCredentialStorageError);
        read.onsuccess!(); expect(write).not.toHaveBeenCalled();
    });
});
