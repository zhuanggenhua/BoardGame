import type { MatchState, RandomFn } from '../../../engine/types';
import {
    CARD_DEFS_BY_ID,
    calculatePoints,
    computeGameResult,
    getEligibleNobles,
    getNextTurn,
    getPaymentTokens,
    getTokenCount,
} from './rules';
import type { SplendorCommand, SplendorCore, SplendorEvent, TokenColor } from './types';

function nowFromCommand(command: SplendorCommand): number {
    return typeof command.timestamp === 'number' ? command.timestamp : 0;
}

function applyEvents(core: SplendorCore, events: SplendorEvent[]): SplendorCore {
    let next = core;
    for (const event of events) {
        next = reduce(next, event);
    }
    return next;
}

function turnClosureEvents(core: SplendorCore, playerId: string, now: number): SplendorEvent[] {
    const events: SplendorEvent[] = [];
    const player = core.players[playerId];

    if (getTokenCount(player) > 10) {
        return [{
            type: 'PENDING_RESOLUTION_SET',
            payload: {
                pending: {
                    type: 'discardToLimit',
                    excess: getTokenCount(player) - 10,
                },
            },
            timestamp: now,
        }];
    }

    const nobles = getEligibleNobles(core, playerId);
    if (nobles.length > 1) {
        return [{
            type: 'PENDING_RESOLUTION_SET',
            payload: {
                pending: {
                    type: 'chooseNoble',
                    nobleIds: nobles,
                },
            },
            timestamp: now,
        }];
    }

    if (nobles.length === 1) {
        events.push({
            type: 'NOBLE_GAINED',
            payload: { playerId, nobleId: nobles[0] },
            timestamp: now,
        });
    }

    const afterNoble = applyEvents(core, events);
    const afterNoblePlayer = afterNoble.players[playerId];

    if (afterNoblePlayer.points >= 15 && !afterNoble.endgame.triggered) {
        events.push({
            type: 'ENDGAME_TRIGGERED',
            payload: {
                triggeredByPlayerId: playerId,
                triggerRound: afterNoble.round,
            },
            timestamp: now,
        });
    }

    const afterEndgame = applyEvents(core, events);
    const { nextPlayerId, nextRound } = getNextTurn(afterEndgame);
    const finalRoundReached = afterEndgame.endgame.triggered
        && (
            (typeof afterEndgame.endgame.triggeredByPlayerId === 'string'
                && nextPlayerId === afterEndgame.endgame.triggeredByPlayerId)
            || (
                afterEndgame.endgame.triggeredByPlayerId === undefined
                && afterEndgame.endgame.triggerRound !== undefined
                && afterEndgame.round >= afterEndgame.endgame.triggerRound
                && playerId === afterEndgame.playerOrder[afterEndgame.playerOrder.length - 1]
            )
        );
    if (finalRoundReached) {
        events.push({
            type: 'GAME_ENDED',
            payload: computeGameResult(afterEndgame),
            timestamp: now,
        });
        return events;
    }

    events.push({
        type: 'TURN_ADVANCED',
        payload: { nextPlayerId, round: nextRound },
        timestamp: now,
    });
    return events;
}

