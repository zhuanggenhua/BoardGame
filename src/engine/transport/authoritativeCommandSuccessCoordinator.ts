import type { GameEvent, MatchState } from '../types';
import logger, { gameLogger } from '../../../server/logger.js';
import {
    commitAuthoritativeCommandSuccess,
    type AuthoritativeCommandCommitMatch,
    type TrackedRandomFactory,
} from './authoritativeCommandCommit';
import {
    runAuthoritativeCommandSuccessEffects,
    type AuthoritativeCommandSuccessEffectsMatch,
} from './authoritativeCommandSuccessEffects';
import type { AuthoritativeCommandExecutionSuccess, AuthoritativeCommandSeatControllerType } from './authoritativeCommandExecutor';
import type { GameEventTelemetryFormatter } from './engineConfig';
import type { StoredMatchState } from './storage';
import type { TrainingDataCapture } from './trainingDataCapture';

export type AuthoritativeCommandSuccessMatch = AuthoritativeCommandCommitMatch
    & AuthoritativeCommandSuccessEffectsMatch
    & {
        engineConfig: {
            gameId: string;
            eventTelemetry?: GameEventTelemetryFormatter;
        };
        lastCommandFailureReason: string | null;
    };

export type AuthoritativeCommandSuccessCoordinatorHooks<
    TMatch extends AuthoritativeCommandSuccessMatch,
    FeedbackPayload,
> = {
    createTrackedRandom: TrackedRandomFactory;
    persistState: (match: TMatch, storedState: StoredMatchState) => Promise<void>;
    buildUnsatisfiableInteractionFeedback: (args: {
        match: TMatch;
        playerId: string;
        seatControllerType: AuthoritativeCommandSeatControllerType;
        commandType: string;
        event: GameEvent;
        progressMarkerBefore: string;
        preCommandSeatView: MatchState<unknown>;
    }) => Promise<FeedbackPayload | null>;
    buildPostTrainingState: (match: TMatch, playerId: string) => MatchState<unknown>;
    trainingDataCapture: Pick<TrainingDataCapture, 'recordDecisionSample'>;
    reportOnlineAiRecoveryFeedback: (payload: FeedbackPayload) => Promise<void>;
    broadcastState: (match: TMatch) => void;
    clearOnlineAiCircuitBreaker: (matchID: string) => void;
    persistMetadata: (match: TMatch) => Promise<void>;
};

export type AuthoritativeCommandSuccessCoordinatorConfig<
    TMatch extends AuthoritativeCommandSuccessMatch,
    FeedbackPayload,
> = {
    hooks: AuthoritativeCommandSuccessCoordinatorHooks<TMatch, FeedbackPayload>;
    onCommandSucceeded?: (matchID: string, gameName: string, commandType: string) => void;
    onGameOver?: (matchID: string, gameName: string, gameover: unknown) => void;
};

export class AuthoritativeCommandSuccessCoordinator<
    TMatch extends AuthoritativeCommandSuccessMatch,
    FeedbackPayload,
> {
    private readonly hooks: AuthoritativeCommandSuccessCoordinatorHooks<TMatch, FeedbackPayload>;
    private readonly onCommandSucceeded?: (matchID: string, gameName: string, commandType: string) => void;
    private readonly onGameOver?: (matchID: string, gameName: string, gameover: unknown) => void;

    constructor(config: AuthoritativeCommandSuccessCoordinatorConfig<TMatch, FeedbackPayload>) {
        this.hooks = config.hooks;
        this.onCommandSucceeded = config.onCommandSucceeded;
        this.onGameOver = config.onGameOver;
    }

    async handleSuccess(args: {
        match: TMatch;
        playerId: string;
        commandType: string;
        commandPayload: unknown;
        execution: AuthoritativeCommandExecutionSuccess;
        seatControllerType: AuthoritativeCommandSeatControllerType;
        stateIdBefore: number;
        progressMarkerBeforeCommand: string;
        preCommandSeatView: MatchState<unknown>;
        suppressBroadcast?: boolean;
    }): Promise<boolean> {
        const { match } = args;
        match.lastCommandFailureReason = null;

        gameLogger.commandExecuted(
            match.matchID,
            args.commandType,
            args.playerId,
            args.execution.durationMs,
        );

        let unsatisfiableInteractionFeedback: FeedbackPayload | null = null;
        for (const event of args.execution.result.events) {
            const telemetry = match.engineConfig.eventTelemetry?.(event as GameEvent);
            if (telemetry) {
                logger.info('game_event', {
                    matchID: match.matchID,
                    gameId: match.engineConfig.gameId,
                    ...telemetry,
                });
            }

            const feedback = await this.hooks.buildUnsatisfiableInteractionFeedback({
                match,
                playerId: args.playerId,
                seatControllerType: args.seatControllerType,
                commandType: args.commandType,
                event: event as GameEvent,
                progressMarkerBefore: args.progressMarkerBeforeCommand,
                preCommandSeatView: args.preCommandSeatView,
            });
            if (feedback) {
                unsatisfiableInteractionFeedback = feedback;
            }
        }

        const commitResult = await commitAuthoritativeCommandSuccess({
            match,
            playerId: args.playerId,
            commandType: args.commandType,
            nextState: args.execution.result.state,
            createTrackedRandom: this.hooks.createTrackedRandom,
            persistState: (storedState) => this.hooks.persistState(match, storedState),
            onCommandSucceeded: this.onCommandSucceeded,
            logRandomCursorRestored: (restoredCursor) => {
                logger.info('[UndoServer] random-cursor-restored', {
                    matchID: match.matchID,
                    restoredCursor,
                });
            },
        });

        if (!commitResult.committed) {
            return false;
        }

        await runAuthoritativeCommandSuccessEffects<FeedbackPayload>({
            match,
            playerID: args.playerId,
            commandType: args.commandType,
            payload: args.commandPayload,
            stateIdBefore: args.stateIdBefore,
            stateIdAfter: commitResult.stateIdAfter,
            preTrainingState: args.preCommandSeatView,
            buildPostTrainingState: () => this.hooks.buildPostTrainingState(match, args.playerId),
            gameOver: commitResult.gameOver,
            unsatisfiableInteractionFeedback,
            suppressBroadcast: args.suppressBroadcast,
            trainingDataCapture: this.hooks.trainingDataCapture,
            reportOnlineAiRecoveryFeedback: this.hooks.reportOnlineAiRecoveryFeedback,
            broadcastState: () => this.hooks.broadcastState(match),
            clearOnlineAiCircuitBreaker: () => this.hooks.clearOnlineAiCircuitBreaker(match.matchID),
            persistMetadata: () => this.hooks.persistMetadata(match),
            onGameOver: this.onGameOver,
        });

        return true;
    }
}
