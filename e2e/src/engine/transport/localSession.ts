import type { MatchState } from '../types';

const LOCAL_MATCH_SNAPSHOT_PREFIX = 'local_match_snapshot_v1:';
const LOCAL_MATCH_SNAPSHOT_VERSION = 1;

export interface LocalMatchSnapshot {
    version: number;
    gameId: string;
    seed: string;
    numPlayers: number;
    randomCursor: number;
    savedAt: number;
    state: MatchState<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizePositiveInt(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const normalized = Math.floor(value);
    return normalized >= 0 ? normalized : null;
}

function safeLocalStorage(): Storage | null {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return null;
    }
    return window.localStorage;
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

export function readLocalMatchSnapshot(args: {
    gameId: string;
    seed: string;
    numPlayers: number;
}): LocalMatchSnapshot | null {
    if (!args.gameId || !args.seed) return null;
    const storage = safeLocalStorage();
    if (!storage) return null;

    try {
        const raw = storage.getItem(buildLocalMatchSnapshotKey(args.gameId, args.seed));
        if (!raw) return null;

        const parsed = JSON.parse(raw) as LocalMatchSnapshot;
        if (!isRecord(parsed)) return null;
        if (parsed.version !== LOCAL_MATCH_SNAPSHOT_VERSION) return null;
        if (parsed.gameId !== args.gameId || parsed.seed !== args.seed) return null;
        if (parsed.numPlayers !== args.numPlayers) return null;

        const randomCursor = normalizePositiveInt(parsed.randomCursor);
        if (randomCursor === null) return null;
        if (!isRecord(parsed.state) || !isRecord(parsed.state.core) || !isRecord(parsed.state.sys)) return null;

        return {
            ...parsed,
            randomCursor,
        };
    } catch {
        return null;
    }
}

export function persistLocalMatchSnapshot(args: {
    gameId: string;
    seed: string;
    numPlayers: number;
    state: MatchState<unknown>;
    randomCursor: number;
}): void {
    if (!args.gameId || !args.seed) return;
    const storage = safeLocalStorage();
    if (!storage) return;

    try {
        const payload: LocalMatchSnapshot = {
            version: LOCAL_MATCH_SNAPSHOT_VERSION,
            gameId: args.gameId,
            seed: args.seed,
            numPlayers: args.numPlayers,
            randomCursor: Math.max(0, Math.floor(args.randomCursor)),
            savedAt: Date.now(),
            state: args.state,
        };
        storage.setItem(buildLocalMatchSnapshotKey(args.gameId, args.seed), JSON.stringify(payload));
    } catch {
        // 忽略隐私模式或容量不足导致的持久化失败
    }
}

export function clearLocalMatchSnapshot(gameId: string, seed: string): void {
    if (!gameId || !seed) return;
    const storage = safeLocalStorage();
    if (!storage) return;

    try {
        storage.removeItem(buildLocalMatchSnapshotKey(gameId, seed));
    } catch {
        // 忽略 localStorage 不可用
    }
}
