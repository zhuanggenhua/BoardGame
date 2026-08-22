import type { MatchState } from '../types';
import { INTERACTION_COMMANDS } from '../systems/InteractionSystem';
import type {
    AuthoritativeCommandExecutionFailure,
    AuthoritativeCommandSeatControllerType,
} from './authoritativeCommandExecutor';
import type { OnlineAiCircuitSource } from './onlineAiCircuitBreaker';
import type { CommandFailureFeedbackPayload } from './commandFailureFeedbackPayload';
import type { OnlineAiClientTransportDiagnostics } from './protocol';

export type AuthoritativeCommandFailureMatch = {
    matchID: string;
    gameId: string;
    engineConfig: { gameId: string };
    stateID: number;
    connections: Map<string, Set<string>>;
    lastCommandFailureReason: string | null;
};

export type AuthoritativeCommandFailureLogPayload<TMatch extends AuthoritativeCommandFailureMatch> = {
    match: TMatch;
    requestedCommandType: string;
    playerId: string;
    error: Error;
    gameId: string;
    stateIdBefore: number;
    progressMarker: string;
    feedbackSource: CommandFailureFeedbackPayload['feedbackSource'];
    commandPayload: unknown;
};

export type AuthoritativeCommandFailureCoordinatorHooks<TMatch extends AuthoritativeCommandFailureMatch> = {
    recordOnlineAiCircuitFailure: (args: {
        match: TMatch;
        playerId: string;
        source: OnlineAiCircuitSource;
        commandType: string;
        commandPayload: unknown;
        reason: string;
        expectedStateID?: number | null;
        stateID: number;
        progressMarker: string;
        onlineAiAttemptKey?: string | null;
        clientTransport?: OnlineAiClientTransportDiagnostics | null;
    }) => Promise<unknown>;
    logCommandFailed: (payload: AuthoritativeCommandFailureLogPayload<TMatch>) => void;
    emitPlayerError: (match: TMatch, playerId: string, reason: string) => void;
    shouldReportCommandFailureFeedback: (
        reason: string,
        feedbackSource: CommandFailureFeedbackPayload['feedbackSource'],
    ) => boolean;
    buildCommandFailureFeedbackPayload: (args: {
        match: TMatch;
        playerId: string;
        commandType: string;
        reason: string;
        commandPayload: unknown;
        progressMarker: string;
        stateIdBefore: number;
        visibleState: MatchState<unknown>;
        feedbackSource: CommandFailureFeedbackPayload['feedbackSource'];
    }) => CommandFailureFeedbackPayload;
    reportCommandFailureFeedback: (payload: CommandFailureFeedbackPayload) => Promise<void>;
    cancelInteractionOnError: (match: TMatch, playerId: string) => Promise<void>;
};

export type AuthoritativeCommandFailureCoordinatorConfig<TMatch extends AuthoritativeCommandFailureMatch> = {
    hooks: AuthoritativeCommandFailureCoordinatorHooks<TMatch>;
};

export class AuthoritativeCommandFailureCoordinator<TMatch extends AuthoritativeCommandFailureMatch> {
    private readonly hooks: AuthoritativeCommandFailureCoordinatorHooks<TMatch>;

    constructor(config: AuthoritativeCommandFailureCoordinatorConfig<TMatch>) {
        this.hooks = config.hooks;
    }

    async handleFailure(args: {
        match: TMatch;
        playerId: string;
        requestedCommandType: string;
        effectiveCommandType: string;
        effectivePayload: unknown;
        execution: AuthoritativeCommandExecutionFailure;
        onlineAiSeatControllerType: AuthoritativeCommandSeatControllerType;
        onlineAiCircuitSource: OnlineAiCircuitSource;
        expectedStateID?: number;
        onlineAiAttemptKey?: string | null;
        clientTransport?: OnlineAiClientTransportDiagnostics | null;
        stateIdBefore: number;
        progressMarkerBeforeCommand: string;
        preCommandSeatView: MatchState<unknown>;
        feedbackSource: CommandFailureFeedbackPayload['feedbackSource'];
        reportFailureFeedback?: boolean;
    }): Promise<false> {
        const failureReason = args.execution.failureReason;
        args.match.lastCommandFailureReason = failureReason;

        if (args.onlineAiSeatControllerType !== 'human') {
            await this.hooks.recordOnlineAiCircuitFailure({
                match: args.match,
                playerId: args.playerId,
                source: args.onlineAiCircuitSource,
                commandType: args.effectiveCommandType,
                commandPayload: args.effectivePayload,
                reason: failureReason,
                expectedStateID: args.expectedStateID,
                stateID: args.stateIdBefore,
                progressMarker: args.progressMarkerBeforeCommand,
                onlineAiAttemptKey: args.onlineAiAttemptKey,
                clientTransport: args.clientTransport,
            });
        }

        this.hooks.logCommandFailed({
            match: args.match,
            requestedCommandType: args.requestedCommandType,
            playerId: args.playerId,
            error: args.execution.error,
            gameId: args.match.engineConfig.gameId,
            stateIdBefore: args.stateIdBefore,
            progressMarker: args.progressMarkerBeforeCommand,
            feedbackSource: args.feedbackSource,
            commandPayload: args.effectivePayload,
        });
        this.hooks.emitPlayerError(args.match, args.playerId, failureReason);

        if (
            args.reportFailureFeedback
            && this.hooks.shouldReportCommandFailureFeedback(failureReason, args.feedbackSource)
        ) {
            await this.hooks.reportCommandFailureFeedback(this.hooks.buildCommandFailureFeedbackPayload({
                match: args.match,
                playerId: args.playerId,
                commandType: args.effectiveCommandType,
                reason: failureReason,
                commandPayload: args.effectivePayload,
                progressMarker: args.progressMarkerBeforeCommand,
                stateIdBefore: args.stateIdBefore,
                visibleState: args.preCommandSeatView,
                feedbackSource: args.feedbackSource,
            }));
        }

        if (
            args.execution.kind === 'pipeline-exception'
            && args.effectiveCommandType !== INTERACTION_COMMANDS.CANCEL
        ) {
            await this.hooks.cancelInteractionOnError(args.match, args.playerId);
            args.match.lastCommandFailureReason = failureReason;
        }

        return false;
    }
}
