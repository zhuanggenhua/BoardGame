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
        case THE_GANG_COMMANDS.SET_RULES_CONFIG:
            return validateSetRulesConfig(core, command.playerId);
        case THE_GANG_COMMANDS.DEAL_TOOLS:
            return validateDealTools(core, command.playerId);
        case THE_GANG_COMMANDS.USE_TOOL:
            return validateUseTool(core, command.playerId, command.payload.tool, command.payload.cardIndex);
        case THE_GANG_COMMANDS.END_ROUND:
            return validateEndRound(core, command.playerId);
        case THE_GANG_COMMANDS.REVEAL_SHOWDOWN:
            return validateRevealShowdown(core, command.playerId);
        case THE_GANG_COMMANDS.START_NEXT_HEIST:
            return validateStartNextHeist(core, command.playerId);
        default:
            return failure('unknownCommand');
    }
}

function validateTakeChip(core: TheGangCore, playerId: string, chip: number): ValidationResult {
    if (core.phase !== 'chip-selection') return failure('notSelectingChips');
    if (!core.playerIds.includes(playerId)) return failure('unknownPlayer');
    if (!getChipValues(core.playerIds.length).includes(chip)) return failure('invalidChip');
    if (core.currentRoundChips[playerId] === chip) return failure('chipAlreadyHeld');

    return success();
}

function validateSetRulesConfig(core: TheGangCore, playerId: string): ValidationResult {
    if (!core.playerIds.includes(playerId)) return failure('unknownPlayer');
    if (core.heistNumber !== 1 || core.round !== 1 || core.phase !== 'chip-selection') return failure('rulesLocked');
    if (Object.keys(core.currentRoundChips).length > 0 || core.roundHistory.length > 0) return failure('rulesLocked');
    return success();
}

function validateDealTools(core: TheGangCore, playerId: string): ValidationResult {
    if (!core.playerIds.includes(playerId)) return failure('unknownPlayer');
    if (core.toolDeck.length < core.playerIds.length) return failure('toolDeckEmpty');
    if (core.playerIds.some((id) => core.players[id].toolCards.length > 0)) return failure('toolsAlreadyDealt');
    return success();
}

function validateUseTool(
    core: TheGangCore,
    playerId: string,
    tool: TheGangCore['players'][string]['toolCards'][number],
    cardIndex?: number,
): ValidationResult {
    if (!core.playerIds.includes(playerId)) return failure('unknownPlayer');
    const player = core.players[playerId];
    if (!player.toolCards.includes(tool)) return failure('toolNotHeld');
    if (player.activeTools.includes(tool)) return failure('toolAlreadyActive');
    if (tool === 'burner-phone' && core.specialistDeck.length < 2) return failure('specialistDeckEmpty');
    if (tool === 'flashlight' && core.deck.length < 1) return failure('deckEmpty');
    if (tool === 'night-vision-goggles') {
        if (typeof cardIndex !== 'number') return failure('missingCardIndex');
        if (cardIndex < 0 || cardIndex >= player.pocketCards.length) return failure('invalidCardIndex');
        if (player.nightVisionCards.length > 0) return failure('toolAlreadyActive');
    }
    if (tool !== 'burner-phone' && tool !== 'flashlight' && tool !== 'lubricant' && tool !== 'night-vision-goggles') {
        return failure('toolNotImplemented');
    }
    return success();
}

function validateProgressPlayer(core: TheGangCore, playerId: string): ValidationResult {
    return core.playerIds.includes(playerId) ? success() : failure('unknownPlayer');
}

function validateEndRound(core: TheGangCore, playerId: string): ValidationResult {
    const playerValidation = validateProgressPlayer(core, playerId);
    if (!playerValidation.valid) return playerValidation;
    if (core.phase !== 'chip-selection') return failure('notSelectingChips');
    if (!core.playerIds.every((playerId) => core.currentRoundChips[playerId] !== undefined)) {
        return failure('missingChips');
    }
    if (core.round >= 4) return failure('showdownRequired');
    return success();
}

function validateRevealShowdown(core: TheGangCore, playerId: string): ValidationResult {
    const playerValidation = validateProgressPlayer(core, playerId);
    if (!playerValidation.valid) return playerValidation;
    if (core.phase !== 'chip-selection') return failure('notSelectingChips');
    if (core.round !== 4) return failure('notFinalRound');
    if (!core.playerIds.every((playerId) => core.currentRoundChips[playerId] !== undefined)) {
        return failure('missingChips');
    }
    if (core.communityCards.length < 5) return failure('missingCommunityCards');
    return success();
}

function validateStartNextHeist(core: TheGangCore, playerId: string): ValidationResult {
    const playerValidation = validateProgressPlayer(core, playerId);
    if (!playerValidation.valid) return playerValidation;
    return core.phase === 'showdown' && !!core.lastShowdown
        ? success()
        : failure('showdownRequired');
}
