import type { EngineSystem } from '../systems/types';
import type { Command, DomainCore, GameEvent, MatchState, PlayerId, RandomFn } from '../types';
import {
    executePipeline,
    type PipelineConfig,
    type PipelineResult,
} from '../pipeline';
import { INTERACTION_COMMANDS } from '../systems/InteractionSystem';
import type { GameEngineConfig } from './engineConfig';
import {
    formatPipelineFailureReason,
    normalizeCommandFailureReason,
} from './commandFailureReason';
import { resolveAiEmergencySkipCancelPayload } from './onlineAiUnsatisfiableInteraction';

export type AuthoritativeCommandSeatControllerType = 'human' | 'local-ai' | 'remote-ai';

export type AuthoritativeCommandRequest = {
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    random: RandomFn;
    playerIds: PlayerId[];
} & AuthoritativeCommandBuildRequest;

export type AuthoritativeCommandBuildRequest = {
    playerId: string;
    commandType: string;
    payload: unknown;
    seatControllerType: AuthoritativeCommandSeatControllerType;
    preCommandSeatView: MatchState<unknown>;
};

export type AuthoritativeCommandExecutionSuccess = {
    success: true;
    command: Command;
    result: PipelineResult<unknown>;
    state: MatchState<unknown>;
    events: GameEvent[];
    durationMs: number;
};

export type AuthoritativeCommandExecutionFailure = {
    success: false;
    kind: 'pipeline-exception' | 'domain-rejected';
    command: Command;
    failureReason: string;
    error: Error;
    result?: PipelineResult<unknown>;
    durationMs: number;
};

export type AuthoritativeCommandExecutionResult =
    | AuthoritativeCommandExecutionSuccess
    | AuthoritativeCommandExecutionFailure;

/**
 * Executes a single command through the authoritative engine pipeline.
 *
 * This module deliberately does not persist, broadcast, mutate room metadata, or
 * report feedback. Those remain the room runtime's write responsibilities.
 */
export class AuthoritativeCommandExecutor {
    constructor(private readonly now: () => number = () => Date.now()) {}

    execute(args: AuthoritativeCommandRequest): AuthoritativeCommandExecutionResult {
        const startTime = this.now();
        const command = this.buildCommand(args);
        const pipelineConfig: PipelineConfig<unknown, Command, GameEvent> = {
            domain: args.engineConfig.domain as DomainCore<unknown, Command, GameEvent>,
            systems: args.engineConfig.systems as EngineSystem<unknown>[],
            systemsConfig: args.engineConfig.systemsConfig,
        };

        try {
            const result = executePipeline(
                pipelineConfig,
                args.state,
                command,
                args.random,
                args.playerIds,
            );
            const durationMs = this.now() - startTime;
            if (!result.success) {
                const failureReason = normalizeCommandFailureReason(result.error);
                return {
                    success: false,
                    kind: 'domain-rejected',
                    command,
                    failureReason,
                    error: new Error(failureReason),
                    result,
                    durationMs,
                };
            }

            return {
                success: true,
                command,
                result,
                state: result.state,
                events: result.events,
                durationMs,
            };
        } catch (error) {
            const durationMs = this.now() - startTime;
            const failureReason = formatPipelineFailureReason(error);
            return {
                success: false,
                kind: 'pipeline-exception',
                command,
                failureReason,
                error: error instanceof Error ? error : new Error(String(error)),
                durationMs,
            };
        }
    }

    buildCommand(args: AuthoritativeCommandBuildRequest): Command {
        let effectiveCommandType = args.commandType;
        let effectivePayload = args.payload;

        if (args.seatControllerType !== 'human' && args.commandType === INTERACTION_COMMANDS.RESPOND) {
            const cancelPayload = resolveAiEmergencySkipCancelPayload(args.preCommandSeatView, args.payload);
            if (cancelPayload) {
                effectiveCommandType = INTERACTION_COMMANDS.CANCEL;
                effectivePayload = cancelPayload;
            }
        }

        return {
            type: effectiveCommandType,
            playerId: args.playerId,
            payload: effectivePayload,
            timestamp: this.now(),
        };
    }
}
