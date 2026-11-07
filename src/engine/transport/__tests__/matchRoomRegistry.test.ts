import { describe, expect, it, vi } from 'vitest';
import type { MatchState, PlayerId } from '../../types';
import type { GameEngineConfig } from '../engineConfig';
import type { FetchResult, MatchMetadata, MatchStorage, StoredMatchState } from '../storage';
import {
    MatchRoomRegistry,
    resolveStoredRandomCursor,
    resolveStoredRandomSeed,
} from '../matchRoomRegistry';
import { createTrackedRandom } from '../trackedRandom';

function createStorage(entries: Record<string, {
    state?: StoredMatchState;
    metadata?: MatchMetadata;
}>): MatchStorage {
    return {
        fetch: vi.fn(async (matchID: string, opts?: { state?: boolean; metadata?: boolean }) => ({
            state: opts?.state ? entries[matchID]?.state : undefined,
            metadata: opts?.metadata ? entries[matchID]?.metadata : undefined,
        })),
        setState: vi.fn(),
        setMetadata: vi.fn(),
        wipe: vi.fn(),
        list: vi.fn(),
        listMatches: vi.fn(),
    };
}

function createEngineConfig(gameId = 'test-game'): GameEngineConfig {
    return {
        gameId,
        domain: {
            setup: (playerIds: PlayerId[]) => ({ players: playerIds }),
            validate: () => ({ valid: true }),
            execute: () => [],
        },
        systems: [],
    } as unknown as GameEngineConfig;
}

