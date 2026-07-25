import type { ValidationResult } from '../../../engine/types';
import { CARD_DEFS_BY_ID, CARD_TIERS, GEM_COLORS, MAX_RESERVED_CARDS, canAffordCard, hasAnyStandardTurnAction } from './rules';
import type { SplendorCommand, SplendorCore, TokenColor } from './types';

export function validate(state: SplendorCore, command: SplendorCommand): ValidationResult {
    if (state.gameResult) {
        return { valid: false, error: 'gameOver' };
    }

    if (command.type === 'HOST_START_GAME') {
        return validateHostStartGame(state, command.playerId);
    }

    if (!state.hostStarted) {
        return { valid: false, error: 'gameNotStarted' };
    }

    if (!command.skipValidation && command.playerId !== state.currentPlayer) {
        return { valid: false, error: 'notYourTurn' };
    }

    if (state.pendingResolution?.type === 'discardToLimit' && command.type !== 'DISCARD_GEMS_TO_LIMIT') {
        return { valid: false, error: 'mustDiscardGems' };
    }
    if (state.pendingResolution?.type === 'chooseNoble' && command.type !== 'CHOOSE_NOBLE') {
        return { valid: false, error: 'mustChooseNoble' };
    }

    switch (command.type) {
        case 'TAKE_THREE_DIFFERENT_GEMS':
            return validateTakeThree(state, command.payload.colors);
        case 'TAKE_TWO_SAME_GEMS':
            return validateTakeTwoSame(state, command.payload.color);
        case 'RESERVE_OPEN_CARD':
            return validateReserveOpen(state, command.payload.tier, command.payload.cardId, command.playerId);
        case 'RESERVE_DECK_TOP_CARD':
            return validateReserveDeckTop(state, command.payload.tier, command.playerId);
        case 'BUY_OPEN_CARD':
            return validateBuyOpen(state, command.payload.tier, command.payload.cardId, command.playerId);
        case 'BUY_RESERVED_CARD':
            return validateBuyReserved(state, command.payload.cardId, command.playerId);
        case 'DISCARD_GEMS_TO_LIMIT':
            return validateDiscard(state, command.payload.color, command.playerId);
        case 'CHOOSE_NOBLE':
            return state.pendingResolution?.type === 'chooseNoble' && state.pendingResolution.nobleIds.includes(command.payload.nobleId)
                ? { valid: true }
                : { valid: false, error: 'invalidNobleChoice' };
        case 'PASS_TURN':
            return validatePassTurn(state, command.playerId);
        default:
            return { valid: false, error: 'unknownCommand' };
    }
}

function validateTakeTwoSame(state: SplendorCore, color: string): ValidationResult {
    if (state.pendingResolution) {
        return { valid: false, error: 'pendingResolutionActive' };
    }
    if (!GEM_COLORS.includes(color as (typeof GEM_COLORS)[number])) {
        return { valid: false, error: 'invalidGemColor' };
    }
    return state.bank[color as (typeof GEM_COLORS)[number]] >= 4
        ? { valid: true }
        : { valid: false, error: 'notEnoughTokensForPair' };
}

function validateHostStartGame(state: SplendorCore, playerId: string): ValidationResult {
    if (state.hostStarted) {
        return { valid: false, error: 'gameAlreadyStarted' };
    }
    if (playerId !== state.hostPlayerId) {
        return { valid: false, error: 'onlyHostCanStart' };
    }
    return { valid: true };
}