export function execute(
    state: MatchState<SplendorCore>,
    command: SplendorCommand,
    _random: RandomFn,
): SplendorEvent[] {
    const core = state.core;
    const playerId = command.playerId;
    const now = nowFromCommand(command);

    switch (command.type) {
        case 'HOST_START_GAME':
            return [{
                type: 'HOST_STARTED',
                payload: { playerId },
                sourceCommandType: command.type,
                timestamp: now,
            }];

        case 'TAKE_THREE_DIFFERENT_GEMS': {
            const base: SplendorEvent[] = [{
                type: 'TOKENS_GAINED',
                payload: {
                    playerId,
                    tokens: Object.fromEntries(command.payload.colors.map((color) => [color, 1])),
                },
                sourceCommandType: command.type,
                timestamp: now,
            }];
            const preview = applyEvents(core, base);
            return [...base, ...turnClosureEvents(preview, playerId, now)];
        }

        case 'TAKE_TWO_SAME_GEMS': {
            const base: SplendorEvent[] = [{
                type: 'TOKENS_GAINED',
                payload: {
                    playerId,
                    tokens: { [command.payload.color]: 2 },
                },
                sourceCommandType: command.type,
                timestamp: now,
            }];
            const preview = applyEvents(core, base);
            return [...base, ...turnClosureEvents(preview, playerId, now)];
        }

        case 'RESERVE_OPEN_CARD': {
            const base: SplendorEvent[] = [
                {
                    type: 'CARD_RESERVED',
                    payload: {
                        playerId,
                        tier: command.payload.tier,
                        cardId: command.payload.cardId,
                        source: 'open',
                    },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
                {
                    type: 'MARKET_CARD_REMOVED',
                    payload: {
                        tier: command.payload.tier,
                        cardId: command.payload.cardId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
                {
                    type: 'MARKET_CARD_REFILLED',
                    payload: { tier: command.payload.tier },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
            ];
            if (core.bank.gold > 0) {
                base.splice(1, 0, {
                    type: 'TOKENS_GAINED',
                    payload: { playerId, tokens: { gold: 1 } },
                    sourceCommandType: command.type,
                    timestamp: now,
                });
            }
            const preview = applyEvents(core, base);
            return [...base, ...turnClosureEvents(preview, playerId, now)];
        }

        case 'RESERVE_DECK_TOP_CARD': {
            const cardId = core.decks[command.payload.tier][0];
            const base: SplendorEvent[] = [{
                type: 'CARD_RESERVED',
                payload: {
                    playerId,
                    tier: command.payload.tier,
                    cardId,
                    source: 'deck',
                },
                sourceCommandType: command.type,
                timestamp: now,
            }];
            if (core.bank.gold > 0) {
                base.push({
                    type: 'TOKENS_GAINED',
                    payload: { playerId, tokens: { gold: 1 } },
                    sourceCommandType: command.type,
                    timestamp: now,
                });
            }
            const preview = applyEvents(core, base);
            return [...base, ...turnClosureEvents(preview, playerId, now)];
        }

        case 'BUY_OPEN_CARD': {
            const card = CARD_DEFS_BY_ID[command.payload.cardId];
            const payment = getPaymentTokens(core.players[playerId], card);
            const base: SplendorEvent[] = [
                {
                    type: 'TOKENS_SPENT',
                    payload: { playerId, tokens: payment },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
                {
                    type: 'CARD_PURCHASED',
                    payload: { playerId, cardId: command.payload.cardId, source: 'open' },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
                {
                    type: 'MARKET_CARD_REMOVED',
                    payload: { tier: command.payload.tier, cardId: command.payload.cardId },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
                {
                    type: 'MARKET_CARD_REFILLED',
                    payload: { tier: command.payload.tier },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
            ];
            const preview = applyEvents(core, base);
            return [...base, ...turnClosureEvents(preview, playerId, now)];
        }

        case 'BUY_RESERVED_CARD': {
            const card = CARD_DEFS_BY_ID[command.payload.cardId];
            const payment = getPaymentTokens(core.players[playerId], card);
            const base: SplendorEvent[] = [
                {
                    type: 'TOKENS_SPENT',
                    payload: { playerId, tokens: payment },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
                {
                    type: 'RESERVED_CARD_REMOVED',
                    payload: { playerId, cardId: command.payload.cardId },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
                {
                    type: 'CARD_PURCHASED',
                    payload: { playerId, cardId: command.payload.cardId, source: 'reserved' },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
            ];
            const preview = applyEvents(core, base);
            return [...base, ...turnClosureEvents(preview, playerId, now)];
        }

        case 'DISCARD_GEMS_TO_LIMIT': {
            const base: SplendorEvent[] = [
                {
                    type: 'PENDING_RESOLUTION_CLEARED',
                    payload: {},
                    sourceCommandType: command.type,
                    timestamp: now,
                },
                {
                    type: 'TOKENS_DISCARDED',
                    payload: { playerId, color: command.payload.color, count: 1 },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
            ];
            const preview = applyEvents(core, base);
            return [...base, ...turnClosureEvents(preview, playerId, now)];
        }

        case 'CHOOSE_NOBLE': {
            const base: SplendorEvent[] = [
                {
                    type: 'PENDING_RESOLUTION_CLEARED',
                    payload: {},
                    sourceCommandType: command.type,
                    timestamp: now,
                },
                {
                    type: 'NOBLE_GAINED',
                    payload: { playerId, nobleId: command.payload.nobleId },
                    sourceCommandType: command.type,
                    timestamp: now,
                },
            ];
            const preview = applyEvents(core, base);
            return [...base, ...turnClosureEvents(preview, playerId, now)];
        }

        case 'PASS_TURN':
            return turnClosureEvents(core, playerId, now);

        default:
            return [];
    }
}

export function reduce(core: SplendorCore, event: SplendorEvent): SplendorCore {
    switch (event.type) {
        case 'HOST_STARTED':
            return {
                ...core,
                hostStarted: true,
            };

        case 'TOKENS_GAINED': {
            const { playerId, tokens } = event.payload;
            const player = core.players[playerId];
            const nextPlayerTokens = { ...player.tokens };
            const nextBank = { ...core.bank };
            for (const [color, count] of Object.entries(tokens)) {
                const tokenColor = color as TokenColor;
                nextPlayerTokens[tokenColor] += count ?? 0;
                nextBank[tokenColor] -= count ?? 0;
            }
            return {
                ...core,
                bank: nextBank,
                players: {
                    ...core.players,
                    [playerId]: {
                        ...player,
                        tokens: nextPlayerTokens,
                    },
                },
            };
        }

        case 'TOKENS_SPENT': {
            const { playerId, tokens } = event.payload;
            const player = core.players[playerId];
            const nextPlayerTokens = { ...player.tokens };
            const nextBank = { ...core.bank };
            for (const [color, count] of Object.entries(tokens)) {
                const tokenColor = color as TokenColor;
                nextPlayerTokens[tokenColor] -= count ?? 0;
                nextBank[tokenColor] += count ?? 0;
            }
            return {
                ...core,
                bank: nextBank,
                players: {
                    ...core.players,
                    [playerId]: {
                        ...player,
                        tokens: nextPlayerTokens,
                    },
                },
            };
        }

        case 'TOKENS_DISCARDED': {
            const { playerId, color, count } = event.payload;
            const player = core.players[playerId];
            return {
                ...core,
                bank: {
                    ...core.bank,
                    [color]: core.bank[color] + count,
                },
                players: {
                    ...core.players,
                    [playerId]: {
                        ...player,
                        tokens: {
                            ...player.tokens,
                            [color]: player.tokens[color] - count,
                        },
                    },
                },
            };
        }

        case 'CARD_RESERVED': {
            const { playerId, tier, cardId, source } = event.payload;
            const player = core.players[playerId];
            const nextDecks = { ...core.decks };
            if (source === 'deck') {
                nextDecks[tier] = nextDecks[tier].slice(1);
            }
            return {
                ...core,
                decks: nextDecks,
                players: {
                    ...core.players,
                    [playerId]: {
                        ...player,
                        reservedCardIds: [...player.reservedCardIds, cardId],
                    },
                },
            };
        }

        case 'CARD_PURCHASED': {
            const { playerId, cardId } = event.payload;
            const player = core.players[playerId];
            const nextPlayer = {
                ...player,
                purchasedCardIds: [...player.purchasedCardIds, cardId],
            };
            nextPlayer.points = calculatePoints(nextPlayer);
            return {
                ...core,
                players: {
                    ...core.players,
                    [playerId]: nextPlayer,
                },
            };
        }

        case 'MARKET_CARD_REMOVED': {
            const { tier, cardId } = event.payload;
            return {
                ...core,
                market: {
                    ...core.market,
                    [tier]: core.market[tier].filter((id) => id !== cardId),
                },
            };
        }

        case 'MARKET_CARD_REFILLED': {
            const { tier } = event.payload;
            if (core.decks[tier].length === 0) {
                return core;
            }
            const [cardId, ...rest] = core.decks[tier];
            return {
                ...core,
                decks: {
                    ...core.decks,
                    [tier]: rest,
                },
                market: {
                    ...core.market,
                    [tier]: [...core.market[tier], cardId],
                },
            };
        }

        case 'RESERVED_CARD_REMOVED': {
            const { playerId, cardId } = event.payload;
            const player = core.players[playerId];
            return {
                ...core,
                players: {
                    ...core.players,
                    [playerId]: {
                        ...player,
                        reservedCardIds: player.reservedCardIds.filter((id) => id !== cardId),
                    },
                },
            };
        }

        case 'NOBLE_GAINED': {
            const { playerId, nobleId } = event.payload;
            const player = core.players[playerId];
            const nextPlayer = {
                ...player,
                nobleIds: [...player.nobleIds, nobleId],
            };
            nextPlayer.points = calculatePoints(nextPlayer);
            return {
                ...core,
                nobleIds: core.nobleIds.filter((id) => id !== nobleId),
                players: {
                    ...core.players,
                    [playerId]: nextPlayer,
                },
            };
        }

        case 'PENDING_RESOLUTION_SET':
            return {
                ...core,
                pendingResolution: event.payload.pending,
            };

        case 'PENDING_RESOLUTION_CLEARED':
            return {
                ...core,
                pendingResolution: undefined,
            };

        case 'TURN_ADVANCED':
            return {
                ...core,
                currentPlayer: event.payload.nextPlayerId,
                round: event.payload.round,
            };

        case 'ENDGAME_TRIGGERED':
            return {
                ...core,
                endgame: {
                    triggered: true,
                    triggerRound: event.payload.triggerRound,
                    triggeredByPlayerId: event.payload.triggeredByPlayerId,
                },
            };

        case 'GAME_ENDED':
            return {
                ...core,
                gameResult: event.payload,
            };

        default:
            return core;
    }
}
