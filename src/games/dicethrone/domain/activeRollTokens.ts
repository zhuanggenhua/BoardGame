import type { PlayerId } from '../../../engine/types';
import type { DiceThroneCore, DiceThroneRollContext, DtResponseWindowType, TurnPhase } from './types';
import { resolveCurrentRollContext } from './rollContext';
import type { TokenDef } from './tokenTypes';
import { getTokenUseOptions } from './tokenTypes';

export interface UsableActiveRollToken {
    tokenId: string;
    tokenDef: TokenDef;
    currentRollContext: DiceThroneRollContext;
    allowedAmounts: number[];
    defaultAmount: number;
    requiresOpponentRollDice: boolean;
}

export interface ActiveRollTokenOptions {
    responseWindowType?: DtResponseWindowType;
}

const isMainRollPhase = (phase: TurnPhase): boolean => (
    phase === 'offensiveRoll' || phase === 'defensiveRoll'
);

const getDieOwnerId = (
    context: DiceThroneRollContext,
    die: DiceThroneRollContext['dice'][number],
): PlayerId => die.ownerId ?? context.ownerPlayerId;

const hasOpponentDieInCurrentRoll = (
    context: DiceThroneRollContext,
    playerId: PlayerId,
): boolean => context.dice.some((die) => getDieOwnerId(context, die) !== playerId);

const canUseActiveRollTokenDef = (
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenDef: TokenDef,
    phase: TurnPhase,
    options: ActiveRollTokenOptions = {},
): UsableActiveRollToken | null => {
    if (!isMainRollPhase(phase)) return null;
    if (options.responseWindowType && options.responseWindowType !== 'afterRollConfirmed') return null;
    if (state.pendingDamage) return null;
    if (!state.pendingAttack) return null;
    if (!tokenDef.activeUse?.timing?.includes('duringRoll')) return null;

    const player = state.players[playerId];
    if (!player) return null;

    const allowedAmounts = getTokenUseOptions(tokenDef, player.tokens[tokenDef.id] ?? 0);
    const defaultAmount = allowedAmounts[0];
    if (!defaultAmount) return null;

    const currentRollContext = resolveCurrentRollContext(state, phase);
    if (!currentRollContext) return null;
    if (currentRollContext.status === 'settled' || currentRollContext.display.replayOnly === true) {
        return null;
    }
    if (currentRollContext.policy.rerollableBy === 'none') return null;

    const requiresOpponentRollDice = tokenDef.activeUse.requiresOpponentRollDice === true;
    if (requiresOpponentRollDice) {
        if (options.responseWindowType !== 'afterRollConfirmed') return null;
        if (!hasOpponentDieInCurrentRoll(currentRollContext, playerId)) return null;
    } else if (currentRollContext.ownerPlayerId !== playerId) {
        return null;
    }

    return {
        tokenId: tokenDef.id,
        tokenDef,
        currentRollContext,
        allowedAmounts,
        defaultAmount,
        requiresOpponentRollDice,
    };
};

export const getUsableActiveRollTokens = (
    state: DiceThroneCore,
    playerId: PlayerId,
    phase: TurnPhase,
    options: ActiveRollTokenOptions = {},
): UsableActiveRollToken[] => (
    (state.tokenDefinitions ?? [])
        .map((tokenDef) => canUseActiveRollTokenDef(state, playerId, tokenDef, phase, options))
        .filter((entry): entry is UsableActiveRollToken => entry !== null)
);

export const getUsableActiveRollToken = (
    state: DiceThroneCore,
    playerId: PlayerId,
    phase: TurnPhase,
    tokenId: string,
    options: ActiveRollTokenOptions = {},
): UsableActiveRollToken | null => {
    const tokenDef = state.tokenDefinitions.find((definition) => definition.id === tokenId);
    return tokenDef ? canUseActiveRollTokenDef(state, playerId, tokenDef, phase, options) : null;
};

export const hasUsableActiveRollToken = (
    state: DiceThroneCore,
    playerId: PlayerId,
    phase: TurnPhase,
    options: ActiveRollTokenOptions = {},
): boolean => getUsableActiveRollTokens(state, playerId, phase, options).length > 0;
