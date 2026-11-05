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
import type { DeferredAuthoritativeEffect } from './authoritativeCommandTransaction';
import { cloneSnapshotState } from '../systems/UndoSystem';

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
        preCommandSharedState: MatchState<unknown>;
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
    onGameOver?: (matchID: string, gameName: string, gameover: unknown) => void | Promise<void>;
};

export class AuthoritativeCommandSuccessCoordinator<
    TMatch extends AuthoritativeCommandSuccessMatch,
    FeedbackPayload,
> {
    private readonly hooks: AuthoritativeCommandSuccessCoordinatorHooks<TMatch, FeedbackPayload>;
    private readonly onCommandSucceeded?: (matchID: string, gameName: string, commandType: string) => void;
    private readonly onGameOver?: (matchID: string, gameName: string, gameover: unknown) => void | Promise<void>;
    private readonly pendingGameOver = new Map<string, { match: TMatch; effect: () => Promise<void>; timer?: ReturnType<typeof setTimeout> }>();

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
        deferredEffects?: DeferredAuthoritativeEffect<TMatch>[];
    }): Promise<boolean> {
        const { match } = args;
        const preCommandSharedState = match.state;
        match.lastCommandFailureReason = null;

        const commitResult = await commitAuthoritativeCommandSuccess({
            match,
            playerId: args.playerId,
            commandType: args.commandType,
            nextState: args.execution.result.state,
            createTrackedRandom: this.hooks.createTrackedRandom,
            persistState: args.deferredEffects
                ? async () => undefined
                : (storedState) => this.hooks.persistState(match, storedState),
        });
        if (!commitResult.committed) return false;
        let stateAfterCommand: MatchState<unknown> | undefined;
        try {
            stateAfterCommand = cloneSnapshotState(match.state);
        } catch (error) {
            logger.error('[GameTransport] command diagnostic snapshot failed', { matchID: match.matchID, error });
        }
        const applyEffects: DeferredAuthoritativeEffect<TMatch> = async (committedMatch, isFinalCommand) => {
            const effectMatch = { ...committedMatch, state: stateAfterCommand ?? committedMatch.state, stateID: commitResult.stateIdAfter };
            gameLogger.commandExecuted(
                match.matchID,
                args.commandType,
                args.playerId,
                args.execution.durationMs,
            );

            let unsatisfiableInteractionFeedback: FeedbackPayload | null = null;
            for (const event of args.execution.result.events) {
                try {
                    const telemetry = match.engineConfig.eventTelemetry?.(event as GameEvent);
                    if (telemetry) {
                        logger.info('game_event', {
                            matchID: match.matchID,
                            gameId: match.engineConfig.gameId,
                            ...telemetry,
                        });
                    }

                    const feedback = await this.hooks.buildUnsatisfiableInteractionFeedback({
                        match: effectMatch,
                        playerId: args.playerId,
                        seatControllerType: args.seatControllerType,
                        commandType: args.commandType,
                        event: event as GameEvent,
                        progressMarkerBefore: args.progressMarkerBeforeCommand,
                        preCommandSeatView: args.preCommandSeatView,
                        preCommandSharedState,
                    });
                    if (feedback) {
                        unsatisfiableInteractionFeedback = feedback;
                    }
                } catch (error) {
                    logger.error('[GameTransport] committed event diagnostics failed', { matchID: match.matchID, error });
                }
            }

            await runAuthoritativeCommandSuccessEffects<FeedbackPayload>({
                match: committedMatch,
                playerID: args.playerId,
                commandType: args.commandType,
                payload: args.commandPayload,
                stateIdBefore: args.stateIdBefore,
                stateIdAfter: commitResult.stateIdAfter,
                preTrainingState: args.preCommandSeatView,
                buildPostTrainingState: () => {
                    if (!stateAfterCommand) throw new Error('command_diagnostic_snapshot_unavailable');
                    return this.hooks.buildPostTrainingState(effectMatch, args.playerId);
                },
                gameOver: isFinalCommand ? committedMatch.state.sys.gameover : undefined,
                unsatisfiableInteractionFeedback,
                suppressBroadcast: args.suppressBroadcast,
                trainingDataCapture: this.hooks.trainingDataCapture,
                reportOnlineAiRecoveryFeedback: this.hooks.reportOnlineAiRecoveryFeedback,
                broadcastState: () => this.hooks.broadcastState(committedMatch),
                clearOnlineAiCircuitBreaker: () => this.hooks.clearOnlineAiCircuitBreaker(committedMatch.matchID),
                persistMetadata: () => this.hooks.persistMetadata(committedMatch),
                onGameOver: this.onGameOver,
                runGameOverEffect: (effect) => this.runGameOverEffect(committedMatch, effect),
                isMatchActive: () => !committedMatch.unloaded,
            });
            this.onCommandSucceeded?.(committedMatch.matchID, committedMatch.gameId, args.commandType);
        };

        if (args.deferredEffects) {
            args.deferredEffects.push(applyEffects);
        } else {
            try {
                await applyEffects(match, true);
            } catch (error) {
                logger.error('[GameTransport] committed command effect failed', { matchID: match.matchID, error });
            }
        }

        return true;
    }

    cancelPendingEffects(matchID: string): void {
        const pending = this.pendingGameOver.get(matchID);
        if (pending?.timer) clearTimeout(pending.timer);
        this.pendingGameOver.delete(matchID);
    }

    private async runGameOverEffect(match: TMatch, effect: () => Promise<void>): Promise<void> {
        if (match.unloaded || this.pendingGameOver.has(match.matchID)) return;
        const pending = { match, effect, timer: undefined as ReturnType<typeof setTimeout> | undefined };
        this.pendingGameOver.set(match.matchID, pending);
        const attempt = async () => {
            if (match.unloaded) {
                this.cancelPendingEffects(match.matchID);
                return;
            }
            if (this.pendingGameOver.get(match.matchID) !== pending) return;
            try {
                await pending.effect();
                this.pendingGameOver.delete(match.matchID);
            } catch (error) {
                logger.error('[GameTransport] terminal effect pending retry', { matchID: match.matchID, error });
                if (!match.unloaded && this.pendingGameOver.get(match.matchID) === pending) {
                    pending.timer = setTimeout(() => { void attempt(); }, 5000);
                }
            }
        };
        await attempt();
    }
}
