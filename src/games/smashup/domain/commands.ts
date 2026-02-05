import type { MatchState, ValidationResult } from '../../../engine/types';
import type { SmashUpCommand, SmashUpCore } from './types';

export function validate(
    _state: MatchState<SmashUpCore>,
    command: SmashUpCommand
): ValidationResult {
    switch (command.type) {
        case 'END_TURN':
            return { valid: true };
        default:
            return { valid: false, error: 'unknownCommand' };
    }
}
