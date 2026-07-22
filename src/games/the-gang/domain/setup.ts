import type { PlayerId, RandomFn } from '../../../engine/types';
import { createDeck, shuffleDeck } from './cards';
import {
    buildDealPlan,
    createSpecialistDeck,
    createSpecialCardsForConfig,
    createToolDeck,
    DEFAULT_THE_GANG_RULES_CONFIG,
    getBlackedRankForHeist,
    isChallengeActive,
    normalizeRulesConfig,
    THE_GANG_EXIT_CHIP_MODES,
} from './expansions';
import type { PlayingCard, TheGangCore, TheGangPlayerState, TheGangRulesConfig } from './types';

const draw = (deck: PlayingCardDeck, count: number) => {
    const cards = deck.cards.slice(0, count);
    deck.cards = deck.cards.slice(count);
    return cards;
};

interface PlayingCardDeck {
    cards: ReturnType<typeof createDeck>;
}

const cardKey = (card: PlayingCard) => `${card.kind ?? 'standard'}:${card.suit}:${card.rank}`;

const addCardCount = (counts: Map<string, number>, card: PlayingCard, delta: number) => {
    const key = cardKey(card);
    counts.set(key, Math.max(0, (counts.get(key) ?? 0) + delta));
};

const collectReservedCards = (core: TheGangCore): PlayingCard[] => [
    ...core.communityCards,
    ...core.discardPile,
    ...core.playerIds.flatMap((playerId) => {
        const player = core.players[playerId];
        return [
            ...player.pocketCards,
            ...(player.secondaryPocketCards ?? []),
            ...(player.communityCards ?? []),
            ...player.flashlightCards,
            ...player.nightVisionCards,
        ];
    }),
];

const normalizeRemainingDeckForConfig = (
    cards: PlayingCard[],
    reservedCards: PlayingCard[],
    config: TheGangRulesConfig,
): PlayingCard[] => {
    const desiredCards = [
        ...createDeck({
            extendedRanks: isChallengeActive(config, 'extra-hours'),
            gearSuit: isChallengeActive(config, 'grinding-gears'),
        }),
        ...createSpecialCardsForConfig(config),
    ];
    const desiredCounts = new Map<string, number>();
    for (const card of desiredCards) {
        addCardCount(desiredCounts, card, 1);
    }
    for (const card of reservedCards) {
        addCardCount(desiredCounts, card, -1);
    }

    const normalizedCards: PlayingCard[] = [];
    for (const card of cards) {
        const remaining = desiredCounts.get(cardKey(card)) ?? 0;
        if (remaining <= 0) continue;
        normalizedCards.push(card);
        addCardCount(desiredCounts, card, -1);
    }

    const missingCards: PlayingCard[] = [];
    for (const card of desiredCards) {
        const remaining = desiredCounts.get(cardKey(card)) ?? 0;
        if (remaining <= 0) continue;
        missingCards.push(card);
        addCardCount(desiredCounts, card, -1);
    }

    return [...normalizedCards, ...missingCards];
};

const fitCardCount = (
    currentCards: PlayingCard[] | undefined,
    targetCount: number,
    deck: PlayingCardDeck,
    removedCards: PlayingCard[],
): PlayingCard[] => {
    const cards = currentCards ?? [];
    if (targetCount <= 0) {
        removedCards.push(...cards);
        return [];
    }
    if (cards.length > targetCount) {
        removedCards.push(...cards.slice(targetCount));
        return cards.slice(0, targetCount);
    }
    if (cards.length < targetCount) {
        return [...cards, ...draw(deck, targetCount - cards.length)];
    }
    return cards;
};

const rankValue = (card: PlayingCard) => {
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'B', 'C', 'D'];
    return values.indexOf(card.rank) + 2;
};

export const discardLowestCard = (cards: PlayingCard[]) => (
    [...cards].sort((left, right) => rankValue(left) - rankValue(right)).slice(1)
);

export const discardHighestCard = (cards: PlayingCard[]) => (
    [...cards].sort((left, right) => rankValue(right) - rankValue(left)).slice(1)
);

export function createInitialHeistCore(
    playerIds: PlayerId[],
    random: RandomFn,
    previous?: Pick<TheGangCore, 'heistNumber' | 'successes' | 'failures' | 'heistHistory'> & {
        rulesConfig?: Partial<TheGangRulesConfig>;
    },
): TheGangCore {
    const heistNumber = previous?.heistNumber ?? 1;
    const config = normalizeRulesConfig(previous?.rulesConfig ?? DEFAULT_THE_GANG_RULES_CONFIG);
    const dealPlan = buildDealPlan(config);
    const deckRef: PlayingCardDeck = {
        cards: shuffleDeck([
            ...createDeck({
                extendedRanks: isChallengeActive(config, 'extra-hours'),
                gearSuit: isChallengeActive(config, 'grinding-gears'),
            }),
            ...createSpecialCardsForConfig(config),
        ], random),
    };
    const players = Object.fromEntries(
        playerIds.map((id): [PlayerId, TheGangPlayerState] => [
            id,
            {
                id,
                pocketCards: draw(deckRef, dealPlan.handCards),
                ...(config.twoHand ? { secondaryPocketCards: draw(deckRef, dealPlan.handCards) } : {}),
                toolCards: [],
                specialistCards: [],
                activeTools: [],
                flashlightCards: [],
                nightVisionCards: [],
                ...(dealPlan.perPlayerCommunity && dealPlan.pocketCards > 0
                    ? { communityCards: draw(deckRef, dealPlan.pocketCards) }
                    : {}),
            },
        ]),
    );
    const communityCards = dealPlan.perPlayerCommunity ? [] : draw(deckRef, dealPlan.pocketCards);

    return {
        playerIds,
        players,
        rules: {
            config,
            blankedRank: getBlackedRankForHeist(config, heistNumber),
        },
        deck: deckRef.cards,
        discardPile: [],
        toolDeck: shuffleDeck(createToolDeck(), random),
        toolDiscardPile: [],
        specialistDeck: shuffleDeck(createSpecialistDeck(), random),
        specialistDiscardPile: [],
        communityCards,
        round: 1,
        phase: 'chip-selection',
        heistStarted: false,
        heistNumber,
        successes: previous?.successes ?? 0,
        failures: previous?.failures ?? 0,
        currentRoundChips: {},
        currentRoundExitChipOwners: [],
        pendingProgress: undefined,
        roundHistory: [],
        heistHistory: previous?.heistHistory ?? [],
        lastShowdown: undefined,
        gameResult: undefined,
    };
}

