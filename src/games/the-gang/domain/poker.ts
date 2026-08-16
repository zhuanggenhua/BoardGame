import {
    HAND_LABELS,
    RANK_VALUE,
    combinations,
    compareRankArrays,
} from './cards';
import type { HandStrength, PlayingCard, Rank, TheGangHandRankCode, TheGangRulesConfig } from './types';
import { isChallengeActive } from './expansions';

export interface EvaluatedHand {
    strength: HandStrength;
    cards: PlayingCard[];
}

export interface PokerEvaluationOptions {
    rulesConfig?: TheGangRulesConfig;
    blankedRank?: Rank;
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
    { category: 8, label: '同花顺', description: '同花色且连续的五张牌。' },
    { category: 9, label: '皇家同花顺', description: 'A-K-Q-J-10 同花顺，是最强牌型。' },
] as const;

export const THE_GANG_EXPANDED_HAND_RANK_RULES: readonly PokerHandRankRule[] = [
    ...TEXAS_HOLDEM_HAND_RANK_RULES,
    { category: 7.5, label: '五花顺', description: '齿轮扩展中，五张牌点数连续且覆盖五种花色。' },
    { category: 3.5, label: '五花', description: '齿轮扩展中，五张牌覆盖五种花色。' },
    { category: 8.5, label: '五条', description: '万能牌或鬼牌扩展中，五张同点数牌。' },
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

const codeCategory: Record<TheGangHandRankCode, number> = {
    HC: 0,
    '1p': 1,
    '2p': 2,
    '3s': 3,
    FA: 3.5,
    ST: 4,
    FL: 5,
    FH: 6,
    '4s': 7,
    FS: 7.5,
    SF: 8,
    '5s': 8.5,
    RF: 9,
};

const isLocked = (code: TheGangHandRankCode, options?: PokerEvaluationOptions) =>
    options?.rulesConfig?.lockedHandRanks?.includes(code) === true;

const isFlushEnabled = (options?: PokerEvaluationOptions) =>
    !options?.rulesConfig || !isChallengeActive(options.rulesConfig, 'no-color');

const isFlashEnabled = (options?: PokerEvaluationOptions) =>
    options?.rulesConfig ? isChallengeActive(options.rulesConfig, 'grinding-gears') : false;

const normalCardsOf = (cards: PlayingCard[], options?: PokerEvaluationOptions) => cards.filter((card) => (
    card.kind !== 'wild'
    && card.kind !== 'joker'
    && card.kind !== 'blank'
    && card.rank !== options?.blankedRank
));

const wildCardsOf = (cards: PlayingCard[]) => cards.filter((card) => (
    card.kind === 'wild'
    || card.kind === 'joker'
));

const makeStrength = (code: TheGangHandRankCode, ranks: number[], label: string): HandStrength => ({
    category: codeCategory[code],
    ranks,
    label,
    code,
});

const applyQuantumValues = (cards: PlayingCard[], options?: PokerEvaluationOptions): PlayingCard[] => {
    if (!options?.rulesConfig || !isChallengeActive(options.rulesConfig, 'quantum-chaos')) return cards;
    const normalOrder: Rank[] = isChallengeActive(options.rulesConfig, 'extra-hours')
        ? ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'B', 'C', 'D']
        : ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const reversed = [...normalOrder].reverse();
    const rankMap = Object.fromEntries(normalOrder.map((rank, index) => [rank, reversed[index]])) as Partial<Record<Rank, Rank>>;
    return cards.map((card) => {
        const replacementRank = rankMap[card.rank];
        return replacementRank ? { ...card, rank: replacementRank } : card;
    });
};

export function compareHandStrength(left: HandStrength, right: HandStrength): number {
    const categoryDelta = left.category - right.category;
    if (categoryDelta !== 0) return categoryDelta;
    return compareRankArrays(left.ranks, right.ranks);
}

export function evaluateFiveCardHand(cards: PlayingCard[], options?: PokerEvaluationOptions): HandStrength {
    const wildCards = wildCardsOf(cards);
    const regularCards = normalCardsOf(applyQuantumValues(cards, options), options);
    const values = regularCards.map((card) => RANK_VALUE[card.rank]);

    if (values.length === 0 && wildCards.length === 0) {
        return makeStrength('HC', [0], HAND_LABELS[0]);
    }

    const minHandValue = regularCards.length > 0 ? Math.min(...values) : 2;
    const maxHandValue = regularCards.length > 0 ? Math.max(...values) : 14;
    const minWildValue = options?.rulesConfig && isChallengeActive(options.rulesConfig, 'all-out-attack') ? maxHandValue : 2;
    const maxWildValue = options?.rulesConfig && isChallengeActive(options.rulesConfig, 'sleeping-guard') ? minHandValue : 17;

    const candidateValues = Array.from(new Set([
        ...values,
        ...Array.from({ length: Math.max(0, maxWildValue - minWildValue + 1) }, (_, index) => minWildValue + index),
    ])).filter((value) => value >= 2 && value <= 17);

    const expandedHands = expandWildCards(regularCards, wildCards.length, candidateValues);
    return expandedHands.reduce<HandStrength | null>((best, candidateCards) => {
        const strength = evaluateFiveCardHandWithoutWilds(candidateCards, options);
        if (!best || compareHandStrength(strength, best) > 0) return strength;
        return best;
    }, null) ?? makeStrength('HC', [0], HAND_LABELS[0]);
}

