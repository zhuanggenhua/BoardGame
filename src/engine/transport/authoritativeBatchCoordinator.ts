import logger from '../../../server/logger.js';
import type { MatchState } from '../types';
import {
    executeAuthoritativeCommandBatch,
    type AuthoritativeBatchCommand,
    type AuthoritativeBatchMatch,
    type AuthoritativeBatchTrace,
} from './authoritativeBatchExecutor';
import type { AuthoritativeCommandSeatControllerType } from './authoritativeCommandExecutor';
import {
    buildAiProgressMarker,
    type OnlineAiRecoveryEngineConfig,
} from './onlineAiRecovery';
import type { OnlineAiCircuitAdmission, OnlineAiCircuitSource } from './onlineAiCircuitBreaker';
import {
    normalizeOnlineAiAttemptKey,
    normalizeOnlineAiClientTransportDiagnostics,
} from './onlineAiClientTransportDiagnostics';
import type { BatchDispatchMeta, OnlineAiClientTransportDiagnostics } from './protocol';
import type { StoredMatchState } from './storage';

export type AuthoritativeBatchCoordinatorMatch = AuthoritativeBatchMatch & {
    gameId: string;
    engineConfig: OnlineAiRecoveryEngineConfig;
    state: MatchState<unknown>;
};

export type AuthoritativeBatchCoordinatorHooks<
    TMatch extends AuthoritativeBatchCoordinatorMatch,
> = {
    executeCommand: (args: {
        match: TMatch;
        playerId: string;
        command: AuthoritativeBatchCommand;
        onlineAiAttemptKey?: string | null;
        clientTransport?: OnlineAiClientTransportDiagnostics | null;
    }) => Promise<boolean>;
    restoreRandomCursor: (match: TMatch, randomCursor: number) => void;
    persistRollbackState: (match: TMatch, storedState: StoredMatchState) => Promise<void>;
    broadcastState: (match: TMatch) => void;
    buildAuthoritativeState: (match: TMatch) => unknown;
    resolveSeatControllerType: (match: TMatch, playerId: string) => AuthoritativeCommandSeatControllerType;
    admitOnlineAiCircuitCommand: (args: {
        matchId: string;
        playerId: string;
        source: OnlineAiCircuitSource;
        expectedStateID?: number | null;
        stateID: number;
    }) => OnlineAiCircuitAdmission;
    recordOnlineAiCircuitFailure: (args: {
        match: TMatch;
        playerId: string;
        source: OnlineAiCircuitSource;
        commandType: string;
        commandPayload: unknown;
        reason: 'stale_state';
        expectedStateID: number;
        stateID: number;
        progressMarker: string;
        onlineAiAttemptKey?: string | null;
        clientTransport?: OnlineAiClientTransportDiagnostics | null;
    }) => Promise<unknown>;
    emitTrace: AuthoritativeBatchTrace;
};

export type AuthoritativeBatchCoordinatorConfig<
    TMatch extends AuthoritativeBatchCoordinatorMatch,
> = {
    hooks: AuthoritativeBatchCoordinatorHooks<TMatch>;
};

export class AuthoritativeBatchCoordinator<
    TMatch extends AuthoritativeBatchCoordinatorMatch,
> {
    private readonly hooks: AuthoritativeBatchCoordinatorHooks<TMatch>;

    constructor(config: AuthoritativeBatchCoordinatorConfig<TMatch>) {
        this.hooks = config.hooks;
    }

    async execute(args: {
        match: TMatch;
        playerId: string;
        batchId: string;
        commands: AuthoritativeBatchCommand[];
        meta?: BatchDispatchMeta;
        tracePrefix: string;
        emitBatchRejected: (matchId: string, batchId: string, reason: string) => void;
        emitBatchConfirmed: (matchId: string, batchId: string, authoritativeState: unknown) => void;
    }): Promise<boolean> {
        const { match } = args;
        const matchID = match.matchID;
        const onlineAiAttemptKey = normalizeOnlineAiAttemptKey(args.meta?.onlineAiAttemptKey);
        const clientTransport = normalizeOnlineAiClientTransportDiagnostics(args.meta?.clientTransport);
        const batchResult = await executeAuthoritativeCommandBatch({
            match,
            commands: args.commands,
            tracePrefix: args.tracePrefix,
            tracePayload: {
                matchID,
                playerID: args.playerId,
                batchId: args.batchId,
            },
            staleTracePayload: {
                matchID,
                playerID: args.playerId,
                batchId: args.batchId,
                expectedStateID: args.meta?.expectedStateID ?? null,
                actualStateID: match.stateID,
            },
            emitTrace: this.hooks.emitTrace,
            rejectWhenStatePreconditionFails: () => this.rejectWhenStatePreconditionFails({
                ...args,
                onlineAiAttemptKey,
                clientTransport,
            }),
            executeCommand: (command) => this.hooks.executeCommand({
                match,
                playerId: args.playerId,
                command,
                onlineAiAttemptKey,
                clientTransport,
            }),
            restoreRandomCursor: (randomCursor) => this.hooks.restoreRandomCursor(match, randomCursor),
            persistRollbackState: (storedState) => this.hooks.persistRollbackState(match, storedState),
            broadcastState: () => this.hooks.broadcastState(match),
            buildAuthoritativeState: () => this.hooks.buildAuthoritativeState(match),
        });

        if (batchResult.status === 'stale-rejected') {
            return false;
        }
        if (batchResult.status === 'command-rejected') {
            args.emitBatchRejected(matchID, args.batchId, batchResult.failureReason);
            return false;
        }

        args.emitBatchConfirmed(matchID, args.batchId, batchResult.authoritativeState);
        return true;
    }

    private async rejectWhenStatePreconditionFails(args: {
        match: TMatch;
        playerId: string;
        batchId: string;
        commands: AuthoritativeBatchCommand[];
        meta?: BatchDispatchMeta;
        onlineAiAttemptKey?: string | null;
        clientTransport?: OnlineAiClientTransportDiagnostics | null;
        emitBatchRejected: (matchId: string, batchId: string, reason: string) => void;
    }): Promise<boolean> {
        const expectedStateID = args.meta?.expectedStateID;
        if (typeof expectedStateID !== 'number') {
            return false;
        }
        const { match } = args;
        if (match.stateID === expectedStateID) {
            return false;
        }

        if (this.hooks.resolveSeatControllerType(match, args.playerId) !== 'human') {
            const admission = this.hooks.admitOnlineAiCircuitCommand({
                matchId: match.matchID,
                playerId: args.playerId,
                source: 'client',
                expectedStateID,
                stateID: match.stateID,
            });
            if (!admission.allowed) {
                args.emitBatchRejected(
                    match.matchID,
                    args.batchId,
                    admission.reason === 'stale-epoch' ? 'stale_state' : 'online_ai_circuit_open',
                );
                return true;
            }
            await this.hooks.recordOnlineAiCircuitFailure({
                match,
                playerId: args.playerId,
                source: 'client',
                commandType: args.commands[0]?.type ?? 'batch',
                commandPayload: args.commands[0]?.payload,
                reason: 'stale_state',
                expectedStateID,
                stateID: match.stateID,
                progressMarker: buildAiProgressMarker(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                }),
                onlineAiAttemptKey: args.onlineAiAttemptKey,
                clientTransport: args.clientTransport,
            });
        }

        logger.warn('[GameTransport] batch rejected due to stale state precondition', {
            matchID: match.matchID,
            batchId: args.batchId,
            expectedStateID,
            actualStateID: match.stateID,
        });
        args.emitBatchRejected(match.matchID, args.batchId, 'stale_state');
        return true;
    }
}
