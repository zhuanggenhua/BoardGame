import type { MatchState, ValidationResult } from '../../../engine/types';
import type { QidahenCommand, QidahenCore } from './types';

export const QIDAHEN_COMMANDS = {
    SELECT_REGION: 'SELECT_REGION',
    CONFIRM_PREVIEW_ACTION: 'CONFIRM_PREVIEW_ACTION',
} as const;

export function validate(
    state: MatchState<QidahenCore>,
    command: QidahenCommand,
): ValidationResult {
    switch (command.type) {
        case QIDAHEN_COMMANDS.SELECT_REGION:
            return state.core.regions.some((region) => region.id === command.payload.regionId)
                ? { valid: true }
                : { valid: false, error: 'unknownRegion' };
        case QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION:
            return command.payload.actionId.length > 0
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        default:
            return { valid: false, error: 'unknownCommand' };
    }
}