function validateTakeThree(state: SplendorCore, colors: string[]): ValidationResult {
    if (state.pendingResolution) {
        return { valid: false, error: 'pendingResolutionActive' };
    }
    const unique = Array.from(new Set(colors));
    if (unique.length !== colors.length || unique.length < 1 || unique.length > 3) {
        return { valid: false, error: 'invalidTakeThreeSelection' };
    }
    if (!unique.every((color) => GEM_COLORS.includes(color as (typeof GEM_COLORS)[number]))) {
        return { valid: false, error: 'invalidGemColor' };
    }
    const availableColors = GEM_COLORS.filter((color) => state.bank[color] > 0);
    if (unique.length > availableColors.length) {
        return { valid: false, error: 'notEnoughDistinctColors' };
    }
    if (availableColors.length >= 3 && unique.length !== 3) {
        return { valid: false, error: 'invalidTakeThreeSelection' };
    }
    if (!unique.every((color) => state.bank[color as (typeof GEM_COLORS)[number]] > 0)) {
        return { valid: false, error: 'gemPileEmpty' };
    }
    return { valid: true };
}

function validateReserveOpen(state: SplendorCore, tier: number, cardId: string, playerId: string): ValidationResult {
    if (state.pendingResolution) {
        return { valid: false, error: 'pendingResolutionActive' };
    }
    if (!CARD_TIERS.includes(tier as 1 | 2 | 3)) {
        return { valid: false, error: 'invalidTier' };
    }
    if (state.players[playerId].reservedCardIds.length >= MAX_RESERVED_CARDS) {
        return { valid: false, error: 'reservedLimitReached' };
    }
    if (!state.market[tier as 1 | 2 | 3].includes(cardId)) {
        return { valid: false, error: 'cardNotInMarket' };
    }
    return { valid: true };
}

function validateReserveDeckTop(state: SplendorCore, tier: number, playerId: string): ValidationResult {
    if (state.pendingResolution) {
        return { valid: false, error: 'pendingResolutionActive' };
    }
    if (!CARD_TIERS.includes(tier as 1 | 2 | 3)) {
        return { valid: false, error: 'invalidTier' };
    }
    if (state.players[playerId].reservedCardIds.length >= MAX_RESERVED_CARDS) {
        return { valid: false, error: 'reservedLimitReached' };
    }
    if (state.decks[tier as 1 | 2 | 3].length === 0) {
        return { valid: false, error: 'deckEmpty' };
    }
    return { valid: true };
}

function validateBuyOpen(state: SplendorCore, tier: number, cardId: string, playerId: string): ValidationResult {
    if (state.pendingResolution) {
        return { valid: false, error: 'pendingResolutionActive' };
    }
    if (!CARD_TIERS.includes(tier as 1 | 2 | 3) || !state.market[tier as 1 | 2 | 3].includes(cardId)) {
        return { valid: false, error: 'cardNotInMarket' };
    }
    const card = CARD_DEFS_BY_ID[cardId];
    if (!card || !canAffordCard(state.players[playerId], card)) {
        return { valid: false, error: 'cannotAffordCard' };
    }
    return { valid: true };
}

function validateBuyReserved(state: SplendorCore, cardId: string, playerId: string): ValidationResult {
    if (state.pendingResolution) {
        return { valid: false, error: 'pendingResolutionActive' };
    }
    if (!state.players[playerId].reservedCardIds.includes(cardId)) {
        return { valid: false, error: 'cardNotReserved' };
    }
    const card = CARD_DEFS_BY_ID[cardId];
    if (!card || !canAffordCard(state.players[playerId], card)) {
        return { valid: false, error: 'cannotAffordCard' };
    }
    return { valid: true };
}

function validateDiscard(state: SplendorCore, color: TokenColor, playerId: string): ValidationResult {
    if (state.pendingResolution?.type !== 'discardToLimit') {
        return { valid: false, error: 'noDiscardPending' };
    }
    if (state.players[playerId].tokens[color] < 1) {
        return { valid: false, error: 'noTokenToDiscard' };
    }
    return { valid: true };
}

function validatePassTurn(state: SplendorCore, playerId: string): ValidationResult {
    if (state.pendingResolution) {
        return { valid: false, error: 'pendingResolutionActive' };
    }
    if (hasAnyStandardTurnAction(state, playerId)) {
        return { valid: false, error: 'standardActionAvailable' };
    }
    return { valid: true };
}
