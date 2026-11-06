import type { MatchState } from '../types';
import { projectFeedbackReasonCode } from '../../lib/feedback/diagnosticPacket';
import {
    resolveCommandFailureFeedbackSeverity,
    type CommandFailureFeedbackSource,
    type CommandFailureFeedbackSeverity,
} from './commandFailureReason';
import { buildOnlineAiDiagnosticActionLog, type OnlineAiRecoveryLegalActionSummary } from './onlineAiWatchdogFeedbackDiagnostics';
import { resolveTransportFeedbackCorrelation } from './transportFeedbackReporter';
import type { FeedbackDiagnosticSnapshots } from '../../lib/feedback/feedbackPayload';
import type { PrivateFeedbackReplayTrigger } from './feedbackPrivateReplay';

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
    stateId?: number;
    roomId?: string;
    requestId?: string;
    stateRevision?: number;
    decisionEpoch?: number;
    randomCursor?: number;
    diagnosticSnapshots?: FeedbackDiagnosticSnapshots;
    lastCommand?: Record<string, unknown>;
    commandTraceTail?: Array<Record<string, unknown>>;
    privateReplayTrigger?: PrivateFeedbackReplayTrigger;
    privateReplay?: string;
    privateReplayError?: string;
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
    randomCursorBefore?: number;
    visibleState: MatchState<unknown>;
    feedbackSource: CommandFailureFeedbackSource;
    aiContext: CommandFailureAiDiagnostic;
}): CommandFailureFeedbackPayload {
    const publicReason = projectFeedbackReasonCode(args.reason) ?? 'command_failed';
    const incidentKey = [args.playerId, args.commandType, args.stateIdBefore, publicReason].join(':');
    const phase = typeof args.state.sys?.phase === 'string' ? args.state.sys.phase : null;
    const turnNumber = typeof args.state.sys?.turnNumber === 'number' ? args.state.sys.turnNumber : null;
    const correlation = resolveTransportFeedbackCorrelation({
        matchId: args.matchId,
        state: args.state,
        stateId: args.stateIdBefore,
    });
    const trigger: PrivateFeedbackReplayTrigger = {
        source: args.feedbackSource === 'online-ai-watchdog'
            ? 'online-ai-watchdog'
            : 'authoritative-command-failure',
        commandType: args.commandType,
        playerId: args.playerId,
        payload: cloneCommandFailureDiagnosticValue(args.commandPayload),
        stateIdBefore: args.stateIdBefore,
        stateIdAfter: args.stateIdBefore,
        randomCursorBefore: args.randomCursorBefore,
        randomCursorAfter: args.randomCursorBefore,
        reason: args.reason,
        progressMarker: args.progressMarker,
    };
    const lastCommand = {
        commandType: args.commandType,
        playerId: args.playerId,
        stateId: args.stateIdBefore,
        afterStateId: args.stateIdBefore,
        ...(args.randomCursorBefore !== undefined ? {
            randomCursor: args.randomCursorBefore,
            afterRandomCursor: args.randomCursorBefore,
        } : {}),
    };
    const snapshots: FeedbackDiagnosticSnapshots = {
        before: args.state,
        at: args.state,
        after: args.state,
    };

    return {
        matchId: args.matchId,
        gameId: args.gameId,
        playerId: args.playerId,
        incidentKind: 'command-failed',
        feedbackSource: args.feedbackSource,
        severity: resolveCommandFailureFeedbackSeverity(args.reason),
        commandType: args.commandType,
        reason: publicReason,
        incidentKey,
        progressMarker: args.progressMarker,
        stateId: args.stateIdBefore,
        ...correlation,
        ...(args.randomCursorBefore !== undefined ? { randomCursor: args.randomCursorBefore } : {}),
        diagnosticSnapshots: snapshots,
        lastCommand,
        commandTraceTail: [lastCommand],
        privateReplayTrigger: trigger,
        stateSnapshot: JSON.stringify({
            kind: 'command-failure-feedback',
            commandType: args.commandType,
            reason: publicReason,
            progressMarker: args.progressMarker,
            stateIDBefore: args.stateIdBefore,
            randomCursor: args.randomCursorBefore ?? null,
            snapshots,
            lastCommand,
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
