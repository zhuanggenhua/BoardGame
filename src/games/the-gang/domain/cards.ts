import type { PlayingCard, Rank, Suit } from './types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const RANK_VALUE: Record<Rank, number> = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
};

export const HAND_LABELS = [
    '高牌',
    '一对',
    '两对',
    '三条',
    '顺子',
    '同花',
    '葫芦',
    '四条',
    '同花顺',
    '皇家同花顺',
] as const;

export function createDeck(): PlayingCard[] {
    return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

export function shuffleDeck(deck: PlayingCard[], random: { random(): number }): PlayingCard[] {
    const next = [...deck];
    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
}

export function formatCard(card: PlayingCard): string {
    const suitSymbol: Record<Suit, string> = {
        spades: '♠',
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
    };
    return `${card.rank}${suitSymbol[card.suit]}`;
}

export function compareRankArrays(left: number[], right: number[]): number {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        const delta = (left[index] ?? 0) - (right[index] ?? 0);
        if (delta !== 0) return delta;
    }
    return 0;
}

export function combinations<T>(items: T[], size: number): T[][] {
    if (size === 0) return [[]];
    if (items.length < size) return [];
    const [head, ...tail] = items;
    return [
        ...combinations(tail, size - 1).map((combo) => [head, ...combo]),
        ...combinations(tail, size),
    ];
}
