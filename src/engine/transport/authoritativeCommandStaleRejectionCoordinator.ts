import logger from '../../../server/logger.js';
import type { AuthoritativeCommandSeatControllerType } from './authoritativeCommandExecutor';
import type { OnlineAiCircuitSnapshot, OnlineAiCircuitSource } from './onlineAiCircuitBreaker';
import type { OnlineAiClientTransportDiagnostics } from './protocol';

export type AuthoritativeCommandStaleRejectionMatch = {
    matchID: string;
    gameId: string;
    engineConfig: { gameId: string };
    lastCommandFailureReason: string | null;
};

export type AuthoritativeCommandStaleRejectionHooks<TMatch extends AuthoritativeCommandStaleRejectionMatch> = {
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
    }) => Promise<OnlineAiCircuitSnapshot>;
    emitPlayerError: (match: TMatch, playerId: string, reason: 'stale_state') => void;
};

export type AuthoritativeCommandStaleRejectionCoordinatorConfig<
    TMatch extends AuthoritativeCommandStaleRejectionMatch,
> = {
    hooks: AuthoritativeCommandStaleRejectionHooks<TMatch>;
};

const cloneStaleDiagnosticValue = (value: unknown): unknown => {
    if (value === undefined) {
        return null;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return '[unserializable-diagnostic-value]';
    }
};

export class AuthoritativeCommandStaleRejectionCoordinator<
    TMatch extends AuthoritativeCommandStaleRejectionMatch,
> {
    private readonly hooks: AuthoritativeCommandStaleRejectionHooks<TMatch>;

    constructor(config: AuthoritativeCommandStaleRejectionCoordinatorConfig<TMatch>) {
        this.hooks = config.hooks;
    }

    async rejectIfStale(args: {
        match: TMatch;
        playerId: string;
        commandType: string;
        commandPayload: unknown;
        seatControllerType: AuthoritativeCommandSeatControllerType;
        expectedStateID?: number;
        stateIdBefore: number;
        progressMarker: string;
        onlineAiCircuitSource: OnlineAiCircuitSource;
        onlineAiAttemptKey?: string | null;
        clientTransport?: OnlineAiClientTransportDiagnostics | null;
    }): Promise<{ rejected: true } | { rejected: false }> {
        if (
            typeof args.expectedStateID !== 'number'
            || args.expectedStateID === args.stateIdBefore
        ) {
            return { rejected: false };
        }

        args.match.lastCommandFailureReason = 'stale_state';

        if (args.seatControllerType !== 'human') {
            const circuitSnapshot = await this.hooks.recordOnlineAiCircuitFailure({
                match: args.match,
                playerId: args.playerId,
                source: args.onlineAiCircuitSource,
                commandType: args.commandType,
                commandPayload: args.commandPayload,
                reason: 'stale_state',
                expectedStateID: args.expectedStateID,
                stateID: args.stateIdBefore,
                progressMarker: args.progressMarker,
                onlineAiAttemptKey: args.onlineAiAttemptKey,
                clientTransport: args.clientTransport,
            });
            logger.warn('[GameTransport] online AI command rejected due to stale state precondition', {
                matchID: args.match.matchID,
                gameId: args.match.engineConfig.gameId,
                playerID: args.playerId,
                commandType: args.commandType,
                commandPayload: cloneStaleDiagnosticValue(args.commandPayload),
                expectedStateID: args.expectedStateID,
                actualStateID: args.stateIdBefore,
                onlineAiAttemptKey: args.onlineAiAttemptKey ?? null,
                clientTransport: args.clientTransport ?? null,
                circuitFailureCount: circuitSnapshot.failureCount,
                circuitTripped: circuitSnapshot.tripped,
            });
        } else {
            logger.warn('[GameTransport] human command rejected due to stale state precondition', {
                matchID: args.match.matchID,
                gameId: args.match.engineConfig.gameId,
                playerID: args.playerId,
                commandType: args.commandType,
                commandPayload: cloneStaleDiagnosticValue(args.commandPayload),
                expectedStateID: args.expectedStateID,
                actualStateID: args.stateIdBefore,
            });
        }

        this.hooks.emitPlayerError(args.match, args.playerId, 'stale_state');
        return { rejected: true };
    }
}
