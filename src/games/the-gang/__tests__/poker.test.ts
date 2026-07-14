import { describe, expect, test } from 'vitest';
import { compareHandStrength, evaluateBestTexasHoldemHand } from '../domain/poker';
import type { PlayingCard, TheGangRulesConfig } from '../domain/types';

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

    test('齿轮扩展启用五花顺，普通基础规则不启用五花', () => {
        const cards = [
            c('2', 'spades'), c('3', 'hearts'), c('4', 'diamonds'), c('5', 'clubs'), { rank: '6', suit: 'gear' },
            c('9', 'clubs'), c('K', 'diamonds'),
        ] satisfies PlayingCard[];
        const base = evaluateBestTexasHoldemHand(cards);
        const grindingGears: TheGangRulesConfig = {
            gameMode: 'texas-holdem',
            challenges: { 'grinding-gears': 1 },
        };
        const expanded = evaluateBestTexasHoldemHand(cards, { rulesConfig: grindingGears });

        expect(base.strength.label).toBe('顺子');
        expect(expanded.strength.label).toBe('五花顺');
        expect(compareHandStrength(expanded.strength, base.strength)).toBeGreaterThan(0);
    });

    test('万能牌可以补成五条，复合锁会阻止被锁牌型成为最佳牌', () => {
        const cards = [
            c('9', 'spades'), c('9', 'hearts'), c('9', 'diamonds'), c('9', 'clubs'), { rank: 'Wild', suit: 'special', kind: 'wild' },
            c('A', 'clubs'), c('K', 'diamonds'),
        ] satisfies PlayingCard[];
        const withWild: TheGangRulesConfig = {
            gameMode: 'texas-holdem',
            challenges: { 'master-key': 1 },
        };
        const lockedFiveKind: TheGangRulesConfig = {
            ...withWild,
            lockedHandRanks: ['5s'],
        };

        expect(evaluateBestTexasHoldemHand(cards, { rulesConfig: withWild }).strength.label).toBe('五条');
        expect(evaluateBestTexasHoldemHand(cards, { rulesConfig: lockedFiveKind }).strength.label).toBe('四条');
    });
});
