import type { MatchState } from '../types';
import type { StoredMatchState } from './storage';
import { GENERIC_COMMAND_FAILURE_REASON } from './commandFailureReason';

export type AuthoritativeBatchCommand = {
    type: string;
    payload: unknown;
};

export type AuthoritativeBatchMatch = {
    matchID: string;
    state: MatchState<unknown>;
    stateID: number;
    randomSeed: string;
    getRandomCursor: () => number;
    lastCommandFailureReason: string | null;
};

export type AuthoritativeBatchTrace = (stage: string, payload: Record<string, unknown>) => void;

export type AuthoritativeBatchExecutionResult =
    | { status: 'stale-rejected' }
    | {
        status: 'command-rejected';
        failedCommandType: string;
        failureReason: string;
    }
    | {
        status: 'confirmed';
        authoritativeState: unknown;
    };

export type ExecuteAuthoritativeCommandBatchArgs = {
    match: AuthoritativeBatchMatch;
    commands: AuthoritativeBatchCommand[];
    tracePrefix: string;
    tracePayload: Record<string, unknown>;
    staleTracePayload: Record<string, unknown>;
    emitTrace: AuthoritativeBatchTrace;
    rejectWhenStatePreconditionFails: () => Promise<boolean>;
    executeCommand: (command: AuthoritativeBatchCommand) => Promise<boolean>;
    persistRollbackState: (state: StoredMatchState) => Promise<void>;
    broadcastState: () => void;
    buildAuthoritativeState: () => unknown;
};

export async function executeAuthoritativeCommandBatch(
    args: ExecuteAuthoritativeCommandBatchArgs,
): Promise<AuthoritativeBatchExecutionResult> {
    const { match } = args;
    const snapshotState = match.state;
    const snapshotStateID = match.stateID;

    if (await args.rejectWhenStatePreconditionFails()) {
        args.emitTrace(`${args.tracePrefix}-stale-rejected`, args.staleTracePayload);
        return { status: 'stale-rejected' };
    }

    for (const command of args.commands) {
        match.lastCommandFailureReason = null;
        const success = await args.executeCommand(command);
        if (!success) {
            const failureReason = match.lastCommandFailureReason ?? GENERIC_COMMAND_FAILURE_REASON;
            args.emitTrace(`${args.tracePrefix}-command-failed`, {
                ...args.tracePayload,
                commandType: command.type,
                failureReason,
            });

            match.state = snapshotState;
            match.stateID = snapshotStateID;
            await args.persistRollbackState({
                G: snapshotState,
                _stateID: snapshotStateID,
                randomSeed: match.randomSeed,
                randomCursor: match.getRandomCursor(),
            });
            args.broadcastState();
            return {
                status: 'command-rejected',
                failedCommandType: command.type,
                failureReason,
            };
        }
    }

    args.broadcastState();
    args.emitTrace(`${args.tracePrefix}-confirmed`, {
        ...args.tracePayload,
        stateID: match.stateID,
    });
    return {
        status: 'confirmed',
        authoritativeState: args.buildAuthoritativeState(),
    };
}
