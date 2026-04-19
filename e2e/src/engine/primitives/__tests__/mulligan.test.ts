/**
 * 通用重抽 (Mulligan) 工具测试
 */

import { describe, expect, it } from 'vitest';
import { performMulligan, checkMulliganEligible, autoMulligan } from '../mulligan';

// 简单卡牌类型用于测试
interface TestCard {
    id: string;
    type: 'minion' | 'action';
}

// 确定性洗牌：反转数组（便于断言）
const reverseShuffle = <T>(arr: T[]): T[] => [...arr].reverse();

// 不洗牌（保持原序）
const noShuffle = <T>(arr: T[]): T[] => [...arr];

describe('performMulligan', () => {
    it('将手牌洗回牌库并重新抽取', () => {
        const hand: TestCard[] = [
            { id: 'h1', type: 'action' },
            { id: 'h2', type: 'action' },
        ];
        const deck: TestCard[] = [
            { id: 'd1', type: 'minion' },
            { id: 'd2', type: 'minion' },
            { id: 'd3', type: 'action' },
        ];

        const result = performMulligan(hand, deck, 2, noShuffle);

        // 手牌应从合并后的牌库顶部抽取
        // noShuffle: [...deck, ...hand] = [d1, d2, d3, h1, h2]
        expect(result.hand).toHaveLength(2);
        expect(result.hand.map(c => c.id)).toEqual(['d1', 'd2']);
        expect(result.deck).toHaveLength(3);
        expect(result.deck.map(c => c.id)).toEqual(['d3', 'h1', 'h2']);
    });

    it('使用提供的洗牌函数', () => {
        const hand: TestCard[] = [{ id: 'h1', type: 'action' }];
        const deck: TestCard[] = [{ id: 'd1', type: 'minion' }];

        const result = performMulligan(hand, deck, 1, reverseShuffle);

        // reverseShuffle: [...deck, ...hand].reverse() = [h1, d1]
        expect(result.hand[0].id).toBe('h1');
        expect(result.deck[0].id).toBe('d1');
    });

    it('牌库不足时抽取所有可用牌', () => {
        const hand: TestCard[] = [{ id: 'h1', type: 'action' }];
        const deck: TestCard[] = [];

        const result = performMulligan(hand, deck, 5, noShuffle);

        expect(result.hand).toHaveLength(1);
        expect(result.deck).toHaveLength(0);
    });

    it('手牌为空时正常执行', () => {
        const hand: TestCard[] = [];
        const deck: TestCard[] = [
            { id: 'd1', type: 'minion' },
            { id: 'd2', type: 'action' },
        ];

        const result = performMulligan(hand, deck, 2, noShuffle);

        expect(result.hand).toHaveLength(2);
        expect(result.deck).toHaveLength(0);
    });
});

describe('checkMulliganEligible', () => {
    it('条件满足时返回 true', () => {
        const hand: TestCard[] = [
            { id: '1', type: 'action' },
            { id: '2', type: 'action' },
        ];
        const noMinions = (h: TestCard[]) => !h.some(c => c.type === 'minion');

        expect(checkMulliganEligible(hand, noMinions)).toBe(true);
    });

    it('条件不满足时返回 false', () => {
        const hand: TestCard[] = [
            { id: '1', type: 'minion' },
            { id: '2', type: 'action' },
        ];
        const noMinions = (h: TestCard[]) => !h.some(c => c.type === 'minion');

        expect(checkMulliganEligible(hand, noMinions)).toBe(false);
    });

    it('空手牌时依据条件函数判断', () => {
        const hand: TestCard[] = [];
        const noMinions = (h: TestCard[]) => !h.some(c => c.type === 'minion');

        // 空手牌无随从 → true
        expect(checkMulliganEligible(hand, noMinions)).toBe(true);
    });
});

describe('autoMulligan', () => {
    const noMinions = (h: TestCard[]) => !h.some(c => c.type === 'minion');

    it('条件不满足时不执行重抽', () => {
        const hand: TestCard[] = [
            { id: 'h1', type: 'minion' },
            { id: 'h2', type: 'action' },
        ];
        const deck: TestCard[] = [
            { id: 'd1', type: 'action' },
        ];

        const result = autoMulligan(hand, deck, noMinions, 2, noShuffle);

        expect(result.mulliganCount).toBe(0);
        expect(result.hand).toEqual(hand);
        expect(result.deck).toEqual(deck);
    });

    it('条件满足时执行一次重抽', () => {
        const hand: TestCard[] = [
            { id: 'h1', type: 'action' },
            { id: 'h2', type: 'action' },
        ];
        const deck: TestCard[] = [
            { id: 'd1', type: 'minion' },
            { id: 'd2', type: 'minion' },
            { id: 'd3', type: 'action' },
        ];

        const result = autoMulligan(hand, deck, noMinions, 2, noShuffle);

        expect(result.mulliganCount).toBe(1);
        // noShuffle 后抽取前2张：d1, d2（都是 minion）
        expect(result.hand.map(c => c.id)).toEqual(['d1', 'd2']);
    });

    it('默认最多重抽一次（即使重抽后仍不满足）', () => {
        // 牌库全是 action，重抽后仍无 minion
        const hand: TestCard[] = [
            { id: 'h1', type: 'action' },
            { id: 'h2', type: 'action' },
        ];
        const deck: TestCard[] = [
            { id: 'd1', type: 'action' },
            { id: 'd2', type: 'action' },
            { id: 'd3', type: 'action' },
        ];

        const result = autoMulligan(hand, deck, noMinions, 2, noShuffle);

        // 只重抽一次，即使结果仍满足条件
        expect(result.mulliganCount).toBe(1);
    });

    it('可配置最大重抽次数', () => {
        const hand: TestCard[] = [{ id: 'h1', type: 'action' }];
        const deck: TestCard[] = [
            { id: 'd1', type: 'action' },
            { id: 'd2', type: 'action' },
        ];

        const result = autoMulligan(hand, deck, noMinions, 1, noShuffle, 3);

        // 允许最多3次，但每次重抽后仍无 minion，执行3次
        expect(result.mulliganCount).toBe(3);
    });

    it('重抽后条件不再满足则停止', () => {
        // 第一次重抽后能抽到 minion
        const hand: TestCard[] = [{ id: 'h1', type: 'action' }];
        const deck: TestCard[] = [{ id: 'd1', type: 'minion' }];

        const result = autoMulligan(hand, deck, noMinions, 1, noShuffle, 3);

        // 第一次重抽后有 minion，停止
        expect(result.mulliganCount).toBe(1);
        expect(result.hand[0].type).toBe('minion');
    });
});
