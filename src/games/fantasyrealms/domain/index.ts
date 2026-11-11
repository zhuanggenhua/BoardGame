import type { DomainCore, GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import {
    cloneTableCards,
    createRuntimeDeck,
    getFantasyRealmsBaseHandLimit,
    getFantasyRealmsDiscardEndThreshold,
    type TableCard,
} from '../foundation';
import { readFantasyRealmsRuntimeSetupConfig } from '../roomSetup';
import {
    FANTASY_REALMS_COMMANDS,
    getDeckDrawCount,
    isDuelVariant,
    requiresDiscardAfterTakingDiscard,
    validate,
} from './commands';
import { evaluateFantasyRealmsScore, evaluateFantasyRealmsResolvedScore, resolveFantasyRealmsWinner } from './scoring';
import { playerView } from './view';
import { applySettlementChoice, beginSettlement, emptySelections } from './settlement';
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

function recalculatePlayerSummary(
    player: FantasyRealmsPlayerState,
    discardPile: readonly TableCard[],
    core: Pick<FantasyRealmsCore, 'playerIds' | 'setupConfig'>,
): FantasyRealmsPlayerState {
    const evaluation = evaluateFantasyRealmsResolvedScore(player.hand, discardPile, emptySelections(), {
        setupConfig: core.setupConfig,
        playerCount: core.playerIds.length,
    });
    return {
        ...player,
        score: evaluation.totalScore,
        scoreBreakdown: evaluation.scoreBreakdown.map((line) => ({ ...line })),
    };
}

function recalculatePlayerSummaries(core: FantasyRealmsCore): FantasyRealmsCore {
    const players = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => [playerId, recalculatePlayerSummary(player, core.discardPile, core)]),
    ) as Record<PlayerId, FantasyRealmsPlayerState>;

    return {
        ...core,
        players,
    };
}

function ensureDiscardSlots(cards: readonly TableCard[]): TableCard[] {
    const occupied = new Set(cards.map((card) => card.discardSlot).filter((slot): slot is number => slot !== undefined));
    return cards.map((card) => {
        if (card.discardSlot !== undefined) return card;
        let slot = 0;
        while (occupied.has(slot)) slot += 1;
        occupied.add(slot);
        return { ...card, discardSlot: slot };
    });
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
    };
}

function createInitialCore(playerIds: PlayerId[], random: RandomFn, setupData?: unknown): FantasyRealmsCore {
    const normalizedPlayerIds = playerIds.length >= 2 ? playerIds : ['0', '1'];
    const setupConfig = readFantasyRealmsRuntimeSetupConfig(setupData as Record<string, unknown> | undefined, {
        playerCount: normalizedPlayerIds.length,
        allowLegacyTwoPlayerFallback: true,
    });
    const runtimeDeck = random.shuffle(createRuntimeDeck(setupConfig));
    const useDuelSetup = setupConfig.variant === 'duel';
    const openingHandSize = getFantasyRealmsBaseHandLimit(setupConfig);
    let dealtCount = 0;

    const players = Object.fromEntries(
        normalizedPlayerIds.map((playerId, index) => {
            const basePlayer = buildPlayerState(playerId, index);
            if (useDuelSetup) {
                return [playerId, basePlayer];
            }

            const hand = runtimeDeck.slice(dealtCount, dealtCount + openingHandSize).map((card) => ({ ...card }));
            dealtCount += openingHandSize;
            return [playerId, {
                ...basePlayer,
                hand,
            }];
        }),
    ) as Record<PlayerId, FantasyRealmsPlayerState>;

    return recalculatePlayerSummaries({
        setupConfig,
        playerIds: normalizedPlayerIds,
        currentPlayer: normalizedPlayerIds[0]!,
        turn: 1,
        stage: 'draw',
        drawPile: runtimeDeck.slice(dealtCount).map((card) => ({ ...card })),
        discardPile: [],
        players,
        focusCardId: null,
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
    if (core.settlement?.step !== 'done') return undefined;
    return resolveFantasyRealmsWinner(
        core.playerIds,
        Object.fromEntries(core.playerIds.map((id) => [id, core.players[id]?.hand ?? []])),
        core.discardPile,
        { setupConfig: core.setupConfig, playerCount: core.playerIds.length },
        core.settlement.selections,
    );
}

export const FantasyRealmsDomain: DomainCore<FantasyRealmsCore, FantasyRealmsCommand, FantasyRealmsEvent> = {
    gameId: 'fantasyrealms',

    setup: (playerIds: PlayerId[], random: RandomFn, setupData?: unknown): FantasyRealmsCore => createInitialCore(playerIds, random, setupData),

    validate,
    playerView,

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
            case FANTASY_REALMS_COMMANDS.RESOLVE_SETTLEMENT:
                return [{ type: 'SETTLEMENT_CHOICE_RESOLVED', payload: { playerId: command.playerId, choice: command.payload }, sourceCommandType: command.type, timestamp }];
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
                // 旧对局可能没有位置字段，先按已有顺序固定位置再移除。
                const nextDiscardPile = ensureDiscardSlots(core.discardPile)
                    .filter((card) => card.id !== event.payload.card.id);
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

            case 'SETTLEMENT_CHOICE_RESOLVED':
                return applySettlementChoice(core, event.payload.choice);

            case 'CARD_DISCARDED': {
                const currentPlayer = core.players[event.payload.playerId];
                const nextPlayers = {
                    ...core.players,
                    [event.payload.playerId]: {
                        ...currentPlayer!,
                        hand: currentPlayer!.hand.filter((card) => card.id !== event.payload.card.id).map((card) => ({ ...card })),
                    },
                };
                const existingDiscardCards = ensureDiscardSlots(core.discardPile);
                const occupied = new Set(existingDiscardCards.map((card) => card.discardSlot));
                let discardSlot = 0;
                while (occupied.has(discardSlot)) discardSlot += 1;
                const nextCore = recalculatePlayerSummaries({
                    ...core,
                    currentPlayer: event.payload.nextPlayerId,
                    turn: event.payload.nextTurn,
                    stage: event.payload.nextStage,
                    discardPile: [...existingDiscardCards, { ...event.payload.card, discardSlot }],
                    players: nextPlayers,
                });
                const focusedCore = withResolvedFocus(nextCore, event.payload.card.id);
                const allHandsFull = !isDuelVariant(focusedCore) || focusedCore.playerIds.every((id) => (
                    (focusedCore.players[id]?.hand.length ?? 0) >= getFantasyRealmsBaseHandLimit(focusedCore.setupConfig)
                ));
                return allHandsFull && focusedCore.discardPile.length >= getFantasyRealmsDiscardEndThreshold(focusedCore.playerIds.length, focusedCore.setupConfig)
                    ? beginSettlement({ ...focusedCore, stage: 'settlement' })
                    : focusedCore;
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
    FantasyRealmsPlayerState,
} from './types';

export {
    evaluateFantasyRealmsScore,
    resolveFantasyRealmsWinner,
} from './scoring';

export {
    getDeckDrawCount,
    isDuelVariant,
} from './commands';
