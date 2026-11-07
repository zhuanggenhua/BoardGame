// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

type CredentialApi = typeof import('../src/hooks/match/useMatchStatus');

// Actual production storage API, independent realms, shared Storage. Only the
// external exclusive scheduler is controlled here; native IDB is tested separately.
function contexts() {
    const source = readFileSync(resolve(process.cwd(), 'src/hooks/match/useMatchStatus.ts'), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const values = new Map<string, string>();
    const writes: string[] = [];
    const events: string[] = [];
    let failKey: string | undefined;
    const storage = {
        get length() { return values.size; },
        key: (index: number) => [...values.keys()][index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { writes.push(key); values.set(key, value); },
        removeItem: (key: string) => { writes.push(key); values.delete(key); },
    };
    let queue = Promise.resolve<unknown>(undefined);
    const mutex = { withMatchCredentialWrite: <T,>(callback: () => T) => {
        const result = queue.then(callback); queue = result.catch(() => {}); return result;
    }, credentialWriteFailed: () => false, MatchCredentialStorageError: class extends Error {} };
    let interleave: ((key: string) => void) | undefined;
    function realm(isLateResponse: boolean): CredentialApi {
        const module = { exports: {} };
        const browser = {
            getLocalStorage: () => storage,
            readLocalStorageItem: (key: string) => {
                const value = storage.getItem(key);
                if (isLateResponse) interleave?.(key);
                return value;
            },
            writeLocalStorageItem: (key: string, value: string) => { if (key === failKey) return false; storage.setItem(key, value); return true; },
            removeLocalStorageItem: (key: string) => { if (key === failKey) return false; storage.removeItem(key); return true; },
            readSessionStorageItem: () => null, writeSessionStorageItem: () => true,
        };
        runInNewContext(js, {
            module, exports: module.exports,
            require: (id: string) => id.includes('browserStorage') ? browser : id.includes('matchCredentialTransaction') ? mutex : {},
            window: { dispatchEvent: (event: { type: string }) => { events.push(event.type); } }, Event: class { constructor(public type: string) {} }, console, Date,
        });
        return module.exports as CredentialApi;
    }
    const late = realm(true); const choice = realm(false);
    const selectOther = () => choice.persistMatchCredentials('chosen', {
        matchID: 'chosen', playerID: '1', credentials: 'synthetic-chosen',
    }, { owner: { matchID: 'chosen', gameName: 'betrayal' } });
    const old = () => late.persistMatchCredentials('old', { matchID: 'old', playerID: '0', credentials: 'synthetic-old' });
    const rematch = () => late.persistRematchOwnerCredentials('old', {
        matchID: 'next', playerID: '0', credentials: 'synthetic-next',
    }, { matchID: 'next', gameName: 'betrayal' });
    return { late, choice, selectOther, old, rematch, writes, values, events,
        fail: (key: string) => { failKey = key; },
        atRead: (hook: (key: string) => void) => { interleave = hook; }, clear: () => { interleave = undefined; } };
}

describe('rematch proof must not erase a later cross-context room choice', () => {
    it('preserves a different room selected before the late-response check, with no writes', async () => {
        const h = contexts(); await h.selectOther(); h.writes.length = 0;
        expect(await h.rematch()).toBe(false);
        expect(h.choice.readStoredMatchCredentials('chosen')).not.toBeNull();
        expect(h.writes).toEqual([]);
    });

    it('serializes the original check-to-prune interleaving and leaves the newer choice selected', async () => {
        const h = contexts(); await h.old();
        let selection: Promise<boolean> | undefined;
        h.atRead(key => {
            if (key !== 'match_creds_next') return;
            h.clear(); selection = h.selectOther();
        });
        expect(await h.rematch()).toBe(true);
        expect(selection).toBeDefined(); await selection;
        expect(h.choice.readStoredMatchCredentials('chosen')?.credentials).toBe('synthetic-chosen');
        expect(h.choice.getOwnerActiveMatch()?.matchID).toBe('chosen');
        expect(h.choice.listStoredMatchCredentials().map(c => c.matchID)).toEqual(['chosen']);
        await h.late.pruneStoredMatchCredentials();
        expect(h.choice.readStoredMatchCredentials('chosen')).not.toBeNull();
    });

    it('does not let a delayed owner confirmation or stale explicit prune override the new seat', async () => {
        const h = contexts(); await h.old(); await h.selectOther();
        expect(await h.late.setOwnerActiveMatch({ matchID: 'old', gameName: 'betrayal' })).toBe(false);
        expect(await h.late.pruneStoredMatchCredentials('old')).toBeNull();
        expect(h.choice.getOwnerActiveMatch()?.matchID).toBe('chosen');
    });

    it('metadata repair queued behind a selection cannot resurrect or reselect an old room', async () => {
        const h = contexts(); await h.old();
        const selecting = h.selectOther();
        const patch = h.late.updateStoredMatchMetadata('old', { gameName: 'betrayal' });
        const rename = h.late.updateStoredMatchPlayerName('Renamed');
        await selecting; expect(await patch).toBe(false); await rename;
        expect(h.choice.listStoredMatchCredentials().map(c => c.matchID)).toEqual(['chosen']);
    });

    it('an old queued clear cannot delete a rotated proof for the same room', async () => {
        const h = contexts(); await h.old();
        const rotated = h.choice.persistMatchCredentials('old', { matchID: 'old', playerID: '0', credentials: 'rotated' });
        const clearing = h.late.clearMatchCredentials('old');
        await rotated; expect(await clearing).toBe(false);
        expect(h.choice.readStoredMatchCredentials('old')?.credentials).toBe('rotated');
        expect(await h.late.clearMatchCredentials('old', { playerID: '0', credentials: 'synthetic-old' })).toBe(false);
    });

    it('an old owner clear cannot delete a later pointer', async () => {
        const h = contexts(); await h.old(); await h.late.setOwnerActiveMatch({ matchID: 'old', gameName: 'betrayal' });
        const selecting = h.selectOther(); const clearing = h.late.clearOwnerActiveMatch();
        await selecting; expect(await clearing).toBe(false);
        expect(h.choice.getOwnerActiveMatch()?.matchID).toBe('chosen');
    });

    it('refuses a rematch proof superseded by a rotated target proof', async () => {
        const h = contexts(); await h.choice.persistMatchCredentials('next', { matchID: 'next', playerID: '0', credentials: 'rotated' });
        expect(await h.rematch()).toBe(false);
        expect(h.choice.readStoredMatchCredentials('next')?.credentials).toBe('rotated');
    });

    it.each(['match_creds_next', 'owner_active_match'])('stops destructive pruning on failed %s write', async (key) => {
        const h = contexts(); await h.old(); h.fail(key);
        await expect(h.rematch()).rejects.toThrow();
        expect(h.choice.readStoredMatchCredentials('old')?.credentials).toBe('synthetic-old');
        if (key === 'owner_active_match') expect(h.choice.readStoredMatchCredentials('next')).not.toBeNull();
    });

    it('does not expose success if a removal fails, and preserves the fresh proof', async () => {
        const h = contexts(); await h.old(); h.fail('match_creds_old');
        await expect(h.rematch()).rejects.toThrow();
        expect(h.choice.readStoredMatchCredentials('next')?.credentials).toBe('synthetic-next');
        expect(h.choice.readStoredMatchCredentials('old')).not.toBeNull();
    });

    it('repeated Home pruning with one selected room emits no events or writes', async () => {
        const h = contexts(); await h.selectOther(); h.events.length = 0; h.writes.length = 0;
        await h.late.pruneStoredMatchCredentials(); await h.choice.pruneStoredMatchCredentials();
        expect(h.events).toEqual([]); expect(h.writes).toEqual([]);
    });

    it('an ordinary pending join/create cannot replace a choice committed during its request', async () => {
        const h = contexts(); await h.old(); const beforeRequest = h.late.captureMatchCredentialSelection();
        await h.selectOther(); h.writes.length = 0;
        expect(await h.late.persistMatchCredentials('late-join', { matchID: 'late-join', playerID: '1', credentials: 'late' }, {
            expectedSelection: beforeRequest, owner: { matchID: 'late-join', gameName: 'betrayal' },
        })).toBe(false);
        expect(h.writes).toEqual([]);
        expect(h.choice.getOwnerActiveMatch()?.matchID).toBe('chosen');
    });

    it('metadata patches preserve the pending selection fingerprint', async () => {
        const h = contexts(); await h.old(); const selection = h.late.captureMatchCredentialSelection();
        await h.choice.updateStoredMatchMetadata('old', { gameName: 'betrayal', playerName: 'name' });
        await h.choice.updateStoredMatchPlayerName('renamed');
        expect(h.late.captureMatchCredentialSelection()).toBe(selection);
    });

    it('proof-fenced cleanup cannot clear a rotated same-room owner or add suppression', async () => {
        const h = contexts(); await h.old();
        await h.choice.persistMatchCredentials('old', { matchID: 'old', playerID: '0', credentials: 'rotated' }, {
            owner: { matchID: 'old', gameName: 'betrayal' },
        });
        expect(await h.late.clearMatchCredentials('old', { playerID: '0', credentials: 'synthetic-old' }, { suppressOwner: true })).toBe(false);
        expect(h.choice.getOwnerActiveMatch()?.matchID).toBe('old');
        expect(h.choice.getSuppressedOwnerActiveMatches()).toEqual([]);
    });

    it('successful compound cleanup removes the matching owner/AI and suppresses only that room', async () => {
        const h = contexts(); await h.old();
        await h.late.setOwnerActiveMatch({ matchID: 'old', gameName: 'betrayal' });
        await h.late.persistAiSeatCredentials('old', { '1': 'ai' });
        expect(await h.choice.clearMatchCredentials('old', { playerID: '0', credentials: 'synthetic-old' }, { suppressOwner: true })).toBe(true);
        expect(h.late.readStoredMatchCredentials('old')).toBeNull();
        expect(h.late.getOwnerActiveMatch()).toBeNull();
        expect(h.late.readStoredAiSeatCredentials('old')).toEqual({});
        expect(h.late.getSuppressedOwnerActiveMatches()).toEqual(['old']);
    });

    it('AI writes and suppression use the same serialized owner as clear and selection', async () => {
        const h = contexts(); await h.old();
        await Promise.all([
            h.choice.persistAiSeatCredentials('old', { '1': 'ai' }),
            h.late.clearMatchCredentials('old'),
            h.choice.suppressOwnerActiveMatch('a'),
            h.late.suppressOwnerActiveMatch('b'),
        ]);
        expect(h.choice.readStoredAiSeatCredentials('old')).toEqual({});
        expect(h.choice.getSuppressedOwnerActiveMatches()).toEqual(['a', 'b']);
    });
});