function createMetadata(overrides?: Partial<MatchMetadata>): MatchMetadata {
    return {
        gameName: 'test-game',
        players: {
            '0': { name: 'Zero', credentials: 'cred-0' },
            '1': { name: 'One', credentials: 'cred-1' },
        },
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}

function createStoredState(overrides?: Partial<StoredMatchState>): StoredMatchState {
    const state: MatchState<unknown> = {
        core: { currentPlayer: '0' },
        sys: { phase: 'main', turnNumber: 1 },
    };
    return {
        G: state,
        _stateID: 7,
        randomSeed: 'seed-1',
        randomCursor: 2,
        ...overrides,
    };
}

describe('MatchRoomRegistry', () => {
    it('load 从存储构造 active match，并恢复随机种子、游标、玩家座位和 stateID', async () => {
        const storage = createStorage({
            'match-1': {
                state: createStoredState(),
                metadata: createMetadata(),
            },
        });
        const registry = new MatchRoomRegistry({
            storage,
            gameIndex: new Map([['test-game', createEngineConfig()]]),
        });

        const match = await registry.load('match-1');

        expect(match).toMatchObject({
            matchID: 'match-1',
            gameId: 'test-game',
            stateID: 7,
            randomSeed: 'seed-1',
            playerIds: ['0', '1'],
            lastCommandPlayerId: null,
            executing: false,
            unloaded: false,
            lastCommandFailureReason: null,
        });
        expect(match?.getRandomCursor()).toBe(2);
        match?.random.d(6);
        expect(match?.getRandomCursor()).toBe(3);
        expect(registry.get('match-1')).toBe(match);
    });

    it('getOrLoad 复用已激活房间，不重复读取存储', async () => {
        const storage = createStorage({
            'match-1': {
                state: createStoredState(),
                metadata: createMetadata(),
            },
        });
        const registry = new MatchRoomRegistry({
            storage,
            gameIndex: new Map([['test-game', createEngineConfig()]]),
        });

        const first = await registry.getOrLoad('match-1');
        const second = await registry.getOrLoad('match-1');

        expect(second).toBe(first);
        expect(storage.fetch).toHaveBeenCalledTimes(1);
    });

    it('缺少状态、metadata 或游戏配置时不激活房间', async () => {
        const storage = createStorage({
            'missing-state': { metadata: createMetadata() },
            'missing-metadata': { state: createStoredState() },
            'missing-game': {
                state: createStoredState(),
                metadata: createMetadata({ gameName: 'unknown-game' }),
            },
        });
        const registry = new MatchRoomRegistry({
            storage,
            gameIndex: new Map([['test-game', createEngineConfig()]]),
        });

        await expect(registry.load('missing-state')).resolves.toBeUndefined();
        await expect(registry.load('missing-metadata')).resolves.toBeUndefined();
        await expect(registry.load('missing-game')).resolves.toBeUndefined();
        expect([...registry.values()]).toEqual([]);
    });

    it('delete 使在途旧读取失效，但不阻止之后重新加载同一 ID', async () => {
        const stored = { state: createStoredState(), metadata: createMetadata() };
        const storage = createStorage({ 'match-1': stored });
        let finishOldRead!: (result: FetchResult) => void;
        vi.mocked(storage.fetch).mockImplementationOnce(() => new Promise(resolve => {
            finishOldRead = resolve;
        }));
        const registry = new MatchRoomRegistry({
            storage,
            gameIndex: new Map([['test-game', createEngineConfig()]]),
        });

        const oldLoad = registry.getOrLoad('match-1');
        expect(registry.delete('match-1')).toBe(false);
        const newMatch = await registry.getOrLoad('match-1');
        finishOldRead(stored);

        await expect(oldLoad).resolves.toBeUndefined();
        expect(newMatch).toBeDefined();
        expect(registry.get('match-1')).toBe(newMatch);
    });

    it('并发加载同一房间共用一个 runtime，保留所有调用者的连接', async () => {
        const storage = createStorage({
            'match-1': { state: createStoredState(), metadata: createMetadata() },
        });
        const registry = new MatchRoomRegistry({
            storage,
            gameIndex: new Map([['test-game', createEngineConfig()]]),
        });

        const [first, second] = await Promise.all([
            registry.getOrLoad('match-1'), registry.getOrLoad('match-1'),
        ]);
        first!.connections.set('0', new Set(['socket-0']));
        second!.connections.set('1', new Set(['socket-1']));

        expect(first).toBe(second);
        expect(registry.get('match-1')?.connections.size).toBe(2);
    });

    it('被取消的旧读取先结束时，不得清除仍在途的新加载', async () => {
        const stored = { state: createStoredState(), metadata: createMetadata() };
        const storage = createStorage({ 'match-1': stored });
        const finishReads: Array<(result: FetchResult) => void> = [];
        vi.mocked(storage.fetch).mockImplementation(() => new Promise(resolve => {
            finishReads.push(resolve);
        }));
        const registry = new MatchRoomRegistry({
            storage,
            gameIndex: new Map([['test-game', createEngineConfig()]]),
        });

        const oldLoad = registry.load('match-1');
        registry.delete('match-1');
        const newLoad = registry.load('match-1');
        finishReads[0](stored);
        await expect(oldLoad).resolves.toBeUndefined();
        const concurrentLoad = registry.getOrLoad('match-1');
        expect(finishReads).toHaveLength(2);
        finishReads[1](stored);
        const newMatch = await newLoad;

        await expect(concurrentLoad).resolves.toBe(newMatch);
        expect(registry.get('match-1')).toBe(newMatch);
    });

    it('加载失败后允许重新读取，不缓存失败或丢弃后续加载', async () => {
        const storage = createStorage({
            'match-1': { state: createStoredState(), metadata: createMetadata() },
        });
        vi.mocked(storage.fetch).mockRejectedValueOnce(new Error('storage unavailable'));
        const registry = new MatchRoomRegistry({
            storage,
            gameIndex: new Map([['test-game', createEngineConfig()]]),
        });

        await expect(registry.load('match-1')).rejects.toThrow('storage unavailable');
        await expect(registry.load('match-1')).resolves.toBeDefined();
    });

    it('replaceMetadata 与 mergeMetadata 只修改 active cache，不建立第二份状态', async () => {
        const storage = createStorage({
            'match-1': {
                state: createStoredState(),
                metadata: createMetadata(),
            },
        });
        const registry = new MatchRoomRegistry({
            storage,
            gameIndex: new Map([['test-game', createEngineConfig()]]),
        });
        const match = await registry.load('match-1');
        expect(match).toBeDefined();

        const replacement = createMetadata({
            players: { '0': { name: 'Replacement', credentials: 'new' } },
            updatedAt: 10,
        });
        registry.replaceMetadata('match-1', replacement);
        expect(registry.get('match-1')?.metadata).toBe(replacement);

        const merged = createMetadata({
            players: { '1': { name: 'Merged', credentials: 'merged' } },
            updatedAt: 20,
        });
        registry.mergeMetadata('match-1', merged);
        expect(registry.get('match-1')?.metadata.updatedAt).toBe(20);
        expect(registry.get('match-1')?.metadata.players).toEqual(merged.players);
    });

    it('stored random fallback 与 cursor 归一化保持服务端重启后的确定性', () => {
        expect(resolveStoredRandomSeed({ G: {}, _stateID: 1 }, 'fallback-match')).toBe('fallback-match');
        expect(resolveStoredRandomSeed({ G: {}, _stateID: 1, randomSeed: 'seed' }, 'fallback-match')).toBe('seed');
        expect(resolveStoredRandomCursor({ G: {}, _stateID: 1, randomCursor: -1 })).toBe(0);
        expect(resolveStoredRandomCursor({ G: {}, _stateID: 1, randomCursor: 2.9 })).toBe(2);

        const tracked = createTrackedRandom('seed', 2);
        expect(tracked.getCursor()).toBe(2);
        tracked.random.random();
        expect(tracked.getCursor()).toBe(3);
    });
});
