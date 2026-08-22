import type { MatchState } from '../types';
import logger from '../../../server/logger.js';
import {
    OnlineAiCircuitBreaker,
    type OnlineAiCircuitBlockReason,
    type OnlineAiCircuitSnapshot,
    type OnlineAiCircuitSource,
} from './onlineAiCircuitBreaker';
import {
    buildOnlineAiCircuitStateSnapshot,
    type OnlineAiCircuitQueuedItemLike,
} from './onlineAiCircuitFeedbackDiagnostics';
import {
    buildAiProgressMarker,
    type OnlineAiRecoveryEngineConfig,
} from './onlineAiRecovery';
import type { OnlineAiClientTransportDiagnostics } from './protocol';
import type { OnlineAiRecoveryFeedbackPayload } from './transportFeedbackReporter';

export type OnlineAiCircuitFailureMatch = {
    matchID: string;
    gameId: string;
    state: MatchState<unknown>;
    stateID: number;
    engineConfig: OnlineAiRecoveryEngineConfig;
    commandQueue: OnlineAiCircuitQueuedItemLike[];
    lastCommandFailureReason: string | null;
};

export type OnlineAiCircuitFailureCoordinatorHooks<TMatch extends OnlineAiCircuitFailureMatch> = {
    reportRecoveryFeedback: (payload: OnlineAiRecoveryFeedbackPayload) => Promise<void>;
    emitPlayerError: (match: TMatch, playerId: string, reason: string) => void;
};

export type OnlineAiCircuitFailureCoordinatorConfig<TMatch extends OnlineAiCircuitFailureMatch> = {
    circuitBreaker: OnlineAiCircuitBreaker;
    hooks: OnlineAiCircuitFailureCoordinatorHooks<TMatch>;
};

const cloneCircuitDiagnosticValue = (value: unknown): unknown => {
    if (value === undefined) {
        return null;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return '[unserializable-diagnostic-value]';
    }
};

export class OnlineAiCircuitFailureCoordinator<TMatch extends OnlineAiCircuitFailureMatch> {
    private readonly circuitBreaker: OnlineAiCircuitBreaker;
    private readonly hooks: OnlineAiCircuitFailureCoordinatorHooks<TMatch>;

    constructor(config: OnlineAiCircuitFailureCoordinatorConfig<TMatch>) {
        this.circuitBreaker = config.circuitBreaker;
        this.hooks = config.hooks;
    }

    async recordFailure(args: {
        match: TMatch;
        playerId: string;
        source: OnlineAiCircuitSource;
        commandType: string;
        commandPayload?: unknown;
        reason: string;
        expectedStateID?: number | null;
        stateID: number;
        progressMarker?: string | null;
        onlineAiAttemptKey?: string | null;
        clientTransport?: OnlineAiClientTransportDiagnostics | null;
    }): Promise<OnlineAiCircuitSnapshot> {
        const snapshot = this.circuitBreaker.recordFailure({
            matchId: args.match.matchID,
            playerId: args.playerId,
            failure: {
                commandType: args.commandType,
                reason: args.reason,
                expectedStateID: args.expectedStateID,
                stateID: args.stateID,
                progressMarker: args.progressMarker,
                commandSummary: JSON.stringify(cloneCircuitDiagnosticValue(args.commandPayload)),
                attemptKey: args.onlineAiAttemptKey ?? null,
                clientTransport: args.clientTransport ?? null,
                source: args.source,
            },
        });
        if (!snapshot.tripped || !this.circuitBreaker.markCircuitReportConsumed(
            args.match.matchID,
            args.playerId,
        )) {
            return snapshot;
        }

        const lastFailure = snapshot.recentFailures[snapshot.recentFailures.length - 1];
        const reason = lastFailure?.reason ?? 'failure-budget-exhausted';
        logger.error('[GameTransport] online-ai circuit breaker tripped', {
            matchID: args.match.matchID,
            gameId: args.match.gameId,
            playerID: args.playerId,
            reason,
            failureCount: snapshot.failureCount,
            failureBudget: snapshot.failureBudget,
            stateID: args.match.stateID,
            progressMarker: args.progressMarker ?? null,
        });
        await this.hooks.reportRecoveryFeedback({
            matchId: args.match.matchID,
            gameId: args.match.gameId,
            playerId: args.playerId,
            incidentKind: 'circuit-breaker-tripped',
            severity: 'high',
            status: 'open',
            reason,
            trackerKey: `circuit-breaker:${args.playerId}:${snapshot.windowStartedAt}`,
            progressMarker: args.progressMarker ?? buildAiProgressMarker(args.match.state, {
                engineConfig: args.match.engineConfig,
                gameId: args.match.gameId,
            }),
            stateSnapshot: buildOnlineAiCircuitStateSnapshot({
                matchId: args.match.matchID,
                gameId: args.match.gameId,
                state: args.match.state,
                stateID: args.match.stateID,
                engineConfig: args.match.engineConfig,
                commandQueue: args.match.commandQueue,
                snapshot,
                commandType: args.commandType,
                commandPayload: args.commandPayload,
                reason,
                onlineAiAttemptKey: args.onlineAiAttemptKey,
                clientTransport: args.clientTransport,
            }),
            actionLog: JSON.stringify({
                type: 'online-ai-circuit-breaker',
                reason,
                recentFailures: snapshot.recentFailures,
                recoveryCount: snapshot.recoveryCount,
                queueLength: args.match.commandQueue.length,
            }),
        });
        return snapshot;
    }

    rejectCommand(args: {
        match: TMatch;
        playerId: string;
        reason: OnlineAiCircuitBlockReason;
        commandType: string;
        expectedStateID?: number | null;
        onlineAiAttemptKey?: string | null;
        clientTransport?: OnlineAiClientTransportDiagnostics | null;
        snapshot: OnlineAiCircuitSnapshot;
    }): false {
        const failureReason = args.reason === 'stale-epoch' ? 'stale_state' : 'online_ai_circuit_open';
        args.match.lastCommandFailureReason = failureReason;
        logger.warn('[GameTransport] online AI command rejected before pipeline', {
            matchID: args.match.matchID,
            gameId: args.match.gameId,
            playerID: args.playerId,
            commandType: args.commandType,
            expectedStateID: args.expectedStateID ?? null,
            onlineAiAttemptKey: args.onlineAiAttemptKey ?? null,
            clientTransport: args.clientTransport ?? null,
            stateID: args.match.stateID,
            circuitBlockReason: args.reason,
            failureCount: args.snapshot.failureCount,
            failureBudget: args.snapshot.failureBudget,
        });
        this.hooks.emitPlayerError(args.match, args.playerId, failureReason);
        return false;
    }
}
