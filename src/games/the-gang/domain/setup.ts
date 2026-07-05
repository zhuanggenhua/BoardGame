import type { PlayerId, RandomFn } from '../../../engine/types';
import { createDeck, shuffleDeck } from './cards';
import type { TheGangCore, TheGangPlayerState } from './types';

const draw = (deck: PlayingCardDeck, count: number) => {
    const cards = deck.cards.slice(0, count);
    deck.cards = deck.cards.slice(count);
    return cards;
};

interface PlayingCardDeck {
    cards: ReturnType<typeof createDeck>;
}

export function createInitialHeistCore(
    playerIds: PlayerId[],
    random: RandomFn,
    previous?: Pick<TheGangCore, 'heistNumber' | 'successes' | 'failures' | 'heistHistory'>,
): TheGangCore {
    const deckRef: PlayingCardDeck = { cards: shuffleDeck(createDeck(), random) };
    const players = Object.fromEntries(
        playerIds.map((id): [PlayerId, TheGangPlayerState] => [
            id,
            {
                id,
                pocketCards: draw(deckRef, 2),
            },
        ]),
    );

    return {
        playerIds,
        players,
        deck: deckRef.cards,
        discardPile: [],
        communityCards: [],
        round: 1,
        phase: 'chip-selection',
        heistNumber: previous?.heistNumber ?? 1,
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

export function getChipValues(playerCount: number): number[] {
    return Array.from({ length: playerCount }, (_, index) => index + 1);
}
