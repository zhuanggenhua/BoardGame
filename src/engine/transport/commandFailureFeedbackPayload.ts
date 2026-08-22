import type { MatchState } from '../types';
import {
    resolveCommandFailureFeedbackSeverity,
    type CommandFailureFeedbackSource,
    type CommandFailureFeedbackSeverity,
} from './commandFailureReason';
import { buildOnlineAiDiagnosticActionLog, type OnlineAiRecoveryLegalActionSummary } from './onlineAiWatchdogFeedbackDiagnostics';

export type CommandFailureAiDiagnostic = {
    seatControllerType: 'human' | 'local-ai' | 'remote-ai';
    legalActions: OnlineAiRecoveryLegalActionSummary | null;
};

export type CommandFailureFeedbackPayload = {
    matchId: string;
    gameId: string;
    playerId: string;
    incidentKind: 'command-failed';
    feedbackSource: CommandFailureFeedbackSource;
    severity: CommandFailureFeedbackSeverity;
    commandType: string;
    reason: string;
    incidentKey: string;
    progressMarker: string;
    stateSnapshot: string;
    actionLog?: string;
};

const cloneCommandFailureDiagnosticValue = (value: unknown): unknown => {
    if (value === undefined) {
        return null;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return '[unserializable-diagnostic-value]';
    }
};

export function buildCommandFailureFeedbackPayload(args: {
    matchId: string;
    gameId: string;
    state: MatchState<unknown>;
    playerId: string;
    commandType: string;
    reason: string;
    commandPayload: unknown;
    progressMarker: string;
    stateIdBefore: number;
    visibleState: MatchState<unknown>;
    feedbackSource: CommandFailureFeedbackSource;
    aiContext: CommandFailureAiDiagnostic;
}): CommandFailureFeedbackPayload {
    const incidentKey = [
        args.playerId,
        args.commandType,
        args.reason,
        args.progressMarker,
    ].join(':');
    const phase = typeof args.state.sys?.phase === 'string' ? args.state.sys.phase : null;
    const turnNumber = typeof args.state.sys?.turnNumber === 'number' ? args.state.sys.turnNumber : null;

    return {
        matchId: args.matchId,
        gameId: args.gameId,
        playerId: args.playerId,
        incidentKind: 'command-failed',
        feedbackSource: args.feedbackSource,
        severity: resolveCommandFailureFeedbackSeverity(args.reason),
        commandType: args.commandType,
        reason: args.reason,
        incidentKey,
        progressMarker: args.progressMarker,
        stateSnapshot: JSON.stringify({
            kind: 'command-failure-feedback',
            commandType: args.commandType,
            reason: args.reason,
            progressMarker: args.progressMarker,
            stateIDBefore: args.stateIdBefore,
            feedbackSource: args.feedbackSource,
            phase,
            turnNumber,
            command: {
                type: args.commandType,
                payload: cloneCommandFailureDiagnosticValue(args.commandPayload),
            },
            aiContext: args.aiContext,
            visibleState: args.visibleState,
        }),
        actionLog: buildOnlineAiDiagnosticActionLog({
            state: args.state,
            playerId: args.playerId,
            phase,
            progressMarker: args.progressMarker,
            commandType: args.commandType,
            reason: args.reason,
            feedbackSource: args.feedbackSource,
            commandPayload: args.commandPayload,
        }),
    };
}
