import type { DomainCore, GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import {
    cloneTableCards,
    createRuntimeDeck,
    EMPTY_FOCUS_INSIGHT,
    resolveFocusInsight,
    type TableCard,
} from '../foundation';
import {
    FANTASY_REALMS_COMMANDS,
    getDeckDrawCount,
    isDuelVariant,
    requiresDiscardAfterTakingDiscard,
    validate,
} from './commands';
import { evaluateFantasyRealmsScore, resolveFantasyRealmsWinner } from './scoring';
import type {
    FantasyRealmsCommand,
    FantasyRealmsCore,
    FantasyRealmsEvent,
    FantasyRealmsPlayerState,
    FantasyRealmsTurnStage,
} from './types';

const now = () => Date.now();

const DEFAULT_SCORE_BREAKDOWN = evaluateFantasyRealmsScore([], []).scoreBreakdown;

function buildPlayerState(playerId: PlayerId, seatIndex: number): FantasyRealmsPlayerState {
    return {
        id: playerId,
        name: `玩家${seatIndex + 1}`,
        hand: [],
        score: 0,
        scoreBreakdown: DEFAULT_SCORE_BREAKDOWN.map((line) => ({ ...line })),
    };
}

function getNextPlayerId(core: FantasyRealmsCore): PlayerId {
    const currentIndex = core.playerIds.indexOf(core.currentPlayer);
    return core.playerIds[(currentIndex + 1) % core.playerIds.length] ?? core.currentPlayer;
}

function clonePlayers(players: Record<PlayerId, FantasyRealmsPlayerState>): Record<PlayerId, FantasyRealmsPlayerState> {
    return Object.fromEntries(
        Object.entries(players).map(([playerId, player]) => [playerId, {
            ...player,
            hand: cloneTableCards(player.hand),
            scoreBreakdown: player.scoreBreakdown.map((line) => ({ ...line })),
        }]),
    ) as Record<PlayerId, FantasyRealmsPlayerState>;
}

function recalculatePlayerSummary(
    player: FantasyRealmsPlayerState,
    discardPile: readonly TableCard[],
): FantasyRealmsPlayerState {
    const evaluation = evaluateFantasyRealmsScore(player.hand, discardPile);
    return {
        ...player,
        score: evaluation.totalScore,
        scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
    };
}

function recalculatePlayerSummaries(core: FantasyRealmsCore): FantasyRealmsCore {
    const players = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => [playerId, recalculatePlayerSummary(player, core.discardPile)]),
    ) as Record<PlayerId, FantasyRealmsPlayerState>;

    return {
        ...core,
        players,
    };
}

function resolveVisibleCardById(core: FantasyRealmsCore, cardId: string | null): TableCard | undefined {
    if (!cardId) return undefined;
    const discardCard = core.discardPile.find((card) => card.id === cardId);
    if (discardCard) return discardCard;
    for (const player of Object.values(core.players)) {
        const handCard = player.hand.find((card) => card.id === cardId);
        if (handCard) return handCard;
    }
    return undefined;
}

function resolveFallbackFocusCard(core: FantasyRealmsCore): TableCard | undefined {
    const currentPlayer = core.players[core.currentPlayer];
    return currentPlayer?.hand[0] ?? core.discardPile[core.discardPile.length - 1];
}

function withResolvedFocus(core: FantasyRealmsCore, preferredCardId?: string | null): FantasyRealmsCore {
    const focusCard = resolveVisibleCardById(core, preferredCardId ?? core.focusCardId) ?? resolveFallbackFocusCard(core);
    return {
        ...core,
        focusCardId: focusCard?.id ?? null,
        focusInsight: resolveFocusInsight(focusCard),
    };
}

