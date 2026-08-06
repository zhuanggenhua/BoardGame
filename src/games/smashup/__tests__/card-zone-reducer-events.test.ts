import { describe, expect, it } from 'vitest';
import { reduce } from '../domain/reducer';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent } from '../domain/types';
import { makeCard, makePlayer, makeState } from './helpers';

describe('CARD_RECOVERED_FROM_DISCARD reducer', () => {
    it('从弃牌堆取回卡牌到手牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('d1', 'test_minion', 'minion', '0'),
                        makeCard('d2', 'test_action', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: { playerId: '0', cardUids: ['d1'], reason: 'test' },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.players['0'].hand).toHaveLength(1);
        expect(newState.players['0'].hand[0].uid).toBe('d1');
        expect(newState.players['0'].discard).toHaveLength(1);
        expect(newState.players['0'].discard[0].uid).toBe('d2');
    });

    it('取回多张卡牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('d1', 'test', 'minion', '0'),
                        makeCard('d2', 'test', 'minion', '0'),
                        makeCard('d3', 'other', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: { playerId: '0', cardUids: ['d1', 'd2'], reason: 'test' },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.players['0'].hand).toHaveLength(2);
        expect(newState.players['0'].discard).toHaveLength(1);
    });
});

describe('HAND_SHUFFLED_INTO_DECK reducer', () => {
    it('手牌洗入牌库', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('h1', 'a', 'minion', '0'),
                        makeCard('h2', 'b', 'action', '0'),
                    ],
                    deck: [makeCard('d1', 'c', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.HAND_SHUFFLED_INTO_DECK,
            payload: { playerId: '0', newDeckUids: ['d1', 'h2', 'h1'], reason: 'test' },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.players['0'].hand).toHaveLength(0);
        expect(newState.players['0'].deck).toHaveLength(3);
        expect(newState.players['0'].deck.map(card => card.uid)).toEqual(['d1', 'h2', 'h1']);
    });

    it('部分手牌洗入牌库时保留未选中的手牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('h1', 'a', 'minion', '0'),
                        makeCard('h2', 'b', 'action', '0'),
                        makeCard('h3', 'c', 'minion', '0'),
                    ],
                    deck: [makeCard('d1', 'd', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.HAND_SHUFFLED_INTO_DECK,
            payload: { playerId: '0', newDeckUids: ['d1', 'h1'], reason: 'field_trip' },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.players['0'].hand.map(card => card.uid)).toEqual(['h2', 'h3']);
        expect(newState.players['0'].deck.map(card => card.uid)).toEqual(['d1', 'h1']);
    });
});

describe('ACTION_PLAYED reducer', () => {
    it('特殊行动已离开手牌时应使用事件 defId 兜底识别，不额外消耗行动额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    discard: [
                        makeCard('salvage-1', 'munchkin_dwarves_salvage', 'action', '0'),
                    ],
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.ACTION_PLAYED,
            payload: {
                playerId: '0',
                cardUid: 'salvage-1',
                defId: 'munchkin_dwarves_salvage',
            },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.players['0'].actionsPlayed).toBe(1);
        expect(newState.players['0'].discard.map(card => card.uid)).toEqual(['salvage-1']);
    });

    it('牌仍在手牌时应优先使用牌区 defId，不允许事件 payload 把普通行动伪装成特殊行动', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mine-1', 'munchkin_dwarves_mine', 'action', '0'),
                    ],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.ACTION_PLAYED,
            payload: {
                playerId: '0',
                cardUid: 'mine-1',
                defId: 'munchkin_dwarves_salvage',
            },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.players['0'].actionsPlayed).toBe(1);
        expect(newState.players['0'].hand).toEqual([]);
        expect(newState.players['0'].discard.map(card => card.defId)).toEqual(['munchkin_dwarves_mine']);
    });
});
