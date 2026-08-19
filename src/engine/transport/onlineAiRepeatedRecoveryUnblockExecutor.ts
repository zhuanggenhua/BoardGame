import type { AiSeatController } from '../ai';
import { INTERACTION_COMMANDS } from '../systems/InteractionSystem';
import type { MatchState } from '../types';
import {
    buildAiProgressMarker,
    resolveForceAdvancePhaseAfterRecovery,
    type ForceEndTurnStalledAiResolution,
    type OnlineAiRecoveryEngineConfig,
} from './onlineAiRecovery';
import type { OnlineAiCircuitSnapshot, OnlineAiCircuitSource } from './onlineAiCircuitBreaker';
import { formatOnlineAiCommandFailureReason } from './commandFailureReason';

export type OnlineAiRepeatedRecoveryAttempt = {
    count: number;
    lastAttemptAt: number;
    reported: boolean;
};

export type OnlineAiRepeatedRecoveryUnblockMatch = {
    matchID: string;
    gameId: string;
    state: MatchState<unknown>;
    stateID: number;
    unloaded: boolean;
    executing: boolean;
    lastCommandFailureReason: string | null;
    engineConfig: OnlineAiRecoveryEngineConfig;
};

export type OnlineAiRepeatLimitInteraction = { id?: string; kind?: string };

export type OnlineAiRepeatedRecoveryUnblockResult = {
    handled: boolean;
    suppressionReason?: string;
};

export type OnlineAiRepeatedRecoveryUnblockHooks = {
    getCircuitSnapshot: (matchId: string, playerId: string) => OnlineAiCircuitSnapshot;
    beginSafeUnblock: (matchId: string, playerId: string) => boolean;
    finishSafeUnblock: (args: {
        matchId: string;
        playerId: string;
        success: boolean;
        stateID: number;
    }) => void;
    executeCommand: (
        commandType: string,
        payload: unknown,
        options: {
            reportFailureFeedback: true;
            feedbackSource: 'online-ai-watchdog';
            onlineAiCircuitSource: OnlineAiCircuitSource;
        },
    ) => Promise<boolean>;
    reportSuppressed: (args: { suppressionReason?: string }) => Promise<void>;
    markRepeatedAttemptReported: (
        repeatedAttemptKey: string,
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined,
    ) => OnlineAiRepeatedRecoveryAttempt;
    clearRecoveryTracker: () => void;
    reportForceUnblocked: (args: {
        reason: string;
        markerAfter: string;
        forcedCommands: string[];
        reportedAttempt: OnlineAiRepeatedRecoveryAttempt;
    }) => Promise<void>;
    drainCommandQueue: () => Promise<void>;
};

export function resolveRepeatLimitCurrentAiInteraction(args: {
    match: Pick<OnlineAiRepeatedRecoveryUnblockMatch, 'state'>;
    candidate: ForceEndTurnStalledAiResolution;
    seatControllers: Record<string, AiSeatController>;
}): OnlineAiRepeatLimitInteraction | null {
    if (args.candidate.reason !== 'visible-interaction' && args.candidate.reason !== 'hidden-interaction') {
        return null;
    }
    if (!args.candidate.playerId || args.seatControllers[args.candidate.playerId]?.type === 'human') {
        return null;
    }

    const responseWindow = (args.match.state.sys?.responseWindow as { current?: unknown } | undefined)?.current;
    if (responseWindow) {
        return null;
    }

    const currentInteraction = (args.match.state.sys?.interaction as {
        current?: {
            id?: unknown;
            kind?: unknown;
            playerId?: unknown;
        };
    } | undefined)?.current;
    if (!currentInteraction || String(currentInteraction.playerId ?? '') !== args.candidate.playerId) {
        return null;
    }

    const kind = typeof currentInteraction.kind === 'string' ? currentInteraction.kind : undefined;
    if (kind === 'compare-roll-choice') {
        return null;
    }

    return {
        id: typeof currentInteraction.id === 'string' ? currentInteraction.id : undefined,
        kind,
    };
}

