import logger from '../../../server/logger.js';
import type { MatchState } from '../types';
import type { AuthoritativeCommandSeatControllerType } from './authoritativeCommandExecutor';
import type { QueuedAuthoritativeCommand } from './authoritativeCommandQueue';
import type { OnlineAiCircuitAdmission, OnlineAiCircuitSource } from './onlineAiCircuitBreaker';
import { buildAiProgressMarker, type OnlineAiRecoveryEngineConfig } from './onlineAiRecovery';
import type { OnlineAiClientTransportDiagnostics } from './protocol';

export type AuthoritativeQueuedCommandStaleRejectionMatch = {
    matchID: string;
    gameId: string;
    engineConfig: OnlineAiRecoveryEngineConfig;
    state: MatchState<unknown>;
    stateID: number;
};

export type AuthoritativeQueuedCommandOptions = {
    expectedStateID?: number | null;
    onlineAiCircuitSource?: OnlineAiCircuitSource;
    feedbackSource?: string;
    onlineAiAttemptKey?: string | null;
    clientTransport?: OnlineAiClientTransportDiagnostics | null;
};

export type AuthoritativeQueuedCommandStaleRejectionHooks<
    TMatch extends AuthoritativeQueuedCommandStaleRejectionMatch,
> = {
    resolveSeatControllerType: (match: TMatch, playerId: string) => AuthoritativeCommandSeatControllerType;
    admitOnlineAiCircuitCommand: (args: {
        matchId: string;
        playerId: string;
        source: OnlineAiCircuitSource;
        expectedStateID: number;
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
};

export type AuthoritativeQueuedCommandStaleRejectionCoordinatorConfig<
    TMatch extends AuthoritativeQueuedCommandStaleRejectionMatch,
> = {
    hooks: AuthoritativeQueuedCommandStaleRejectionHooks<TMatch>;
};

export class AuthoritativeQueuedCommandStaleRejectionCoordinator<
    TMatch extends AuthoritativeQueuedCommandStaleRejectionMatch,
> {
    private readonly hooks: AuthoritativeQueuedCommandStaleRejectionHooks<TMatch>;

    constructor(config: AuthoritativeQueuedCommandStaleRejectionCoordinatorConfig<TMatch>) {
        this.hooks = config.hooks;
    }

    async reject(args: {
        match: TMatch;
        command: QueuedAuthoritativeCommand<AuthoritativeQueuedCommandOptions>;
    }): Promise<void> {
        const { match, command } = args;
        if (this.hooks.resolveSeatControllerType(match, command.playerID) !== 'human') {
            const expectedStateID = command.options?.expectedStateID ?? command.stateIDAtEnqueue;
            const source = command.options?.onlineAiCircuitSource
                ?? (command.options?.feedbackSource === 'online-ai-watchdog' ? 'watchdog' : 'client');
            const admission = this.hooks.admitOnlineAiCircuitCommand({
                matchId: match.matchID,
                playerId: command.playerID,
                source,
                expectedStateID,
                stateID: match.stateID,
            });
            if (admission.allowed) {
                await this.hooks.recordOnlineAiCircuitFailure({
                    match,
                    playerId: command.playerID,
                    source,
                    commandType: command.commandType,
                    commandPayload: command.payload,
                    reason: 'stale_state',
                    expectedStateID,
                    stateID: match.stateID,
                    progressMarker: buildAiProgressMarker(match.state, {
                        engineConfig: match.engineConfig,
                        gameId: match.gameId,
                    }),
                    onlineAiAttemptKey: command.options?.onlineAiAttemptKey,
                    clientTransport: command.options?.clientTransport,
                });
            }
        }

        logger.warn('[GameTransport] dropped stale queued command', {
            matchID: match.matchID,
            playerID: command.playerID,
            commandType: command.commandType,
            stateIDAtEnqueue: command.stateIDAtEnqueue,
            currentStateID: match.stateID,
        });
    }
}
