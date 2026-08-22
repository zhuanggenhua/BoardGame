import { describe, expect, it } from 'vitest';
import { MatchRoomRuntime, type MatchRoomRuntimeMatch } from '../matchRoomRuntime';
import type { AuthoritativeCommandQueueItem } from '../authoritativeCommandQueue';

type TestOptions = {
    source?: string;
};

type TestMatch = MatchRoomRuntimeMatch<TestOptions> & {
    directExecuted: string[];
    executed: string[];
    stale: string[];
    errors: string[];
    succeeded: string[];
};

function createMatch(stateID = 1): TestMatch {
    return {
        matchID: 'runtime-match',
        stateID,
        executing: false,
        unloaded: false,
        commandQueue: [],
        directExecuted: [],
        executed: [],
        stale: [],
        errors: [],
        succeeded: [],
    };
}

function createRuntime(match = createMatch()) {
    return new MatchRoomRuntime(match, {
        executeQueuedCommand: async (activeMatch, command) => {
            activeMatch.executed.push(`${command.playerID}:${command.commandType}`);
            activeMatch.stateID += 1;
            return true;
        },
        rejectStaleQueuedCommand: async (activeMatch, command) => {
            activeMatch.stale.push(`${command.commandType}:${command.stateIDAtEnqueue}->${activeMatch.stateID}`);
        },
        onQueuedExecutionError: (activeMatch, _item: AuthoritativeCommandQueueItem<TestOptions>, error: unknown) => {
            activeMatch.errors.push(error instanceof Error ? error.message : String(error));
        },
    });
}

