import type { AiSeatController } from '../ai';
import logger from '../../../server/logger.js';
import type { OnlineAiCircuitSnapshot, OnlineAiCircuitSource } from './onlineAiCircuitBreaker';
import type { ForceEndTurnStalledAiResolution } from './onlineAiRecovery';
import {
    tryForceUnblockRepeatedOnlineAiRecovery,
    type OnlineAiRepeatedRecoveryAttempt,
    type OnlineAiRepeatedRecoveryUnblockMatch,
    type OnlineAiRepeatedRecoveryUnblockResult,
} from './onlineAiRepeatedRecoveryUnblockExecutor';
import type { OnlineAiRecoveryFeedbackPayload } from './transportFeedbackReporter';

export type OnlineAiRepeatedRecoveryCoordinatorHooks<TMatch extends OnlineAiRepeatedRecoveryUnblockMatch> = {
    getCircuitSnapshot: (matchId: string, playerId: string) => OnlineAiCircuitSnapshot;
    beginSafeUnblock: (matchId: string, playerId: string) => boolean;
    finishSafeUnblock: (args: {
        matchId: string;
        playerId: string;
        success: boolean;
        stateID: number;
    }) => void;
    executeCommand: (args: {
        match: TMatch;
        playerId: string;
        commandType: string;
        commandPayload: unknown;
        options: {
            reportFailureFeedback: true;
            feedbackSource: 'online-ai-watchdog';
            onlineAiCircuitSource: OnlineAiCircuitSource;
        };
    }) => Promise<boolean>;
    markRepeatedAttemptReported: (
        repeatedAttemptKey: string,
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined,
        fallbackCount: number,
    ) => OnlineAiRepeatedRecoveryAttempt;
    clearRecoveryTracker: (matchId: string) => void;
    reportRecoveryFeedback: (payload: OnlineAiRecoveryFeedbackPayload) => Promise<void>;
    buildRecoveryStateSnapshot: (args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarker: string;
        failureReason?: string;
    }) => Promise<string>;
    buildRecoveryActionLog: (args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarker: string;
        failureReason?: string;
    }) => string | undefined;
    drainCommandQueue: (match: TMatch) => Promise<void>;
};

export type OnlineAiRepeatedRecoveryCoordinatorConfig<TMatch extends OnlineAiRepeatedRecoveryUnblockMatch> = {
    repeatedAttemptLimit: number;
    hooks: OnlineAiRepeatedRecoveryCoordinatorHooks<TMatch>;
    now?: () => number;
};

export class OnlineAiRepeatedRecoveryCoordinator<TMatch extends OnlineAiRepeatedRecoveryUnblockMatch> {
    private readonly repeatedAttemptLimit: number;
    private readonly hooks: OnlineAiRepeatedRecoveryCoordinatorHooks<TMatch>;
    private readonly now: () => number;

    constructor(config: OnlineAiRepeatedRecoveryCoordinatorConfig<TMatch>) {
        this.repeatedAttemptLimit = config.repeatedAttemptLimit;
        this.hooks = config.hooks;
        this.now = config.now ?? Date.now;
    }

