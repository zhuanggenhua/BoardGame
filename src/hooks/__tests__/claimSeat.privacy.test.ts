/* @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimSeat } from '../match/useMatchStatus';

const PRIVATE_MARKER = 'PRIVATE_SEAT_CREDENTIAL_MARKER';

describe('claimSeat failure diagnostics', () => {
    beforeEach(() => { localStorage.clear(); });
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

    it('keeps HTTP failure status without logging response contents or owner proof', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            error: 'forbidden', credentials: PRIVATE_MARKER,
        }), { status: 403 })));
        expect(await claimSeat('betrayal', 'room', '0', { ownerCredentials: PRIVATE_MARKER }))
            .toEqual({ success: false, status: 403, error: 'forbidden' });
        expect(warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 403, error: 'forbidden' }));
        expect(JSON.stringify(warn.mock.calls)).not.toContain(PRIVATE_MARKER);
    });

    it('keeps network failure classification without logging the raw exception', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(PRIVATE_MARKER)));
        expect(await claimSeat('betrayal', 'room', '0', { ownerCredentials: PRIVATE_MARKER }))
            .toEqual({ success: false, error: 'network' });
        expect(log).toHaveBeenCalledWith(expect.any(String), { errorName: 'TypeError' });
        expect(log.mock.calls.flat().some(value => value instanceof Error)).toBe(false);
        expect(JSON.stringify(log.mock.calls)).not.toContain(PRIVATE_MARKER);
    });
});
