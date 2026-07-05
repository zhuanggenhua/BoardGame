import {
    HAND_LABELS,
    RANK_VALUE,
    combinations,
    compareRankArrays,
} from './cards';
import type { HandStrength, PlayingCard } from './types';

export interface EvaluatedHand {
    strength: HandStrength;
    cards: PlayingCard[];
}

export interface PokerHandRankRule {
    category: number;
    label: string;
    description: string;
}

export const TEXAS_HOLDEM_HAND_RANK_RULES: readonly PokerHandRankRule[] = [
    { category: 0, label: HAND_LABELS[0], description: '没有组成对子或顺子/同花时，比最高牌。' },
    { category: 1, label: HAND_LABELS[1], description: '两张同点数牌，剩余牌作为踢脚比较。' },
    { category: 2, label: HAND_LABELS[2], description: '两组对子，先比高对子，再比低对子。' },
    { category: 3, label: HAND_LABELS[3], description: '三张同点数牌，强于两对。' },
    { category: 4, label: HAND_LABELS[4], description: '五张连续点数牌，A 可作 1 或 14。' },
    { category: 5, label: HAND_LABELS[5], description: '五张同花色牌，强于顺子。' },
    { category: 6, label: HAND_LABELS[6], description: '三条加一对，强于同花。' },
    { category: 7, label: HAND_LABELS[7], description: '四张同点数牌，强于葫芦。' },
    { category: 8, label: HAND_LABELS[8], description: '同花色且连续的五张牌。' },
    { category: 9, label: HAND_LABELS[9], description: 'A-K-Q-J-10 同花顺，是最强牌型。' },
] as const;

const sortDescending = (values: number[]) => [...values].sort((a, b) => b - a);

const getStraightHigh = (values: number[]): number | null => {
    const unique = Array.from(new Set(values)).sort((a, b) => b - a);
    if (unique.includes(14)) {
        unique.push(1);
    }

    for (let index = 0; index <= unique.length - 5; index += 1) {
        const window = unique.slice(index, index + 5);
        if (window.every((value, offset) => offset === 0 || value === window[offset - 1] - 1)) {
            return window[0] === 1 ? 5 : window[0];
        }
    }

    return null;
};

export function compareHandStrength(left: HandStrength, right: HandStrength): number {
    const categoryDelta = left.category - right.category;
    if (categoryDelta !== 0) return categoryDelta;
    return compareRankArrays(left.ranks, right.ranks);
}

export function evaluateFiveCardHand(cards: PlayingCard[]): HandStrength {
    const values = cards.map((card) => RANK_VALUE[card.rank]);
    const counts = new Map<number, number>();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const groups = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || b.value - a.value);
    const flush = cards.every((card) => card.suit === cards[0].suit);
    const straightHigh = getStraightHigh(values);

    if (flush && straightHigh === 14) {
        return { category: 9, ranks: [14], label: HAND_LABELS[9] };
    }
    if (flush && straightHigh !== null) {
        return { category: 8, ranks: [straightHigh], label: HAND_LABELS[8] };
    }

    const four = groups.find((group) => group.count === 4);
    if (four) {
        const kicker = groups.find((group) => group.count === 1)?.value ?? 0;
        return { category: 7, ranks: [four.value, kicker], label: HAND_LABELS[7] };
    }

    const three = groups.find((group) => group.count === 3);
    const pair = groups.find((group) => group.count === 2);
    if (three && pair) {
        return { category: 6, ranks: [three.value, pair.value], label: HAND_LABELS[6] };
    }

    if (flush) {
        return { category: 5, ranks: sortDescending(values), label: HAND_LABELS[5] };
    }
    if (straightHigh !== null) {
        return { category: 4, ranks: [straightHigh], label: HAND_LABELS[4] };
    }
    if (three) {
        const kickers = groups.filter((group) => group.count === 1).map((group) => group.value);
        return { category: 3, ranks: [three.value, ...sortDescending(kickers)], label: HAND_LABELS[3] };
    }

    const pairs = groups.filter((group) => group.count === 2).map((group) => group.value);
    if (pairs.length >= 2) {
        const sortedPairs = sortDescending(pairs);
        const kicker = groups.find((group) => group.count === 1)?.value ?? 0;
        return { category: 2, ranks: [...sortedPairs, kicker], label: HAND_LABELS[2] };
    }
    if (pairs.length === 1) {
        const kickers = groups.filter((group) => group.count === 1).map((group) => group.value);
        return { category: 1, ranks: [pairs[0], ...sortDescending(kickers)], label: HAND_LABELS[1] };
    }

    return { category: 0, ranks: sortDescending(values), label: HAND_LABELS[0] };
}

export function evaluateBestTexasHoldemHand(cards: PlayingCard[]): EvaluatedHand {
    if (cards.length < 5) {
        throw new Error('At least five cards are required to evaluate a poker hand.');
    }

    return combinations(cards, 5).reduce<EvaluatedHand | null>((best, combo) => {
        const strength = evaluateFiveCardHand(combo);
        if (!best || compareHandStrength(strength, best.strength) > 0) {
            return { strength, cards: combo };
        }
        return best;
    }, null) as EvaluatedHand;
}
