/* @vitest-environment happy-dom */
import React, { useEffect } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { preparePendingRematch, readPendingRematch, requestPendingRematchRecovery } from '../match/pendingRematchRecovery';
import { persistMatchCredentials, readStoredMatchCredentials, clearMatchCredentials } from '../match/useMatchStatus';
import { RematchRecoveryGate } from '../../components/system/RematchRecoveryGate';
const mocks = vi.hoisted(() => ({ auth: { user: null as null | { id: string }, token: null as string | null, isLoading: false }, recover: vi.fn(), get: vi.fn(), child: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../services/matchApi', () => ({ recoverRematch: mocks.recover, getMatch: mocks.get }));
vi.mock('../../components/system/LoadingScreen', () => ({ LoadingScreen: () => <div>loading</div> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../match/matchCredentialTransaction', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../match/matchCredentialTransaction')>();
    let queue = Promise.resolve<unknown>(undefined);
    return { ...actual, withMatchCredentialWrite: <T,>(write: () => T): Promise<T> => {
        const result = queue.then(write); queue = result.catch(() => {}); return result;
    } };
});
const Child = () => { useEffect(() => { mocks.child(); }, []); return <div>app</div>; };
const mount = () => render(<RematchRecoveryGate><Child /></RematchRecoveryGate>);
beforeEach(async () => {
    vi.clearAllMocks(); mocks.child.mockReset(); localStorage.clear(); window.location.href = 'http://localhost/';
    mocks.auth = { user: null, token: null, isLoading: false };
    await persistMatchCredentials('old', { matchID: 'old', playerID: '0', credentials: 'old-proof' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const prepare = () => preparePendingRematch({ sourceMatchID: 'old', gameName: 'betrayal', authUserID: null });
const response = (id: string) => ({ matchID: id, ownerPlayerID: '0', ownerCredentials: 'fresh', ownerType: 'guest', ownerKey: 'guest:owner' });
describe('root recovery before route cleanup', () => {
    it('keeps the old route unmounted, recovers only, saves then redirects', async () => {
        const p = await prepare(); window.location.href = 'http://localhost/play/betrayal/match/old';
        let release!: (data: unknown) => void;
        mocks.recover.mockImplementation(() => new Promise(resolve => { release = resolve; }));
        mount(); expect(mocks.child).not.toHaveBeenCalled();
        await act(async () => { release(response(p.nextMatchID)); });
        expect(window.location.pathname).toBe(`/play/betrayal/match/${p.nextMatchID}`);
        expect(readStoredMatchCredentials(p.nextMatchID)?.credentials).toBe('fresh');
        expect(mocks.child).not.toHaveBeenCalled(); expect(readPendingRematch()).toBeNull();
    });
    it('restores from the lobby without navigating into a room', async () => {
        const p = await prepare(); mocks.recover.mockResolvedValue(response(p.nextMatchID));
        mount(); await screen.findByText('app');
        expect(readStoredMatchCredentials(p.nextMatchID)?.credentials).toBe('fresh');
        expect(window.location.pathname).toBe('/');
    });
    it('offline leaves pending and blocks old-route destructive cleanup until retry', async () => {
        const p = await prepare(); window.location.href = 'http://localhost/play/betrayal/match/old';
        mocks.recover.mockRejectedValue(new Error('offline')); mount(); await screen.findByRole('alert');
        expect(mocks.child).not.toHaveBeenCalled(); expect(readPendingRematch()).toEqual(p);
        expect(readStoredMatchCredentials('old')?.credentials).toBe('old-proof');
    });
    it('times out without mounting the stale route, and ignores a late response', async () => {
        vi.useFakeTimers(); const p = await prepare(); window.location.href = 'http://localhost/play/betrayal/match/old';
        let release!: (data: unknown) => void;
        mocks.recover.mockImplementation(() => new Promise(resolve => { release = resolve; }));
        mount(); await act(async () => { vi.advanceTimersByTime(8000); });
        expect(screen.getByRole('alert')).toBeTruthy();
        await act(async () => { release(response(p.nextMatchID)); });
        expect(readStoredMatchCredentials(p.nextMatchID)).toBeNull(); expect(readPendingRematch()).toEqual(p);
    });
    it('does not save a response after logout or account change', async () => {
        const p = await prepare(); let release!: (data: unknown) => void;
        mocks.recover.mockImplementation(() => new Promise(resolve => { release = resolve; }));
        mount(); localStorage.setItem('auth_token', 'different-session');
        await act(async () => { release(response(p.nextMatchID)); });
        await waitFor(() => expect(mocks.child).toHaveBeenCalled());
        expect(readStoredMatchCredentials(p.nextMatchID)).toBeNull(); expect(readPendingRematch()).toEqual(p);
    });
    it('does not attempt recovery belonging to another signed-in user', async () => {
        await prepare(); mocks.auth = { user: { id: 'other' }, token: 'other-token', isLoading: false };
        mount(); await screen.findByText('app'); expect(mocks.recover).not.toHaveBeenCalled();
    });
    it('allows a still-existing source when the saved create was never sent', async () => {
        await prepare(); window.location.href = 'http://localhost/play/betrayal/match/old';
        mocks.recover.mockRejectedValue({ status: 404 }); mocks.get.mockResolvedValue({ matchID: 'old' });
        mount(); await screen.findByText('app'); expect(readPendingRematch()).not.toBeNull();
    });
    it('protects recovery in the lobby from an automatic 404 cleanup', async () => {
        const p = await prepare(); mocks.recover.mockRejectedValue(new Error('offline'));
        mocks.child.mockImplementation(() => { void clearMatchCredentials('old'); });
        const view = mount(); await screen.findByText('app');
        await act(async () => { await Promise.resolve(); });
        expect(readStoredMatchCredentials('old')?.credentials).toBe('old-proof');
        view.unmount(); mocks.recover.mockResolvedValue(response(p.nextMatchID)); mount();
        await waitFor(() => expect(readPendingRematch()).toBeNull());
        expect(readStoredMatchCredentials(p.nextMatchID)?.credentials).toBe('fresh');
    });
    it('takes over a live failed create without remounting the stale route', async () => {
        mount(); expect(screen.getByText('app')).toBeTruthy();
        const p = await prepare(); window.location.href = 'http://localhost/play/betrayal/match/old';
        mocks.recover.mockResolvedValue(response(p.nextMatchID));
        await act(async () => { requestPendingRematchRecovery(); });
        expect(readStoredMatchCredentials(p.nextMatchID)?.credentials).toBe('fresh');
        expect(window.location.pathname).toBe(`/play/betrayal/match/${p.nextMatchID}`);
    });

    it('does not hang on a recovery-needed event after another tab removed pending', async () => {
        mount(); await act(async () => { requestPendingRematchRecovery(); });
        expect(screen.getByText('app')).toBeTruthy(); expect(mocks.recover).not.toHaveBeenCalled();
    });

});