describe('MatchRoomRuntime', () => {
    it('runExclusive 统一持有执行锁，并在结束前 drain 权威命令队列', async () => {
        const match = createMatch();
        const runtime = createRuntime(match);
        const seenExecuting: boolean[] = [];

        const result = await runtime.runExclusive(async () => {
            seenExecuting.push(runtime.isExecuting());
            match.stateID += 1;
            runtime.enqueueCommand({
                commandType: 'QUEUED',
                payload: {},
                playerID: '1',
                stateIDAtEnqueue: 2,
            });
            return 'ok';
        });

        expect(result).toBe('ok');
        expect(seenExecuting).toEqual([true]);
        expect(runtime.isExecuting()).toBe(false);
        expect(match.executed).toEqual(['1:QUEUED']);
        expect(match.stateID).toBe(3);
    });

    it('tryBeginExecution 拒绝 busy/unloaded 房间，不创建第二套锁状态', () => {
        const match = createMatch();
        const runtime = createRuntime(match);

        expect(runtime.tryBeginExecution()).toBe(true);
        expect(runtime.isExecuting()).toBe(true);
        expect(runtime.tryBeginExecution()).toBe(false);

        runtime.finishExecution();
        runtime.markUnloaded();

        expect(runtime.isUnloaded()).toBe(true);
        expect(runtime.tryBeginExecution()).toBe(false);
    });

    it('markUnloaded 清空等待队列，并让等待中的调用方收到失败', async () => {
        const match = createMatch();
        const runtime = createRuntime(match);
        const queued = runtime.enqueueCommand({
            commandType: 'WAITING',
            payload: {},
            playerID: '0',
            stateIDAtEnqueue: 1,
        });

        expect(runtime.queueLength()).toBe(1);
        runtime.markUnloaded();

        await expect(queued).resolves.toBe(false);
        expect(runtime.queueLength()).toBe(0);
        expect(match.executed).toEqual([]);
    });

    it('executeCommand 在空闲房间直接独占执行，成功后触发成功回调', async () => {
        const match = createMatch();
        const runtime = createRuntime(match);

        const success = await runtime.executeCommand({
            playerID: '0',
            commandType: 'DIRECT',
            payload: { value: 1 },
            directOptions: { source: 'direct' },
            queuedOptions: { source: 'queued' },
            executeCommand: async (activeMatch, playerID, commandType, _payload, options) => {
                activeMatch.directExecuted.push(`${playerID}:${commandType}:${options?.source}`);
                activeMatch.stateID += 1;
                return true;
            },
            onSucceeded: async (activeMatch) => {
                activeMatch.succeeded.push(`state:${activeMatch.stateID}`);
            },
        });

        expect(success).toBe(true);
        expect(runtime.isExecuting()).toBe(false);
        expect(match.directExecuted).toEqual(['0:DIRECT:direct']);
        expect(match.executed).toEqual([]);
        expect(match.succeeded).toEqual(['state:2']);
    });

    it('executeCommand 在 busy 房间只入队，不调用直连执行回调', async () => {
        const match = createMatch();
        const runtime = createRuntime(match);
        const begin = runtime.tryBeginExecution();
        expect(begin).toBe(true);

        const queued = runtime.executeCommand({
            playerID: '1',
            commandType: 'QUEUED_COMMAND',
            payload: {},
            directOptions: { source: 'direct' },
            queuedOptions: { source: 'queued' },
            executeCommand: async (activeMatch) => {
                activeMatch.directExecuted.push('unexpected');
                return true;
            },
            onSucceeded: async (activeMatch) => {
                activeMatch.succeeded.push('unexpected');
            },
        });

        expect(match.directExecuted).toEqual([]);
        expect(match.succeeded).toEqual([]);
        expect(runtime.queueLength()).toBe(1);

        runtime.finishExecution();
        await runtime.drainCommandQueue();

        await expect(queued).resolves.toBe(true);
        expect(match.executed).toEqual(['1:QUEUED_COMMAND']);
        expect(match.directExecuted).toEqual([]);
        expect(match.succeeded).toEqual([]);
    });

    it('executeBatchTask 在空闲房间执行直接任务，在 busy 房间进入同一队列', async () => {
        const directMatch = createMatch();
        const directRuntime = createRuntime(directMatch);

        const directResult = await directRuntime.executeBatchTask({
            queuedBatch: {
                _batch: true,
                execute: async () => {
                    directMatch.executed.push('unexpected-queued-batch');
                    return true;
                },
            },
            executeBatch: async (activeMatch) => {
                activeMatch.directExecuted.push('direct-batch');
                activeMatch.stateID += 1;
                return true;
            },
            onSucceeded: async (activeMatch) => {
                activeMatch.succeeded.push(`batch:${activeMatch.stateID}`);
            },
        });

        expect(directResult).toEqual({ queued: false, succeeded: true });
        expect(directMatch.directExecuted).toEqual(['direct-batch']);
        expect(directMatch.succeeded).toEqual(['batch:2']);

        const queuedMatch = createMatch();
        const queuedRuntime = createRuntime(queuedMatch);
        expect(queuedRuntime.tryBeginExecution()).toBe(true);
        const queuedLengths: number[] = [];
        const queuedResult = queuedRuntime.executeBatchTask({
            queuedBatch: {
                _batch: true,
                execute: async () => {
                    queuedMatch.executed.push('queued-batch');
                    queuedMatch.stateID += 1;
                    return true;
                },
            },
            onQueued: (queueLength) => {
                queuedLengths.push(queueLength);
            },
            executeBatch: async (activeMatch) => {
                activeMatch.directExecuted.push('unexpected-direct-batch');
                return true;
            },
            onSucceeded: async (activeMatch) => {
                activeMatch.succeeded.push('unexpected');
            },
        });

        expect(queuedLengths).toEqual([0]);
        expect(queuedRuntime.queueLength()).toBe(1);
        queuedRuntime.finishExecution();
        await queuedRuntime.drainCommandQueue();

        await expect(queuedResult).resolves.toEqual({ queued: true, succeeded: true });
        expect(queuedMatch.executed).toEqual(['queued-batch']);
        expect(queuedMatch.directExecuted).toEqual([]);
        expect(queuedMatch.succeeded).toEqual([]);
    });
});