export async function tryForceUnblockRepeatedOnlineAiRecovery(args: {
    match: OnlineAiRepeatedRecoveryUnblockMatch;
    candidate: ForceEndTurnStalledAiResolution;
    progressMarker: string;
    repeatedAttemptKey: string;
    repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined;
    repeatedAttemptLimit: number;
    seatControllers: Record<string, AiSeatController>;
    hooks: OnlineAiRepeatedRecoveryUnblockHooks;
}): Promise<OnlineAiRepeatedRecoveryUnblockResult> {
    const { match, candidate, hooks } = args;
    if (match.unloaded) {
        return { handled: false, suppressionReason: 'match_unloaded' };
    }
    if (match.executing) {
        return { handled: false, suppressionReason: 'match_executing' };
    }

    const circuitSnapshotBeforeUnblock = hooks.getCircuitSnapshot(match.matchID, candidate.playerId);
    const circuitEnforced = circuitSnapshotBeforeUnblock.tripped;
    if (args.repeatedAttempt?.reported && !circuitEnforced) {
        return { handled: true };
    }
    if (circuitEnforced && !hooks.beginSafeUnblock(match.matchID, candidate.playerId)) {
        return { handled: true, suppressionReason: 'circuit-open' };
    }

    match.executing = true;
    const forcedCommands: string[] = [];
    let circuitSafeUnblockSucceeded = false;
    try {
        const isInteractionCandidate =
            candidate.reason === 'visible-interaction'
            || candidate.reason === 'hidden-interaction';
        const currentInteraction = resolveRepeatLimitCurrentAiInteraction({
            match,
            candidate,
            seatControllers: args.seatControllers,
        });
        if (isInteractionCandidate && !currentInteraction) {
            return { handled: false, suppressionReason: 'interaction_not_force_cancel_safe' };
        }
        const circuitSource = circuitEnforced ? 'safe-unblock' : 'watchdog';
        if (currentInteraction) {
            const cancelSuccess = await hooks.executeCommand(
                INTERACTION_COMMANDS.CANCEL,
                {
                    interactionId: currentInteraction.id,
                    reason: 'repeated-recovery-limit',
                },
                {
                    reportFailureFeedback: true,
                    feedbackSource: 'online-ai-watchdog',
                    onlineAiCircuitSource: circuitSource,
                },
            );
            if (!cancelSuccess) {
                await hooks.reportSuppressed({
                    suppressionReason: formatOnlineAiCommandFailureReason(
                        'force_cancel_failed',
                        INTERACTION_COMMANDS.CANCEL,
                        match.lastCommandFailureReason,
                    ),
                });
                return { handled: true };
            }
            forcedCommands.push(INTERACTION_COMMANDS.CANCEL);
        }

        const advanceResolution = resolveForceAdvancePhaseAfterRecovery({
            authoritativeState: match.state,
            seatControllers: args.seatControllers,
            playerId: candidate.playerId,
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const advanceCommand = advanceResolution?.action.commands[0];
        if (advanceCommand) {
            const advanceSuccess = await hooks.executeCommand(
                advanceCommand.type,
                advanceCommand.payload ?? {},
                {
                    reportFailureFeedback: true,
                    feedbackSource: 'online-ai-watchdog',
                    onlineAiCircuitSource: circuitSource,
                },
            );
            if (!advanceSuccess) {
                await hooks.reportSuppressed({
                    suppressionReason: formatOnlineAiCommandFailureReason(
                        'force_advance_failed',
                        advanceCommand.type,
                        match.lastCommandFailureReason,
                    ),
                });
                return { handled: true };
            }
            forcedCommands.push(advanceCommand.type);
        }

        if (forcedCommands.length === 0) {
            return { handled: false, suppressionReason: 'no_safe_force_unblock' };
        }

        const markerAfter = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        if (markerAfter === args.progressMarker) {
            await hooks.reportSuppressed({ suppressionReason: 'force_unblock_no_progress' });
            return { handled: true };
        }

        circuitSafeUnblockSucceeded = circuitEnforced;
        const reportedAttempt = hooks.markRepeatedAttemptReported(
            args.repeatedAttemptKey,
            args.repeatedAttempt,
        );
        const reason = [
            candidate.reason,
            `repeat-limit-force-unblock:${reportedAttempt.count}/${args.repeatedAttemptLimit}`,
            `commands=${forcedCommands.join('+')}`,
        ].join(':');

        hooks.clearRecoveryTracker();
        await hooks.reportForceUnblocked({
            reason,
            markerAfter,
            forcedCommands,
            reportedAttempt,
        });
        return { handled: true };
    } finally {
        if (circuitEnforced) {
            hooks.finishSafeUnblock({
                matchId: match.matchID,
                playerId: candidate.playerId,
                success: circuitSafeUnblockSucceeded,
                stateID: match.stateID,
            });
        }
        if (!match.unloaded) {
            await hooks.drainCommandQueue();
        }
        match.executing = false;
    }
}
