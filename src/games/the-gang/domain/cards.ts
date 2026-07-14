import type { PlayingCard, Rank, Suit } from './types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const EXTENDED_RANKS: Rank[] = [...RANKS, 'B', 'C', 'D'];

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
    B: 15,
    C: 16,
    D: 17,
    Joker: 0,
    Wild: 0,
    Blank: 0,
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
    '五花',
    '五花顺',
    '五条',
    '同花顺',
    '皇家同花顺',
] as const;

export function createDeck(options: { extendedRanks?: boolean; gearSuit?: boolean } = {}): PlayingCard[] {
    const ranks = options.extendedRanks ? EXTENDED_RANKS : RANKS;
    const standardCards = SUITS.flatMap((suit) => ranks.map((rank) => ({ suit, rank, kind: 'standard' as const })));
    const gearCards = options.gearSuit
        ? ranks.map((rank) => ({ suit: 'gear' as const, rank, kind: 'standard' as const }))
        : [];
    return [...standardCards, ...gearCards];
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
    if (card.kind === 'joker') return 'Joker';
    if (card.kind === 'wild') return '万能';
    if (card.kind === 'blank') return '空白';

    const suitSymbol: Record<PlayingCard['suit'], string> = {
        spades: '♠',
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        gear: '☼',
        special: '',
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
