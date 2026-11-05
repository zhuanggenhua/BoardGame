import type { MatchState } from '../types';

const LOCAL_MATCH_SNAPSHOT_PREFIX = 'local_match_snapshot_v1:';
const LOCAL_MATCH_SNAPSHOT_VERSION = 1;
export const LOCAL_MATCH_RETENTION = { maxPerGame: 3, maxTotal: 12, maxBytes: 4 * 1024 * 1024, ttlMs: 30 * 24 * 60 * 60 * 1000 } as const;

export interface LocalMatchSnapshot {
    version: number; gameId: string; seed: string; numPlayers: number;
    randomCursor: number; savedAt: number; state: MatchState<unknown>;
}
export type LocalSnapshotReadResult =
    | { status: 'ready'; snapshot: LocalMatchSnapshot }
    | { status: 'missing' | 'expired' | 'invalid' | 'unavailable'; snapshot?: never };
export type LocalSnapshotSaveResult = { ok: true } | { ok: false; reason: 'unavailable' | 'invalid' | 'too-large' | 'quota' | 'write-failed' };
function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function safeLocalStorage(): Storage | null {
    try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}
export function createLocalMatchSeed(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureLocalMatchSeedSearchParams(
    search?: URLSearchParams,
    seed = createLocalMatchSeed(),
): URLSearchParams {
    const next = new URLSearchParams(search);
    if (!next.get('seed')) {
        next.set('seed', seed);
    }
    return next;
}

export function buildLocalMatchSnapshotKey(gameId: string, seed: string): string {
    return `${LOCAL_MATCH_SNAPSHOT_PREFIX}${gameId}:${seed}`;
}


export function readLocalMatchSnapshotResult(args: { gameId: string; seed: string; numPlayers: number }): LocalSnapshotReadResult {
    if (!args.gameId || !args.seed) return { status: 'missing' };
    const storage = safeLocalStorage();
    if (!storage) return { status: 'unavailable' };
    let raw: string | null;
    try { raw = storage.getItem(buildLocalMatchSnapshotKey(args.gameId, args.seed)); }
    catch { return { status: 'unavailable' }; }
    if (!raw) return { status: 'missing' };
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || parsed.version !== LOCAL_MATCH_SNAPSHOT_VERSION
            || parsed.gameId !== args.gameId || parsed.seed !== args.seed || parsed.numPlayers !== args.numPlayers
            || !Number.isSafeInteger(parsed.randomCursor) || (parsed.randomCursor as number) < 0
            || typeof parsed.savedAt !== 'number' || !Number.isFinite(parsed.savedAt)
            || !isRecord(parsed.state) || !isRecord(parsed.state.core) || !isRecord(parsed.state.sys)) return { status: 'invalid' };
        if (Date.now() - parsed.savedAt > LOCAL_MATCH_RETENTION.ttlMs) return { status: 'expired' };
        return { status: 'ready', snapshot: parsed as unknown as LocalMatchSnapshot };
    } catch { return { status: 'invalid' }; }
}

export function readLocalMatchSnapshot(args: { gameId: string; seed: string; numPlayers: number }): LocalMatchSnapshot | null {
    const result = readLocalMatchSnapshotResult(args);
    return result.status === 'ready' ? result.snapshot : null;
}

interface RetainedSnapshot { key: string; gameId?: string; savedAt: number; bytes: number }
function listOwnedSnapshots(storage: Storage): RetainedSnapshot[] {
    const result: RetainedSnapshot[] = [];
    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith(LOCAL_MATCH_SNAPSHOT_PREFIX)) continue;
        const raw = storage.getItem(key);
        if (!raw) continue;
        let gameId: string | undefined, savedAt = 0;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (isRecord(parsed)) {
                if (typeof parsed.gameId === 'string') gameId = parsed.gameId;
                if (typeof parsed.savedAt === 'number' && Number.isFinite(parsed.savedAt)) savedAt = parsed.savedAt;
            }
        } catch { /* Invalid inactive snapshots age out under the same bounds. */ }
        result.push({ key, gameId, savedAt, bytes: (key.length + raw.length) * 2 });
    }
    return result.sort((a, b) => a.savedAt - b.savedAt);
}

function enforceRetention(storage: Storage, active: RetainedSnapshot): RetainedSnapshot[] {
    const retained = listOwnedSnapshots(storage).filter(entry => entry.key !== active.key);
    const now = Date.now();
    for (let index = retained.length - 1; index >= 0; index -= 1) {
        if (now - retained[index].savedAt <= LOCAL_MATCH_RETENTION.ttlMs) continue;
        storage.removeItem(retained[index].key); retained.splice(index, 1);
    }
    const countGame = () => retained.filter(entry => entry.gameId === active.gameId).length + 1;
    const totalBytes = () => retained.reduce((sum, entry) => sum + entry.bytes, active.bytes);
    while (countGame() > LOCAL_MATCH_RETENTION.maxPerGame) {
        const index = retained.findIndex(entry => entry.gameId === active.gameId);
        if (index < 0) break;
        storage.removeItem(retained[index].key); retained.splice(index, 1);
    }
    while (retained.length + 1 > LOCAL_MATCH_RETENTION.maxTotal || totalBytes() > LOCAL_MATCH_RETENTION.maxBytes) {
        const oldest = retained.shift();
        if (!oldest) break;
        storage.removeItem(oldest.key);
    }
    return retained;
}

export function persistLocalMatchSnapshot(args: {
    gameId: string; seed: string; numPlayers: number; state: MatchState<unknown>; randomCursor: number;
}): LocalSnapshotSaveResult {
    if (!args.gameId || !args.seed || !Number.isSafeInteger(args.randomCursor) || args.randomCursor < 0) return { ok: false, reason: 'invalid' };
    const storage = safeLocalStorage();
    if (!storage) return { ok: false, reason: 'unavailable' };
    let raw: string;
    try { raw = JSON.stringify({ ...args, version: LOCAL_MATCH_SNAPSHOT_VERSION, savedAt: Date.now() } satisfies LocalMatchSnapshot); }
    catch { return { ok: false, reason: 'invalid' }; }
    const key = buildLocalMatchSnapshotKey(args.gameId, args.seed);
    const active = { key, gameId: args.gameId, savedAt: Date.now(), bytes: (key.length + raw.length) * 2 };
    if (active.bytes > LOCAL_MATCH_RETENTION.maxBytes) return { ok: false, reason: 'too-large' };
    try {
        const retained = enforceRetention(storage, active);
        for (;;) {
            try { storage.setItem(key, raw); return { ok: true }; }
            catch (error) {
                const quota = isRecord(error) && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
                if (!quota) return { ok: false, reason: 'write-failed' };
                const oldest = retained.shift();
                if (!oldest) return { ok: false, reason: 'quota' };
                storage.removeItem(oldest.key);
            }
        }
    } catch { return { ok: false, reason: 'write-failed' }; }
}

export function clearLocalMatchSnapshot(gameId: string, seed: string): boolean {
    const storage = safeLocalStorage();
    if (!storage || !gameId || !seed) return false;
    try { storage.removeItem(buildLocalMatchSnapshotKey(gameId, seed)); return true; } catch { return false; }
}
