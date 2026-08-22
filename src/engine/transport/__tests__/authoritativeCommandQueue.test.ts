import { describe, expect, it } from 'vitest';
import {
    drainAuthoritativeCommandQueue,
    enqueueAuthoritativeBatch,
    enqueueAuthoritativeCommand,
    runAuthoritativeCommandQueueExclusive,
    type AuthoritativeCommandQueueItem,
    type AuthoritativeCommandQueueMatch,
} from '../authoritativeCommandQueue';

type TestOptions = {
    expectedStateID?: number;
};

type TestMatch = AuthoritativeCommandQueueMatch<TestOptions> & {
    executed: string[];
    stale: string[];
    errors: string[];
};

function createMatch(stateID = 1): TestMatch {
    return {
        matchID: 'match-queue',
        stateID,
        executing: false,
        unloaded: false,
        commandQueue: [],
        executed: [],
        stale: [],
        errors: [],
    };
}

function createHandlers() {
    return {
        executeQueuedCommand: async (match: TestMatch, command: Extract<AuthoritativeCommandQueueItem<TestOptions>, { commandType: string }>) => {
            match.executed.push(command.commandType);
            match.stateID += 1;
            return command.commandType !== 'FAIL';
        },
        rejectStaleQueuedCommand: async (match: TestMatch, command: Extract<AuthoritativeCommandQueueItem<TestOptions>, { commandType: string }>) => {
            match.stale.push(`${command.commandType}:${command.stateIDAtEnqueue}->${match.stateID}`);
        },
        onQueuedExecutionError: (match: TestMatch, _item: AuthoritativeCommandQueueItem<TestOptions>, error: unknown) => {
            match.errors.push(error instanceof Error ? error.message : String(error));
        },
    };
}

describe('authoritativeCommandQueue', () => {
    it('按入队 stateID 丢弃 stale command，不执行旧命令', async () => {
        const match = createMatch(2);
        const queued = enqueueAuthoritativeCommand(match, {
            commandType: 'OLD',
            payload: {},
            playerID: '1',
            stateIDAtEnqueue: 1,
            options: { expectedStateID: 1 },
        });

        await drainAuthoritativeCommandQueue(match, createHandlers());

        await expect(queued).resolves.toBe(false);
        expect(match.executed).toEqual([]);
        expect(match.stale).toEqual(['OLD:1->2']);
    });

    it('串行消费 batch 与普通命令，并把 batch 作为同一队列任务处理', async () => {
        const match = createMatch(1);
        const completed: string[] = [];
        const batch = enqueueAuthoritativeBatch(match, {
            _batch: true,
            execute: async () => {
                completed.push('batch');
                match.stateID += 1;
                return true;
            },
        });
        const command = enqueueAuthoritativeCommand(match, {
            commandType: 'AFTER_BATCH',
            payload: {},
            playerID: '0',
            stateIDAtEnqueue: 2,
        });

        await drainAuthoritativeCommandQueue(match, createHandlers());

        await expect(batch).resolves.toBe(true);
        await expect(command).resolves.toBe(true);
        expect(completed).toEqual(['batch']);
        expect(match.executed).toEqual(['AFTER_BATCH']);
        expect(match.stateID).toBe(3);
    });

    it('batch 执行失败时把失败结果传回排队调用方', async () => {
        const match = createMatch(1);
        const completed: string[] = [];
        const batch = enqueueAuthoritativeBatch(match, {
            _batch: true,
            execute: async () => {
                completed.push('batch-failed');
                return false;
            },
        });

        await drainAuthoritativeCommandQueue(match, createHandlers());

        await expect(batch).resolves.toBe(false);
        expect(completed).toEqual(['batch-failed']);
        expect(match.executed).toEqual([]);
    });

    it('exclusive 执行期间保持 executing，结束后 drain 队列并释放锁', async () => {
        const match = createMatch(1);
        const seenExecuting: boolean[] = [];

        const result = await runAuthoritativeCommandQueueExclusive(match, {
            execute: async () => {
                seenExecuting.push(match.executing);
                match.stateID += 1;
                enqueueAuthoritativeCommand(match, {
                    commandType: 'QUEUED',
                    payload: {},
                    playerID: '0',
                    stateIDAtEnqueue: 2,
                });
                return 'done';
            },
            drain: () => drainAuthoritativeCommandQueue(match, createHandlers()),
        });

        expect(result).toBe('done');
        expect(seenExecuting).toEqual([true]);
        expect(match.executing).toBe(false);
        expect(match.executed).toEqual(['QUEUED']);
    });
});