function expandWildCards(cards: PlayingCard[], wildCount: number, candidateValues: number[]): PlayingCard[][] {
    if (wildCount <= 0) return [cards];
    const suits: PlayingCard['suit'][] = ['spades', 'hearts', 'diamonds', 'clubs', 'gear'];
    const ranks = Object.entries(RANK_VALUE)
        .filter(([, value]) => candidateValues.includes(value))
        .map(([rank]) => rank as Rank);
    const substitutions = ranks.flatMap((rank) => suits.map((suit) => ({ suit, rank, kind: 'standard' as const })));

    let hands = [cards];
    for (let index = 0; index < wildCount; index += 1) {
        hands = hands.flatMap((hand) => substitutions.map((substitution) => [...hand, substitution]));
    }
    return hands;
}

function evaluateFiveCardHandWithoutWilds(cards: PlayingCard[], options?: PokerEvaluationOptions): HandStrength {
    const values = cards.map((card) => RANK_VALUE[card.rank]);
    const counts = new Map<number, number>();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const groups = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || b.value - a.value);
    const flush = isFlushEnabled(options) && cards.every((card) => card.suit === cards[0].suit);
    const flash = isFlashEnabled(options) && new Set(cards.map((card) => card.suit)).size >= 5;
    const straightHigh = getStraightHigh(values);

    const five = groups.find((group) => group.count === 5);
    if (five && !isLocked('5s', options)) {
        return makeStrength('5s', [five.value], '五条');
    }
    if (flush && straightHigh === 14 && !isLocked('RF', options)) {
        return makeStrength('RF', [14], '皇家同花顺');
    }
    if (flush && straightHigh !== null && !isLocked('SF', options)) {
        return makeStrength('SF', [straightHigh], '同花顺');
    }
    if (flash && straightHigh !== null && !isLocked('FS', options)) {
        return makeStrength('FS', [straightHigh], '五花顺');
    }

    const four = groups.find((group) => group.count === 4);
    if (four && !isLocked('4s', options)) {
        const kicker = groups.find((group) => group.count === 1)?.value ?? 0;
        return makeStrength('4s', [four.value, kicker], HAND_LABELS[7]);
    }

    const three = groups.find((group) => group.count === 3);
    const pair = groups.find((group) => group.count === 2);
    if (three && pair && !isLocked('FH', options)) {
        return makeStrength('FH', [three.value, pair.value], HAND_LABELS[6]);
    }

    if (flush && !isLocked('FL', options)) {
        return makeStrength('FL', sortDescending(values), HAND_LABELS[5]);
    }
    if (straightHigh !== null && !isLocked('ST', options)) {
        return makeStrength('ST', [straightHigh], HAND_LABELS[4]);
    }
    if (three && !isLocked('3s', options)) {
        const kickers = groups.filter((group) => group.count === 1).map((group) => group.value);
        return makeStrength('3s', [three.value, ...sortDescending(kickers)], HAND_LABELS[3]);
    }
    if (flash && !isLocked('FA', options)) {
        return makeStrength('FA', sortDescending(values), '五花');
    }

    const pairs = groups.filter((group) => group.count === 2).map((group) => group.value);
    if (pairs.length >= 2 && !isLocked('2p', options)) {
        const sortedPairs = sortDescending(pairs);
        const kicker = groups.find((group) => group.count === 1)?.value ?? 0;
        return makeStrength('2p', [...sortedPairs, kicker], HAND_LABELS[2]);
    }
    if (pairs.length === 1 && !isLocked('1p', options)) {
        const kickers = groups.filter((group) => group.count === 1).map((group) => group.value);
        return makeStrength('1p', [pairs[0], ...sortDescending(kickers)], HAND_LABELS[1]);
    }

    return makeStrength('HC', sortDescending(values), HAND_LABELS[0]);
}

export function evaluateBestTexasHoldemHand(cards: PlayingCard[], options?: PokerEvaluationOptions): EvaluatedHand {
    if (cards.length < 5) {
        throw new Error('At least five cards are required to evaluate a poker hand.');
    }

    return combinations(cards, 5).reduce<EvaluatedHand | null>((best, combo) => {
        const strength = evaluateFiveCardHand(combo, options);
        if (!best || compareHandStrength(strength, best.strength) > 0) {
            return { strength, cards: combo };
        }
        return best;
    }, null) as EvaluatedHand;
}

export function evaluateBestTheGangHand(
    handCards: PlayingCard[],
    boardCards: PlayingCard[],
    options?: PokerEvaluationOptions,
): EvaluatedHand {
    if (options?.rulesConfig?.omaha === true && handCards.length >= 2 && boardCards.length >= 3) {
        return combinations(handCards, 2)
            .flatMap((handCombo) => combinations(boardCards, 3).map((boardCombo) => [...handCombo, ...boardCombo]))
            .reduce<EvaluatedHand | null>((best, combo) => {
                const strength = evaluateFiveCardHand(combo, options);
                if (!best || compareHandStrength(strength, best.strength) > 0) {
                    return { strength, cards: combo };
                }
                return best;
            }, null) as EvaluatedHand;
    }

    return evaluateBestTexasHoldemHand([...handCards, ...boardCards], options);
}