    async tryForceUnblock(args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarker: string;
        repeatedAttemptKey: string;
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined;
        seatControllers: Record<string, AiSeatController>;
    }): Promise<OnlineAiRepeatedRecoveryUnblockResult> {
        return tryForceUnblockRepeatedOnlineAiRecovery({
            match: args.match,
            candidate: args.candidate,
            progressMarker: args.progressMarker,
            repeatedAttemptKey: args.repeatedAttemptKey,
            repeatedAttempt: args.repeatedAttempt,
            repeatedAttemptLimit: this.repeatedAttemptLimit,
            seatControllers: args.seatControllers,
            hooks: {
                getCircuitSnapshot: this.hooks.getCircuitSnapshot,
                beginSafeUnblock: this.hooks.beginSafeUnblock,
                finishSafeUnblock: this.hooks.finishSafeUnblock,
                executeCommand: (commandType, payload, options) => this.hooks.executeCommand({
                    match: args.match,
                    playerId: args.candidate.playerId,
                    commandType,
                    commandPayload: payload,
                    options,
                }),
                reportSuppressed: (payload) => this.reportSuppressed({
                    match: args.match,
                    candidate: args.candidate,
                    trackerKey: args.trackerKey,
                    progressMarker: args.progressMarker,
                    repeatedAttemptKey: args.repeatedAttemptKey,
                    repeatedAttempt: args.repeatedAttempt,
                    suppressionReason: payload.suppressionReason,
                }),
                markRepeatedAttemptReported: (repeatedAttemptKey, repeatedAttempt) => (
                    this.hooks.markRepeatedAttemptReported(
                        repeatedAttemptKey,
                        repeatedAttempt,
                        this.repeatedAttemptLimit,
                    )
                ),
                clearRecoveryTracker: () => {
                    this.hooks.clearRecoveryTracker(args.match.matchID);
                },
                reportForceUnblocked: async (payload) => {
                    logger.warn('[GameTransport] online-ai-watchdog force-unblocked repeated recovery', {
                        matchID: args.match.matchID,
                        gameId: args.match.gameId,
                        playerID: args.candidate.playerId,
                        incidentKey: args.trackerKey,
                        reason: payload.reason,
                        repeatedAttemptCount: payload.reportedAttempt.count,
                        repeatedAttemptLimit: this.repeatedAttemptLimit,
                        markerBefore: args.progressMarker,
                        markerAfter: payload.markerAfter,
                        commands: payload.forcedCommands,
                    });

                    await this.hooks.reportRecoveryFeedback({
                        matchId: args.match.matchID,
                        gameId: args.match.gameId,
                        playerId: args.candidate.playerId,
                        incidentKind: 'repeated-recovery-force-unblocked',
                        severity: 'high',
                        status: 'open',
                        reason: payload.reason,
                        trackerKey: args.trackerKey,
                        progressMarker: args.progressMarker,
                        stateSnapshot: await this.hooks.buildRecoveryStateSnapshot({
                            match: args.match,
                            candidate: args.candidate,
                            trackerKey: args.trackerKey,
                            progressMarker: args.progressMarker,
                            failureReason: 'repeated_recovery_force_unblocked',
                        }),
                        actionLog: this.hooks.buildRecoveryActionLog({
                            match: args.match,
                            candidate: args.candidate,
                            trackerKey: args.trackerKey,
                            progressMarker: args.progressMarker,
                            failureReason: 'repeated_recovery_force_unblocked',
                        }),
                    });
                },
                drainCommandQueue: () => this.hooks.drainCommandQueue(args.match),
            },
        });
    }

    async reportSuppressed(args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarker: string;
        repeatedAttemptKey: string;
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined;
        suppressionReason?: string;
    }): Promise<void> {
        const repeatedAttempt = args.repeatedAttempt ?? {
            count: this.repeatedAttemptLimit,
            lastAttemptAt: this.now(),
            reported: false,
        };
        if (repeatedAttempt.reported) {
            return;
        }

        this.hooks.markRepeatedAttemptReported(
            args.repeatedAttemptKey,
            repeatedAttempt,
            this.repeatedAttemptLimit,
        );
        const reason = [
            args.candidate.reason,
            `repeat-limit:${repeatedAttempt.count}/${this.repeatedAttemptLimit}`,
            args.suppressionReason,
        ].filter(Boolean).join(':');

        logger.warn('[GameTransport] online-ai-watchdog suppressed repeated recovery', {
            matchID: args.match.matchID,
            gameId: args.match.gameId,
            playerID: args.candidate.playerId,
            incidentKey: args.trackerKey,
            reason,
            repeatedAttemptCount: repeatedAttempt.count,
            repeatedAttemptLimit: this.repeatedAttemptLimit,
            marker: args.progressMarker,
        });

        await this.hooks.reportRecoveryFeedback({
            matchId: args.match.matchID,
            gameId: args.match.gameId,
            playerId: args.candidate.playerId,
            incidentKind: 'repeated-recovery-suppressed',
            severity: 'high',
            status: 'open',
            reason,
            trackerKey: args.trackerKey,
            progressMarker: args.progressMarker,
            stateSnapshot: await this.hooks.buildRecoveryStateSnapshot({
                match: args.match,
                candidate: args.candidate,
                trackerKey: args.trackerKey,
                progressMarker: args.progressMarker,
                failureReason: args.suppressionReason ?? 'repeated_recovery_suppressed',
            }),
            actionLog: this.hooks.buildRecoveryActionLog({
                match: args.match,
                candidate: args.candidate,
                trackerKey: args.trackerKey,
                progressMarker: args.progressMarker,
                failureReason: args.suppressionReason ?? 'repeated_recovery_suppressed',
            }),
        });
    }
}
