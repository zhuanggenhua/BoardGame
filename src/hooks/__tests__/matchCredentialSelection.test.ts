/* @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimSeat, clearMatchCredentials, leaveMatch, getOwnerActiveMatch, persistMatchCredentials, readStoredMatchCredentials, rejoinMatch } from '../match/useMatchStatus';
import * as matchApi from '../../services/matchApi';
vi.mock('../../services/matchApi', () => ({ joinMatch: vi.fn(), leaveMatch: vi.fn() }));
vi.mock('../match/matchCredentialTransaction', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../match/matchCredentialTransaction')>();
    let queue = Promise.resolve<unknown>(undefined);
    return { ...actual, withMatchCredentialWrite: <T,>(write: () => T): Promise<T> => {
        const result = queue.then(write); queue = result.catch(() => {}); return result;
    } };
});
beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const selectNew = () => persistMatchCredentials('chosen', { matchID: 'chosen', playerID: '0', credentials: 'chosen' }, {
    owner: { matchID: 'chosen', gameName: 'betrayal' },
});
describe('request-start selection survives delayed production claim/join responses', () => {
    it('rejects a delayed successful claim after a different selection commits', async () => {
        let release!: (response: Response) => void;
        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
        const claiming = claimSeat('betrayal', 'old', '0', { token: 'synthetic' });
        await selectNew(); release(new Response(JSON.stringify({ playerCredentials: 'late' })));
        expect(await claiming).toMatchObject({ success: false, error: 'selection_changed' });
        expect(readStoredMatchCredentials('chosen')?.credentials).toBe('chosen');
        expect(getOwnerActiveMatch()?.matchID).toBe('chosen');
    });
    it('rejects a delayed successful rejoin after a different selection commits', async () => {
        let release!: (response: { playerCredentials: string; playerID: string }) => void;
        vi.mocked(matchApi.joinMatch).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const joining = rejoinMatch('betrayal', 'old', undefined, 'Name');
        await selectNew(); release({ playerCredentials: 'late', playerID: '1' });
        expect(await joining).toMatchObject({ success: false, error: 'selection_changed' });
        expect(readStoredMatchCredentials('chosen')?.credentials).toBe('chosen');
    });
    it('a delayed failed claim cleanup cannot remove a newer same-room proof or owner', async () => {
        await persistMatchCredentials('same', { matchID: 'same', playerID: '0', credentials: 'before' });
        let release!: (response: Response) => void;
        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
        const claiming = claimSeat('betrayal', 'same', '0', { token: 'synthetic' });
        await persistMatchCredentials('same', { matchID: 'same', playerID: '0', credentials: 'rotated' }, {
            owner: { matchID: 'same', gameName: 'betrayal' },
        });
        release(new Response('', { status: 403 })); const result = await claiming;
        expect(result.error).toBe('forbidden');
        expect(await clearMatchCredentials('same', undefined, { expectedSelection: result.expectedSelection })).toBe(false);
        expect(readStoredMatchCredentials('same')?.credentials).toBe('rotated');
        expect(getOwnerActiveMatch()?.matchID).toBe('same');
    });
    it('a delayed leave cannot clear a rejoined same-room proof and does not grant a new selection fence', async () => {
        await persistMatchCredentials('same', { matchID: 'same', playerID: '0', credentials: 'before' });
        let release!: () => void;
        vi.mocked(matchApi.leaveMatch).mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
        const leaving = leaveMatch('betrayal', 'same', '0', 'before');
        await persistMatchCredentials('same', { matchID: 'same', playerID: '0', credentials: 'rotated' }, { owner: { matchID: 'same', gameName: 'betrayal' } });
        release(); const result = await leaving;
        expect(result.success).toBe(true); expect(result.expectedSelection).toBeUndefined();
        expect(readStoredMatchCredentials('same')?.credentials).toBe('rotated');
        expect(getOwnerActiveMatch()?.matchID).toBe('same');
    });

});
