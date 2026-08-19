export const GENERIC_COMMAND_FAILURE_REASON = 'command_failed';
export const PIPELINE_FAILURE_REASON = 'pipeline_error';

export type CommandFailureFeedbackSource = 'player-command-failure' | 'online-ai-watchdog';
export type CommandFailureFeedbackSeverity = 'medium' | 'high';

const MAX_COMMAND_FAILURE_REASON_LENGTH = 500;

export function truncateCommandFailureReason(reason: string): string {
    if (reason.length <= MAX_COMMAND_FAILURE_REASON_LENGTH) {
        return reason;
    }
    return `${reason.slice(0, MAX_COMMAND_FAILURE_REASON_LENGTH)}...`;
}

export function formatPipelineFailureReason(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const trimmed = message.trim();
    if (!trimmed) {
        return PIPELINE_FAILURE_REASON;
    }
    return truncateCommandFailureReason(`${PIPELINE_FAILURE_REASON}: ${trimmed}`);
}

export function normalizeCommandFailureReason(reason: unknown): string {
    if (typeof reason !== 'string') {
        return GENERIC_COMMAND_FAILURE_REASON;
    }
    const trimmed = reason.trim();
    return trimmed.length > 0 ? truncateCommandFailureReason(trimmed) : GENERIC_COMMAND_FAILURE_REASON;
}

export function formatOnlineAiCommandFailureReason(
    reason: string,
    commandType?: string | null,
    commandFailureReason?: string | null,
): string {
    const parts = [reason];
    const normalizedCommandType = typeof commandType === 'string' && commandType.trim().length > 0
        ? commandType.trim()
        : null;
    if (normalizedCommandType) {
        parts.push(normalizedCommandType);
    }

    const normalizedFailureReason = typeof commandFailureReason === 'string' && commandFailureReason.trim().length > 0
        ? commandFailureReason.trim()
        : null;
    if (normalizedFailureReason && normalizedFailureReason !== reason) {
        parts.push(normalizedFailureReason);
    }

    return truncateCommandFailureReason(parts.join(':'));
}

export function shouldAutoReportCommandFailure(
    reason: string,
    feedbackSource: CommandFailureFeedbackSource = 'player-command-failure',
): boolean {
    return reason === GENERIC_COMMAND_FAILURE_REASON
        || reason === PIPELINE_FAILURE_REASON
        || reason.startsWith(`${PIPELINE_FAILURE_REASON}:`)
        || feedbackSource === 'online-ai-watchdog';
}

export function resolveCommandFailureFeedbackSeverity(reason: string): CommandFailureFeedbackSeverity {
    return reason === GENERIC_COMMAND_FAILURE_REASON ? 'medium' : 'high';
}
