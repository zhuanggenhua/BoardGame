import type { GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import { SPLENDOR_CARD_DEFS, SPLENDOR_NOBLE_DEFS } from './data';
import type { CardTier, GemColor, SplendorCardDef, SplendorCore, SplendorNobleDef, SplendorPlayerState, TokenColor } from './types';

export const GEM_COLORS: GemColor[] = ['white', 'blue', 'green', 'red', 'black'];
export const TOKEN_COLORS: TokenColor[] = [...GEM_COLORS, 'gold'];
export const CARD_TIERS: CardTier[] = [1, 2, 3];
export const MAX_RESERVED_CARDS = 3;
export const MAX_TOKENS_PER_PLAYER = 10;

export const CARD_DEFS_BY_ID = Object.fromEntries(
    SPLENDOR_CARD_DEFS.map((card) => [card.id, card]),
) as Record<string, SplendorCardDef>;

export const NOBLE_DEFS_BY_ID = Object.fromEntries(
    SPLENDOR_NOBLE_DEFS.map((noble) => [noble.id, noble]),
) as Record<string, SplendorNobleDef>;

export const createEmptyTokens = (): Record<TokenColor, number> => ({
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
    gold: 0,
});

export function createPlayerState(playerId: PlayerId): SplendorPlayerState {
    return {
        id: playerId,
        tokens: createEmptyTokens(),
        reservedCardIds: [],
        purchasedCardIds: [],
        nobleIds: [],
        points: 0,
    };
}

export function getBankForPlayerCount(playerCount: number): Record<TokenColor, number> {
    const perGem = playerCount === 2 ? 4 : playerCount === 3 ? 5 : 7;
    return {
        white: perGem,
        blue: perGem,
        green: perGem,
        red: perGem,
        black: perGem,
        gold: 5,
    };
}

export function getNobleCountForPlayerCount(playerCount: number): number {
    return playerCount === 2 ? 3 : playerCount === 3 ? 4 : 5;
}

export function shuffleArray<T>(input: T[], random: RandomFn): T[] {
    const next = [...input];
    for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
}

export function splitDecks(random: RandomFn): Record<CardTier, string[]> {
    return {
        1: shuffleArray(SPLENDOR_CARD_DEFS.filter((card) => card.tier === 1).map((card) => card.id), random),
        2: shuffleArray(SPLENDOR_CARD_DEFS.filter((card) => card.tier === 2).map((card) => card.id), random),
        3: shuffleArray(SPLENDOR_CARD_DEFS.filter((card) => card.tier === 3).map((card) => card.id), random),
    };
}

export function drawOpenCards(deck: string[], count = 4): { open: string[]; deck: string[] } {
    return { open: deck.slice(0, count), deck: deck.slice(count) };
}

export function calculateDiscounts(player: SplendorPlayerState): Record<GemColor, number> {
    const discounts: Record<GemColor, number> = { white: 0, blue: 0, green: 0, red: 0, black: 0 };
    for (const cardId of player.purchasedCardIds) {
        const card = CARD_DEFS_BY_ID[cardId];
        if (card) {
            discounts[card.bonus] += 1;
        }
    }
    return discounts;
}

export function calculateEffectiveCost(player: SplendorPlayerState, card: SplendorCardDef): Record<GemColor, number> {
    const discounts = calculateDiscounts(player);
    return {
        white: Math.max(0, card.cost.white - discounts.white),
        blue: Math.max(0, card.cost.blue - discounts.blue),
        green: Math.max(0, card.cost.green - discounts.green),
        red: Math.max(0, card.cost.red - discounts.red),
        black: Math.max(0, card.cost.black - discounts.black),
    };
}

export function canAffordCard(player: SplendorPlayerState, card: SplendorCardDef): boolean {
    const effectiveCost = calculateEffectiveCost(player, card);
    let missing = 0;
    for (const color of GEM_COLORS) {
        missing += Math.max(0, effectiveCost[color] - player.tokens[color]);
    }
    return missing <= player.tokens.gold;
}

export function getPaymentTokens(player: SplendorPlayerState, card: SplendorCardDef): Partial<Record<TokenColor, number>> {
    const effectiveCost = calculateEffectiveCost(player, card);
    const payment: Partial<Record<TokenColor, number>> = {};
    let goldNeeded = 0;
    for (const color of GEM_COLORS) {
        const spend = Math.min(player.tokens[color], effectiveCost[color]);
        if (spend > 0) {
            payment[color] = spend;
        }
        goldNeeded += effectiveCost[color] - spend;
    }
    if (goldNeeded > 0) {
        payment.gold = goldNeeded;
    }
    return payment;
}

export function getTokenCount(player: SplendorPlayerState): number {
    return TOKEN_COLORS.reduce((sum, color) => sum + player.tokens[color], 0);
}

export function calculatePoints(player: SplendorPlayerState): number {
    const cardPoints = player.purchasedCardIds.reduce((sum, cardId) => sum + (CARD_DEFS_BY_ID[cardId]?.points ?? 0), 0);
    const noblePoints = player.nobleIds.reduce((sum, nobleId) => sum + (NOBLE_DEFS_BY_ID[nobleId]?.points ?? 0), 0);
    return cardPoints + noblePoints;
}

export function getEligibleNobles(core: SplendorCore, playerId: PlayerId): string[] {
    const player = core.players[playerId];
    const discounts = calculateDiscounts(player);
    return core.nobleIds.filter((nobleId) => {
        const noble = NOBLE_DEFS_BY_ID[nobleId];
        return noble ? GEM_COLORS.every((color) => discounts[color] >= noble.requirement[color]) : false;
    });
}

export function getNextTurn(core: SplendorCore): { nextPlayerId: PlayerId; nextRound: number } {
    const currentIndex = core.playerOrder.indexOf(core.currentPlayer);
    const nextIndex = (currentIndex + 1) % core.playerOrder.length;
    return {
        nextPlayerId: core.playerOrder[nextIndex],
        nextRound: nextIndex === 0 ? core.round + 1 : core.round,
    };
}

export function computeGameResult(core: SplendorCore): GameOverResult {
    const scores = Object.fromEntries(
        core.playerOrder.map((playerId) => [playerId, calculatePoints(core.players[playerId])]),
    ) as Record<PlayerId, number>;
    const maxScore = Math.max(...Object.values(scores));
    const highest = core.playerOrder.filter((playerId) => scores[playerId] === maxScore);
    const fewestCards = Math.min(...highest.map((playerId) => core.players[playerId].purchasedCardIds.length));
    const winners = highest.filter((playerId) => core.players[playerId].purchasedCardIds.length === fewestCards);
    if (winners.length === 1) {
        return { winner: winners[0], winners, scores };
    }
    return { draw: true, winners, scores };
}

export function maskCoreForPlayer(core: SplendorCore, playerId: PlayerId): Partial<SplendorCore> {
    const players = Object.fromEntries(
        Object.entries(core.players).map(([id, player]) => {
            if (id === playerId) {
                return [id, player];
            }
            return [
                id,
                {
                    ...player,
                    reservedCardIds: player.reservedCardIds.map((_, index) => `hidden-reserved-${id}-${index}`),
                },
            ];
        }),
    ) as SplendorCore['players'];
    return { players };
}
