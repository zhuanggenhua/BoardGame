import { describe, expect, test } from 'vitest';
import { compareHandStrength, evaluateBestTexasHoldemHand } from '../domain/poker';
import type { PlayingCard } from '../domain/types';

const c = (rank: PlayingCard['rank'], suit: PlayingCard['suit']): PlayingCard => ({ rank, suit });

describe('The Gang poker evaluator', () => {
    test('识别皇家同花顺高于四条', () => {
        const royal = evaluateBestTexasHoldemHand([
            c('10', 'spades'), c('J', 'spades'), c('Q', 'spades'), c('K', 'spades'), c('A', 'spades'),
            c('2', 'clubs'), c('3', 'diamonds'),
        ]);
        const quads = evaluateBestTexasHoldemHand([
            c('9', 'spades'), c('9', 'hearts'), c('9', 'diamonds'), c('9', 'clubs'), c('A', 'spades'),
            c('2', 'clubs'), c('3', 'diamonds'),
        ]);

        expect(royal.strength.label).toBe('皇家同花顺');
        expect(compareHandStrength(royal.strength, quads.strength)).toBeGreaterThan(0);
    });

    test('A2345 作为最小顺子处理', () => {
        const wheel = evaluateBestTexasHoldemHand([
            c('A', 'spades'), c('2', 'hearts'), c('3', 'diamonds'), c('4', 'clubs'), c('5', 'spades'),
            c('9', 'clubs'), c('K', 'diamonds'),
        ]);

        expect(wheel.strength.label).toBe('顺子');
        expect(wheel.strength.ranks[0]).toBe(5);
    });
});