function createInitialCore(playerIds: PlayerId[], random: RandomFn): FantasyRealmsCore {
    const normalizedPlayerIds = playerIds.length >= 2 ? playerIds : ['0', '1'];
    const runtimeDeck = random.shuffle(createRuntimeDeck());
    const useDuelSetup = normalizedPlayerIds.length === 2;
    let dealtCount = 0;

    const players = Object.fromEntries(
        normalizedPlayerIds.map((playerId, index) => {
            const basePlayer = buildPlayerState(playerId, index);
            if (useDuelSetup) {
                return [playerId, basePlayer];
            }

            const hand = runtimeDeck.slice(dealtCount, dealtCount + 7).map((card) => ({ ...card }));
            dealtCount += 7;
            return [playerId, {
                ...basePlayer,
                hand,
            }];
        }),
    ) as Record<PlayerId, FantasyRealmsPlayerState>;

    return recalculatePlayerSummaries({
        playerIds: normalizedPlayerIds,
        currentPlayer: normalizedPlayerIds[0]!,
        turn: 1,
        stage: 'draw',
        drawPile: runtimeDeck.slice(dealtCount).map((card) => ({ ...card })),
        discardPile: [],
        players,
        focusCardId: null,
        focusInsight: { ...EMPTY_FOCUS_INSIGHT, tips: [...EMPTY_FOCUS_INSIGHT.tips] },
    });
}

function createCardsDrawnEvent(core: FantasyRealmsCore, playerId: PlayerId, timestamp: number) {
    const drawCount = getDeckDrawCount(core);
    return {
        type: 'CARDS_DRAWN' as const,
        payload: {
            playerId,
            cards: cloneTableCards(core.drawPile.slice(0, drawCount)),
            nextStage: 'discard' as FantasyRealmsTurnStage,
        },
        sourceCommandType: FANTASY_REALMS_COMMANDS.DRAW_FROM_DECK,
        timestamp,
    };
}

function createTakeDiscardEvent(core: FantasyRealmsCore, playerId: PlayerId, cardId: string, timestamp: number) {
    const card = core.discardPile.find((entry) => entry.id === cardId)!;
    const requiresDiscard = requiresDiscardAfterTakingDiscard(core);
    return {
        type: 'DISCARD_CARD_TAKEN' as const,
        payload: {
            playerId,
            card: { ...card },
            nextPlayerId: requiresDiscard ? playerId : getNextPlayerId(core),
            nextTurn: requiresDiscard ? core.turn : core.turn + 1,
            nextStage: requiresDiscard ? 'discard' as FantasyRealmsTurnStage : 'draw' as FantasyRealmsTurnStage,
            requiresDiscard,
        },
        sourceCommandType: FANTASY_REALMS_COMMANDS.TAKE_FROM_DISCARD,
        timestamp,
    };
}

function createDiscardEvent(core: FantasyRealmsCore, playerId: PlayerId, cardId: string, timestamp: number) {
    const card = core.players[playerId]!.hand.find((entry) => entry.id === cardId)!;
    return {
        type: 'CARD_DISCARDED' as const,
        payload: {
            playerId,
            card: { ...card },
            nextPlayerId: getNextPlayerId(core),
            nextTurn: core.turn + 1,
            nextStage: 'draw' as FantasyRealmsTurnStage,
        },
        sourceCommandType: FANTASY_REALMS_COMMANDS.DISCARD_CARD,
        timestamp,
    };
}

function applyGameEnd(core: FantasyRealmsCore): GameOverResult | undefined {
    if (isDuelVariant(core)) {
        const allHandsFull = core.playerIds.every((playerId) => (core.players[playerId]?.hand.length ?? 0) >= 7);
        if (!allHandsFull || core.discardPile.length < 12) {
            return undefined;
        }
        return resolveFantasyRealmsWinner(
            core.playerIds,
            Object.fromEntries(core.playerIds.map((playerId) => [playerId, core.players[playerId]?.hand ?? []])) as Record<PlayerId, readonly TableCard[]>,
            core.discardPile,
        );
    }

    if (core.discardPile.length >= 10) {
        return resolveFantasyRealmsWinner(
            core.playerIds,
            Object.fromEntries(core.playerIds.map((playerId) => [playerId, core.players[playerId]?.hand ?? []])) as Record<PlayerId, readonly TableCard[]>,
            core.discardPile,
        );
    }

    return undefined;
}

