import type { MatchState } from '../types';
import type { OnlineAiClientTransportDiagnostics } from './protocol';
import { buildAiProgressMarker, type OnlineAiRecoveryEngineConfig } from './onlineAiRecovery';
import type { OnlineAiCircuitSnapshot } from './onlineAiCircuitBreaker';

export type OnlineAiCircuitQueuedItemLike = {
    commandType: string;
    payload: unknown;
    playerID: string;
    stateIDAtEnqueue: number;
} | {
    _batch: true;
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

export function buildOnlineAiCircuitQueueDiagnostic(
    commandQueue: OnlineAiCircuitQueuedItemLike[],
): Array<Record<string, unknown>> {
    return commandQueue.slice(0, 8).map((queued) => {
        if ('_batch' in queued) {
            return { kind: 'batch', commandCount: 'unknown' };
        }
        return {
            kind: 'command',
            playerId: queued.playerID,
            commandType: queued.commandType,
            stateIDAtEnqueue: queued.stateIDAtEnqueue,
            payload: cloneCircuitDiagnosticValue(queued.payload),
        };
    });
}

export function buildOnlineAiCircuitStateSnapshot(args: {
    matchId: string;
    gameId: string;
    state: MatchState<unknown>;
    stateID: number;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    commandQueue: OnlineAiCircuitQueuedItemLike[];
    snapshot: OnlineAiCircuitSnapshot;
    commandType?: string;
    commandPayload?: unknown;
    reason?: string;
    onlineAiAttemptKey?: string | null;
    clientTransport?: OnlineAiClientTransportDiagnostics | null;
}): string {
    return JSON.stringify({
        feedbackSource: 'online-ai-circuit-breaker',
        matchId: args.matchId,
        gameId: args.gameId,
        playerId: args.snapshot.playerId,
        command: args.commandType
            ? {
                type: args.commandType,
                payload: cloneCircuitDiagnosticValue(args.commandPayload),
            }
            : null,
        reason: args.reason ?? null,
        onlineAiAttemptKey: args.onlineAiAttemptKey ?? null,
        clientTransport: args.clientTransport ?? null,
        stateID: args.stateID,
        progressMarker: buildAiProgressMarker(args.state, {
            engineConfig: args.engineConfig,
            gameId: args.gameId,
        }),
        circuit: args.snapshot,
        queue: {
            length: args.commandQueue.length,
            items: buildOnlineAiCircuitQueueDiagnostic(args.commandQueue),
        },
    });
}
