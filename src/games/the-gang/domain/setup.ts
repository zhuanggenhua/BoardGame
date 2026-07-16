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
    const baseCount = playerCount >= 10 ? 3 : playerCount >= 8 ? 2 : playerCount >= 7 ? 1 : 0;
    return Math.max(0, Math.min(baseCount - THE_GANG_EXIT_CHIP_MODES[normalized.exitChipMode].reduction, 3));
}

export function getChipValues(
    playerCount: number,
    config?: Partial<TheGangRulesConfig>,
    round: number = 1,
): number[] {
    const chipCount = playerCount + (round === 4 ? getExitChipCount(playerCount, config) : 0);
    return Array.from({ length: chipCount }, (_, index) => index + 1);
}