export const FantasyRealmsDomain: DomainCore<FantasyRealmsCore, FantasyRealmsCommand, FantasyRealmsEvent> = {
    gameId: 'fantasyrealms',

    setup: (playerIds: PlayerId[], random: RandomFn): FantasyRealmsCore => createInitialCore(playerIds, random),

    validate,

    execute: (state, command) => {
        const timestamp = command.timestamp ?? now();
        switch (command.type) {
            case FANTASY_REALMS_COMMANDS.SET_FOCUS_CARD:
                return [{
                    type: 'FOCUS_CARD_SET',
                    payload: { cardId: command.payload.cardId },
                    sourceCommandType: command.type,
                    timestamp,
                }];
            case FANTASY_REALMS_COMMANDS.DRAW_FROM_DECK:
                return [createCardsDrawnEvent(state.core, command.playerId, timestamp)];
            case FANTASY_REALMS_COMMANDS.TAKE_FROM_DISCARD:
                return [createTakeDiscardEvent(state.core, command.playerId, command.payload.cardId, timestamp)];
            case FANTASY_REALMS_COMMANDS.DISCARD_CARD:
                return [createDiscardEvent(state.core, command.playerId, command.payload.cardId, timestamp)];
            default:
                return [];
        }
    },

    reduce: (core, event) => {
        switch (event.type) {
            case 'FOCUS_CARD_SET':
                return withResolvedFocus(core, event.payload.cardId);

            case 'CARDS_DRAWN': {
                const currentPlayer = core.players[event.payload.playerId];
                const nextPlayers = {
                    ...core.players,
                    [event.payload.playerId]: {
                        ...currentPlayer!,
                        hand: [...currentPlayer!.hand, ...cloneTableCards(event.payload.cards)],
                    },
                };
                const nextCore = recalculatePlayerSummaries({
                    ...core,
                    stage: event.payload.nextStage,
                    drawPile: core.drawPile.slice(event.payload.cards.length).map((card) => ({ ...card })),
                    players: nextPlayers,
                });
                const latestDrawnCardId = event.payload.cards[event.payload.cards.length - 1]?.id ?? null;
                return withResolvedFocus(nextCore, latestDrawnCardId);
            }

            case 'DISCARD_CARD_TAKEN': {
                const currentPlayer = core.players[event.payload.playerId];
                const nextPlayers = {
                    ...core.players,
                    [event.payload.playerId]: {
                        ...currentPlayer!,
                        hand: [...currentPlayer!.hand, { ...event.payload.card }],
                    },
                };
                const nextDiscardPile = core.discardPile
                    .filter((card) => card.id !== event.payload.card.id)
                    .map((card) => ({ ...card }));
                const nextCore = recalculatePlayerSummaries({
                    ...core,
                    currentPlayer: event.payload.nextPlayerId,
                    turn: event.payload.nextTurn,
                    stage: event.payload.nextStage,
                    discardPile: nextDiscardPile,
                    players: nextPlayers,
                });
                return withResolvedFocus(nextCore, event.payload.card.id);
            }

            case 'CARD_DISCARDED': {
                const currentPlayer = core.players[event.payload.playerId];
                const nextPlayers = {
                    ...core.players,
                    [event.payload.playerId]: {
                        ...currentPlayer!,
                        hand: currentPlayer!.hand.filter((card) => card.id !== event.payload.card.id).map((card) => ({ ...card })),
                    },
                };
                const nextCore = recalculatePlayerSummaries({
                    ...core,
                    currentPlayer: event.payload.nextPlayerId,
                    turn: event.payload.nextTurn,
                    stage: event.payload.nextStage,
                    discardPile: [...core.discardPile, { ...event.payload.card }],
                    players: nextPlayers,
                });
                return withResolvedFocus(nextCore, event.payload.card.id);
            }

            default:
                return core;
        }
    },

    isGameOver: (state): GameOverResult | undefined => applyGameEnd(state),
};

export type {
    FantasyRealmsCommand,
    FantasyRealmsCommandMap,
    FantasyRealmsCore,
    FantasyRealmsEvent,
} from './types';

export {
    evaluateFantasyRealmsScore,
    resolveFantasyRealmsWinner,
} from './scoring';

export {
    isDuelVariant,
} from './commands';