export function getExitChipCount(playerCount: number, config?: Partial<TheGangRulesConfig>): number {
    const normalized = normalizeRulesConfig(config ?? DEFAULT_THE_GANG_RULES_CONFIG);
    if (normalized.exitChipMode === 'ultra-mastermind') return 0;
    const chipParticipantCount = getChipParticipantCount(playerCount, normalized);
    const baseCount = chipParticipantCount >= 10 ? 3 : chipParticipantCount >= 8 ? 2 : chipParticipantCount >= 7 ? 1 : 0;
    return Math.max(0, Math.min(baseCount - THE_GANG_EXIT_CHIP_MODES[normalized.exitChipMode].reduction, 3));
}

export function getChipParticipantCount(
    playerCount: number,
    config?: Partial<TheGangRulesConfig>,
): number {
    const normalized = normalizeRulesConfig(config ?? DEFAULT_THE_GANG_RULES_CONFIG);
    return normalized.twoHand ? playerCount * 2 : playerCount;
}

export function retuneInitialHeistCoreForRulesConfig(
    core: TheGangCore,
    config: TheGangRulesConfig,
): TheGangCore {
    const normalizedConfig = normalizeRulesConfig(config);
    const dealPlan = buildDealPlan(normalizedConfig);
    const deckRef: PlayingCardDeck = { cards: [...core.deck] };
    const removedCards: PlayingCard[] = [];

    const players = Object.fromEntries(
        core.playerIds.map((playerId): [PlayerId, TheGangPlayerState] => {
            const player = core.players[playerId];
            const pocketCards = fitCardCount(player.pocketCards, dealPlan.handCards, deckRef, removedCards);
            const secondaryPocketCards = normalizedConfig.twoHand
                ? fitCardCount(player.secondaryPocketCards, dealPlan.handCards, deckRef, removedCards)
                : undefined;
            if (!normalizedConfig.twoHand && player.secondaryPocketCards) {
                removedCards.push(...player.secondaryPocketCards);
            }

            const communityCards = dealPlan.perPlayerCommunity && dealPlan.pocketCards > 0
                ? fitCardCount(player.communityCards, dealPlan.pocketCards, deckRef, removedCards)
                : undefined;
            if ((!dealPlan.perPlayerCommunity || dealPlan.pocketCards <= 0) && player.communityCards) {
                removedCards.push(...player.communityCards);
            }

            return [playerId, {
                ...player,
                pocketCards,
                ...(secondaryPocketCards ? { secondaryPocketCards } : {}),
                ...(!secondaryPocketCards ? { secondaryPocketCards: undefined } : {}),
                ...(communityCards ? { communityCards } : {}),
                ...(!communityCards ? { communityCards: undefined } : {}),
            }];
        }),
    );

    const communityCards = dealPlan.perPlayerCommunity
        ? []
        : fitCardCount(core.communityCards, dealPlan.pocketCards, deckRef, removedCards);
    if (dealPlan.perPlayerCommunity && core.communityCards.length > 0) {
        removedCards.push(...core.communityCards);
    }

    const nextCore: TheGangCore = {
        ...core,
        players,
        rules: {
            config: normalizedConfig,
            blankedRank: getBlackedRankForHeist(normalizedConfig, core.heistNumber),
        },
        communityCards,
        currentRoundChips: {},
        currentRoundExitChipOwners: [],
        pendingProgress: undefined,
    };

    return {
        ...nextCore,
        deck: normalizeRemainingDeckForConfig(
            [...deckRef.cards, ...removedCards],
            collectReservedCards(nextCore),
            normalizedConfig,
        ),
    };
}

export function getChipValues(
    playerCount: number,
    config?: Partial<TheGangRulesConfig>,
    _round: number = 1,
): number[] {
    const normalized = normalizeRulesConfig(config ?? DEFAULT_THE_GANG_RULES_CONFIG);
    const chipParticipantCount = getChipParticipantCount(playerCount, normalized);
    const regularChipCount = Math.min(chipParticipantCount, 8);
    const zeroChipCount = Math.max(0, chipParticipantCount - 8);
    return [
        ...Array.from({ length: zeroChipCount }, () => 0),
        ...Array.from({ length: regularChipCount }, (_, index) => index + 1),
    ];
}
