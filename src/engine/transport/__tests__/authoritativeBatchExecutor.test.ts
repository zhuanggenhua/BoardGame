import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import { createInitialSystemState } from '../../pipeline';
import {
    executeAuthoritativeCommandBatch,
    type AuthoritativeBatchCommand,
    type AuthoritativeBatchMatch,
} from '../authoritativeBatchExecutor';
import type { StoredMatchState } from '../storage';

type TestCore = {
    count: number;
};

function createState(count: number): MatchState<TestCore> {
    return {
        core: { count },
        sys: createInitialSystemState(['0', '1'], []),
    };
}

function createMatch(state: MatchState<unknown>, stateID = 1): AuthoritativeBatchMatch {
    return {
        matchID: 'match-1',
        state,
        stateID,
        randomSeed: 'seed-1',
        getRandomCursor: () => 7,
        lastCommandFailureReason: null,
    };
}

describe('executeAuthoritativeCommandBatch', () => {
    it('成功时串行执行命令，只广播最终权威状态', async () => {
        const match = createMatch(createState(0) as MatchState<unknown>);
        const commands: AuthoritativeBatchCommand[] = [
            { type: 'A', payload: {} },
            { type: 'B', payload: {} },
        ];
        const executed: string[] = [];
        const traces: string[] = [];
        let broadcastCount = 0;

        const result = await executeAuthoritativeCommandBatch({
            match,
            commands,
            tracePrefix: 'test-batch',
            tracePayload: { matchID: match.matchID, batchId: 'batch-1' },
            staleTracePayload: { matchID: match.matchID, batchId: 'batch-1', expectedStateID: 1, actualStateID: 1 },
            emitTrace: (stage) => traces.push(stage),
            rejectWhenStatePreconditionFails: async () => false,
            executeCommand: async (command) => {
                executed.push(command.type);
                match.stateID += 1;
                return true;
            },
            persistRollbackState: async () => {
                throw new Error('rollback should not run');
            },
            broadcastState: () => {
                broadcastCount += 1;
            },
            buildAuthoritativeState: () => ({ stateID: match.stateID }),
        });

        expect(result).toEqual({ status: 'confirmed', authoritativeState: { stateID: 3 } });
        expect(executed).toEqual(['A', 'B']);
        expect(broadcastCount).toBe(1);
        expect(traces).toEqual(['test-batch-confirmed']);
    });

    it('命令失败时回滚到批次前状态并透传真实失败原因', async () => {
        const initialState = createState(0) as MatchState<unknown>;
        const match = createMatch(initialState);
        const persisted: StoredMatchState[] = [];
        const traces: Array<{ stage: string; payload: Record<string, unknown> }> = [];
        let broadcastCount = 0;

        const result = await executeAuthoritativeCommandBatch({
            match,
            commands: [
                { type: 'A', payload: {} },
                { type: 'B', payload: {} },
            ],
            tracePrefix: 'test-batch',
            tracePayload: { matchID: match.matchID, batchId: 'batch-1' },
            staleTracePayload: { matchID: match.matchID, batchId: 'batch-1', expectedStateID: 1, actualStateID: 1 },
            emitTrace: (stage, payload) => traces.push({ stage, payload }),
            rejectWhenStatePreconditionFails: async () => false,
            executeCommand: async (command) => {
                if (command.type === 'A') {
                    match.state = createState(1) as MatchState<unknown>;
                    match.stateID = 2;
                    return true;
                }
                match.lastCommandFailureReason = 'domain_rejected';
                return false;
            },
            persistRollbackState: async (state) => {
                persisted.push(state);
            },
            broadcastState: () => {
                broadcastCount += 1;
            },
            buildAuthoritativeState: () => ({ stateID: match.stateID }),
        });

        expect(result).toEqual({
            status: 'command-rejected',
            failedCommandType: 'B',
            failureReason: 'domain_rejected',
        });
        expect(match.state).toBe(initialState);
        expect(match.stateID).toBe(1);
        expect(persisted).toEqual([{
            G: initialState,
            _stateID: 1,
            randomSeed: 'seed-1',
            randomCursor: 7,
        }]);
        expect(broadcastCount).toBe(1);
        expect(traces).toEqual([{
            stage: 'test-batch-command-failed',
            payload: {
                matchID: 'match-1',
                batchId: 'batch-1',
                commandType: 'B',
                failureReason: 'domain_rejected',
            },
        }]);
    });

    it('状态前置条件失败时不执行命令也不广播', async () => {
        const match = createMatch(createState(0) as MatchState<unknown>);
        const traces: Array<{ stage: string; payload: Record<string, unknown> }> = [];

        const result = await executeAuthoritativeCommandBatch({
            match,
            commands: [{ type: 'A', payload: {} }],
            tracePrefix: 'test-batch',
            tracePayload: { matchID: match.matchID, batchId: 'batch-1' },
            staleTracePayload: { matchID: match.matchID, batchId: 'batch-1', expectedStateID: 1, actualStateID: 2 },
            emitTrace: (stage, payload) => traces.push({ stage, payload }),
            rejectWhenStatePreconditionFails: async () => true,
            executeCommand: async () => {
                throw new Error('command should not execute');
            },
            persistRollbackState: async () => {
                throw new Error('rollback should not run');
            },
            broadcastState: () => {
                throw new Error('broadcast should not run');
            },
            buildAuthoritativeState: () => null,
        });

        expect(result).toEqual({ status: 'stale-rejected' });
        expect(traces).toEqual([{
            stage: 'test-batch-stale-rejected',
            payload: {
                matchID: 'match-1',
                batchId: 'batch-1',
                expectedStateID: 1,
                actualStateID: 2,
            },
        }]);
    });
});
