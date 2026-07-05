import type { MatchState, ValidationResult } from '../../../engine/types';
import { getChipValues } from './setup';
import { THE_GANG_COMMANDS, type TheGangCommand, type TheGangCore } from './types';

const success = (): ValidationResult => ({ valid: true });
const failure = (error: string): ValidationResult => ({ valid: false, error });

export function validate(
    state: MatchState<TheGangCore>,
    command: TheGangCommand,
): ValidationResult {
    const core = state.core;

    if (core.gameResult) {
        return failure('gameOver');
    }

    switch (command.type) {
        case THE_GANG_COMMANDS.TAKE_CHIP:
            return validateTakeChip(core, command.playerId, command.payload.chip);
        case THE_GANG_COMMANDS.END_ROUND:
            return validateEndRound(core);
        case THE_GANG_COMMANDS.REVEAL_SHOWDOWN:
            return validateRevealShowdown(core);
        case THE_GANG_COMMANDS.START_NEXT_HEIST:
            return core.phase === 'showdown' && !!core.lastShowdown
                ? success()
                : failure('showdownRequired');
        default:
            return failure('unknownCommand');
    }
}

function validateTakeChip(core: TheGangCore, playerId: string, chip: number): ValidationResult {
    if (core.phase !== 'chip-selection') return failure('notSelectingChips');
    if (!core.playerIds.includes(playerId)) return failure('unknownPlayer');
    if (!getChipValues(core.playerIds.length).includes(chip)) return failure('invalidChip');

    const occupiedByOther = Object.entries(core.currentRoundChips)
        .some(([owner, ownerChip]) => owner !== playerId && ownerChip === chip);
    if (occupiedByOther) return failure('chipTaken');

    return success();
}

function validateEndRound(core: TheGangCore): ValidationResult {
    if (core.phase !== 'chip-selection') return failure('notSelectingChips');
    if (!core.playerIds.every((playerId) => core.currentRoundChips[playerId] !== undefined)) {
        return failure('missingChips');
    }
    if (core.round >= 4) return failure('showdownRequired');
    return success();
}

function validateRevealShowdown(core: TheGangCore): ValidationResult {
    if (core.phase !== 'chip-selection') return failure('notSelectingChips');
    if (core.round !== 4) return failure('notFinalRound');
    if (!core.playerIds.every((playerId) => core.currentRoundChips[playerId] !== undefined)) {
        return failure('missingChips');
    }
    if (core.communityCards.length !== 5) return failure('missingCommunityCards');
    return success();
}
