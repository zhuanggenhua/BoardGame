import type { Command, MatchState, ValidationResult } from '../types';
import type { OnlineAiCommand } from './onlineAiExecutor';
import { normalizeCommandFailureReason } from './commandFailureReason';

const ENGINE_SYSTEM_COMMAND_TYPES = new Set([
    'ADVANCE_PHASE',
    'RESPONSE_PASS',
]);

export type OnlineAiAuthoritativeCommandPrecheckResult =
    | { kind: 'valid' }
    | { kind: 'skipped'; reason: 'engine-system-command' }
    | { kind: 'invalid'; commandFailureReason: string }
    | { kind: 'deferred'; errorMessage: string };

export type OnlineAiAuthoritativeCommandValidator = (
    state: MatchState<unknown>,
    command: Command,
) => ValidationResult;

export function isOnlineAiEngineSystemCommand(commandType: string): boolean {
    return commandType.startsWith('SYS_') || ENGINE_SYSTEM_COMMAND_TYPES.has(commandType);
}

export function precheckOnlineAiAuthoritativeCommand(args: {
    state: MatchState<unknown>;
    playerId: string;
    command: OnlineAiCommand;
    validate: OnlineAiAuthoritativeCommandValidator;
    now?: () => number;
}): OnlineAiAuthoritativeCommandPrecheckResult {
    if (isOnlineAiEngineSystemCommand(args.command.type)) {
        return { kind: 'skipped', reason: 'engine-system-command' };
    }

    try {
        const validation = args.validate(args.state, {
            type: args.command.type,
            playerId: args.playerId,
            payload: args.command.payload,
            timestamp: args.now?.() ?? Date.now(),
        } as Command);

        if (validation.valid) {
            return { kind: 'valid' };
        }

        return {
            kind: 'invalid',
            commandFailureReason: normalizeCommandFailureReason(validation.error),
        };
    } catch (error) {
        return {
            kind: 'deferred',
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
}
