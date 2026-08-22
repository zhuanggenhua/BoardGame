import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import type { StoredMatchState } from '../storage';
import {
    MatchStateInjectionCoordinator,
    type MatchStateInjectionCoordinatorHooks,
    type MatchStateInjectionCoordinatorMatch,
    canInjectStateInCurrentEnv,
} from '../matchStateInjectionCoordinator';

type TestMatch = MatchStateInjectionCoordinatorMatch & {
    clearCount: number;
    broadcastCount: number;
};

function createState(label: string): MatchState<unknown> {
    return {
        core: { label },
        sys: { phase: 'main', turnNumber: 1 },
    } as MatchState<unknown>;
}

function createMatch(): TestMatch {
    return {
        matchID: 'match-inject',
        state: createState('old'),
        stateID: 7,
        randomSeed: 'seed-1',
        getRandomCursor: () => 3,
        lastBroadcastedViews: new Map([['0', { cached: true }]]),
        clearCount: 0,
        broadcastCount: 0,
    };
}

function createHarness(options?: {
    env?: string;
    match?: TestMatch;
    persistFailure?: Error;
}) {
    const match = options?.match ?? createMatch();
    const persisted: StoredMatchState[] = [];
    const logs: string[] = [];
    const hooks: MatchStateInjectionCoordinatorHooks<TestMatch> = {
        getOrLoadMatch: vi.fn(async () => match),
        persistState: vi.fn(async (_matchID, storedState) => {
            if (options?.persistFailure) {
                throw options.persistFailure;
            }
            persisted.push(storedState);
        }),
        clearAllBaselines: vi.fn((activeMatch) => {
            activeMatch.clearCount += 1;
            activeMatch.lastBroadcastedViews.clear();
        }),
        broadcast: vi.fn((activeMatch) => {
            activeMatch.broadcastCount += 1;
        }),
        getNodeEnv: vi.fn(() => options?.env ?? 'test'),
        logInjected: vi.fn((matchID) => {
            logs.push(matchID);
        }),
    };

    return {
        coordinator: new MatchStateInjectionCoordinator({ hooks }),
        hooks,
        match,
        persisted,
        logs,
    };
}

describe('MatchStateInjectionCoordinator', () => {
    it('只允许 test/development 环境执行状态注入', async () => {
        expect(canInjectStateInCurrentEnv('test')).toBe(true);
        expect(canInjectStateInCurrentEnv('development')).toBe(true);
        expect(canInjectStateInCurrentEnv('production')).toBe(false);

        const harness = createHarness({ env: 'production' });

        await expect(
            harness.coordinator.injectState('match-inject', createState('new')),
        ).rejects.toThrow('injectState is only available in test/development environment');
        expect(harness.hooks.getOrLoadMatch).not.toHaveBeenCalled();
        expect(harness.persisted).toEqual([]);
    });

    it('非法状态在读取房间前被拒绝', async () => {
        const harness = createHarness();

        await expect(
            harness.coordinator.injectState('match-inject', { core: {}, sys: null } as unknown as MatchState<unknown>),
        ).rejects.toThrow('Invalid state: missing or invalid sys');
        expect(harness.hooks.getOrLoadMatch).not.toHaveBeenCalled();
    });

    it('找不到房间时返回明确错误，不写存储也不广播', async () => {
        const harness = createHarness();
        vi.mocked(harness.hooks.getOrLoadMatch).mockResolvedValueOnce(undefined);

        await expect(
            harness.coordinator.injectState('missing-match', createState('new')),
        ).rejects.toThrow('Match missing-match not found');
        expect(harness.hooks.persistState).not.toHaveBeenCalled();
        expect(harness.hooks.broadcast).not.toHaveBeenCalled();
    });

    it('持久化失败时不切换活跃房间内存状态，也不清缓存或广播', async () => {
        const match = createMatch();
        const oldState = match.state;
        const harness = createHarness({
            match,
            persistFailure: new Error('Storage error'),
        });

        await expect(
            harness.coordinator.injectState('match-inject', createState('new')),
        ).rejects.toThrow('Storage error');

        expect(match.state).toBe(oldState);
        expect(match.stateID).toBe(7);
        expect(match.lastBroadcastedViews.size).toBe(1);
        expect(match.clearCount).toBe(0);
        expect(match.broadcastCount).toBe(0);
        expect(harness.logs).toEqual([]);
    });

    it('持久化成功后再切换内存状态、清全量缓存并广播', async () => {
        const harness = createHarness();
        const newState = createState('new');

        await harness.coordinator.injectState('match-inject', newState);

        expect(harness.persisted).toEqual([{
            G: newState,
            _stateID: 8,
            randomSeed: 'seed-1',
            randomCursor: 3,
        }]);
        expect(harness.match.state).toBe(newState);
        expect(harness.match.stateID).toBe(8);
        expect(harness.match.lastBroadcastedViews.size).toBe(0);
        expect(harness.match.clearCount).toBe(1);
        expect(harness.match.broadcastCount).toBe(1);
        expect(harness.logs).toEqual(['match-inject']);
    });
});
