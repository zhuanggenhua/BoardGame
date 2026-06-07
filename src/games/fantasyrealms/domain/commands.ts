import type { MatchState, ValidationResult } from '../../../engine/types';
import type { FantasyRealmsCommand, FantasyRealmsCore } from './types';

export const FANTASY_REALMS_COMMANDS = {
    SET_FOCUS_CARD: 'SET_FOCUS_CARD',
    DRAW_FROM_DECK: 'DRAW_FROM_DECK',
    TAKE_FROM_DISCARD: 'TAKE_FROM_DISCARD',
    DISCARD_CARD: 'DISCARD_CARD',
} as const;

const fail = (error: string): ValidationResult => ({ valid: false, error });

function isCurrentPlayer(core: FantasyRealmsCore, playerId: string): boolean {
    return playerId === core.currentPlayer;
}

function hasVisibleCard(core: FantasyRealmsCore, cardId: string): boolean {
    if (core.discardPile.some((card) => card.id === cardId)) return true;
    return Object.values(core.players).some((player) => player.hand.some((card) => card.id === cardId));
}

function getCurrentPlayer(core: FantasyRealmsCore) {
    return core.players[core.currentPlayer];
}

function isDuelVariant(core: FantasyRealmsCore): boolean {
    return core.playerIds.length === 2;
}

function getDeckDrawCount(core: FantasyRealmsCore): number {
    if (!isDuelVariant(core)) {
        return 1;
    }
    return (getCurrentPlayer(core)?.hand.length ?? 0) >= 7 ? 1 : 2;
}

function requiresDiscardAfterTakingDiscard(core: FantasyRealmsCore): boolean {
    if (!isDuelVariant(core)) {
        return true;
    }
    return (getCurrentPlayer(core)?.hand.length ?? 0) >= 7;
}

export function validate(
    state: MatchState<FantasyRealmsCore>,
    command: FantasyRealmsCommand,
): ValidationResult {
    const core = state.core;
    const currentPlayer = getCurrentPlayer(core);
    const skipTurnGuard = Boolean(command.skipValidation);

    switch (command.type) {
        case FANTASY_REALMS_COMMANDS.SET_FOCUS_CARD:
            return hasVisibleCard(core, command.payload.cardId)
                ? { valid: true }
                : fail('unknownCard');

        case FANTASY_REALMS_COMMANDS.DRAW_FROM_DECK:
            if (!skipTurnGuard && !isCurrentPlayer(core, command.playerId)) {
                return fail('notYourTurn');
            }
            if (core.stage !== 'draw') {
                return fail('notInDrawStage');
            }
            if (core.drawPile.length < getDeckDrawCount(core)) {
                return fail('deckEmpty');
            }
            return { valid: true };

        case FANTASY_REALMS_COMMANDS.TAKE_FROM_DISCARD:
            if (!skipTurnGuard && !isCurrentPlayer(core, command.playerId)) {
                return fail('notYourTurn');
            }
            if (core.stage !== 'draw') {
                return fail('notInDrawStage');
            }
            if (!core.discardPile.some((card) => card.id === command.payload.cardId)) {
                return fail('discardCardUnavailable');
            }
            return { valid: true };

        case FANTASY_REALMS_COMMANDS.DISCARD_CARD:
            if (!skipTurnGuard && !isCurrentPlayer(core, command.playerId)) {
                return fail('notYourTurn');
            }
            if (core.stage !== 'discard') {
                return fail('notInDiscardStage');
            }
            if (!currentPlayer?.hand.some((card) => card.id === command.payload.cardId)) {
                return fail('handCardUnavailable');
            }
            return { valid: true };

        default:
            return fail('unknownCommand');
    }
}

export {
    getDeckDrawCount,
    isDuelVariant,
    requiresDiscardAfterTakingDiscard,
};
